import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { isKnownHost } from './hosts.js';
import { HostProjector } from './projector.js';
import type { UninstallOptions, LockfileManifest, InstallScope, AgentHost } from './types.js';

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
              if (assetMeta.bundle === bundleName) {
                // Remove every recorded legacy projection BEFORE the canonical entry is
                // deleted from the lockfile (plan 007 M5). Managed marker verified
                // before deletion; user-modified projections require --force.
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
              }
            }

            lockfile.installed.bundles = lockfile.installed.bundles.filter(b => b !== bundleName);
            if (lockfile.bundleVersions) {
              delete lockfile.bundleVersions[bundleName];
            }
            if (resolved.agents) {
              lockfile.installed.agents = lockfile.installed.agents.filter(a => !resolved.agents.includes(a));
            }
            if (resolved.skills) {
              lockfile.installed.skills = lockfile.installed.skills.filter(s => !resolved.skills.includes(s));
            }
            if (resolved.workflows) {
              lockfile.installed.workflows = lockfile.installed.workflows.filter(w => !resolved.workflows.includes(w));
            }

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
