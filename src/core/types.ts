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

export type ProjectionKind = 'role' | 'skill' | 'rule' | 'team-manifest' | 'workflow' | 'bridge' | 'plugin-manifest';

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
 * `pluginSupport` and `agentTeamsExperimental` are derived from `--help` text only; both
 * default to `false` when help output is unavailable, so an unverifiable capability is
 * never reported as supported.
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
}

export type SessionGuardRecord =
  | { off: true }
  | { file: string; handlerHash: string; createdFile: boolean };

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
   * Plan 023 A — guard plain Claude sessions too: `project` (.claude/settings.json), `local`
   * (.claude/settings.local.json), `user` (~/.claude/settings.json, explicit only), or `false`
   * (remembered "no"). Omitted ⇒ inherit the lockfile decision. Claude lane only.
   */
  sessionGuard?: 'project' | 'local' | 'user' | false;
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
}

/** Plan 021 gate 4 — conformance input: what the realization binds, adds, and declares. */
export interface ValidateDeclaredDeltasInput {
  realization: { boundInvariants: string[]; aboveFloorScope: string[] };
  core: SemanticCore;
  deltas: DeclaredDelta[];
}

/** ADR 0021 decision 2 — an invariant BOUND to host mechanics, never translated. */
export interface InvariantBinding {
  /** Tool-neutral behavioural law as authored in the Semantic Core invariants. */
  invariant: string;
  /** The concrete host-native mechanic this law is bound to on this host. */
  binding: string;
}

/**
 * ADR 0021 decision 9 — `HostDialectSpec` evolves into the per-host Binding Table schema:
 * the Plan 017 codex fields survive (they are the vocabulary surface) and the realization
 * gains `capabilityProfile`, `invariantBindings`, and a `deltaRegistry` reference. One spec
 * per host; host churn is a one-host data PR.
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
  /** ADR 0021 additions — the Binding Table proper. */
  capabilityProfile: string;
  invariantBindings: InvariantBinding[];
  deltaRegistry: string;
}

/** Plan 021 Step 4 — the per-role binding view consumed by the Claude Creation Engine. */
export interface ClaudeCreationBindingTable {
  host: string;
  /** The native role name (e.g. `backend-architect`); optional so fixtures stay minimal. */
  roleName?: string;
  /** `invariant` (HostDialectSpec shape) or `feature` (legacy codex shape) identify the law. */
  invariantBindings?: Array<{ invariant?: string; feature?: string; binding: string }>;
  /** `rendering` (Binding Table shape) or `native` (legacy shape) give the host command. */
  commandBindings?: Array<{ command: string; rendering?: string; native?: string; rationale?: string }>;
  commandVocabulary?: Record<string, string>;
  deltas?: DeclaredDelta[];
  /**
   * Plan 022 H2/H3 — the role's own least-privilege allowlist (Realization Layer). Absent ⇒ the
   * profile's whole surface (fixtures only); every entry must exist in the profile.
   */
  tools?: string[];
  /** Plan 022 H3 — native permission mode (e.g. `plan` for read-only roles). */
  permissionMode?: string;
}

/** Plan 021 Step 4 — the versioned tool-surface snapshot the creation engine targets. */
export interface ClaudeCreationProfile {
  host: string;
  version: string;
  tools?: string[];
}



