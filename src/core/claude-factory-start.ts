/** Read-only installed startup checks. Source registry files need not exist. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { FACTORY_BINDINGS, COORDINATOR_RULES, COORDINATOR_SUPPORT, COORDINATOR_WORKER_SUPPORT, assertClaudeFactoryLoader, assertClaudeFactoryWorkerBinding, parseClaudeFactoryBinding, assertClaudeFactoryRoleMechanics, factoryEntryBySkill, factoryWorkerBySkill } from './claude-factory-declaration.js';
import { NATIVE_GUARD_FILES, GUARD_SCRIPT } from './guard.js';
import { READ_ONLY_GUARD_SCRIPT } from './readonly-guard.js';
import { resolveStateDir } from './state-dir.js';
import type { ClaudeFactoryMainSelection, LockfileManifest, ProjectionKind } from './types.js';

const MAIN = 'orchestrator-agent-factory' as const;
const ROLE = '.claude/agents/orchestrator-agent-factory.md' as const;
const RECEIPT = '.claude/skills/coordinate-artifact/assets/claude-binding.json' as const;
/** The coordinator first, then its workers in workflow order. */
const FACTORY_CHECK_ORDER = ['coordinate-artifact', 'realize-artifact', 'evaluate-artifact', 'sync-host'] as const;
const HASH = /^sha256:[a-f0-9]{64}$/;
const REL = /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*|\.claude|\.agents)(?:\/[A-Za-z0-9_.-]+)*$/;
const fail = (message: string): never => { throw new Error(`Claude factory startup: ${message}. Run 'agents update agent-factory --fanout claude --native' in this workspace.`); };

/** Check every ancestor and its real spelling before following any required file. */
function physicalFile(workspace: string, rel: string): string {
  if (!REL.test(rel) || rel.split('/').some(part => !part || part === '.' || part === '..')) fail(`invalid contained path ${rel}`);
  let current = path.resolve(workspace);
  if (fs.realpathSync(current) !== current || fs.lstatSync(current).isSymbolicLink()) fail('linked or nonphysical workspace ancestor');
  for (const segment of rel.split('/')) {
    const matches = fs.readdirSync(current).filter(name => name.toLowerCase() === segment.toLowerCase());
    if (matches.length !== 1 || matches[0] !== segment) fail(`missing or case-colliding required file ${rel}`);
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail(`linked required path ${rel}`);
    if (current !== path.join(workspace, ...rel.split('/')) && !stat.isDirectory()) fail(`non-directory ancestor ${rel}`);
  }
  if (!fs.lstatSync(current).isFile()) fail(`required path is not a regular file ${rel}`);
  return current;
}

