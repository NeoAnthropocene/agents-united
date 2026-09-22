import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { assetOwners, mergeAssetOwners } from '../src/core/types.js';

/**
 * Owner-reported lifecycle bug (2026-09-22): `agents remove domain:engineering` failed with
 * "No installed assets found matching" for assets plainly in the lockfile, and even a working remove
 * left residue ("Successfully removed 7 files" of 55). Root causes pinned here:
 *
 *  1. An unbundled install (`domain:*`, addons, unknown identifiers) has no bundle definition, so the
 *     Declared Asset Set gate stamped `owners: []` on every record it wrote.
 *  2. `owners ?? [bundle]` does not fall back for `owners: []` — `[]` is not nullish — so those
 *     records read as "owned by nobody".
 *  3. The fallback projection writer REPLACED owners instead of merging, dropping earlier owners of
 *     shared projections.
 *  4. Removal keyed off `installed.bundles` alone, so a lockfile that lost that roster entry could
 *     never reach its own assets again.
 */
describe('Ownership refcount — unbundled installs, legacy records and shared assets', () => {
  const ws = path.resolve(process.cwd(), 'scratch/test-ownership-refcount');
  const agentsDir = path.join(ws, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');

  afterEach(async () => {
    await fs.remove(ws);
  });

  it('T1: an unbundled install owns every asset it deploys (no owners: [] records)', async () => {
    const installer = new InstallEngine();
    await installer.install('domain:engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
    });

    const lockfile = await fs.readJson(lockPath);
    expect(Object.keys(lockfile.files).length).toBeGreaterThan(0);

    const unowned = Object.entries(lockfile.files)
      .filter(([, m]) => assetOwners(m as { owners?: string[]; bundle?: string }).length === 0)
      .map(([k]) => k);
    expect(unowned).toEqual([]);

    for (const [, m] of Object.entries(lockfile.files)) {
      expect(assetOwners(m as { owners?: string[]; bundle?: string })).toContain('domain:engineering');
    }
    for (const [, p] of Object.entries(lockfile.projections || {})) {
      expect((p as { owners?: string[] }).owners ?? []).toContain('domain:engineering');
    }
  });

  it('T2: shared assets refcount across installs — owners merge, never replace', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    await installer.install('digital-agency', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });

    const lockfile = await fs.readJson(lockPath);
    // `subagent-frontend-architect.md` is declared by BOTH bundles.
    const sharedFile = lockfile.files['agents/subagent-frontend-architect.md'];
    expect(assetOwners(sharedFile).sort()).toEqual(['digital-agency', 'software-engineering']);

    const sharedProj = lockfile.projections['.claude/agents/frontend-architect.md'];
    expect(assetOwners(sharedProj).sort()).toEqual(['digital-agency', 'software-engineering']);
  });

  it('T3: removing one owner keeps a shared asset for the other; removing the last deletes it', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    await installer.install('digital-agency', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });

    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('digital-agency', { targetDir: agentsDir });

    const sharedFile = path.join(agentsDir, 'agents', 'subagent-frontend-architect.md');
    const sharedProj = path.join(ws, '.claude', 'agents', 'frontend-architect.md');
    expect(await fs.pathExists(sharedFile)).toBe(true);
    expect(await fs.pathExists(sharedProj)).toBe(true);

    const mid = await fs.readJson(lockPath);
    expect(assetOwners(mid.files['agents/subagent-frontend-architect.md'])).toEqual(['software-engineering']);

    await uninstaller.uninstall('software-engineering', { targetDir: agentsDir });
    expect(await fs.pathExists(sharedFile)).toBe(false);
    expect(await fs.pathExists(sharedProj)).toBe(false);
  });

  it('T4: full removal of an unbundled install leaves zero residue', async () => {
    const installer = new InstallEngine();
    await installer.install('domain:engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
    });
    const before = await fs.readJson(lockPath);
    const recordCount = Object.keys(before.files).length + Object.keys(before.projections || {}).length;
    expect(recordCount).toBeGreaterThan(30);

    const uninstaller = new UninstallEngine();
    const result = await uninstaller.uninstall('domain:engineering', { targetDir: agentsDir });
    expect(result.removed.length).toBe(recordCount);

    const after = await fs.readJson(lockPath);
    expect(Object.keys(after.files)).toEqual([]);
    expect(Object.keys(after.projections || {})).toEqual([]);
    expect(after.installed.bundles).not.toContain('domain:engineering');

    // And nothing but the lockfile is left on disk.
    expect(await fs.pathExists(path.join(ws, '.claude'))).toBe(false);
    expect(await fs.pathExists(path.join(ws, '.cline'))).toBe(false);
    expect(await fs.pathExists(path.join(agentsDir, 'agents'))).toBe(false);
    expect(await fs.pathExists(path.join(agentsDir, 'rules'))).toBe(false);
  });

  it('T5: a legacy lockfile (owners: [], roster entry lost) is still removable — the reported error', async () => {
    // Re-create the owner-reported state exactly: records carry `bundle:` with `owners: []`, the
    // projections carry `owners: []`, and `installed.bundles` has already lost the entry.
    const installer = new InstallEngine();
    await installer.install('domain:engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude', 'cline'],
    });
    const seeded = await fs.readJson(lockPath);
    for (const m of Object.values(seeded.files) as Array<{ owners?: string[] }>) m.owners = [];
    for (const p of Object.values(seeded.projections || {}) as Array<{ owners?: string[] }>) p.owners = [];
    seeded.installed.bundles = seeded.installed.bundles.filter((b: string) => b !== 'domain:engineering');
    await fs.writeJson(lockPath, seeded, { spaces: 2 });

    const uninstaller = new UninstallEngine();
    // Pre-fix this threw: `No installed assets found matching "domain:engineering".`
    const result = await uninstaller.uninstall('domain:engineering', { targetDir: agentsDir });
    expect(result.removed.length).toBeGreaterThan(0);

    const after = await fs.readJson(lockPath);
    expect(Object.keys(after.files)).toEqual([]);
    expect(Object.keys(after.projections || {})).toEqual([]);
    expect(await fs.pathExists(path.join(ws, '.claude'))).toBe(false);
  });

  it('T6: unit semantics of the ownership helpers', () => {
    // Empty `owners` must fall back to the legacy `bundle` field — the `??` bug in one line.
    expect(assetOwners({ owners: [], bundle: 'x' })).toEqual(['x']);
    expect(assetOwners({ owners: ['a'], bundle: 'x' })).toEqual(['a']);
    expect(assetOwners({ bundle: 'x' })).toEqual(['x']);
    expect(assetOwners({ owners: [] })).toEqual([]);
    expect(assetOwners(undefined)).toEqual([]);

    // Merging unions and never duplicates.
    expect(mergeAssetOwners({ owners: [], bundle: 'a' }, 'b')).toEqual(['a', 'b']);
    expect(mergeAssetOwners({ owners: ['a'] }, 'b')).toEqual(['a', 'b']);
    expect(mergeAssetOwners({ owners: ['a'] }, 'a')).toEqual(['a']);
    expect(mergeAssetOwners(undefined, undefined)).toEqual([]);
  });
});