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
    for (const asset of Object.values(lockfile.files as Record<string, { projectedTo?: string[] }>)) {
      expect(asset.projectedTo).toBeUndefined();
    }
  });

  // ── Plan 015 §4/3: resolved rules propagate to .agents/rules/ + refcounting ──
  describe('rule propagation (Plan 015 Step 1)', () => {
    const EXPECTED_RULES = [
      'GEMINI.md',
      'clean-code-and-architecture.md',
      'domain-modeling-and-adr.md',
      'git-guardrails.md',
      'multi-agent-coordination.md',
      'quality-aesthetics-accessibility.md',
      'test-driven-development.md',
    ];

    it('deploys every agent-referenced rule to .agents/rules/ and records an owner', async () => {
      const installer = new InstallEngine();
      const targetAgentsDir = path.join(testWorkspace, '.agents');
      await installer.install('software-engineering', { targetDir: targetAgentsDir, method: 'copy' });

      const rulesDir = path.join(targetAgentsDir, 'rules');
      for (const rule of EXPECTED_RULES) {
        expect(await fs.pathExists(path.join(rulesDir, rule)), `${rule} should be deployed`).toBe(true);
      }

      const lockfile = await fs.readJson(path.join(targetAgentsDir, 'agents-united.json'));
      const record = lockfile.files['rules/git-guardrails.md'];
      expect(record).toBeDefined();
      expect(record.bundle).toBe('software-engineering');
      expect(record.owners).toEqual(['software-engineering']);
      expect(typeof record.hash).toBe('string');
      expect(record.hash.startsWith('sha256:')).toBe(true);
    });

    it('grants a second bundle co-ownership of a shared rule without duplicating it', async () => {
      const installer = new InstallEngine();
      const targetAgentsDir = path.join(testWorkspace, '.agents');

      // frontend-engineering inherits software-engineering, so both resolve the
      // same rule modules through the parent's orchestrator and subagents.
      await installer.install('software-engineering', { targetDir: targetAgentsDir, method: 'copy' });
      await installer.install('frontend-engineering', { targetDir: targetAgentsDir, method: 'copy' });

      const lockfile = await fs.readJson(path.join(targetAgentsDir, 'agents-united.json'));
      const record = lockfile.files['rules/git-guardrails.md'];
      expect(record.owners).toContain('software-engineering');
      expect(record.owners).toContain('frontend-engineering');
      // No duplicate owners, and the original bundle stays as the record owner of origin.
      expect(new Set(record.owners).size).toBe(record.owners.length);
      expect(record.bundle).toBe('software-engineering');
    });
  });

  // ── Plan 015c / §5.7: projectedTo must reconcile, not only append ──────────
  describe('projectedTo reconciliation (Plan 015c)', () => {
    it('drops a stale renamed projection on re-projection while keeping current entries', async () => {
      const installer = new InstallEngine();
      const targetAgentsDir = path.join(testWorkspace, '.agents');
      const lockfilePath = path.join(targetAgentsDir, 'agents-united.json');
      const canonicalKey = 'skills/workflow-implement/SKILL.md';
      const legacyPath = '.cline/workflows/implement-feature-or-fix.md';

      // 1. Fresh projection produces the current paths.
      await installer.install('software-engineering', {
        targetDir: targetAgentsDir,
        method: 'copy',
        fanout: ['cline'],
      });

      let lockfile = await fs.readJson(lockfilePath);
      const fresh = lockfile.files[canonicalKey].projectedTo;
      expect(fresh).toContain('.cline/workflows/workflow-implement.md');

      // 2. Simulate legacy pre-ADR-0016 bookkeeping: an old slug that no longer exists.
      lockfile.files[canonicalKey].projectedTo = [...fresh, legacyPath];
      await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

      // 3. Re-project — the stale pointer must be reconciled away.
      await installer.install('software-engineering', {
        targetDir: targetAgentsDir,
        method: 'copy',
        fanout: ['cline'],
        force: true,
      });

      lockfile = await fs.readJson(lockfilePath);
      const reconciled = lockfile.files[canonicalKey].projectedTo;
      expect(reconciled).toContain('.cline/workflows/workflow-implement.md');
      expect(reconciled).not.toContain(legacyPath);
    });

    it('preserves another bundle\'s plugin-lane projections when re-projecting one bundle', async () => {
      const installer = new InstallEngine();
      const targetAgentsDir = path.join(testWorkspace, '.agents');
      const lockfilePath = path.join(targetAgentsDir, 'agents-united.json');
      const canonicalKey = 'skills/workflow-implement/SKILL.md';

      await installer.install('software-engineering', {
        targetDir: targetAgentsDir,
        method: 'copy',
        fanout: ['cline'],
      });

      // Simulate a second bundle owning its own plugin-lane copy of the same canonical.
      const otherBundlePath = '.agents/plugins/frontend-engineering/skills/workflow-implement/SKILL.md';
      const lockfile = await fs.readJson(lockfilePath);
      lockfile.files[canonicalKey].projectedTo = [...lockfile.files[canonicalKey].projectedTo, otherBundlePath];
      await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });

      await installer.install('software-engineering', {
        targetDir: targetAgentsDir,
        method: 'copy',
        fanout: ['cline'],
        force: true,
      });

      const after = (await fs.readJson(lockfilePath)).files[canonicalKey].projectedTo;
      expect(after).toContain(otherBundlePath);
      expect(after).toContain('.cline/workflows/workflow-implement.md');
    });
  });
});
