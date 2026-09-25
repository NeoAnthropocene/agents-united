import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { HOST_DIALECTS } from '../src/core/dialects.js';

/**
 * Plan 022 H5/H7 — hooks that actually run (acceptance gate 7). Doctrine: a hook is "wired"
 * only when the host fires it. Verified against the Claude Code references (2026-09-25):
 * subagent frontmatter `hooks` fire when the agent is spawned as a subagent AND when it runs
 * as the main session via `--agent`; a PreToolUse command hook that exits 2 blocks the call
 * and its stderr is the message. So every projected role carries the managed guard in its
 * frontmatter; this suite EXECUTES the rendered command against real hook payloads.
 * Lifecycle hooks written as canonical prose stay advisory (H7) and the runtime note says so.
 */
const AGENTS_DIR = path.resolve(process.cwd(), 'registry', 'agents');
const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();

interface HookGroup { matcher: string; hooks: Array<{ type: string; command: string }> }

function hooksOf(file: string): { groups: HookGroup[]; content: string } {
  const raw = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
  const { content } = ClaudeProjector.renderRole(raw, `agents/${file.replace(/^subagent-/, '')}`);
  const meta = yaml.parse(content.match(/^---\n([\s\S]*?)\n---/)![1]) as { hooks?: { PreToolUse?: HookGroup[] } };
  return { groups: meta.hooks?.PreToolUse ?? [], content };
}

function fire(command: string, payload: Record<string, unknown>): { status: number | null; stderr: string } {
  const run = spawnSync('sh', ['-c', command], { input: JSON.stringify(payload), encoding: 'utf8' });
  return { status: run.status, stderr: run.stderr };
}

const guard = hooksOf('subagent-backend-architect.md').groups;
const commandFor = (tool: string): string => {
  const group = guard.find(g => g.matcher.split('|').includes(tool));
  if (!group) throw new Error(`no PreToolUse group matches ${tool}`);
  return group.hooks[0].command;
};

describe('Plan 022 H5 — managed PreToolUse guard is wired on every projected role', () => {
  it('every role carries the same guard for Bash and Write|Edit', () => {
    const missing = files.filter(file => {
      const { groups } = hooksOf(file);
      return JSON.stringify(groups) !== JSON.stringify(guard) || guard.length === 0;
    });
    expect(missing).toEqual([]);
    expect(guard.map(g => g.matcher)).toEqual(['Bash', 'Write|Edit|NotebookEdit']);
  });

  const blocked: Array<[string, string, Record<string, unknown>]> = [
    ['git push --force', 'Bash', { command: 'git push --force origin main' }],
    ['git push -f', 'Bash', { command: 'git push -f' }],
    ['vercel --prod', 'Bash', { command: 'npx vercel deploy --prebuilt --prod' }],
    ['.env write (Write)', 'Write', { file_path: '/repo/.env', content: 'SECRET=1' }],
    ['.env.local write (Edit)', 'Edit', { file_path: 'apps/web/.env.local', old_string: 'a', new_string: 'b' }],
    ['.env write via shell redirect', 'Bash', { command: 'echo KEY=1 >> .env' }],
  ];
  for (const [label, tool, input] of blocked) {
    it(`blocks ${label} with exit 2 and a clear message`, () => {
      const result = fire(commandFor(tool), { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/Blocked by agents-united guard: .+ requires explicit human approval/);
    });
  }

  const allowed: Array<[string, string, Record<string, unknown>]> = [
    ['git push', 'Bash', { command: 'git push -u origin feat/x' }],
    ['git push --force-with-lease', 'Bash', { command: 'git push --force-with-lease' }],
    ['vercel preview deploy', 'Bash', { command: 'npx vercel deploy --prebuilt' }],
    ['.env.example write', 'Write', { file_path: '.env.example', content: 'KEY=' }],
    ['ordinary source edit', 'Edit', { file_path: 'src/env.ts', old_string: 'a', new_string: 'b' }],
  ];
  for (const [label, tool, input] of allowed) {
    it(`allows ${label}`, () => {
      const result = fire(commandFor(tool), { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
      expect(result.status).toBe(0);
    });
  }
});

describe('Plan 022 H7 — hooks are honest: wired vs advisory', () => {
  it('the dialect records the wired guard instead of "hooks: false"', () => {
    expect(HOST_DIALECTS.claude.features.hooks).toMatch(/PreToolUse guard/);
  });

  it('the runtime note names the enforced guard and marks prose lifecycle hooks advisory', () => {
    const { content } = hooksOf('subagent-code-reviewer.md');
    expect(content).toMatch(/Enforced guard:/);
    expect(content).toMatch(/lifecycle hooks described in this prompt are advisory/);
  });
});
