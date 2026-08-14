import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import type { UninstallOptions, LockfileManifest, InstallScope, AgentHost } from './types.js';

export class UninstallEngine {
  private registry: RegistryResolver;

  constructor(registry?: RegistryResolver) {
    this.registry = registry || new RegistryResolver();
  }

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private parseHosts(options: UninstallOptions): AgentHost[] {
    if (options.hosts && options.hosts.length > 0) return options.hosts;
    if (options.target) {
      const raw = Array.isArray(options.target) ? options.target.join(',') : options.target;
      const parsed = raw.split(',').map(s => s.trim().toLowerCase()) as AgentHost[];
      const valid = parsed.filter(h => ['agents', 'gemini', 'claude', 'cursor'].includes(h));
      if (valid.length > 0) return valid as AgentHost[];
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
            for (const [relPath, assetMeta] of Object.entries(lockfile.files)) {
              if (assetMeta.bundle === bundleName) {
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
