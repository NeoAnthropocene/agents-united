import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { AntigravityCapabilityProbe } from './antigravity-capabilities.js';
import { defaultProcessRunner } from './cline-capabilities.js';
import { resolveStateDir } from './state-dir.js';
import type {
  AntigravityCapabilityReport,
  InstallScope,
  LockfileManifest,
  ProcessRunner,
} from './types.js';

/** Default coordinator when the caller could not resolve the bundle's own `orchestrator` field. */
const DEFAULT_COORDINATOR = 'orchestrator-engineering.md';

export interface AntigravityActivationPlan {
  bundleName: string;
  scope: InstallScope;
  workspace: string;
  executable: string;
  argv: string[];
  bootstrapPrompt: string;
  env: Record<string, string>;
}

export interface PlanAntigravityActivationOptions {
  bundleName: string;
  workspace: string;
  scope: InstallScope;
  report: AntigravityCapabilityReport;
  /** The opening prompt, passed as one `--prompt-interactive` argument. Omitted ⇒ no opening prompt. */
  prompt?: string;
  /** Optional coordinator agent filename (e.g. "orchestrator-universal.md"). Resolved from the bundle
   *  definition by the caller; defaults to orchestrator-engineering.md for backward compatibility. */
  orchestrator?: string;
}

export interface ResolveAntigravityInstallationOptions {
  scope?: InstallScope;
  global?: boolean;
  cwd?: string;
}

/**
 * Plan 029 B6 / Objective 6 — the Antigravity activation lane, mirroring `ClaudeLauncher` in shape
 * (same constructor seam, same resolve/plan/launch split, same argv-array discipline with
 * `shell: false`).
 *
 * Two hard boundaries carried by this file:
 *   1. The launcher only ever *describes* a session. It writes no file, and the canonical
 *      `.agents/**` tree it points at is installed by the `agents` host, never by this lane.
 *   2. Every value is one argv element. `--agent` and its value are pushed separately, and the
 *      opening prompt is a single `--prompt-interactive` argument, so no prompt text is ever
 *      word-split, shell-expanded or joined into a command string.
 *
 * The verified-live invocation (agy 1.2.12) is:
 *   `agy --agent <bundle orchestrator> --prompt-interactive "<opening prompt>"`
 * `--print` / `-p` / `--prompt` are non-interactive and are deliberately never emitted.
 */
export class AntigravityLauncher {
  private probe: AntigravityCapabilityProbe;
  private runner: ProcessRunner;

  constructor(probe?: AntigravityCapabilityProbe, runner?: ProcessRunner) {
    this.probe = probe || new AntigravityCapabilityProbe();
    this.runner = runner || defaultProcessRunner;
  }

  /**
   * The `--agent` value must equal the canonical coordinator definition's basename without `.md`.
   *
   * Mirrors `ClaudeLauncher.resolveCoordinatorName` (same strip of a leading `subagent-` prefix and
   * the `.md` suffix) without importing the Claude lane: on Antigravity the canonical file under
   * `.agents/agents/` is installed verbatim, so its basename *is* the agent name.
   */
  public static resolveCoordinatorName(orchestrator?: string): string {
    const file = (orchestrator && orchestrator.trim().length > 0 ? orchestrator.trim() : DEFAULT_COORDINATOR)
      .replace(/\.md$/i, '');
    return path.basename(file).replace(/^subagent-/, '');
  }

