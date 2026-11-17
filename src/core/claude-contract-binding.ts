/** Closed required loading for the two built-in contributor authoring tasks. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { z } from 'zod';
import type { BundleDefinition, ClaudeContractTaskBinding, InstallScope, LockfileManifest, ResolvedAssets } from './types.js';
import type { PlannedClaudeArtifact } from './claude-projector.js';
import { nativeWorkflowSource, renderNativeRule, renderNativeSkill } from './native-package.js';
import { unsupportedSkillNames } from './host-profile.js';

const TASKS = [
  {
    skill: 'author-contract', declaration: 'hosts/claude/agent-factory-contract.binding.json',
    support: ['references/job.md', 'references/reuse.md', 'references/bindings.md', 'references/verification.md', 'examples/new-pair.md', 'examples/reused-pair.md', 'assets/job.schema.json', 'assets/report.json', 'scripts/draft-pair.mjs', 'scripts/contract-return.mjs'],
  },
  {
    skill: 'author-bundle', declaration: 'hosts/claude/agent-factory-bundle.binding.json',
    support: ['references/job.md', 'references/verification.md', 'references/bundle-shape.md', 'references/prerequisites.md', 'assets/domain-bundle.template.json', 'assets/organization-bundle.template.json', 'assets/leader-responsibility.template.md', 'assets/report.json', 'examples/domain.md', 'examples/organization.md', 'scripts/bundle-return.mjs'],
  },
] as const;
type TaskEntry = typeof TASKS[number];
const rootOf = (skill: ClaudeContractTaskBinding['skill']): string => `.claude/skills/${skill}`;
const RULES = ['skill-attribution.md', 'git-guardrails.md', 'test-driven-development.md', 'clean-code-and-architecture.md', 'domain-modeling-and-adr.md', 'multi-agent-coordination.md', 'quality-aesthetics-accessibility.md'] as const;
const references = (root: string): Array<{ source: string; installed: string }> => RULES.map(name => ({ source: `rules/${name}`, installed: `${root}/references/${name === 'skill-attribution.md' ? '' : 'rules/'}${name}` }));
const relative = z.string().regex(/^[a-zA-Z0-9_.\/-]+$/).refine(value => !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..'), 'expected contained relative path');
const bindingSchema = (task: TaskEntry): z.ZodType<ClaudeContractTaskBinding> => z.object({
  version: z.literal(1), bundle: z.literal('agent-factory'), skill: z.literal(task.skill),
  source: z.literal(`hosts/claude/skills/${task.skill}/SKILL.md`), installed: z.literal(`${rootOf(task.skill)}/SKILL.md`),
  loadingRole: z.object({ kind: z.literal('built-in'), name: z.literal('general-purpose'), context: z.literal('fork'), background: z.literal(false) }).strict(),
  invocation: z.literal(`/${task.skill}`),
  surface: z.object({ host: z.literal('claude'), product: z.literal('Claude Code CLI'), scope: z.literal('workspace'), lane: z.literal('native') }).strict(),
  requiredSupport: z.array(z.enum(task.support)).length(task.support.length).refine(values => new Set(values).size === values.length, 'duplicate support'),
  references: z.array(z.object({ source: relative, installed: relative }).strict()).length(RULES.length),
  reviewedInputs: z.array(z.string().min(1)).min(1),
}).strict();
const loaderSchema = (task: TaskEntry) => z.object({
  name: z.literal(task.skill), description: z.string().min(1), context: z.literal('fork'), agent: z.literal('general-purpose'), background: z.literal(false),
  metadata: z.object({ author: z.literal('agents-united'), version: z.string().min(1), license: z.literal('MIT') }).strict(),
}).strict();
function fail(skill: ClaudeContractTaskBinding['skill'], message: string): never { throw new Error(`Claude ${skill} binding: ${message}.`); }
function requiredFile(registryDir: string, rel: string, skill: ClaudeContractTaskBinding['skill']): string {
  const root = path.resolve(registryDir), file = path.resolve(root, rel), contained = path.relative(root, file);
  if (!contained || contained === '..' || contained.startsWith(`..${path.sep}`) || path.isAbsolute(contained)) return fail(skill, `required path escapes source: ${rel}`);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(skill, `missing required file ${rel}`);
  for (let current = file; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) return fail(skill, `linked required path ${rel}`);
    if (current === path.dirname(current)) break;
  }
  return file;
}

export function assertClaudeContractTaskBinding(bundle: BundleDefinition, resolved: ResolvedAssets, registryDir: string, scope: InstallScope, nativeLane: boolean): ClaudeContractTaskBinding[] {
  return TASKS.filter(task => resolved.skills.includes(task.skill)).map(task => readTaskBinding(task, bundle, registryDir, scope, nativeLane));
}

function readTaskBinding(task: TaskEntry, bundle: BundleDefinition, registryDir: string, scope: InstallScope, nativeLane: boolean): ClaudeContractTaskBinding {
  const skill = task.skill, ROOT = rootOf(skill), DECLARATION = task.declaration, refs = references(ROOT);
  if (bundle.name !== 'agent-factory') return fail(skill, 'task requires its owning agent-factory Bundle');
  if (scope !== 'project' || !nativeLane) return fail(skill, 'task requires the native lane in workspace scope');
  const file = path.join(registryDir, DECLARATION);
  if (!fs.existsSync(file)) return fail(skill, 'missing required task binding');
  requiredFile(registryDir, DECLARATION, skill);
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; } catch { return fail(skill, 'invalid declaration JSON'); }
  const parsed = bindingSchema(task).safeParse(raw);
  if (!parsed.success) return fail(skill, `invalid declaration: ${parsed.error.message}`);
  const binding = parsed.data;
  const actualRefs = binding.references.map(ref => `${ref.source}\0${ref.installed}`).sort();
  if (JSON.stringify(actualRefs) !== JSON.stringify(refs.map(ref => `${ref.source}\0${ref.installed}`).sort())) return fail(skill, 'required on-demand rule references differ');
  if (unsupportedSkillNames(registryDir, 'claude').has(skill)) return fail(skill, 'task is marked unavailable by the host profile');
  if (nativeWorkflowSource(registryDir, 'claude', skill)) return fail(skill, 'native workflow would shadow the task Skill');
  requiredFile(registryDir, `skills/${skill}/SKILL.md`, skill);
  const text = fs.readFileSync(requiredFile(registryDir, binding.source, skill), 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  let meta: unknown;
  try { meta = front ? YAML.parse(front[1]!) as unknown : undefined; } catch { return fail(skill, 'malformed native loader YAML'); }
  if (!loaderSchema(task).safeParse(meta).success) return fail(skill, 'native loader must keep the reviewed name, foreground built-in fork and no grant/hook overrides');
  if (skill === 'author-bundle' && (/(?:^|\s)!`/.test(text) || /^\s*```!/m.test(text))) return fail(skill, 'native entry dynamic shell injection is unavailable for this authoring task');
  const boundRefs = binding.references.map(ref => ref.installed.slice(ROOT.length + 1));
  const allowed = new Set([...binding.requiredSupport, ...boundRefs, 'assets/claude-binding.json']);
  for (const rel of text.match(/\b(?:references|examples|assets|scripts)\/[A-Za-z0-9_.\/-]+/g) ?? []) if (!allowed.has(rel)) return fail(skill, `native entry references unbound support ${rel}`);
  for (const rel of [...binding.requiredSupport, ...boundRefs]) if (!text.includes(rel)) return fail(skill, `native entry omits required consultation ${rel}`);
  for (const rel of binding.requiredSupport) requiredFile(registryDir, `skills/${skill}/${rel}`, skill);
  for (const ref of binding.references) {
    requiredFile(registryDir, ref.source, skill);
    if (fs.existsSync(path.join(registryDir, `skills/${skill}`, ref.installed.slice(ROOT.length + 1)))) return fail(skill, `shared support collides with bound rule ${ref.installed}`);
  }
  if (fs.existsSync(path.join(registryDir, `skills/${skill}/assets/claude-binding.json`))) return fail(skill, 'shared support collides with generated binding receipt');
  return binding;
}

export function planClaudeContractTaskArtifacts(bindings: readonly ClaudeContractTaskBinding[], registryDir: string): PlannedClaudeArtifact[] {
  return bindings.flatMap(binding => {
    const skill = binding.skill, root = rootOf(skill), task = TASKS.find(entry => entry.skill === skill)!;
    const artifacts: PlannedClaudeArtifact[] = binding.references.map(ref => ({ kind: 'rule', relPath: ref.installed, ownedByBundle: true, managedMarker: true, content: renderNativeRule(fs.readFileSync(requiredFile(registryDir, ref.source, skill), 'utf8'), ref.source, 'claude') }));
    artifacts.push({ kind: 'skill', relPath: `${root}/assets/claude-binding.json`, ownedByBundle: true, managedMarker: true, content: JSON.stringify({ ...binding, _agentsUnitedManaged: 'managed-by: agents-united | profile: claude-native', sourceHash: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(requiredFile(registryDir, task.declaration, skill))).digest('hex')}` }, null, 2) + '\n' });
    return artifacts;
  });
}

export function assertClaudeContractTaskDelivery(bindings: readonly ClaudeContractTaskBinding[], registryDir: string, artifacts: readonly PlannedClaudeArtifact[]): void {
  for (const binding of bindings) {
    const skill = binding.skill, root = rootOf(skill);
    const expected = [binding.installed, ...binding.requiredSupport.map(rel => `${root}/${rel}`), ...binding.references.map(ref => ref.installed), `${root}/assets/claude-binding.json`];
    for (const rel of expected) if (artifacts.filter(item => item.relPath === rel).length !== 1) return fail(skill, `required delivery edge missing or duplicated in plan: ${rel}`);
    for (const artifact of artifacts.filter(item => item.relPath.startsWith(`${root}/`))) if (!expected.includes(artifact.relPath)) return fail(skill, `unreviewed task support in plan: ${artifact.relPath}`);
    const entry = artifacts.find(item => item.relPath === binding.installed)!;
    if (entry.content !== renderNativeSkill(fs.readFileSync(requiredFile(registryDir, binding.source, skill), 'utf8'), `skills/${skill}/SKILL.md`, 'claude')) return fail(skill, 'planned native entry does not match its loading source');
    for (const rel of binding.requiredSupport) {
      const artifact = artifacts.find(item => item.relPath === `${root}/${rel}`)!;
      if (!artifact.sourceFilePath || !fs.readFileSync(artifact.sourceFilePath).equals(fs.readFileSync(requiredFile(registryDir, `skills/${skill}/${rel}`, skill)))) return fail(skill, `required support bytes absent from plan: ${rel}`);
    }
  }
}

/** Source-independent receipt detection for the same closed task set. */
export function hasClaudeContractTaskReceipt(lock: LockfileManifest): boolean {
  return TASKS.some(task => lock.projections?.[`${rootOf(task.skill)}/assets/claude-binding.json`] !== undefined);
}

