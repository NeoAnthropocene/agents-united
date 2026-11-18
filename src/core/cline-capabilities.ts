import { execFile } from 'node:child_process';
import { CLINE_SHIM_HOST, cmdShimRefusalFor } from './cmd-shim.js';
import { resolveHostBinary } from './host-binary.js';
import type { WrappedHostBinarySpec } from './host-binary.js';
import type {
  ClineCapabilityReport,
  ProcessRunner,
  ProcessRunnerResult,
  ResolvedClineCommand,
} from './types.js';

/** Cline (npm package `cline`): the Node script beside the shim takes priority. */
const CLINE_BINARY: WrappedHostBinarySpec = {
  binaryName: 'cline',
  envVar: 'CLINE_BIN_PATH',
  adjacentWrappers: [
    ['node_modules', 'cline', 'bin', 'cline'],
    ['node_modules', '@cline', 'cline', 'bin', 'cline'],
  ],
  shimSource: target => (target.prefixArgs.length > 0 ? 'node-wrapper' : 'path-executable'),
};

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

    return resolveHostBinary(CLINE_BINARY);
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

    // A cmd.exe bridge is never run, not even for `version`: through cmd.exe a path with `&`, `^` or `@` breaks
    // the probe too, and the start would be refused anyway. Report the executable as found, carry the refusal text.
    const refusal = cmdShimRefusalFor(CLINE_SHIM_HOST, cmd.executable, cmd.prefixArgs);
    if (refusal) {
      diagnostics.push(refusal);
      return {
        installed: true,
        command: cmd,
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
