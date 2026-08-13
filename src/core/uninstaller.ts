import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { TargetAdapter } from './adapter.js';
import type { UninstallOptions, LockfileManifest } from './types.js';

export class UninstallEngine {
  private registry: RegistryResolver;

  constructor(registry?: RegistryResolver) {
    this.registry = registry || new RegistryResolver();
  }

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public async uninstall(identifier: string, options: UninstallOptions = {}): Promise<{ removed: string[]; targetDir: string; dryRun: boolean }> {
    const scope = options.global ? 'global' : (options.scope || 'workspace');
    const targetDir = TargetAdapter.resolveTargetDir(scope, options.targetDir);
    const subPaths = TargetAdapter.getSubPaths(targetDir);

    if (!await fs.pathExists(subPaths.lockfile)) {
      throw new Error(`No agents-united.json lockfile found in ${targetDir}. Nothing to uninstall.`);
    }

    const lockfile: LockfileManifest = await fs.readJson(subPaths.lockfile);
    const resolved = await this.registry.resolve(identifier).catch(() => null);

    const removedFiles: string[] = [];

    // Bundle removal mode
    if (resolved && resolved.targetBundle) {
      const bundleName = resolved.targetBundle;
      if (!lockfile.installed.bundles.includes(bundleName)) {
        throw new Error(`Bundle "${bundleName}" is not currently installed.`);
      }

      if (options.dryRun) {
        return { removed: resolved.agents.concat(resolved.skills, resolved.workflows), targetDir, dryRun: true };
      }

      // Identify files belonging to this bundle in lockfile
      for (const [relPath, assetMeta] of Object.entries(lockfile.files)) {
        if (assetMeta.bundle === bundleName) {
          const fullPath = path.join(targetDir, relPath);
          if (await fs.pathExists(fullPath)) {
            if (!options.force) {
              const currentHash = await this.calculateHash(fullPath).catch(() => null);
              if (currentHash && currentHash !== assetMeta.hash) {
                throw new Error(`File ${relPath} has user modifications. Use --force to remove.`);
              }
            }

            await fs.remove(fullPath);
            removedFiles.push(relPath);
          }

          delete lockfile.files[relPath];
        }
      }

      // Update lockfile installed lists
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
      return { removed: removedFiles, targetDir, dryRun: false };
    }

    // Item removal mode
    const itemTargetRelPaths = Object.keys(lockfile.files).filter(p => p.includes(identifier));

    if (itemTargetRelPaths.length === 0) {
      throw new Error(`No installed assets found matching "${identifier}".`);
    }

    if (options.dryRun) {
      return { removed: itemTargetRelPaths, targetDir, dryRun: true };
    }

    for (const relPath of itemTargetRelPaths) {
      const fullPath = path.join(targetDir, relPath);
      if (await fs.pathExists(fullPath)) {
        if (!options.force) {
          const currentHash = await this.calculateHash(fullPath).catch(() => null);
          const assetMeta = lockfile.files[relPath];
          if (currentHash && assetMeta && currentHash !== assetMeta.hash) {
            throw new Error(`File ${relPath} has user modifications. Use --force to remove.`);
          }
        }
        await fs.remove(fullPath);
        removedFiles.push(relPath);
      }
      delete lockfile.files[relPath];
    }

    await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
    return { removed: removedFiles, targetDir, dryRun: false };
  }
}
