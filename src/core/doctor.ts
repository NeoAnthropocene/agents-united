import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { AgentHostAdapter } from './adapter.js';
import { HostProjector } from './projector.js';
import { ClaudeCapabilityProbe } from './claude-capabilities.js';
import { ClaudeProjector } from './claude-projector.js';
import { ClineCapabilityProbe } from './cline-capabilities.js';
import { ClineProjector } from './cline-projector.js';
import { RegistryResolver } from './registry.js';
import { assetOwners } from './types.js';
import type {
  ClaudeCapabilityReport,
  ClineCapabilityReport,
  LockfileManifest,
} from './types.js';

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
  claudeCapability?: ClaudeCapabilityReport;
}

/** The only hosts that own a content-derived compound lane: Cline (ADR 0013), Claude (ADR 0018). */
type CompoundLaneHost = 'cline' | 'claude';

/** A projection that now serves the same canonical at a different path. */
interface SupersedingProjection {
  relPath: string;
  host: string;
  owners: string[];
}

export class DoctorEngine {
  private static async isManagedProjection(absPath: string, isAgentsMd: boolean): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    return HostProjector.hasManagedMarker(content);
  }

  private static isCompoundLaneHost(host: string | undefined): host is CompoundLaneHost {
    return host === 'cline' || host === 'claude';
  }

  /**
   * Plan 015 §5.9 item 3 / ADR 0018 decision 2 — find the projection that now serves
   * `canonical` at a *different* path and actually exists on disk. A hit turns an absent
   * recorded path into self-healing staleness (`Stale projection … (superseded by …)`)
   * instead of a user-deletion report.
   *
   * Covers every rename the lockfile can still carry: the ADR 0016 workflow slug rename
   * (`.cline/workflows/implement-feature-or-fix.md` → `…/workflow-implement.md`) and the
   * ADR 0018 prefix strip (`.claude/agents/subagent-<role>.md` → `.claude/agents/<role>.md`).
   */
  private static async findSupersedingProjection(
    projPath: string,
    canonical: string | undefined,
    manifest: LockfileManifest,
    workspaceRoot: string
  ): Promise<SupersedingProjection | null> {
    if (!canonical) return null;
    for (const [projRelPath, proj] of Object.entries(manifest.projections ?? {})) {
      if (projRelPath === projPath) continue;
      if (proj.canonical !== canonical) continue;
      if (!await fs.pathExists(path.join(workspaceRoot, projRelPath))) continue;
      return { relPath: projRelPath, host: proj.host, owners: proj.owners ?? [] };
    }
    return null;
  }

  /**
   * ADR 0017 — re-render the compound projections owned by the installed bundles so
   * doctor can compare what is on disk with what the current renderer produces.
   *
   * Returns projection path -> acceptable content variants **for `host` only**, or `null`
   * when the registry is unavailable (the freshness check is then skipped rather than
   * guessed).
   *
   * ADR 0018 decision 11 — the renderer is dispatched by the *recorded projection's* host.
   * Cline entries are diffed against `ClineProjector` output and Claude entries against
   * `ClaudeProjector` output; nothing else is comparable, and the Cline path is unchanged
   * because it renders exactly what it rendered before.
   *
   * Two variants are produced per path on purpose: the coordinator rule and team manifest
   * legitimately render either with or without the installed-bundle addon exclusions
   * (installer primary path vs parent-bundle refresh path). Matching *either* means the
   * projection is fresh, which keeps the check false-positive free while still catching
   * content that matches neither.
   */
  private static async renderProjectionVariants(
    owners: Set<string>,
    installedBundles: string[],
    host: CompoundLaneHost
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
          const artifacts = host === 'cline'
            ? await ClineProjector.planCompoundProjection(
                bundleDef,
                'project',
                resolved,
                registryDir,
                excludeAddons
              )
            : await ClaudeProjector.planCompoundProjection(
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
    let claudeCapability: ClaudeCapabilityReport | undefined;
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

      // ADR 0017 decision 2 — exactly one warning per projection path. The presence, marker
      // and content passes below all inspect the same recorded paths (one path is routinely
      // present in both `files[canonical].projectedTo` and `projections`), so the first
      // cause found for a path wins and every later pass stays silent for it instead of
      // double-reporting the same defect under two names.
      const warnedProjectionPaths = new Set<string>();
      const pushProjectionWarning = (projPath: string, message: string): void => {
        if (warnedProjectionPaths.has(projPath)) return;
        warnedProjectionPaths.add(projPath);
        warnings.push(message);
      };

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
            const superseding = await this.findSupersedingProjection(projPath, relPath, manifest, workspaceRoot);

            if (superseding) {
              const owner = superseding.owners[0];
              pushProjectionWarning(
                projPath,
                `Stale projection ${projPath} for canonical ${relPath} (superseded by ${superseding.relPath}).` +
                (owner ? ` Run: agents update ${owner} --fanout ${superseding.host} to reconcile.` : '')
              );
            } else {
              pushProjectionWarning(
                projPath,
                `Missing projection ${projPath} for canonical ${relPath}. Re-run: agents add ... --fanout`
              );
            }
            continue;
          }
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md');
          if (!managed) {
            pushProjectionWarning(projPath, `user-modified projection ${projPath}`);
          }
        }
      }

      // 2. Check compound projections (ADR 0013 Cline lane, ADR 0018 Claude lane).
      //    Same stale-vs-missing classification as §1: a recorded path whose canonical is
      //    now served by a different, existing path is a rename this CLI can self-heal —
      //    e.g. `.claude/agents/subagent-<role>.md` after the ADR 0018 decision 2 prefix
      //    strip — and must never be reported as a missing file, nor under Cline's name.
      if (manifest.projections) {
        for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
          const absPath = path.join(workspaceRoot, projRelPath);
          if (!await fs.pathExists(absPath)) {
            const superseding = await this.findSupersedingProjection(projRelPath, proj.canonical, manifest, workspaceRoot);
            if (superseding) {
              const owner = superseding.owners[0];
              pushProjectionWarning(
                projRelPath,
                `Stale projection ${projRelPath} for canonical ${proj.canonical} (superseded by ${superseding.relPath}).` +
                (owner ? ` Run: agents update ${owner} --fanout ${superseding.host} to reconcile.` : '')
              );
            } else {
              pushProjectionWarning(
                projRelPath,
                `Missing ${proj.host} projection ${projRelPath} (owners: ${proj.owners.join(', ')}).`
              );
            }
            continue;
          }
          if (proj.managedMarker) {
            const managed = await this.isManagedProjection(absPath, projRelPath === 'AGENTS.md');
            if (!managed) {
              pushProjectionWarning(projRelPath, `user-modified projection ${projRelPath}`);
            }
          }
        }
      }

      // 2b. ADR 0017 — renderer-backed freshness. Presence and marker integrity cannot
      //     reveal a projection rendered from an older bundle definition (the on-disk
      //     hash still matches what was recorded), so the only reliable check is to
      //     re-render with the current registry and diff. Exactly one warning is raised
      //     per path, attributed to the actual cause.
      //
      //     ADR 0018 decision 11 — variants are rendered PER HOST and a recorded
      //     projection is only ever diffed against its own host's renderer. Comparing a
      //     `.claude/**` entry against Cline variants (or vice versa) is meaningless: it
      //     made the Claude freshness check inert and risked reporting every Cline entry
      //     as outdated purely because Claude variants existed.
      if (manifest.projections && manifest.installed) {
        const ownersByHost = new Map<CompoundLaneHost, Set<string>>();
        for (const proj of Object.values(manifest.projections)) {
          if (!DoctorEngine.isCompoundLaneHost(proj.host)) continue;
          const owners = ownersByHost.get(proj.host) ?? new Set<string>();
          for (const owner of proj.owners) owners.add(owner);
          ownersByHost.set(proj.host, owners);
        }

        const variantsByHost = new Map<CompoundLaneHost, Map<string, string[]>>();
        for (const [projHost, owners] of ownersByHost) {
          const variants = await this.renderProjectionVariants(owners, manifest.installed.bundles ?? [], projHost);
          if (variants) variantsByHost.set(projHost, variants);
        }

        if (variantsByHost.size > 0) {
          for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
            const projHost = proj.host;
            if (!DoctorEngine.isCompoundLaneHost(projHost)) continue;
            const expectedVariants = variantsByHost.get(projHost);
            if (!expectedVariants) continue; // registry unavailable for this host — never guess
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
                pushProjectionWarning(
                  projRelPath,
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
              pushProjectionWarning(
                projRelPath,
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
        assetOwners(rec);

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

    // Host-specific checks (e.g. --host cline, --host claude)
    if (host === 'cline') {
      const probe = new ClineCapabilityProbe();
      clineCapability = await probe.probe();
      if (!clineCapability.installed) {
        warnings.push('Cline executable was not detected on PATH or via CLINE_BIN_PATH.');
      }
    } else if (host === 'claude') {
      // ADR 0018 decision 11 / Plan 016 decision 12 — read-only probe: `--version` and
      // `--help` only, never `claude agents --json` (daemon) and never headless `-p`.
      const probe = new ClaudeCapabilityProbe();
      claudeCapability = await probe.probe();
      if (!claudeCapability.installed) {
        warnings.push('Claude Code executable was not detected on PATH or via CLAUDE_BIN_PATH.');
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
      claudeCapability,
    };
  }
}
