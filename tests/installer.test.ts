import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { TargetAdapter } from '../src/core/adapter.js';

describe('InstallEngine', () => {
  const tempDir = path.resolve(process.cwd(), 'scratch/test-workspace');
  let resolver: RegistryResolver;
  let installer: InstallEngine;

  beforeEach(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    installer = new InstallEngine(resolver);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should install software-engineering bundle into target directory', async () => {
    const result = await installer.install('software-engineering', { targetDir: tempDir });
    expect(result.dryRun).toBe(false);

    const subPaths = TargetAdapter.getSubPaths(tempDir);
    expect(await fs.pathExists(path.join(subPaths.agentsDir, 'orchestrator-engineering.md'))).toBe(true);
    expect(await fs.pathExists(path.join(subPaths.skillsDir, 'test-driven-development', 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(subPaths.lockfile)).toBe(true);

    const lockfile = await fs.readJson(subPaths.lockfile);
    expect(lockfile.installed.bundles).toContain('software-engineering');
  });

  it('should support dry-run installation without creating files', async () => {
    const result = await installer.install('software-engineering', { targetDir: tempDir, dryRun: true });
    expect(result.dryRun).toBe(true);

    const subPaths = TargetAdapter.getSubPaths(tempDir);
    expect(await fs.pathExists(path.join(subPaths.agentsDir, 'orchestrator-engineering.md'))).toBe(false);
  });

  it('should throw error when modifying tracked file without force', async () => {
    await installer.install('software-engineering', { targetDir: tempDir });
    const subPaths = TargetAdapter.getSubPaths(tempDir);
    const agentPath = path.join(subPaths.agentsDir, 'orchestrator-engineering.md');

    // Modify file
    await fs.appendFile(agentPath, '\n# Custom Edit');

    await expect(installer.install('software-engineering', { targetDir: tempDir })).rejects.toThrow(/user modifications/);

    // Force should succeed
    await expect(installer.install('software-engineering', { targetDir: tempDir, force: true })).resolves.toBeDefined();
  });
});
