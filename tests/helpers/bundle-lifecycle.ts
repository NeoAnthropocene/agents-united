/**
 * Shared, registry-driven machinery for the lifecycle conformance suites
 * (plan 002's SE&D suite and plan 007's cross-domain suite).
 *
 * These helpers are intentionally DOMAIN-AGNOSTIC: every function takes the
 * essentials bundle name (and, where relevant, the workspace) as an explicit
 * input rather than closing over a global.  All "who owns what" expectations
 * are DERIVED from registry/bundles.json (orchestrator + agents + skills +
 * workflows) instead of being hard-coded, so the same machinery generalizes to
 * every domain, and adding a domain or addon extends coverage automatically.
 *
 * No sleeps, no network — the whole lifecycle is deterministic local FS work.
 */
import path from 'node:path';
import fs from 'fs-extra';
import { expect } from 'vitest';
import { InstallEngine } from '../../src/core/installer.js';
import { UninstallEngine } from '../../src/core/uninstaller.js';

export const ROOT = process.cwd();
export const REGISTRY_DIR = path.resolve(ROOT, 'registry');

export interface BundleEntry {
  name: string;
  domain?: string;
  parentBundle?: string;
  tier?: string;
  orchestrator?: string;
  agents?: string[];
  skills?: string[];
  workflows?: string[];
  recommendedAddons?: string[];
}

export const bundlesJson: { bundles: Record<string, BundleEntry> } = fs.readJsonSync(
  path.join(REGISTRY_DIR, 'bundles.json')
);

export function entry(name: string): BundleEntry {
  const e = bundlesJson.bundles[name];
  if (!e) throw new Error(`bundles.json is missing an entry for ${name}`);
  return e;
}

// ---------------------------------------------------------------------------
// Small set helpers (pure)
// ---------------------------------------------------------------------------

export const uniq = (a: string[]): string[] => Array.from(new Set(a));
export const minus = (a: string[], b: string[]): string[] => a.filter(x => !b.includes(x));
export const inter = (a: string[], b: string[]): string[] => a.filter(x => b.includes(x));
export const sorted = (a: string[]): string[] => [...a].sort();

/** Agent files declared by a bundle entry itself (its orchestrator + agents). */
export const declaredAgents = (b: BundleEntry): string[] =>
  uniq([...(b.orchestrator ? [b.orchestrator] : []), ...(b.agents ?? [])]);

/** Canonical `.agents`-relative POSIX paths declared by a bundle entry. */
export function canonicalOf(b: BundleEntry): string[] {
  const agents = declaredAgents(b).map(a => `agents/${a}`);
  const skills = (b.skills ?? [])
    .filter(s => fs.existsSync(path.join(REGISTRY_DIR, 'skills', s, 'SKILL.md')))
    .map(s => `skills/${s}/SKILL.md`);
  const workflows = (b.workflows ?? []).map(w => `workflows/${w}`);
  return [...agents, ...skills, ...workflows];
}

/** Workspace-root-relative POSIX Cline projection paths declared by a bundle
 *  entry, per ADR 0013: plugin.json (Agent Plugin manifest), .cline/agents/*.yml
 *  configured agents, skills inside the package, .cline/rules/ coordinator rule,
 *  .cline/workflows/<slug>.md, and the vendor-namespace team manifest. */
