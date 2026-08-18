import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { ClineLauncher } from '../src/core/cline-launcher.js';
import type { ClineCapabilityReport } from '../src/core/types.js';

/**
 * Plan 002 — Software Engineering & Delivery lifecycle conformance suite.
 *
 * Essentials bundle (software-engineering) + one recommended addon installed
 * into the same workspace with a cline fan-out. Written RED at 7e2032c to
 * characterize the provenance/ownership/removal/start-resolution bugs found in
 * the live audit; plan 001 makes this suite green.
 *
 * Every "who owns what" expectation is DERIVED from registry/bundles.json
 * entries (orchestrator + agents + skills + workflows) instead of hard-coded,
 * so the suite generalizes to other domains (plan 002 maintenance note).
 */

const ROOT = process.cwd();
const REGISTRY_DIR = path.resolve(ROOT, 'registry');

interface BundleEntry {
  name: string;
  parentBundle?: string;
  orchestrator?: string;
  agents?: string[];
  skills?: string[];
  workflows?: string[];
  recommendedAddons?: string[];
}

const bundlesJson = fs.readJsonSync(path.join(REGISTRY_DIR, 'bundles.json')) as {
  bundles: Record<string, BundleEntry>;
};

const ESSENTIALS = 'software-engineering';
const essentialsEntry: BundleEntry = bundlesJson.bundles[ESSENTIALS];
if (!essentialsEntry) {
  throw new Error(`bundles.json is missing the ${ESSENTIALS} entry`);
}

// Derived from the essentials bundle, not hard-coded (registry/bundles.json
// recommendedAddons of software-engineering).
const ADDONS: string[] = essentialsEntry.recommendedAddons ?? [];
if (ADDONS.length === 0) {
  throw new Error(`${ESSENTIALS} declares no recommendedAddons in bundles.json`);
}

// The A-group walks the richest shared surface called out in plan 002
// (shared orchestrator + git-guardrails skill + shared workflows); the B/C
// matrices below exercise every addon.
const PROVENANCE_ADDON = 'devops-engineering';

function entry(name: string): BundleEntry {
  const e = bundlesJson.bundles[name];
  if (!e) throw new Error(`bundles.json is missing an entry for ${name}`);
  return e;
}

// ---------------------------------------------------------------------------
// Asset-set derivation from bundles.json entries
// ---------------------------------------------------------------------------

const uniq = (a: string[]): string[] => Array.from(new Set(a));
const minus = (a: string[], b: string[]): string[] => a.filter(x => !b.includes(x));
const inter = (a: string[], b: string[]): string[] => a.filter(x => b.includes(x));
const sorted = (a: string[]): string[] => [...a].sort();

/** Agent files declared by a bundle entry itself (its orchestrator + agents). */
const declaredAgents = (b: BundleEntry): string[] =>
  uniq([...(b.orchestrator ? [b.orchestrator] : []), ...(b.agents ?? [])]);

/** Canonical `.agents`-relative POSIX paths declared by a bundle entry. */
function canonicalOf(b: BundleEntry): string[] {
  const agents = declaredAgents(b).map(a => `agents/${a}`);
  const skills = (b.skills ?? [])
    .filter(s => fs.existsSync(path.join(REGISTRY_DIR, 'skills', s, 'SKILL.md')))
    .map(s => `skills/${s}/SKILL.md`);
  const workflows = (b.workflows ?? []).map(w => `workflows/${w}`);
  return [...agents, ...skills, ...workflows];
}

/** Workspace-root-relative POSIX `.cline` projection paths declared by a bundle
 *  entry: role projections, SKILL.md projections, coordinator rule, team manifest. */
function projectionsOf(b: BundleEntry): string[] {
  const roles = declaredAgents(b).map(a => `.cline/agents/${a}`);
  const skills = (b.skills ?? [])
    .filter(s => fs.existsSync(path.join(REGISTRY_DIR, 'skills', s, 'SKILL.md')))
    .map(s => `.cline/skills/${s}/SKILL.md`);
  return [
    ...roles,
    ...skills,
    `.cline/rules/agents-united-${b.name}.md`,
    `.cline/agents-united/teams/${b.name}.yaml`,
  ];
}

