import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { planClaudeFactoryArtifacts } from '../src/core/claude-factory-binding.js';
import { assertClaudeFactorySelection, readClaudeFactoryMain } from '../src/core/claude-factory-start.js';
import { FACTORY_BINDINGS, FACTORY_WORKERS, assertClaudeFactoryRoleMechanics, assertClaudeFactoryWorkerBinding,
  factoryEntryBySkill, factoryWorkerByRole, factoryWorkerBySkill, normalizeClaudeFactoryCoordinatorTools } from '../src/core/claude-factory-declaration.js';
import { nativeGuardFileHooks } from '../src/core/guard.js';
import { readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { expectedWorkerHooks, handbackCheckHooks } from '../src/core/handback-check.js';
import { prepareFactoryCoordinator } from './helpers/factory-coordinator.js';
import type { ClaudeFactoryBinding, LockfileManifest } from '../src/core/types.js';

/** The exact tool classes every native role starts from before its own grant is added. */
const BASE_GRANT = ['Glob', 'Grep', 'ListMcpResourcesTool', 'Read', 'ReadMcpResourceTool', 'ReportFindings'];
const REALIZER_GRANT = ['Bash', 'Edit', 'NotebookEdit', 'PowerShell', 'Skill', 'SubagentHandback', 'Write'];
const EVALUATOR_GRANT = ['SubagentHandback'];

/** Reorder the declared binding list and restore it once the run settles; nothing in the closure may depend on those positions. */
async function withReorderedBindings<T>(run: () => Promise<T>): Promise<T> {
  const bindings = FACTORY_BINDINGS as unknown as { reverse(): void };
  bindings.reverse();
  return run().finally(() => bindings.reverse());
}

/** A minimal reviewed native worker posture for any name; a listed name is accepted by the checks today. */
function nativeWorkerText(name: string, skill: string, grant: readonly string[], hooks: unknown): string {
  return `---\n${YAML.stringify({
    name, description: 'Fixture worker posture.', model: 'inherit', effort: 'medium', background: false,
    tools: [...BASE_GRANT, ...grant].join(', '), skills: [skill], hooks,
  })}---\nFixture body.\n`;
}

describe('factory worker posture lookup', () => {
  it('accepts the three listed workers with their exact reviewed postures', () => {
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-realizer', 'realize-artifact', REALIZER_GRANT, nativeGuardFileHooks()),
      'factory-realizer', 'realize-artifact', true)).not.toThrow();
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-evaluator', 'evaluate-artifact', EVALUATOR_GRANT, expectedWorkerHooks('factory-evaluator', 'read-only')),
      'factory-evaluator', 'evaluate-artifact', false)).not.toThrow();
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-sync', 'sync-host', EVALUATOR_GRANT, readOnlyGuardFileHooks()),
      'factory-sync', 'sync-host', false)).not.toThrow();
  });

  it('gives the hand-back entry to the evaluator and to no other worker (ADR 0070)', () => {
    const withEntry = (hooks: ReturnType<typeof readOnlyGuardFileHooks>) => ({ PreToolUse: [...hooks.PreToolUse, ...handbackCheckHooks().PreToolUse] });
    // The evaluator without its entry, and the sync worker and the realizer with one, are all refused.
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-evaluator', 'evaluate-artifact', EVALUATOR_GRANT, readOnlyGuardFileHooks()),
      'factory-evaluator', 'evaluate-artifact', false)).toThrow(/critical guard registration differs for factory-evaluator/);
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-sync', 'sync-host', EVALUATOR_GRANT, withEntry(readOnlyGuardFileHooks())),
      'factory-sync', 'sync-host', false)).toThrow(/critical guard registration differs for factory-sync/);
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-realizer', 'realize-artifact', REALIZER_GRANT, withEntry(nativeGuardFileHooks())),
      'factory-realizer', 'realize-artifact', true)).toThrow(/critical guard registration differs for factory-realizer/);
    // An entry that adds onFailure is not the reviewed one: the hook fails open on purpose.
    const strict = withEntry(readOnlyGuardFileHooks());
    (strict.PreToolUse[1]!.hooks[0] as { onFailure?: string }).onFailure = 'block';
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-evaluator', 'evaluate-artifact', EVALUATOR_GRANT, strict),
      'factory-evaluator', 'evaluate-artifact', false)).toThrow(/critical guard registration differs/);
  });

  it('refuses an unlisted worker posture instead of silently granting the evaluator grant', () => {
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-third', 'third-artifact', EVALUATOR_GRANT, readOnlyGuardFileHooks()),
      'factory-third', 'third-artifact', false)).toThrow(/unknown factory worker role factory-third/);
  });

  it('refuses a worker binding that declares an unlisted role instead of treating it as the evaluator', () => {
    const binding = JSON.parse(fs.readFileSync(path.resolve('registry/hosts/claude/agent-factory-realize.binding.json'), 'utf8')) as unknown as ClaudeFactoryBinding;
    const entry = FACTORY_BINDINGS.find(item => item.skill === 'realize-artifact')!;
    expect(() => assertClaudeFactoryWorkerBinding(binding, entry, 'factory-realizer')).not.toThrow();
    binding.roles = [{ name: 'factory-third', definition: 'subagent-factory-evaluator', contract: 'core/subagent-factory-evaluator.contract.json',
      source: 'hosts/claude/agents/factory-third.md', installed: '.claude/agents/factory-third.md',
      loading: 'subagent', skills: ['realize-artifact'], guard: 'read-only' }];
    expect(() => assertClaudeFactoryWorkerBinding(binding, entry, 'factory-third')).toThrow(/unknown factory worker role factory-third/);
  });
});

