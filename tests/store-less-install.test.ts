import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InventoryScanner } from '../src/core/inventory.js';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import { planInstallTargets } from '../src/core/hosts.js';

/**
 * Plan 023 Workstream B / Step B1 — RED suite for ADR 0022 store-less Claude installs (owner
 * decisions D3–D4, approved 2026-09-26).
 *
 * D3: a store-less install keeps its machine state in a hidden, machine-owned SIDECAR
 *     `<root>/.claude/.agents-united/` — the lockfile plus an immutable snapshot of the canonical
 *     assets it projected. The state machine is unchanged; only state-dir discovery and
 *     workspace-root derivation learn the sidecar (B0 inventory: 13 lookups, 6 derivations).
 * D4: store-less applies only when Claude is the sole selected host (no `agents`/`gemini`, no
 *     Cline, no `--plugin`, no `--canonical-store`). A later store-requiring add moves the sidecar
 *     into `.agents/` (lockfile keys are state-dir-relative, projections root-relative — no rewrite).
 *
 * ADR 0022 acceptance: (1) a Claude-only install leaves no `.agents/`; (2) doctor/update/uninstall
 * stay warning-free on that shape; (3) a later store-requiring add materializes the store and
 * reconciles the lockfile; (4) store-backed installs are byte-for-byte unchanged.
 *
 * RED-PHASE CONTRACT — `../src/core/state-dir.js` lands in Step B2. Module access goes through
 * `stateDirApi()` with a non-literal specifier (tsc stays green; a missing module is a descriptive
 * "MISSING API" failure, never a collection crash). Expected surface:
 *
 *   SIDECAR_DIR: string                                   // '.claude/.agents-united' (POSIX)
 *   resolveStateDir(scope, overrideDir?, opts?: { cwd?: string; home?: string }): string
 *   workspaceRootOf(stateDir: string): string
 *
 * Integration surface: `planInstallTargets(selected, { canonicalStore?, pluginLane? })` returns
 * `storeShape: 'store' | 'sidecar'`; the lockfile carries `storeShape: 'sidecar'` on a sidecar
 * install and NO `storeShape` key on a store-backed one (shape unchanged).
 */
interface StateDirModule {
  SIDECAR_DIR: string;
  resolveStateDir(scope: 'project' | 'global', overrideDir?: string, opts?: { cwd?: string; home?: string }): string;
  workspaceRootOf(stateDir: string): string;
}

async function stateDirApi(): Promise<StateDirModule> {
  const specifier = '../src/core/state-dir.js';
  const mod = (await import(specifier).catch((err: unknown) => {
    throw new Error(
      `MISSING API: src/core/state-dir.ts cannot be loaded (Plan 023 Step B2 contract) — ${err instanceof Error ? err.message : String(err)}`,
    );
  })) as Partial<StateDirModule>;
  if (typeof mod.resolveStateDir !== 'function' || typeof mod.workspaceRootOf !== 'function' || typeof mod.SIDECAR_DIR !== 'string') {
    throw new Error('MISSING API: state-dir.ts must export SIDECAR_DIR, resolveStateDir, workspaceRootOf (Plan 023 Step B2)');
  }
  return mod as StateDirModule;
}

const WS = path.resolve(process.cwd(), 'scratch/test-store-less-workspace');
const SIDECAR = path.join(WS, '.claude', '.agents-united');
const STORE = path.join(WS, '.agents');
const BUNDLE = 'software-engineering';

const lockfileAt = async (stateDir: string): Promise<Record<string, any>> => fs.readJson(path.join(stateDir, 'agents-united.json'));
const addSidecar = (opts: Record<string, unknown> = {}) =>
  new InstallEngine().install(BUNDLE, { targetDir: SIDECAR, method: 'copy', fanout: ['claude'], ...opts } as never);
/** Doctor warnings that indicate a real defect (environment probes such as a missing Claude binary excluded). */
const defectWarnings = (warnings: string[]): string[] => warnings.filter(w => !/executable was not detected/i.test(w));

beforeEach(async () => {
  await fs.remove(WS);
  await fs.ensureDir(WS);
});
afterEach(async () => {
  await fs.remove(WS);
});

