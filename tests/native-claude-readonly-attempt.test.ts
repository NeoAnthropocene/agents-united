import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { loadToolPolicy } from '../src/core/host-profile.js';
import { attempt, toolOffered, widenTools, withoutGuard } from './helpers/claude-host-hooks.js';

/**
 * Plan 032 close-out follow-up (6), slice 1b — a read-only reviewer that ATTEMPTS a write. In the real sessions of the close-out the
 * reviewer was never offered a write tool, so the model declined without a tool call and the host's refusal was never seen. This suite
 * makes the attempt for every writer the Claude catalog has, against the roles as INSTALLED (`agents add --native`), through a stand-in
 * for the host's hook rules (tests/helpers/claude-host-hooks.ts), in the two situations that matter:
 *   - the shipped reviewer: the tool is not in its allowlist (layer 1), and if the host did let the call through the guard refuses it (layer 2);
 *   - a later edit that grants the tool (what the guard exists for): the tool IS offered and the guard alone refuses it.
 * What the stand-in cannot show is the host itself; `host-library/claude/observations/` records what a real session did.
 */

const BUNDLE = 'software-engineering';
const WS = path.resolve(process.cwd(), 'scratch/test-native-claude-readonly-attempt');
const SIDECAR = path.join(WS, '.claude', '.agents-united');
const READ_ONLY_ROLES = ['code-reviewer', 'repo-index'];
const roleText = (root: string, role: string): string => fs.readFileSync(path.join(root, '.claude/agents', `${role}.md`), 'utf8');

/** Every shell and file writer of the Claude catalog, plus `MultiEdit` (not in the catalog, still a writer the guard names). */
const catalog = loadToolPolicy(path.resolve('registry'), 'claude').catalog;
const WRITERS = [...catalog.filter(tool => ['shell', 'edit'].includes(tool.class)).map(tool => tool.name), 'MultiEdit'].sort();
const MUTATING_SERVER_TOOLS = ['mcp__github__create_pull_request', 'mcp__github__merge_pull_request', 'mcp__github__push_files', 'mcp__github__issue_write', 'mcp__github__delete_file', 'mcp__claude_ai_Supabase__execute_sql'];
const READS = ['Read', 'Grep', 'Glob', 'LSP', 'WebFetch', 'mcp__github__search_code', 'mcp__context7__query-docs'];

const input = (tool: string): Record<string, unknown> =>
  tool === 'Bash' || tool === 'PowerShell' ? { command: 'touch pwned.txt' } : { file_path: path.join(WS, 'pwned.txt'), content: 'x' };

beforeAll(async () => {
  await fs.remove(WS);
  await fs.ensureDir(WS);
  await new InstallEngine().install(BUNDLE, { targetDir: SIDECAR, method: 'copy', fanout: ['claude'], nativeLane: true } as never);
});
afterAll(async () => {
  await fs.remove(WS);
});

describe('the catalog the attempts cover', () => {
  it('has the shell and editing tools the guard names, so a new writer in a later catalog fails here', () => {
    expect(WRITERS).toEqual(['Bash', 'Edit', 'MultiEdit', 'NotebookEdit', 'PowerShell', 'Write']);
  });
});

describe.each(READ_ONLY_ROLES)('read-only role %s, as installed', role => {
  const shipped = (): string => roleText(WS, role);

  it.each([...WRITERS, ...MUTATING_SERVER_TOOLS])('is not offered %s, and the guard refuses it even if the host let the call through', tool => {
    const result = attempt(shipped(), WS, { tool, input: input(tool) });
    expect(result.offered, 'layer 1: the allowlist').toBe(false);
    expect(result.blocked, 'layer 2: the guard').toBe(true);
    expect(result.statuses).toEqual([2]);
    expect(result.reason).toContain(`Blocked by agents-united read-only guard: ${tool}`);
  });

  it.each(WRITERS)('refuses %s through the guard alone when a later edit grants it, from any working directory', tool => {
    const widened = widenTools(shipped(), [tool]);
    const result = attempt(widened, WS, { tool, input: input(tool) }, { cwd: os.tmpdir() });
    expect([result.offered, result.fired, result.blocked]).toEqual([true, 1, true]);
    expect(result.reason).toMatch(new RegExp(`^Blocked by agents-united read-only guard: ${tool} would change state, and this role only reads and reports\\.\\n$`));
    expect(result.reason.length).toBeLessThan(200);
    expect(result.commandLines).toEqual([`node ${WS}/.claude/hooks/agents-united-readonly-guard.js`]);
  });

  it('refuses a mutating tool of a connected server, whichever server it belongs to', () => {
    for (const tool of MUTATING_SERVER_TOOLS) {
      const widened = widenTools(shipped(), [tool]);
      const result = attempt(widened, WS, { tool, input: { title: 'x' } });
      expect([result.offered, result.blocked], tool).toEqual([true, true]);
    }
  });

  it.each(READS)('lets the read tool %s through', tool => {
    const result = attempt(shipped(), WS, { tool, input: { pattern: 'x' } });
    expect(result.blocked).toBe(false);
    expect(result.statuses.every(status => status === 0)).toBe(true);
  });

  it('is only as good as its guard: with the hooks line emptied the same attempt gets through (the test can fail)', () => {
    const widened = withoutGuard(widenTools(shipped(), ['Write']));
    expect(toolOffered(widened, 'Write')).toBe(true);
    const result = attempt(widened, WS, { tool: 'Write', input: input('Write') });
    expect([result.fired, result.blocked]).toEqual([0, false]);
  });

  it('is not guarded by a deleted script: node exits 1, which is not a block (the host lets the call through, which is why the doctor warns)', async () => {
    const copy = path.join(os.tmpdir(), `agents-united-readonly-attempt-${process.pid}`);
    await fs.remove(copy);
    await fs.copy(WS, copy);
    try {
      await fs.remove(path.join(copy, '.claude/hooks/agents-united-readonly-guard.js'));
      const result = attempt(widenTools(roleText(copy, role), ['Write']), copy, { tool: 'Write', input: input('Write') });
      expect(result.fired).toBe(1);
      expect(result.statuses).toEqual([1]);
      expect(result.blocked).toBe(false);
    } finally {
      await fs.remove(copy);
    }
  });
});

describe('what the read-only guard does not cover', () => {
  // The guard names writers and mutating server tools. A tool that delegates, schedules, starts a workflow, makes a worktree or sends a
  // file out is withheld from a reviewer by its allowlist ALONE; granting one by a later edit is not caught by the guard. Pinned here so
  // that a change (widening the matcher) is a decision, and recorded in the plan log as an open question.
  it.each(['Agent', 'Workflow', 'CronCreate', 'EnterWorktree', 'Artifact', 'SendUserFile'])('does not refuse %s if a later edit grants it, and the shipped reviewer is not offered it', tool => {
    for (const role of READ_ONLY_ROLES) {
      expect(toolOffered(roleText(WS, role), tool), `${role} is not offered ${tool}`).toBe(false);
      const result = attempt(widenTools(roleText(WS, role), [tool]), WS, { tool, input: { prompt: 'x' } });
      expect([result.offered, result.fired, result.blocked], `${role} ${tool}`).toEqual([true, 0, false]);
    }
  });
});