describe('coordinator delegate grant', () => {
  const others = ['AskUserQuestion', 'Bash', 'Read'];
  it('accepts exactly the three reviewed workers and reduces the scoped grant to Agent', () => {
    expect(normalizeClaudeFactoryCoordinatorTools(['Agent(factory-realizer, factory-evaluator, factory-sync)', ...others])).toEqual(['Agent', ...others]);
    expect(normalizeClaudeFactoryCoordinatorTools(['Agent(factory-sync, factory-evaluator, factory-realizer)', ...others])).toEqual(['Agent', ...others]);
  });
  it.each([
    ['the old two-worker grant', 'Agent(factory-realizer, factory-evaluator)'],
    ['a missing realizer', 'Agent(factory-evaluator, factory-sync)'],
    ['a fourth name', 'Agent(factory-realizer, factory-evaluator, factory-sync, Explore)'],
    ['a substitute for the sync worker', 'Agent(factory-realizer, factory-evaluator, Explore)'],
    ['a repeated name', 'Agent(factory-realizer, factory-evaluator, factory-evaluator)'],
    ['a duplicate sync worker', 'Agent(factory-realizer, factory-evaluator, factory-sync, factory-sync)'],
    ['a wildcard', 'Agent(*)'],
    ['a bare Agent', 'Agent'],
  ])('refuses %s', (_label, grant) => {
    expect(() => normalizeClaudeFactoryCoordinatorTools([grant, ...others])).toThrow(/coordinate-artifact requires exactly Agent\(factory-realizer, factory-evaluator, factory-sync\)/);
  });
  it('refuses a bare Agent beside the scoped grant and a second scoped grant', () => {
    expect(() => normalizeClaudeFactoryCoordinatorTools(['Agent', 'Agent(factory-realizer, factory-evaluator, factory-sync)', ...others])).toThrow(/coordinate-artifact requires exactly/);
    expect(() => normalizeClaudeFactoryCoordinatorTools(['Agent(factory-realizer, factory-evaluator, factory-sync)', 'Agent(factory-sync)', ...others])).toThrow(/coordinate-artifact requires exactly/);
  });
});