  /**
   * Resolve an installed bundle for Antigravity activation. Mirrors
   * `ClaudeLauncher.resolveInstallation`: same state-dir discovery (`.agents/` store or the
   * store-less sidecar), same global→project fallback, same error text.
   *
   * No host gate is applied here on purpose. The `agents` host IS the canonical store, so a bundle
   * present in this lockfile is by definition projected to the Antigravity lane; requiring a
   * separate fanout signal would make `agents start --host antigravity` fail on exactly the install
   * it is meant to launch. Whether the canonical coordinator file exists is checked by the caller
   * before anything is spawned.
   */
  public async resolveInstallation(
    bundleName: string,
    options: ResolveAntigravityInstallationOptions = {}
  ): Promise<{ scope: InstallScope; workspace: string; lockfile: LockfileManifest; manifestPath: string }> {
    const cwd = options.cwd || process.cwd();
    const isGlobal = !!options.global;

    let targetDir: string;
    let scope: InstallScope;
    let workspace: string;

    // Plan 023 B (ADR 0022) — the state dir is the `.agents/` store or the store-less sidecar.
    if (isGlobal) {
      targetDir = resolveStateDir('global');
      scope = 'global';
      workspace = os.homedir();
    } else {
      workspace = cwd;
      targetDir = resolveStateDir('project', undefined, { cwd });
      scope = 'project';
    }

    const lockfilePath = path.join(targetDir, 'agents-united.json');
    if (!await fs.pathExists(lockfilePath)) {
      if (!isGlobal) {
        // Check if global installation exists as fallback
        const globalTarget = resolveStateDir('global');
        const globalLockfile = path.join(globalTarget, 'agents-united.json');
        if (await fs.pathExists(globalLockfile)) {
          const gLock: LockfileManifest = await fs.readJson(globalLockfile);
          if (gLock.installed?.bundles?.includes(bundleName)) {
            return this.resolveInstallation(bundleName, { ...options, global: true });
          }
        }
      }
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.`);
    }

    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    if (!lockfile.installed?.bundles?.includes(bundleName)) {
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.`);
    }

    const manifestRel = `.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;

    return {
      scope,
      workspace,
      lockfile,
      manifestPath: path.join(workspace, manifestRel),
    };
  }

  /**
   * Plan the argv and bootstrap prompt for an Antigravity session. Pure: no process is spawned and
   * nothing is written to disk, so `--dry-run` can call it safely.
   */
  public planActivation(options: PlanAntigravityActivationOptions): AntigravityActivationPlan {
    const { bundleName, workspace, scope, report, prompt, orchestrator } = options;

    const command = report.command || {
      executable: 'agy',
      prefixArgs: [],
      source: 'path-executable' as const,
    };

    // Coordinator role = the bundle's declared orchestrator when available; falls back to
    // orchestrator-engineering.md only to preserve pre-existing behaviour. `.agents/agents/<name>.md`
    // is the canonical file installed by the `agents` host, so it is also the desktop-route target.
    const coordinatorName = AntigravityLauncher.resolveCoordinatorName(orchestrator);
    const coordinatorCanonical = `.agents/agents/${coordinatorName}.md`;

    const manifestRel = scope === 'global'
      ? `~/.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`
      : `.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;

    const taskText = prompt && prompt.trim().length > 0
      ? `User task: ${prompt.trim()}`
      : 'Please introduce your coordinator role to the user and ask for their first task.';

    const bootstrapPrompt = [
      `You are coordinating the "${bundleName}" team in Agents United.`,
      `Read the Team Manifest at "${manifestRel}" and your coordinator role definition at "${coordinatorCanonical}" before acting.`,
      `Delegate specialist work with the invoke_subagent tool; register a specialist with define_subagent only when it is not already reachable by name, and pass the canonical role body verbatim rather than a summary.`,
      `Use specialist roles only when necessary.`,
      `Before installing any recommended addon, explain the requirement to the user and request explicit confirmation to run: agents add <addon> -t agents -y.`,
      taskText,
    ].join('\n\n');

    const env: Record<string, string> = {};

    const argv: string[] = [...command.prefixArgs];
    // `--agent` names the canonical coordinator definition under `.agents/agents/`.
    argv.push('--agent');
    argv.push(coordinatorName);
    // An opening prompt CAN be passed on this CLI (verified live: `-i, --prompt-interactive`). The
    // flag is emitted whenever a prompt exists rather than gated on the probe's help-derived flag:
    // help text can be unavailable while the flag itself is still present, and silently dropping the
    // user's task would be worse than an explicit failure. The caller reports an unverified flag.
    if (prompt && prompt.trim().length > 0) {
      argv.push('--prompt-interactive');
      argv.push(prompt);
    }

    return {
      bundleName,
      scope,
      workspace,
      executable: command.executable,
      argv,
      bootstrapPrompt,
      env,
    };
  }

  /**
   * Launch the Antigravity session from the argv array. Mirrors `ClaudeLauncher.launch`: no shell is
   * ever used to interpret the command (`shell: false` on the spawn options below), `stdio: 'inherit'`,
   * and the plan's ephemeral env merged over `process.env`.
   */
  public async launch(plan: AntigravityActivationPlan): Promise<void> {
    const { spawn } = await import('node:child_process');
    const child = spawn(plan.executable, plan.argv, {
      cwd: plan.workspace,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...plan.env },
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', () => {
        resolve(); // return cleanly on process exit
      });
    });
  }
}
