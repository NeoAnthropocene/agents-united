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

  it('removes projectedTo files on bundle uninstall', async () => {
    const ws = path.resolve(process.cwd(), 'scratch/test-uninstall-proj');
    const agentsDir = path.join(ws, '.agents');
    try {
      const installer = new InstallEngine();
      await installer.install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['claude', 'cline'],
      });

      const claudeProj = path.join(ws, '.claude', 'agents', 'orchestrator-engineering.md');
      const clineProj = path.join(ws, '.cline', 'agents', 'orchestrator-engineering.md');
      expect(await fs.pathExists(claudeProj)).toBe(true);
      expect(await fs.pathExists(clineProj)).toBe(true);

      const uninstaller = new UninstallEngine();
      await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });

      expect(await fs.pathExists(claudeProj)).toBe(false);
      expect(await fs.pathExists(clineProj)).toBe(false);
      expect(await fs.pathExists(path.join(ws, '.claude'))).toBe(false);
      expect(await fs.pathExists(path.join(ws, '.cline'))).toBe(false);
    } finally {
      await fs.remove(ws);
    }
  });
});
