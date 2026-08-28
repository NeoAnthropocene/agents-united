import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';

describe('InstallEngine fan-out (plan 007 M3)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-fanout-workspace');
  const agentsDir = path.join(testWorkspace, '.agents');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('projects agents into selected runtimes with translated frontmatter', async () => {
    const installer = new InstallEngine();
    // Note: RegistryResolver independently resolves the registry dir, so pass the
    // real one. This suite relies on the project registry like installer.test.ts.
    const result = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
    });

    // Canonical store unchanged in format
    const orchestrator = path.join(agentsDir, 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(orchestrator)).toBe(true);

    // Claude projection present + translated
    const claudeProj = path.join(testWorkspace, '.claude', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(claudeProj)).toBe(true);
    const claude = await fs.readFile(claudeProj, 'utf8');
    expect(claude).not.toContain('hooks:');
    expect(claude).toContain('managed-by: agents-united');
    expect(claude).toContain('Read');

    // Cline projection present
    const clineProj = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(clineProj)).toBe(true);

    // Lockfile projectedTo recorded (forward slashes, workspace-root-relative)
    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    const asset = lockfile.files[['agents', 'orchestrator-engineering.md'].join('/')];
    expect(asset).toBeDefined();
    expect(asset.projectedTo).toContain('.claude/agents/orchestrator-engineering.md');
    expect(asset.projectedTo).toContain('.agents/plugins/software-engineering/agents/orchestrator-engineering.md');

    // result.projections surfaced to the CLI caller
    expect(result.projections.some(p => p.host === 'claude' && p.path === '.claude/agents/orchestrator-engineering.md')).toBe(true);
  });

  it('without fanout, behavior is byte-identical to today (no projectedTo, no extra dirs)', async () => {
    const installer = new InstallEngine();
    const result = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: [],
    });

    expect(result.projections).toEqual([]);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude'))).toBe(false);

    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    for (const asset of Object.values(lockfile.files)) {
      expect(asset.projectedTo).toBeUndefined();
    }
  });

  it('dry-run with fanout writes nothing anywhere', async () => {
    const installer = new InstallEngine();
    const result = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(await fs.pathExists(agentsDir)).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.claude'))).toBe(false);
    expect(result.projections.length).toBeGreaterThan(0);
  });

  it('throws on a pre-existing user file at the projection destination without --force', async () => {
    const installer = new InstallEngine();
    const clineDir = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'agents');
    await fs.ensureDir(clineDir);
    await fs.writeFile(path.join(clineDir, 'orchestrator-engineering.md'), 'user file', 'utf8');

    await expect(
      installer.install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['cline'],
      })
    ).rejects.toThrow(/--force/);

    // User file preserved
    expect((await fs.readFile(path.join(clineDir, 'orchestrator-engineering.md'), 'utf8')).startsWith('user file')).toBe(true);
  });

  it('re-installing with fanout over our own managed projections does NOT require --force', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['cline'],
    });

    // Second install with fanout, NO force: the existing .agents/plugins files are our own
    // managed projections (deterministic content), so they must be regenerated, not collided.
    const result = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['cline'],
    });

    expect(result.projections.some(p => p.host === 'cline')).toBe(true);
    const proj = await fs.readFile(
      path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'agents', 'orchestrator-engineering.md'),
      'utf8'
    );
    expect(proj).toContain('managed-by: agents-united');
  });

  it('throws on a pre-existing foreign AGENTS.md without --force, but regenerates a managed one', async () => {
    const installer = new InstallEngine();

    // Case 1: foreign AGENTS.md (no marker) → must throw
    await fs.writeFile(path.join(testWorkspace, 'AGENTS.md'), '# my own notes', 'utf8');
    await expect(
      installer.install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['codex'],
      })
    ).rejects.toThrow(/--force/);
    expect(await fs.readFile(path.join(testWorkspace, 'AGENTS.md'), 'utf8')).toContain('my own notes');

    // Case 2: a managed AGENTS.md from a prior fanout install → regenerated without force
    await fs.remove(path.join(testWorkspace, 'AGENTS.md'));
    await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['codex'],
      force: true,
    });
    const rerun = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['codex'],
    });
    expect(rerun.projections.some(p => p.host === 'codex')).toBe(true);
  });

  it('codex fan-out generates a root AGENTS.md bridge and records it in projectedTo', async () => {
    const installer = new InstallEngine();
    const result = await installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['codex'],
    });

    const bridgePath = path.join(testWorkspace, 'AGENTS.md');
    expect(await fs.pathExists(bridgePath)).toBe(true);
    const bridge = await fs.readFile(bridgePath, 'utf8');
    expect(bridge).toContain('managed-by: agents-united');
    expect(bridge).toContain('orchestrator-engineering');

    const lockfile = await fs.readJson(path.join(agentsDir, 'agents-united.json'));
    const asset = lockfile.files[['agents', 'orchestrator-engineering.md'].join('/')];
    expect(asset.projectedTo).toContain('AGENTS.md');

    expect(result.projections.some(p => p.host === 'codex' && p.path === 'AGENTS.md')).toBe(true);
  });
});