import path from 'node:path';
import fs from 'fs-extra';
import { defaultProcessRunner } from './cline-capabilities.js';
import type {
  AntigravityCapabilityReport,
  ProcessRunner,
  ResolvedAgyCommand,
} from './types.js';

export interface AntigravityProbeResolverOptions {
  resolveExecutable?: () => ResolvedAgyCommand | null;
}

/**
 * Plan 029 B6 / Objective 6 — side-effect-free Antigravity CLI (`agy`) capability probe.
 *
 * Mirrors `ClaudeCapabilityProbe` structurally (same constructor seam, same never-throws contract,
 * same argv-array discipline through the shared `defaultProcessRunner`). The probe runs **exactly
 * two** commands, in this order and no others:
 *
 *   1. `<exe> [...prefixArgs, '--version']`
 *   2. `<exe> [...prefixArgs, '--help']`
 *
 * Deliberate non-goals, restated because they are the whole point of the design:
 *   - no `agy --agent ... --prompt-interactive ...` run — that opens an interactive session and can
 *     mutate the workspace;
 *   - no `agy --print` / `-p` headless turn — that costs tokens (and is explicitly not a
 *     conformance target of Plan 029);
 *   - no `agy mcp list` — the MCP surface belongs to `agents doctor`, not to a probe.
 * `--help` text is the only source of truth for the flag surface, so an unverifiable capability is
 * reported as unsupported with a diagnostic rather than assumed.
 *
 * Executable resolution order: an absolute, existing `AGY_BIN_PATH` wins, then a PATH scan
 * (`agy.exe` / `agy.cmd` / `agy.bat` / `agy` on Windows, `agy` on POSIX). A `.cmd`/`.bat` hit is
 * bridged through `cmd.exe` exactly like the Cline/Claude probes (ADR 0013 §5): Node >= 18.20 /
 * 20.12 / 24 rejects spawning shell shims with `shell: false` (EINVAL). There is deliberately **no**
 * hard-coded install-location fallback — a machine-specific path would make the probe's answer
 * depend on whose machine it runs on; `AGY_BIN_PATH` is the documented escape hatch for an `agy`
 * that is not on PATH.
 */

/**
 * The live-verified floor: `agy 1.2.12` (Windows, probed 2026-09-28) is the release on which
 * `--agent <name>`, `-i, --prompt-interactive` and `--mode <accept-edits|plan>` were confirmed.
 * Reported as data, never as a gate — the probe's `installed` flag stays a pure `--version` signal.
 */
const AGY_MIN_VERSION = { major: 1, minor: 2, patch: 12 } as const;

function meetsVersionFloor(version: string | undefined): boolean {
  if (!version) return false;
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (major !== AGY_MIN_VERSION.major) return major > AGY_MIN_VERSION.major;
  if (minor !== AGY_MIN_VERSION.minor) return minor > AGY_MIN_VERSION.minor;
  return patch >= AGY_MIN_VERSION.patch;
}

/** Values advertised after the `--mode <mode>` placeholder (e.g. `accept-edits, plan`). */
function parseModeValues(help: string): string[] {
  const line = help.split('\n').find(candidate => /--mode\b/.test(candidate));
  if (!line) return [];
  const afterPlaceholder = line.includes('>') ? line.slice(line.indexOf('>') + 1) : line;
  return Array.from(
    new Set(
      afterPlaceholder
        .split(',')
        .map(value => value.trim())
        .filter(value => /^[a-z][a-z-]*$/.test(value))
    )
  );
}


export class AntigravityCapabilityProbe {
  private runner: ProcessRunner;
  private customResolver?: () => ResolvedAgyCommand | null;

  constructor(runner?: ProcessRunner, options?: AntigravityProbeResolverOptions) {
    this.runner = runner || defaultProcessRunner;
    this.customResolver = options?.resolveExecutable;
  }

  /**
   * Safe executable resolution across POSIX and Windows layouts.
   */
  public resolveExecutable(): ResolvedAgyCommand | null {
    if (this.customResolver) {
      return this.customResolver();
    }

    // 1. Explicit AGY_BIN_PATH (mirrors CLAUDE_BIN_PATH: absolute + existing wins).
    const envBin = process.env.AGY_BIN_PATH;
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
      const exeNames = ['agy.exe', 'agy.cmd', 'agy.bat', 'agy'];
      for (const dir of dirs) {
        for (const exeName of exeNames) {
          const fullPath = path.join(dir, exeName);
          if (!fs.existsSync(fullPath)) continue;

          // Windows hardening (ADR 0013 §5): route .cmd/.bat shims through cmd.exe while keeping
          // the argv array shell-safe.
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
    } else {
      for (const dir of dirs) {
        const fullPath = path.join(dir, 'agy');
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
   * Run the read-only capability probe against the local Antigravity CLI. Never throws: an absent
   * executable, a non-zero exit and a runner error are all reported as data.
   */
  public async probe(): Promise<AntigravityCapabilityReport> {
    const cmd = this.resolveExecutable();
    const diagnostics: string[] = [];

    if (!cmd) {
      diagnostics.push('Antigravity CLI (agy) not found on PATH or via AGY_BIN_PATH.');
      return {
        installed: false,
        agentFlag: false,
        promptInteractive: false,
        modes: [],
        meetsVersionFloor: false,
        diagnostics,
      };
    }

    // 1. Version check — `--version` only.
    let version: string | undefined;
    try {
      const verRes = await this.runner(cmd.executable, [...cmd.prefixArgs, '--version'], {
        timeoutMs: 5000,
      });

      if (verRes.exitCode === 0) {
        version = verRes.stdout.trim().split('\n')[0]?.trim();
      } else {
        diagnostics.push(
          `Antigravity CLI version check failed (exit code ${verRes.exitCode}): ${verRes.stderr.trim()}`
        );
        return {
          installed: false,
          command: cmd,
          agentFlag: false,
          promptInteractive: false,
          modes: [],
          meetsVersionFloor: false,
          diagnostics,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Error executing Antigravity CLI version check: ${msg}`);
      return {
        installed: false,
        command: cmd,
        agentFlag: false,
        promptInteractive: false,
        modes: [],
        meetsVersionFloor: false,
        diagnostics,
      };
    }

    // 2. Flag surface — `--help` text only. No session, no headless turn, no MCP listing.
    let agentFlag = false;
    let promptInteractive = false;
    let modes: string[] = [];
    try {
      const helpRes = await this.runner(cmd.executable, [...cmd.prefixArgs, '--help'], {
        timeoutMs: 5000,
      });

      if (helpRes.exitCode === 0) {
        const help = helpRes.stdout;
        agentFlag = help.includes('--agent');
        promptInteractive = help.includes('--prompt-interactive');
        modes = parseModeValues(help);
      } else {
        diagnostics.push(
          `Antigravity CLI help probe returned non-zero (exit code ${helpRes.exitCode}); the --agent / --prompt-interactive / --mode surface could not be verified.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Antigravity CLI help probe failed: ${msg}`);
    }

    return {
      installed: true,
      version,
      command: cmd,
      agentFlag,
      promptInteractive,
      modes,
      meetsVersionFloor: meetsVersionFloor(version),
      diagnostics,
    };
  }
}
