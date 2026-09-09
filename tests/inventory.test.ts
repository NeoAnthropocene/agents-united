import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { InventoryScanner } from '../src/core/inventory.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { LockfileManifest } from '../src/core/types.js';

describe('InventoryScanner (TDD)', () => {
  let testDir: string;
  let registry: RegistryResolver;
  let installer: InstallEngine;
  let scanner: InventoryScanner;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `agents-united-inv-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(testDir);
    registry = new RegistryResolver();
    installer = new InstallEngine(registry);
    scanner = new InventoryScanner(registry);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('Tier 1: should return empty inventory when no packages are installed', async () => {
    const inv = await scanner.scan({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(inv.records).toHaveLength(0);
    expect(inv.bundles).toHaveLength(0);
    expect(inv.standaloneItems).toHaveLength(0);
  });

  it('Tier 1: should discover installed bundle in project scope with location and version', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    const inv = await scanner.scan({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(inv.bundles).toHaveLength(1);
    const bundle = inv.bundles[0];
    expect(bundle.name).toBe('software-engineering');
    expect(bundle.scope).toBe('project');
    expect(bundle.host).toBe('agents');
    expect(bundle.installedVersion).toBe('1.0.0');
    expect(bundle.upstreamVersion).toBe('1.0.0');
    expect(bundle.driftStatus).toBe('up-to-date');
    expect(bundle.fileCount).toBeGreaterThan(0);
  });

  it('Tier 2: should detect outdated drift status when bundle version lags upstream', async () => {
    await installer.install('software-engineering', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    // Artificially downgrade installed version in lockfile
    const lockfilePath = path.join(testDir, 'agents-united.json');
    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    lockfile.bundleVersions = lockfile.bundleVersions || {};
    lockfile.bundleVersions['software-engineering'] = '0.9.0';
    await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

    const inv = await scanner.scan({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(inv.bundles).toHaveLength(1);
    const bundle = inv.bundles[0];
    expect(bundle.installedVersion).toBe('0.9.0');
    expect(bundle.upstreamVersion).toBe('1.0.0');
    expect(bundle.driftStatus).toBe('outdated');
  });

  it('Tier 2: should detect standalone skills installed without a bundle', async () => {
    await installer.install('git-guardrails', {
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
    });

    const inv = await scanner.scan({
      targetDir: testDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(inv.bundles).toHaveLength(0);
    expect(inv.standaloneItems.length).toBeGreaterThan(0);
    const skillRecord = inv.standaloneItems.find(s => s.name === 'git-guardrails');
    expect(skillRecord).toBeDefined();
    expect(skillRecord?.type).toBe('skill');
  });

  it('Tier 3: should format display location cleanly for badges', async () => {
    const loc = InventoryScanner.formatDisplayLocation('project', 'agents', './.agents');
    expect(loc).toBe('[project: ./.agents]');

    const locWithFanout = InventoryScanner.formatDisplayLocation('project', 'agents', './.agents', ['cline']);
    expect(locWithFanout).toBe('[project: ./.agents + cline]');

    const globalLoc = InventoryScanner.formatDisplayLocation('global', 'gemini', '~/.gemini/config');
    expect(globalLoc).toBe('[global: ~/.gemini/config]');
  });

  it('Tier 3: should record fanout and scannedLocations in PackageInventory', async () => {
    const agentsDir = path.join(testDir, '.agents');
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      method: 'copy',
      fanout: ['cline'],
    });

    const inv = await scanner.scan({
      targetDir: agentsDir,
      scope: 'project',
      hosts: ['agents'],
      cwd: testDir,
    });

    expect(inv.bundles).toHaveLength(1);
    expect(inv.bundles[0].fanout).toEqual(['cline']);
    expect(inv.bundles[0].displayLocation).toContain('+ cline');
    expect(inv.scannedScopes).toContain('project');
    expect(inv.scannedLocations).toBeDefined();
    expect(inv.scannedLocations?.length).toBeGreaterThan(0);
    const loc = inv.scannedLocations?.find(l => l.scope === 'project');
    expect(loc?.packageCount).toBe(1);
    expect(loc?.fanout).toContain('cline');
  });
});

