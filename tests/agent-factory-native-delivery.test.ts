import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { prepareFactoryNative } from './helpers/factory-native.js';
import type { LockfileManifest } from '../src/core/types.js';
import YAML from 'yaml';

describe('native-only factory delivery through the public installer', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryNative>>;
  beforeEach(async () => { fixture = await prepareFactoryNative(await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-delivery-'))); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('delivers the explicitly bound native worker without a legacy carrier', async () => {
    const result = await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    expect(result.projections.some(item => item.path?.endsWith('factory-realizer.md'))).toBe(true);
    expect(await fs.readFile(fixture.installed('.claude/agents/factory-realizer.md'), 'utf8')).toContain('Fixture author identity.');
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.['.claude/agents/factory-realizer.md']).toMatchObject({ kind: 'role', owners: ['agent-factory'], managedMarker: true });
    expect(lock.projections?.['.claude/agents/factory-realizer.md']?.canonical).toBeUndefined();
  });

  it.each([
    ['contract', 'core/subagent-realize-for-host.contract.json'],
    ['definition', 'core/subagent-realize-for-host.core.md'],
    ['native runbook', 'hosts/claude/skills/realize-artifact/SKILL.md'],
    ['support', 'skills/realize-artifact/references/job.md'],
    ['guard', 'hosts/claude/hooks/agents-united-guard.js'],
  ])('refuses missing %s before creating any installation state', async (_label, rel) => {
    await fs.remove(fixture.source(rel));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options))
      .rejects.toThrow(/factory.*(missing|required)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it.each<[string, (meta: Record<string, unknown>) => void]>([
    ['guard registration', meta => { meta.hooks = {}; }],
    ['required preload', meta => { meta.skills = []; }],
    ['loader name', meta => { meta.name = 'another-worker'; }],
    ['grant ceiling', meta => { meta.tools = `${String(meta.tools)}, Agent`; }],
    ['foreground surface', meta => { meta.background = true; }],
    ['inherited model', meta => { meta.model = 'opus'; }],
    ['bounded effort', meta => { meta.effort = 'max'; }],
    ['description', meta => { delete meta.description; }],
    ['unknown native key', meta => { meta.maxturns = 99; }],
    ['permission override', meta => { meta.permissionMode = 'bypassPermissions'; }],
    ['grant deny overlay', meta => { meta.disallowedTools = 'Write'; }],
  ])('rejects an ineffective %s in the native worker', async (_label, change) => {
    const file = fixture.source('hosts/claude/agents/factory-realizer.md');
    const text = await fs.readFile(file, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)!;
    const meta = YAML.parse(match[1]!) as Record<string, unknown>;
    change(meta);
    await fs.writeFile(file, `---\n${YAML.stringify(meta)}---\n${match[2]}`);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options))
      .rejects.toThrow(/factory.*(guard|preload|name|grant|foreground|background|model|effort|description|key|permission)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects a native definition whose floor differs from its supplied core', async () => {
    const file = fixture.source('hosts/claude/agents/factory-realizer.md');
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('Fixture author identity.', 'Different identity.'));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*floor/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it.each(['skills', 'hooks', 'workflows'] as const)('rejects an unbound permitted %s identifier', async field => {
    const file = fixture.source('core/subagent-realize-for-host.contract.json');
    const contract = await fs.readJson(file) as Record<string, unknown>;
    contract[field] = ['unknown-affordance'];
    await fs.writeJson(file, contract);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*(unbound|unavailable)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('delivers the bound policy references, guard and runtime binding receipt with the runbook', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const reference = fixture.installed(fixture.binding.references[0]!.installed);
    expect(await fs.readFile(reference, 'utf8')).toContain('Attribution');
    const receipt = await fs.readJson(fixture.installed('.claude/skills/realize-artifact/assets/claude-binding.json')) as { roles: Array<{ name: string }> };
    expect(receipt.roles.map(role => role.name)).toEqual(['factory-realizer']);
    expect(await fs.pathExists(fixture.installed('.claude/hooks/agents-united-guard.js'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/rules/skill-attribution.md'))).toBe(false);
  });

  it.each([
    ['unknown field', (binding: typeof fixture.binding) => ({ ...binding, host: 'claude' })],
    ['empty roles', (binding: typeof fixture.binding) => ({ ...binding, roles: [] })],
    ['duplicate destination', (binding: typeof fixture.binding) => ({ ...binding, roles: [...binding.roles, ...binding.roles] })],
    ['support traversal', (binding: typeof fixture.binding) => ({ ...binding, requiredSupport: ['references/../../foreign.md'] })],
  ])('refuses %s in the explicit binding', async (_label, change) => {
    await fs.writeJson(fixture.source('hosts/claude/agent-factory-realize.binding.json'), change(fixture.binding));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*(binding|declaration|duplicate|support)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects a required delivery edge that is not in the installed plan', async () => {
    await fs.writeJson(fixture.source('hosts/claude/agent-factory-realize.binding.json'), {
      ...fixture.binding, requiredInstalled: ['.claude/skills/author-skill/references/missing.md'],
    });
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*(planned|delivery|edge)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects a native workflow that would shadow the required runbook', async () => {
    await fs.outputFile(fixture.source('hosts/claude/workflows/realize-artifact.js'), 'export const meta = {};\n');
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*(shadow|runbook|workflow)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects the unreviewed plugin distribution before project installation writes', async () => {
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, pluginLane: true, implicitStore: true }))
      .rejects.toThrow(/factory.*plugin/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('never exposes maintainer evals from the new runbook through an implicit-store link', async () => {
    const state = fixture.installed('.agents');
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, targetDir: state, implicitStore: true, method: 'symlink' });
    expect(await fs.pathExists(path.join(state, 'skills/realize-artifact/evals'))).toBe(false);
    expect(await fs.pathExists(fixture.installed('.claude/skills/realize-artifact/evals'))).toBe(false);
  });

  it('refuses an unmanaged role collision before creating installer state', async () => {
    const file = fixture.installed('.claude/agents/factory-realizer.md');
    await fs.outputFile(file, 'User-owned role.\n');
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/unmanaged|not managed|collision/i);
    expect(await fs.readFile(file, 'utf8')).toBe('User-owned role.\n');
    expect(await fs.pathExists(path.join(fixture.state, 'agents-united.json'))).toBe(false);
    expect(await fs.pathExists(fixture.state)).toBe(false);
  });

  it('rejects an omitted support declaration instead of accepting a broken runbook link', async () => {
    await fs.writeJson(fixture.source('hosts/claude/agent-factory-realize.binding.json'), { ...fixture.binding, requiredSupport: [] });
    await fs.remove(fixture.source('skills/realize-artifact/references/job.md'));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*support/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects a stub in place of the reviewed guard script', async () => {
    await fs.writeFile(fixture.source('hosts/claude/hooks/agents-united-guard.js'), 'process.exit(0);\n');
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*guard/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('refuses an ordinary bundle that tries to expose the contributor worker', async () => {
    const manifest = await fs.readJson(fixture.source('bundles.json')) as { bundles: Record<string, unknown> };
    manifest.bundles['ordinary-tools'] = { name: 'ordinary-tools', description: 'Ordinary bundle', skills: ['realize-artifact'] };
    await fs.writeJson(fixture.source('bundles.json'), manifest);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('ordinary-tools', fixture.options)).rejects.toThrow(/factory|owning.*bundle/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('rejects a guard that its basic contract does not permit', async () => {
    const file = fixture.source('core/subagent-realize-for-host.contract.json');
    const contract = await fs.readJson(file) as Record<string, unknown>;
    contract.hooks = [];
    await fs.writeJson(file, contract);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*(guard|hook|permitted)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('refuses a linked destination without writing through it', async () => {
    const outside = path.join(fixture.root, 'outside');
    await fs.outputFile(path.join(outside, 'note.md'), 'Keep this evidence.\n');
    await fs.ensureDir(fixture.installed('.claude'));
    await fs.ensureSymlink(outside, fixture.installed('.claude/agents'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/factory.*linked/i);
    expect(await fs.readdir(outside)).toEqual(['note.md']);
    expect(await fs.readFile(path.join(outside, 'note.md'), 'utf8')).toBe('Keep this evidence.\n');
    expect(await fs.pathExists(fixture.state)).toBe(false);
  });

  it('refuses unsupported factory distribution through the public plugin planner', async () => {
    const resolved = await new RegistryResolver(fixture.registry).resolve('agent-factory');
    await expect(ClaudeProjector.planPluginLane(fixture.bundle, resolved, fixture.registry, true))
      .rejects.toThrow(/factory.*plugin.*unavailable/i);
  });
});