/** The complete task closure is checked before any install/state migration write. */
export function assertClaudeContractTaskTargets(artifacts: readonly PlannedClaudeArtifact[], workspaceRoot: string, lock: Partial<LockfileManifest>, force: boolean): void {
  const root = path.resolve(workspaceRoot);
  for (const artifact of artifacts) {
    const task = TASKS.find(entry => artifact.relPath.startsWith(`${rootOf(entry.skill)}/`));
    if (!task) continue;
    const skill = task.skill;
    const rel = artifact.relPath, file = path.resolve(root, rel), contained = path.relative(root, file);
    if (!contained || contained === '..' || contained.startsWith(`..${path.sep}`) || path.isAbsolute(contained)) return fail(skill, `delivery destination escapes workspace: ${rel}`);
    for (let current = file; ; current = path.dirname(current)) {
      if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) return fail(skill, `linked delivery destination ${rel}`);
      if (current === path.dirname(current)) break;
    }
    if (!fs.existsSync(file)) continue;
    if (!fs.statSync(file).isFile()) return fail(skill, `delivery collision at ${rel}`);
    const record = lock.projections?.[rel];
    if (!record) return fail(skill, `unmanaged delivery collision at ${rel}; preserve it and resolve the scope explicitly`);
    const actual = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
    if (actual !== record.hash && !force) return fail(skill, `user-modified delivery ${rel}; review its diff before explicit --force replacement`);
  }
}
