import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { AgentHostAdapter } from './adapter.js';
import { ClaudeCapabilityProbe } from './claude-capabilities.js';
import { ClaudeProjector } from './claude-projector.js';
import { defaultProcessRunner } from './cline-capabilities.js';
import type {
  ClaudeCapabilityReport,
  InstallScope,
  LockfileManifest,
  ProcessRunner,
} from './types.js';

/** Default coordinator when the caller could not resolve the bundle's own `orchestrator` field. */
const DEFAULT_COORDINATOR = 'orchestrator-engineering.md';

export interface ClaudeActivationPlan {
  bundleName: string;
  scope: InstallScope;
  workspace: string;
  executable: string;
  argv: string[];
  bootstrapPrompt: string;
  env: Record<string, string>;
}

export interface PlanClaudeActivationOptions {
  bundleName: string;
  workspace: string;
  scope: InstallScope;
  report: ClaudeCapabilityReport;
  prompt?: string;
  /** Optional coordinator agent filename (e.g. "orchestrator-universal.md"). Resolved from the bundle
   *  definition by the caller; defaults to orchestrator-engineering.md for backward compatibility. */
  orchestrator?: string;
  /** `--bg`: run the session in the background. */
  background?: boolean;
  /** Pre-authorize recommended addon installs for this session (mirrors `ClineLauncher`). */
  allowAddons?: boolean;
  /** Experimental agent-teams scaffold — ephemeral env + prompt instruction only (Plan 016 decision 14). */
  teams?: boolean;
  /** Plugin root for `--plugin-dir` (Step 7 emits the manifest inside it). */
  pluginDir?: string;
}

export interface ResolveClaudeInstallationOptions {
  scope?: InstallScope;
  global?: boolean;
  cwd?: string;
}

/**
 * ADR 0018 / Plan 016 decision 12 — the Claude Code activation lane, mirroring `ClineLauncher` in shape
 * (same constructor seam, same resolve/plan/launch split, same argv-array discipline with `shell: false`).
 *
 * Two hard boundaries carried by this file:
 *   1. The launcher only ever *describes* a session. It writes no file under `.claude/**`, never touches
 *      `CLAUDE.md` / `CLAUDE.local.md` / `.claude/settings.json` / `.claude/workflows/**`, and the teams
 *      scaffold persists nothing anywhere (no `~/.claude/teams/`, no settings key).
 *   2. Every value is one argv element. `--agent` and its value are pushed separately, the workspace is a
 *      single `--add-dir` argument, and the bootstrap prompt is a single final argument, so no prompt text
 *      is ever word-split, shell-expanded or joined into a command string.
 */
export class ClaudeLauncher {
  private probe: ClaudeCapabilityProbe;
  private runner: ProcessRunner;

  constructor(probe?: ClaudeCapabilityProbe, runner?: ProcessRunner) {
    this.probe = probe || new ClaudeCapabilityProbe();
    this.runner = runner || defaultProcessRunner;
  }

  /**
   * The `--agent` value must equal the projected coordinator definition's basename without `.md`.
   *
   * A projected coordinator keeps its full `orchestrator-<x>` name in `.claude/agents/`: coordinators are
   * never `subagent-<x>` files, so the prefix stripping that applies to every specialist role is a no-op
   * here. We still route through the projector's own helper so the launcher and the renderer can never
   * diverge if a bundle ever declares a differently-prefixed orchestrator.
   */
  public static resolveCoordinatorName(orchestrator?: string): string {
    const file = (orchestrator && orchestrator.trim().length > 0 ? orchestrator.trim() : DEFAULT_COORDINATOR)
      .replace(/\.md$/i, '');
    return ClaudeProjector.stripSubagentPrefix(path.basename(file));
  }

