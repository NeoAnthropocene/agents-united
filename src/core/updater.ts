import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { workspaceRootOf } from './state-dir.js';
import { RegistryResolver } from './registry.js';
import { InventoryScanner } from './inventory.js';
import { InstallEngine } from './installer.js';
import { HostProjector } from './projector.js';
import { ClaudeProjector } from './claude-projector.js';
import type {
  UpdateOptions,
  UpdateCheckReport,
  UpdateCheckItem,
  UpdateResult,
  InstalledPackageRecord,
  LockfileManifest,
  InventoryOptions,
  ProjectionInfo,
} from './types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]+?)\r?\n---/;

export class UpdateEngine {
  private registry: RegistryResolver;
  private scanner: InventoryScanner;
  private installer: InstallEngine;

  constructor(registry?: RegistryResolver, scanner?: InventoryScanner, installer?: InstallEngine) {
    this.registry = registry || new RegistryResolver();
    this.scanner = scanner || new InventoryScanner(this.registry);
    this.installer = installer || new InstallEngine(this.registry);
  }

  private deduplicateProjections(projections: ProjectionInfo[]): ProjectionInfo[] {
    const seen = new Set<string>();
    const deduplicated: ProjectionInfo[] = [];
    for (const p of projections) {
      const key = `${p.host}:${p.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(p);
      }
    }
    return deduplicated;
  }

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Determines whether a projected file still carries our managed marker (plan 007
   * M5). Agent projections place the marker as the first body line after frontmatter;
   * the AGENTS.md bridge has no frontmatter so it is checked over the whole content.
   */
  private async isManagedProjection(absPath: string, isAgentsMd: boolean, recordedHash?: string): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    if (HostProjector.hasManagedMarker(content)) return true;
    // ADR 0017 amendment (Gate 7, 2026-09-25): markerless sidecar artifacts (LICENSE.txt,
    // references/**) cannot carry the marker — they are managed iff their bytes still hash
    // to the value recorded at install time.
    if (recordedHash) {
      const bytes = await fs.readFile(absPath);
      return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` === recordedHash;
    }
    return false;
  }

  /**
   * Returns the first user-modified projection path belonging to a record, or '' when
   * every recorded projection still carries the managed marker.
   */
  private async staleProjection(record: InstalledPackageRecord, lockfile: LockfileManifest): Promise<string> {
    const workspaceRoot = workspaceRootOf(record.targetDir);
    for (const assetMeta of Object.values(lockfile.files)) {
      if (assetMeta.bundle !== record.name) continue;
      if (!assetMeta.projectedTo || assetMeta.projectedTo.length === 0) continue;
      for (const projPath of assetMeta.projectedTo) {
        const absProjection = path.join(workspaceRoot, projPath);
        if (await fs.pathExists(absProjection)) {
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md', lockfile.projections?.[projPath]?.hash);
          if (!managed) {
            return projPath;
          }
        }
      }
    }
    return '';
  }

  /** Plan 016 Step 4 — the canonical asset whose dialect name changed (ADR 0016 pattern). */
  private static readonly LEGACY_GENERATIVE_UI_CANONICAL = 'skills/generative_ui/SKILL.md';
  private static readonly LEGACY_GENERATIVE_UI_PATH = /(^|\/)generative_ui\/SKILL\.md$/;

  /** Removes empty projection dirs left behind by the migration (never a non-empty one). */
  private async removeEmptyProjectionDirs(workspaceRoot: string, projPath: string): Promise<void> {
    let dir = path.dirname(path.join(workspaceRoot, projPath));
    while (dir !== workspaceRoot && dir.startsWith(workspaceRoot)) {
      try {
        const entries = await fs.readdir(dir);
        if (entries.length > 0) break;
        await fs.rmdir(dir);
      } catch {
        break;
      }
      dir = path.dirname(dir);
    }
  }

  /** Drops one projected path from every canonical file record (host-agnostic). */
  private dropProjectedTo(lockfile: LockfileManifest, projectedRelPath: string): void {
    const normProj = projectedRelPath.replace(/\\/g, '/');
    for (const asset of Object.values(lockfile.files)) {
      if (!asset.projectedTo || asset.projectedTo.length === 0) continue;
      const kept = asset.projectedTo.filter(p => p !== normProj);
      if (kept.length === asset.projectedTo.length) continue;
      if (kept.length === 0) {
        delete asset.projectedTo;
      } else {
        asset.projectedTo = kept;
      }
    }
  }

