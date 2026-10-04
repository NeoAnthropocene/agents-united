import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardHandler, readOnlyGuardHooks } from '../src/core/readonly-guard.js';

/**
 * Plan 032 PR E, milestone 1 — the read-only PreToolUse guard for Claude roles whose Semantic Core says
 * "never mutates". Exercised through the real exec form (`node -e <script>`, no shell), with Windows-style
 * payloads, because a PowerShell-quoted guard that fails open is the failure this lane exists to prevent.
 */

const run = (stdin: string): { status: number | null; stderr: string } => {
  const handler = readOnlyGuardHandler();
  const result = spawnSync(handler.command, handler.args, { input: stdin, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr };
};
const call = (tool_name: string, tool_input: Record<string, unknown> = {}): { status: number | null; stderr: string } =>
  run(JSON.stringify({ tool_name, tool_input }));

describe('read-only guard', () => {
  it.each([
    ['Write', { file_path: 'C:\\repo\\src\\a.ts', content: 'x' }],
    ['Edit', { file_path: 'C:\\repo\\src\\a.ts' }],
    ['MultiEdit', { file_path: 'C:\\repo\\src\\a.ts' }],
    ['NotebookEdit', { notebook_path: 'C:\\repo\\n.ipynb' }],
    ['Bash', { command: 'rm -rf C:\\repo' }],
    ['PowerShell', { command: 'Remove-Item C:\\repo -Recurse' }],
  ])('blocks %s with exit 2 and a reason on stderr', (tool, input) => {
    const result = call(tool, input);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Blocked by agents-united read-only guard/);
    expect(result.stderr).toContain(tool);
  });

  it.each([
    'mcp__github__create_pull_request',
    'mcp__github__merge_pull_request',
    'mcp__github__push_files',
    'mcp__github__issue_write',
    'mcp__github__add_issue_comment',
    'mcp__github__delete_file',
    'mcp__claude_ai_Supabase__execute_sql',
  ])('blocks the mutating server tool %s', tool => {
    expect(call(tool).status).toBe(2);
  });

  // A role that only reads and reports must not hand work or output to anything outside itself: not to another agent, a workflow, a
  // schedule, a worktree, a published page or a file sent to the user. Widened on 2026-10-04 (maintainer decision, ADR 0038); before
  // that these were withheld by the role's allowlist alone.
  it.each(['Agent', 'Workflow', 'CronCreate', 'EnterWorktree', 'Artifact', 'SendUserFile'])('blocks the delegation tool %s with exit 2 and a short reason', tool => {
    const result = call(tool, { prompt: 'x' });
    expect(result.status).toBe(2);
    expect(result.stderr).toBe(`Blocked by agents-united read-only guard: ${tool} would hand work or output outside this role, and this role only reads and reports.\n`);
    expect(result.stderr.length).toBeLessThan(200);
  });

  it.each([
    'Read',
    'Grep',
    'Glob',
    'LSP',
    'Skill',
    'SendMessage',
    'SubagentHandback',
    'ToolSearch',
    'ListAgents',
    'TaskList',
    'TaskGet',
    'CronList',
    'WebFetch',
    'mcp__github__search_code',
    'mcp__github__get_file_contents',
    'mcp__github__list_pull_requests',
    'mcp__github__pull_request_read',
    'mcp__context7__resolve-library-id',
    'mcp__context7__query-docs',
  ])('allows %s', tool => {
    expect(call(tool).status).toBe(0);
  });

  it('fails closed on unreadable hook input', () => {
    expect(run('not json').status).toBe(2);
    expect(run('').status).toBe(2);
  });

  it('is exec form: node with the script as one argument, no shell quoting involved', () => {
    const handler = readOnlyGuardHandler();
    expect(handler).toEqual({ type: 'command', command: 'node', args: ['-e', READ_ONLY_GUARD_SCRIPT] });
  });

  it('hooks cover every tool the script can block', () => {
    const groups = readOnlyGuardHooks().PreToolUse;
    expect(groups).toHaveLength(1);
    const matcher = new RegExp(`^(?:${groups[0].matcher})$`);
    for (const tool of ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Agent', 'Workflow', 'CronCreate', 'EnterWorktree', 'Artifact', 'SendUserFile', 'mcp__github__create_issue']) {
      expect(matcher.test(tool), tool).toBe(true);
    }
    // The matcher is anchored: `Agent` must not catch `ListAgents`, nor `CronCreate` catch `CronList`.
    for (const tool of ['Read', 'Grep', 'Glob', 'ListAgents', 'CronList', 'SendMessage', 'ToolSearch', 'TaskList']) expect(matcher.test(tool), tool).toBe(false);
  });
});
