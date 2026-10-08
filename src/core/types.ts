export type InstallScope = 'project' | 'global';

/**
 * Effective owners of a tracked asset (`AssetFileMeta` or a projection entry) at READ time.
 *
 * The type documents `owners` as "Absent ⇒ [bundle]", but legacy records store the installing bundle in
 * `bundle` and write `owners: []`. `??` alone does not fall back for those — `[]` is not nullish — so an
 * empty `owners` array read as "owned by nobody": the asset vanished from removal and became permanent
 * residue no `agents remove` could reach. Treat an empty `owners` as absent and fall back to `bundle`.
 *
 * READ-side only. At WRITE time an installer must seed from `existing?.owners` verbatim: `bundle` is who
 * *deployed* a record first, not who *declared* it, so an addon that merely deploys an inherited asset
 * must not be resurrected as its owner (the ownership contract is the Declared Asset Set — see A6 of the
 * lifecycle conformance suite).
 */
export function assetOwners(rec: { owners?: string[]; bundle?: string } | undefined | null): string[] {
  if (!rec) return [];
  const declared = rec.owners ?? [];
  if (declared.length > 0) return declared;
  return rec.bundle ? [rec.bundle] : [];
}

/**
 * Union an owner into a record's effective owners. Never replaces: shared assets are refcounted, so a
 * second bundle installing the same file must add itself alongside the existing owners, not overwrite
 * them (an overwrite silently drops the first bundle's claim and its removal then deletes or strands a
 * file another bundle still needs).
 */
export function mergeAssetOwners(
  rec: { owners?: string[]; bundle?: string } | undefined | null,
  owner: string | undefined
): string[] {
  const owners = assetOwners(rec);
  if (!owner) return owners;
  return owners.includes(owner) ? owners : [...owners, owner];
}
export type InstallMethod = 'symlink' | 'copy';
export type AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor' | 'cline' | 'opencode' | 'codex';

// Backward compatibility alias
export type Scope = InstallScope;

export type BundleTier = 'domain' | 'organization';
export type BundleStatus = 'stable' | 'experimental' | 'under-construction' | 'needs-audit' | 'deprecated';
export type ExecutionMode = 'operational' | 'limited-operational' | 'brainstorming';

export interface RequiredMcp {
  name: string;
  purpose?: string;
  optionalForBrainstorming?: boolean;
  /** An optional extra (Plan 035 N1): listed and shown, never counted as missing by the install gate or the doctor. */
  optional?: boolean;
}

export interface BundlePrerequisites {
  requiredMcps?: RequiredMcp[];
  requiredPackages?: string[];
  requiredEnvVars?: string[];
}

export interface BundleModes {
  operational?: string;
  brainstorming?: string;
}

export interface PrerequisiteItemCheck {
  type: 'mcp' | 'package' | 'env';
  name: string;
  purpose?: string;
  satisfied: boolean;
  status: 'ok' | 'missing' | 'partial';
  details?: string;
  optionalForBrainstorming?: boolean;
  /** Copied from `RequiredMcp.optional`: an unmet optional item does not stop `allSatisfied`. */
  optional?: boolean;
  detectedInHosts?: string[];
  missingInHosts?: string[];
}

export interface PrerequisiteEvaluation {
  bundleName: string;
  tier: BundleTier;
  hasPrerequisites: boolean;
  allSatisfied: boolean;
  operationalPossible: boolean;
  items: PrerequisiteItemCheck[];
  modes?: BundleModes;
}

/** ADR 0014 — declarative caps bounding all inter-agent planning dialogue. */
export interface ConsultationBudget {
  maxPlanningRounds: number;
  maxPeerExchangesPerPair: number;
  summaryWordCap: number;
  maxIterations: number;
}

/** ADR 0014/0015 — declarative planning-loop posture. Mode absent ⇒ 'subagent-first' (backward compat). */
export type PlanningLoopMode = 'subagent-first' | 'planner-orchestrator';

export interface PlanningLoopConfig {
  enabled: boolean;
  mode?: PlanningLoopMode;
  budget?: ConsultationBudget;
  sidekicks?: { max: number };
}

