import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { InventoryScanner } from './inventory.js';
import { InstallEngine } from './installer.js';
import { HostProjector } from './projector.js';
import type {
  UpdateOptions,
  UpdateCheckReport,
  UpdateCheckItem,
  UpdateResult,
  InstalledPackageRecord,
  LockfileManifest,
  InventoryOptions,
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

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Determines whether a projected file still carries our managed marker (plan 007
   * M5). Agent projections place the marker as the first body line after frontmatter;
   * the AGENTS.md bridge has no frontmatter so it is checked over the whole content.
   */
  private async isManagedProjection(absPath: string, isAgentsMd: boolean): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    return HostProjector.hasManagedMarker(content);
  }

  /**
   * Returns the first user-modified projection path belonging to a record, or '' when
   * every recorded projection still carries the managed marker.
   */
  private async staleProjection(record: InstalledPackageRecord, lockfile: LockfileManifest): Promise<string> {
    let workspaceRoot = path.dirname(record.targetDir);
    for (const assetMeta of Object.values(lockfile.files)) {
      if (assetMeta.bundle !== record.name) continue;
      if (!assetMeta.projectedTo || assetMeta.projectedTo.length === 0) continue;
      for (const projPath of assetMeta.projectedTo) {
        const absProjection = path.join(workspaceRoot, projPath);
        if (await fs.pathExists(absProjection)) {
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md');
          if (!managed) {
            return projPath;
          }
        }
      }
    }
    return '';
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
      };
    }

    if (options.dryRun) {
      return {
        updated: recordsToUpdate,
        skipped: [],
        targetDirs: inventory.targetDirs,
        dryRun: true,
      };
    }

    const updated: InstalledPackageRecord[] = [];
    const skipped: Array<{ record: InstalledPackageRecord; reason: string }> = [];

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

      // Re-install with upstream version. Fan-out flows from --fanout if given,
      // otherwise the installer inherits the fanout recorded in the lockfile.
      await this.installer.install(record.name, {
        scope: record.scope,
        method: record.method,
        hosts: [record.host],
        targetDir: record.targetDir,
        fanout: options.fanout,
        force: true, // force overwrite since we passed collision check above
      });

      // Synchronize bundleVersion in lockfile
      if (await fs.pathExists(lockfilePath)) {
        const updatedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
        updatedLockfile.bundleVersions = updatedLockfile.bundleVersions || {};
        updatedLockfile.bundleVersions[record.name] = record.upstreamVersion;
        await fs.writeJson(lockfilePath, updatedLockfile, { spaces: 2 });
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
    };
  }
}
