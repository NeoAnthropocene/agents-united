import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';

describe('InstallEngine', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-install-workspace');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('should install a bundle in copy mode', async () => {
    const installer = new InstallEngine();
    const result = await installer.install('software-engineering', {
      targetDir: path.join(testWorkspace, '.agents'),
      method: 'copy',
    });

    expect(result.installed.targetBundle).toBe('software-engineering');
    expect(result.installed.agents.length).toBeGreaterThan(0);
    expect(result.installed.skills.length).toBeGreaterThan(0);

    const lockfilePath = path.join(testWorkspace, '.agents', 'agents-united.json');
    expect(await fs.pathExists(lockfilePath)).toBe(true);

    const lockfile = await fs.readJson(lockfilePath);
    expect(lockfile.installed.bundles).toContain('software-engineering');
    expect(lockfile.method).toBe('copy');
  });

  it('should install a bundle in symlink mode', async () => {
    const installer = new InstallEngine();
    const targetAgentsDir = path.join(testWorkspace, '.agents');
    const result = await installer.install('software-engineering', {
      targetDir: targetAgentsDir,
      method: 'symlink',
    });

    expect(result.installed.targetBundle).toBe('software-engineering');
    const orchestratorPath = path.join(targetAgentsDir, 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(orchestratorPath)).toBe(true);
  });

  it('should support multi-host target deployment', async () => {
    const installer = new InstallEngine();
    const result = await installer.install('software-engineering', {
      targetDir: path.join(testWorkspace, 'custom'),
      hosts: ['agents', 'gemini', 'claude'],
    });

    expect(result.targetDirs.length).toBe(3);
  });

  it('should perform dry-run without creating files', async () => {
    const installer = new InstallEngine();
    const targetAgentsDir = path.join(testWorkspace, '.agents');
    const result = await installer.install('software-engineering', {
      targetDir: targetAgentsDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(await fs.pathExists(targetAgentsDir)).toBe(false);
  });

  it('should not record projectedTo when fanout is omitted (backward-compat guard)', async () => {
    const installer = new InstallEngine();
    const targetAgentsDir = path.join(testWorkspace, '.agents');
    await installer.install('software-engineering', {
      targetDir: targetAgentsDir,
      method: 'copy',
    });

    const lockfile = await fs.readJson(path.join(targetAgentsDir, 'agents-united.json'));
    for (const asset of Object.values(lockfile.files)) {
      expect(asset.projectedTo).toBeUndefined();
    }
  });
});
