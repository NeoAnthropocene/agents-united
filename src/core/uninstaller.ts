import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { RegistryResolver } from './registry.js';
import { AgentHostAdapter } from './adapter.js';
import { isKnownHost } from './hosts.js';
import { HostProjector } from './projector.js';
import { ClineProjector } from './cline-projector.js';
import type { UninstallOptions, LockfileManifest, InstallScope, AgentHost, BundleDefinition } from './types.js';
import { assetOwners } from './types.js';

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
  private async removeProjections(
    workspaceRoot: string,
    projectedTo: string[],
    force?: boolean,
    projectionHashes?: Record<string, { hash?: string }>,
  ): Promise<void> {
    for (const projPath of projectedTo) {
      const absProjection = path.join(workspaceRoot, projPath);
      if (!await fs.pathExists(absProjection)) {
        continue;
      }

      const isAgentsMd = projPath === 'AGENTS.md';
      const managed = await this.isManagedProjection(absProjection, isAgentsMd, projectionHashes?.[projPath]?.hash);
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

  public async uninstall(identifier: string, options: UninstallOptions = {}): Promise<{ removed: string[]; kept: string[]; staleRecords: string[]; retainedOwners: string[]; targetDirs: string[]; dryRun: boolean }> {
    const scope = this.parseScope(options);
    const hosts = this.parseHosts(options);

    const targetDirs: string[] = hosts.map(h => AgentHostAdapter.resolveHostDir(scope, h, options.targetDir));
    const resolved = await this.registry.resolve(identifier).catch(() => null);

    const totalRemoved: string[] = [];
    const totalKept: string[] = [];
    const totalStale: string[] = [];
    const retainedOwners = new Set<string>();

    for (const targetDir of targetDirs) {
      const subPaths = AgentHostAdapter.getSubPaths(targetDir);

      if (!await fs.pathExists(subPaths.lockfile)) {
        continue;
      }

      const lockfile: LockfileManifest = await fs.readJson(subPaths.lockfile);
      const removedFiles: string[] = [];
      const keptFiles: string[] = [];
      const staleRecords: string[] = [];
      // Projection ownership is the UNION of its own refcount and its canonical record's owners
      // (legacy `bundle` fallback included). Deriving it only at stamping time made the sharing
      // guarantee order-dependent: a projection created BEFORE a second bundle co-owned its
      // canonical stayed single-owner, and removing that bundle deleted the projection out from
      // under the other owner (reported both ways round). Unioning here makes "a shared canonical's
      // projections are shared" true regardless of install order. Bundle-scoped lanes
      // (`.agents/plugins/<bundle>/`) are per-bundle distribution copies: the canonical's other
      // owners do not keep them alive.
      const projectionOwners = (projRelPath: string, proj: { owners?: string[]; canonical?: string }): string[] => {
        const own = proj.owners ?? [];
        if (projRelPath.startsWith('.agents/plugins/')) return own;
        const canonical = proj.canonical ?? '';
        const rec = lockfile.files[canonical] ?? lockfile.files[canonical.replace(/^\.agents\//, '')];
        return Array.from(new Set([...own, ...assetOwners(rec)]));
      };

      /**
       * Universal Coverage Rule (ADR 0019). An artifact is deletable only when no surviving
       * installed identifier covers its source. A surviving identifier covers:
       *   - a canonical asset, when what it DECLARES contains that asset (a domain declares its
       *     whole expansion; a bundle declares its own bundles.json fields — never an inherited
       *     parent's extras, per the A6 Declared-Asset-Set contract); and
       *   - a bundle-derived artifact (`.agents/plugins/<b>/…` — team manifest, plugin.json,
       *     skill mirrors), when what it declares contains every asset `<b>` declares.
       * Owner refcounts alone answered "does anyone still name this?" — coverage answers "does
       * anyone still need this?", which is what the operator means by "don't break my domain".
       */
      const survivingCoverage = async (
        source: { asset?: string; declaringBundle?: string },
        removedId: string
      ): Promise<string[]> => {
        const survivors = lockfile.installed.bundles.filter(b => b !== removedId);
        const covering: string[] = [];
        for (const id of survivors) {
          try {
            // DECLARATION semantics, not resolution: a survivor covers exactly what it declares.
            // A real bundle declares its own bundles.json fields only (ADR 0006/A6 — an addon
            // must NOT keep the parent's undeclared surface alive); a domain pseudo-bundle's
            // declaration IS its expansion (the union of its members), which is what makes
            // `domain:engineering` cover everything `software-engineering` declares.
            const def = await this.registry.getBundle(id);
            const have = new Set<string>([]);
            if (def) {
              if (def.orchestrator) have.add(`agents/${def.orchestrator}`);
              (def.agents || []).forEach(a => have.add(`agents/${a}`));
              (def.skills || []).forEach(s => have.add(`skills/${s}/SKILL.md`));
              (def.workflows || []).forEach(w => have.add(`workflows/${w}`));
              (def.rules || []).forEach(rl => have.add(`rules/${rl}`));
            } else {
              const r = await this.registry.resolve(id);
              r.agents.forEach(f => have.add(`agents/${f}`));
              r.skills.forEach(s => have.add(`skills/${s}/SKILL.md`));
              (r.workflows || []).forEach(w => have.add(`workflows/${w}`));
              (r.rules || []).forEach(rl => have.add(`rules/${rl}`));
            }
            if (source.asset) {
              if (have.has(source.asset)) covering.push(id);
            } else if (source.declaringBundle) {
              const def = await this.registry.getBundle(source.declaringBundle);
              if (!def) continue;
              const want = new Set<string>([]);
              if (def.orchestrator) want.add(`agents/${def.orchestrator}`);
              (def.agents || []).forEach(a => want.add(`agents/${a}`));
              (def.skills || []).forEach(s => want.add(`skills/${s}/SKILL.md`));
              (def.workflows || []).forEach(w => want.add(`workflows/${w}`));
              (def.rules || []).forEach(rl => want.add(`rules/${rl}`));
              if (want.size > 0 && [...want].every(k => have.has(k))) covering.push(id);
            }
          } catch {
            // A survivor that no longer resolves cannot cover anything.
          }
        }
        return covering;
      };

      // Bundle removal mode. Triggered by a roster entry OR by owned assets: a lockfile that lost
      // its `installed.bundles` entry (older partial removals, pre-fix rosters) still has records
      // naming this owner, and those must be reachable — otherwise `agents remove` reports
      // "No installed assets found" for assets that are visibly right there in the lockfile.
      if (resolved && resolved.targetBundle) {
        const bundleName = resolved.targetBundle;
        const ownsSomething =
          Object.values(lockfile.files).some(m => assetOwners(m).includes(bundleName)) ||
          Object.values(lockfile.projections || {}).some(p => (p.owners ?? []).includes(bundleName));
        if (lockfile.installed.bundles.includes(bundleName) || ownsSomething) {
          if (!options.dryRun) {
            const workspaceRoot = path.resolve(path.dirname(targetDir));

            // Transactional validation BEFORE any write: if this bundle owns zero file
            // records and zero projections, reject without mutating the lockfile.
            const ownedFiles = Object.entries(lockfile.files)
              .filter(([, m]) => assetOwners(m).includes(bundleName));
            const ownedProjections = lockfile.projections
              ? Object.entries(lockfile.projections).filter(([p, v]) => projectionOwners(p, v).includes(bundleName)).length
              : 0;
            if (ownedFiles.length === 0 && ownedProjections === 0) {
              throw new Error(`No installed assets found matching "${bundleName}".`);
            }

            // Clean up compound projections using owner refcounting
            if (lockfile.projections) {
              for (const [projRelPath, proj] of Object.entries(lockfile.projections)) {
                const owners = projectionOwners(projRelPath, proj);
                if (owners.includes(bundleName)) {
                  proj.owners = owners.filter(o => o !== bundleName);
                  if (proj.owners.length === 0) {
                    // Universal Coverage Rule (ADR 0019) — bundle-DERIVED coordination artifacts:
                    // everything under `.agents/plugins/<b>/` (team manifest, plugin.json, skill
                    // mirrors) and the bundle's own coordinator rule. Each bundle's package is its
                    // OWN (A6: an addon shares skills but ships its own mirror, so it does not keep
                    // the parent's package alive); what keeps these alive is a survivor that
                    // DECLARES A SUPERSET of the bundle — a domain that contains it. That is
                    // exactly the reported case: `remove software-engineering` under a standing
                    // `domain:engineering` must delete nothing.
                    const declaringMatch = /^\.agents\/plugins\/([^/]+)\//.exec(projRelPath);
                    const derivedCoordination = Boolean(declaringMatch)
                      || proj.kind === 'rule' || proj.kind === 'team-manifest' || proj.kind === 'plugin-manifest';
                    const covering = derivedCoordination
                      ? await survivingCoverage({ declaringBundle: declaringMatch ? declaringMatch[1] : bundleName }, bundleName)
                      : [];
                    if (covering.length > 0) {
                      proj.owners = covering;
                      keptFiles.push(projRelPath);
                      covering.forEach(o => retainedOwners.add(o));
                      continue;
                    }
                    const absProjection = path.join(workspaceRoot, projRelPath);
                    // Capture existence BEFORE deleting: the accounting below must distinguish a
                    // file that really left the disk from a ghost record that never had one.
                    const existedOnDisk = await fs.pathExists(absProjection);
                    if (existedOnDisk) {
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
                    // Honest accounting: only a path whose FILE existed counts as "deleted". A
                    // record without a file (ghost bookkeeping from older partial removals) is
                    // stale-record cleanup — reporting it as a deleted file told operators that
                    // content vanished when nothing on disk changed.
                    if (existedOnDisk) {
                      removedFiles.push(projRelPath);
                    } else {
                      staleRecords.push(projRelPath);
                    }
                    // Drop the pointer from its canonical record too: a surviving canonical that
                    // still lists this path sends `agents doctor` hunting for a projection that is
                    // deliberately gone ("Missing projection …" storm). The fallback lane spells
                    // canonicals `.agents/<sub>/<file>`, the files map `<sub>/<file>` — try both.
                    const canonicalKey = (proj.canonical ?? '').replace(/^\.agents\//, '');
                    for (const key of new Set([proj.canonical ?? '', canonicalKey])) {
                      const rec = key ? lockfile.files[key] : undefined;
                      if (rec?.projectedTo) {
                        rec.projectedTo = rec.projectedTo.filter(p => p !== projRelPath);
                        if (rec.projectedTo.length === 0) delete rec.projectedTo;
                      }
                    }
                  } else {
                    // Survives for its remaining owners: report it as kept, not removed.
                    keptFiles.push(projRelPath);
                    proj.owners.forEach(o => retainedOwners.add(o));
                  }
                }
              }
            }

            for (const [relPath, assetMeta] of Object.entries(lockfile.files)) {
              const recordOwners = assetOwners(assetMeta);
              if (!recordOwners.includes(bundleName)) continue;

              const newOwners = recordOwners.filter(o => o !== bundleName);
              if (newOwners.length === 0) {
                // Last owner removed: drop the recorded projections, then the canonical file.
                if (assetMeta.projectedTo && assetMeta.projectedTo.length > 0) {
                  await this.removeProjections(workspaceRoot, assetMeta.projectedTo, options.force, lockfile.projections);
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
                keptFiles.push(relPath);
                newOwners.forEach(o => retainedOwners.add(o));
              }
            }

            // Prune the managed subdirectories once empty — a removal that leaves `.agents/agents/`
            // behind as an empty shell reads as residue to the operator even though nothing in it is
            // tracked anymore. Projections already do this via removeEmptyProjectionDirs.
            for (const dir of [subPaths.agentsDir, subPaths.skillsDir, subPaths.workflowsDir, subPaths.rulesDir]) {
              if (await fs.pathExists(dir)) {
                const entries = await fs.readdir(dir).catch(() => [] as string[]);
                if (entries.length === 0) {
                  await fs.remove(dir);
                }
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
              if (!bdef) {
                // Unbundled survivor (`domain:*` pseudo-entry or unknown identifier): it has no
                // declaration to read, so what it still owns in the lockfile IS its roster.
                for (const [relPath, meta] of Object.entries(lockfile.files)) {
                  if (assetOwners(meta).includes(b)) survival.add(relPath);
                }
                continue;
              }
              if (bdef.orchestrator) survival.add(`agents/${bdef.orchestrator}`);
              (bdef.agents || []).forEach(a => survival.add(`agents/${a}`));
              (bdef.skills || []).forEach(s => survival.add(`skills/${s}/SKILL.md`));
              (bdef.workflows || []).forEach(w => survival.add(`workflows/${w}`));
            }
            lockfile.installed.agents = lockfile.installed.agents.filter(a => survival.has(`agents/${a}`));
            lockfile.installed.skills = lockfile.installed.skills.filter(s => survival.has(`skills/${s}/SKILL.md`));
            if (lockfile.installed.workflows) {
              lockfile.installed.workflows = lockfile.installed.workflows.filter(w => survival.has(`workflows/${w}`));
            }

            // Installed-addon freshness (plan 003): a removed child bundle restores
            // its addon into the parent's recommendedAddons via a re-render here.
            await this.refreshParentCoordination(bundleName, workspaceRoot, lockfile, scope);

            await fs.writeJson(subPaths.lockfile, lockfile, { spaces: 2 });
          } else {
            // Dry run: report the same refcount outcome the real pass would produce, without
            // mutating anything — "would remove 84" when every asset is co-owned is a lie.
            for (const [relPath, m] of Object.entries(lockfile.files)) {
              const owners = assetOwners(m);
              if (!owners.includes(bundleName)) continue;
              const remaining = owners.filter(o => o !== bundleName);
              (remaining.length === 0 ? removedFiles : keptFiles).push(relPath);
              remaining.forEach(o => retainedOwners.add(o));
            }
            for (const [projRelPath, proj] of Object.entries(lockfile.projections || {})) {
              const owners = projectionOwners(projRelPath, proj);
              if (!owners.includes(bundleName)) continue;
              const remaining = owners.filter(o => o !== bundleName);
              (remaining.length === 0 ? removedFiles : keptFiles).push(projRelPath);
              remaining.forEach(o => retainedOwners.add(o));
            }
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
      totalKept.push(...keptFiles);
      totalStale.push(...staleRecords);
    }

    // "Nothing deleted" is not "nothing found": a removal whose assets are all co-owned legitimately
    // deletes nothing and keeps every record for the remaining owners. Only a removal that matched
    // no records at all is an error.
    if (totalRemoved.length === 0 && totalKept.length === 0 && totalStale.length === 0 && !options.dryRun) {
      throw new Error(`No installed assets found matching "${identifier}".`);
    }

    return {
      removed: totalRemoved,
      kept: totalKept,
      staleRecords: totalStale,
      retainedOwners: [...retainedOwners].sort(),
      targetDirs,
      dryRun: options.dryRun || false,
    };
  }
}
