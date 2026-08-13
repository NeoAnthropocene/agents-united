import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { TargetAdapter } from './adapter.js';
import type { InstallOptions, LockfileManifest, ResolvedAssets } from './types.js';

export class InstallEngine {
  private registry: RegistryResolver;

  constructor(registry?: RegistryResolver) {
    this.registry = registry || new RegistryResolver();
  }

  private async calculateHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async readLockfile(lockfilePath: string): Promise<LockfileManifest> {
    if (await fs.pathExists(lockfilePath)) {
      try {
        return await fs.readJson(lockfilePath);
      } catch {
        // Fallback to empty manifest on corrupt file
      }
    }

    return {
      $schema: 'https://agents-united.dev/schema/lockfile.v1.json',
      version: 1,
      installed: {
        bundles: [],
        agents: [],
        skills: [],
        workflows: [],
      },
      files: {},
    };
  }

  public async install(identifier: string, options: InstallOptions = {}): Promise<{ installed: ResolvedAssets; targetDir: string; dryRun: boolean }> {
    const scope = options.global ? 'global' : (options.scope || 'workspace');
    const targetDir = TargetAdapter.resolveTargetDir(scope, options.targetDir);
    const subPaths = TargetAdapter.getSubPaths(targetDir);

    const resolved = await this.registry.resolve(identifier);
    const registryDir = this.registry.getRegistryDir();

    if (options.dryRun) {
      return { installed: resolved, targetDir, dryRun: true };
    }

    await fs.ensureDir(subPaths.agentsDir);
    await fs.ensureDir(subPaths.skillsDir);
    await fs.ensureDir(subPaths.workflowsDir);
    await fs.ensureDir(subPaths.rulesDir);

    const lockfile = await this.readLockfile(subPaths.lockfile);
    const now = new Date().toISOString();

    // Copy Agents
    for (const agentFile of resolved.agents) {
      const src = path.join(registryDir, 'agents', agentFile);
      const dest = path.join(subPaths.agentsDir, agentFile);

      if (await fs.pathExists(dest) && !options.force) {
        const existingHash = await this.calculateHash(dest);
        const relPath = path.relative(targetDir, dest);
        if (lockfile.files[relPath] && lockfile.files[relPath].hash !== existingHash) {
          throw new Error(`File ${relPath} has user modifications. Use --force to overwrite.`);
        }
      }

      await fs.copy(src, dest, { overwrite: true });
      const hash = await this.calculateHash(dest);
      const relPath = path.relative(targetDir, dest);
      lockfile.files[relPath] = {
        hash,
        bundle: resolved.targetBundle,
        installedAt: now,
      };

      if (!lockfile.installed.agents.includes(agentFile)) {
        lockfile.installed.agents.push(agentFile);
      }
    }

    // Copy Skills
    for (const skillName of resolved.skills) {
      const src = path.join(registryDir, 'skills', skillName);
      const dest = path.join(subPaths.skillsDir, skillName);

      if (await fs.pathExists(dest) && !options.force) {
        // Skip directory hash check if forced
      }

      await fs.copy(src, dest, { overwrite: true });
      const skillFile = path.join(dest, 'SKILL.md');
      if (await fs.pathExists(skillFile)) {
        const hash = await this.calculateHash(skillFile);
        const relPath = path.relative(targetDir, skillFile);
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          installedAt: now,
        };
      }

      if (!lockfile.installed.skills.includes(skillName)) {
        lockfile.installed.skills.push(skillName);
      }
    }

    // Copy Workflows
    for (const workflowFile of resolved.workflows) {
      const src = path.join(registryDir, 'workflows', workflowFile);
      const dest = path.join(subPaths.workflowsDir, workflowFile);

      await fs.copy(src, dest, { overwrite: true });
      const hash = await this.calculateHash(dest);
      const relPath = path.relative(targetDir, dest);
      lockfile.files[relPath] = {
        hash,
        bundle: resolved.targetBundle,
        installedAt: now,
      };

      if (!lockfile.installed.workflows.includes(workflowFile)) {
        lockfile.installed.workflows.push(workflowFile);
      }
    }

    // Copy Rules
    for (const ruleFile of resolved.rules) {
      const src = path.join(registryDir, 'rules', ruleFile);
      const dest = path.join(subPaths.rulesDir, ruleFile);

      if (await fs.pathExists(src)) {
        await fs.copy(src, dest, { overwrite: true });
        const hash = await this.calculateHash(dest);
        const relPath = path.relative(targetDir, dest);
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          installedAt: now,
        };
      }
    }

    // Update Lockfile Bundles
    if (resolved.targetBundle && !lockfile.installed.bundles.includes(resolved.targetBundle)) {
      lockfile.installed.bundles.push(resolved.targetBundle);
    }

    await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });

    return { installed: resolved, targetDir, dryRun: false };
  }
}