export interface BundleDefinition {
  name: string;
  version?: string;
  description: string;
  category?: string;
  domain?: string;
  tier?: BundleTier;
  status?: BundleStatus;
  parentBundle?: string;
  recommendedAddons?: string[];
  aliases?: string[];
  orchestrator?: string;
  agents?: string[];
  /** @deprecated ADR 0016: Workflows are unified into `skills`. Preserved for backward compatibility with legacy manifests. */
  workflows?: string[];
  skills?: string[];
  prerequisites?: BundlePrerequisites;
  modes?: BundleModes;
  /** ADR 0014 — opt-in Subagent-First Planning Dialogue Loop (digital-agency first). */
  planningLoop?: PlanningLoopConfig;
  /** ADR 0014 — AstrolabsAI persona → canonical roster role (`.md` stripped) map. */
  personaAliases?: Record<string, string>;
  /**
   * Plan 032 close-out (ADR 0036) — a bundle-scoped native role name: the bundle's canonical agent file (`subagent-<role>.md`) maps to
   * the native role the native lane installs for THIS bundle instead of the role of the same name, so a Tier-2 bundle can have its own
   * team-mode copy of a role it shares with a Tier-1 bundle. Absent for every other bundle; ignored when the lane is off.
   */
  nativeRoles?: Record<string, string>;
  /**
   * Plan 015 §0/C6d — optional bundle-level rule bindings. Forward-compatible:
   * no bundle in `registry/bundles.json` declares this today (agent frontmatter
   * `rules:` is the single source of truth). Adding it here keeps
   * `RegistryResolver.resolve()` ready for a future catalog-level declaration
   * without another schema change.
   */
  rules?: string[];
}

export interface BundlesManifest {
  $schema?: string;
  version: number;
  bundles: Record<string, BundleDefinition>;
}

export interface LockfileAsset {
  hash: string;
  bundle?: string;
  /** Every bundle whose Declared Asset Set contains this file. Absent ⇒ [bundle]. */
  owners?: string[];
  method?: InstallMethod;
  installedAt: string;
  /** Workspace-root-relative paths (forward slashes) of translated copies fanned out
   *  into other host runtimes (e.g. '.claude/agents/x.md', 'AGENTS.md'). Optional so
   *  pre-existing lockfiles without projections remain valid. */
  projectedTo?: string[];
}

export type ProjectionKind = 'role' | 'skill' | 'rule' | 'team-manifest' | 'workflow' | 'bridge' | 'plugin-manifest' | 'plugin' | 'hook';

export interface LockfileProjection {
  host: string;
  kind: ProjectionKind;
  canonical?: string;
  owners: string[];
  hash: string;
  installedAt: string;
  managedMarker: boolean;
}

/**
 * ADR 0018 — the structural shape every compound-lane projector emits
 * (`ClineProjector` / `ClaudeProjector`). The installer's compound lane is
 * host-parameterised against this shape, so Cline and Claude share one
 * implementation instead of a copy-paste fork.
 */
export interface PlannedProjectionArtifact {
  kind: ProjectionKind;
  canonical?: string;
  relPath: string;
  content?: string;
  sourceFilePath?: string;
  managedMarker: boolean;
  /**
   * ADR 0018 decision 12 — a **distribution-only** artifact (the opt-in Claude plugin lane).
   * It is deployed and tracked in `lockfile.projections`, but it is never a projection
   * *target*: no `projectedTo` pointer is recorded for it, because its namespace
   * (`.agents/plugins/<bundle>/`) belongs to the **cline** reconcile pass and a `claude`
   * pointer recorded there would be dropped on the next Cline install.
   */
  distributionOnly?: boolean;
  /**
   * Plan 032 Phase 8 — a native-only file (no canonical asset it stands for, for example a Cline plugin or the orchestrator
   * skill) is still declared by the bundle that installs it, so it is refcounted and removed with that bundle.
   */
  ownedByBundle?: boolean;
}

export interface ClineTeamManifest {
  schemaVersion: 1;
  bundle: string;
  scope: InstallScope;
  coordinator: { name: string; canonicalPath: string };
  roles: Array<{ name: string; canonicalPath: string }>;
  skills: string[];
  /** @deprecated ADR 0016: Workflows are unified into `skills`. Preserved for backward compatibility. */
  workflows?: string[];
  recommendedAddons: string[];
  activation: {
    preferred: 'named-team';
    fallbacks: Array<'adaptive-session' | 'single-orchestrator'>;
  };
  /** ADR 0014 — present when the bundle opts into the Planning Dialogue Loop. */
  planningLoop?: PlanningLoopConfig;
  /** ADR 0014 — persona → role pairs rendered from `BundleDefinition.personaAliases`. */
  personas?: Array<{ persona: string; role: string }>;
}

