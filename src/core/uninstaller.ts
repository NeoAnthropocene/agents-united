import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { isKnownHost } from './hosts.js';
import { HostProjector } from './projector.js';
import { ClineProjector } from './cline-projector.js';
import type { UninstallOptions, LockfileManifest, InstallScope, AgentHost, BundleDefinition } from './types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]+?)\r?\n---/;

export class UninstallEngine {
  private registry: RegistryResolver;

  constructor(registry?: RegistryResolver) {
    this.registry = registry || new RegistryResolver();
  }

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Determines whether a projected file still carries our managed marker. Agent
   * projections have YAML frontmatter with the marker as the first body line; the
   * AGENTS.md bridge (agentsmd profile) is a plain markdown index with no
   * frontmatter, so the marker is checked against the whole content.
   */
  private async isManagedProjection(absPath: string, isAgentsMd: boolean): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    return HostProjector.hasManagedMarker(content);
  }

  /**
   * Removes empty projection dirs left behind after deleting a projected file
   * (e.g. `.claude/agents/` and then `.claude/`). Only ever removes empty dirs.
   */
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

  /**
   * Removes every recorded projection for a canonical asset, guarding against
   * clobbering user-modified files. Mirrors the hash-conflict error pattern.
   */
  private async removeProjections(workspaceRoot: string, projectedTo: string[], force?: boolean): Promise<void> {
    for (const projPath of projectedTo) {
      const absProjection = path.join(workspaceRoot, projPath);
      if (!await fs.pathExists(absProjection)) {
        continue;
      }

      const isAgentsMd = projPath === 'AGENTS.md';
      const managed = await this.isManagedProjection(absProjection, isAgentsMd);
      if (!managed && !force) {
        throw new Error(
          `Projection ${projPath} has user modifications. Use --force to remove.`
        );
      }

      await this.safeRemoveProjection(absProjection);
      await this.removeEmptyProjectionDirs(workspaceRoot, projPath);
    }
  }

  private async safeRemoveProjection(absPath: string): Promise<void> {
    try {
      const lstat = await fs.lstat(absPath);
      if (lstat.isSymbolicLink()) {
        await fs.unlink(absPath);
        return;
      }
    } catch {
      // not a symlink
    }
    await fs.remove(absPath);
  }

  /**
   * Installed-addon freshness (plan 003): after a child bundle (one with a
   * `parentBundle`) is removed, re-render the parent's coordinator rule + team
   * manifest excluding every remaining installed bundle in the lockfile, so the
   * removed addon returns to the parent's recommendedAddons. Presentation-free:
   * the two projection files carry the managed marker trustees inside (rule) and
   * are overwritten directly via fs-extra. If a parent artifact does not exist in
   * the workspace (parent not installed as its own bundle), it is skipped.
   */
  private async refreshParentCoordination(
    bundleName: string,
    workspaceRoot: string,
    lockfile: LockfileManifest,
    scope: InstallScope
  ): Promise<void> {
    const bundleDef: BundleDefinition | null = await this.registry.getBundle(bundleName);
    if (!bundleDef?.parentBundle) return;
    const parentDef = await this.registry.getBundle(bundleDef.parentBundle);
    if (!parentDef) return;
    const parentResolved = await this.registry.resolve(parentDef.name).catch(() => null);
    if (!parentResolved) return;

    const registryDir = this.registry.getRegistryDir();
    const projection = await ClineProjector.planCompoundProjection(
      parentDef,
      scope,
      parentResolved,
      registryDir,
      lockfile.installed.bundles
    );

    for (const artifact of projection) {
      if (artifact.kind !== 'rule' && artifact.kind !== 'team-manifest') continue;
      if (artifact.content === undefined) continue;
      const dest = path.join(workspaceRoot, artifact.relPath);
      if (!await fs.pathExists(dest)) continue; // parent not installed as its own bundle
      await fs.writeFile(dest, artifact.content, 'utf8');
      const hash = await this.calculateHash(dest);
      if (lockfile.projections?.[artifact.relPath]) {
        lockfile.projections[artifact.relPath].hash = hash;
      }
    }
  }

  private parseHosts(options: UninstallOptions): AgentHost[] {
    if (options.hosts && options.hosts.length > 0) return options.hosts;
    if (options.target) {
      const raw = Array.isArray(options.target) ? options.target.join(',') : options.target;
      const parsed = raw.split(',').map(s => s.trim().toLowerCase()) as AgentHost[];
      const valid = parsed.filter(isKnownHost);
      if (valid.length > 0) return valid;
    }
    return ['agents'];
  }

  private parseScope(options: UninstallOptions): InstallScope {
    if (options.global) return 'global';
    return options.scope || 'project';
  }

  private async safeRemove(targetDir: string, relPath: string): Promise<void> {
    const fullPath = path.join(targetDir, relPath);

    // If relPath is inside skills, check if skill directory itself is a symlink/junction
    if (relPath.startsWith('skills' + path.sep) || relPath.startsWith('skills/')) {
      const parts = relPath.split(/[/\\]/);
      if (parts.length >= 2) {
        const skillDir = path.join(targetDir, parts[0], parts[1]);
        try {
          const lstat = await fs.lstat(skillDir);
          if (lstat.isSymbolicLink()) {
            await fs.unlink(skillDir);
            return;
          }
        } catch {
          // not a symlink directory
        }
      }
    }

    try {
      const lstat = await fs.lstat(fullPath);
      if (lstat.isSymbolicLink()) {
        await fs.unlink(fullPath);
        return;
      }
    } catch {
      // not a symlink
    }

    await fs.remove(fullPath);
  }

  public async uninstall(identifier: string, options: UninstallOptions = {}): Promise<{ removed: string[]; targetDirs: string[]; dryRun: boolean }> {
    const scope = this.parseScope(options);
    const hosts = this.parseHosts(options);

    const targetDirs: string[] = hosts.map(h => AgentHostAdapter.resolveHostDir(scope, h, options.targetDir));
    const resolved = await this.registry.resolve(identifier).catch(() => null);

    const totalRemoved: string[] = [];

    for (const targetDir of targetDirs) {
      const subPaths = AgentHostAdapter.getSubPaths(targetDir);

      if (!await fs.pathExists(subPaths.lockfile)) {
        continue;
      }

      const lockfile: LockfileManifest = await fs.readJson(subPaths.lockfile);
      const removedFiles: string[] = [];

      // Bundle removal mode
      if (resolved && resolved.targetBundle) {
        const bundleName = resolved.targetBundle;
        if (lockfile.installed.bundles.includes(bundleName)) {
          if (!options.dryRun) {
            const workspaceRoot = path.resolve(path.dirname(targetDir));

            // Transactional validation BEFORE any write: if this bundle owns zero file
            // records and zero projections, reject without mutating the lockfile.
            const ownedFiles = Object.entries(lockfile.files)
              .filter(([, m]) => (m.owners ?? (m.bundle ? [m.bundle] : [])).includes(bundleName));
            const ownedProjections = lockfile.projections
              ? Object.values(lockfile.projections).filter(p => p.owners.includes(bundleName)).length
              : 0;
            if (ownedFiles.length === 0 && ownedProjections === 0) {
              throw new Error(`No installed assets found matching "${bundleName}".`);
            }

            // Clean up compound projections using owner refcounting
            if (lockfile.projections) {
              for (const [projRelPath, proj] of Object.entries(lockfile.projections)) {
                if (proj.owners.includes(bundleName)) {
                  proj.owners = proj.owners.filter(o => o !== bundleName);
                  if (proj.owners.length === 0) {
                    const absProjection = path.join(workspaceRoot, projRelPath);
                    if (await fs.pathExists(absProjection)) {
                      if (proj.managedMarker) {
                        const managed = await this.isManagedProjection(absProjection, projRelPath === 'AGENTS.md');
                        if (!managed && !options.force) {
                          throw new Error(`Projection ${projRelPath} has user modifications. Use --force to remove.`);
                        }
                      } else {
                        const currentHash = await this.calculateHash(absProjection).catch(() => null);
                        if (currentHash && currentHash !== proj.hash && !options.force) {
                          throw new Error(`Projection ${projRelPath} has user modifications. Use --force to remove.`);
                        }
                      }
                      await this.safeRemoveProjection(absProjection);
                      await this.removeEmptyProjectionDirs(workspaceRoot, projRelPath);
                    }
                    delete lockfile.projections[projRelPath];
                  }
                }
              }
            }

            for (const [relPath, assetMeta] of Object.entries(lockfile.files)) {
              const assetOwners = assetMeta.owners ?? (assetMeta.bundle ? [assetMeta.bundle] : []);
              if (!assetOwners.includes(bundleName)) continue;

              const newOwners = assetOwners.filter(o => o !== bundleName);
              if (newOwners.length === 0) {
                // Last owner removed: drop the recorded projections, then the canonical file.
                if (assetMeta.projectedTo && assetMeta.projectedTo.length > 0) {
                  await this.removeProjections(workspaceRoot, assetMeta.projectedTo, options.force);
                }

                const fullPath = path.join(targetDir, relPath);
                if (await fs.pathExists(fullPath) || await fs.pathExists(fullPath).catch(() => false)) {
                  if (!options.force && assetMeta.method !== 'symlink') {
                    const currentHash = await this.calculateHash(fullPath).catch(() => null);
                    if (currentHash && currentHash !== assetMeta.hash) {
                      throw new Error(`File ${relPath} has user modifications. Use --force to remove.`);
                    }
                  }

                  await this.safeRemove(targetDir, relPath);
                  removedFiles.push(relPath);
                }

                delete lockfile.files[relPath];
              } else {
                // A surviving bundle still owns this file: keep it on disk, shrink owners.
                lockfile.files[relPath] = { ...assetMeta, owners: newOwners };
              }
            }

            lockfile.installed.bundles = lockfile.installed.bundles.filter(b => b !== bundleName);
            if (lockfile.bundleVersions) {
              delete lockfile.bundleVersions[bundleName];
            }
            // Survival set: only entries still declared by a surviving bundle stay on the
            // roster (declared asset sets, not the removed bundle's resolved superset).
            const surviving = lockfile.installed.bundles.filter(b => b !== bundleName);
            const survival = new Set<string>();
            for (const b of surviving) {
              const bdef = await this.registry.getBundle(b);
              if (!bdef) continue;
              if (bdef.orchestrator) survival.add(`agents/${bdef.orchestrator}`);
              (bdef.agents || []).forEach(a => survival.add(`agents/${a}`));
              (bdef.skills || []).forEach(s => survival.add(`skills/${s}/SKILL.md`));
              (bdef.workflows || []).forEach(w => survival.add(`workflows/${w}`));
            }
            lockfile.installed.agents = lockfile.installed.agents.filter(a => survival.has(`agents/${a}`));
            lockfile.installed.skills = lockfile.installed.skills.filter(s => survival.has(`skills/${s}/SKILL.md`));
            lockfile.installed.workflows = lockfile.installed.workflows.filter(w => survival.has(`workflows/${w}`));

            // Installed-addon freshness (plan 003): a removed child bundle restores
            // its addon into the parent's recommendedAddons via a re-render here.
            await this.refreshParentCoordination(bundleName, workspaceRoot, lockfile, scope);

            await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
          } else {
            removedFiles.push(...resolved.agents, ...resolved.skills, ...resolved.workflows);
          }
        }
      } else {
        // Item removal mode
        const itemTargetRelPaths = Object.keys(lockfile.files).filter(p => p.includes(identifier));

        if (!options.dryRun) {
          for (const relPath of itemTargetRelPaths) {
            const fullPath = path.join(targetDir, relPath);
            if (await fs.pathExists(fullPath) || await fs.pathExists(fullPath).catch(() => false)) {
              if (!options.force && lockfile.files[relPath]?.method !== 'symlink') {
                const currentHash = await this.calculateHash(fullPath).catch(() => null);
                const assetMeta = lockfile.files[relPath];
                if (currentHash && assetMeta && currentHash !== assetMeta.hash) {
                  throw new Error(`File ${relPath} has user modifications. Use --force to remove.`);
                }
              }
              await this.safeRemove(targetDir, relPath);
              removedFiles.push(relPath);
            }
            delete lockfile.files[relPath];
          }

          await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
        } else {
          removedFiles.push(...itemTargetRelPaths);
        }
      }

      totalRemoved.push(...removedFiles);
    }

    if (totalRemoved.length === 0 && !options.dryRun) {
      throw new Error(`No installed assets found matching "${identifier}".`);
    }

    return { removed: totalRemoved, targetDirs, dryRun: options.dryRun || false };
  }
}
