import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { isDeepStrictEqual } from 'node:util';
import { assertClaudeFactorySelection, readClaudeFactoryMain } from './claude-factory-start.js';
import { ClaudeCapabilityProbe } from './claude-capabilities.js';
import { ClaudeProjector } from './claude-projector.js';
import { CLAUDE_SHIM_HOST, cmdShimRefusalFor } from './cmd-shim.js';
import { defaultProcessRunner } from './cline-capabilities.js';
import { resolveStateDir } from './state-dir.js';
import type {
  ClaudeCapabilityReport,
  ClaudeFactoryMainSelection,
  InstallScope,
  LockfileManifest,
  ProcessRunner,
} from './types.js';

/** Default coordinator when the caller could not resolve the bundle's own `orchestrator` field. */
const DEFAULT_COORDINATOR = 'orchestrator-engineering.md';

// Observed on 2.1.323 (2026-11-15, headless `--agent` runs): the factory main's preloaded Skill text was not in its context, so a main that reads the entry itself is told
// where it is and what `${CLAUDE_SKILL_DIR}` and the relative paths of a Skill file mean (it sees the variable as literal text). The agent body of the main
// (registry/hosts/claude/agents/orchestrator-agent-factory.md) states both sentences in the same words; tests/agent-factory-coordinator-launcher.test.ts pins that.
const FACTORY_SKILL_ENTRY_SENTENCE = 'If the text of the "coordinate-artifact" Skill is not already in your context, read its installed entry ".claude/skills/coordinate-artifact/SKILL.md" in full before your first action.';
const FACTORY_SKILL_DIR_SENTENCE = 'In a Skill file, "${CLAUDE_SKILL_DIR}" means that Skill\'s installed folder (".claude/skills/<skill name>" in the project), and a "scripts/", "references/" or "assets/" path in a Skill file is relative to that folder; use the absolute path when running a script.';

/** The variable that opts a Claude Code session into agent teams. */
const FACTORY_TEAMS_ENV = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';
/**
 * The one argv element (single `--opt=value` element, like `--add-dir=`) that turns agent teams off for the factory session in the settings the Host reads (finding S1-C of
 * 2026-11-15: a teammate instead of a subagent). Fork mode is left to the Host and the user's settings (P22, 2026-11-16: the maintainer chose background workers; the coordinator
 * waits for each hand-back, see the waiting rule in coordinate-artifact references/dispatch.md). Limit: managed settings still apply after a `--settings` payload (settings.md "Settings precedence").
 */
export const FACTORY_SESSION_SETTINGS_ARG = `--settings=${JSON.stringify({ env: { [FACTORY_TEAMS_ENV]: '0' } })}`;

/**
 * The checked shape of a factory plan at launch: the last five argv elements are exactly `--agent`, the checked main, `--add-dir=<workspace>`, the teams-off `--settings` element and the
 * first message; everything before them (the executable prefix) is not option-like; there is exactly one `--settings` element in either form; the plan env carries the teams variable as
 * `0` and no other spelling of its name (Windows names are case-insensitive).
 */
export function factoryLaunchShapeOk(plan: Pick<ClaudeActivationPlan, 'argv' | 'env' | 'workspace' | 'bootstrapPrompt' | 'nativeFactoryMain'>): boolean {
  const { argv } = plan;
  if (argv.length < 5 || !plan.nativeFactoryMain) return false;
  const tail = argv.slice(-5);
  if (tail[0] !== '--agent' || tail[1] !== plan.nativeFactoryMain.name || tail[2] !== `--add-dir=${plan.workspace}` || tail[3] !== FACTORY_SESSION_SETTINGS_ARG || tail[4] !== plan.bootstrapPrompt) return false;
  if (argv.slice(0, -5).some(arg => arg.startsWith('--'))) return false;
  if (argv.filter(arg => /^--settings(?:=|$)/.test(arg)).length !== 1) return false;
  const spellings = Object.keys(plan.env).filter(key => key.toUpperCase() === FACTORY_TEAMS_ENV);
  return spellings.length === 1 && spellings[0] === FACTORY_TEAMS_ENV && plan.env[FACTORY_TEAMS_ENV] === '0';
}

export interface ClaudeActivationPlan {
  bundleName: string;
  scope: InstallScope;
  workspace: string;
  executable: string;
  argv: string[];
  bootstrapPrompt: string;
  env: Record<string, string>;
  nativeFactoryMain?: ClaudeFactoryMainSelection;
  /** Set when the plan would start Claude Code through `cmd.exe /c <shim>`: the real start refuses with this text (see cmd-shim.ts). */
  cmdShimRefusal?: string;
}

