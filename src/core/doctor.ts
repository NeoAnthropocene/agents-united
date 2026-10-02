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
import { AntigravityProjector } from './antigravity-projector.js';
import { RegistryResolver, loadTranslationLedger } from './registry.js';
import { McpLocationRegistry } from './mcp-locations.js';
import { ANTIGRAVITY_GUARD_SCRIPT, ANTIGRAVITY_HOOKS_FILE, ANTIGRAVITY_HOOK_NAME, inspectAntigravityHook, loadGuardHookEntry } from './antigravity-hooks.js';
import { inspectAntigravityNativeAgent, inspectClineNativeAgent, inspectNativeAgent, nativeGuardProblem } from './native-guard.js';
import { assetOwners } from './types.js';
import { inspectSessionGuard, sessionGuardSnippet } from './session-guard.js';
import { isSidecarDir, resolveStateDir, workspaceRootOf } from './state-dir.js';
import type {
  ClaudeCapabilityReport,
  ClineCapabilityReport,
  LockfileManifest,
  TranslationLedgerEntry,
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
  /** Plan 023 A — plain-session guard state; absent when no decision was ever recorded. */
  sessionGuard?: 'wired' | 'missing' | 'modified' | 'skipped-invalid' | 'off';
  /** Plan 024 S4 — command-permission preset state; absent when no decision was ever recorded. */
  permissionPreset?: 'wired' | 'missing' | 'skipped-invalid' | 'off';
  /**
   * Plan 026 Objective 3 — the Declared-Delta Registry entries (`registry/
   * translation-ledger.json`) for `host` that are `degraded` or `unsupported`: what does
   * not carry over to this host, in the user's own vocabulary. Present only when `host`
   * was recognized (a known Declared-Delta Registry host); absent for an unknown/omitted
   * host so the CLI never guesses.
   */
  declaredDeltas?: TranslationLedgerEntry[];
}

/** Hosts the Declared-Delta Registry (Plan 026) carries entries for. */
const DECLARED_DELTA_HOSTS = new Set(['claude', 'antigravity', 'cline']);

/** The only hosts that own a content-derived compound lane: Cline (ADR 0013), Claude (ADR 0018). */
type CompoundLaneHost = 'cline' | 'claude' | 'antigravity';

/**
 * Plan 029 A3 — the hosts whose MCP configuration surface `agents doctor --host <h>` audits.
 * `agents` is deliberately absent: the canonical store configures no MCP servers itself.
 */
const MCP_AUDIT_HOSTS: ReadonlySet<string> = new Set(['claude', 'antigravity', 'cline']);

/**
 * Plan 029 A3 — the McpLocationRegistry host key each audited host's config is discovered under.
 * Antigravity reads the Gemini config surface (`~/.gemini/config/mcp_config.json`, ADR 0009), which
 * the registry files under the `gemini` host key.
 */
const MCP_LOCATION_HOST: Record<string, string> = {
  claude: 'claude',
  antigravity: 'gemini',
  cline: 'cline',
};

/**
 * Plan 029 A3 — the host's own command for registering a server, PRINTED for the user to run.
 * `agents doctor` never executes it, never installs a server and never writes an MCP config file.
 */
function mcpAddCommand(host: string, server: string, workspaceRoot: string): string {
  if (host === 'antigravity') {
    return `Add it with: agy mcp add ${server} -- <command> [args...]`;
  }
  if (host === 'cline') {
    const settingsPath = McpLocationRegistry.getPrimaryWritePath('cline', workspaceRoot);
    return `Add it with the interactive wizard: cline mcp install|add <name> (or cline config mcp for the current list); settings live in ${settingsPath}.`;
  }
  return `Add it with: claude mcp add ${server} -- <command> [args...]`;
}

/** A projection that now serves the same canonical at a different path. */
interface SupersedingProjection {
  relPath: string;
  host: string;
  owners: string[];
}