export type ResolvedClineCommand =
  | { executable: string; prefixArgs: string[]; source: 'env-binary' }
  | { executable: string; prefixArgs: string[]; source: 'node-wrapper' }
  | { executable: string; prefixArgs: string[]; source: 'path-executable' };

export type ClineActivationStrategy =
  | 'named-team'
  | 'adaptive-session'
  | 'single-orchestrator';

export interface ClineCapabilityReport {
  installed: boolean;
  version?: string;
  command?: ResolvedClineCommand;
  namedTeams: boolean;
  rolePresetConsumer: 'detected' | 'not-detected' | 'unknown';
  diagnostics: string[];
}

export type ResolvedClaudeCommand = {
  executable: string;
  prefixArgs: string[];
  source: 'env-binary' | 'node-wrapper' | 'path-executable';
};

/**
 * ADR 0018 decision 11 / Plan 016 decision 12 — the read-only Claude Code probe result.
 * `pluginSupport` is derived from `--help` text only and defaults to `false` when help output is
 * unavailable, so an unverifiable capability is never reported as supported. `agentTeamsExperimental`
 * is true when `--help` names agent teams or when the probed version is at or past the profile's
 * agent-teams floor (`features.agentTeams.since`): the feature is opt-in through
 * `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, and `--help` on 2.1.289 and 2.1.291 does not mention it.
 */
export interface ClaudeCapabilityReport {
  installed: boolean;
  version?: string;
  command?: ResolvedClaudeCommand;
  pluginSupport: boolean;
  agentTeamsExperimental: boolean;
  /**
   * Whether the probed runtime provides `SubagentHandback` — the subagent hand-off tool the live tools
   * reference dates at Claude Code v2.1.271+ (and only in auto mode). Derived from `--version`, so it
   * reports the version floor rather than attempting to detect the permission mode.
   */
  subagentHandback: boolean;
  /**
   * Plan 032 Phase 7 — what the host profile (`registry/hosts/claude/profile.json`) says about the probed version.
   * Absent when Claude Code is not installed or the profile cannot be read.
   */
  profile?: {
    profileId: string;
    minVersion: string;
    reviewedAgainst: string;
    belowMinimum: boolean;
    newerThanReviewed: boolean;
  };
  diagnostics: string[];
}

/**
 * Plan 029 B6 — the resolved `agy` (Antigravity CLI) invocation. Mirrors `ResolvedClaudeCommand`,
 * minus the npm node-wrapper branch: `agy` ships as a native binary plus `.cmd`/`.bat` shims, so a
 * PATH hit is always either the binary itself or the shell shim routed through `cmd.exe`.
 */
export type ResolvedAgyCommand = {
  executable: string;
  prefixArgs: string[];
  source: 'env-binary' | 'path-executable';
};

/**
 * Plan 029 B6 — the read-only Antigravity CLI capability report.
 *
 * `installed` is a pure "the binary answered `--version` with exit 0" signal (mirroring
 * `ClaudeCapabilityReport`), so an unverifiable runtime is never reported as capable. The three
 * feature flags are derived from `agy --help` text only. `meetsVersionFloor` is reported as data:
 * it names the version on which the `--agent` / `--prompt-interactive` surface was verified live
 * and is deliberately never a launch gate.
 */
export interface AntigravityCapabilityReport {
  installed: boolean;
  version?: string;
  command?: ResolvedAgyCommand;
  /** `--agent <name>` (agent for the current CLI session) is advertised by `agy --help`. */
  agentFlag: boolean;
  /** `-i, --prompt-interactive` is advertised — i.e. an opening prompt CAN be passed. */
  promptInteractive: boolean;
  /** Values advertised for `--mode` (verified live: `accept-edits`, `plan`). */
  modes: string[];
  /** Whether the reported version is at or above the live-verified floor. Informational only. */
  meetsVersionFloor: boolean;
  diagnostics: string[];
}

export interface ProcessRunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  executable: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number }
) => Promise<ProcessRunnerResult>;

