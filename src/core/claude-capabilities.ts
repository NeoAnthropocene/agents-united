import path from 'node:path';
import fs from 'fs-extra';
import { defaultProcessRunner } from './cline-capabilities.js';
import { loadHostProfile } from './host-profile.js';
import { RegistryResolver } from './registry.js';
import type {
  ClaudeCapabilityReport,
  ProcessRunner,
  ResolvedClaudeCommand,
} from './types.js';

export interface ClaudeProbeResolverOptions {
  resolveExecutable?: () => ResolvedClaudeCommand | null;
}

/**
 * ADR 0018 decision 11 / Plan 016 decision 12 — side-effect-free Claude Code capability probe.
 *
 * The probe runs **exactly two** commands, in this order and no others:
 *   1. `<exe> [...prefixArgs, '--version']`
 *   2. `<exe> [...prefixArgs, '--help']`
 *
 * Two documented non-goals (ADR 0018 decision 11, restated as Plan 016 decision 12) are
 * deliberately never invoked:
 *   - `claude agents --json` — it can start the supervisor daemon (a mutating side effect).
 *   - headless `-p` runs — they cost tokens (a billed side effect).
 * `--help` text is the only source of truth for capability flags, so the probe stays free of
 * both side effects; anything it cannot verify is reported as unsupported with a diagnostic.
 *
 * The process primitive is the shared `defaultProcessRunner` (argv arrays, `shell: false`,
 * hard timeout, never throws) that the Cline probe uses, so the Windows `.cmd`/`.bat`
 * `cmd.exe` bridge added by ADR 0013 §5 applies identically here.
 */
/**
 * Plan 032 Phase 7 — what the probe knows about the host lives in the Claude host profile
 * (`registry/hosts/claude/profile.json`), not in code: the `SubagentHandback` version floor
 * (`features.subagentHandback.since`, dated by the live tools reference; the tool is provided only in auto mode, and
 * only `--version` is readable here, so this reports the version floor), the minimum version and the version the
 * profile was last reviewed against. The fallback floor applies only if the profile cannot be read.
 */
const FALLBACK_SUBAGENT_HANDBACK_MIN = '2.1.271';

