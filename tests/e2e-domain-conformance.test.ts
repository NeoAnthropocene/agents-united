/**
 * Plan 007 — Cross-domain generalization of the lifecycle conformance suite.
 *
 * For EVERY essentials bundle (from registry/bundles.json, excluding
 * full / universal-skills / organization-tier), this suite exercises the
 * same provenance / ownership / removal / start-resolution / lockfile-hygiene
 * contracts that plan 002 proved for software-engineering.  Coverage is
 * automatic: adding a domain or addon to bundles.json extends coverage.
 *
 * Essentials-only domains (no addons), get a lighter install-remove-start loop.
 *
 * All machinery is shared with plan 002 through tests/helpers/bundle-lifecycle.ts;
 * every expectation is derived from bundles.json — no bundle names are
 * hard-coded.
 *
 * @see plan 007 (advisor-plans/007-cross-domain-conformance.md)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { ClineLauncher } from '../src/core/cline-launcher.js';
import type { ClineCapabilityReport } from '../src/core/types.js';
import {
  createHarness, deriveDomains, deriveAddons, entry, sorted,
  collectEmptyDirs, findFile, ownersOf, readLock,
  canonicalOf, projectionsOf,
  type LockfileView, type BundleEntry, type BundleLifecycleHarness,
} from './helpers/bundle-lifecycle.js';

const ROOT = process.cwd();
const testWorkspace = path.resolve(ROOT, 'scratch/domain-conformance');
// When AGENTS_CI_FULL=1, run the complete A/B/C addon lifecycle for ALL
// addons across all domains.  In default (local) runs only the first
// (representative) addon in each domain gets the full matrix; this keeps
// local `npm test` fast enough to be useful as a pre-commit gate.
const CI_FULL = process.env.AGENTS_CI_FULL === '1';

const fakeProbeReport: ClineCapabilityReport = {
  installed: true,
  version: 'v3.0.55',
  namedTeams: true,
  rolePresetConsumer: 'unknown',
  command: { executable: 'cline', prefixArgs: [], source: 'path-executable' },
  diagnostics: [],
};

const DOMAINS = deriveDomains();

// Derivation sanity — fail fast if bundles.json is misconfigured, before
// any lifecycle operations run.
describe('007 — Cross-domain generalization of the lifecycle conformance suite', () => {
  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });
  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('derives the expected 7-domain essentials corpus', () => {
    const names = DOMAINS.map(d => d.essentials).sort();
    expect(names).toEqual([
      'business-strategy',
      'deep-research',
      'growth-marketing',
      'product-design',
      'security-operations',
      'software-engineering',
      'system-architecture',
    ]);
  });

  it('derives exactly 13 addons total across all domains', () => {
    const total = DOMAINS.reduce((s, d) => s + d.addons.length, 0);
    expect(total).toBe(13);
  });

  it('every addon referenced is present in bundles.json', () => {
    for (const dom of DOMAINS) {
      for (const addon of dom.addons) {
        expect(() => entry(addon)).not.toThrow();
      }
    }
  });

  // -----------------------------------------------------------------------
  // Essentials-only domains (no addons): install → remove → start rejects
  // -----------------------------------------------------------------------

  for (const dom of DOMAINS.filter(d => d.addons.length === 0)) {
    describe(`${dom.essentials} (essentials-only)`, () => {
      let h: BundleLifecycleHarness;

      beforeEach(() => {
        h = createHarness({ workspace: testWorkspace, essentials: dom.essentials });
      });

      it('installs and declares ownership', async () => {
        await h.installBundle(dom.essentials);
        const lock = await readLock(h.agentsDir);
        expect(lock.installed.bundles).toContain(dom.essentials);
        // At least one file record is owned by the essentials bundle.
        const owned = Object.entries(lock.files).filter(([, v]) =>
          ownersOf(v).includes(dom.essentials)
        );
        expect(owned.length).toBeGreaterThan(0);
      });

      it('removes cleanly and reaches terminal state', async () => {
        await h.installBundle(dom.essentials);
        await h.uninstallBundle(dom.essentials);
        await h.assertCleanTerminalState();
      });

      it('start rejects after removal', async () => {
        await h.installBundle(dom.essentials);
        await h.uninstallBundle(dom.essentials);
        const launcher = new ClineLauncher();
        await expect(
          launcher.resolveInstallation(dom.essentials, { cwd: testWorkspace })
        ).rejects.toThrow(/not installed in project scope/);
      });
    });
  }
  // -----------------------------------------------------------------------
  // Domains with addons: full A/B/C matrix per addon
  // -----------------------------------------------------------------------

  for (const dom of DOMAINS.filter(d => d.addons.length > 0)) {
    describe(`${dom.essentials} (${dom.addons.length} addons)`, () => {
      for (const addon of dom.addons) {
        const isRepresentative = addon === dom.addons[0];
        const runMatrix = CI_FULL || isRepresentative;

        describe(`${addon}${runMatrix ? '' : ' [rep; AGENTS_CI_FULL=1 for full mat]'}`, () => {
          let h: BundleLifecycleHarness;
          const itm = runMatrix ? it.bind(it) : it.skip.bind(it);

          beforeEach(() => {
            h = createHarness({ workspace: testWorkspace, essentials: dom.essentials });
          });

          // ---- A. Provenance & ownership ----

          itm('A1: essentials-only canonical records owned by essentials', async () => {
            await h.installBoth(addon, 'essentials-first');
            const lock = await readLock(h.agentsDir);
            h.assertEssentialsOnlyFiles(lock, addon);
          });

          itm('A2: shared canonical records owned by exactly both', async () => {
            await h.installBoth(addon, 'essentials-first');
            const lock = await readLock(h.agentsDir);
            const shared = h.canonicalShared(addon);
            const orch = entry(dom.essentials).orchestrator;
            if (orch) {
              expect(shared).toContain(`agents/${orch}`);
            }
            h.assertSharedFiles(lock, addon);
          });

          itm('A3: addon-only canonical records owned by addon', async () => {
            await h.installBoth(addon, 'essentials-first');
            const lock = await readLock(h.agentsDir);
            h.assertAddonOnlyFiles(lock, addon);
          });

          itm('A4: projections owners mirror canonical split', async () => {
            await h.installBoth(addon, 'essentials-first');
            const lock = await readLock(h.agentsDir);
            h.assertProjectionOwners(lock, addon);
          });

          itm('A5: first-install timestamps survive second install', async () => {
            await h.installBundle(dom.essentials);
            const shared = h.canonicalShared(addon);
            expect(shared.length).toBeGreaterThan(0);
            const lock1 = await readLock(h.agentsDir);
            const firstSeen = new Map<string, string | undefined>();
            for (const rel of shared) firstSeen.set(rel, findFile(lock1, rel)?.installedAt);
            const orchRel = entry(dom.essentials).orchestrator
              ? `agents/${entry(dom.essentials).orchestrator}` : null;
            if (orchRel && shared.includes(orchRel)) {
              expect(firstSeen.get(orchRel)).toBeDefined();
            }
            await h.installBundle(addon);
            const lock2 = await readLock(h.agentsDir);
            for (const rel of shared) {
              const rec = findFile(lock2, rel);
              expect(rec, `record for ${rel}`).toBeDefined();
              expect(rec?.installedAt).toBe(firstSeen.get(rel));
            }
          });

          itm('A6: ownership holds with reversed install order', async () => {
            await h.installBoth(addon, 'addon-first');
            const lock = await readLock(h.agentsDir);
            h.assertEssentialsOnlyFiles(lock, addon);
            h.assertSharedFiles(lock, addon);
            h.assertAddonOnlyFiles(lock, addon);
            h.assertProjectionOwners(lock, addon);
          });

          // ---- B. Removal matrix ----

          itm('B1: removing essentials first leaves addon assets alive', async () => {
            const addonEntry = entry(addon);
            await h.installBoth(addon, 'essentials-first');
            await h.uninstallBundle(dom.essentials);
            for (const rel of canonicalOf(addonEntry)) {
              expect(await fs.pathExists(path.join(h.agentsDir, rel))).toBe(true);
            }
            for (const rel of projectionsOf(addonEntry)) {
              expect(await fs.pathExists(path.join(testWorkspace, rel))).toBe(true);
            }
            for (const rel of h.canonicalEssentialsOnly(addon)) {
              expect(await fs.pathExists(path.join(h.agentsDir, rel))).toBe(false);
            }
            for (const rel of h.projEssentialsOnly(addon)) {
              expect(await fs.pathExists(path.join(testWorkspace, rel))).toBe(false);
            }
            expect(await fs.pathExists(path.join(testWorkspace, '.cline'))).toBe(true);
            expect(await collectEmptyDirs(path.join(testWorkspace, '.cline'))).toEqual([]);
          });

          itm('B2: essentials then addon — zero managed files', async () => {
            await h.installBoth(addon, 'essentials-first');
            await h.uninstallBundle(dom.essentials);
            await h.uninstallBundle(addon);
            await h.assertCleanTerminalState();
          });

          itm('B3: addon then essentials — same end state', async () => {
            await h.installBoth(addon, 'essentials-first');
            await h.uninstallBundle(addon);
            await h.uninstallBundle(dom.essentials);
            await h.assertCleanTerminalState();
          });

          itm('B4: zero-ownership removal rejects, lockfile unchanged', async () => {
            await h.installBoth(addon, 'essentials-first');
            const lockPath = path.join(h.agentsDir, 'agents-united.json');
            const lock = (await fs.readJson(lockPath)) as LockfileView;
            for (const [k, v] of Object.entries(lock.files)) {
              if ((v.owners ?? []).includes(addon)) delete lock.files[k];
            }
            if (lock.projections) {
              for (const [k, v] of Object.entries(lock.projections)) {
                if (v.owners.includes(addon)) delete lock.projections[k];
              }
            }
            await fs.writeJson(lockPath, lock, { spaces: 2 });
            const before = await fs.readFile(lockPath, 'utf8');
            await expect(h.uninstallBundle(addon)).rejects.toThrow();
            const after = await fs.readFile(lockPath, 'utf8');
            expect(after).toBe(before);
            const lockAfter = (await fs.readJson(lockPath)) as LockfileView;
            expect(lockAfter.installed.bundles).toContain(addon);
          });

          itm('B5: shared orchestrator stays on roster after essentials removal', async () => {
            const addonEntry = entry(addon);
            await h.installBoth(addon, 'essentials-first');
            await h.uninstallBundle(dom.essentials);
            const lock = await readLock(h.agentsDir);
            expect(lock.installed.bundles).toContain(addon);
            expect(lock.installed.bundles).not.toContain(dom.essentials);
            if (addonEntry.orchestrator) {
              expect(lock.installed.agents).toContain(addonEntry.orchestrator);
            }
          });

          // ---- C. Start resolution ----

          itm('C1: both bundles resolve and produce a dry activation plan', async () => {
            await h.installBoth(addon, 'essentials-first');
            const launcher = new ClineLauncher();

            const essentialsRes = await launcher.resolveInstallation(
              dom.essentials, { cwd: testWorkspace }
            );
            expect(essentialsRes.scope).toBe('project');
            expect(essentialsRes.manifestPath).toContain(`${dom.essentials}.yaml`);
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
          });

          itm('C2: addon resolves after essentials removal; essentials rejects', async () => {
            await h.installBoth(addon, 'essentials-first');
            await h.uninstallBundle(dom.essentials);
            const launcher = new ClineLauncher();
            const addonRes = await launcher.resolveInstallation(addon, { cwd: testWorkspace });
            expect(addonRes.manifestPath).toContain(`${addon}.yaml`);
            expect(await fs.pathExists(addonRes.manifestPath)).toBe(true);
            await expect(
              launcher.resolveInstallation(dom.essentials, { cwd: testWorkspace })
            ).rejects.toThrow(/not installed in project scope/);
          });
        });
      }
    });
  }
  // -----------------------------------------------------------------------
  // D. Lockfile hygiene per domain
  // -----------------------------------------------------------------------

  describe('D. Lockfile hygiene per domain', () => {
    for (const dom of DOMAINS) {
      const h = createHarness({ workspace: testWorkspace, essentials: dom.essentials });

      it(`D1.${dom.essentials}: every files and projections key is POSIX`, async () => {
        if (dom.addons.length > 0) {
          await h.installBoth(dom.addons[0], 'essentials-first');
        } else {
          await h.installBundle(dom.essentials);
        }
        const lock = await readLock(h.agentsDir);
        for (const k of Object.keys(lock.files)) {
          expect(k, `files key ${JSON.stringify(k)}`).not.toMatch(/\\/);
        }
        for (const k of Object.keys(lock.projections ?? {})) {
          expect(k, `projections key ${JSON.stringify(k)}`).not.toMatch(/\\/);
        }
      });

      it(`D2.${dom.essentials}: double-install of essentials is idempotent`, async () => {
        await h.installBundle(dom.essentials);
        const lockPath = path.join(h.agentsDir, 'agents-united.json');
        const firstRaw = await fs.readFile(lockPath, 'utf8');
        const first = JSON.parse(firstRaw) as LockfileView;

        await h.installBundle(dom.essentials);
        const secondRaw = await fs.readFile(lockPath, 'utf8');
        const second = JSON.parse(secondRaw) as LockfileView;

        expect(sorted(Object.keys(second.files))).toEqual(sorted(Object.keys(first.files)));
        for (const [k, rec] of Object.entries(first.files)) {
          const again = findFile(second, k.replace(/\\/g, '/'));
          expect(again, `record ${k} after reinstall`).toBeDefined();
          expect(ownersOf(again)).toEqual(ownersOf(rec));
          expect(again?.installedAt).toBe(rec.installedAt);
        }
        expect(JSON.parse(secondRaw)).toEqual(JSON.parse(firstRaw));
      });
    }
  });
});