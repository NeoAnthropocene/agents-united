import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { DoctorEngine } from '../src/core/doctor.js';
import type { LockfileManifest } from '../src/core/types.js';
import { RegistryResolver } from '../src/core/registry.js';
import { COORDINATOR_ROOT, COORDINATOR_SUPPORT, coordinatorTree, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

describe('factory coordinator native production lifecycle', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  beforeEach(async () => { fixture = await prepareFactoryCoordinator(); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('copies the coordinator task without evals for an implicit-store symlink request', async () => {
    const store = fixture.installed('.agents');
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, targetDir: store, method: 'symlink', implicitStore: true });
    expect((await fs.lstat(path.join(store, 'skills/coordinate-artifact'))).isSymbolicLink()).toBe(false);
    expect(await fs.pathExists(path.join(store, 'skills/coordinate-artifact/evals'))).toBe(false);
    expect(await fs.pathExists(fixture.installed(`${COORDINATOR_ROOT}/evals`))).toBe(false);
  });

  it('registers the coordinator task only in the contributor factory without a legacy main carrier', async () => {
    const resolver = new RegistryResolver();
    const catalog = await resolver.loadBundles();
    expect(Object.values(catalog.bundles).filter(bundle => bundle.skills?.includes('coordinate-artifact')).map(bundle => bundle.name)).toEqual(['agent-factory']);
    const factory = catalog.bundles['agent-factory']!;
    expect(factory.agents).toEqual([]);
    expect(factory.orchestrator).toBeUndefined();
    expect((await resolver.resolve('full')).skills).not.toContain('coordinate-artifact');
    expect(await fs.pathExists(path.resolve('registry/agents/orchestrator-agent-factory.md'))).toBe(false);
  });
  it('installs production bytes idempotently with native-only ownership, healthy doctor and sticky update', async () => {
    await new InstallEngine().install('agent-factory', fixture.options);
    const before = await coordinatorTree(fixture.workspace);
    await new InstallEngine().install('agent-factory', fixture.options);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    const report = await DoctorEngine.runDoctor(fixture.state);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => /coordinate-artifact|orchestrator-agent-factory|projection|drift/i.test(w))).toEqual([]);
    const file = fixture.installed(`${COORDINATOR_ROOT}/references/repair.md`), bytes = await fs.readFile(file);
    await fs.remove(file);
    await new UpdateEngine().update('agent-factory', { targetDir: fixture.state });
    expect(await fs.readFile(file)).toEqual(bytes);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.nativeLane).toBe(true);
    expect(lock.projections?.['.claude/agents/orchestrator-agent-factory.md']?.owners).toEqual(['agent-factory']);
    expect(lock.projections?.['.claude/agents/orchestrator-agent-factory.md']?.canonical).toBeUndefined();
  });

  it('owns, restores, protects and removes every one of the eleven declared support files, the four skill-route files included', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    expect(COORDINATOR_SUPPORT).toHaveLength(11);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    for (const rel of COORDINATOR_SUPPORT) expect(lock.projections?.[`${COORDINATOR_ROOT}/${rel}`]?.owners, rel).toContain('agent-factory');
    const script = fixture.installed(`${COORDINATOR_ROOT}/scripts/check-skill-return.mjs`), original = await fs.readFile(script);
    await fs.appendFile(script, '\n// caller edit\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modified/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.readFile(script)).toEqual(original);
    await new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state });
    for (const rel of COORDINATOR_SUPPORT) expect(await fs.pathExists(fixture.installed(`${COORDINATOR_ROOT}/${rel}`)), rel).toBe(false);
  });

  it('preserves edited support and all state until explicit forced update', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const file = fixture.installed(`${COORDINATOR_ROOT}/references/repair.md`), original = await fs.readFile(file);
    await fs.appendFile(file, '\nKeep caller note.\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modified/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.readFile(file)).toEqual(original);
  });

  it('uses its own receipt for atomic edited removal with source declaration and worker receipts absent', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-coordinate.binding.json'));
    const lockFile = path.join(fixture.state, 'agents-united.json'), lock = await fs.readJson(lockFile) as LockfileManifest;
    for (const skill of ['realize-artifact', 'evaluate-artifact', 'author-contract', 'author-bundle']) {
      const rel = `.claude/skills/${skill}/assets/claude-binding.json`;
      if (lock.projections) delete lock.projections[rel];
      await fs.remove(fixture.installed(rel));
    }
    await fs.writeJson(lockFile, lock);
    await fs.appendFile(fixture.installed(`${COORDINATOR_ROOT}/references/handback.md`), '\nPreserve caller evidence.\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modified/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
    await new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.pathExists(fixture.installed('.claude/agents/orchestrator-agent-factory.md'))).toBe(false);
  });

  it('rejects a missing source declaration during update before migrations and unmanaged late collisions before writes', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-coordinate.binding.json'));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/missing.*coordinator/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('preserves the complete workspace on a late unmanaged coordinator support collision', async () => {
    await fs.outputFile(fixture.installed(`${COORDINATOR_ROOT}/assets/report.json`), 'User report.\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/unmanaged.*collision/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('preserves co-owned engineering guards and router companions when removing the factory', async () => {
    await new InstallEngine().install('software-engineering', fixture.options);
    await new InstallEngine().install('agent-factory', fixture.options);
    await fs.outputFile(fixture.installed('draft/keep.md'), 'Unrelated draft.\n');
    await new UninstallEngine().uninstall('agent-factory', { targetDir: fixture.state });
    expect(await fs.pathExists(fixture.installed('.claude/agents/orchestrator-agent-factory.md'))).toBe(false);
    expect(await fs.pathExists(fixture.installed('.claude/hooks/agents-united-guard.js'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/skills/host-agent-router/SKILL.md'))).toBe(true);
    expect(await fs.readFile(fixture.installed('draft/keep.md'), 'utf8')).toBe('Unrelated draft.\n');
  });

});