export class DoctorEngine {
  private static async isManagedProjection(absPath: string, isAgentsMd: boolean, recordedHash?: string): Promise<boolean> {
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

  private static isCompoundLaneHost(host: string | undefined): host is CompoundLaneHost {
    return host === 'cline' || host === 'claude' || host === 'antigravity';
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
    host: CompoundLaneHost,
    nativeLane = false
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
          const artifacts = host === 'antigravity'
            ? (await AntigravityProjector.plan(resolved, registryDir)).artifacts
            : host === 'cline'
            ? await ClineProjector.planCompoundProjection(
                bundleDef,
                'project',
                resolved,
                registryDir,
                excludeAddons,
                nativeLane
              )
            : await ClaudeProjector.planCompoundProjection(
                bundleDef,
                'project',
                resolved,
                registryDir,
                excludeAddons,
                nativeLane
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

  /**
   * Plan 029 A3 — the servers the INSTALLED roles declare, read from each state-dir agent's
   * `mcpServers:` frontmatter. Names only: a credential, an `env` block or an inline server
   * definition never reaches this set (Risk R4).
   */
  private static async declaredMcpServers(agentsDir: string): Promise<string[]> {
    const names = new Set<string>();
    if (!(await fs.pathExists(agentsDir))) return [];
    for (const file of (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'))) {
      const content = await fs.readFile(path.join(agentsDir, file), 'utf8').catch(() => null);
      if (content === null) continue;
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) continue;
      let meta: { mcpServers?: unknown } | undefined;
      try {
        meta = YAML.parse(match[1]) ?? undefined;
      } catch {
        continue; // a malformed frontmatter is reported by the frontmatter check, never guessed at
      }
      const entries = Array.isArray(meta?.mcpServers) ? (meta?.mcpServers as unknown[]) : [];
      for (const entry of entries) {
        const name =
          typeof entry === 'string' ? entry : (entry as { name?: unknown } | null)?.name;
        if (typeof name === 'string' && name.trim().length > 0) names.add(name.trim());
      }
    }
    return [...names].sort();
  }

  /**
   * Plan 029 A3 — warn for every server an installed role declares that this host has NOT
   * configured, printing that host's own add command. STRICTLY READ-ONLY: doctor reads the MCP
   * location registry, never installs a server and never writes a config file (the printed command
   * belongs to the user, and is never executed here).
   */
  private static async auditMcpServers(
    host: string,
    workspaceRoot: string,
    agentsDir: string,
    warnings: string[]
  ): Promise<string[]> {
    const declared = await DoctorEngine.declaredMcpServers(agentsDir);
    if (declared.length === 0) return [];

    const discovered = await McpLocationRegistry.discoverForHosts(
      [MCP_LOCATION_HOST[host]],
      workspaceRoot
    );
    const configured = new Set<string>();
    for (const location of discovered) {
      for (const server of Object.keys(location.servers ?? {})) configured.add(server.toLowerCase());
    }

    const unconfigured = declared.filter(server => !configured.has(server.toLowerCase()));
    for (const server of unconfigured) {
      warnings.push(
        `MCP server "${server}" is declared by the installed roles but not configured for ` +
          `--host ${host}. ${mcpAddCommand(host, server, workspaceRoot)}`
      );
    }
    return unconfigured;
  }

  public static async runDoctor(targetDir?: string, host?: string): Promise<HealthReport> {
    // Plan 023 B — the state dir: the `.agents/` store or the store-less `.claude/.agents-united/` sidecar.
    const root = resolveStateDir('project', targetDir);
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
              // A native Antigravity agent leaves `model` to the host default (`inherit`, ADR 0030 decision 8); the repository tests validate it.
              if (!meta.model && !content.includes('profile: antigravity-native')) warnings.push(`Agent ${file} missing 'model' definition.`);
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
      const workspaceRoot = workspaceRootOf(root);

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
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md', manifest.projections?.[projPath]?.hash);
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
            const managed = await this.isManagedProjection(absPath, projRelPath === 'AGENTS.md', proj.hash);
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
          const variants = await this.renderProjectionVariants(owners, manifest.installed.bundles ?? [], projHost, projHost === 'claude' ? manifest.nativeLane === true : manifest.nativeLanes?.[projHost] === true);
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
                  (owner ? ` Run: agents update ${owner}${proj.host === 'antigravity' ? ' --native' : ` --fanout ${proj.host}`} to restore it.` : '')
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
                (owner ? ` Run: agents update ${owner}${proj.host === 'antigravity' ? ' --native' : ` --fanout ${proj.host}`} to refresh it.` : '')
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

    // Plan 023 B (ADR 0022) — the store-less sidecar is a machine-owned snapshot, so any byte
    // change to a recorded file is drift (the `.agents/` store stays user-editable, unchecked).
    if (manifest && isSidecarDir(root)) {
      for (const [relPath, meta] of Object.entries(manifest.files)) {
        const abs = path.join(root, relPath);
        if (!meta.hash || !await fs.pathExists(abs)) continue;
        const diskHash = `sha256:${crypto.createHash('sha256').update(await fs.readFile(abs)).digest('hex')}`;
        if (diskHash !== meta.hash) {
          warnings.push(`Sidecar snapshot modified: ${relPath} — .claude/.agents-united/ is machine-owned. Run 'agents update --force' to restore it.`);
        }
      }
    }

    // Plan 023 A — plain-session guard. Reported whenever a decision is recorded; repairs are
    // never automatic (a hand-edited guard or an unparseable settings file is the user's call).
    let sessionGuard: HealthReport['sessionGuard'];
    const guardRecord = manifest?.sessionGuard;
    if (guardRecord) {
      if ('off' in guardRecord) {
        sessionGuard = 'off';
      } else {
        const guardFile = path.isAbsolute(guardRecord.file)
          ? guardRecord.file
          : path.join(workspaceRootOf(root), guardRecord.file);
        const state = await inspectSessionGuard(guardFile);
        sessionGuard = state === 'absent' ? 'missing' : state;
        if (state === 'missing' || state === 'absent') {
          warnings.push(`Session guard missing from ${guardRecord.file}: plain Claude sessions are unguarded. Run 'agents update' to restore it.`);
        } else if (state === 'modified') {
          warnings.push(`Session guard in ${guardRecord.file} was edited by hand; agents-united leaves it as-is.`);
        } else if (state === 'skipped-invalid') {
          warnings.push(`Session guard not wired: ${guardRecord.file} is not valid JSON (comments or trailing commas?), so agents-united left it untouched. Paste this into it by hand:\n${sessionGuardSnippet()}`);
        }
      }
    }

    // Plan 024 S4 — command-permission preset. Reported whenever a decision is recorded; a user
    // who removed an entry by hand is left alone (never auto-repaired).
    let permissionPreset: HealthReport['permissionPreset'];
    const presetRecord = manifest?.permissionPreset;
    if (presetRecord) {
      if ('off' in presetRecord) {
        permissionPreset = 'off';
      } else {
        const presetFile = path.isAbsolute(presetRecord.file)
          ? presetRecord.file
          : path.join(workspaceRootOf(root), presetRecord.file);
        if (!await fs.pathExists(presetFile)) {
          permissionPreset = 'missing';
          warnings.push(`Permission preset missing: ${presetRecord.file} not found. Run 'agents update' to restore it.`);
        } else {
          const text = await fs.readFile(presetFile, 'utf8').catch(() => null);
          let parsed: { permissions?: { allow?: unknown[] } } | null = null;
          try {
            parsed = text === null ? null : JSON.parse(text);
          } catch {
            parsed = null;
          }
          if (parsed === null) {
            permissionPreset = 'skipped-invalid';
            warnings.push(`Permission preset not wired: ${presetRecord.file} is not valid JSON (comments or trailing commas?), so agents-united left it untouched.`);
          } else {
            const allow = parsed.permissions?.allow ?? [];
            const stillPresent = presetRecord.entries.every(e => allow.includes(e));
            permissionPreset = stillPresent ? 'wired' : 'missing';
            if (!stillPresent) {
              warnings.push(`Permission preset partially removed from ${presetRecord.file}. Run 'agents update' to restore it, or --no-permission-preset to drop it for good.`);
            }
          }
        }
      }
    }

    // Plan 026 Objective 3 — surface the Declared-Delta Registry's degraded/unsupported
    // features for a recognized host, independent of which host-specific probe (if any)
    // also runs below. An unrecognized/omitted host yields no section (never guessed).
    let declaredDeltas: TranslationLedgerEntry[] | undefined;
    if (host && DECLARED_DELTA_HOSTS.has(host)) {
      // The ledger lives beside the package's own `registry/`, not the CWD (this runs from
      // an arbitrary workspace directory via the installed CLI) — resolve it the same way
      // RegistryResolver does, module-relative with a CWD fallback.
      const ledger = loadTranslationLedger(new RegistryResolver().getRegistryDir());
      declaredDeltas = ledger.filter(
        e => e.host === host && (e.disposition === 'degraded' || e.disposition === 'unsupported')
      );
    }

    // Plan 029 A3 — MCP access audit (read-only). Every server an installed role declares that
    // this host has not configured is reported with the host's own add command; doctor never
    // installs a server and never writes an MCP config file.
    if (host && MCP_AUDIT_HOSTS.has(host)) {
      await DoctorEngine.auditMcpServers(host, workspaceRootOf(root), subPaths.agentsDir, warnings);
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

    // Plan 032 Phase 7 — a native package is the product, so users get no translation report. What does concern them is
    // safety: an installed native role that can run a shell or write files must still carry its guard. Integrity
    // (edits, stale installs) is already covered by the projection hash and freshness checks above.
    if (host === 'claude' && manifest?.nativeLane === true) {
      const workspaceRoot = workspaceRootOf(root);
      for (const [relPath, proj] of Object.entries(manifest.projections ?? {})) {
        const match = proj.host === 'claude' && proj.kind === 'role' ? /^\.claude\/agents\/([a-z0-9-]+)\.md$/.exec(relPath) : null;
        if (!match) continue;
        const abs = path.join(workspaceRoot, relPath);
        if (!await fs.pathExists(abs)) continue; // missing is reported above
        const text = await fs.readFile(abs, 'utf8');
        if (!text.includes('profile: claude-native')) continue;
        const problem = nativeGuardProblem(inspectNativeAgent(text));
        if (problem) {
          const owner = proj.owners[0];
          warnings.push(`Native agent ${match[1]} ${problem}.` + (owner ? ` Run: agents update ${owner} --fanout claude to restore it.` : ''));
        }
      }
    }

    // Plan 032 Phase 8 — the same two safety properties for the Cline native lane, whichever host the doctor was asked about,
    // because both are recorded in the lockfile: a native role that can run commands or edit files needs the guard plugin, and a
    // native skill is not in effect when a copy of the same name in `.agents/skills` shadows it (observed: `.agents/skills` wins).
    if (manifest?.nativeLanes?.cline === true) {
      const workspaceRoot = workspaceRootOf(root);
      const projections = Object.entries(manifest.projections ?? {}).filter(([, proj]) => proj.host === 'cline');
      const guardPlugins = projections.filter(([, proj]) => proj.kind === 'plugin').map(([relPath]) => relPath);
      const guardPresent = guardPlugins.length > 0 && (await Promise.all(guardPlugins.map(relPath => fs.pathExists(path.join(workspaceRoot, relPath))))).every(Boolean);
      for (const [relPath, proj] of projections) {
        const role = proj.kind === 'role' ? /^\.cline\/agents\/([a-z0-9-]+)\.yml$/.exec(relPath) : null;
        if (role) {
          const abs = path.join(workspaceRoot, relPath);
          if (!await fs.pathExists(abs)) continue; // missing is reported above
          const text = await fs.readFile(abs, 'utf8');
          if (!text.includes('profile: cline-native')) continue;
          if (inspectClineNativeAgent(text).holdsWriter && !guardPresent) {
            const owner = proj.owners[0];
            warnings.push(
              `Native agent ${role[1]} can run commands or edit files, but its guard plugin (.cline/plugins/agents-united-guard.js) is missing.` +
              (owner ? ` Run: agents update ${owner} --fanout cline to restore it.` : '')
            );
          }
        }
        const skill = proj.kind === 'skill' ? /^\.cline\/skills\/([a-z0-9-]+)\/SKILL\.md$/.exec(relPath) : null;
        if (skill && await fs.pathExists(path.join(workspaceRoot, '.agents', 'skills', skill[1], 'SKILL.md'))) {
          warnings.push(
            `Skill .agents/skills/${skill[1]} shadows .cline/skills/${skill[1]}: Cline loads the .agents copy first (observed on CLI 3.0.68), so the native skill is not in effect. Rename or remove the .agents copy.`
          );
        }
      }
    }

    // Plan 032 Phase 8 — the same safety property for the Antigravity native lane: a native role that can run commands or edit files
    // needs the guard hook to be in effect, which means the script is there and `.agents/hooks.json` holds our key, as shipped and
    // switched on. Only our key is looked at, so a hook the user added is never reported (and never read as drift).
    if (manifest?.nativeLanes?.antigravity === true) {
      const workspaceRoot = workspaceRootOf(root);
      const writers: string[] = [];
      let owner: string | undefined;
      for (const [relPath, proj] of Object.entries(manifest.projections ?? {})) {
        const role = proj.host === 'antigravity' && proj.kind === 'role' ? /^\.agents\/agents\/([a-z0-9-]+)\.md$/.exec(relPath) : null;
        if (!role) continue;
        const abs = path.join(workspaceRoot, relPath);
        if (!await fs.pathExists(abs)) continue; // missing is reported above
        const text = await fs.readFile(abs, 'utf8');
        if (!text.includes('profile: antigravity-native') || !inspectAntigravityNativeAgent(text).holdsWriter) continue;
        writers.push(role[1]);
        owner ??= proj.owners[0];
      }
      if (writers.length > 0) {
        const scriptPresent = manifest.projections?.[ANTIGRAVITY_GUARD_SCRIPT] !== undefined && await fs.pathExists(path.join(workspaceRoot, ANTIGRAVITY_GUARD_SCRIPT));
        const state = scriptPresent
          ? await inspectAntigravityHook(path.join(workspaceRoot, ANTIGRAVITY_HOOKS_FILE), loadGuardHookEntry(new RegistryResolver().getRegistryDir()))
          : 'script-missing';
        const reasons: Record<string, string | undefined> = {
          'script-missing': `its script ${ANTIGRAVITY_GUARD_SCRIPT} is missing`,
          absent: `${ANTIGRAVITY_HOOKS_FILE} does not exist`,
          'skipped-invalid': `${ANTIGRAVITY_HOOKS_FILE} is not valid JSON, so the hook cannot be verified`,
          missing: `${ANTIGRAVITY_HOOKS_FILE} has no '${ANTIGRAVITY_HOOK_NAME}' entry`,
          disabled: `the '${ANTIGRAVITY_HOOK_NAME}' entry in ${ANTIGRAVITY_HOOKS_FILE} is disabled (enabled: false)`,
          modified: `the '${ANTIGRAVITY_HOOK_NAME}' entry in ${ANTIGRAVITY_HOOKS_FILE} was edited by hand`,
        };
        const reason = reasons[state];
        if (reason) {
          const handEdited = state === 'disabled' || state === 'modified' || state === 'skipped-invalid';
          warnings.push(
            `Native agent${writers.length > 1 ? 's' : ''} ${writers.join(', ')} can run commands or edit files, but the guard hook is not in effect: ${reason}.` +
            (owner ? ` ${handEdited ? 'Fix or remove it by hand, then run' : 'Run'}: agents update ${owner} --native to restore it.` : '')
          );
        }
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
      permissionPreset,
      clineCapability,
      claudeCapability,
      sessionGuard,
      declaredDeltas,
    };
  }
}