  /**
   * Resolve an installed bundle for Claude Code activation. Mirrors `ClineLauncher.resolveInstallation`:
   * same global→project fallback, same `.agents/agents-united.json` lockfile path, same error text.
   */
  public async resolveInstallation(
    bundleName: string,
    options: ResolveClaudeInstallationOptions = {}
  ): Promise<{ scope: InstallScope; workspace: string; lockfile: LockfileManifest; manifestPath: string }> {
    const cwd = options.cwd || process.cwd();
    const isGlobal = !!options.global;

    let targetDir: string;
    let scope: InstallScope;
    let workspace: string;

    if (isGlobal) {
      targetDir = AgentHostAdapter.resolveHostDir('global', 'agents');
      scope = 'global';
      workspace = os.homedir();
    } else {
      workspace = cwd;
      targetDir = path.join(cwd, '.agents');
      scope = 'project';
    }

    const lockfilePath = path.join(targetDir, 'agents-united.json');
    if (!await fs.pathExists(lockfilePath)) {
      if (!isGlobal) {
        // Check if global installation exists as fallback
        const globalTarget = AgentHostAdapter.resolveHostDir('global', 'agents');
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

    // Host gate. The Cline lane requires both the recorded fanout and the projected artifact. The Claude
    // lane is satisfied by either signal: the host-neutral Team Manifest under `.agents/plugins/<bundle>/`
    // is the artifact the bootstrap prompt actually reads, and it is emitted by the compound lane, while
    // `fanout: ['claude']` is the recorded host signal. Requiring both would make
    // `agents start --host claude --dry-run` fail in a workspace whose install predates the Claude lane,
    // which is exactly the case the dry-run exists to preview. A workspace with neither signal is not
    // projected at all and gets the same actionable remedy the Cline lane prints.
    const hasClaudeFanout = (lockfile.fanout || []).includes('claude');
    const manifestRel = `.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;
    const manifestPath = path.join(workspace, manifestRel);

    if (!hasClaudeFanout && !await fs.pathExists(manifestPath)) {
      throw new Error(
        `Bundle '${bundleName}' is not projected to Claude. Run 'agents update ${bundleName} --fanout claude' first.`
      );
    }

    return {
      scope,
      workspace,
      lockfile,
      manifestPath,
    };
  }

  /**
   * Plan the argv, bootstrap prompt and ephemeral environment for a Claude Code session. Pure: no process
   * is spawned and nothing is written to disk, so `--dry-run` can call it safely.
   */
  public planActivation(options: PlanClaudeActivationOptions): ClaudeActivationPlan {
    const {
      bundleName,
      workspace,
      scope,
      report,
      prompt,
      orchestrator,
      allowAddons,
      background,
      teams,
      pluginDir,
    } = options;

    const command = report.command || {
      executable: 'claude',
      prefixArgs: [],
      source: 'path-executable' as const,
    };

    const coordinatorName = ClaudeLauncher.resolveCoordinatorName(orchestrator);
    const homePrefix = scope === 'global' ? '~/' : '';
    const manifestRel = `${homePrefix}.agents/plugins/${bundleName}/agents-united/teams/${bundleName}.yaml`;
    // The projected coordinator definition. Read-only reference: this launcher never writes under
    // `.claude/**` — the projection engine owns that namespace.
    const coordinatorRel = `${homePrefix}.claude/agents/${coordinatorName}.md`;

    const addonPolicyText = allowAddons
      ? 'Addon auto-installation is pre-authorized for this session.'
      : `Before installing any recommended addon, explain the requirement to the user and request explicit confirmation to run: agents add <addon> -t claude ${scope === 'global' ? '-g ' : ''}-y.`;

    const deploymentNoteText =
      `Deployment note: this bundle is already projected natively for this workspace - roles in "${homePrefix}.claude/agents/", ` +
      `skills in "${homePrefix}.claude/skills/" and rules in "${homePrefix}.claude/rules/". The single source of truth stays the ` +
      `canonical store under "${homePrefix}.agents/" (ADR 0018): read the projections, edit the canonical files, never the copies.`;

    // Ordinary Claude sessions delegate by description; a `--agent` session runs this coordinator's own
    // projected definition on the main thread, which is the only way the real `Agent(...)` allowlist
    // (specialist type names) is enforced.
    const delegationNoteText =
      `Delegation on this host works by description: in an ordinary Claude Code session you name a specialist and Claude ` +
      `picks the matching definition from "${homePrefix}.claude/agents/". This session was started with \`claude --agent ${coordinatorName}\`, ` +
      `so your own projected coordinator definition runs on the main thread and the real \`Agent(...)\` allowlist in its ` +
      `frontmatter is what bounds the specialists you may delegate to - send work only to those exact agent type names.`;

    const taskText = prompt && prompt.trim().length > 0
      ? `User task: ${prompt.trim()}`
      : 'Please introduce your coordinator role to the user and ask for their first task.';

    const bootstrapLines = [
      `You are coordinating the "${bundleName}" team in Agents United.`,
      `Read the Team Manifest at "${manifestRel}" and your coordinator role definition at "${coordinatorRel}" before acting.`,
      delegationNoteText,
      'Use specialist roles only when necessary.',
      addonPolicyText,
      deploymentNoteText,
      taskText,
    ];

    if (teams === true) {
      // ADR 0018 decision 13 / Plan 016 decision 14 — the teams scaffold is experimental, minimal and never
      // load-bearing. This instruction text deliberately never names the opt-in environment variable: the
      // variable is injected into the spawned process environment only and must not appear in argv, so it can
      // never leak into a prompt, a shell echo or a transcript.
      bootstrapLines.push(
        `Agent teams are enabled for this session as an EXPERIMENTAL scaffold: spawn teammates from the projected agent ` +
        `types by name - the names you see in "${homePrefix}.claude/agents/" (specialists are projected with their ` +
        `"subagent-" prefix stripped, e.g. \`backend-architect\`). The scaffold is deliberately minimal: exactly one team per ` +
        `session, you are the fixed lead, there is no nested teams and no session resumption, and nothing about it is ` +
        `persisted to disk. Never make it load-bearing - if a teammate cannot be spawned, continue with ordinary delegated ` +
        `subagents using the Agent tool.`
      );
    }

    const bootstrapPrompt = bootstrapLines.join('\n\n');

    // ADR 0018 decision 13 / Plan 016 decision 14: the opt-in is injected EPHEMERALLY into the spawned
    // process environment only. It is never written to `.claude/settings.json`, never recorded in a lockfile
    // or any other workspace file, nothing is written under `~/.claude/teams/`, and the variable name must
    // never appear in argv. `env` is otherwise empty - the launcher merges it over `process.env` at spawn.
    const env: Record<string, string> = {};
    if (teams === true) {
      env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
    }

    const argv: string[] = [...command.prefixArgs];
    // `--agent` names the projected coordinator definition. The projected file in `.claude/agents/` keeps its
    // full `orchestrator-<x>` name - the `subagent-` prefix stripping that applies to every specialist role is
    // a no-op for coordinators - so this value MUST equal the projected file basename without `.md`.
    argv.push('--agent');
    argv.push(coordinatorName);
    argv.push('--add-dir');
    argv.push(workspace);
    if (background === true) {
      argv.push('--bg');
    }
    if (pluginDir) {
      argv.push('--plugin-dir');
      argv.push(pluginDir);
    }
    argv.push(bootstrapPrompt);

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
   * Launch the Claude Code session from the argv array. Mirrors `ClineLauncher.launch`: `shell: false`
   * (never `shell: true`), `stdio: 'inherit'`, and the plan's ephemeral env merged over `process.env`.
   */
  public async launch(plan: ClaudeActivationPlan): Promise<void> {
    const { spawn } = await import('node:child_process');
    const child = spawn(plan.executable, plan.argv, {
      cwd: plan.workspace,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...plan.env },
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          resolve(); // return cleanly on process exit
        }
      });
    });
  }
}
