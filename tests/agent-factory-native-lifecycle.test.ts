import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { prepareFactoryNative } from './helpers/factory-native.js';
import type { LockfileManifest } from '../src/core/types.js';

async function hashes(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) for (const [rel, hash] of Object.entries(await hashes(full))) out[`${entry.name}/${rel}`] = hash;
    else out[entry.name] = crypto.createHash('sha256').update(await fs.readFile(full)).digest('hex');
  }
  return out;
}

describe('native-only factory lifecycle', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryNative>>;
  let resolver: RegistryResolver;
  beforeEach(async () => {
    fixture = await prepareFactoryNative(await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-lifecycle-')));
    resolver = new RegistryResolver(fixture.registry);
  });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('is idempotent and records hashes for every required runtime output', async () => {
    const installer = new InstallEngine(resolver);
    await installer.install('agent-factory', fixture.options);
    const before = await hashes(fixture.workspace);
    await installer.install('agent-factory', fixture.options);
    expect(await hashes(fixture.workspace)).toEqual(before);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    for (const rel of ['.claude/agents/factory-realizer.md', '.claude/hooks/agents-united-guard.js', '.claude/skills/realize-artifact/assets/claude-binding.json']) {
      expect(lock.projections?.[rel]?.hash).toBe(`sha256:${before[rel]}`);
      expect(lock.projections?.[rel]?.owners).toContain('agent-factory');
    }
  });

  it('doctor counts the native-only worker and detects a missing worker and guard', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    expect((await DoctorEngine.runDoctor(fixture.state, 'claude')).agentsCount).toBe(1);
    await fs.remove(fixture.installed('.claude/agents/factory-realizer.md'));
    await fs.remove(fixture.installed('.claude/hooks/agents-united-guard.js'));
    const report = await DoctorEngine.runDoctor(fixture.state, 'claude');
    expect([...report.issues, ...report.warnings].join('\n')).toMatch(/Missing (?:claude )?projection.*factory-realizer/);
    expect([...report.issues, ...report.warnings].join('\n')).toMatch(/Missing (?:claude )?projection.*agents-united-guard/);
  });

  it('update restores missing native-only files through the recorded lane', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const original = await fs.readFile(fixture.installed('.claude/agents/factory-realizer.md'));
    await fs.remove(fixture.installed('.claude/agents/factory-realizer.md'));
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state });
    expect(await fs.readFile(fixture.installed('.claude/agents/factory-realizer.md'))).toEqual(original);
  });

  it('update with a missing required source leaves all installed files and state intact', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const before = await hashes(fixture.workspace);
    await fs.remove(fixture.source('core/subagent-realize-for-host.contract.json'));
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/factory.*missing/i);
    expect(await hashes(fixture.workspace)).toEqual(before);
  });

  it('preserves an edited worker on update until explicit forced replacement', async () => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const worker = fixture.installed('.claude/agents/factory-realizer.md');
    const original = await fs.readFile(worker);
    await fs.appendFile(worker, '\nLocal author note.\n');
    const before = await hashes(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/factory.*modified/i);
    expect(await hashes(fixture.workspace)).toEqual(before);
    const result = await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state, force: true });
    expect(result.updated.map(record => record.name)).toContain('agent-factory');
    expect(await fs.readFile(worker)).toEqual(original);
  });

  it.each(['.claude/agents/factory-realizer.md', '.claude/skills/realize-artifact/references/job.md'])
  ('refuses removal of edited %s before deleting any other file, even without the source binding', async rel => {
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.appendFile(fixture.installed(rel), '\nLocal author note.\n');
    await fs.remove(fixture.source('hosts/claude/agent-factory-realize.binding.json'));
    const before = await hashes(fixture.workspace);
    await expect(new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modifi/i);
    expect(await hashes(fixture.workspace)).toEqual(before);
  });

  it('retains edited copies and shared guard ownership when the factory is removed', async () => {
    const manifest = await fs.readJson(fixture.source('bundles.json')) as { bundles: Record<string, unknown> };
    manifest.bundles['ordinary-tools'] = { name: 'ordinary-tools', description: 'Existing native writer', agents: ['subagent-existing-worker.md'] };
    await fs.writeJson(fixture.source('bundles.json'), manifest);
    await fs.outputFile(fixture.source('agents/subagent-existing-worker.md'), '---\nname: existing-worker\ndescription: Existing writer fixture.\nmodel: inherit\n---\nRead and write the requested files.\n');
    const native = await fs.readFile(fixture.source('hosts/claude/agents/factory-realizer.md'), 'utf8');
    await fs.outputFile(fixture.source('hosts/claude/agents/existing-worker.md'), native.replace('name: factory-realizer', 'name: existing-worker'));
    const installer = new InstallEngine(new RegistryResolver(fixture.registry));
    await installer.install('ordinary-tools', fixture.options);
    await installer.install('agent-factory', fixture.options);
    const worker = fixture.installed('.claude/agents/factory-realizer.md');
    await fs.appendFile(worker, '\nUnrelated local note.\n');
    const edited = await fs.readFile(worker);
    await expect(installer.install('agent-factory', fixture.options)).rejects.toThrow(/factory.*modified/i);
    expect(await fs.readFile(worker)).toEqual(edited);
    const beforeRemove = await hashes(fixture.workspace);
    const uninstaller = new UninstallEngine(new RegistryResolver(fixture.registry));
    await expect(uninstaller.uninstall('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/factory.*modified/i);
    expect(await hashes(fixture.workspace)).toEqual(beforeRemove);
    await uninstaller.uninstall('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.pathExists(fixture.installed('.claude/agents/existing-worker.md'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/hooks/agents-united-guard.js'))).toBe(true);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.['.claude/hooks/agents-united-guard.js']?.owners).toEqual(['ordinary-tools']);
  });
});