  /**
   * Plan 016 Step 4 — silent, bounded, idempotent migration of the `generative_ui`
   * projection rename (ADR 0016 pattern).
   *
   * `registry/skills/generative_ui/` is deliberately NOT renamed: the underscore is
   * invalid in every host dialect, so the projectors normalize the name at projection
   * time (`generative_ui` -> `generative-ui`; ADR 0018 decision 2 — normalization is
   * projection-level). Projections recorded before that change therefore still point at
   * `.claude/skills/generative_ui/SKILL.md` and/or the Cline plugin copy
   * `.agents/plugins/<bundle>/skills/generative_ui/SKILL.md`, which the current renderers
   * no longer produce.
   *
   * Runs before each record's re-install so the freshly rendered normalized path is
   * registered by the normal install path. Guarantees: (a) a file that lacks the managed
   * marker is never deleted (its lockfile entries are left untouched too, so the
   * migration never lies about a file it did not remove); (b) a second run is a no-op
   * because the entries are gone; (c) it is host-agnostic, so it covers `.claude/**` and
   * the Cline plugin lane alike, and it never touches the canonical registry store.
   */
  private async migrateLegacyGenerativeUiProjections(
    workspaceRoot: string,
    lockfile: LockfileManifest
  ): Promise<string[]> {
    const projections = lockfile.projections;
    if (!projections) return [];

    const normalized = ClaudeProjector.normalizeSkillName('generative_ui');
    const removed: string[] = [];

    for (const [projRelPath, proj] of Object.entries(projections)) {
      const posixPath = projRelPath.replace(/\\/g, '/');
      const isLegacy = proj.canonical === UpdateEngine.LEGACY_GENERATIVE_UI_CANONICAL
        || UpdateEngine.LEGACY_GENERATIVE_UI_PATH.test(posixPath);
      if (!isLegacy) continue;
      // Already the normalized path (a re-projection landed first): nothing to migrate.
      if (posixPath.includes(`/${normalized}/`)) continue;

      const absProjection = path.join(workspaceRoot, projRelPath);
      if (await fs.pathExists(absProjection)) {
        const managed = await this.isManagedProjection(absProjection, posixPath === 'AGENTS.md');
        if (!managed) continue; // (a) never clobber a foreign or user-modified file
        await fs.remove(absProjection);
        await this.removeEmptyProjectionDirs(workspaceRoot, projRelPath);
      }

      delete projections[projRelPath];
      this.dropProjectedTo(lockfile, projRelPath);
      removed.push(projRelPath);
    }

    return removed;
  }

  public async checkUpdates(options: InventoryOptions = {}): Promise<UpdateCheckReport> {
    const inventory = await this.scanner.scan(options);
    const items: UpdateCheckItem[] = [];

    for (const record of inventory.records) {
      const hasUpdate = record.driftStatus === 'outdated' || record.installedVersion !== record.upstreamVersion;
      items.push({
        record,
        hasUpdate,
        installedVersion: record.installedVersion,
        upstreamVersion: record.upstreamVersion,
        reason: hasUpdate
          ? `Upstream version (${record.upstreamVersion}) is newer than installed version (${record.installedVersion})`
          : undefined,
      });
    }

    const outdatedCount = items.filter(i => i.hasUpdate).length;
    const upToDateCount = items.filter(i => !i.hasUpdate).length;

    return {
      items,
      outdatedCount,
      upToDateCount,
      totalCount: items.length,
      scannedScopes: inventory.scannedScopes,
      scannedLocations: inventory.scannedLocations,
    };
  }

