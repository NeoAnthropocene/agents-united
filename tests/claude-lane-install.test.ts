import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 016 Step 4 — the Claude lane (`<workspace>/.claude/**`) installer,
 * its lockfile `projections` bookkeeping, and the pre-rename
 * (`subagent-*`) migration/prune.
 */
describe('Plan 016 Step 4 — Claude lane installer, lockfile & migration', () => {
  // Unique scratch subdir: scratch/ is shared with other suites.
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-claude-lane-install');
  const agentsDir = path.join(testWorkspace, '.agents');
  const claudeDir = path.join(testWorkspace, '.claude');
  const claudeAgentsDir = path.join(claudeDir, 'agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');

  const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');
  /** Workspace-root-relative, forward-slash path -> absolute path. */
  const abs = (rel: string) => path.join(testWorkspace, ...rel.split('/'));

  /** Read a field out of a leading YAML frontmatter block. */
  function fmField(content: string, field: string): string | undefined {
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!block) return undefined;
    const line = block[1]
      .split(/\r?\n/)
      .find(l => l.trimStart().startsWith(`${field}:`));
    if (!line) return undefined;
    return line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '');
  }

  /** Projection keys for a lane, workspace-root-relative with forward slashes. */
  const projKeys = (lockfile: any, prefix: string): string[] =>
    Object.keys(lockfile.projections ?? {}).filter(k => k.startsWith(prefix));

  async function readLockfile(): Promise<any> {
    return fs.readJson(lockPath);
  }

  async function installClaude(extra: { dryRun?: boolean; force?: boolean } = {}) {
    const installer = new InstallEngine();
    return installer.install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
      ...extra,
    });
  }

  beforeEach(async () => {
    // NOTE: never pass maxRetries/retryDelay to fs-extra remove() — it hangs here.
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  // ------------------------------------------------------------------ lane A1
  it('A1 deploys .claude/agents/orchestrator-engineering.md with matching frontmatter name', async () => {
    await installClaude();

    const orchestrator = path.join(claudeAgentsDir, 'orchestrator-engineering.md');
    expect(await fs.pathExists(orchestrator)).toBe(true);
    expect(fmField(await fs.readFile(orchestrator, 'utf8'), 'name')).toBe('orchestrator-engineering');
  });

  // ------------------------------------------------------------------ lane A2
  it('A2 strips the subagent- prefix from projected agent filenames and frontmatter', async () => {
    await installClaude();

    const files = (await fs.readdir(claudeAgentsDir)).filter(f => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.startsWith('subagent-')).toBe(false);
    }

    expect(await fs.pathExists(path.join(claudeAgentsDir, 'backend-architect.md'))).toBe(true);
    expect(await fs.pathExists(path.join(claudeAgentsDir, 'subagent-backend-architect.md'))).toBe(false);
    const backend = await fs.readFile(path.join(claudeAgentsDir, 'backend-architect.md'), 'utf8');
    expect(fmField(backend, 'name')).toBe('backend-architect');
  });

  // ------------------------------------------------------------------ lane A3
  it('A3 projects skills as .claude/skills/<name>/SKILL.md and a non-empty .claude/rules', async () => {
    await installClaude();

    const skillsDir = path.join(claudeDir, 'skills');
    expect(await fs.pathExists(skillsDir)).toBe(true);
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const withSkillMd: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && (await fs.pathExists(path.join(skillsDir, entry.name, 'SKILL.md')))) {
        withSkillMd.push(entry.name);
      }
    }
    expect(withSkillMd.length).toBeGreaterThanOrEqual(10);

    const rulesDir = path.join(claudeDir, 'rules');
    expect(await fs.pathExists(rulesDir)).toBe(true);
    const ruleFiles = (await fs.readdir(rulesDir)).filter(f => f.endsWith('.md'));
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ lane A4
  it('A4 writes no non-goal artifacts (settings.json, workflows, CLAUDE.md, CLAUDE.local.md)', async () => {
    await installClaude();

    expect(await fs.pathExists(path.join(claudeDir, 'settings.json'))).toBe(false);
    expect(await fs.pathExists(path.join(claudeDir, 'workflows'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, 'CLAUDE.md'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, 'CLAUDE.local.md'))).toBe(false);
  });

  // ------------------------------------------------------------------ lane A5
  it('A5 records the claude role projection in the lockfile with owners and a real sha256 hash', async () => {
    await installClaude();

    const rel = '.claude/agents/backend-architect.md';
    const proj = (await readLockfile()).projections[rel];
    expect(proj).toBeDefined();
    expect(proj.host).toBe('claude');
    expect(proj.kind).toBe('role');
    expect(proj.managedMarker).toBe(true);
    expect(Array.isArray(proj.owners)).toBe(true);
    expect(proj.owners).toContain('software-engineering');

    const hex = sha256(await fs.readFile(abs(rel)));
    expect(proj.hash).toBe('sha256:' + hex);
  });

  // ------------------------------------------------------------------ lane A6
  it('A6 claude-only fanout leaves no Cline leakage anywhere', async () => {
    await installClaude();

    const projections = Object.values((await readLockfile()).projections) as Array<{ host: string }>;
    expect(projections.length).toBeGreaterThan(0);
    expect(projections.every(p => p.host === 'claude')).toBe(true);
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);
  });

  // ------------------------------------------------------------------ lane A7
  it('A7 surfaces the claude projection in result.projections', async () => {
    const result = await installClaude();

    expect(
      result.projections.some(p => p.host === 'claude' && p.path === '.claude/agents/backend-architect.md')
    ).toBe(true);
  });

  // ------------------------------------------------------------------- refs B8
  it('B8 de-duplicates owners for a projection shared with an inheriting bundle', async () => {
    // Path taken: the real inheriting bundle is used. frontend-engineering extends
    // software-engineering (cf. tests/uninstaller.test.ts: "frontend-engineering
    // inherits software-engineering, so both own the same rules"), so installing it
    // on top must merge owners on the shared claude projections without duplicates.
    await installClaude();
    const installer = new InstallEngine();
    await installer.install('frontend-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const lockfile = await readLockfile();
    const projections = Object.values(lockfile.projections) as Array<{ owners: string[] }>;
    expect(projections.length).toBeGreaterThan(0);

    for (const proj of projections) {
      expect(Array.isArray(proj.owners)).toBe(true);
      // No duplicate entries inside an owners array.
      expect(new Set(proj.owners).size).toBe(proj.owners.length);
    }

    const shared = projections.filter(
      p => p.owners.includes('software-engineering') && p.owners.includes('frontend-engineering')
    );
    expect(shared.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------- refs B9
  it('B9 uninstall leaves zero orphaned claude projections or projectedTo pointers', async () => {
    await installClaude();
    expect(await fs.pathExists(path.join(claudeAgentsDir, 'backend-architect.md'))).toBe(true);

    // `targetDir` is the option name used in tests/uninstaller.test.ts; `fanout`
    // narrows the lane. Typed loosely so the extra lane hint cannot break the run.
    const uninstallOptions: any = { targetDir: agentsDir, fanout: ['claude'] };
    await new UninstallEngine().uninstall('software-engineering', uninstallOptions);

    // 1. No projected agent file survives.
    const remaining = (await fs.pathExists(claudeAgentsDir))
      ? (await fs.readdir(claudeAgentsDir)).filter(f => f.endsWith('.md'))
      : [];
    expect(remaining).toEqual([]);

    // 2. No claude projection record survives.
    let lockfile: any = { files: {}, projections: {} };
    if (await fs.pathExists(lockPath)) {
      lockfile = await readLockfile();
    }
    const claudeProjections = Object.values(lockfile.projections ?? {}).filter(
      (p: any) => p.host === 'claude'
    );
    expect(claudeProjections).toEqual([]);

    // 3. No dangling projectedTo pointer into .claude/ survives.
    const dangling: string[] = [];
    for (const asset of Object.values<any>(lockfile.files ?? {})) {
      for (const target of asset.projectedTo ?? []) {
        if (String(target).includes('.claude/')) dangling.push(String(target));
      }
    }
    expect(dangling).toEqual([]);
  });

  // ------------------------------------------------------------------- refs B10
  it('B10 preserves a foreign unmanaged file in .claude/agents/ byte-identically', async () => {
    const foreignRel = '.claude/agents/foreign-role.md';
    const foreignAbs = abs(foreignRel);
    const foreignContent = '# not ours';
    await fs.ensureDir(path.dirname(foreignAbs));
    await fs.writeFile(foreignAbs, foreignContent, 'utf8');
    const foreignHex = sha256(await fs.readFile(foreignAbs));

    // Must not throw and must not touch the foreign file.
    await installClaude();

    expect(await fs.pathExists(foreignAbs)).toBe(true);
    expect(sha256(await fs.readFile(foreignAbs))).toBe(foreignHex);
    expect(await fs.readFile(foreignAbs, 'utf8')).toBe(foreignContent);

    const lockfile = await readLockfile();
    expect(lockfile.projections[foreignRel]).toBeUndefined();
  });

  // ------------------------------------------------------------------- migr C11
  it('C11 prunes pre-rename subagent-* leftovers and their lockfile records on re-install', async () => {
    const nativeRel = '.claude/agents/backend-architect.md';
    const legacyRel = '.claude/agents/subagent-backend-architect.md';
    const filesKey = 'agents/subagent-backend-architect.md';

    await installClaude();

    // Hand-craft the pre-rename leftover: a real projection file carrying a legacy
    // marker (copied from the fresh projection with the canonical value swapped),
    // plus its lockfile projection + files[...].projectedTo records.
    const native = await fs.readFile(abs(nativeRel), 'utf8');
    const nativeMarker = native.split(/\r?\n/).find(l => l.includes('managed-by: agents-united'));
    expect(nativeMarker).toBeDefined();
    const legacyMarker = nativeMarker!.replace(
      /canonical:\s*[^|]*\|/,
      'canonical: .agents/agents/subagent-backend-architect.md |'
    );
    await fs.writeFile(abs(legacyRel), native.replace(nativeMarker!, legacyMarker), 'utf8');

    const legacyHex = sha256(await fs.readFile(abs(legacyRel)));
    const lockfile = await readLockfile();
    lockfile.projections[legacyRel] = {
      host: 'claude',
      kind: 'role',
      canonical: '.agents/agents/subagent-backend-architect.md',
      owners: ['software-engineering'],
      hash: 'sha256:' + legacyHex,
      installedAt: new Date().toISOString(),
      managedMarker: true,
    };

    const canonicalAbs = path.join(agentsDir, 'agents', 'subagent-backend-architect.md');
    const assetHash = (await fs.pathExists(canonicalAbs))
      ? 'sha256:' + sha256(await fs.readFile(canonicalAbs))
      : 'sha256:' + legacyHex;
    if (lockfile.files[filesKey]) {
      const projectedTo: string[] = lockfile.files[filesKey].projectedTo ?? [];
      if (!projectedTo.includes(legacyRel)) projectedTo.push(legacyRel);
      lockfile.files[filesKey].projectedTo = projectedTo;
    } else {
      lockfile.files[filesKey] = {
        hash: assetHash,
        installedAt: new Date().toISOString(),
        projectedTo: [legacyRel],
      };
    }
    await fs.writeJson(lockPath, lockfile, { spaces: 2 });

    // Sanity: the legacy state really is on disk and in the lockfile before the re-run.
    expect(await fs.pathExists(abs(legacyRel))).toBe(true);
    expect((await readLockfile()).projections[legacyRel]).toBeDefined();

    // Re-run the very same install → migration/prune must clean the leftover.
    await installClaude();

    expect(await fs.pathExists(abs(legacyRel))).toBe(false);
    expect(await fs.pathExists(abs(nativeRel))).toBe(true);

    const after = await readLockfile();
    expect(projKeys(after, '.claude/agents/subagent-')).toEqual([]);

    const stalePointers: string[] = [];
    for (const asset of Object.values<any>(after.files ?? {})) {
      for (const target of asset.projectedTo ?? []) {
        if (String(target).includes('.claude/agents/subagent-')) stalePointers.push(String(target));
      }
    }
    expect(stalePointers).toEqual([]);
  });

  // ------------------------------------------------------------------- migr C12
  it('C12 re-install is idempotent (no projection or claude file churn)', async () => {
    await installClaude();
    await installClaude();

    const firstProjections = (await readLockfile()).projections;
    const firstFiles = (await fs.readdir(claudeAgentsDir)).sort();
    const firstCount = Object.keys(firstProjections).length;
    expect(firstCount).toBeGreaterThan(0);

    await installClaude();

    const secondProjections = (await readLockfile()).projections;
    const secondFiles = (await fs.readdir(claudeAgentsDir)).sort();

    expect(Object.keys(secondProjections).length).toBe(firstCount);
    expect(secondFiles).toEqual(firstFiles);
    // No churn: identical projection keys and identical hashes.
    expect(Object.keys(secondProjections).sort()).toEqual(Object.keys(firstProjections).sort());
    for (const key of Object.keys(firstProjections)) {
      expect(secondProjections[key].hash).toBe(firstProjections[key].hash);
    }
  });

  // -------------------------------------------------------------------- dry D13
  it('D13 dry-run with fanout writes nothing to the claude lane', async () => {
    const result = await installClaude({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(await fs.pathExists(claudeDir)).toBe(false);
  });
});
