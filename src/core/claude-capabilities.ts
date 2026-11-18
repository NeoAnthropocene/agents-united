import { defaultProcessRunner } from './cline-capabilities.js';
import { CLAUDE_SHIM_HOST, cmdShimRefusalFor } from './cmd-shim.js';
import { resolveHostBinary } from './host-binary.js';
import type { WrappedHostBinarySpec } from './host-binary.js';
import { loadHostProfile } from './host-profile.js';
import { RegistryResolver } from './registry.js';
import type {
  ClaudeCapabilityReport,
  ProcessRunner,
  ResolvedClaudeCommand,
} from './types.js';

/** Claude Code: a `claude.exe` (native installer) or an npm shim, with the Node script beside it taking priority. */
const CLAUDE_BINARY: WrappedHostBinarySpec = {
  binaryName: 'claude',
  envVar: 'CLAUDE_BIN_PATH',
  adjacentWrappers: [
    ['node_modules', '@anthropic-ai', 'claude-code', 'cli.js'],
    ['node_modules', 'claude', 'bin', 'claude'],
  ],
  shimSource: target => (target.prefixArgs.length > 0 ? 'node-wrapper' : 'path-executable'),
};

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
 * A flag that `--help` names is read from it. A feature `--help` does not name is reported from the
 * profile's version floor instead (`SubagentHandback`, agent teams: `claude --help` on 2.1.289 and
 * 2.1.291 carries no agent-teams text although the feature runs there), so the probe stays free of
 * both side effects; anything it can verify by neither is reported as unsupported with a diagnostic.
 *
 * The process primitive is the shared `defaultProcessRunner` (argv arrays, `shell: false`,
 * hard timeout, never throws) that the Cline probe uses, so the Windows `.cmd`/`.bat`
 * `cmd.exe` bridge added by ADR 0013 §5 applies identically here.
 */
/**
 * Plan 032 Phase 7 — what the probe knows about the host lives in the Claude host profile
 * (`registry/hosts/claude/profile.json`), not in code: the `SubagentHandback` version floor
 * (`features.subagentHandback.since`, dated by the live tools reference; the tool is provided only in auto mode, and
 * only `--version` is readable here, so this reports the version floor), the agent-teams floor
 * (`features.agentTeams.since`, dated by the changelog snapshot: the research preview arrived in 2.1.32), the minimum
 * version and the version the profile was last reviewed against. The fallback floors apply only if the profile cannot
 * be read.
 */
const FALLBACK_SUBAGENT_HANDBACK_MIN = '2.1.271';
const FALLBACK_AGENT_TEAMS_MIN = '2.1.32';

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

export function supportsVersion(version: string | undefined, floor: string): boolean {
  const order = compareVersions(version, floor);
  return order !== undefined && order >= 0;
}

/**
 * The one text for a Claude Code that is older than the supported floor (the maintainer's decision of 2026-11-17). The probe
 * carries it as a diagnostic and the doctor reports it as an error; the CLI prints it once. `version` may be the raw
 * `--version` line ("2.1.272 (Claude Code)"); only the number is quoted.
 */
export function claudeBelowFloorMessage(version: string, floor: string): string {
  const installed = /\d+\.\d+\.\d+/.exec(version)?.[0] ?? version;
  return (
    `Claude Code ${installed} is older than the supported minimum ${floor}: the guards cannot block when they fail to run on this version. ` +
    'Installs and starts still work. Update Claude Code.'
  );
}

function readClaudeProfile():ReturnType<typeof loadHostProfile> | undefined {
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

    return resolveHostBinary(CLAUDE_BINARY);
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

    // A cmd.exe bridge is never run, not even for `--version`: through cmd.exe a path with `&`, `^` or `@` breaks
    // the probe too, and the start would be refused anyway. Report the executable as found, carry the refusal text.
    const refusal = cmdShimRefusalFor(CLAUDE_SHIM_HOST, cmd.executable, cmd.prefixArgs);
    if (refusal) {
      diagnostics.push(refusal);
      return {
        installed: true,
        command: cmd,
        pluginSupport: false,
        agentTeamsExperimental: false,
        subagentHandback: false,
        diagnostics,
      };
    }

    // 1. Version check — `--version` only (ADR 0018 decision 11).
    const hostProfile = readClaudeProfile();
    const handbackFloor = hostProfile?.features.subagentHandback?.since ?? FALLBACK_SUBAGENT_HANDBACK_MIN;
    const agentTeamsFloor = hostProfile?.features.agentTeams?.since ?? FALLBACK_AGENT_TEAMS_MIN;
    let version: string | undefined;
    let subagentHandback = false;
    let agentTeamsFromVersion = false;
    try {
      const verRes = await this.runner(cmd.executable, [...cmd.prefixArgs, '--version'], {
        timeoutMs: 5000,
      });

      if (verRes.exitCode === 0) {
        version = verRes.stdout.trim().split('\n')[0]?.trim();
        subagentHandback = supportsVersion(version, handbackFloor);
        agentTeamsFromVersion = supportsVersion(version, agentTeamsFloor);
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
    let agentTeamsExperimental = agentTeamsFromVersion;
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
          agentTeamsFromVersion || /agent teams/i.test(help) || help.includes('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
      } else {
        diagnostics.push(
          `Claude Code help probe returned non-zero (exit code ${helpRes.exitCode}); plugin support could not be verified.`
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
          claudeBelowFloorMessage(version as string, hostProfile.minVersion)
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