export interface LockfileManifest {
  $schema: string;
  version: number;
  scope?: InstallScope;
  method?: InstallMethod;
  hosts?: AgentHost[];
  /** Runtime ids this install was fanned out to (e.g. ['cline']). Persisted so that
   *  `update` / re-install regenerate projections without the user re-passing --fanout. */
  fanout?: string[];
  installed: {
    bundles: string[];
    agents: string[];
    skills: string[];
    /** @deprecated ADR 0016: Workflows are unified into `skills`. Preserved for backward compatibility with existing lockfiles. */
    workflows?: string[];
  };
  bundleVersions?: Record<string, string>;
  bundleModes?: Record<string, ExecutionMode>;
  files: Record<string, LockfileAsset>;
  /** File-level projection ownership map (keyed by workspace-root-relative POSIX path). */
  projections?: Record<string, LockfileProjection>;
  /**
   * Plan 016 / ADR 0018 decision 12 — the recorded opt-in for the Claude plugin lane.
   *
   * Persisted for the same reason `fanout` is: `agents update` re-runs the installer without the
   * user re-passing `--plugin`, so without this field every update would prune the opted-in
   * `.agents/plugins/<bundle>/.claude-plugin/**` package as a superseded projection. Absent ⇒ the
   * lane was never opted into.
   */
  pluginLane?: boolean;
  /**
   * Plan 032 Phase 7 — the recorded opt-in for the Claude native-package lane: roles with a committed native agent in
   * `registry/hosts/claude/agents/` are installed from it instead of being projected from the canonical asset. Sticky
   * for the same reason as `pluginLane`: `agents update` re-runs the installer without the flag. Absent ⇒ off.
   */
  nativeLane?: boolean;
  /**
   * Plan 032 Phase 8 / ADR 0026 decision 6 — the native-lane opt-in of the other hosts, recorded per host. Today only
   * `cline`; Claude keeps writing `nativeLane` above, so lockfiles written by earlier releases stay valid. Absent ⇒ off.
   */
  nativeLanes?: { cline?: true; antigravity?: true };
  /**
   * Plan 032 close-out — the `.agents/` store exists only because another host needed it; Antigravity is not a target. Sticky like the lanes.
   * Absent ⇒ the store is an Antigravity library too (every lockfile written before this field existed).
   */
  implicitStore?: true;
  /**
   * Plan 032 Phase 8 / ADR 0031 addendum — the Antigravity guard hook merged into the user-owned `.agents/hooks.json`: the file
   * (workspace-relative), the canonical hash of the entry agents-united wrote (ownership proof, and how an older version is recognised),
   * and whether agents-united created the file (only then may removal delete it). Absent when no guard is registered.
   */
  antigravityHooks?: AntigravityHooksRecord;
  /**
   * Plan 032 Phase 8 / ADR 0032 — the MCP servers merged into the user-owned `.agents/mcp_config.json`: the file, whether agents-united
   * created the file and the `mcpServers` object (only then may removal delete them), and per server the canonical hash of the entry
   * written (ownership proof, ignoring the user's `disabled` switch) with the bundles that declare it. A key is ours only when it is
   * recorded here. Absent when no server is wired.
   */
  antigravityMcp?: AntigravityMcpRecord;
  /**
   * Plan 023 A (owner D1–D2) — the recorded plain-session guard decision. `{ off: true }` is a
   * remembered "no"; otherwise the settings file (workspace-relative, or absolute for `user`)
   * holding our managed PreToolUse groups, the handler hash that proves ownership, and whether
   * agents-united created the file (only then may uninstall delete it). Absent ⇒ never decided.
   */
  sessionGuard?: SessionGuardRecord;
  /**
   * Plan 023 B (ADR 0022, D3) — `'sidecar'` when this lockfile lives in the store-less sidecar
   * `.claude/.agents-united/`. Absent on a store-backed install (the lockfile shape is unchanged).
   */
  storeShape?: 'sidecar';
  /**
   * Plan 024 S4 (owner E2/E4) — the recorded opt-in command-permission preset. `{ off: true }` is
   * a remembered "no"; otherwise the tier, the settings file it was written to (always
   * `.claude/settings.local.json`, workspace-relative), the exact entries this install added
   * (removal is limited to these), and whether agents-united created the file. Absent ⇒ never
   * decided.
   */
  permissionPreset?: PermissionPresetRecord;
}

export type PermissionPresetRecord =
  | { off: true }
  | { tier: 'verify' | 'build'; file: string; entries: string[]; createdFile: boolean };

