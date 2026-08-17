import path from 'node:path';
import os from 'node:os';
import type { InstallScope, AgentHost } from './types.js';
import {
  isKnownHost,
  resolveHostProjectDir,
  resolveHostGlobalDir,
} from './hosts.js';

export class AgentHostAdapter {
  public static resolveHostDir(scope: InstallScope = 'project', host: AgentHost = 'agents', overrideDir?: string): string {
    if (overrideDir) {
      return path.resolve(overrideDir);
    }

    // Behaviour back-compat: default to the canonical 'agents' dir for unknown ids.
    if (!isKnownHost(host)) {
      host = 'agents';
    }

    const home = os.homedir();
    const cwd = process.cwd();

    if (scope === 'global') {
      return resolveHostGlobalDir(host, home);
    }

    // Project scope
    return resolveHostProjectDir(host, cwd);
  }

  public static getSubPaths(targetDir: string) {
    return {
      agentsDir: path.join(targetDir, 'agents'),
      skillsDir: path.join(targetDir, 'skills'),
      workflowsDir: path.join(targetDir, 'workflows'),
      rulesDir: path.join(targetDir, 'rules'),
      lockfile: path.join(targetDir, 'agents-united.json'),
    };
  }
}

// Backward compatibility facade
export class TargetAdapter {
  public static resolveTargetDir(scope: InstallScope = 'project', overrideDir?: string): string {
    return AgentHostAdapter.resolveHostDir(scope, 'agents', overrideDir);
  }

  public static getSubPaths(targetDir: string) {
    return AgentHostAdapter.getSubPaths(targetDir);
  }
}