const essentialsOnlyOf = (addon: BundleEntry): string[] =>
  minus(canonicalOf(essentialsEntry), canonicalOf(addon));
const sharedOf = (addon: BundleEntry): string[] =>
  inter(canonicalOf(essentialsEntry), canonicalOf(addon));
const addonOnlyOf = (addon: BundleEntry): string[] =>
  minus(canonicalOf(addon), canonicalOf(essentialsEntry));

const projectionsEssentialsOnly = (addon: BundleEntry): string[] =>
  minus(projectionsOf(essentialsEntry), projectionsOf(addon));
const projectionsShared = (addon: BundleEntry): string[] =>
  inter(projectionsOf(essentialsEntry), projectionsOf(addon));
const projectionsAddonOnly = (addon: BundleEntry): string[] =>
  minus(projectionsOf(addon), projectionsOf(essentialsEntry));

// ---------------------------------------------------------------------------
// Lockfile conformance view
// ---------------------------------------------------------------------------

interface FileRecordView {
  hash?: string;
  bundle?: string;
  /** Multi-owner shape expected after plan 001; absent at 7e2032c. */
  owners?: string[];
  installedAt?: string;
  method?: string;
  projectedTo?: string[];
}

interface ProjectionView {
  owners: string[];
  installedAt?: string;
  host?: string;
  kind?: string;
  hash?: string;
  canonical?: string;
  managedMarker?: boolean;
}

interface LockfileView {
  installed: { bundles: string[]; agents: string[]; skills: string[]; workflows: string[] };
  fanout?: string[];
  bundleVersions?: Record<string, string>;
  files: Record<string, FileRecordView>;
  projections?: Record<string, ProjectionView>;
}

async function readLock(agentsDir: string): Promise<LockfileView> {
  return (await fs.readJson(path.join(agentsDir, 'agents-united.json'))) as LockfileView;
}

/** Locate a file record regardless of key separator style (POSIX vs win32). */
function findFile(lock: LockfileView, posixRel: string): FileRecordView | undefined {
  if (lock.files[posixRel]) return lock.files[posixRel];
  const norm = (k: string): string => k.replace(/\\/g, '/');
  for (const [k, v] of Object.entries(lock.files)) {
    if (norm(k) === posixRel) return v;
  }
  return undefined;
}

/**
 * Owners of a canonical file record. At 7e2032c records carry a single
 * `bundle` string (the bug surface); plan 001 is expected to track all owning
 * bundles. Normalize both shapes to a sorted array.
 */
function ownersOf(rec: FileRecordView | undefined): string[] {
  if (!rec) return [];
  if (Array.isArray(rec.owners)) return sorted(rec.owners);
  if (typeof rec.bundle === 'string' && rec.bundle.length > 0) return [rec.bundle];
  return [];
}

function expectOwners(actual: string[], expected: string[], label: string): void {
  expect(actual, `${label} owners`).toEqual(sorted(expected));
}

// ---------------------------------------------------------------------------
// Workspace plumbing (per-it scratch workspace, like tests/projection-lifecycle.test.ts)
// ---------------------------------------------------------------------------

const testWorkspace = path.resolve(ROOT, 'scratch/test-sed-conformance');
const agentsDir = path.join(testWorkspace, '.agents');

function installOptions(): { targetDir: string; method: 'copy'; fanout: string[] } {
  return { targetDir: agentsDir, method: 'copy', fanout: ['cline'] };
}

async function installBundle(name: string): Promise<void> {
  const installer = new InstallEngine();
  await installer.install(name, installOptions());
}

