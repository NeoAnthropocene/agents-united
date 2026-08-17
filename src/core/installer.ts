import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { isKnownHost, HOST_REGISTRY, resolveHostProjectDir } from './hosts.js';
import { HostProjector } from './projector.js';
import { ClineProjector } from './cline-projector.js';
import type { IndexableAsset } from './projector.js';
import type { InstallOptions, LockfileManifest, ResolvedAssets, InstallScope, InstallMethod, AgentHost, ProjectionInfo } from './types.js';

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
        if (isKnownHost(h)) {
          valid.push(h);
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

/**
   * Writes a projection copy (never a symlink). Projections are always translated
   * copies of canonical assets, so their bytes differ from the source.
   */
  private async deployProjection(dest: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, content, 'utf8');
  }

  /**
   * Computes the canonical `.agents/` target dir and the workspace root that contains
   * it. Projections are recorded relative to this root (e.g. '.claude/agents/x.md').
   */
  private static projectionRoot(scope: InstallScope, targetDir?: string): { agentsTarget: string; root: string } {
    const agentsTarget = AgentHostAdapter.resolveHostDir(scope, 'agents', targetDir);
    return { agentsTarget, root: path.resolve(path.dirname(agentsTarget)) };
  }
private toPosix(p: string): string {
    return p.split(path.sep).join('/');
  }

  private canonicalRelAgent(agentFile: string): string {
    return `.agents/agents/${agentFile}`;
  }

  private lockRel(subdir: string, file: string): string {
    return path.join(subdir, file);
  }

  private destForProjection(host: string, root: string, file: string): string {
    const def = HOST_REGISTRY[host];
    const base = resolveHostProjectDir(host, root);
    if (def.agentsSubdir) return path.join(base, def.agentsSubdir, file);
    return base; // agentsmd hosts (codex) use the root AGENTS.md bridge, handled separately
  }

  private recordProjectedTo(lockfile: LockfileManifest, relKey: string, projPath: string): void {
    const normProj = this.toPosix(projPath);
    const posixKey = relKey.replace(/\\/g, '/');
    const sysKey = relKey.replace(/\//g, path.sep);
    const targetKey = lockfile.files[posixKey] ? posixKey : (lockfile.files[sysKey] ? sysKey : relKey);
    if (!lockfile.files[targetKey]) {
      lockfile.files[targetKey] = { hash: '', installedAt: new Date().toISOString() };
    }
    const asset = lockfile.files[targetKey];
    asset.projectedTo = asset.projectedTo || [];
    if (!asset.projectedTo.includes(normProj)) {
      asset.projectedTo.push(normProj);
    }
  }

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
   * Dry-run: compute the projection plan (paths + warnings) without writing anything.
   */
  private async buildProjections(
    fanoutHosts: string[],
    resolved: ResolvedAssets,
    registryDir: string,
    scope: InstallScope,
    targetDir?: string
  ): Promise<ProjectionInfo[]> {
    const infos: ProjectionInfo[] = [];
    if (fanoutHosts.length === 0) return infos;
    const { root } = InstallEngine.projectionRoot(scope, targetDir);

    for (const host of fanoutHosts) {
      if (host === 'codex') {
        infos.push({ host, path: 'AGENTS.md', kind: 'bridge', warnings: [] });
        continue;
      }

      if (host === 'cline') {
        const bundleDef = resolved.targetBundle ? await this.registry.getBundle(resolved.targetBundle) : undefined;
        if (bundleDef) {
          const artifacts = await ClineProjector.planCompoundProjection(bundleDef, scope, resolved, registryDir);
          for (const artifact of artifacts) {
            infos.push({ host, path: artifact.relPath, kind: artifact.kind, warnings: [] });
          }
          continue;
        }
      }

      const base = resolveHostProjectDir(host, root);
      const subdir = HOST_REGISTRY[host].agentsSubdir ?? 'agents';
      for (const agentFile of resolved.agents) {
        const content = await fs.readFile(path.join(registryDir, 'agents', agentFile), 'utf8');
        const res = HostProjector.projectAgent(content, HOST_REGISTRY[host].profile, this.canonicalRelAgent(agentFile));
        const dest = path.join(base, subdir, agentFile);
        infos.push({ host, path: this.toPosix(path.relative(root, dest)), kind: 'role', warnings: res.warnings });
      }
    }
    return infos;
  }

  /**
   * Real fan-out: project canonical `.agents/` agents into each non-bridge host, build
   * the root AGENTS.md bridge for `codex`, and record every projection in the lockfile
   * of the canonical `.agents/` store that `targetDir` points at.
   */
  private async applyFanout(
    fanoutHosts: string[],
    resolved: ResolvedAssets,
    registryDir: string,
    scope: InstallScope,
    targetDir: string,
    lockfile: LockfileManifest,
    options: InstallOptions,
    projections: ProjectionInfo[]
  ): Promise<void> {
    if (fanoutHosts.length === 0) return;
    const { root } = InstallEngine.projectionRoot(scope, options.targetDir);
    const now = new Date().toISOString();

    for (const host of fanoutHosts) {
      if (host === 'codex') {
        const assets: IndexableAsset[] = [];
        resolved.agents.forEach(f => assets.push({ name: f.replace(/\.md$/, ''), type: 'agent', relPath: `.agents/agents/${f}` }));
        resolved.workflows.forEach(f => assets.push({ name: f.replace(/\.md$/, ''), type: 'workflow', relPath: `.agents/workflows/${f}` }));
        resolved.skills.forEach(s => assets.push({ name: s, type: 'skill', relPath: `.agents/skills/${s}/SKILL.md` }));
        const bridge = HostProjector.buildAgentsMdIndex(assets);
        const bridgeDest = path.join(root, 'AGENTS.md');
        if (await fs.pathExists(bridgeDest) && !options.force) {
          const existing = await fs.readFile(bridgeDest, 'utf8');
          if (!HostProjector.hasManagedMarker(existing)) {
            throw new Error(
              'File AGENTS.md already exists at the workspace root and is not managed by agents-united. Use --force to overwrite.'
            );
          }
          // Ours (managed marker present): deterministic content — regenerate silently.
        }
        await this.deployProjection(bridgeDest, bridge);
        projections.push({ host, path: 'AGENTS.md', kind: 'bridge', warnings: [] });
        resolved.agents.forEach(f => this.recordProjectedTo(lockfile, this.lockRel('agents', f), 'AGENTS.md'));
        resolved.workflows.forEach(f => this.recordProjectedTo(lockfile, this.lockRel('workflows', f), 'AGENTS.md'));
        resolved.skills.forEach(s => this.recordProjectedTo(lockfile, this.lockRel('skills', path.join(s, 'SKILL.md')), 'AGENTS.md'));
        continue;
      }

      if (host === 'cline') {
        const bundleDef = resolved.targetBundle ? await this.registry.getBundle(resolved.targetBundle) : undefined;
        if (bundleDef) {
          const artifacts = await ClineProjector.planCompoundProjection(bundleDef, scope, resolved, registryDir);
          for (const artifact of artifacts) {
            const dest = path.join(root, artifact.relPath);
            if (await fs.pathExists(dest) && !options.force) {
              const existing = await fs.readFile(dest, 'utf8').catch(() => null);
              if (existing !== null) {
                if (artifact.managedMarker && !HostProjector.hasManagedMarker(existing)) {
                  throw new Error(
                    `Projection target ${artifact.relPath} already exists and is not managed by agents-united. Use --force to overwrite.`
                  );
                } else if (!artifact.managedMarker) {
                  const registeredProj = lockfile.projections?.[artifact.relPath];
                  if (!registeredProj) {
                    throw new Error(
                      `Projection target ${artifact.relPath} already exists and is not managed by agents-united. Use --force to overwrite.`
                    );
                  }
                }
              }
            }

            if (artifact.content !== undefined) {
              await this.deployProjection(dest, artifact.content);
            } else if (artifact.sourceFilePath) {
              await fs.ensureDir(path.dirname(dest));
              await fs.copy(artifact.sourceFilePath, dest, { overwrite: true });
            }

            const deployedHash = await this.calculateHash(dest);
            lockfile.projections = lockfile.projections || {};
            const existingProj = lockfile.projections[artifact.relPath];
            const bundleName = bundleDef.name;
            const owners = existingProj?.owners
              ? Array.from(new Set([...existingProj.owners, bundleName]))
              : [bundleName];

            lockfile.projections[artifact.relPath] = {
              host: 'cline',
              kind: artifact.kind,
              canonical: artifact.canonical,
              owners,
              hash: deployedHash,
              installedAt: now,
              managedMarker: artifact.managedMarker,
            };

            projections.push({ host, path: artifact.relPath, kind: artifact.kind, warnings: [] });

            if (artifact.canonical) {
              this.recordProjectedTo(lockfile, artifact.canonical, artifact.relPath);
            }
          }
          continue;
        }
      }

      const base = resolveHostProjectDir(host, root);
      const subdir = HOST_REGISTRY[host].agentsSubdir ?? 'agents';
      for (const agentFile of resolved.agents) {
        const content = await fs.readFile(path.join(registryDir, 'agents', agentFile), 'utf8');
        const canonicalRel = this.canonicalRelAgent(agentFile);
        const res = HostProjector.projectAgent(content, HOST_REGISTRY[host].profile, canonicalRel);
        const dest = path.join(base, subdir, agentFile);
        if (await fs.pathExists(dest) && !options.force) {
          const existing = await fs.readFile(dest, 'utf8');
          if (!HostProjector.hasManagedMarker(existing)) {
            throw new Error(
              `Projection target ${this.toPosix(path.relative(root, dest))} already exists and is not managed by agents-united. Use --force to overwrite.`
            );
          }
          // Ours (managed marker present): deterministic content — regenerate silently.
        }
        await this.deployProjection(dest, res.content);
        const projPath = this.toPosix(path.relative(root, dest));
        projections.push({ host, path: projPath, kind: 'role', warnings: res.warnings });
        this.recordProjectedTo(lockfile, this.lockRel('agents', agentFile), projPath);
      }
    }
  }

  public async install(identifier: string, options: InstallOptions = {}): Promise<{ installed: ResolvedAssets; targetDirs: string[]; dryRun: boolean; method: InstallMethod; projections: ProjectionInfo[] }> {
    const scope = this.parseScope(options);
    const method = this.parseMethod(options);
    const hosts = this.parseHosts(options);

    const resolved = await this.registry.resolve(identifier);
    const registryDir = this.registry.getRegistryDir();

    const targetDirs: string[] = hosts.map(h => AgentHostAdapter.resolveHostDir(scope, h, options.targetDir));
    // Fan-out only from the canonical `.agents/` store, and only to projection-capable hosts.
    const hasCanonicalAgents = hosts.includes('agents');
    const fanoutHosts = (options.fanout || [])
      .map(h => (typeof h === 'string' ? h.trim().toLowerCase() : h))
      .filter(h => isKnownHost(h) && HOST_REGISTRY[h]?.projectionCapable);

    if (options.dryRun) {
      const projections = hasCanonicalAgents
        ? await this.buildProjections(fanoutHosts, resolved, registryDir, scope, options.targetDir)
        : [];
      return { installed: resolved, targetDirs, dryRun: true, method, projections };
    }

    const now = new Date().toISOString();
    // Collect projections across target-dir iterations (dedup by host+path).
    const projections: ProjectionInfo[] = [];
    const agentsTarget = AgentHostAdapter.resolveHostDir(scope, 'agents', options.targetDir);

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

      // Fan-out resolution: an explicit --fanout wins and is persisted to the lockfile;
      // otherwise the fan-out recorded at the original install is inherited, so
      // `agents update` / plain re-install regenerate projections without the flag.
      const effectiveFanout = (options.fanout !== undefined ? fanoutHosts : (lockfile.fanout ?? []))
        .filter(h => isKnownHost(h) && HOST_REGISTRY[h]?.projectionCapable);
      if (options.fanout !== undefined) {
        lockfile.fanout = effectiveFanout;
      }

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
        // Preserve projection tracking across re-installs; applyFanout re-records the
        // current fan-out below (deduplicated).
        const previousProjections = lockfile.files[relPath]?.projectedTo;
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          method: actualMethod,
          installedAt: now,
          ...(previousProjections ? { projectedTo: previousProjections } : {}),
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
          const previousProjections = lockfile.files[relPath]?.projectedTo;
          lockfile.files[relPath] = {
            hash,
            bundle: resolved.targetBundle,
            method: actualMethod,
            installedAt: now,
            ...(previousProjections ? { projectedTo: previousProjections } : {}),
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
        const previousProjections = lockfile.files[relPath]?.projectedTo;
        lockfile.files[relPath] = {
          hash,
          bundle: resolved.targetBundle,
          method: actualMethod,
          installedAt: now,
          ...(previousProjections ? { projectedTo: previousProjections } : {}),
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
      if (resolved.targetBundle) {
        if (!lockfile.installed.bundles.includes(resolved.targetBundle)) {
          lockfile.installed.bundles.push(resolved.targetBundle);
        }
        lockfile.bundleVersions = lockfile.bundleVersions || {};
        const bundleDef = await this.registry.getBundle(resolved.targetBundle);
        lockfile.bundleVersions[resolved.targetBundle] = bundleDef?.version || '1.0.0';

        if (options.mode) {
          lockfile.bundleModes = lockfile.bundleModes || {};
          lockfile.bundleModes[resolved.targetBundle] = options.mode;
        }
      }

      // Fan-out canonical `.agents/` assets into selected runtimes (only when this
      // iteration is the canonical agents store AND a fan-out is in effect — either
      // passed explicitly or inherited from the lockfile).
      if (hasCanonicalAgents && effectiveFanout.length > 0 && path.resolve(targetDir) === path.resolve(agentsTarget)) {
        await this.applyFanout(effectiveFanout, resolved, registryDir, scope, targetDir, lockfile, options, projections);
      }

      await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
    }

    return { installed: resolved, targetDirs, dryRun: false, method, projections };
  }
}