export type SessionGuardRecord =
  | { off: true }
  | { file: string; handlerHash: string; createdFile: boolean };

export interface AntigravityHooksRecord {
  file: string;
  entryHash: string;
  createdFile: boolean;
}

export interface AntigravityMcpRecord {
  file: string;
  createdFile: boolean;
  createdKey: boolean;
  servers: Record<string, { entryHash: string; owners: string[] }>;
}

export type VersionDriftStatus = 'up-to-date' | 'outdated' | 'modified';

export interface InstalledPackageRecord {
  id: string; // unique identifier, e.g. "software-engineering@project:agents"
  name: string;
  type: 'bundle' | 'agent' | 'skill' | 'workflow';
  scope: InstallScope;
  host: AgentHost;
  targetDir: string;
  displayLocation: string; // e.g. "./.agents" or "~/.agents"
  installedVersion: string;
  upstreamVersion: string;
  driftStatus: VersionDriftStatus;
  method?: InstallMethod;
  fileCount: number;
  title?: string;
  description?: string;
  fanout?: string[];
  projections?: string[];
}

export interface ScannedLocationSummary {
  scope: InstallScope;
  targetDir: string;
  displayLocation: string;
  packageCount: number;
  fanout: string[];
}

export interface PackageInventory {
  records: InstalledPackageRecord[];
  bundles: InstalledPackageRecord[];
  standaloneItems: InstalledPackageRecord[];
  targetDirs: string[];
  scannedScopes?: InstallScope[];
  scannedLocations?: ScannedLocationSummary[];
}

export interface InventoryOptions {
  scope?: InstallScope;
  global?: boolean;
  hosts?: AgentHost[];
  target?: string | string[];
  targetDir?: string;
  cwd?: string;
}

export interface UpdateOptions {
  scope?: InstallScope;
  global?: boolean;
  hosts?: AgentHost[];
  target?: string | string[];
  targetDir?: string;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  cwd?: string;
  /** Fan the canonical store out into these runtimes during the update re-install
   *  (e.g. to add Cline projections to a bundle originally installed without fanout). */
  fanout?: string[];
}

export interface UpdateCheckItem {
  record: InstalledPackageRecord;
  hasUpdate: boolean;
  installedVersion: string;
  upstreamVersion: string;
  reason?: string;
}

export interface UpdateCheckReport {
  items: UpdateCheckItem[];
  outdatedCount: number;
  upToDateCount: number;
  totalCount: number;
  scannedScopes?: InstallScope[];
  scannedLocations?: ScannedLocationSummary[];
}

export interface UpdateResult {
  updated: InstalledPackageRecord[];
  skipped: Array<{ record: InstalledPackageRecord; reason: string }>;
  targetDirs: string[];
  dryRun: boolean;
  projections: ProjectionInfo[];
}