describe('factory closure wiring independent of the declared order', () => {
  let root: string | undefined;
  afterEach(async () => { if (root) { await fs.remove(root); root = undefined; } });

  it('plans one identical closure whatever order the bindings are declared in', async () => {
    const fixture = await prepareFactoryCoordinator(); root = fixture.root;
    const resolver = new RegistryResolver(fixture.registry);
    const bundle = (await resolver.getBundle('agent-factory'))!;
    const resolved = await resolver.resolve('agent-factory');
    const plan = async () => (await planClaudeFactoryArtifacts(bundle, resolved, fixture.registry, 'project', true))
      .map(artifact => ({ ...artifact }))
      .sort((a, b) => a.relPath.localeCompare(b.relPath));
    const straight = await plan();
    expect(straight.map(artifact => artifact.relPath)).toContain('.claude/skills/realize-artifact/assets/claude-binding.json');
    const reordered = await withReorderedBindings(plan);
    expect(reordered).toEqual(straight);
  });

  it('checks the installed workers in the order realizer, evaluator, sync after the main, whatever order the bindings are declared in', async () => {
    const fixture = await prepareFactoryCoordinator(); root = fixture.root;
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const receipt = (skill: string): string => `.claude/skills/${skill}/assets/claude-binding.json`;
    const firstFailure = (): string => {
      try { readClaudeFactoryMain(fixture.workspace); } catch (error) { return error instanceof Error ? error.message : String(error); }
      return 'startup accepted an edited closure';
    };
    await fs.appendFile(fixture.installed(receipt('sync-host')), '\nuser edit\n');
    expect(firstFailure()).toContain(`edited required file ${receipt('sync-host')}`);
    await fs.appendFile(fixture.installed(receipt('evaluate-artifact')), '\nuser edit\n');
    expect(firstFailure()).toContain(`edited required file ${receipt('evaluate-artifact')}`);
    await withReorderedBindings(async () => { expect(firstFailure()).toContain(`edited required file ${receipt('evaluate-artifact')}`); });
    await fs.appendFile(fixture.installed(receipt('realize-artifact')), '\nuser edit\n');
    expect(firstFailure()).toContain(`edited required file ${receipt('realize-artifact')}`);
    await fs.appendFile(fixture.installed(receipt('coordinate-artifact')), '\nuser edit\n');
    expect(firstFailure()).toContain(`edited required file ${receipt('coordinate-artifact')}`);
  });

  it('checks the installed main closure first whatever order the bindings are declared in', async () => {
    const fixture = await prepareFactoryCoordinator(); root = fixture.root;
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const receipts = ['.claude/skills/coordinate-artifact/assets/claude-binding.json', '.claude/skills/realize-artifact/assets/claude-binding.json'];
    for (const rel of receipts) await fs.appendFile(fixture.installed(rel), '\nuser edit\n');
    const firstFailure = (): string => {
      try { readClaudeFactoryMain(fixture.workspace); } catch (error) { return error instanceof Error ? error.message : String(error); }
      return 'startup accepted an edited closure';
    };
    expect(firstFailure()).toContain('edited required file .claude/skills/coordinate-artifact/assets/claude-binding.json');
    await withReorderedBindings(async () => {
      expect(firstFailure()).toContain('edited required file .claude/skills/coordinate-artifact/assets/claude-binding.json');
    });
  });
});

