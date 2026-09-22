import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { isKnownHost, HOST_REGISTRY, resolveHostProjectDir } from './hosts.js';
import { HostProjector } from './projector.js';
import type { IndexableAsset } from './projector.js';
import { ClineProjector } from './cline-projector.js';
import { ClaudeProjector } from './claude-projector.js';
import YAML from 'yaml';
import type { BundleDefinition, InstallOptions, LockfileManifest, ResolvedAssets, InstallScope, InstallMethod, AgentHost, PlannedProjectionArtifact, ProjectionInfo } from './types.js';

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

  private removeProjectedTo(lockfile: LockfileManifest, canonicalRelPath: string, projectedRelPath: string): void {
    const normProj = this.toPosix(projectedRelPath);
    const posixKey = canonicalRelPath.replace(/\\/g, '/');
    const sysKey = canonicalRelPath.replace(/\//g, path.sep);
    const targetKey = lockfile.files[posixKey] ? posixKey : (lockfile.files[sysKey] ? sysKey : canonicalRelPath);
    const asset = lockfile.files[targetKey];
    if (asset && asset.projectedTo) {
      asset.projectedTo = asset.projectedTo.filter(p => p !== normProj);
      if (asset.projectedTo.length === 0) {
        delete asset.projectedTo;
      }
    }
  }

  /**
   * Plan 015c / §5.7 — host-scoped projection namespaces.
   *
   * A re-projection run is authoritative only for the paths it produces inside
   * its own host namespace. Bundle-scoped lanes (`.agents/plugins/<bundle>/`) are
   * additionally narrowed to the bundle that owns them, so re-projecting bundle A
   * never drops bundle B's plugin-lane entries.
   */
  private static projectionNamespacePrefixes(host: string, bundleName: string): string[] {
    switch (host) {
      case 'cline':
        return ['.cline/', `.agents/plugins/${bundleName}/`];
      case 'claude':
        return ['.claude/'];
      case 'cursor':
        return ['.cursor/'];
      case 'gemini':
        return ['.gemini/'];
      case 'opencode':
        return ['.opencode/'];
      case 'codex':
        return ['AGENTS.md'];
      default:
        return [];
    }
  }

  /**
   * Plan 015c / §5.7 — reconcile `projectedTo` instead of only appending.
   *
   * `recordProjectedTo()` appends and is never told when a projection *path*
   * changes (e.g. the ADR 0016 workflow slug rename from
   * `.cline/workflows/implement-feature-or-fix.md` to
   * `.cline/workflows/workflow-implement.md`). The obsolete-projection cleanup
   * iterates `lockfile.projections`, which no longer contains the legacy path, so
   * the stale pointer in `files[canonical].projectedTo` survived forever and
   * `agents doctor` warned "Missing projection ... Re-run: agents add ... --fanout"
   * — a remediation that provably cannot clear it.
   *
   * For every canonical this run actually produced projections for, drop the
   * entries inside this run's namespace that the current plan did not produce.
   * Entries for other hosts and for other bundles survive untouched.
   */
  private reconcileProjectedTo(
    lockfile: LockfileManifest,
    host: string,
    bundleName: string,
    producedByCanonical: Map<string, string[]>
  ): void {
    const prefixes = InstallEngine.projectionNamespacePrefixes(host, bundleName);
    if (prefixes.length === 0 || producedByCanonical.size === 0) return;

    for (const [canonical, producedPaths] of producedByCanonical) {
      const posixKey = canonical.replace(/\\/g, '/');
      const sysKey = canonical.replace(/\//g, path.sep);
      const targetKey = lockfile.files[posixKey] ? posixKey : (lockfile.files[sysKey] ? sysKey : null);
      if (!targetKey) continue;

      const asset = lockfile.files[targetKey];
      if (!asset.projectedTo || asset.projectedTo.length === 0) continue;

      const produced = new Set(producedPaths.map(p => this.toPosix(p)));
      const kept = asset.projectedTo.filter(
        p => !(prefixes.some(prefix => p.startsWith(prefix)) && !produced.has(p))
      );

      if (kept.length === asset.projectedTo.length) continue;
      if (kept.length === 0) {
        delete asset.projectedTo;
      } else {
        asset.projectedTo = kept;
      }
    }
  }

  /**
   * ADR 0018 — the shared compound-lane body used by every host that owns a
   * dedicated projector (Cline per ADR 0013, Claude per ADR 0018).
   *
   * Parameterising by `host` instead of forking the body is deliberate: the two
   * lanes must stay behaviourally identical in pruning, refcounting and
   * reconcile semantics, and the Cline path is provably unchanged because it
   * passes the exact same literal `'cline'` (and the same `declared` set, plan
   * artifacts and force flag) it previously used inline.
   *
   * The host-specific plan (the projector call) stays at the call site; this body
   * is purely mechanical: prune superseded projections, deploy artifacts, record
   * refcounted projection entries, reconcile `projectedTo`, surface `projections`.
   */
  private async applyCompoundLane(
    host: AgentHost,
    bundleName: string,
    artifacts: PlannedProjectionArtifact[],
    context: {
      root: string;
      lockfile: LockfileManifest;
      declared: Set<string>;
      projections: ProjectionInfo[];
      now: string;
      force?: boolean;
    }
  ): Promise<void> {
    const { root, lockfile, declared, projections, now, force } = context;
    const newPaths = new Set(artifacts.map(a => a.relPath));

    // Clean up legacy or obsolete projections previously owned by this bundle.
    // This is the load-bearing migration for renames: the ADR 0016 workflow slug
    // rename, and (ADR 0018 decision 2) the `subagent-` prefix strip that moves
    // `.claude/agents/subagent-<role>.md` to `.claude/agents/<role>.md`.
    if (lockfile.projections) {
      for (const [projRelPath, proj] of Object.entries(lockfile.projections)) {
        if (proj.host === host && !newPaths.has(projRelPath) && proj.owners.includes(bundleName)) {
          proj.owners = proj.owners.filter(o => o !== bundleName);
          if (proj.owners.length === 0) {
            const absProjection = path.join(root, projRelPath);
            if (await fs.pathExists(absProjection)) {
              await fs.remove(absProjection);
              await this.removeEmptyProjectionDirs(root, projRelPath);
            }
            delete lockfile.projections[projRelPath];
          }
          if (proj.canonical) {
            this.removeProjectedTo(lockfile, proj.canonical, projRelPath);
          }
        }
      }
    }

    for (const artifact of artifacts) {
      const dest = path.join(root, artifact.relPath);
      if (await fs.pathExists(dest) && !force) {
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
      const declares = artifact.kind === 'rule' || artifact.kind === 'team-manifest'
        || artifact.kind === 'plugin-manifest'
        || (artifact.canonical ? declared.has(artifact.canonical) : false);
      const priorOwners = existingProj?.owners ?? [];
      const owners = declares
        ? Array.from(new Set([...priorOwners, bundleName]))
        : priorOwners;

      lockfile.projections[artifact.relPath] = {
        host,
        kind: artifact.kind,
        canonical: artifact.canonical,
        owners,
        hash: deployedHash,
        installedAt: existingProj?.installedAt ?? now,
        managedMarker: artifact.managedMarker,
      };

      projections.push({ host, path: artifact.relPath, kind: artifact.kind, warnings: [] });

      // ADR 0018 decision 12 — a distribution-only artifact (the opt-in Claude plugin lane) is
      // deployed and tracked in `lockfile.projections` so doctor can see presence and drift, but
      // it is deliberately NOT a `projectedTo` target. `projectionNamespacePrefixes('claude')` is
      // `['.claude/']` on purpose: `.agents/plugins/<bundle>/` belongs to the *cline* reconcile
      // pass, and a claude pointer recorded inside it would be dropped by that pass on the next
      // Cline install — healthy artifacts turned into orphaned lockfile state.
      if (artifact.canonical && !artifact.distributionOnly) {
        this.recordProjectedTo(lockfile, artifact.canonical, artifact.relPath);
      }
    }

    // Plan 015c / §5.7 — authoritative reconcile pass. `recordProjectedTo` above
    // only appends, so a canonical whose projection path changed (e.g. the ADR 0016
    // workflow slug rename) kept a dangling pointer forever and `agents doctor`
    // warned about a file that can never come back. Derive the produced set from
    // this run's plan and drop this namespace's stale pointers for the canonicals
    // we just re-projected.
    const producedByCanonical = new Map<string, string[]>();
    for (const artifact of artifacts) {
      // Distribution-only artifacts are excluded here as well: they exist to be *packaged*,
      // not to serve a canonical asset, so they must not widen the produced set of this
      // namespace (which would keep a stale `.claude/**` pointer alive).
      if (!artifact.canonical || artifact.distributionOnly) continue;
      const producedPaths = producedByCanonical.get(artifact.canonical);
      if (producedPaths) {
        producedPaths.push(artifact.relPath);
      } else {
        producedByCanonical.set(artifact.canonical, [artifact.relPath]);
      }
    }
    this.reconcileProjectedTo(lockfile, host, bundleName, producedByCanonical);
  }

  /**
   * ADR 0018 — the host-specific projection plan, the single input that differs per host once
   * `applyCompoundLane` shared the mechanics. `pluginLane` (Plan 016 decision 13) is honoured for
   * the **Claude lane only**: the Cline package must stay byte-identical with the flag on and off,
   * so the flag is inert for `cline`.
   */
  private static async planCompoundArtifacts(
    host: AgentHost,
    bundleDef: BundleDefinition,
    scope: InstallScope,
    resolved: ResolvedAssets,
    registryDir: string,
    pluginLane: boolean
  ): Promise<PlannedProjectionArtifact[]> {
    if (host === 'cline') {
      return ClineProjector.planCompoundProjection(bundleDef, scope, resolved, registryDir);
    }
    const artifacts = await ClaudeProjector.planCompoundProjection(bundleDef, scope, resolved, registryDir);
    if (pluginLane) {
      // Distribution-only extras (ADR 0018 decision 12): deployed and tracked through the same
      // lane, but never recorded as a `projectedTo` target (`distributionOnly` artifacts).
      artifacts.push(...await ClaudeProjector.planPluginLane(bundleDef, resolved, registryDir));
    }
    return artifacts;
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

  // ADR 0016: Silent auto-migration of legacy .agents/workflows/*.md into
  // .agents/skills/workflow-<name>/SKILL.md, synchronizing lockfiles and pruning empty dirs.
  public async migrateLegacyWorkspaceWorkflows(targetDir: string, lockfile?: LockfileManifest): Promise<number> {
    const subPaths = AgentHostAdapter.getSubPaths(targetDir);
    let migratedCount = 0;

    let targetLockfile: LockfileManifest | undefined = lockfile;
    let lockfileLoadedFromDisk = false;

    if (!targetLockfile && (await fs.pathExists(subPaths.lockfile))) {
      try {
        targetLockfile = await fs.readJson(subPaths.lockfile);
        lockfileLoadedFromDisk = true;
      } catch {}
    }

    if (await fs.pathExists(subPaths.workflowsDir)) {
      const entries = await fs.readdir(subPaths.workflowsDir).catch(() => []);
      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          const legacyPath = path.join(subPaths.workflowsDir, entry);
          let skillName = entry.replace(/\.md$/, '').replace(/--/g, '-');
          if (!skillName.startsWith('workflow-')) {
            skillName = `workflow-${skillName}`;
          }
          const targetSkillDir = path.join(subPaths.skillsDir, skillName);
          const targetSkillFile = path.join(targetSkillDir, 'SKILL.md');

          if (!(await fs.pathExists(targetSkillFile))) {
            await fs.ensureDir(targetSkillDir);
            const legacyContent = await fs.readFile(legacyPath, 'utf8');
            let skillContent = legacyContent;
            const fmMatch = legacyContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
            if (fmMatch) {
              try {
                const meta = YAML.parse(fmMatch[1]) || {};
                meta.name = skillName;
                if (!meta.metadata) {
                  meta.metadata = {
                    author: 'Agents United',
                    version: '1.0.0',
                    icon: '🔄',
                  };
                }
                const rest = legacyContent.replace(/^---\r?\n[\s\S]+?\r?\n---/, '');
                skillContent = `---\n${YAML.stringify(meta).trim()}\n---${rest}`;
              } catch {}
            }
            await fs.writeFile(targetSkillFile, skillContent, 'utf8');
          }
          await fs.remove(legacyPath).catch(() => {});
          migratedCount++;

          if (targetLockfile) {
            const legacyRel = this.toPosix(path.relative(targetDir, legacyPath));
            const newRel = this.toPosix(path.relative(targetDir, targetSkillFile));
            if (targetLockfile.files && targetLockfile.files[legacyRel]) {
              targetLockfile.files[newRel] = targetLockfile.files[legacyRel];
              delete targetLockfile.files[legacyRel];
            }
            if (targetLockfile.installed && targetLockfile.installed.skills) {
              if (!targetLockfile.installed.skills.includes(skillName)) {
                targetLockfile.installed.skills.push(skillName);
              }
            }
          }
        }
      }
      const remaining = await fs.readdir(subPaths.workflowsDir).catch(() => []);
      if (remaining.length === 0) {
        await fs.remove(subPaths.workflowsDir).catch(() => {});
      }
    }

    if (targetLockfile && targetLockfile.installed && targetLockfile.installed.workflows && targetLockfile.installed.workflows.length > 0) {
      for (const w of targetLockfile.installed.workflows) {
        let skillName = w.replace(/\.md$/, '').replace(/--/g, '-');
        if (!skillName.startsWith('workflow-')) {
          skillName = `workflow-${skillName}`;
        }
        if (targetLockfile.installed.skills && !targetLockfile.installed.skills.includes(skillName)) {
          targetLockfile.installed.skills.push(skillName);
        }
      }
      targetLockfile.installed.workflows = [];
    }

    if (targetLockfile && (lockfileLoadedFromDisk || (await fs.pathExists(subPaths.lockfile)))) {
      await fs.writeJson(subPaths.lockfile, targetLockfile, { spaces: 2 });
    }

    return migratedCount;
  }

  /**
   * Dry-run: compute the projection plan (paths + warnings) without writing anything.
   */
  private async buildProjections(
    fanoutHosts: string[],
    resolved: ResolvedAssets,
    registryDir: string,
    scope: InstallScope,
    targetDir?: string,
    pluginLane = false
  ): Promise<ProjectionInfo[]> {
    const infos: ProjectionInfo[] = [];
    if (fanoutHosts.length === 0) return infos;
    const { root } = InstallEngine.projectionRoot(scope, targetDir);

    for (const host of fanoutHosts) {
      if (host === 'codex') {
        infos.push({ host, path: 'AGENTS.md', kind: 'bridge', warnings: [] });
        continue;
      }

      if (host === 'cline' || host === 'claude') {
        const bundleDef = resolved.targetBundle ? await this.registry.getBundle(resolved.targetBundle) : undefined;
        if (bundleDef) {
          const artifacts = await InstallEngine.planCompoundArtifacts(
            host as AgentHost,
            bundleDef,
            scope,
            resolved,
            registryDir,
            pluginLane
          );
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

      if (host === 'cline' || host === 'claude') {
        const bundleDef = resolved.targetBundle ? await this.registry.getBundle(resolved.targetBundle) : undefined;
        if (bundleDef) {
          // Declared Asset Set of this bundle (its own bundles.json fields, NOT the
          // inherited/resolved superset). Projections for inherited artifacts are not
          // owned by this bundle — only those it actually declares (plus its own
          // coordinator rule and team manifest).
          const declared = new Set<string>();
          if (bundleDef.orchestrator) declared.add(`agents/${bundleDef.orchestrator}`);
          (bundleDef.agents || []).forEach(a => declared.add(`agents/${a}`));
          (bundleDef.skills || []).forEach(s => declared.add(`skills/${s}/SKILL.md`));
          (bundleDef.workflows || []).forEach(w => declared.add(`workflows/${w}`));

          // ADR 0018 - the per-host plan is the only host-specific input; pruning,
          // refcounting, deployment and reconcile are shared via applyCompoundLane.
          const artifacts = await InstallEngine.planCompoundArtifacts(
            host as AgentHost,
            bundleDef,
            scope,
            resolved,
            registryDir,
            options.pluginLane === true
          );

          await this.applyCompoundLane(host, bundleDef.name, artifacts, {
            root,
            lockfile,
            declared,
            projections,
            now,
            force: options.force,
          });

          // Installed-addon freshness (plan 003): when the installed bundle extends a
          // parent essentials with its own coordinator rule + team manifest already
          // projected, re-render those two coordination artifacts excluding every
          // installed bundle listed in the lockfile, so the coordinator stops prompting
          // for addons already present. Ownership is left untouched (the parent stays
          // the sole owner). If the parent rule/manifest don't exist yet (parent not
          // installed as its own bundle), skip silently.
          if (host === 'cline' && bundleDef.parentBundle) {
            const parentDef = await this.registry.getBundle(bundleDef.parentBundle);
            if (parentDef) {
              const parentProjection = await ClineProjector.planCompoundProjection(
                parentDef,
                scope,
                resolved,
                registryDir,
                lockfile.installed.bundles
              );
              for (const artifact of parentProjection) {
                if (artifact.kind !== 'rule' && artifact.kind !== 'team-manifest') continue;
                if (artifact.content === undefined) continue;
                const dest = path.join(root, artifact.relPath);
                if (!await fs.pathExists(dest)) continue; // parent not installed as its own bundle
                await this.deployProjection(dest, artifact.content);
                const deployedHash = await this.calculateHash(dest);
                lockfile.projections = lockfile.projections || {};
                const existingProj = lockfile.projections[artifact.relPath];
                lockfile.projections[artifact.relPath] = {
                  host: 'cline',
                  kind: artifact.kind,
                  canonical: artifact.canonical,
                  // Preserve existing ownership; the parent remains the sole owner.
                  owners: existingProj?.owners ?? [],
                  hash: deployedHash,
                  installedAt: existingProj?.installedAt ?? now,
                  managedMarker: artifact.managedMarker,
                };
              }
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
        // ADR 0013 / ADR 0018: the compound-lane hosts (Cline, Claude) name their
        // projected roles by stripping the canonical `subagent-` prefix, so the
        // unbundled fallback must use the same names or the two writers would
        // disagree about the same role (`.cline/agents/<role>.yml`,
        // `.claude/agents/<role>.md`).
        const strippedRoleName = agentFile.replace(/\.md$/i, '').replace(/^subagent-/, '');
        const projName = host === 'cline'
          ? `${strippedRoleName}.yml`
          : (host === 'claude' ? `${strippedRoleName}.md` : agentFile);
        const dest = path.join(base, subdir, projName);
        const projPath = this.toPosix(path.relative(root, dest));

        // ADR 0017 / ADR 0018: the Cline (ADR 0013) and Claude (ADR 0018) compound lanes
        // are the authoritative writers for bundle roles. This fallback must never
        // overwrite a role the compound lane owns with a different renderer's output -
        // doing so silently degraded `.cline/agents/*.yml` (wrong frontmatter/body) and
        // left the compound projection hash stale, which `agents doctor` then reported
        // as content drift after every `update --all` (reproduced via the `domain:*`
        // pseudo-bundle, whose cline fanout cannot resolve a bundle definition and lands
        // here).
        if ((host === 'cline' || host === 'claude') && lockfile.projections?.[projPath]?.kind === 'role') {
          continue;
        }

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
        projections.push({ host, path: projPath, kind: 'role', warnings: res.warnings });
        this.recordProjectedTo(lockfile, this.lockRel('agents', agentFile), projPath);

        // ADR 0017 / ADR 0018: record a projection entry with a matching hash for anything
        // this fallback writes, so the freshness check never reports phantom drift and the
        // bookkeeping stays consistent with the compound lane. Host value comes from the
        // loop variable, never a literal, so both compound-lane hosts are covered without
        // changing Cline semantics.
        if (host === 'cline' || host === 'claude') {
          lockfile.projections = lockfile.projections || {};
          lockfile.projections[projPath] = {
            host,
            kind: 'role',
            canonical: canonicalRel,
            owners: resolved.targetBundle ? [resolved.targetBundle] : [],
            hash: await this.calculateHash(dest),
            installedAt: lockfile.projections[projPath]?.installedAt ?? new Date().toISOString(),
            managedMarker: true,
          };
        }
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
      let effectiveDryFanout = fanoutHosts;
      if (options.fanout === undefined && hasCanonicalAgents) {
        const agentsTarget = AgentHostAdapter.resolveHostDir(scope, 'agents', options.targetDir);
        const lockfilePath = path.join(agentsTarget, 'agents-united.json');
        if (await fs.pathExists(lockfilePath)) {
          const lockfile = await fs.readJson(lockfilePath).catch(() => null);
          if (lockfile?.fanout) {
            effectiveDryFanout = (lockfile.fanout as string[])
              .filter(h => isKnownHost(h) && HOST_REGISTRY[h]?.projectionCapable);
          }
        }
      }
      const projections = hasCanonicalAgents
        ? await this.buildProjections(effectiveDryFanout, resolved, registryDir, scope, options.targetDir, options.pluginLane === true)
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
      if (resolved.workflows && resolved.workflows.length > 0) {
        await fs.ensureDir(subPaths.workflowsDir);
      }
      await fs.ensureDir(subPaths.rulesDir);

      const lockfile = await this.readLockfile(subPaths.lockfile);
      await this.migrateLegacyWorkspaceWorkflows(targetDir, lockfile);
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

      // Declared Asset Set of the bundle being installed (its own bundles.json fields,
      // NOT the inherited/resolved superset). Inherited parent assets are deployed but
      // are NOT owned by this bundle, so a child install never over-claims provenance.
      const declared = new Set<string>();
      if (resolved.targetBundle) {
        const bundleDef = await this.registry.getBundle(resolved.targetBundle);
        if (bundleDef) {
          if (bundleDef.orchestrator) declared.add(`agents/${bundleDef.orchestrator}`);
          (bundleDef.agents || []).forEach(a => declared.add(`agents/${a}`));
          (bundleDef.skills || []).forEach(s => declared.add(`skills/${s}/SKILL.md`));
          (bundleDef.workflows || []).forEach(w => declared.add(`workflows/${w}`));
        }
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
        const relPath = this.toPosix(path.relative(targetDir, dest));
        // Preserve projection tracking and co-ownership across re-installs;
        // applyFanout re-records the current fan-out below (deduplicated).
        const existing = lockfile.files[relPath];
        const existingOwners = existing?.owners ?? (existing?.bundle ? [existing.bundle] : []);
        const declaresAsset = declared.has(`agents/${agentFile}`);
        const owners = resolved.targetBundle && declaresAsset
          ? Array.from(new Set([...existingOwners, resolved.targetBundle]))
          : existingOwners;
        lockfile.files[relPath] = {
          hash,
          bundle: existing?.bundle ?? resolved.targetBundle,
          owners,
          method: actualMethod,
          installedAt: existing?.installedAt ?? now,
          ...(existing?.projectedTo ? { projectedTo: existing.projectedTo } : {}),
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
          const relPath = this.toPosix(path.relative(targetDir, path.join(subPaths.skillsDir, skillName, 'SKILL.md')));
          const existing = lockfile.files[relPath];
          const existingOwners = existing?.owners ?? (existing?.bundle ? [existing.bundle] : []);
          const declaresAsset = declared.has(`skills/${skillName}/SKILL.md`);
          const owners = resolved.targetBundle && declaresAsset
            ? Array.from(new Set([...existingOwners, resolved.targetBundle]))
            : existingOwners;
          lockfile.files[relPath] = {
            hash,
            bundle: existing?.bundle ?? resolved.targetBundle,
            owners,
            method: actualMethod,
            installedAt: existing?.installedAt ?? now,
            ...(existing?.projectedTo ? { projectedTo: existing.projectedTo } : {}),
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
        const relPath = this.toPosix(path.relative(targetDir, dest));
        const existing = lockfile.files[relPath];
        const existingOwners = existing?.owners ?? (existing?.bundle ? [existing.bundle] : []);
        const declaresAsset = declared.has(`workflows/${workflowFile}`);
        const owners = resolved.targetBundle && declaresAsset
          ? Array.from(new Set([...existingOwners, resolved.targetBundle]))
          : existingOwners;
        lockfile.files[relPath] = {
          hash,
          bundle: existing?.bundle ?? resolved.targetBundle,
          owners,
          method: actualMethod,
          installedAt: existing?.installedAt ?? now,
          ...(existing?.projectedTo ? { projectedTo: existing.projectedTo } : {}),
        };

        lockfile.installed.workflows = lockfile.installed.workflows || [];
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
          const relPath = this.toPosix(path.relative(targetDir, dest));
          const existing = lockfile.files[relPath];
          const existingOwners = existing?.owners ?? (existing?.bundle ? [existing.bundle] : []);
          // Rule files are bundle-derived coordination artifacts, not members of the
          // declared asset set: every installing bundle always owns the rule it deploys.
          const declaresAsset = true;
          const owners = resolved.targetBundle && declaresAsset
            ? Array.from(new Set([...existingOwners, resolved.targetBundle]))
            : existingOwners;
          lockfile.files[relPath] = {
            hash,
            bundle: existing?.bundle ?? resolved.targetBundle,
            owners,
            method: actualMethod,
            installedAt: existing?.installedAt ?? now,
            ...(existing?.projectedTo ? { projectedTo: existing.projectedTo } : {}),
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