describe('Plan 023 B — state-dir module (unit)', () => {
  it('names the sidecar', async () => {
    expect((await stateDirApi()).SIDECAR_DIR).toBe('.claude/.agents-united');
  });

  it('derives the workspace root for both shapes and both scopes', async () => {
    const { workspaceRootOf } = await stateDirApi();
    expect(workspaceRootOf(STORE)).toBe(WS);
    expect(workspaceRootOf(SIDECAR)).toBe(WS);
    const home = path.join(WS, 'home');
    expect(workspaceRootOf(path.join(home, '.agents'))).toBe(home);
    expect(workspaceRootOf(path.join(home, '.claude', '.agents-united'))).toBe(home);
  });

  it('discovers the state dir: override > existing store > existing sidecar > default store', async () => {
    const { resolveStateDir } = await stateDirApi();
    expect(resolveStateDir('project', undefined, { cwd: WS })).toBe(STORE); // nothing installed
    await fs.outputJson(path.join(SIDECAR, 'agents-united.json'), { installed: { bundles: [] } });
    expect(resolveStateDir('project', undefined, { cwd: WS })).toBe(SIDECAR);
    await fs.outputJson(path.join(STORE, 'agents-united.json'), { installed: { bundles: [] } });
    expect(resolveStateDir('project', undefined, { cwd: WS })).toBe(STORE);
    const override = path.join(WS, 'elsewhere', '.agents');
    expect(resolveStateDir('project', override, { cwd: WS })).toBe(override);
    const home = path.join(WS, 'home');
    await fs.outputJson(path.join(home, '.claude', '.agents-united', 'agents-united.json'), {});
    expect(resolveStateDir('global', undefined, { home })).toBe(path.join(home, '.claude', '.agents-united'));
  });
});

describe('Plan 023 B — install-shape decision (D4)', () => {
  it('Claude alone is store-less; everything else keeps the store', () => {
    const claudeOnly = planInstallTargets(['claude']) as ReturnType<typeof planInstallTargets> & { storeShape?: string };
    expect(claudeOnly.storeShape).toBe('sidecar');
    expect(claudeOnly.addedCanonicalStore).toBe(false);
    expect(claudeOnly.fanout).toEqual(['claude']);
    const shape = (selected: string[], opts?: Record<string, boolean>): string | undefined =>
      ((planInstallTargets as unknown as (s: string[], o?: Record<string, boolean>) => { storeShape?: string })(selected, opts)).storeShape;
    expect(shape(['claude'], { canonicalStore: true })).toBe('store');
    expect(shape(['claude'], { pluginLane: true })).toBe('store');
    expect(shape(['claude', 'cline'])).toBe('store');
    expect(shape(['agents', 'claude'])).toBe('store');
    expect(shape(['agents'])).toBe('store');
    expect(shape(['cline'])).toBe('store');
  });
});