describe('factory worker table lookups', () => {
  it('maps each worker Skill to its exact reviewed role, posture, closure, hooks and grant', () => {
    expect(FACTORY_WORKERS).toHaveLength(3);
    const realizer = factoryWorkerBySkill('realize-artifact');
    expect(realizer).toMatchObject({ role: 'factory-realizer', definition: 'subagent-realize-for-host', guard: 'destructive',
      requiredInstalled: ['.claude/skills/author-skill/references/skill-attribution.md'], grant: [...REALIZER_GRANT] });
    expect([...realizer.hooks]).toEqual([{ id: 'reject-destructive-operations', kind: 'destructive' }]);
    const evaluator = factoryWorkerBySkill('evaluate-artifact');
    expect(evaluator).toMatchObject({ role: 'factory-evaluator', definition: 'subagent-factory-evaluator', guard: 'read-only',
      requiredInstalled: [], grant: [...EVALUATOR_GRANT] });
    expect([...evaluator.hooks]).toEqual([{ id: 'reject-mutating-tools', kind: 'read-only' }]);
    const sync = factoryWorkerBySkill('sync-host');
    expect(sync).toMatchObject({ role: 'factory-sync', definition: 'subagent-host-update-sync', guard: 'read-only',
      requiredInstalled: [], grant: [...EVALUATOR_GRANT] });
    expect([...sync.hooks]).toEqual([{ id: 'reject-mutating-tools', kind: 'read-only' }]);
    expect(factoryWorkerByRole('factory-realizer').skill).toBe('realize-artifact');
    expect(factoryWorkerByRole('factory-evaluator').skill).toBe('evaluate-artifact');
    expect(factoryWorkerByRole('factory-sync').skill).toBe('sync-host');
  });

  it('refuses a Skill or role that is not in the table, coordinator Skills included', () => {
    expect(() => factoryWorkerBySkill('unknown-skill')).toThrow(/unknown factory worker skill unknown-skill/);
    expect(() => factoryWorkerBySkill('coordinate-artifact')).toThrow(/unknown factory worker skill coordinate-artifact/);
    expect(() => factoryWorkerByRole('factory-unknown')).toThrow(/unknown factory worker role factory-unknown/);
    expect(() => factoryEntryBySkill('unknown-skill')).toThrow(/unknown factory skill unknown-skill/);
  });

  it('resolves the declared binding entries by Skill name whatever position they sit at', () => {
    expect(factoryEntryBySkill('realize-artifact')).toEqual({ skill: 'realize-artifact', file: 'hosts/claude/agent-factory-realize.binding.json', root: '.claude/skills/realize-artifact' });
    expect(factoryEntryBySkill('evaluate-artifact')).toEqual({ skill: 'evaluate-artifact', file: 'hosts/claude/agent-factory-evaluate.binding.json', root: '.claude/skills/evaluate-artifact' });
    expect(factoryEntryBySkill('sync-host')).toEqual({ skill: 'sync-host', file: 'hosts/claude/agent-factory-sync.binding.json', root: '.claude/skills/sync-host' });
    expect(factoryEntryBySkill('coordinate-artifact')).toEqual({ skill: 'coordinate-artifact', file: 'hosts/claude/agent-factory-coordinate.binding.json', root: '.claude/skills/coordinate-artifact' });
  });
});

/** Change fields of one worker row for the length of a run, then restore them; the closure must read these rows, not names of its own. */
async function withWorkerRow<T>(skill: string, patch: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const row = FACTORY_WORKERS.find(item => item.skill === skill) as unknown as Record<string, unknown>;
  const saved = { ...row };
  Object.assign(row, patch);
  return run().finally(() => { Object.assign(row, saved); });
}