/** Strict receipt/ownership/physical-byte validation of main and all three complete workers. */
export function readClaudeFactoryMain(workspace: string): ClaudeFactoryMainSelection {
  workspace = path.resolve(workspace);
  try {
    const state = resolveStateDir('project', undefined, { cwd: workspace });
    const stateRel = path.relative(workspace, path.join(state, 'agents-united.json')).split(path.sep).join('/');
    const lock = JSON.parse(fs.readFileSync(physicalFile(workspace, stateRel), 'utf8')) as LockfileManifest;
    if (!Array.isArray(lock.installed?.bundles) || !lock.installed.bundles.every(name => typeof name === 'string')
      || !lock.installed.bundles.includes('agent-factory') || lock.scope !== 'project' || lock.nativeLane !== true
      || !Array.isArray(lock.fanout) || !lock.fanout.every(host => typeof host === 'string')
      || !lock.fanout.includes('claude') || (lock.pluginLane !== undefined && lock.pluginLane !== false)) fail('owning project native installation with recorded Claude fanout is required');
    const projections = lock.projections ?? {};
    const seen = new Map<string, string>();
    for (const rel of Object.keys(projections)) {
      const lower = rel.toLowerCase();
      if (seen.has(lower) && seen.get(lower) !== rel) fail(`case-colliding projection ${rel}`);
      seen.set(lower, rel);
    }
    const checked = new Map<string, string>();
    const read = (rel: string, kind: ProjectionKind, managed: boolean): string => {
      const record = projections[rel];
      if (!record || record.host !== 'claude' || record.kind !== kind || !Array.isArray(record.owners)
        || !record.owners.includes('agent-factory') || record.managedMarker !== managed || !HASH.test(record.hash)) fail(`unowned, unmanaged or invalid required ${kind} ${rel}`);
      const bytes = fs.readFileSync(physicalFile(workspace, rel));
      const hash = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
      if (hash !== record.hash) fail(`edited required file ${rel}`);
      const text = bytes.toString('utf8');
      if (managed && !text.includes('managed-by: agents-united')) fail(`missing managed marker ${rel}`);
      checked.set(rel, hash);
      return text;
    };
    // The main coordinator is checked first, then its workers in workflow order; each entry resolves by Skill name, never by list position.
    for (const entry of FACTORY_CHECK_ORDER.map(factoryEntryBySkill)) {
      const receipt = `${entry.root}/assets/claude-binding.json`;
      const binding = parseClaudeFactoryBinding(JSON.parse(read(receipt, 'skill', true)) as unknown, entry, true);
      if (entry.skill !== 'coordinate-artifact') assertClaudeFactoryWorkerBinding(binding, entry, factoryWorkerBySkill(entry.skill).role);
      const skillText = read(binding.installed, 'skill', true);
      assertClaudeFactoryLoader(binding, entry, skillText, true);
      // All four fixed preloads are reference guidance; no new execution/loader mechanism.
      if (/(?:^|\s)!`/.test(skillText) || /^\s*```!/m.test(skillText)) fail(`dynamic shell injection in ${binding.skill}`);
      for (const rel of binding.requiredSupport) read(`${entry.root}/${rel}`, 'skill', false);
      for (const ref of binding.references) read(ref.installed, 'rule', true);
      for (const role of binding.roles) {
        assertClaudeFactoryRoleMechanics(read(role.installed, 'role', true), role.name, binding.skill, role.guard === 'destructive');
        const guard = NATIVE_GUARD_FILES[role.guard];
        const text = read(guard.rel, 'hook', true);
        const script = text.replace(/\r\n/g, '\n').replace(/\/\/ managed-by: agents-united[^\n]*\n?$/, '').trimEnd();
        if (script !== (role.guard === 'destructive' ? GUARD_SCRIPT : READ_ONLY_GUARD_SCRIPT).trimEnd()) fail(`critical guard bytes differ ${guard.rel}`);
      }
      // Coordinator edges are checked by the three fixed worker entries in this loop.
      if (entry.skill !== 'coordinate-artifact') for (const rel of factoryWorkerBySkill(entry.skill).requiredInstalled) read(rel, 'rule', true);
    }
    return { kind: 'factory-native', name: MAIN, installed: ROLE, receipt: RECEIPT,
      checked: [...checked].sort(([a], [b]) => a.localeCompare(b)).map(([file, hash]) => ({ path: file, hash })) };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Claude factory startup:')) throw error;
    return fail(error instanceof Error ? error.message : 'invalid installed receipt');
  }
}

/** Pure planner guard; launch repeats physical checks and compares this full inventory. */
export function assertClaudeFactorySelection(selection: ClaudeFactoryMainSelection | undefined): asserts selection is ClaudeFactoryMainSelection {
  const shape = z.object({ kind: z.literal('factory-native'), name: z.literal(MAIN), installed: z.literal(ROLE), receipt: z.literal(RECEIPT),
    checked: z.array(z.object({ path: z.string().min(1), hash: z.string().regex(HASH) }).strict()).min(1) }).strict();
  if (!shape.safeParse(selection).success) fail('matching installed main selection is required');
  const paths = FACTORY_CHECK_ORDER.map(factoryEntryBySkill).flatMap(entry => {
    const name = entry.skill === 'coordinate-artifact' ? MAIN : factoryWorkerBySkill(entry.skill).role;
    const support = entry.skill === 'coordinate-artifact' ? COORDINATOR_SUPPORT : COORDINATOR_WORKER_SUPPORT[entry.skill];
    return [`.claude/agents/${name}.md`, `${entry.root}/SKILL.md`, `${entry.root}/assets/claude-binding.json`,
      ...support.map(rel => `${entry.root}/${rel}`), ...COORDINATOR_RULES.map(rule => `${entry.root}/references/rules/${rule}`)];
  });
  paths.push(NATIVE_GUARD_FILES.destructive.rel, NATIVE_GUARD_FILES['read-only'].rel,
    ...FACTORY_CHECK_ORDER.filter(skill => skill !== 'coordinate-artifact').flatMap(skill => factoryWorkerBySkill(skill).requiredInstalled));
  if (!isDeepStrictEqual(selection!.checked.map(item => item.path).sort(), [...new Set(paths)].sort())) fail('matching complete installed closure inventory is required');
}