  public async update(
    targets: string | string[] | '__all__',
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const inventory = await this.scanner.scan({
      scope: options.scope,
      global: options.global,
      hosts: options.hosts,
      target: options.target,
      targetDir: options.targetDir,
      cwd: options.cwd,
    });

    const isAll = targets === '__all__' || targets === '*' || (Array.isArray(targets) && targets.includes('__all__'));
    const targetList = Array.isArray(targets) ? targets : [targets];

    const recordsToUpdate: InstalledPackageRecord[] = inventory.records.filter(r => {
      if (isAll) return true;
      return targetList.includes(r.name) || targetList.includes(r.id);
    });

    if (recordsToUpdate.length === 0) {
      return {
        updated: [],
        skipped: [],
        targetDirs: inventory.targetDirs,
        dryRun: options.dryRun || false,
        projections: [],
      };
    }

    if (options.dryRun) {
      const dryProjections: ProjectionInfo[] = [];
      for (const record of recordsToUpdate) {
        const lockfilePath = path.join(record.targetDir, 'agents-united.json');
        if (await fs.pathExists(lockfilePath)) {
          const dryResult = await this.installer.install(record.name, {
            scope: record.scope,
            method: record.method,
            hosts: [record.host],
            targetDir: record.targetDir,
            fanout: options.fanout,
            dryRun: true,
          });
          if (dryResult.projections) {
            dryProjections.push(...dryResult.projections);
          }
        }
      }
      return {
        updated: recordsToUpdate,
        skipped: [],
        targetDirs: inventory.targetDirs,
        dryRun: true,
        projections: this.deduplicateProjections(dryProjections),
      };
    }


    const updated: InstalledPackageRecord[] = [];
    const skipped: Array<{ record: InstalledPackageRecord; reason: string }> = [];
    const collectedProjections: ProjectionInfo[] = [];

    for (const record of recordsToUpdate) {
      const lockfilePath = path.join(record.targetDir, 'agents-united.json');
      if (!await fs.pathExists(lockfilePath)) {
        continue;
      }

      const lockfile: LockfileManifest = await fs.readJson(lockfilePath);

      // Check for user modifications in copy mode
      if (record.method === 'copy' && !options.force && lockfile.files) {
        let hasConflict = false;
        let conflictRelPath = '';

        for (const [relPath, assetMeta] of Object.entries(lockfile.files)) {
          if (assetMeta.bundle === record.name || relPath.includes(record.name)) {
            const fullPath = path.join(record.targetDir, relPath);
            if (await fs.pathExists(fullPath)) {
              const currentHash = await this.calculateHash(fullPath).catch(() => null);
              if (currentHash && currentHash !== assetMeta.hash) {
                hasConflict = true;
                conflictRelPath = relPath;
                break;
              }
            }
          }
        }

        if (hasConflict) {
          skipped.push({
            record,
            reason: `User modifications detected in ${conflictRelPath}. Use --force to overwrite.`,
          });
          continue;
        }
      }

      // Projection-aware guard (plan 007 M5): a stale projection whose managed
      // marker was manually removed counts as user-modified and is never clobbered
      // without --force — it lands in `skipped`.
      if (!options.force && lockfile.files) {
        const stale = await this.staleProjection(record, lockfile);
        if (stale) {
          skipped.push({
            record,
            reason: `User modifications detected in projection ${stale}. Use --force to overwrite.`,
          });
          continue;
        }
      }

      // Plan 016 Step 4 (ADR 0016 pattern) — silent migration of the legacy
      // `generative_ui` projection path before re-installation registers the
      // normalized one. Deliberately implemented on UpdateEngine rather than
      // InstallEngine: it is an update-path reconciliation (`agents update` is the
      // documented remediation for it) and it leaves fresh installs untouched, since
      // a fresh install can never have recorded the legacy path.
      const migratedGenerativeUi = await this.migrateLegacyGenerativeUiProjections(
        workspaceRootOf(record.targetDir),
        lockfile
      );
      if (migratedGenerativeUi.length > 0) {
        await fs.writeJson(lockfilePath, lockfile, { spaces: 2 });
      }

      // Re-install with upstream version. Fan-out flows from --fanout if given,
      // otherwise the installer inherits the fanout recorded in the lockfile.
      const installResult = await this.installer.install(record.name, {
        scope: record.scope,
        method: record.method,
        hosts: [record.host],
        targetDir: record.targetDir,
        fanout: options.fanout,
        force: true, // force overwrite since we passed collision check above
      });

      if (installResult.projections) {
        collectedProjections.push(...installResult.projections);
      }

      // Synchronize bundleVersion in lockfile
      if (await fs.pathExists(lockfilePath)) {
        const updatedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
        updatedLockfile.bundleVersions = updatedLockfile.bundleVersions || {};
        updatedLockfile.bundleVersions[record.name] = record.upstreamVersion;
        await fs.writeJson(lockfilePath, updatedLockfile, { spaces: 2 });
        if (updatedLockfile.fanout) {
          record.fanout = updatedLockfile.fanout;
          record.projections = updatedLockfile.fanout;
          record.displayLocation = InventoryScanner.formatDisplayLocation(
            record.scope,
            record.host,
            record.targetDir,
            updatedLockfile.fanout
          );
        }
      }

      record.installedVersion = record.upstreamVersion;
      record.driftStatus = 'up-to-date';
      updated.push(record);
    }

    return {
      updated,
      skipped,
      targetDirs: inventory.targetDirs,
      dryRun: false,
      projections: this.deduplicateProjections(collectedProjections),
    };

  }
}
