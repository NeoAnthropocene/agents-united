export type InstallScope = 'project' | 'global';
export type InstallMethod = 'symlink' | 'copy';
export type AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor';

// Backward compatibility alias
export type Scope = InstallScope;

export interface BundleDefinition {
  name: string;
  description: string;
  category?: string;
  domain?: string;
  parentBundle?: string;
  recommendedAddons?: string[];
  aliases?: string[];
  orchestrator?: string;
  agents?: string[];
  workflows?: string[];
  skills?: string[];
}

export interface BundlesManifest {
  $schema?: string;
  version: number;
  bundles: Record<string, BundleDefinition>;
}

export interface LockfileAsset {
  hash: string;
  bundle?: string;
  method?: InstallMethod;
  installedAt: string;
}

export interface LockfileManifest {
  $schema: string;
  version: number;
  scope?: InstallScope;
  method?: InstallMethod;
  hosts?: AgentHost[];
  installed: {
    bundles: string[];
    agents: string[];
    skills: string[];
    workflows: string[];
  };
  files: Record<string, LockfileAsset>;
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

