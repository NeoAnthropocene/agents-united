import path from 'node:path';
import os from 'node:os';
import type { Scope } from './types.js';

export class TargetAdapter {
  public static resolveTargetDir(scope: Scope = 'workspace', overrideDir?: string): string {
    if (overrideDir) {
      return path.resolve(overrideDir);
    }

    if (scope === 'global') {
      const home = os.homedir();
      return path.join(home, '.gemini', 'config');
    }

    // Default workspace target
    return path.resolve(process.cwd(), '.agents');
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
