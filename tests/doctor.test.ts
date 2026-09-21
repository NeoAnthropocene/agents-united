import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { LockfileManifest } from '../src/core/types.js';

describe('DoctorEngine', () => {
  const tempDir = path.resolve(process.cwd(), 'scratch/test-workspace-doctor');
  let resolver: RegistryResolver;
  let installer: InstallEngine;

  beforeEach(async () => {
    // Bounded retries (rimraf's own option, not a sleep): every suite whose workspace
    // lives under `scratch/` causes the projection lanes to write SIBLING dirs at the
    // `scratch/` root (e.g. `scratch/.agents/plugins/<bundle>/**` from the Cline lane),
    // so a concurrently running suite can be mid-write when this cleanup runs. Retrying
    // keeps the cleanup deterministic instead of flaking with ENOTEMPTY.
    const removeOpts = { maxRetries: 8, retryDelay: 100 };
    await fs.remove(tempDir, removeOpts);
    // The Cline lane additionally writes `.agents/plugins/**` and `.cline/**`, and every
    // lane has its own dir — leaving any behind makes the next install refuse to overwrite
    // an unmanaged projection, so all of them are cleaned for test isolation.
    const scratchRoot = path.dirname(tempDir);
    for (const sibling of ['.claude', '.cline', '.agents', '.opencode', '.cursor', '.gemini']) {
      await fs.remove(path.join(scratchRoot, sibling), removeOpts);
    }
    await fs.ensureDir(tempDir);
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    installer = new InstallEngine(resolver);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should validate healthy installed workspace', async () => {
    await installer.install('software-engineering', { targetDir: tempDir });
    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.valid).toBe(true);
    expect(report.agentsCount).toBeGreaterThan(0);
    expect(report.issues.length).toBe(0);
  });

  it('reports a missing projection as a warning', async () => {
    await installer.install('software-engineering', {
      targetDir: tempDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(path.dirname(tempDir), '.claude', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(projAbs)).toBe(true);
    await fs.remove(projAbs);

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.warnings.some(w => w.includes('Missing projection'))).toBe(true);
  });

  it('reports a user-modified projection as a warning', async () => {
    await installer.install('software-engineering', {
      targetDir: tempDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(path.dirname(tempDir), '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(projAbs, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(projAbs, content, 'utf8');

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.warnings.some(w => w.includes('user-modified projection'))).toBe(true);
  });

  it('should report uninitialized workspace cleanly when empty', async () => {
    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.valid).toBe(true);
    expect(report.isInitialized).toBe(false);
    expect(report.agentsCount).toBe(0);
    expect(report.skillsCount).toBe(0);
    expect(report.workflowsCount).toBe(0);
    expect(report.issues.length).toBe(0);
    expect(report.warnings.length).toBe(0);
    expect(report.targetDir).toBe(tempDir);
  });

  it('should report warning when agents directory exists without lockfile', async () => {
    await fs.ensureDir(path.join(tempDir, 'agents'));
    await fs.writeFile(
      path.join(tempDir, 'agents', 'orchestrator-engineering.md'),
      '---\nname: orchestrator-engineering\nmodel: inherit\ndescription: Test agent\n---\nBody'
    );

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.valid).toBe(true);
    expect(report.warnings.some(w => w.includes('No lockfile found'))).toBe(true);
  });

  //  Plan 015 §4/4: rule propagation must not break projection/ownership health ──
  it('reports no projection or ownership warnings after a bundle install (Plan 015)', async () => {
    await installer.install('software-engineering', {
      targetDir: tempDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const report = await DoctorEngine.runDoctor(tempDir);

    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => w.includes('Missing projection'))).toEqual([]);
    expect(report.warnings.filter(w => w.includes('Missing Cline projection'))).toEqual([]);
    expect(report.warnings.filter(w => w.includes('user-modified projection'))).toEqual([]);
    expect(report.warnings.filter(w => w.includes('is not in installed.bundles'))).toEqual([]);
    expect(report.warnings.filter(w => w.includes('owns zero file records'))).toEqual([]);
  });

  it('resolves agent-referenced rules into the canonical store (Plan 015 Step 1)', async () => {
    await installer.install('software-engineering', { targetDir: tempDir, method: 'copy' });

    const rulesDir = path.join(tempDir, 'rules');
    expect(await fs.pathExists(path.join(rulesDir, 'GEMINI.md'))).toBe(true);
    expect(await fs.pathExists(path.join(rulesDir, 'git-guardrails.md'))).toBe(true);
    expect(await fs.pathExists(path.join(rulesDir, 'test-driven-development.md'))).toBe(true);

    const lockfile = await fs.readJson(path.join(tempDir, 'agents-united.json'));
    expect(lockfile.files['rules/git-guardrails.md'].owners).toContain('software-engineering');
  });

  // ADR 0016 unified workflows into skills: `installed.workflows` is a deprecated
  // legacy field that stays empty on modern installs, which made doctor report
  // "Installed Workflows: 0" even though workflow skills were installed/projected.
  it('counts installed workflow skills instead of reporting the deprecated legacy field', async () => {
    await installer.install('software-engineering', { targetDir: tempDir, method: 'copy' });

    const lockfile = await fs.readJson(path.join(tempDir, 'agents-united.json'));
    const expectedWorkflowSkills = (lockfile.installed.skills as string[])
      .filter(s => s.startsWith('workflow-')).length;

    expect(expectedWorkflowSkills).toBeGreaterThan(0);

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.workflowsCount).toBe(expectedWorkflowSkills);
  });

  // ── Plan 015 §5.9/3: stale/renamed vs genuinely missing projections ──────────
  describe('stale vs missing projection classification (Plan 015 §5.9 item 3)', () => {
    const CANONICAL = 'agents/orchestrator-engineering.md';
    const LEGACY = '.claude/agents/orchestrator-engineering-legacy.md';
    const CURRENT = '.claude/agents/orchestrator-engineering.md';

    /** Materialise the `projections` record the cline lane would write for a path.
     *  The claude lane records `projectedTo` but leaves `manifest.projections`
     *  empty, so the superseding record has to be injected to model the registry. */
    const injectProjection = async (
      lockfilePath: string,
      projRelPath: string,
      owners: string[]
    ): Promise<void> => {
      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      lockfile.projections = lockfile.projections ?? {};
      lockfile.projections[projRelPath] = {
        host: 'claude',
        kind: 'role',
        canonical: CANONICAL,
        owners,
        hash: 'sha256:injected',
        installedAt: new Date(0).toISOString(),
        managedMarker: true,
      };
      await fs.writeJson(lockfilePath, lockfile);
    };

    it('reports a renamed projection as stale when a superseding projection exists', async () => {
      await installer.install('software-engineering', {
        targetDir: tempDir,
        method: 'copy',
        fanout: ['claude'],
      });

      const lockfilePath = path.join(tempDir, 'agents-united.json');
      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      lockfile.files[CANONICAL].projectedTo = [
        ...(lockfile.files[CANONICAL].projectedTo ?? []),
        LEGACY,
      ];
      await fs.writeJson(lockfilePath, lockfile);
      await injectProjection(lockfilePath, CURRENT, ['software-engineering']);

      const report = await DoctorEngine.runDoctor(tempDir);
      const stale = report.warnings.filter(w => w.includes('Stale projection'));

      expect(stale).toHaveLength(1);
      expect(stale[0]).toContain(`Stale projection ${LEGACY}`);
      expect(stale[0]).toContain(`for canonical ${CANONICAL}`);
      expect(stale[0]).toContain(`(superseded by ${CURRENT}).`);
      expect(stale[0]).toContain(
        'Run: agents update software-engineering --fanout claude to reconcile.'
      );
      // The deleted-path message must NOT be emitted for a self-healing rename.
      expect(
        report.warnings.filter(w => w.includes('Missing projection') && w.includes(LEGACY))
      ).toEqual([]);
    });
    it('omits the reconcile command when the superseding projection has no owners', async () => {
      await installer.install('software-engineering', {
        targetDir: tempDir,
        method: 'copy',
        fanout: ['claude'],
      });

      const lockfilePath = path.join(tempDir, 'agents-united.json');
      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      lockfile.files[CANONICAL].projectedTo = [
        ...(lockfile.files[CANONICAL].projectedTo ?? []),
        LEGACY,
      ];
      await fs.writeJson(lockfilePath, lockfile);
      await injectProjection(lockfilePath, CURRENT, []);

      const report = await DoctorEngine.runDoctor(tempDir);
      const stale = report.warnings.filter(w => w.includes('Stale projection'));

      expect(stale).toHaveLength(1);
      expect(stale[0]).toContain(`(superseded by ${CURRENT}).`);
      expect(stale[0]).not.toContain('Run: agents update');
    });

    it('still reports a deleted projection as missing, never as stale (regression)', async () => {
      await installer.install('software-engineering', {
        targetDir: tempDir,
        method: 'copy',
        fanout: ['claude'],
      });

      const projAbs = path.join(path.dirname(tempDir), '.claude', 'agents', 'orchestrator-engineering.md');
      expect(await fs.pathExists(projAbs)).toBe(true);
      await fs.remove(projAbs);

      const report = await DoctorEngine.runDoctor(tempDir);
      const missing = report.warnings.filter(
        w => w.includes('Missing projection') && w.includes(CURRENT)
      );

      expect(missing).toHaveLength(1);
      expect(missing[0]).toBe(
        `Missing projection ${CURRENT} for canonical ${CANONICAL}. Re-run: agents add ... --fanout`
      );
      expect(report.warnings.some(w => w.includes('Stale projection'))).toBe(false);
    });

    // Verbatim Plan 015 §5.7 scenario: the ADR 0016 workflow-slug rename, on the
    // built-in cline lane that records `projections` natively (no injection).
    it('classifies a legacy ADR 0016 workflow slug as stale (built-in cline lane)', async () => {
      await installer.install('software-engineering', {
        targetDir: tempDir,
        method: 'copy',
        fanout: ['cline'],
      });

      const lockfilePath = path.join(tempDir, 'agents-united.json');
      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      const wfCanonical = 'skills/workflow-implement/SKILL.md';
      const legacySlug = '.cline/workflows/implement-feature-or-fix.md';
      const currentSlug = '.cline/workflows/workflow-implement.md';

      expect(lockfile.files[wfCanonical].projectedTo).toContain(currentSlug);
      expect(lockfile.projections?.[currentSlug].canonical).toBe(wfCanonical);
      lockfile.files[wfCanonical].projectedTo = [
        ...(lockfile.files[wfCanonical].projectedTo ?? []),
        legacySlug,
      ];
      await fs.writeJson(lockfilePath, lockfile);

      const report = await DoctorEngine.runDoctor(tempDir);
      const stale = report.warnings.filter(w => w.includes('Stale projection'));

      expect(stale).toHaveLength(1);
      expect(stale[0]).toContain(`Stale projection ${legacySlug}`);
      expect(stale[0]).toContain(`for canonical ${wfCanonical}`);
      expect(stale[0]).toContain('(superseded by ');
      expect(stale[0]).toContain(
        'Run: agents update software-engineering --fanout cline to reconcile.'
      );
      expect(
        report.warnings.filter(w => w.includes('Missing projection') && w.includes(legacySlug))
      ).toEqual([]);
    });

  });

  // ADR 0017 — renderer-backed projection freshness (drift + stale render).
  describe('renderer-backed projection freshness (ADR 0017)', () => {
    const clineRule = '.cline/rules/agents-united-software-engineering.md';
    const bundleName = 'software-engineering';

    it('reports content drift when a managed projection was edited after installation', async () => {
      await installer.install(bundleName, { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      const projAbs = path.join(path.dirname(tempDir), clineRule);
      expect(await fs.pathExists(projAbs)).toBe(true);

      const original = await fs.readFile(projAbs, 'utf8');
      // Keep the managed marker intact: this is the blind spot the drift check closes.
      await fs.writeFile(projAbs, `${original}\n<!-- hand-edited, marker preserved -->\n`, 'utf8');

      const report = await DoctorEngine.runDoctor(tempDir);
      const drift = report.warnings.filter(w => w.includes('Content drift'));

      expect(drift).toHaveLength(1);
      expect(drift[0]).toContain(clineRule);
      expect(drift[0]).toContain('agents update');
      // Attribution: an edited file must not also be reported as an outdated render.
      expect(report.warnings.filter(w => w.includes('Outdated projection'))).toEqual([]);
    });

    it('reports an outdated projection when the recorded hash matches but the current render differs', async () => {
      await installer.install(bundleName, { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      const projAbs = path.join(path.dirname(tempDir), clineRule);
      const lockfilePath = path.join(tempDir, 'agents-united.json');
      const { createHash } = await import('node:crypto');
      const sha256 = (value: string): string =>
        `sha256:${createHash('sha256').update(value).digest('hex')}`;

      // Model a projection produced by an OLDER renderer: the on-disk content differs
      // from the current render, while the recorded hash matches what is on disk — so
      // the drift check cannot see it either.
      const staleContent =
        '<!-- managed-by: agents-united | profile: cline | canonical: rules/agents-united-software-engineering.md | do not edit -->\n\n# Legacy coordinator rule\n';
      await fs.writeFile(projAbs, staleContent, 'utf8');

      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      lockfile.projections![clineRule].hash = sha256(staleContent);
      await fs.writeJson(lockfilePath, lockfile);

      const report = await DoctorEngine.runDoctor(tempDir);
      const outdated = report.warnings.filter(w => w.includes('Outdated projection'));

      expect(outdated).toHaveLength(1);
      expect(outdated[0]).toContain(clineRule);
      expect(outdated[0]).toContain('Run: agents update software-engineering --fanout cline');
      expect(report.warnings.filter(w => w.includes('Content drift'))).toEqual([]);
      expect(report.warnings.filter(w => w.includes('Missing projection'))).toEqual([]);
    });

    it('reports no freshness warnings for a freshly projected workspace (no false positives)', async () => {
      await installer.install(bundleName, { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      const report = await DoctorEngine.runDoctor(tempDir);

      expect(report.valid).toBe(true);
      expect(report.warnings.filter(w => w.includes('Outdated projection'))).toEqual([]);
      expect(report.warnings.filter(w => w.includes('Content drift'))).toEqual([]);
    });

    it('skips the drift comparison for legacy projection records without a hash', async () => {
      await installer.install(bundleName, { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      const lockfilePath = path.join(tempDir, 'agents-united.json');
      const lockfile = await fs.readJson(lockfilePath) as LockfileManifest;
      delete (lockfile.projections![clineRule] as { hash?: string }).hash;
      await fs.writeJson(lockfilePath, lockfile);

      const report = await DoctorEngine.runDoctor(tempDir);

      expect(report.warnings.filter(w => w.includes('Content drift'))).toEqual([]);
      expect(report.valid).toBe(true);
    });

    it('keeps compound-lane roles intact through a domain pseudo-bundle fanout (regression)', async () => {
      await installer.install(bundleName, { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      const roleAbs = path.join(path.dirname(tempDir), '.cline', 'agents', 'backend-architect.yml');
      const before = await fs.readFile(roleAbs, 'utf8');

      // `domain:engineering` cannot resolve to a bundle definition, so its Cline fanout
      // used to fall through to the generic lane and overwrite compound-owned roles with
      // a different renderer's output — leaving the recorded hash stale, so doctor then
      // reported permanent content drift after every `update --all`.
      await installer.install('domain:engineering', { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

      expect(await fs.readFile(roleAbs, 'utf8')).toBe(before);

      const report = await DoctorEngine.runDoctor(tempDir);
      expect(report.warnings.filter(w => w.includes('Content drift'))).toEqual([]);
      expect(report.warnings.filter(w => w.includes('Outdated projection'))).toEqual([]);
    });
  });
});
