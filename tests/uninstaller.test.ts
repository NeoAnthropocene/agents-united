import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

describe('UninstallEngine', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-uninstall-workspace');
  const targetAgentsDir = path.join(testWorkspace, '.agents');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);

    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: targetAgentsDir,
      method: 'copy',
    });
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('should uninstall an installed bundle', async () => {
    const uninstaller = new UninstallEngine();
    const result = await uninstaller.uninstall('software-engineering', {
      targetDir: targetAgentsDir,
    });

    expect(result.removed.length).toBeGreaterThan(0);
    const lockfile = await fs.readJson(path.join(targetAgentsDir, 'agents-united.json'));
    expect(lockfile.installed.bundles).not.toContain('software-engineering');
  });

  it('should handle dry-run uninstall', async () => {
    const uninstaller = new UninstallEngine();
    const result = await uninstaller.uninstall('software-engineering', {
      targetDir: targetAgentsDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    const lockfile = await fs.readJson(path.join(targetAgentsDir, 'agents-united.json'));
    expect(lockfile.installed.bundles).toContain('software-engineering');
  });
});