describe('Plan 023 B — store-less Claude install lifecycle (ADR 0022 acceptance)', () => {
  it('(1) a Claude-only install leaves no .agents/ and writes the sidecar snapshot + lockfile', async () => {
    await addSidecar();
    expect(await fs.pathExists(STORE)).toBe(false);
    const lock = await lockfileAt(SIDECAR);
    expect(lock.storeShape).toBe('sidecar');
    expect(lock.installed.bundles).toEqual([BUNDLE]);
    expect(await fs.pathExists(path.join(SIDECAR, 'agents', 'orchestrator-engineering.md'))).toBe(true);
    // projections land at the workspace root, never inside the sidecar's parent twice
    expect(await fs.pathExists(path.join(WS, '.claude', 'agents', 'orchestrator-engineering.md'))).toBe(true);
    expect(await fs.pathExists(path.join(WS, '.claude', '.claude'))).toBe(false);
    expect(Object.keys(lock.projections ?? {}).every(p => p.startsWith('.claude/'))).toBe(true);
  });

  it('the sidecar is a snapshot: symlink mode is downgraded to copy', async () => {
    await addSidecar({ method: 'symlink' });
    const file = path.join(SIDECAR, 'agents', 'orchestrator-engineering.md');
    expect((await fs.lstat(file)).isSymbolicLink()).toBe(false);
  });

  it('(2) doctor is warning-free on the sidecar shape', async () => {
    await addSidecar();
    expect(await fs.pathExists(path.join(WS, '.claude', 'agents', 'orchestrator-engineering.md'))).toBe(true);
    const report = await DoctorEngine.runDoctor(SIDECAR);
    expect(report.issues).toEqual([]);
    expect(defectWarnings(report.warnings)).toEqual([]);
    expect(report.agentsCount).toBeGreaterThan(0);
  });

  it('doctor flags a hand-edited sidecar snapshot (machine-owned state)', async () => {
    await addSidecar();
    const file = path.join(SIDECAR, 'agents', 'orchestrator-engineering.md');
    await fs.appendFile(file, '\nlocal edit\n');
    const warnings = (await DoctorEngine.runDoctor(SIDECAR)).warnings;
    expect(warnings.some(w => /sidecar snapshot modified.*agents\/orchestrator-engineering\.md/i.test(w))).toBe(true);
  });

  it('(2) inventory lists the sidecar install under host `agents`, and update re-installs into it', async () => {
    await addSidecar();
    const inventory = await new InventoryScanner().scan({ targetDir: SIDECAR });
    const record = inventory.bundles.find(r => r.name === BUNDLE);
    expect(record?.targetDir).toBe(SIDECAR);
    expect(record?.host).toBe('agents');
    const result = await new UpdateEngine().update(BUNDLE, { targetDir: SIDECAR, yes: true });
    expect(result.updated.map(r => r.name)).toContain(BUNDLE);
    expect(await fs.pathExists(STORE)).toBe(false);
    expect(await fs.pathExists(path.join(WS, '.claude', '.claude'))).toBe(false);
    expect((await lockfileAt(SIDECAR)).storeShape).toBe('sidecar');
    expect(defectWarnings((await DoctorEngine.runDoctor(SIDECAR)).warnings)).toEqual([]);
  });

  it('(2) inventory discovers the sidecar with no targetDir (plain `agents list` / `update`)', async () => {
    await addSidecar();
    const inventory = await new InventoryScanner().scan({ cwd: WS, scope: 'project' });
    const record = inventory.bundles.find(r => r.name === BUNDLE);
    expect(record?.targetDir).toBe(SIDECAR);
    expect(record?.host).toBe('agents');
    expect(inventory.bundles.filter(r => r.name === BUNDLE)).toHaveLength(1);
  });

  it('(2) removing the last bundle tears down the sidecar and every projection', async () => {
    await addSidecar();
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: SIDECAR, yes: true } as never);
    expect(await fs.pathExists(SIDECAR)).toBe(false);
    expect(await fs.pathExists(path.join(WS, '.claude'))).toBe(false);
    expect(await fs.pathExists(STORE)).toBe(false);
  });

  it('the Claude launcher resolves a sidecar install', async () => {
    await addSidecar();
    const resolution = await new ClaudeLauncher().resolveInstallation(BUNDLE, { cwd: WS });
    expect(resolution.lockfile.installed.bundles).toContain(BUNDLE);
    expect(resolution.workspace).toBe(WS);
  });

  it('(3) a later store-requiring add moves the sidecar into .agents/ and reconciles the lockfile', async () => {
    await addSidecar();
    const before = await lockfileAt(SIDECAR);
    await new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout: ['claude', 'cline'] } as never);
    expect(await fs.pathExists(SIDECAR)).toBe(false);
    const after = await lockfileAt(STORE);
    expect('storeShape' in after).toBe(false);
    expect(after.installed.bundles).toEqual(before.installed.bundles);
    for (const [key, meta] of Object.entries(before.files as Record<string, { owners?: string[] }>)) {
      expect(after.files[key]?.owners, key).toEqual(meta.owners);
    }
    expect(await fs.pathExists(path.join(WS, '.claude', 'agents', 'orchestrator-engineering.md'))).toBe(true);
    const report = await DoctorEngine.runDoctor(STORE);
    expect(report.issues).toEqual([]);
    expect(defectWarnings(report.warnings)).toEqual([]);
  });

  it('a half-finished move (sidecar content already in .agents/, shape not yet flipped) is completed', async () => {
    await addSidecar();
    await fs.move(SIDECAR, STORE); // crash after the move, before the lockfile flip
    await new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout: ['claude', 'cline'] } as never);
    expect('storeShape' in (await lockfileAt(STORE))).toBe(false);
    expect(defectWarnings((await DoctorEngine.runDoctor(STORE)).warnings)).toEqual([]);
  });

  it('(4) a store-backed install keeps the exact lockfile shape (no storeShape key)', async () => {
    await new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout: ['claude'] } as never);
    expect('storeShape' in (await lockfileAt(STORE))).toBe(false);
    expect(await fs.pathExists(SIDECAR)).toBe(false);
  });

  it('global scope: the sidecar lives under the home .claude dir and the root is the home dir', async () => {
    const { workspaceRootOf } = await stateDirApi();
    const home = path.join(WS, 'home');
    const globalSidecar = path.join(home, '.claude', '.agents-united');
    await new InstallEngine().install(BUNDLE, { targetDir: globalSidecar, scope: 'global', method: 'copy', fanout: ['claude'] } as never);
    expect(workspaceRootOf(globalSidecar)).toBe(home);
    expect(await fs.pathExists(path.join(home, '.claude', 'agents', 'orchestrator-engineering.md'))).toBe(true);
    expect(await fs.pathExists(path.join(home, '.agents'))).toBe(false);
    expect(os.homedir()).not.toBe(home); // the real home is never touched
  });
});
