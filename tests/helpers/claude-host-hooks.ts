import { spawnSync } from 'node:child_process';
import yaml from 'yaml';

/**
 * A stand-in for the part of Claude Code that decides whether a tool call reaches a tool: it reads an agent file the way the host does
 * (the `tools:` allowlist and the `hooks:` of the frontmatter), applies the documented hook rules (host-library/claude/guide/hook.md:
 * a matcher of letters, digits, `_`, `-`, spaces, `,` and `|` is an exact list, anything else an UNANCHORED JavaScript regex;
 * `${CLAUDE_PROJECT_DIR}` is substituted in each `args` element; a command hook is spawned with no shell; exit 2 blocks, any other
 * non-zero exit does not), and spawns each matching handler with the real PreToolUse payload on stdin.
 *
 * It is not the host: it proves what the files say and what the scripts do when called as documented, and nothing about the model.
 * A real session is the only evidence of the host's own behaviour.
 */

export interface HookHandler {
  type: string;
  command?: string;
  args?: string[];
}
export interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
}

export interface Call {
  tool: string;
  input?: Record<string, unknown>;
}

export interface Attempt {
  /** The tool is in the agent's allowlist, so the host would put it in front of the model at all. */
  offered: boolean;
  /** At least one matching hook exited 2 (the host refuses the call). */
  blocked: boolean;
  /** How many handlers the host would have run for the call. */
  fired: number;
  /** Exit status of each handler that ran (`null` when it could not start). */
  statuses: Array<number | null>;
  /** What the host would show: the stderr of the handlers that blocked. */
  reason: string;
  /** The command line the host prints in its block message (`command` and `args`, placeholders already substituted). */
  commandLines: string[];
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export function frontmatterOf(agentText: string): Record<string, unknown> {
  const parsed = yaml.parse(FRONTMATTER.exec(agentText.replace(/\r\n/g, '\n'))?.[1] ?? '') as unknown;
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

/** The `PreToolUse` groups of an agent file's frontmatter. */
export function preToolUseGroups(agentText: string): HookGroup[] {
  const hooks = frontmatterOf(agentText).hooks as { PreToolUse?: unknown } | undefined;
  return Array.isArray(hooks?.PreToolUse) ? (hooks.PreToolUse as HookGroup[]) : [];
}

/** The documented matcher rule: an exact list of names, or else an unanchored regular expression. */
export function matcherMatches(matcher: string | undefined, toolName: string): boolean {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (/^[A-Za-z0-9_\- ,|]+$/.test(matcher)) return matcher.split(/[|,]/).map(name => name.trim()).includes(toolName);
  return new RegExp(matcher).test(toolName);
}

/** The allowlist rule: a name, `Agent(a, b)` counts as `Agent`, and an `mcp__server` entry covers every tool of that server. */
export function toolOffered(agentText: string, toolName: string): boolean {
  const raw = String(frontmatterOf(agentText).tools ?? '');
  const entries: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of raw) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      entries.push(current.trim());
      current = '';
    } else current += char;
  }
  entries.push(current.trim());
  return entries.filter(Boolean).some(entry => {
    const name = entry.split('(')[0];
    return name === toolName || (name.startsWith('mcp__') && name.split('__').length === 2 && toolName.startsWith(`${name}__`));
  });
}

/**
 * Makes one tool call against an agent the way the host would: is the tool offered, which hooks match it, what do they say.
 * `projectDir` stands for `${CLAUDE_PROJECT_DIR}`; `cwd` is where the host's hook process starts (it can differ from the project
 * root, for instance in a worktree or after a `cd`).
 */
export function attempt(agentText: string, projectDir: string, call: Call, options: { cwd?: string; agentType?: string } = {}): Attempt {
  const offered = toolOffered(agentText, call.tool);
  const payload = JSON.stringify({
    session_id: 'test-session',
    transcript_path: '',
    cwd: options.cwd ?? projectDir,
    permission_mode: 'plan',
    hook_event_name: 'PreToolUse',
    tool_name: call.tool,
    tool_input: call.input ?? {},
    ...(options.agentType ? { agent_type: options.agentType, agent_id: 'test-agent' } : {}),
  });
  const result: Attempt = { offered, blocked: false, fired: 0, statuses: [], reason: '', commandLines: [] };
  for (const group of preToolUseGroups(agentText)) {
    if (!matcherMatches(group.matcher, call.tool)) continue;
    for (const handler of group.hooks) {
      if (handler.type !== 'command' || handler.command === undefined) continue;
      const args = (handler.args ?? []).map(arg => arg.split('${CLAUDE_PROJECT_DIR}').join(projectDir));
      result.fired++;
      result.commandLines.push([handler.command, ...args].join(' '));
      const run = spawnSync(handler.command, args, {
        input: payload,
        encoding: 'utf8',
        cwd: options.cwd ?? projectDir,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      });
      result.statuses.push(run.status);
      if (run.status === 2) {
        result.blocked = true;
        result.reason += run.stderr;
      }
    }
  }
  return result;
}
