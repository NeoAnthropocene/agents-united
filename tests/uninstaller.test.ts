import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { RegistryResolver } from '../src/core/registry.js';
import { TargetAdapter } from '../src/core/adapter.js';

describe('UninstallEngine', () => {
  const tempDir = path.resolve(process.cwd(), 'scratch/test-workspace-uninstall');
  let resolver: RegistryResolver;
  let installer: InstallEngine;
  let uninstaller: UninstallEngine;

  beforeEach(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    installer = new InstallEngine(resolver);
    uninstaller = new UninstallEngine(resolver);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should uninstall software-engineering bundle cleanly', async () => {
    await installer.install('software-engineering', { targetDir: tempDir });
    const subPaths = TargetAdapter.getSubPaths(tempDir);
    expect(await fs.pathExists(path.join(subPaths.agentsDir, 'orchestrator-engineering.md'))).toBe(true);

    const result = await uninstaller.uninstall('software-engineering', { targetDir: tempDir });
    expect(result.removed.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(subPaths.agentsDir, 'orchestrator-engineering.md'))).toBe(false);

    const lockfile = await fs.readJson(subPaths.lockfile);
    expect(lockfile.installed.bundles).not.toContain('software-engineering');
  });

  it('should throw error when trying to uninstall uninstalled bundle', async () => {
    await installer.install('software-engineering', { targetDir: tempDir });
    await expect(uninstaller.uninstall('growth-marketing', { targetDir: tempDir })).rejects.toThrow(/not currently installed/);
  });
});
