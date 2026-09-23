import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import type { LockfileManifest } from '../src/core/types.js';

/**
 * Plan 016 Step 5 — doctor behaviour for the Claude lane.
 *
 * Workspace isolation: the installer derives the projection root as `dirname(agentsDir)`, so
 * the store lives at `<suiteRoot>/ws/.agents` and every projection lands inside `<suiteRoot>/ws`.
 * That keeps this suite off the shared `scratch/` sibling directories (`scratch/.claude`,
 * `scratch/.agents`, …) that tests/doctor.test.ts already cleans, so the two suites cannot race.
 */
describe('Plan 016 Step 5 — doctor and the Claude projection lane', () => {
  const suiteRoot = path.resolve(process.cwd(), 'scratch/test-claude-doctor');
  const workspace = path.join(suiteRoot, 'ws');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const claudeAgents = path.join(workspace, '.claude', 'agents');

  /** The recorded file-record key for a canonical, tolerant of the platform separator. */
  function fileKeyFor(lockfile: LockfileManifest, suffix: string): string | undefined {
    const native = suffix.split('/').join(path.sep);
    return Object.keys(lockfile.files).find(key => key === suffix || key === native);
  }

  async function installClaude(): Promise<void> {
    await new InstallEngine().install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });
  }

  async function readLock(): Promise<LockfileManifest> {
    return fs.readJson(lockPath);
  }

  async function writeLock(lockfile: LockfileManifest): Promise<void> {
    await fs.writeJson(lockPath, lockfile, { spaces: 2 });
  }

  /** Warnings that reference one projection path — the "exactly one per path" probe. */
  function warningsFor(warnings: string[], projectionPath: string): string[] {
    return warnings.filter(w => w.includes(projectionPath));
  }

  async function sha256(absPath: string): Promise<string> {
    return 'sha256:' + crypto.createHash('sha256').update(await fs.readFile(absPath)).digest('hex');
  }

  beforeEach(async () => {
    // NOTE: never pass maxRetries/retryDelay to fs-extra remove() — it hangs this environment.
    await fs.remove(suiteRoot);
    await fs.ensureDir(workspace);
  });

  afterEach(async () => {
    await fs.remove(suiteRoot);
  });

  it('emits zero warnings for a freshly installed Claude lane (ADR 0017 false-positive doctrine)', async () => {
    await installClaude();

    const report = await DoctorEngine.runDoctor(agentsDir);

    expect(report.issues).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('reports a deleted managed projection once, as missing', async () => {
    await installClaude();

    const rel = '.claude/agents/backend-architect.md';
    await fs.remove(path.join(workspace, rel));

    const report = await DoctorEngine.runDoctor(agentsDir);

    const hits = warningsFor(report.warnings, rel);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/Missing/);
  });

  it('reports edited projection content once, as content drift', async () => {
    await installClaude();

    const rel = '.claude/agents/backend-architect.md';
    const abs = path.join(workspace, rel);
    await fs.writeFile(abs, (await fs.readFile(abs, 'utf8')) + '\nHand-edited by the user.\n', 'utf8');

    const report = await DoctorEngine.runDoctor(agentsDir);

    const hits = warningsFor(report.warnings, rel);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('Content drift');
    expect(hits[0]).toContain('agents update software-engineering --fanout claude');
  });

  it('reports a stale render once when the recorded hash matches a body the renderer no longer produces', async () => {
    await installClaude();

    const rel = '.claude/agents/backend-architect.md';
    const abs = path.join(workspace, rel);
    await fs.writeFile(abs, (await fs.readFile(abs, 'utf8')) + '\nRendered by an older bundle definition.\n', 'utf8');

    // Keep the recorded hash truthful so the drift check passes and the renderer diff is what fires.
    const lockfile = await readLock();
    lockfile.projections![rel].hash = await sha256(abs);
    await writeLock(lockfile);

    const report = await DoctorEngine.runDoctor(agentsDir);

    const hits = warningsFor(report.warnings, rel);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('Outdated projection');
  });

  /**
   * Hand-crafts the pre-rename state: a `.claude/agents/subagent-<role>.md` path is still
   * recorded (in both `projectedTo` and `projections`) while the current renderer serves the
   * same canonical from the prefix-stripped `.claude/agents/<role>.md`.
   *
   * The CANONICAL name is never stripped — `.agents/agents/subagent-backend-architect.md` is
   * the store's own filename; only the projection path drops the prefix (ADR 0018 decision 2).
   */
  async function seedSupersededPath(): Promise<string> {
    const staleRel = '.claude/agents/subagent-backend-architect.md';
    const canonical = 'agents/subagent-backend-architect.md';
    const lockfile = await readLock();

    lockfile.projections![staleRel] = {
      host: 'claude',
      kind: 'role',
      canonical,
      owners: ['software-engineering'],
      hash: 'sha256:' + '0'.repeat(64),
      installedAt: new Date().toISOString(),
      managedMarker: true,
    };

    const key = fileKeyFor(lockfile, canonical);
    expect(key).toBeDefined();
    lockfile.files[key!].projectedTo = [
      ...(lockfile.files[key!].projectedTo ?? []),
      staleRel,
    ];

    await writeLock(lockfile);
    return staleRel;
  }

  it('classifies a pre-rename path as stale/superseded exactly once and never as missing', async () => {
    await installClaude();
    const staleRel = await seedSupersededPath();

    const report = await DoctorEngine.runDoctor(agentsDir);

    const hits = warningsFor(report.warnings, staleRel);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('Stale projection');
    expect(hits[0]).toContain('superseded by .claude/agents/backend-architect.md');
    expect(hits[0]).toContain('agents update software-engineering --fanout claude');
    expect(hits[0]).not.toContain('Missing');
    // No other warning may reference the pre-rename path transitively.
    expect(report.warnings.filter(w => w.includes('subagent-backend-architect')).length).toBe(1);
  });

  it('self-heals the seeded pre-rename path on re-install, leaving zero warnings and zero orphans', async () => {
    await installClaude();
    const staleRel = await seedSupersededPath();

    expect((await readLock()).projections![staleRel]).toBeDefined();
    expect(await DoctorEngine.runDoctor(agentsDir)).not.toBeNull();

    await installClaude();

    const report = await DoctorEngine.runDoctor(agentsDir);
    const lockfile = await readLock();

    expect(report.warnings).toEqual([]);
    expect(lockfile.projections![staleRel]).toBeUndefined();
    expect(await fs.pathExists(path.join(workspace, staleRel))).toBe(false);
    const key = fileKeyFor(lockfile, 'agents/subagent-backend-architect.md');
    expect((lockfile.files[key!].projectedTo ?? []).some(p => p.includes('subagent-'))).toBe(false);
    // The pruned path leaves no orphaned directories behind.
    expect(Object.keys(lockfile.projections!).every(k => /\.claude\/|\.agents\//.test(k))).toBe(true);
  });

  it('keeps a Cline-only install free of any Claude-lane warning', async () => {
    await new InstallEngine().install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['cline'],
    });

    const report = await DoctorEngine.runDoctor(agentsDir);

    expect(report.warnings.filter(w => w.includes('.claude/'))).toEqual([]);
  });

  it('surfaces a Claude capability report for --host claude', async () => {
    await installClaude();

    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');

    expect(report.claudeCapability).toBeDefined();
    expect(typeof report.claudeCapability!.installed).toBe('boolean');
    expect(Array.isArray(report.claudeCapability!.diagnostics)).toBe(true);
    expect(typeof report.claudeCapability!.pluginSupport).toBe('boolean');
    expect(typeof report.claudeCapability!.agentTeamsExperimental).toBe('boolean');
  });
});
