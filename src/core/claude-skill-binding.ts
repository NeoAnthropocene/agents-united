/** Plan 033 slice 3 and ADR 0082 decision 7: the approved, on-demand Claude task-skill loading edges. */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import type { BundleDefinition, ClaudeSkillBinding, InstallScope, ResolvedAssets } from './types.js';
import { nativeSkillSource, nativeWorkflowSource } from './native-package.js';
import { unsupportedSkillNames } from './host-profile.js';
import { isMaintainerOnlySkillPath } from './skill-folder.js';

const BUNDLE = 'agent-factory';
const RULE_SOURCE = 'rules/skill-attribution.md';
const RULE_FILE = 'skill-attribution.md';

/** One standalone forked factory Skill and the registry-relative file that declares its binding. */
export interface BoundFactorySkill { readonly skill: string; readonly file: string }

/**
 * The closed, reviewed list of standalone forked factory Skills. A new Skill adds one entry here
 * and its binding JSON file; no other module changes (coordinated worker skills use
 * FACTORY_BINDINGS in claude-factory-declaration.ts, a different and heavier binding).
 */
export const BOUND_FACTORY_SKILLS: readonly BoundFactorySkill[] = [
  { skill: 'author-skill', file: 'hosts/claude/agent-factory.binding.json' },
  { skill: 'author-rule', file: 'hosts/claude/agent-factory-rule.binding.json' },
];

/** True when `name` is a factory Skill whose loading edge is declared by a binding record. */
export function isBoundFactorySkill(name: string): boolean {
  return BOUND_FACTORY_SKILLS.some(entry => entry.skill === name);
}

const SUPPORT_PATH = z.string().refine(rel =>
  /^(references|examples|assets|scripts)\/[a-zA-Z0-9_.\/-]+$/.test(rel)
  && !rel.split('/').some(part => part === '.' || part === '..' || part.length === 0)
  && !isMaintainerOnlySkillPath(rel), 'must be an installable, skill-relative support path');

function bindingSchema(skill: string) {
  const root = `.claude/skills/${skill}`;
  return z.object({
    version: z.literal(1), bundle: z.literal(BUNDLE), skill: z.literal(skill),
    source: z.literal(`hosts/claude/skills/${skill}/SKILL.md`), installed: z.literal(`${root}/SKILL.md`),
    loadingRole: z.object({ kind: z.literal('built-in'), name: z.literal('general-purpose'), context: z.literal('fork'), background: z.literal(false) }).strict(),
    invocation: z.literal(`/${skill}`),
    surface: z.object({ host: z.literal('claude'), product: z.literal('Claude Code CLI'), scope: z.literal('workspace'), lane: z.literal('native') }).strict(),
    requiredSupport: z.array(SUPPORT_PATH).min(1).refine(paths => new Set(paths).size === paths.length, 'must not repeat support paths'),
    rule: z.object({ source: z.literal(RULE_SOURCE), installed: z.literal(`${root}/references/${RULE_FILE}`), consultation: z.literal('before-source-or-draft') }).strict(),
    reviewedInputs: z.array(z.string().min(1)).min(1),
  }).strict();
}

function loaderSchema(skill: string) {
  return z.object({ name: z.literal(skill), context: z.literal('fork'), agent: z.literal('general-purpose'), background: z.literal(false) }).passthrough();
}

/** Pure per-entry validation of a parsed binding record; `label` names the file in the refusal. */
export function parseClaudeSkillBinding(entry: BoundFactorySkill, declaration: unknown, label: string = entry.file): ClaudeSkillBinding {
  const parsed = bindingSchema(entry.skill).safeParse(declaration);
  if (!parsed.success) throw new Error(`Claude ${BUNDLE} binding: invalid declaration in ${label}: ${parsed.error.message}`);
  return parsed.data;
}