async function installBoth(addon: string, order: 'essentials-first' | 'addon-first'): Promise<void> {
  if (order === 'essentials-first') {
    await installBundle(ESSENTIALS);
    await installBundle(addon);
  } else {
    await installBundle(addon);
    await installBundle(ESSENTIALS);
  }
}

async function uninstallBundle(name: string): Promise<{ removed: string[] }> {
  const uninstaller = new UninstallEngine();
  return await uninstaller.uninstall(name, { targetDir: agentsDir });
}

/** Recursively list files under a directory as sorted POSIX relative paths. */
async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else {
        out.push(path.relative(root, p).split(path.sep).join('/'));
      }
    }
  }
  if (await fs.pathExists(root)) await walk(root);
  return out.sort();
}

/** Recursively list empty directories (used to verify pruning). */
async function collectEmptyDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<boolean> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let hasContent = false;
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const childHasContent = await walk(p);
        hasContent = hasContent || childHasContent;
      } else {
        hasContent = true;
      }
    }
    if (!hasContent) out.push(path.relative(root, dir).split(path.sep).join('/'));
    return hasContent;
  }
  if (await fs.pathExists(root)) await walk(root);
  return out.sort();
}

/** B2/B3 end state: nothing managed survives anywhere in the workspace. */
async function assertCleanTerminalState(): Promise<void> {
  const lock = await readLock(agentsDir);
  expect(lock.installed.bundles).toEqual([]);
  expect(lock.installed.agents).toEqual([]);
  expect(lock.installed.skills).toEqual([]);
  expect(lock.installed.workflows).toEqual([]);

  for (const sub of ['agents', 'skills', 'workflows', 'rules']) {
    const leftovers = await collectFiles(path.join(agentsDir, sub));
    expect(leftovers, `leftover managed files in .agents/${sub}`).toEqual([]);
  }
  expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);
}

// ---------------------------------------------------------------------------
// A-group shared ownership assertions (reused by A1–A4 and A6)
// ---------------------------------------------------------------------------

function assertEssentialsOnlyFiles(lock: LockfileView, addon: string): void {
  const targets = essentialsOnlyOf(entry(addon));
  expect(targets.length, 'essentials-only asset set must not be empty').toBeGreaterThan(0);
  for (const rel of targets) {
    const rec = findFile(lock, rel);
    expect(rec, `file record for .agents/${rel}`).toBeDefined();
    expectOwners(ownersOf(rec), [ESSENTIALS], `.agents/${rel}`);
  }
}

function assertSharedFiles(lock: LockfileView, addon: string): void {
  const targets = sharedOf(entry(addon));
  expect(targets.length, 'shared asset set must not be empty').toBeGreaterThan(0);
  for (const rel of targets) {
    const rec = findFile(lock, rel);
    expect(rec, `file record for .agents/${rel}`).toBeDefined();
    expectOwners(ownersOf(rec), [ESSENTIALS, addon], `.agents/${rel}`);
  }
}

function assertAddonOnlyFiles(lock: LockfileView, addon: string): void {
  const targets = addonOnlyOf(entry(addon));
  expect(targets.length, 'addon-only asset set must not be empty').toBeGreaterThan(0);
  for (const rel of targets) {
    const rec = findFile(lock, rel);
    expect(rec, `file record for .agents/${rel}`).toBeDefined();
    expectOwners(ownersOf(rec), [addon], `.agents/${rel}`);
  }
}