export interface InstallOptions {
  scope?: InstallScope;
  global?: boolean;
  method?: InstallMethod;
  symlink?: boolean;
  copy?: boolean;
  hosts?: AgentHost[];
  target?: string | string[];
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  targetDir?: string;
  /** Host ids to project the canonical `.agents/` store into (validated against
   *  HOST_REGISTRY; only `projectionCapable` hosts are honored). */
  fanout?: string[];
  /** Execution mode for organization bundles with prerequisites */
  mode?: ExecutionMode;
  /** Allow installation even if prerequisites are missing */
  allowMissingPrereqs?: boolean;
  /** Allow installation of bundles marked as under-construction */
  allowUnderConstruction?: boolean;
  /**
   * ADR 0018 decision 12 / Plan 016 decision 13 — opt-in **Claude plugin lane**: also emit the
   * distribution-only package (`.agents/plugins/<bundle>/.claude-plugin/plugin.json` + `agents/`)
   * for `claude --plugin-dir`. Claude lane only; the plan is byte-identical to today when absent.
   */
  pluginLane?: boolean;
  /**
   * Plan 032 Phase 7 — opt-in native-package lane (`agents add --native`): install the committed native agent for each
   * role that has one. Claude lane only; `false` turns a recorded choice off, an omitted flag inherits it.
   */
  nativeLane?: boolean;
  /**
   * Plan 032 close-out — `true` when the `.agents/` store was only added for another host (Cline, the Claude plugin lane) and Antigravity was
   * not asked for; `false` when it was (`-t agents`, the default, or `--canonical-store`). An implicit store gets no Antigravity native lane,
   * and a native Cline lane leaves the three same-named workflow skills out of it. Omitted ⇒ inherit the recorded choice.
   */
  implicitStore?: boolean;
  /**
   * Plan 023 A — guard plain Claude sessions too: `project` (.claude/settings.json), `local`
   * (.claude/settings.local.json), `user` (~/.claude/settings.json, explicit only), or `false`
   * (remembered "no"). Omitted ⇒ inherit the lockfile decision. Claude lane only.
   */
  sessionGuard?: 'project' | 'local' | 'user' | false;
  /**
   * Plan 024 S4 (owner E2/E4) — opt-in command-permission preset: `verify` (fixed read/test
   * commands only) or `build` (adds npm install/run/test — must be requested explicitly). Written
   * ONLY to `.claude/settings.local.json`, never the shared `.claude/settings.json`, and never for
   * a global install. `false` records a remembered "no". Omitted ⇒ inherit the lockfile decision
   * (absent decision ⇒ off). A host with no verified renderer yet (anything but Claude today)
   * reports "not supported" instead of writing a guessed file.
   */
  permissionPreset?: 'verify' | 'build' | false;
  /**
   * Plan 023 B (ADR 0022, D4) — where the machine state lives when no `targetDir` is given:
   * `'sidecar'` (store-less Claude-only install) or `'store'` (`.agents/`). Decided by
   * `planInstallTargets`; an existing store always wins, and a store-requiring install moves an
   * existing sidecar into `.agents/`. Omitted ⇒ discover (existing store > existing sidecar > store).
   */
  storeShape?: 'store' | 'sidecar';
}

export interface ProjectionInfo {
  host: string;
  path: string;
  kind?: ProjectionKind;
  warnings: string[];
}

export interface UninstallOptions {
  scope?: InstallScope;
  global?: boolean;
  hosts?: AgentHost[];
  target?: string | string[];
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  targetDir?: string;
}

export interface ResolvedAssets {
  targetBundle?: string;
  agents: string[];
  skills: string[];
  workflows: string[];
  rules: string[];
}

export interface SearchOptions {
  domain?: string;
  type?: 'bundle' | 'agent' | 'skill' | 'workflow';
}

export interface SearchResults {
  bundles: BundleDefinition[];
  agents: string[];
  skills: string[];
  workflows: string[];
}

export type ModelTier = 'inherit' | 'pro' | 'flash';
export type ReasoningEffort = 'low' | 'medium' | 'high';
export type PermissionMode = 'acceptEdits' | 'requestReview' | 'strict' | 'readOnly';
export type CommandExecutionPolicy = 'auto' | 'ask' | 'never';

export interface AgentHook {
  matcher: string;
  action: string;
}

export interface AgentFrontmatter {
  name: string;
  version?: string;
  type?: 'orchestrator' | 'subagent';
  description?: string;
  model?: ModelTier;
  effort?: ReasoningEffort;
  permissionMode?: PermissionMode;
  commandExecutionPolicy?: CommandExecutionPolicy;
  mainAgent?: boolean;
  subagent?: boolean;
  inheritCustomizations?: boolean;
  rules?: string[];
  tools?: string[];
  hooks?: Record<string, AgentHook[]>;
}

export interface SkillMetadata {
  author?: string;
  version?: string;
  icon?: string;
  source?: string;
  license?: string;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  'disable-slash-command'?: boolean;
  disableSlashCommand?: boolean;
  metadata?: SkillMetadata;
}

/**
 * agent-plugins.org v1.0.0 Agent Plugin manifest (`plugin.json`) written at the root
 * of `.agents/plugins/<bundle>/`. Its presence is the discriminator Cline uses to
 * hard-stop code-plugin scanning of the directory (see `isAgentPluginDirectory` in
 * Cline's `@cline/shared/storage`), and it makes the package portable to other
 * Agent Plugins-conforming clients.
 */
export interface AgentPluginManifest {
  $schema: string;
  name: string;
  version: string;
  description: string;
}

/** ADR 0018 — how one canonical feature is treated when projected into a host dialect. */
export type LedgerDisposition = 'mapped' | 'approximated' | 'degraded' | 'unsupported';