function requiredFile(file: string, root: string, edge: string): void {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Claude ${BUNDLE} binding: missing ${edge}: ${file}.`);
  // Resource enumeration deliberately ignores links; accepting one here would validate
  // bytes that the installed skill never receives, even when its target stays inside root.
  for (let current = file; current !== root; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Claude ${BUNDLE} binding: linked ${edge} would not survive support-file projection: ${current}.`);
    if (current === path.dirname(current)) throw new Error(`Claude ${BUNDLE} binding: ${edge} is outside its source root.`);
  }
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Claude ${BUNDLE} binding: ${edge} escapes its source root: ${file}.`);
  }
}

function assertBoundSkill(
  entry: BoundFactorySkill,
  resolved: ResolvedAssets,
  registryDir: string,
  scope: InstallScope,
  nativeLane: boolean,
): ClaudeSkillBinding {
  const skill = entry.skill;
  const bindingFile = path.join(registryDir, ...entry.file.split('/'));
  requiredFile(bindingFile, registryDir, 'loading binding record');
  let declaration: unknown;
  try { declaration = JSON.parse(fs.readFileSync(bindingFile, 'utf8')) as unknown; }
  catch { throw new Error(`Claude ${BUNDLE} binding: invalid JSON in ${bindingFile}.`); }
  const binding = parseClaudeSkillBinding(entry, declaration, bindingFile);
  if (!nativeLane || scope === 'global') throw new Error(`Claude ${BUNDLE} binding requires the native lane in workspace scope.`);
  if (!(resolved.skills ?? []).includes(binding.skill) || !(resolved.rules ?? []).includes(RULE_FILE)) {
    throw new Error(`Claude ${BUNDLE} binding requires its declared ${binding.skill} skill and attribution rule in the resolved asset set.`);
  }
  if (unsupportedSkillNames(registryDir, 'claude').has(skill)) throw new Error(`Claude ${BUNDLE} binding: ${skill} is marked unsupported by the host profile.`);
  const skillDir = path.join(registryDir, 'skills', skill);
  requiredFile(path.join(skillDir, 'SKILL.md'), registryDir, 'shared skill entry');
  const nativeSource = nativeSkillSource(registryDir, 'claude', skill);
  if (!nativeSource) throw new Error(`Claude ${BUNDLE} binding: missing native skill entry ${binding.source}.`);
  requiredFile(nativeSource, registryDir, 'native skill entry');
  const nativeText = fs.readFileSync(nativeSource, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(nativeText);
  let frontmatter: unknown;
  try { frontmatter = match ? YAML.parse(match[1]) as unknown : undefined; }
  catch { throw new Error(`Claude ${BUNDLE} binding: malformed native loader frontmatter.`); }
  if (!loaderSchema(skill).safeParse(frontmatter).success) throw new Error(`Claude ${BUNDLE} binding: native loader name/loading role must select ${skill}, context: fork, agent: general-purpose, background: false.`);
  if (!/\]\(references\/skill-attribution\.md\)/.test(nativeText)) throw new Error(`Claude ${BUNDLE} binding: native loader is missing its attribution consultation link.`);
  const referencedSupport = new Set(nativeText.match(/\b(?:references|examples|assets|scripts)\/[A-Za-z0-9_.\/-]+/g) ?? []);
  referencedSupport.delete(`references/${RULE_FILE}`);
  for (const rel of referencedSupport) {
    if (!binding.requiredSupport.includes(rel)) throw new Error(`Claude ${BUNDLE} binding: loader-referenced support ${rel} is absent from its required support declaration.`);
  }
  if (nativeWorkflowSource(registryDir, 'claude', skill)) throw new Error(`Claude ${BUNDLE} binding: a native workflow would shadow the bound task skill.`);
  requiredFile(path.join(registryDir, ...binding.rule.source.split('/')), registryDir, 'attribution rule');
  for (const rel of binding.requiredSupport) requiredFile(path.join(skillDir, ...rel.split('/')), skillDir, `required support file ${rel}`);
  if (fs.existsSync(path.join(skillDir, 'references', RULE_FILE))) {
    throw new Error(`Claude ${BUNDLE} binding: shared support collides with the canonical attribution rule destination.`);
  }
  return binding;
}

/**
 * Read-only preflight; callers invoke this before state migrations or any filesystem write.
 * Returns the bindings that apply to this bundle and asset set (empty when none does).
 */
export function assertClaudeSkillBindings(
  bundle: BundleDefinition,
  resolved: ResolvedAssets,
  registryDir: string,
  scope: InstallScope,
  nativeLane: boolean,
): ClaudeSkillBinding[] {
  const bindings: ClaudeSkillBinding[] = [];
  for (const entry of BOUND_FACTORY_SKILLS) {
    if (bundle.name !== BUNDLE && !(resolved.skills ?? []).includes(entry.skill)) continue;
    bindings.push(assertBoundSkill(entry, resolved, registryDir, scope, nativeLane));
  }
  return bindings;
}
