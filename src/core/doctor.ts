import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { AgentHostAdapter } from './adapter.js';
import { HostProjector } from './projector.js';
import { ClineCapabilityProbe } from './cline-capabilities.js';
import { ClineProjector } from './cline-projector.js';
import { RegistryResolver } from './registry.js';
import type { ClineCapabilityReport, LockfileManifest } from './types.js';

export interface HealthReport {
  valid: boolean;
  targetDir: string;
  isInitialized: boolean;
  issues: string[];
  warnings: string[];
  agentsCount: number;
  skillsCount: number;
  workflowsCount: number;
  clineCapability?: ClineCapabilityReport;
}

export class DoctorEngine {
  private static async isManagedProjection(absPath: string, isAgentsMd: boolean): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    return HostProjector.hasManagedMarker(content);
  }

  /**
   * ADR 0017 — re-render the compound projections owned by the installed bundles so
   * doctor can compare what is on disk with what the current renderer produces.
   *
   * Returns projection path -> acceptable content variants, or `null` when the registry
   * is unavailable (the freshness check is then skipped rather than guessed).
   *
   * Two variants are produced per path on purpose: the coordinator rule and team manifest
   * legitimately render either with or without the installed-bundle addon exclusions
   * (installer primary path vs parent-bundle refresh path). Matching *either* means the
   * projection is fresh, which keeps the check false-positive free while still catching
   * content that matches neither.
   */
  private static async renderProjectionVariants(
    owners: Set<string>,
    installedBundles: string[]
  ): Promise<Map<string, string[]> | null> {
    if (owners.size === 0) return null;

    let resolver: RegistryResolver;
    try {
      resolver = new RegistryResolver();
      await resolver.loadBundles();
    } catch {
      return null;
    }

    const registryDir = resolver.getRegistryDir();
    const variants = new Map<string, string[]>();

    for (const owner of owners) {
      try {
        const bundleDef = await resolver.getBundle(owner);
        if (!bundleDef) continue; // 'domain:*' pseudo-entries and retired bundles

        const resolved = await resolver.resolve(bundleDef.name);
        for (const excludeAddons of [undefined, installedBundles]) {
          const artifacts = await ClineProjector.planCompoundProjection(
            bundleDef,
            'project',
            resolved,
            registryDir,
            excludeAddons
          );

          for (const artifact of artifacts) {
            if (artifact.content === undefined) continue;
            const list = variants.get(artifact.relPath) ?? [];
            if (!list.includes(artifact.content)) list.push(artifact.content);
            variants.set(artifact.relPath, list);
          }
        }
      } catch {
        continue; // degrade gracefully — never emit a speculative warning
      }
    }

    return variants;
  }

  public static async runDoctor(targetDir?: string, host?: string): Promise<HealthReport> {
    const root = AgentHostAdapter.resolveHostDir('project', 'agents', targetDir);
    const subPaths = AgentHostAdapter.getSubPaths(root);

    const issues: string[] = [];
    const warnings: string[] = [];

    let agentsCount = 0;
    let skillsCount = 0;
    let workflowsCount = 0;
    let manifest: LockfileManifest | undefined;
    let clineCapability: ClineCapabilityReport | undefined;
    let isInitialized = false;

    const lockfileExists = await fs.pathExists(subPaths.lockfile);
    const agentsDirExists = await fs.pathExists(subPaths.agentsDir);

    // Check Lockfile
    if (lockfileExists) {
      try {
        const parsed: LockfileManifest = await fs.readJson(subPaths.lockfile);
        manifest = parsed;
        agentsCount = parsed.installed?.agents?.length || 0;
        skillsCount = parsed.installed?.skills?.length || 0;
        // ADR 0016 unified workflows into skills: `installed.workflows` is a
        // deprecated legacy field that stays empty on modern installs, so reading it
        // made the report show "Installed Workflows: 0" even when workflow skills
        // were installed and projected. Count workflow skills (plus any legacy
        // entries) so the number reflects reality. Note this is a SUBSET of
        // `skillsCount`, not a partition — the CLI labels it "Workflow Skills".
        const legacyWorkflows = parsed.installed?.workflows?.length || 0;
        const workflowSkillCount = (parsed.installed?.skills || [])
          .filter(s => String(s).startsWith('workflow-')).length;
        workflowsCount = legacyWorkflows + workflowSkillCount;
        isInitialized = true;
      } catch (err: any) {
        issues.push(`Corrupt lockfile at ${subPaths.lockfile}: ${err.message}`);
      }
    } else if (agentsDirExists) {
      warnings.push(`No lockfile found at ${subPaths.lockfile}, but agent files were detected in ${subPaths.agentsDir}. Run 'agents update' to sync.`);
    }

    // Validate Agents YAML Frontmatter
    if (await fs.pathExists(subPaths.agentsDir)) {
      const agentFiles = await fs.readdir(subPaths.agentsDir);
      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(subPaths.agentsDir, file), 'utf8');
          const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
          if (!frontmatterMatch) {
            warnings.push(`Agent ${file} is missing YAML frontmatter.`);
          } else {
            try {
              const meta = YAML.parse(frontmatterMatch[1]);
              if (!meta.name) issues.push(`Agent ${file} missing 'name' in frontmatter.`);
              if (!meta.description) warnings.push(`Agent ${file} missing 'description'.`);
              if (!meta.model) warnings.push(`Agent ${file} missing 'model' definition.`);
            } catch (err: any) {
              issues.push(`Invalid YAML in agent ${file}: ${err.message}`);
            }
          }
        }
      }
    }

    // Check for unmigrated legacy workflows (ADR 0016)
    if (await fs.pathExists(subPaths.workflowsDir)) {
      const remainingWorkflowFiles = (await fs.readdir(subPaths.workflowsDir)).filter(f => f.endsWith('.md'));
      if (remainingWorkflowFiles.length > 0) {
        warnings.push(`Detected ${remainingWorkflowFiles.length} legacy workflows in ${subPaths.workflowsDir}. Run 'agents update' to automatically migrate them to modern skills.`);
      }
    }

    // Projection checks: verify each recorded `projectedTo` and `projections` path
    if (manifest) {
      const workspaceRoot = path.resolve(path.dirname(root));

      // 1. Check legacy/compatible projectedTo
      for (const [relPath, assetMeta] of Object.entries(manifest.files)) {
        const projectedTo = assetMeta.projectedTo;
        if (!projectedTo || projectedTo.length === 0) continue;
        for (const projPath of projectedTo) {
          const absProjection = path.join(workspaceRoot, projPath);
          if (!await fs.pathExists(absProjection)) {
            // Plan 015 §5.9 item 3 — distinguish a RENAMED/superseded projection
            // (the same canonical is served by a newer path, so `agents update
            // --fanout` self-heals it) from one the user DELETED (which must keep
            // the "Missing projection" advice).
            let superseding: { relPath: string; host: string; owners: string[] } | null = null;
            for (const [projRelPath, proj] of Object.entries(manifest.projections ?? {})) {
              if (projRelPath === projPath) continue;
              if (proj.canonical !== relPath) continue;
              if (!await fs.pathExists(path.join(workspaceRoot, projRelPath))) continue;
              superseding = { relPath: projRelPath, host: proj.host, owners: proj.owners ?? [] };
              break;
            }

            if (superseding) {
              const owner = superseding.owners[0];
              warnings.push(
                `Stale projection ${projPath} for canonical ${relPath} (superseded by ${superseding.relPath}).` +
                (owner ? ` Run: agents update ${owner} --fanout ${superseding.host} to reconcile.` : '')
              );
            } else {
              warnings.push(
                `Missing projection ${projPath} for canonical ${relPath}. Re-run: agents add ... --fanout`
              );
            }
            continue;
          }
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md');
          if (!managed) {
            warnings.push(`user-modified projection ${projPath}`);
          }
        }
      }

      // 2. Check compound projections
      if (manifest.projections) {
        for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
          const absPath = path.join(workspaceRoot, projRelPath);
          if (!await fs.pathExists(absPath)) {
            warnings.push(`Missing Cline projection ${projRelPath} (owners: ${proj.owners.join(', ')}).`);
            continue;
          }
          if (proj.managedMarker) {
            const managed = await this.isManagedProjection(absPath, projRelPath === 'AGENTS.md');
            if (!managed) {
              warnings.push(`user-modified projection ${projRelPath}`);
            }
          }
        }
      }

      // 2b. ADR 0017 — renderer-backed freshness. Presence and marker integrity cannot
      //     reveal a projection rendered from an older bundle definition (the on-disk
      //     hash still matches what was recorded), so the only reliable check is to
      //     re-render with the current registry and diff. Exactly one warning is raised
      //     per path, attributed to the actual cause.
      if (manifest.projections && manifest.installed) {
        const ownerNames = new Set<string>();
        for (const proj of Object.values(manifest.projections)) {
          for (const owner of proj.owners) ownerNames.add(owner);
        }

        const expectedVariants = await this.renderProjectionVariants(ownerNames, manifest.installed.bundles ?? []);
        if (expectedVariants) {
          for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
            const absPath = path.join(workspaceRoot, projRelPath);
            if (!await fs.pathExists(absPath)) continue;  // missing/stale reported above
            if (!proj.managedMarker) continue;            // unmanaged artifacts are not ours
            const content = await fs.readFile(absPath, 'utf8');
            if (!HostProjector.hasManagedMarker(content)) continue; // user-modified reported above

            // Content drift — edited after installation, marker left intact.
            if (proj.hash) {
              const diskHash = `sha256:${crypto.createHash('sha256').update(await fs.readFile(absPath)).digest('hex')}`;
              if (diskHash !== proj.hash) {
                const owner = proj.owners[0];
                warnings.push(
                  `Content drift ${projRelPath} — edited after installation (recorded ${proj.hash.slice(0, 16)}…, on disk ${diskHash.slice(0, 16)}…).` +
                  (owner ? ` Run: agents update ${owner} --fanout ${proj.host} to restore it.` : '')
                );
                continue;
              }
            }

            // Stale render — hash matches what was deployed, but the current renderer
            // would produce something different.
            const variants = expectedVariants.get(projRelPath);
            if (!variants || variants.length === 0) continue;
            const onDisk = content.replace(/\r\n/g, '\n');
            if (!variants.some(variant => variant.replace(/\r\n/g, '\n') === onDisk)) {
              const owner = proj.owners[0];
              warnings.push(
                `Outdated projection ${projRelPath} (content differs from the current render).` +
                (owner ? ` Run: agents update ${owner} --fanout ${proj.host} to refresh it.` : '')
              );
            }
          }
        }
      }

      // 3. Ownership cross-validation
      const installedBundles = manifest.installed?.bundles ?? [];
      const fileOwnersOf = (rec: { owners?: string[]; bundle?: string }): string[] =>
        rec.owners ?? (rec.bundle ? [rec.bundle] : []);

      // 3a. Projection owned by a bundle absent from installed.bundles
      if (manifest.projections) {
        for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
          for (const owner of proj.owners) {
            if (!installedBundles.includes(owner)) {
              warnings.push(`Projection ${projRelPath} is owned by bundle "${owner}" which is not in installed.bundles.`);
            }
          }
        }
      }
      // 3b. File-record owner absent from installed.bundles
      for (const [relPath, rec] of Object.entries(manifest.files)) {
        for (const owner of fileOwnersOf(rec)) {
          if (!installedBundles.includes(owner)) {
            warnings.push(`File record ${relPath} is owned by bundle "${owner}" which is not in installed.bundles.`);
          }
        }
      }
      // 3c. Installed bundle with zero owned file records
      for (const bundleName of installedBundles) {
        const fileCount = Object.values(manifest.files)
          .filter(m => fileOwnersOf(m).includes(bundleName)).length;
        if (fileCount === 0) {
          warnings.push(`Installed bundle "${bundleName}" owns zero file records.`);
        }
      }
    }

    // Host-specific checks (e.g. --host cline)
    if (host === 'cline') {
      const probe = new ClineCapabilityProbe();
      clineCapability = await probe.probe();
      if (!clineCapability.installed) {
        warnings.push('Cline executable was not detected on PATH or via CLINE_BIN_PATH.');
      }
    }

    return {
      valid: issues.length === 0,
      targetDir: root,
      isInitialized,
      issues,
      warnings,
      agentsCount,
      skillsCount,
      workflowsCount,
      clineCapability,
    };
  }
}
