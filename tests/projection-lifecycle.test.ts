import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';
import { DoctorEngine } from '../src/core/doctor.js';
import type { LockfileManifest } from '../src/core/types.js';

/**
 * Plan 007 Milestone 5 — Projection-aware lifecycle.
 * Integration: install -> fan-out -> uninstall leaves zero stray projections;
 * update never clobbers a stale (marker-removed) projection without --force;
 * doctor reports missing / user-modified projections.
 */
describe('Projection lifecycle (plan 007 M5)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-projection-lifecycle');
  const agentsDir = path.join(testWorkspace, '.agents');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('uninstall after fan-out removes every projection and empty projection dirs', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
    });

    const claudeProj = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    const clineProj = path.join(testWorkspace, '.cline', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(claudeProj)).toBe(true);
    expect(await fs.pathExists(clineProj)).toBe(true);

    const uninstaller = new UninstallEngine();
    const result = await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });
    expect(result.removed.length).toBeGreaterThan(0);

    expect(await fs.pathExists(claudeProj)).toBe(false);
    expect(await fs.pathExists(clineProj)).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);

    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    for (const asset of Object.values(lockfile.files)) {
      expect(asset.projectedTo).toBeUndefined();
    }
  });

  it('uninstall removes the codex AGENTS.md bridge projection', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['codex'],
    });

    const bridgePath = path.join(testWorkspace, 'AGENTS.md');
    expect(await fs.pathExists(bridgePath)).toBe(true);
    expect(await fs.readFile(bridgePath, 'utf8')).toContain('managed-by: agents-united');

    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });

    expect(await fs.pathExists(bridgePath)).toBe(false);
  });

  it('uninstall refuses to remove a user-modified projection without --force', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const claudeProj = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(claudeProj, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(claudeProj, content, 'utf8');

    const uninstaller = new UninstallEngine();
    await expect(
      uninstaller.uninstall('software-engineering', { targetDir: agentsDir })
    ).rejects.toThrow(/--force/);

    expect(await fs.readFile(claudeProj, 'utf8')).toContain('managed-by: USER');
  });

  it('uninstall with --force removes a user-modified projection', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const claudeProj = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(claudeProj, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(claudeProj, content, 'utf8');

    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('software-engineering', { targetDir: agentsDir, force: true });

    expect(await fs.pathExists(claudeProj)).toBe(false);
  });

  it('update never clobbers a stale (marker-removed) projection without --force', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
      fanout: ['claude'],
    });

    const claudeProj = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(claudeProj, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(claudeProj, content, 'utf8');

    const lockfilePath = path.join(agentsDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const updater = new UpdateEngine();
    const result = await updater.update('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testWorkspace,
      force: false,
    });

    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0].reason).toContain('projection');
    expect(await fs.readFile(claudeProj, 'utf8')).toContain('managed-by: USER');
  });

  it('doctor reports a missing projection as a warning', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    await fs.remove(projAbs);

    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.warnings.some(w => w.includes('Missing projection'))).toBe(true);
  });

  it('doctor reports a user-modified projection as a warning', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(projAbs, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(projAbs, content, 'utf8');

    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.warnings.some(w => w.includes('user-modified projection'))).toBe(true);
  });

  it('update regenerates projections and preserves projectedTo tracking', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
      fanout: ['cline'],
    });

    const clineProj = path.join(testWorkspace, '.cline', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(clineProj)).toBe(true);

    // Make the bundle look outdated so update actually re-installs
    const lockfilePath = path.join(agentsDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    // Corrupt the projection with content drift (marker intact) — update must regenerate it
    await fs.appendFile(clineProj, '\n<!-- SENTINEL-STALE -->');

    const updater = new UpdateEngine();
    await updater.update('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testWorkspace,
    });

    // Projection regenerated from canonical (sentinel gone)
    expect(await fs.readFile(clineProj, 'utf8')).not.toContain('SENTINEL-STALE');

    // projectedTo tracking preserved after update
    const lf2: LockfileManifest = await fs.readJson(lockfilePath);
    const asset = lf2.files[['agents', 'orchestrator-engineering.md'].join('/')];
    expect(asset.projectedTo).toContain('.cline/agents/orchestrator-engineering.md');

    // And uninstall after update removes the projection (no orphans)
    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);
  });

  it('update with fanout projects a bundle that was installed without fanout', async () => {
    // The user's exact scenario: original install targeted .agents only
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);

    const lockfilePath = path.join(agentsDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const updater = new UpdateEngine();
    await updater.update('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testWorkspace,
      fanout: ['cline'],
    });

    const clineProj = path.join(testWorkspace, '.cline', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(clineProj)).toBe(true);
    expect(await fs.readFile(clineProj, 'utf8')).toContain('managed-by: agents-united');

    const lf2: LockfileManifest = await fs.readJson(lockfilePath);
    expect(lf2.files[['agents', 'orchestrator-engineering.md'].join('/')].projectedTo).toContain(
      '.cline/agents/orchestrator-engineering.md'
    );
    // Fanout choice persisted so future updates keep projections in sync
    expect(lf2.fanout).toContain('cline');
  });

  it('update --fanout after a symlink-mode install succeeds without -f (collision auto-resolved)', async () => {
    // User's wizard chose "Symlink Mode" — canonical files are links, not copies
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'symlink',
    });
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);

    const lockfilePath = path.join(agentsDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const updater = new UpdateEngine();
    const result = await updater.update('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testWorkspace,
      fanout: ['cline'],
      // NOTE: no force — update must auto-resolve projection collisions on its own
    });

    expect(result.skipped).toEqual([]);
    expect(result.updated.length).toBe(1);
    const clineProj = path.join(testWorkspace, '.cline', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(clineProj)).toBe(true);
    expect(await fs.readFile(clineProj, 'utf8')).toContain('managed-by: agents-united');

    // A second identical update is also collision-free (projections are ours)
    const result2 = await updater.update('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testWorkspace,
      fanout: ['cline'],
    });
    expect(result2.skipped).toEqual([]);
  });

  it('manages shared artifact refcounting when multiple bundles project to cline', async () => {
    const installer = new InstallEngine();
    // Install first bundle
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
      fanout: ['cline'],
    });

    const manifestPath = path.join(testWorkspace, '.cline', 'agents-united', 'teams', 'software-engineering.yaml');
    const rulePath = path.join(testWorkspace, '.cline', 'rules', 'agents-united-software-engineering.md');
    expect(await fs.pathExists(manifestPath)).toBe(true);
    expect(await fs.pathExists(rulePath)).toBe(true);

    const lockfilePath = path.join(agentsDir, 'agents-united.json');
    const lf: LockfileManifest = await fs.readJson(lockfilePath);
    expect(lf.projections).toBeDefined();
    expect(lf.projections?.['.cline/agents-united/teams/software-engineering.yaml'].owners).toEqual(['software-engineering']);

    // Uninstall software-engineering removes its manifest and rule
    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });

    expect(await fs.pathExists(manifestPath)).toBe(false);
    expect(await fs.pathExists(rulePath)).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);
  });
});