function parseVersion(version: string | undefined): [number, number, number] | undefined {
  const match = version?.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** Negative, zero or positive like a comparator; `undefined` when either side is not an x.y.z version. */
function compareVersions(a: string | undefined, b: string | undefined): number | undefined {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return undefined;
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

function supportsVersion(version: string | undefined, floor: string): boolean {
  const order = compareVersions(version, floor);
  return order !== undefined && order >= 0;
}

function readClaudeProfile(): ReturnType<typeof loadHostProfile> | undefined {
  try {
    return loadHostProfile(new RegistryResolver().getRegistryDir(), 'claude');
  } catch {
    return undefined;
  }
}

export class ClaudeCapabilityProbe {
  private runner: ProcessRunner;
  private customResolver?: () => ResolvedClaudeCommand | null;

  constructor(runner?: ProcessRunner, options?: ClaudeProbeResolverOptions) {
    this.runner = runner || defaultProcessRunner;
    this.customResolver = options?.resolveExecutable;
  }

  /**
   * Safe executable resolution across POSIX and Windows layouts.
   */
  public resolveExecutable(): ResolvedClaudeCommand | null {
    if (this.customResolver) {
      return this.customResolver();
    }

    // 1. Explicit CLAUDE_BIN_PATH
    const envBin = process.env.CLAUDE_BIN_PATH;
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
      const exeNames = ['claude.cmd', 'claude.bat', 'claude.exe', 'claude'];
      for (const dir of dirs) {
        for (const exeName of exeNames) {
          const fullPath = path.join(dir, exeName);
          if (fs.existsSync(fullPath)) {
            // Check adjacent Node wrapper in npm / nvm / volta structure
            const adjacentWrapper1 = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
            const adjacentWrapper2 = path.join(dir, 'node_modules', 'claude', 'bin', 'claude');

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
        const fullPath = path.join(dir, 'claude');
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
   * Run the read-only capability probe against local Claude Code. Never throws: an absent
   * executable, a non-zero exit and a runner error are all reported as data.
   */
  public async probe(): Promise<ClaudeCapabilityReport> {
    const cmd = this.resolveExecutable();
    const diagnostics: string[] = [];

    if (!cmd) {
      diagnostics.push('Claude Code executable not found on PATH or via CLAUDE_BIN_PATH.');
      return {
        installed: false,
        pluginSupport: false,
        agentTeamsExperimental: false,
        subagentHandback: false,
        diagnostics,
      };
    }

    // 1. Version check — `--version` only (ADR 0018 decision 11).
    const hostProfile = readClaudeProfile();
    const handbackFloor = hostProfile?.features.subagentHandback?.since ?? FALLBACK_SUBAGENT_HANDBACK_MIN;
    let version: string | undefined;
    let subagentHandback = false;
    try {
      const verRes = await this.runner(cmd.executable, [...cmd.prefixArgs, '--version'], {
        timeoutMs: 5000,
      });

      if (verRes.exitCode === 0) {
        version = verRes.stdout.trim().split('\n')[0]?.trim();
        subagentHandback = supportsVersion(version, handbackFloor);
      } else {
        diagnostics.push(`Claude Code version check failed (exit code ${verRes.exitCode}): ${verRes.stderr.trim()}`);
        return {
          installed: false,
          command: cmd,
          pluginSupport: false,
          agentTeamsExperimental: false,
          subagentHandback: false,
          diagnostics,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Error executing Claude Code version check: ${msg}`);
      return {
        installed: false,
        command: cmd,
        pluginSupport: false,
        agentTeamsExperimental: false,
        subagentHandback: false,
        diagnostics,
      };
    }

    // 2. Flag surface — `--help` text only. No `claude agents --json` (it can start the
    //    supervisor daemon) and no headless `-p` run (it costs tokens) — see the class JSDoc.
    let pluginSupport = false;
    let agentTeamsExperimental = false;
    let helpRead = false;
    try {
      const helpRes = await this.runner(cmd.executable, [...cmd.prefixArgs, '--help'], {
        timeoutMs: 5000,
      });

      if (helpRes.exitCode === 0) {
        helpRead = true;
        const help = helpRes.stdout;
        pluginSupport = help.includes('--plugin-dir');
        agentTeamsExperimental =
          /agent teams/i.test(help) || help.includes('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
      } else {
        diagnostics.push(
          `Claude Code help probe returned non-zero (exit code ${helpRes.exitCode}); plugin and agent-team support could not be verified.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`Claude Code help probe failed: ${msg}`);
    }

    // 3. Check what the binary said against what the host profile expects. Diagnostics only: the report keeps the
    //    runtime facts.
    let profile: ClaudeCapabilityReport['profile'];
    if (hostProfile) {
      const againstMinimum = compareVersions(version, hostProfile.minVersion);
      const againstReviewed = compareVersions(version, hostProfile.reviewedAgainst);
      const belowMinimum = againstMinimum !== undefined && againstMinimum < 0;
      const newerThanReviewed = againstReviewed !== undefined && againstReviewed > 0;
      profile = {
        profileId: hostProfile.profileId,
        minVersion: hostProfile.minVersion,
        reviewedAgainst: hostProfile.reviewedAgainst,
        belowMinimum,
        newerThanReviewed,
      };
      if (belowMinimum) {
        diagnostics.push(
          `Claude Code ${version} is older than the minimum ${hostProfile.minVersion} that profile ${hostProfile.profileId} supports; native agents may rely on features it lacks.`
        );
      }
      // `newerThanReviewed` stays data for the maintainers' host-update workflow. It is deliberately not a diagnostic:
      // users would see it on every Claude release, and it asks nothing of them.
      if (helpRead && !belowMinimum && hostProfile.features.pluginLane?.status === 'available' && !pluginSupport) {
        diagnostics.push('The profile declares the plugin lane available, but --help does not list --plugin-dir.');
      }
    }

    return {
      installed: true,
      version,
      command: cmd,
      pluginSupport,
      agentTeamsExperimental,
      subagentHandback,
      profile,
      diagnostics,
    };
  }
}