/** ADR 0018 decision 9 — a recorded disposition; a drop without one is a hard error. */
export interface TranslationLedgerEntry {
  feature: string;
  host: string;
  disposition: LedgerDisposition;
  rationale: string;
}
/**
 * Plan 016 decision 13 / ADR 0018 decision 12 — the Anthropic Claude Code plugin manifest
 * (`.claude-plugin/plugin.json`), consumed via `claude --plugin-dir`. The field set is the
 * documented seven; `author`/`homepage`/`repository`/`license` are emitted as empty strings
 * because `BundleDefinition` (and `registry/bundles.json`) declares no such metadata — the
 * keys stay present for schema completeness rather than being invented, and the manifest
 * stays deterministic across project and global installs.
 */
export interface ClaudePluginManifest {
  author: string;
  description: string;
  homepage: string;
  license: string;
  name: string;
  repository: string;
  version: string;
}



/**
 * ADR 0018 — the pure-data description of the Claude Code dialect that the Claude lane renders
 * against. Plan 017 (ADR 0019) lifts this shape into the shared `HostDialectSpec` so additional
 * hosts are added as data rather than as hand-wired translators.
 */
export interface ClaudeDialect {
  id: 'claude';
  nameRegex: RegExp;
  /** Canonical frontmatter tool token -> Claude tool name. */
  toolVocabulary: Record<string, string>;
  /** Canonical tool token -> Claude phrase used when rewriting prompt prose. */
  bodyToolVocabulary: Record<string, string>;
  /** Canonical command tokens -> host renderings (Plan 020 note 7 command bindings). */
  commandVocabulary: Record<string, string>;
  /** Canonical permissionMode -> Claude permissionMode. */
  permissionModeMap: Record<string, string>;
  /** Canonical model tier -> Claude model. */
  modelMap: Record<string, string>;
  /**
   * Model applied when the canonical declares `inherit` (ADR 0018 decision 7 as amended 2026-09-22):
   * coordinators and specialists get an explicit posture instead of inheriting the session model.
   */
  roleModelDefaults: { coordinator: string; specialist: string };
  /** Effort applied when the canonical does not declare one (coordinator vs specialist posture). */
  roleEffortDefaults: { coordinator: string; specialist: string };
  /**
   * Canonical body sections replaced wholesale with a host-native rendering (ADR 0018 decision 8).
   *
   * Tool-name rewriting alone cannot rescue a section that describes *another host's* routing (Antigravity's
   * `language_server.exe` limitation, Cline's `subagent_*` tools): the words rewrite but the meaning does
   * not. Each entry replaces the matched heading's whole section with prose the target host can act on.
   * This is a rendering, not a feature drop, so it carries no ledger disposition.
   */
  bodySectionOverrides: Array<{ heading: RegExp; replacement: string }>;
  budgets: { skillDescriptionChars: number; agentDescriptionTokens: number };
  maxRuleLines: number;
}

/**
 * ADR 0021 decision 9 — Translation Ledger dispositions survive as delta classifications;
 * a Declared Delta is an audited host-specific deviation ABOVE the Contract Floor.
 */
export type DeltaDisposition = LedgerDisposition;
export type DeclaredDelta = TranslationLedgerEntry;

/**
 * Plan 021 (ADR 0021) — the tool-free definition of what an agent IS: identity, mission,
 * scope boundaries, structured output contract, safety rules, and tool-neutral behavioural
 * invariants. Authored in `registry/core/*.core.md`; contains zero host tool names,
 * command names, or host mechanics (decision 1).
 */
export interface SemanticCore {
  identity: string;
  mission: string;
  scope_boundaries: string;
  output_contract: string;
  safety: string;
  invariants: string[];
  /** Plan 032 Phase 5 — host-neutral capability classes this role needs (optional for legacy cores). */
  capabilities?: CapabilityClass[];
}

/** ADR 0045 — a core reference and permitted host-neutral affordances, not runtime grants. */
export interface SubagentContract {
  definition: string;
  workflows: string[];
  skills: string[];
  hooks: string[];
}

/** Plan 021 gate 4 — conformance input: what the realization binds, adds, and declares. */
export interface ValidateDeclaredDeltasInput {
  realization: { boundInvariants: string[]; aboveFloorScope: string[] };
  core: SemanticCore;
  deltas: DeclaredDelta[];
}