export interface PlanClaudeActivationOptions {
  bundleName: string;
  workspace: string;
  scope: InstallScope;
  report: ClaudeCapabilityReport;
  nativeFactoryMain?: ClaudeFactoryMainSelection;
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
  /** Offer structured task tools in this session without enabling experimental Agent Teams. */
  taskTracking?: boolean;
  /** Plugin root for `--plugin-dir` (Step 7 emits the manifest inside it). */
  pluginDir?: string;
  /**
   * Whether the single host-neutral team manifest exists on disk for this workspace.
   *
   * ADR 0018 decision 6 keeps exactly one manifest under the organization package (never a
   * `.claude/` duplicate), and it is written by the Cline half of the compound lane. A claude-only
   * fanout therefore has none, so the caller passes `false` and the bootstrap prompt points at the
   * projected `.claude/agents/` roster instead of a dangling path. Omitted ⇒ the established
   * manifest instruction is used.
   */
  manifestAvailable?: boolean;
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
 *      single `--add-dir=<workspace>` element (the flag is variadic on the host, so a space-separated value
 *      would swallow the prompt), and the bootstrap prompt is a single final *positional* argument (the
 *      only opening-prompt mechanism Claude Code offers — there is intentionally no
 *      `--prompt-interactive` flag on this host), so no prompt text is ever word-split, shell-expanded
 *      or joined into a command string.
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
  ): Promise<{ scope: InstallScope; workspace: string; lockfile: LockfileManifest; manifestPath: string; nativeFactoryMain?: ClaudeFactoryMainSelection }> {
    const cwd = bundleName === 'agent-factory' ? path.resolve(options.cwd || process.cwd()) : options.cwd || process.cwd();
    const isGlobal = !!options.global;
    const factory = bundleName === 'agent-factory';
    if (factory && (isGlobal || options.scope === 'global')) throw new Error('Claude factory startup requires a project native installation; global startup is unavailable.');

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
      if (!isGlobal && !factory) {
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
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.${scope === 'project' ? ` Checked folder: ${path.resolve(workspace)}.` : ''}`);
    }

    const lockfile: LockfileManifest = await fs.readJson(lockfilePath);
    if (!lockfile.installed?.bundles?.includes(bundleName)) {
      throw new Error(`Bundle '${bundleName}' is not installed in ${scope} scope.${scope === 'project' ? ` Checked folder: ${path.resolve(workspace)}.` : ''}`);
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

    if (!factory && !hasClaudeFanout && !await fs.pathExists(manifestPath)) {
      throw new Error(
        `Bundle '${bundleName}' is not projected to Claude. Run 'agents update ${bundleName} --fanout claude' first.`
      );
    }

    return {
      scope,
      workspace,
      lockfile,
      manifestPath,
      ...(factory ? { nativeFactoryMain: readClaudeFactoryMain(workspace) } : {}),
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
      manifestAvailable,
    } = options;

    const command = report.command || {
      executable: 'claude',
      prefixArgs: [],
      source: 'path-executable' as const,
    };

    const factory = bundleName === 'agent-factory';
    if (factory) {
      assertClaudeFactorySelection(options.nativeFactoryMain);
      // An inherited CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS no longer refuses the plan: the plan turns teams off for this session (see the switch below).
      if (scope !== 'project' || !path.isAbsolute(workspace) || background || teams || pluginDir || (orchestrator && ClaudeLauncher.resolveCoordinatorName(orchestrator) !== options.nativeFactoryMain.name)) {
        throw new Error('Claude factory startup supports only foreground project native sessions without background, plugin or teams options.');
      }
      // The executable prefix is a Node wrapper path or `/c <shim>`; an option-like element could change the Host's settings, agent or directories ahead of the checked plan.
      if (command.prefixArgs.some(arg => arg.startsWith('--'))) throw new Error('Claude factory executable prefix must not override the checked foreground plan.');
    } else if (options.nativeFactoryMain) throw new Error('Factory main selection does not match the requested bundle.');
    const coordinatorName = factory ? options.nativeFactoryMain!.name : ClaudeLauncher.resolveCoordinatorName(orchestrator);
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
      : 'Please ask the user for their first task.';

    const trackingNote = 'For multi-step work, discover the actual TaskCreate, TaskGet, TaskUpdate and TaskList tools. ' +
      'Reuse task IDs from their returned results and keep the accepted slices, owners, blockers and evidence current. ' +
      'Use TodoWrite only when that legacy tool is actually available; otherwise track progress through the briefs and handoffs. ' +
      'An ordinary background subagent may not receive the Task tools: check each worker surface rather than assuming inheritance. ' +
      'Do not duplicate an existing task list, start a blocked slice, or mark a task complete merely because a turn ended.';

    // ADR 0018 decision 6 keeps ONE host-neutral team manifest, emitted under the organization
    // package and never duplicated into `.claude/`. That package is written by the Cline half of
    // the compound lane, so a claude-only fanout legitimately has no manifest on disk: pointing a
    // coordinator at a path that does not exist would make its first instruction fail. When the
    // caller reports the manifest is absent, the prompt falls back to the roster Claude actually
    // discovers — the projected agent definitions in `.claude/agents/`.
    const manifestInstruction = manifestAvailable === false
      ? `Read your coordinator role definition at "${coordinatorRel}" before acting. Specialist roles are ` +
        `discoverable by name and description from the projected definitions in "${homePrefix}.claude/agents/" ` +
        `(the host-neutral team manifest is not present in this workspace yet - it is written by a ` +
        `\`--fanout cline\` install).`
      : `Read the Team Manifest at "${manifestRel}" and your coordinator role definition at "${coordinatorRel}" before acting.`;

    // Observed on 2.1.292 (Plan 035 N2, live test 1): a lead that was asked to introduce its coordinator role followed that user-turn
    // instruction over the first-message section of its own definition and never wrote the mode line. The default task text no longer asks for an
    // introduction at all (ADR 0053: the opening of a Tier-2 orchestrator is its Operation Mode information, not a welcome). The launcher knows no bundle, so the
    // sentence names the section; a definition without it has nothing to follow.
    const firstMessageText =
      'If your coordinator definition has a section named "The first message", follow it in your first message, ' +
      'before anything else.';

    const bootstrapLines = factory ? [
      'You are the installed Agents United artifact factory coordinator.',
      // Observed on 2.1.323 (2026-11-15, headless `--agent` runs): the main's preloaded Skill text was not in its context, so the entry is named by its installed path.
      `Read your checked native main at ".claude/agents/${coordinatorName}.md" before acting. ${FACTORY_SKILL_ENTRY_SENTENCE} ${FACTORY_SKILL_DIR_SENTENCE}`,
      'The fixed ordinary worker map is factory-realizer for bounded native draft creation/update, factory-evaluator for fresh independent read-only review and factory-sync for read-only host-update sync planning. Start one worker at a time as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in your checked native main and the coordinate-artifact references/dispatch.md says. Inspect the actual Host result and refuse a fork, a teammate or a partial or failed return.',
      'Use the supplied fixed job and caller-held digests. Keep draftRoot and evidenceRoot physically disjoint from each other, the selected source checkout and managed/protected paths. Verify final bytes and installed P2/P5 check results before reporting a candidate; repair defaults to zero and needs explicit bounded authorization.',
      'Installed .claude/ files are managed runtime copies: do not edit them. In the selected authoritative source checkout, registry/core/ owns shared pairs, registry/hosts/claude/ owns native definitions and loaders, and registry/skills/ owns shared Skill support. The optional .agents/ store is not the authoritative native source registry. If those sources are unavailable, report the dependent authoring work unavailable.',
      firstMessageText,
      taskText,
    ] : [
      `You are coordinating the "${bundleName}" team in Agents United.`,
      manifestInstruction,
      firstMessageText,
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

    const bootstrapPrompt = [...bootstrapLines, trackingNote].join('\n\n');

    // ADR 0018 decision 13 / Plan 016 decision 14: the opt-in is injected EPHEMERALLY into the spawned
    // process environment only. It is never written to `.claude/settings.json`, never recorded in a lockfile
    // or any other workspace file, nothing is written under `~/.claude/teams/`, and the variable name must
    // never appear in argv. The launcher merges these session-only opt-ins over `process.env` at spawn.
    //
    // Structured progress is useful in standalone and team sessions. Opt in ephemerally under
    // current documented model defaults; do not change the user's Task-vs-TodoWrite selector,
    // persist settings, or claim that an ordinary background worker inherits the Task tools.
    const env: Record<string, string> = {};
    const taskTracking = options.taskTracking ?? process.env.CLAUDE_CODE_ENABLE_TODO_TOOLS !== '0';
    if (taskTracking) env.CLAUDE_CODE_ENABLE_TODO_TOOLS = '1';
    if (teams === true) {
      env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
    } else if (factory) {
      // First of the two switches that turn agent teams off for the factory session (the second is the `--settings` element below).
      // Fork mode is not touched: an inherited CLAUDE_CODE_FORK_SUBAGENT reaches the session unchanged (P22).
      env[FACTORY_TEAMS_ENV] = '0';
    }

    const argv: string[] = [...command.prefixArgs];
    // `--agent` names the projected coordinator definition. The projected file in `.claude/agents/` keeps its
    // full `orchestrator-<x>` name - the `subagent-` prefix stripping that applies to every specialist role is
    // a no-op for coordinators - so this value MUST equal the projected file basename without `.md`.
    argv.push('--agent');
    argv.push(coordinatorName);
    // `--add-dir <directories...>` is variadic: written as two elements, it takes every operand that follows it, so
    // the bootstrap prompt (the last operand) was read as a second directory and never reached the input box
    // (observed on 2.1.291, Plan 035 D52). The `--add-dir=<dir>` form carries its one value inside the element and
    // leaves no option open for the prompt to fall into, whatever flag order a later change picks.
    argv.push(`--add-dir=${workspace}`);
    // Observed 2026-11-15 on 2.1.323 (finding S1-C): a user settings `env` entry exports the teams variable into every session and overrides the shell, so the process
    // environment alone cannot turn teams off; a `--settings` payload applies after user settings (agent-teams.md "Claude spawns teammates instead of subagents",
    // settings.md "Settings precedence"), so the factory carries both switches. Limit: managed settings still apply after it.
    if (factory) argv.push(FACTORY_SESSION_SETTINGS_ARG);
    if (background === true) {
      argv.push('--bg');
    }
    if (pluginDir) {
      argv.push('--plugin-dir');
      argv.push(pluginDir);
    }
    argv.push(bootstrapPrompt);

    const cmdShimRefusal = cmdShimRefusalFor(CLAUDE_SHIM_HOST, command.executable, command.prefixArgs);

    return {
      bundleName,
      scope,
      workspace,
      executable: command.executable,
      argv,
      bootstrapPrompt,
      env,
      ...(cmdShimRefusal ? { cmdShimRefusal } : {}),
      ...(factory ? { nativeFactoryMain: options.nativeFactoryMain } : {}),
    };
  }

  /**
   * Launch the Claude Code session from the argv array. Mirrors `ClineLauncher.launch`: `shell: false`
   * (never `shell: true`), `stdio: 'inherit'`, and the plan's ephemeral env merged over `process.env`.
   */
  public async launch(plan: ClaudeActivationPlan): Promise<void> {
    // A `cmd.exe /c <shim>` start cuts the first message at its first line break and fails on a shim path
    // with a space (cmd-shim.ts). The first message always has line breaks, so refuse instead of starting a session with a cut message.
    // The decision is made from the plan's own shape, so a fabricated plan is refused too.
    const shimRefusal = cmdShimRefusalFor(CLAUDE_SHIM_HOST, plan.executable, plan.argv);
    if (shimRefusal) throw new Error(shimRefusal);
    let factorySession = false;
    if (plan.bundleName === 'agent-factory' || plan.nativeFactoryMain || plan.argv.some((arg, index) => arg === '--agent=orchestrator-agent-factory' || (arg === '--agent' && plan.argv[index + 1] === 'orchestrator-agent-factory'))) {
      factorySession = true;
      assertClaudeFactorySelection(plan.nativeFactoryMain);
      const agent = plan.argv.indexOf('--agent');
      if (plan.bundleName !== 'agent-factory' || plan.scope !== 'project' || !path.isAbsolute(plan.workspace) || agent < 0
        || plan.argv.filter(arg => /^--agent(?:=|$)/.test(arg)).length !== 1 || plan.argv[agent + 1] !== plan.nativeFactoryMain.name
        || plan.argv.filter(arg => arg.startsWith('--add-dir')).length !== 1 || !plan.argv.includes(`--add-dir=${plan.workspace}`)
        || plan.argv.some(arg => /^--(?:bg|plugin-dir)(?:=|$)/.test(arg))
        // Both teams-off switches must be in the checked plan, in the checked shape of the argv tail (see factoryLaunchShapeOk).
        || !factoryLaunchShapeOk(plan)) {
        throw new Error('Claude factory launch requires its checked foreground project plan without background, plugin or teams options, and with agent teams turned off in its settings and environment.');
      }
      if (!isDeepStrictEqual(readClaudeFactoryMain(plan.workspace), plan.nativeFactoryMain)) throw new Error('Claude factory installed closure changed after planning; resolve and plan again.');
    }
    const { spawn } = await import('node:child_process');
    const env: Record<string, string | undefined> = { ...process.env };
    // Windows environment names are case-insensitive: for the factory, no other spelling of the teams variable may survive from the parent next to the plan's `0`.
    if (factorySession) for (const key of Object.keys(env)) if (key.toUpperCase() === FACTORY_TEAMS_ENV) delete env[key];
    const child = spawn(plan.executable, plan.argv, {
      cwd: plan.workspace,
      stdio: 'inherit',
      shell: false,
      env: { ...env, ...plan.env },
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
