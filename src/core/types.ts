export type Scope = 'workspace' | 'global';

export interface BundleDefinition {
  name: string;
  description: string;
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
  installedAt: string;
}

export interface LockfileManifest {
  $schema: string;
  version: number;
  installed: {
    bundles: string[];
    agents: string[];
    skills: string[];
    workflows: string[];
  };
  files: Record<string, LockfileAsset>;
}

export interface InstallOptions {
  scope?: Scope;
  global?: boolean;
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  targetDir?: string;
}

export interface UninstallOptions {
  scope?: Scope;
  global?: boolean;
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