/**
 * The per-host dialect spec: the Plan 017 codex fields (the vocabulary surface) and a `deltaRegistry` reference. One spec per host;
 * host churn is a one-host data PR. (The created lane's `capabilityProfile` and `invariantBindings` went with it, ADR 0037.)
 */
export interface HostDialectSpec {
  id: string;
  fields: Record<string, 'keep' | 'map' | 'drop'>;
  toolVocabulary: Record<string, string>;
  bodyToolVocabulary: Record<string, string>;
  commandVocabulary: Record<string, string>;
  features: Record<string, boolean | string>;
  budgets: { skillDescriptionChars: number; agentDescriptionTokens: number };
  nameRules: { pattern: string; subagentPrefixPolicy: string };
  launcher: { flags: string[]; notes: string };
  markerProfile: string;
  deltaRegistry: string;
}

/**
 * Plan 032 Phase 5 / ADR 0025 decision 8 — host-neutral capability classes. A role in
 * `registry/core/` declares classes, never tool names; each host's `tool-policy.json` maps a
 * class to that host's native tools. The first fifteen are the ADR's list (`schedule` is spelled
 * `scheduling` because core files may not contain the forbidden token `schedule`); the last seven
 * cover native tools the ADR list leaves unclassified.
 */
export type CapabilityClass =
  | 'read'
  | 'search'
  | 'code-intel'
  | 'edit'
  | 'shell'
  | 'background-monitor'
  | 'web'
  | 'delegate'
  | 'workflow'
  | 'scheduling'
  | 'ask-user'
  | 'notify'
  | 'worktree'
  | 'report'
  | 'handback'
  | 'artifacts'
  | 'skill'
  | 'messaging'
  | 'task-tracking'
  | 'plan'
  | 'mcp-discovery'
  | 'meta';

/** Plan 032 Phase 5 — where a tool exists depends on more than the version. */
export type ToolConditionKind = 'platform' | 'model' | 'provider' | 'version' | 'setting' | 'plan' | 'surface' | 'dependency';

export interface ToolCondition {
  kind: ToolConditionKind;
  detail: string;
  /** Host docs library snapshot the condition comes from, e.g. `pages/tools/tools-reference.md#glob-tool-behavior`. */
  source: string;
}

export type SubagentAvailability = 'available' | 'never' | 'conditional';

export interface ToolCatalogEntry {
  name: string;
  class: CapabilityClass;
  /** Whether a subagent can hold the tool at all (`never`: withheld from every subagent). */
  subagents: SubagentAvailability;
  /** Whether a background subagent keeps the tool (background is the default subagent mode). */
  backgroundSubagent: boolean;
  /** Can change files, processes or external state (a read-only class may contain none). */
  mutating: boolean;
  /** The host documents a replacement (for example `TaskOutput`, replaced by `Read` on the task's output file): never granted. */
  deprecated?: boolean;
  conditions: ToolCondition[];
}

export interface ToolClassSummary {
  description: string;
  grantable: boolean;
  /** Tools of this class, catalog order. */
  tools: string[];
}

export interface ToolPolicy {
  host: string;
  profile: string;
  semantics?: string;
  catalog: ToolCatalogEntry[];
  classes: Record<CapabilityClass, ToolClassSummary>;
}

export interface ToolGrant {
  tools: string[];
  dropped: Array<{ tool: string; reason: string }>;
}

export interface HostProfile {
  host: string;
  profileId: string;
  version: string;
  minVersion: string;
  reviewedAgainst: string;
  /** Changelog section whose baseline `version` and `reviewedAgainst` pin to (`CLI` for Cline); the unsectioned changelog when absent. */
  reviewedSection?: string;
  library: string;
  toolPolicy: string;
  /** Version-floor profile of the legacy projection lane, for hosts that have one (Claude). */
  legacyProfile?: string;
  semantics?: string;
  artifacts: {
    agent: { path: string; requiredKeys: string[]; allowedKeys: string[] };
    skill: { path: string; allowedKeys: string[]; portableKeys: string[] };
    hook: { events: string[]; handlerTypes: string[]; registerAt: string[] };
    plugin: { manifestKeys: string[]; ignoredAgentKeys: string[]; layout: Record<string, string> };
    mcp: { scopes: string[]; transports: string[] };
    permissions: { modes: string[] };
  };
  /** `since` is the first host version that has the feature, where the live docs date it. */
  features: Record<string, { status: string; note: string; since?: string }>;
}
