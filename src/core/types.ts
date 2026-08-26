export type InstallScope = 'project' | 'global';
export type InstallMethod = 'symlink' | 'copy';
export type AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor' | 'cline' | 'opencode' | 'codex';

// Backward compatibility alias
export type Scope = InstallScope;

export type BundleTier = 'domain' | 'organization';
export type BundleStatus = 'stable' | 'experimental' | 'under-construction' | 'needs-audit' | 'deprecated';
export type ExecutionMode = 'operational' | 'brainstorming';

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
  status: 'ok' | 'missing';
  details?: string;
  optionalForBrainstorming?: boolean;
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
  workflows?: string[];
  skills?: string[];
  prerequisites?: BundlePrerequisites;
  modes?: BundleModes;
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

export type ProjectionKind = 'role' | 'skill' | 'rule' | 'team-manifest' | 'bridge';

export interface LockfileProjection {
  host: string;
  kind: ProjectionKind;
  canonical?: string;
  owners: string[];
  hash: string;
  installedAt: string;
  managedMarker: boolean;
}

export interface ClineTeamManifest {
  schemaVersion: 1;
  bundle: string;
  scope: InstallScope;
  coordinator: { name: string; canonicalPath: string };
  roles: Array<{ name: string; canonicalPath: string }>;
  skills: string[];
  workflows: string[];
  recommendedAddons: string[];
  activation: {
    preferred: 'named-team';
    fallbacks: Array<'adaptive-session' | 'single-orchestrator'>;
  };
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
    workflows: string[];
  };
  bundleVersions?: Record<string, string>;
  bundleModes?: Record<string, ExecutionMode>;
  files: Record<string, LockfileAsset>;
  /** File-level projection ownership map (keyed by workspace-root-relative POSIX path). */
  projections?: Record<string, LockfileProjection>;
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
}

export interface PackageInventory {
  records: InstalledPackageRecord[];
  bundles: InstalledPackageRecord[];
  standaloneItems: InstalledPackageRecord[];
  targetDirs: string[];
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
}

export interface UpdateResult {
  updated: InstalledPackageRecord[];
  skipped: Array<{ record: InstalledPackageRecord; reason: string }>;
  targetDirs: string[];
  dryRun: boolean;
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


