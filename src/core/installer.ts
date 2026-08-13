import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import type { InstallOptions, LockfileManifest, ResolvedAssets, InstallScope, InstallMethod, AgentHost } from './types.js';

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

  private parseHosts(options: InstallOptions): AgentHost[] {
    if (options.hosts && options.hosts.length > 0) {
      return options.hosts;
    }

    if (options.target) {
      const raw = Array.isArray(options.target) ? options.target.join(',') : options.target;
      const parsed = raw.split(',').map(s => s.trim().toLowerCase()) as AgentHost[];
      const valid: AgentHost[] = [];
      for (const h of parsed) {
        if (['agents', 'gemini', 'claude', 'cursor'].includes(h)) {
          valid.push(h as AgentHost);
        }
      }
      if (valid.length > 0) return valid;
    }

    return ['agents'];
  }

  private parseMethod(options: InstallOptions): InstallMethod {
    if (options.copy) return 'copy';
    if (options.symlink || options.method === 'symlink') return 'symlink';
    return options.method || 'symlink';
  }

  private parseScope(options: InstallOptions): InstallScope {
    if (options.global) return 'global';
    return options.scope || 'project';
  }

  private async deployFile(src: string, dest: string, method: InstallMethod, force?: boolean): Promise<'symlink' | 'copy'> {
    await fs.ensureDir(path.dirname(dest));

    if (await fs.pathExists(dest) || await fs.pathExists(dest).catch(() => false)) {
      if (force) {
        await fs.remove(dest);
      }
    }

    if (method === 'symlink') {
      try {
        const stat = await fs.stat(src);
        const type = stat.isDirectory() ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file';
        await fs.ensureSymlink(src, dest, type);
        return 'symlink';
      } catch {
        // Fallback to copy if OS restricts symlinks
        await fs.copy(src, dest, { overwrite: true });
        return 'copy';
      }
    }

    await fs.copy(src, dest, { overwrite: true });
    return 'copy';
  }

  public async install(identifier: string, options: InstallOptions = {}): Promise<{ installed: ResolvedAssets; targetDirs: string[]; dryRun: boolean; method: InstallMethod }> {
    const scope = this.parseScope(options);
    const method = this.parseMethod(options);
    const hosts = this.parseHosts(options);

    const resolved = await this.registry.resolve(identifier);
    const registryDir = this.registry.getRegistryDir();

    const targetDirs: string[] = hosts.map(h => AgentHostAdapter.resolveHostDir(scope, h, options.targetDir));

    if (options.dryRun) {
      return { installed: resolved, targetDirs, dryRun: true, method };
    }

    const now = new Date().toISOString();

    for (const targetDir of targetDirs) {
      const subPaths = AgentHostAdapter.getSubPaths(targetDir);

      await fs.ensureDir(subPaths.agentsDir);
      await fs.ensureDir(subPaths.skillsDir);
      await fs.ensureDir(subPaths.workflowsDir);
      await fs.ensureDir(subPaths.rulesDir);

      const lockfile = await this.readLockfile(subPaths.lockfile);
      lockfile.scope = scope;
      lockfile.method = method;
      lockfile.hosts = hosts;

      // Copy/Symlink Agents
      for (const agentFile of resolved.agents) {
        const src = path.join(registryDir, 'agents', agentFile);
        const dest = path.join(subPaths.agentsDir, agentFile);

        if (await fs.pathExists(dest) && !options.force && method !== 'symlink') {
          const existingHash = await this.calculateHash(dest).catch(() => null);
          const relPath = path.relative(targetDir, dest);
          if (existingHash && lockfile.files[relPath] && lockfile.files[relPath].hash !== existingHash) {
            throw new Error(`File ${relPath} has user modifications. Use --force to overwrite.`);
          }
        }

        const actualMethod = await this.deployFile(src, dest, method, options.force);
        const hash = await this.calculateHash(src);
        const relPath = path.relative(targetDir, dest);
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          method: actualMethod,
          installedAt: now,
        };

        if (!lockfile.installed.agents.includes(agentFile)) {
          lockfile.installed.agents.push(agentFile);
        }
      }

      // Copy/Symlink Skills
      for (const skillName of resolved.skills) {
        const src = path.join(registryDir, 'skills', skillName);
        const dest = path.join(subPaths.skillsDir, skillName);

        const actualMethod = await this.deployFile(src, dest, method, options.force);
        const skillFile = path.join(src, 'SKILL.md');
        if (await fs.pathExists(skillFile)) {
          const hash = await this.calculateHash(skillFile);
          const relPath = path.relative(targetDir, path.join(subPaths.skillsDir, skillName, 'SKILL.md'));
          lockfile.files[relPath] = {
            hash,
            bundle: resolved.targetBundle,
            method: actualMethod,
            installedAt: now,
          };
        }

        if (!lockfile.installed.skills.includes(skillName)) {
          lockfile.installed.skills.push(skillName);
        }
      }

      // Copy/Symlink Workflows
      for (const workflowFile of resolved.workflows) {
        const src = path.join(registryDir, 'workflows', workflowFile);
        const dest = path.join(subPaths.workflowsDir, workflowFile);

        const actualMethod = await this.deployFile(src, dest, method, options.force);
        const hash = await this.calculateHash(src);
        const relPath = path.relative(targetDir, dest);
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          method: actualMethod,
          installedAt: now,
        };

        if (!lockfile.installed.workflows.includes(workflowFile)) {
          lockfile.installed.workflows.push(workflowFile);
        }
      }

      // Copy/Symlink Rules
      for (const ruleFile of resolved.rules) {
        const src = path.join(registryDir, 'rules', ruleFile);
        const dest = path.join(subPaths.rulesDir, ruleFile);

        if (await fs.pathExists(src)) {
          const actualMethod = await this.deployFile(src, dest, method, options.force);
          const hash = await this.calculateHash(src);
          const relPath = path.relative(targetDir, dest);
          lockfile.files[relPath] = {
            hash,
            bundle: resolved.targetBundle,
            method: actualMethod,
            installedAt: now,
          };
        }
      }

      // Update Lockfile Bundles
      if (resolved.targetBundle && !lockfile.installed.bundles.includes(resolved.targetBundle)) {
        lockfile.installed.bundles.push(resolved.targetBundle);
      }

      await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
    }

    return { installed: resolved, targetDirs, dryRun: false, method };
  }
}