export function projectionsOf(b: BundleEntry): string[] {
  const roles = declaredAgents(b).map(a => {
    const roleName = a.replace(/\.md$/i, '').replace(/^subagent-/, '');
    return `.cline/agents/${roleName}.yml`;
  });
  const skills = (b.skills ?? [])
    .filter(s => fs.existsSync(path.join(REGISTRY_DIR, 'skills', s, 'SKILL.md')))
    .map(s => `.agents/plugins/${b.name}/skills/${s}/SKILL.md`);
  const workflows = (b.workflows ?? [])
    .filter(w => fs.existsSync(path.join(REGISTRY_DIR, 'workflows', w)))
    .map(w => {
      const content = fs.readFileSync(path.join(REGISTRY_DIR, 'workflows', w), 'utf8');
      const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let name: string | undefined;
      if (m) {
        const nameLine = m[1].match(/^\s*name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
        if (nameLine) name = nameLine[1].trim();
      }
      const slug = (name ?? w.replace(/\.md$/i, ''))
        .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return `.cline/workflows/${slug}.md`;
    });
  return [
    `.agents/plugins/${b.name}/plugin.json`,
    ...roles,
    ...skills,
    ...workflows,
    `.cline/rules/agents-united-${b.name}.md`,
    `.agents/plugins/${b.name}/agents-united/teams/${b.name}.yaml`,
  ];
}

// ---------------------------------------------------------------------------
// Canonical / projection asset-set splits (essentials vs addon)
// ---------------------------------------------------------------------------

export interface AssetSplit {
  essentialsOnly: string[];
  shared: string[];
  addonOnly: string[];
}

export function splitCanonical(essentialsEntry: BundleEntry, addonEntry: BundleEntry): AssetSplit {
  return {
    essentialsOnly: minus(canonicalOf(essentialsEntry), canonicalOf(addonEntry)),
    shared: inter(canonicalOf(essentialsEntry), canonicalOf(addonEntry)),
    addonOnly: minus(canonicalOf(addonEntry), canonicalOf(essentialsEntry)),
  };
}

export function splitProjections(essentialsEntry: BundleEntry, addonEntry: BundleEntry): AssetSplit {
  return {
    essentialsOnly: minus(projectionsOf(essentialsEntry), projectionsOf(addonEntry)),
    shared: inter(projectionsOf(essentialsEntry), projectionsOf(addonEntry)),
    addonOnly: minus(projectionsOf(addonEntry), projectionsOf(essentialsEntry)),
  };
}

// ---------------------------------------------------------------------------
// Lockfile conformance view
// ---------------------------------------------------------------------------

export interface FileRecordView {
  hash?: string;
  bundle?: string;
  /** Multi-owner shape expected after plan 001. */
  owners?: string[];
  installedAt?: string;
  method?: string;
  projectedTo?: string[];
}

export interface ProjectionView {
  owners: string[];
  installedAt?: string;
  host?: string;
  kind?: string;
  hash?: string;
  canonical?: string;
  managedMarker?: boolean;
}

export interface LockfileView {
  installed: { bundles: string[]; agents: string[]; skills: string[]; workflows: string[] };
  fanout?: string[];
  bundleVersions?: Record<string, string>;
  files: Record<string, FileRecordView>;
  projections?: Record<string, ProjectionView>;
}

export async function readLock(agentsDir: string): Promise<LockfileView> {
  return (await fs.readJson(path.join(agentsDir, 'agents-united.json'))) as LockfileView;
}

/** Locate a file record regardless of key separator style (POSIX vs win32). */
export function findFile(lock: LockfileView, posixRel: string): FileRecordView | undefined {
  if (lock.files[posixRel]) return lock.files[posixRel];
  const norm = (k: string): string => k.replace(/\\/g, '/');
  for (const [k, v] of Object.entries(lock.files)) {
    if (norm(k) === posixRel) return v;
  }
  return undefined;
}

/**
 * Owners of a canonical file record. Normalize both the pre-plan-001 single
 * `bundle` string shape and the post-plan-001 multi-owner `owners` array to a
 * sorted array.
 */
export function ownersOf(rec: FileRecordView | undefined): string[] {
  if (!rec) return [];
  if (Array.isArray(rec.owners)) return sorted(rec.owners);
  if (typeof rec.bundle === 'string' && rec.bundle.length > 0) return [rec.bundle];
  return [];
}

export function expectOwners(actual: string[], expected: string[], label: string): void {
  expect(actual, `${label} owners`).toEqual(sorted(expected));
}

/** Recursively list files under a directory as sorted POSIX relative paths. */
export async function collectFiles(root: string): Promise<string[]> {
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
export async function collectEmptyDirs(root: string): Promise<string[]> {
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

// ---------------------------------------------------------------------------
// Essentials / addon corpus derivation (plan 007)
// ---------------------------------------------------------------------------

export type InstallOrder = 'essentials-first' | 'addon-first';

export interface DomainSpec {
  essentials: string;
  addons: string[];
}

const NON_ESSENTIALS = new Set(['full', 'universal-skills', 'universal-orchestration']);

export function deriveAddons(essentialsName: string): string[] {
  const e = entry(essentialsName);
  const listed = e.recommendedAddons ?? [];
  if (listed.length > 0) return [...listed];
  return Object.entries(bundlesJson.bundles)
    .filter(([, b]) => b.parentBundle === essentialsName)
    .map(([n]) => n);
}

export function validateDomainAddonConsistency(essentialsName: string): void {
  const e = entry(essentialsName);
  const listed = [...(e.recommendedAddons ?? [])].sort();
  const children = Object.entries(bundlesJson.bundles)
    .filter(([, b]) => b.parentBundle === essentialsName)
    .map(([n]) => n)
    .sort();
  if (JSON.stringify(listed) !== JSON.stringify(children)) {
    throw new Error(
      `[bundle-lifecycle] domain '${essentialsName}' recommendedAddons ` +
        `(${JSON.stringify(listed)}) disagrees with parentBundle children ` +
        `(${JSON.stringify(children)}) — refusing to guess canonical. ` +
        `Fix registry/bundles.json before running this suite.`
    );
  }
}

export function deriveDomains(): DomainSpec[] {
  const specs: DomainSpec[] = [];
  for (const [name, b] of Object.entries(bundlesJson.bundles)) {
    if (b.parentBundle) continue;
    if (b.tier === 'organization') continue;
    if (NON_ESSENTIALS.has(name)) continue;
    validateDomainAddonConsistency(name);
    specs.push({ essentials: name, addons: deriveAddons(name) });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Workspace harness
// ---------------------------------------------------------------------------

export interface BundleLifecycleHarness {
  essentials: string;
  essentialsEntry: BundleEntry;
  agentsDir: string;
  testWorkspace: string;

  installOptions(): { targetDir: string; method: 'copy'; fanout: string[] };
  installBundle(name: string): Promise<void>;
  installBoth(addon: string, order: InstallOrder): Promise<void>;
  uninstallBundle(name: string): Promise<{ removed: string[] }>;
  readLock: () => Promise<LockfileView>;

  canonicalEssentialsOnly(addon: string | BundleEntry): string[];
  canonicalShared(addon: string | BundleEntry): string[];
  canonicalAddonOnly(addon: string | BundleEntry): string[];
  projEssentialsOnly(addon: string | BundleEntry): string[];
  projShared(addon: string | BundleEntry): string[];
  projAddonOnly(addon: string | BundleEntry): string[];

  essentialsOnlyOf(addon: string | BundleEntry): string[];
  sharedOf(addon: string | BundleEntry): string[];
  addonOnlyOf(addon: string | BundleEntry): string[];
  projectionsEssentialsOnly(addon: string | BundleEntry): string[];
  projectionsShared(addon: string | BundleEntry): string[];
  projectionsAddonOnly(addon: string | BundleEntry): string[];

  assertEssentialsOnlyFiles(lock: LockfileView, addon: string): void;
  assertSharedFiles(lock: LockfileView, addon: string): void;
  assertAddonOnlyFiles(lock: LockfileView, addon: string): void;
  assertProjectionOwners(lock: LockfileView, addon: string): void;
  assertCleanTerminalState(): Promise<void>;

  collectFiles(parent: string): Promise<string[]>;
  collectEmptyDirs(parent: string): Promise<string[]>;
}

export function createHarness(opts: {
  workspace: string;
  essentials: string;
}): BundleLifecycleHarness {
  const essentials = opts.essentials;
  const testWorkspace = opts.workspace;
  const agentsDir = path.join(testWorkspace, '.agents');
  const essentialsEntry = entry(essentials);

  const installOptions = (): { targetDir: string; method: 'copy'; fanout: string[] } => ({
    targetDir: agentsDir,
    method: 'copy',
    fanout: ['cline'],
  });

  async function installBundle(name: string): Promise<void> {
    const installer = new InstallEngine();
    await installer.install(name, installOptions());
  }

  async function installBoth(addon: string, order: InstallOrder): Promise<void> {
    if (order === 'essentials-first') {
      await installBundle(essentials);
      await installBundle(addon);
    } else {
      await installBundle(addon);
      await installBundle(essentials);
    }
  }

  async function uninstallBundle(name: string): Promise<{ removed: string[] }> {
    const uninstaller = new UninstallEngine();
    return await uninstaller.uninstall(name, { targetDir: agentsDir });
  }

  const readLockFor = async (): Promise<LockfileView> => readLock(agentsDir);

  const resolveAddon = (a: string | BundleEntry): BundleEntry =>
    typeof a === 'string' ? entry(a) : a;

  const canonicalEssentialsOnly = (addon: string | BundleEntry): string[] =>
    splitCanonical(essentialsEntry, resolveAddon(addon)).essentialsOnly;
  const canonicalShared = (addon: string | BundleEntry): string[] =>
    splitCanonical(essentialsEntry, resolveAddon(addon)).shared;
  const canonicalAddonOnly = (addon: string | BundleEntry): string[] =>
    splitCanonical(essentialsEntry, resolveAddon(addon)).addonOnly;
  const projEssentialsOnly = (addon: string | BundleEntry): string[] =>
    splitProjections(essentialsEntry, resolveAddon(addon)).essentialsOnly;
  const projShared = (addon: string | BundleEntry): string[] =>
    splitProjections(essentialsEntry, resolveAddon(addon)).shared;
  const projAddonOnly = (addon: string | BundleEntry): string[] =>
    splitProjections(essentialsEntry, resolveAddon(addon)).addonOnly;

  function assertEssentialsOnlyFiles(lock: LockfileView, addon: string): void {
    const targets = splitCanonical(essentialsEntry, entry(addon)).essentialsOnly;
    expect(targets.length, `essentials-only asset set must not be empty (${essentials} vs ${addon})`).toBeGreaterThan(0);
    for (const rel of targets) {
      const rec = findFile(lock, rel);
      expect(rec, `file record for .agents/${rel}`).toBeDefined();
      expectOwners(ownersOf(rec), [essentials], `.agents/${rel}`);
    }
  }

  function assertSharedFiles(lock: LockfileView, addon: string): void {
    const targets = splitCanonical(essentialsEntry, entry(addon)).shared;
    expect(targets.length, `shared asset set must not be empty (${essentials} vs ${addon})`).toBeGreaterThan(0);
    for (const rel of targets) {
      const rec = findFile(lock, rel);
      expect(rec, `file record for .agents/${rel}`).toBeDefined();
      expectOwners(ownersOf(rec), [essentials, addon], `.agents/${rel}`);
    }
  }

  function assertAddonOnlyFiles(lock: LockfileView, addon: string): void {
    const targets = splitCanonical(essentialsEntry, entry(addon)).addonOnly;
    expect(targets.length, `addon-only asset set must not be empty (${essentials} vs ${addon})`).toBeGreaterThan(0);
    for (const rel of targets) {
      const rec = findFile(lock, rel);
      expect(rec, `file record for .agents/${rel}`).toBeDefined();
      expectOwners(ownersOf(rec), [addon], `.agents/${rel}`);
    }
  }

  function assertProjectionOwners(lock: LockfileView, addon: string): void {
    const splits = splitProjections(essentialsEntry, entry(addon));
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

    for (const rel of splits.essentialsOnly) check(rel, [essentials]);
    for (const rel of splits.shared) check(rel, [essentials, addon]);
    for (const rel of splits.addonOnly) check(rel, [addon]);
  }

  async function assertCleanTerminalState(): Promise<void> {
    const lock = await readLock(agentsDir);
    expect(lock.installed.bundles).toEqual([]);
    expect(lock.installed.agents).toEqual([]);
    expect(lock.installed.skills).toEqual([]);
    expect(lock.installed.workflows).toEqual([]);

    for (const sub of ['agents', 'skills', 'workflows', 'rules', 'plugins']) {
      const leftovers = await collectFiles(path.join(agentsDir, sub));
      expect(leftovers, `leftover managed files in .agents/${sub}`).toEqual([]);
    }
    expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(false);
    expect(await fs.pathExists(path.join(testWorkspace, '.agents', 'plugins'))).toBe(false);
  }

  return {
    essentials,
    essentialsEntry,
    agentsDir,
    testWorkspace,
    installOptions,
    installBundle,
    installBoth,
    uninstallBundle,
    readLock: readLockFor,
    canonicalEssentialsOnly,
    canonicalShared,
    canonicalAddonOnly,
    projEssentialsOnly,
    projShared,
    projAddonOnly,
    essentialsOnlyOf: canonicalEssentialsOnly,
    sharedOf: canonicalShared,
    addonOnlyOf: canonicalAddonOnly,
    projectionsEssentialsOnly: projEssentialsOnly,
    projectionsShared: projShared,
    projectionsAddonOnly: projAddonOnly,
    assertEssentialsOnlyFiles,
    assertSharedFiles,
    assertAddonOnlyFiles,
    assertProjectionOwners,
    assertCleanTerminalState,
    collectFiles,
    collectEmptyDirs,
  };
}