function assertProjectionOwners(lock: LockfileView, addon: string): void {
  const addonEntry = entry(addon);
  const projMap = new Map<string, ProjectionView>();
  for (const [k, v] of Object.entries(lock.projections ?? {})) {
    projMap.set(k.replace(/\\/g, '/'), v);
  }
  expect(projMap.size, 'lockfile.projections must not be empty').toBeGreaterThan(0);

  const check = (rel: string, expected: string[]): void => {
    const rec = projMap.get(rel);
    expect(rec, `projection record for ${rel}`).toBeDefined();
    const owners = rec && Array.isArray(rec.owners) ? sorted(rec.owners) : [];
    expectOwners(owners, expected, rel);
  };

  for (const rel of projectionsEssentialsOnly(addonEntry)) check(rel, [ESSENTIALS]);
  for (const rel of projectionsShared(addonEntry)) check(rel, [ESSENTIALS, addon]);
  for (const rel of projectionsAddonOnly(addonEntry)) check(rel, [addon]);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('002 — SE&D Essentials+addon lifecycle conformance (red baseline at 7e2032c)', () => {
  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  describe('A. Provenance & ownership after both installs', () => {
    it('A1: essentials-only canonical records are owned exactly by software-engineering', async () => {
      await installBoth(PROVENANCE_ADDON, 'essentials-first');
      const lock = await readLock(agentsDir);
      assertEssentialsOnlyFiles(lock, PROVENANCE_ADDON);
    });

    it('A2: shared canonical records are owned by exactly both bundles', async () => {
      await installBoth(PROVENANCE_ADDON, 'essentials-first');
      const lock = await readLock(agentsDir);
      // Derivation sanity for the plan's example addon (devops-engineering):
      // the shared set must contain the orchestrator and git-guardrails skill.
      const shared = sharedOf(entry(PROVENANCE_ADDON));
      expect(shared).toContain('agents/orchestrator-engineering.md');
      expect(shared).toContain('skills/git-guardrails/SKILL.md');
      assertSharedFiles(lock, PROVENANCE_ADDON);
    });

    it('A3: addon-only canonical records are owned exactly by the addon', async () => {
      await installBoth(PROVENANCE_ADDON, 'essentials-first');
      const lock = await readLock(agentsDir);
      assertAddonOnlyFiles(lock, PROVENANCE_ADDON);
    });

    it('A4: lockfile.projections owners mirror the canonical ownership split', async () => {
      await installBoth(PROVENANCE_ADDON, 'essentials-first');
      const lock = await readLock(agentsDir);
      assertProjectionOwners(lock, PROVENANCE_ADDON);
    });

    it('A5: first-install timestamps on shared records survive the second install', async () => {
      await installBundle(ESSENTIALS);
      const shared = sharedOf(entry(PROVENANCE_ADDON));
      expect(shared.length).toBeGreaterThan(0);
      const lock1 = await readLock(agentsDir);
      const firstSeen = new Map<string, string | undefined>();
      for (const rel of shared) {
        firstSeen.set(rel, findFile(lock1, rel)?.installedAt);
      }
      expect(
        firstSeen.get('agents/orchestrator-engineering.md'),
        'orchestrator record exists after first install'
      ).toBeDefined();

      await installBundle(PROVENANCE_ADDON);
      const lock2 = await readLock(agentsDir);
      for (const rel of shared) {
        const rec = findFile(lock2, rel);
        expect(rec, `record for .agents/${rel} after second install`).toBeDefined();
        expect(rec?.installedAt, `installedAt of .agents/${rel}`).toBe(firstSeen.get(rel));
      }
    });

    it('A6: ownership contract holds with install order reversed (addon first)', async () => {
      await installBoth(PROVENANCE_ADDON, 'addon-first');
      const lock = await readLock(agentsDir);
      assertEssentialsOnlyFiles(lock, PROVENANCE_ADDON);
      assertSharedFiles(lock, PROVENANCE_ADDON);
      assertAddonOnlyFiles(lock, PROVENANCE_ADDON);
      assertProjectionOwners(lock, PROVENANCE_ADDON);
    });
  });

  describe('B. Removal matrix (per addon)', () => {
    it.each(ADDONS)('B1: %s — removing essentials first leaves addon-declared assets alive', async (addon) => {
      const addonEntry = entry(addon);
      await installBoth(addon, 'essentials-first');
      await uninstallBundle(ESSENTIALS);

      // Addon-declared canonical files survive.
      for (const rel of canonicalOf(addonEntry)) {
        expect(await fs.pathExists(path.join(agentsDir, rel)), `.agents/${rel} survives`).toBe(true);
      }
      // Addon-declared projections survive.
      for (const rel of projectionsOf(addonEntry)) {
        expect(await fs.pathExists(path.join(testWorkspace, rel)), `${rel} survives`).toBe(true);
      }

      // Parent-only canonical files are gone.
      for (const rel of essentialsOnlyOf(addonEntry)) {
        expect(await fs.pathExists(path.join(agentsDir, rel)), `.agents/${rel} removed`).toBe(false);
      }
      // Parent-only projections (incl. the parent's rule and team manifest) are gone.
      for (const rel of projectionsEssentialsOnly(addonEntry)) {
        expect(await fs.pathExists(path.join(testWorkspace, rel)), `${rel} removed`).toBe(false);
      }

      // .cline stays (addon artifacts remain) but no empty dirs are left behind.
      expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(true);
      expect(await collectEmptyDirs(path.join(testWorkspace, '.cline'))).toEqual([]);
    });

    it.each(ADDONS)('B2: %s — essentials then addon removal leaves zero managed files', async (addon) => {
      await installBoth(addon, 'essentials-first');
      await uninstallBundle(ESSENTIALS);
      await uninstallBundle(addon);
      await assertCleanTerminalState();
    });

    it.each(ADDONS)('B3: %s — addon first then essentials removal reaches the same end state', async (addon) => {
      await installBoth(addon, 'essentials-first');
      await uninstallBundle(addon);
      await uninstallBundle(ESSENTIALS);
      await assertCleanTerminalState();
    });

    it.each(ADDONS)('B4: %s — uninstall of a zero-ownership bundle rejects and never mutates the lockfile', async (addon) => {
      await installBoth(addon, 'essentials-first');
      const lockPath = path.join(agentsDir, 'agents-united.json');

      // Corrupt/stale workspace: the addon stays listed in installed.bundles
      // but owns zero files and zero projections.
      const lock = (await fs.readJson(lockPath)) as LockfileView;
      for (const [k, v] of Object.entries(lock.files)) {
        if (v.bundle === addon || (v.owners ?? []).includes(addon)) delete lock.files[k];
      }
      if (lock.projections) {
        for (const [k, v] of Object.entries(lock.projections)) {
          if (v.owners.includes(addon)) delete lock.projections[k];
        }
      }
      await fs.writeJson(lockPath, lock, { spaces: 2 });
      const before = await fs.readFile(lockPath, 'utf8');

      const uninstaller = new UninstallEngine();
      await expect(uninstaller.uninstall(addon, { targetDir: agentsDir })).rejects.toThrow();

      const after = await fs.readFile(lockPath, 'utf8');
      expect(after, 'lockfile must remain byte-identical after a rejected remove').toBe(before);
      const lockAfter = (await fs.readJson(lockPath)) as LockfileView;
      expect(lockAfter.installed.bundles).toContain(addon);
    });

    it.each(ADDONS)('B5: %s — shared orchestrator stays on the roster after essentials removal', async (addon) => {
      const addonEntry = entry(addon);
      await installBoth(addon, 'essentials-first');
      await uninstallBundle(ESSENTIALS);

      const lock = await readLock(agentsDir);
      expect(lock.installed.bundles).toContain(addon);
      expect(lock.installed.bundles).not.toContain(ESSENTIALS);
      expect(lock.installed.agents, 'shared orchestrator survives roster').toContain(addonEntry.orchestrator);
    });
  });


  describe('C. Start resolution (per addon)', () => {
    // Same fake probe seam as tests/cline-launcher.test.ts — planActivation is a
    // dry plan and never spawns a real cline binary.
    const fakeProbeReport: ClineCapabilityReport = {
      installed: true,
      version: 'v3.0.55',
      namedTeams: true,
      rolePresetConsumer: 'unknown',
      command: { executable: 'cline', prefixArgs: [], source: 'path-executable' },
      diagnostics: [],
    };

    it.each(ADDONS)('C1: %s — both bundles resolve and produce a dry activation plan', async (addon) => {
      await installBoth(addon, 'essentials-first');
      const launcher = new ClineLauncher();

      const essentialsRes = await launcher.resolveInstallation(ESSENTIALS, { cwd: testWorkspace });
      expect(essentialsRes.scope).toBe('project');
      expect(essentialsRes.manifestPath).toContain(`${ESSENTIALS}.yaml`);
      expect(await fs.pathExists(essentialsRes.manifestPath)).toBe(true);

      const addonRes = await launcher.resolveInstallation(addon, { cwd: testWorkspace });
      expect(addonRes.scope).toBe('project');
      expect(addonRes.manifestPath).toContain(`${addon}.yaml`);
      expect(await fs.pathExists(addonRes.manifestPath)).toBe(true);

      const plan = launcher.planActivation({
        bundleName: addon,
        workspace: testWorkspace,
        scope: 'project',
        report: fakeProbeReport,
        prompt: 'conformance dry run',
      });
      expect(plan.strategy).toBe('named-team');
      expect(plan.argv).toContain('--cwd');
      expect(plan.argv[plan.argv.length - 1]).toContain('conformance dry run');
    });

    it.each(ADDONS)('C2: %s — addon start resolves after essentials removal; essentials start rejects', async (addon) => {
      await installBoth(addon, 'essentials-first');
      await uninstallBundle(ESSENTIALS);

      const launcher = new ClineLauncher();
      const addonRes = await launcher.resolveInstallation(addon, { cwd: testWorkspace });
      expect(addonRes.manifestPath).toContain(`${addon}.yaml`);
      expect(await fs.pathExists(addonRes.manifestPath)).toBe(true);

      await expect(
        launcher.resolveInstallation(ESSENTIALS, { cwd: testWorkspace })
      ).rejects.toThrow(/not installed in project scope/);
    });
  });

  describe('D. Lockfile hygiene', () => {
    it('D1: every files and projections key is POSIX', async () => {
      await installBoth(PROVENANCE_ADDON, 'essentials-first');
      const lock = await readLock(agentsDir);

      const fileKeys = Object.keys(lock.files);
      expect(fileKeys.length).toBeGreaterThan(0);
      for (const k of fileKeys) {
        expect(k, `files key ${JSON.stringify(k)}`).not.toMatch(/\\/);
      }

      const projKeys = Object.keys(lock.projections ?? {});
      expect(projKeys.length).toBeGreaterThan(0);
      for (const k of projKeys) {
        expect(k, `projections key ${JSON.stringify(k)}`).not.toMatch(/\\/);
      }
    });

    it('D2: double-install of essentials is idempotent (file set, owners, installedAt unchanged)', async () => {
      const lockPath = path.join(agentsDir, 'agents-united.json');

      await installBundle(ESSENTIALS);
      const firstRaw = await fs.readFile(lockPath, 'utf8');
      const first = JSON.parse(firstRaw) as LockfileView;

      await installBundle(ESSENTIALS);
      const secondRaw = await fs.readFile(lockPath, 'utf8');
      const second = JSON.parse(secondRaw) as LockfileView;

      // File set unchanged.
      expect(sorted(Object.keys(second.files))).toEqual(sorted(Object.keys(first.files)));
      // Owners and first-install timestamps unchanged per record.
      for (const [k, rec] of Object.entries(first.files)) {
        const again = findFile(second, k.replace(/\\/g, '/'));
        expect(again, `record ${k} after reinstall`).toBeDefined();
        expect(ownersOf(again), `owners of ${k}`).toEqual(ownersOf(rec));
        expect(again?.installedAt, `installedAt of ${k}`).toBe(rec.installedAt);
      }
      // Whole-lockfile equality: nothing at all may drift on a repeat install.
      expect(JSON.parse(secondRaw)).toEqual(JSON.parse(firstRaw));
    });
  });
});



