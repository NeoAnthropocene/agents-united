import path from 'node:path';
import os from 'node:os';
import type { InstallScope, AgentHost } from './types.js';

export class AgentHostAdapter {
  public static resolveHostDir(scope: InstallScope = 'project', host: AgentHost = 'agents', overrideDir?: string): string {
    if (overrideDir) {
      return path.resolve(overrideDir);
    }

    const home = os.homedir();
    const cwd = process.cwd();

    if (scope === 'global') {
      switch (host) {
        case 'gemini':
          return path.join(home, '.gemini', 'config');
        case 'claude':
          return path.join(home, '.claude');
        case 'cursor':
          return path.join(home, '.cursor');
        case 'agents':
        default:
          return path.join(home, '.agents');
      }
    }

    // Project scope
    switch (host) {
      case 'gemini':
        return path.resolve(cwd, '.gemini');
      case 'claude':
        return path.resolve(cwd, '.claude');
      case 'cursor':
        return path.resolve(cwd, '.cursor');
      case 'agents':
      default:
        return path.resolve(cwd, '.agents');
    }
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
