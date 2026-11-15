import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { planClaudeFactoryArtifacts } from '../src/core/claude-factory-binding.js';
import { readClaudeFactoryMain } from '../src/core/claude-factory-start.js';
import { FACTORY_BINDINGS, FACTORY_WORKERS, assertClaudeFactoryRoleMechanics, assertClaudeFactoryWorkerBinding,
  factoryEntryBySkill, factoryWorkerByRole, factoryWorkerBySkill } from '../src/core/claude-factory-declaration.js';
import { nativeGuardFileHooks } from '../src/core/guard.js';
import { readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { prepareFactoryCoordinator } from './helpers/factory-coordinator.js';
import type { ClaudeFactoryBinding } from '../src/core/types.js';

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
      nativeWorkerText('factory-evaluator', 'evaluate-artifact', EVALUATOR_GRANT, readOnlyGuardFileHooks()),
      'factory-evaluator', 'evaluate-artifact', false)).not.toThrow();
    expect(() => assertClaudeFactoryRoleMechanics(
      nativeWorkerText('factory-sync', 'sync-host', EVALUATOR_GRANT, readOnlyGuardFileHooks()),
      'factory-sync', 'sync-host', false)).not.toThrow();
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