describe('factory worker table cross-checks', () => {
  const readBinding = (file: string): ClaudeFactoryBinding => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as unknown as ClaudeFactoryBinding;

  it('refuses a worker found by Skill whose role name belongs to another worker row', () => {
    const binding = readBinding('registry/hosts/claude/agent-factory-realize.binding.json');
    const evaluator = factoryWorkerByRole('factory-evaluator');
    binding.roles = [{ name: 'factory-evaluator', definition: evaluator.definition, contract: `core/${evaluator.definition}.contract.json`,
      source: 'hosts/claude/agents/factory-evaluator.md', installed: '.claude/agents/factory-evaluator.md',
      loading: 'subagent', skills: ['realize-artifact'], guard: evaluator.guard }];
    expect(() => assertClaudeFactoryWorkerBinding(binding, factoryEntryBySkill('realize-artifact'), 'factory-evaluator'))
      .toThrow(/worker factory-evaluator does not belong to skill realize-artifact/);
    const sync = readBinding('registry/hosts/claude/agent-factory-sync.binding.json');
    expect(() => assertClaudeFactoryWorkerBinding(sync, factoryEntryBySkill('sync-host'), 'factory-sync')).not.toThrow();
  });

  it.each([
    ['a Skill that is not the table Skill of the role', 'factory-evaluator', 'sync-host', EVALUATOR_GRANT, expectedWorkerHooks('factory-evaluator', 'read-only'), false],
    ['a destructive flag on a read-only worker', 'factory-evaluator', 'evaluate-artifact', EVALUATOR_GRANT, nativeGuardFileHooks(), true],
    ['a read-only flag on the destructive worker', 'factory-realizer', 'realize-artifact', REALIZER_GRANT, readOnlyGuardFileHooks(), false],
  ] as const)('refuses %s in the role mechanics', (_label, name, skill, grant, hooks, destructive) => {
    expect(() => assertClaudeFactoryRoleMechanics(nativeWorkerText(name, skill, grant, hooks), name, skill, destructive))
      .toThrow(/critical role binding differs for factory-/);
  });

  it('lists the capability classes each worker must have on its table row', () => {
    expect([...factoryWorkerBySkill('realize-artifact').capabilities]).toEqual(['edit', 'handback', 'read', 'report', 'search', 'shell', 'skill']);
    expect([...factoryWorkerBySkill('evaluate-artifact').capabilities]).toEqual(['handback', 'read', 'report', 'search']);
    expect([...factoryWorkerBySkill('sync-host').capabilities]).toEqual(['handback', 'read', 'report', 'search']);
  });

  describe('through a coordinated install', () => {
    let root: string | undefined;
    afterEach(async () => { if (root) { await fs.remove(root); root = undefined; } });
    const install = async (fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>) =>
      new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);

    it.each([
      ['realize-artifact', /coordinate-artifact worker realizer capabilities differ/],
      ['evaluate-artifact', /evaluator capabilities must retain exactly the reviewed read\/search\/report\/handback classes/],
      ['sync-host', /sync capabilities must retain exactly the reviewed read\/search\/report\/handback classes/],
    ])('reads the capability classes of %s from its table row', async (skill, message) => {
      const fixture = await prepareFactoryCoordinator(); root = fixture.root;
      const classes = [...factoryWorkerBySkill(skill).capabilities, 'web'];
      await withWorkerRow(skill, { capabilities: classes }, async () => { await expect(install(fixture)).rejects.toThrow(message); });
      expect(await fs.readdir(fixture.workspace)).toEqual([]);
    });

    it('reads the required installed edges of each worker from its table row at startup and in the selection check', async () => {
      const fixture = await prepareFactoryCoordinator(); root = fixture.root;
      await install(fixture);
      const selection = readClaudeFactoryMain(fixture.workspace);
      expect(() => assertClaudeFactorySelection(selection)).not.toThrow();
      // The realizer edge leaves the table: the selection inventory no longer lists it.
      await withWorkerRow('realize-artifact', { requiredInstalled: [] }, async () => {
        expect(() => assertClaudeFactorySelection(selection)).toThrow(/matching complete installed closure inventory is required/);
      });
      // A table edge on the evaluator is read at startup (here a role file, which is not a rule projection).
      const receipt = fixture.installed('.claude/skills/evaluate-artifact/assets/claude-binding.json');
      const edge = '.claude/agents/factory-evaluator.md';
      const body = await fs.readJson(receipt) as ClaudeFactoryBinding;
      body.requiredInstalled = [edge];
      await fs.writeJson(receipt, body);
      const lockFile = path.join(fixture.state, 'agents-united.json');
      const lock = await fs.readJson(lockFile) as LockfileManifest;
      lock.projections!['.claude/skills/evaluate-artifact/assets/claude-binding.json']!.hash = `sha256:${crypto.createHash('sha256').update(await fs.readFile(receipt)).digest('hex')}`;
      await fs.writeJson(lockFile, lock);
      await withWorkerRow('evaluate-artifact', { requiredInstalled: [edge] }, async () => {
        expect(() => readClaudeFactoryMain(fixture.workspace)).toThrow(/invalid required rule \.claude\/agents\/factory-evaluator\.md/);
      });
    });
  });
});
