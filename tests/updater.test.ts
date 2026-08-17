import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { UpdateEngine } from '../src/core/updater.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { LockfileManifest } from '../src/core/types.js';

describe('UpdateEngine (TDD)', () => {
  let testDir: string;
  let registry: RegistryResolver;
  let installer: InstallEngine;
  let updater: UpdateEngine;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `agents-united-upd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(testDir);
    registry = new RegistryResolver();
    installer = new InstallEngine(registry);
    updater = new UpdateEngine(registry);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('Tier 1: should check updates and report up-to-date when version matches upstream', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    const report = await updater.checkUpdates({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(report.totalCount).toBe(1);
    expect(report.outdatedCount).toBe(0);
    expect(report.upToDateCount).toBe(1);
    expect(report.items[0].hasUpdate).toBe(false);
  });

  it('Tier 2: should identify outdated bundle and execute batch update', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    // Artificially downgrade version in lockfile
    const lockfilePath = path.join(testDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = lockfile.bundleVersions || {};
    lockfile.bundleVersions['software-engineering'] = '0.9.0';
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const checkReport = await updater.checkUpdates({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(checkReport.outdatedCount).toBe(1);
    expect(checkReport.items[0].hasUpdate).toBe(true);
    expect(checkReport.items[0].installedVersion).toBe('0.9.0');
    expect(checkReport.items[0].upstreamVersion).toBe('1.0.0');

    // Run update
    const result = await updater.update('__all__', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].name).toBe('software-engineering');

    // Verify lockfile was updated
    const updatedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
    expect(updatedLockfile.bundleVersions?.['software-engineering']).toBe('1.0.0');
  });

  it('Tier 2: should perform selective update for specific bundle', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    await installer.install('system-architecture', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    // Downgrade both
    const lockfilePath = path.join(testDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = {
      'software-engineering': '0.9.0',
      'system-architecture': '0.9.0',
    };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    // Selectively update only software-engineering
    const result = await updater.update(['software-engineering'], {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].name).toBe('software-engineering');

    const updatedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
    expect(updatedLockfile.bundleVersions?.['software-engineering']).toBe('1.0.0');
    expect(updatedLockfile.bundleVersions?.['system-architecture']).toBe('0.9.0');
  });

  it('Tier 3: should guard against clobbering user-modified files in copy mode without --force', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    // Artificially modify a file
    const agentPath = path.join(testDir, 'agents', 'subagent-code-reviewer.md');
    await fs.writeFile(agentPath, '# Modified Content by User');

    // Downgrade version
    const lockfilePath = path.join(testDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    // Update without force
    const result = await updater.update('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
      force: false,
    });

    // Check that modified file was preserved
    const preservedContent = await fs.readFile(agentPath, 'utf8');
    expect(preservedContent).toBe('# Modified Content by User');
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0].reason).toContain('User modifications detected');

    // Update with force
    const forceResult = await updater.update('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
      force: true,
    });

    expect(forceResult.updated.length).toBeGreaterThan(0);
    const overwrittenContent = await fs.readFile(agentPath, 'utf8');
    expect(overwrittenContent).not.toBe('# Modified Content by User');
  });

  it('Tier 3: should support dry-run mode without modifying filesystem', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    const lockfilePath = path.join(testDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = { 'software-engineering': '0.9.0' };
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const result = await updater.update('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    const unchangedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
    expect(unchangedLockfile.bundleVersions?.['software-engineering']).toBe('0.9.0');
  });
});
