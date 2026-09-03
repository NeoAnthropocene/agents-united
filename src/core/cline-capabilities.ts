import path from 'node:path';
import fs from 'fs-extra';
import { execFile } from 'node:child_process';
import type {
  ClineCapabilityReport,
  ProcessRunner,
  ProcessRunnerResult,
  ResolvedClineCommand,
} from './types.js';

export interface ClineProbeResolverOptions {
  resolveExecutable?: () => ResolvedClineCommand | null;
}

export const defaultProcessRunner: ProcessRunner = (
  executable: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number }
): Promise<ProcessRunnerResult> => {
  return new Promise((resolve) => {
    const timeout = options?.timeoutMs ?? 5000;
    try {
      execFile(
        executable,
        args,
        {
          cwd: options?.cwd,
          env: options?.env ? { ...process.env, ...options.env } : process.env,
          timeout,
          shell: false,
        },
        (error, stdout, stderr) => {
          if (error) {
            const exitCode = typeof error.code === 'number' ? error.code : 1;
            resolve({
              exitCode,
              stdout: (stdout || '').toString(),
              stderr: (stderr || error.message || '').toString(),
            });
          } else {
            resolve({
              exitCode: 0,
              stdout: (stdout || '').toString(),
              stderr: (stderr || '').toString(),
            });
          }
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: msg,
      });
    }
  });
};

export class ClineCapabilityProbe {
  private runner: ProcessRunner;
  private customResolver?: () => ResolvedClineCommand | null;

  constructor(runner?: ProcessRunner, options?: ClineProbeResolverOptions) {
    this.runner = runner || defaultProcessRunner;
    this.customResolver = options?.resolveExecutable;
  }

  /**
   * Safe executable resolution across POSIX and Windows layouts.
   */
  public resolveExecutable(): ResolvedClineCommand | null {
    if (this.customResolver) {
      return this.customResolver();
    }

    // 1. Explicit CLINE_BIN_PATH
    const envBin = process.env.CLINE_BIN_PATH;
    if (envBin && path.isAbsolute(envBin) && fs.existsSync(envBin)) {
      return {
        executable: envBin,
        prefixArgs: [],
        source: 'env-binary',
      };
    }

    // 2. PATH scanning
    const pathEnv = process.env.PATH || '';
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const dirs = pathEnv.split(pathSeparator).filter(Boolean);

    if (process.platform === 'win32') {
      const exeNames = ['cline.cmd', 'cline.bat', 'cline.exe', 'cline'];
      for (const dir of dirs) {
        for (const exeName of exeNames) {
          const fullPath = path.join(dir, exeName);
          if (fs.existsSync(fullPath)) {
            // Check adjacent Node wrapper in npm / nvm / volta structure
            const adjacentWrapper1 = path.join(dir, 'node_modules', 'cline', 'bin', 'cline');
            const adjacentWrapper2 = path.join(dir, 'node_modules', '@cline', 'cline', 'bin', 'cline');

            if (fs.existsSync(adjacentWrapper1)) {
              return {
                executable: process.execPath,
                prefixArgs: [adjacentWrapper1],
                source: 'node-wrapper',
              };
            }
            if (fs.existsSync(adjacentWrapper2)) {
              return {
                executable: process.execPath,
                prefixArgs: [adjacentWrapper2],
                source: 'node-wrapper',
              };
            }

            // Windows hardening (ADR 0013 §5): Node >= 18.20 / 20.12 / 24 rejects
            // spawning .cmd/.bat shims with shell:false (EINVAL), so bridge through
            // cmd.exe while keeping the argv array shell-safe.
            const ext = path.extname(fullPath).toLowerCase();
            if (ext === '.cmd' || ext === '.bat') {
              return {
                executable: 'cmd.exe',
                prefixArgs: ['/c', fullPath],
                source: 'path-executable',
              };
            }
            return {
              executable: fullPath,
              prefixArgs: [],
              source: 'path-executable',
            };
          }
        }
      }
    } else {
      for (const dir of dirs) {
        const fullPath = path.join(dir, 'cline');
        if (fs.existsSync(fullPath)) {
          return {
            executable: fullPath,
            prefixArgs: [],
            source: 'path-executable',
          };
        }
      }
    }

    return null;
  }

  /**
   * Run read-only capability probe against local Cline.
   */
  public async probe(): Promise<ClineCapabilityReport> {
    const cmd = this.resolveExecutable();
    const diagnostics: string[] = [];

    if (!cmd) {
      diagnostics.push('Cline executable not found on PATH or via CLINE_BIN_PATH.');
      return {
        installed: false,
        namedTeams: false,
        rolePresetConsumer: 'unknown',
        diagnostics,
      };
    }

    // 1. Version check
    let version: string | undefined;
    try {
      const verRes = await this.runner(cmd.executable, [...cmd.prefixArgs, 'version'], {
        timeoutMs: 5000,
      });

      if (verRes.exitCode === 0) {
        version = verRes.stdout.trim().split('\n')[0]?.trim();
      } else {
        diagnostics.push(`Cline version check failed (exit code ${verRes.exitCode}): ${verRes.stderr.trim()}`);
        return {
          installed: false,
          command: cmd,
          namedTeams: false,
          rolePresetConsumer: 'unknown',
          diagnostics,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Error executing Cline version check: ${msg}`);
      return {
        installed: false,
        command: cmd,
        namedTeams: false,
        rolePresetConsumer: 'unknown',
        diagnostics,
      };
    }

    // 2. Named team parser probe
    let namedTeams = false;
    try {
      const probeRes = await this.runner(
        cmd.executable,
        [...cmd.prefixArgs, '--team-name', 'agents-united-capability-probe', 'version'],
        { timeoutMs: 5000 }
      );

      if (probeRes.exitCode === 0) {
        namedTeams = true;
      } else {
        diagnostics.push(`Named teams probe returned non-zero (exit code ${probeRes.exitCode}). Falling back to adaptive session.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Named teams probe failed: ${msg}`);
    }

    return {
      installed: true,
      version,
      command: cmd,
      namedTeams,
      rolePresetConsumer: 'unknown',
      diagnostics,
    };
  }
}
