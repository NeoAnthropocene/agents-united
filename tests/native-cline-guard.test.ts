import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GUARD_SCRIPT } from '../src/core/guard.js';

/**
 * Plan 032 Phase 8 / ADR 0028 — the Cline guard plugin: one reviewed JavaScript file that blocks the destructive things the
 * Claude guard blocks (a forced push, `vercel --prod`, a `.env` write) for every agent that holds a shell or an editor. A read-only
 * role needs no hook: its `tools:` list is enforced by the host. The hook context shape below was captured from a real CLI 3.0.68
 * session (`toolCall.toolName`, `tool.name`, `input`, `snapshot.agentId`); the plugin never throws for anything but a block.
 */

const FILE = path.resolve('registry/hosts/cline/plugins/agents-united-guard.js');
const source = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const plugin = (await import(pathToFileURL(FILE).href)).default as { name: string; manifest: { capabilities: string[] }; hooks: { beforeTool: (context: unknown) => unknown } };

const context = (toolName: string, input: unknown) => ({
  toolCall: { type: 'tool-call', toolCallId: 'call_1', toolName, input, metadata: { toolSource: { providerId: 'cline', executionMode: 'runtime' } } },
  tool: { name: toolName, description: 'x' },
  input,
  snapshot: { agentId: 'agent_lead', conversationId: 'conv_1', runId: 'run_1', status: 'running', iteration: 1, messages: [], pendingToolCalls: [], usage: {} },
});
/** `allow`, or the message of the error the hook threw. */
const verdict = (toolName: string, input: unknown): string => {
  try {
    plugin.hooks.beforeTool(context(toolName, input));
    return 'allow';
  } catch (error) {
    return (error as Error).message;
  }
};
const BLOCK = (reason: string): string => `Blocked by agents-united guard: ${reason} requires explicit human approval outside the agent session.`;

describe('the plugin file', () => {
  it('is a single AgentPlugin with one hook and the hooks capability, and nothing else', () => {
    expect(Object.keys(plugin).sort()).toEqual(['hooks', 'manifest', 'name']);
    expect(plugin.name).toBe('agents-united-guard');
    expect(plugin.manifest).toEqual({ capabilities: ['hooks'] });
    expect(Object.keys(plugin.hooks)).toEqual(['beforeTool']);
    expect(typeof plugin.hooks.beforeTool).toBe('function');
  });

  it('is plain, dependency-free JavaScript: no import, no network, no process, no dynamic code, and small enough to review at a glance', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    for (const forbidden of [/\brequire\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /\bprocess\b/, /child_process/, /\beval\s*\(/, /new Function/, /\bXMLHttpRequest\b/, /node:(fs|net|http|https|child_process|os)/]) {
      expect(source, String(forbidden)).not.toMatch(forbidden);
    }
    expect(source.match(/^export /gm)).toEqual(['export ']);
    expect(source).toMatch(/^export default /m);
    expect(Buffer.byteLength(source)).toBeLessThan(6000);
    expect(source.split('\n').length).toBeLessThan(110);
  });

  it('carries the same patterns as the Claude guard script, so the two cannot drift apart', () => {
    const literals = [...GUARD_SCRIPT.matchAll(/\/((?:\\.|[^/\\\n])+)\/\.test\(/g)].map(match => match[0].slice(0, -'.test('.length));
    expect(literals).toHaveLength(4);
    for (const literal of literals) expect(source, `the Claude guard pattern ${literal}`).toContain(literal);
  });
});

describe('shell commands (run_commands)', () => {
  it.each([
    [['git push --force origin main'], 'git push --force'],
    [['git push -f origin main'], 'git push --force'],
    [['echo git push --force'], 'git push --force'],
    [['git status', 'git push origin main --force'], 'git push --force'],
    [['vercel deploy --prod'], 'vercel --prod'],
    [['echo x > .env'], 'a .env write'],
    [['echo x >.env.local'], 'a .env write'],
    [['printf y > sub/.env.production'], 'a .env write'],
  ])('blocks %j', (commands, reason) => {
    expect(verdict('run_commands', { commands })).toBe(BLOCK(reason));
  });

  it.each([
    [['git push --force-with-lease origin main']],
    [['git push origin main']],
    [['git status', 'npm test']],
    [['echo x > .env.example']],
    [['vercel deploy']],
    [['cat .env']],
    [['git log --oneline']],
  ])('allows %j', commands => {
    expect(verdict('run_commands', { commands })).toBe('allow');
  });

  it('also reads a single command string and the legacy tool names, in case a build or the IDE uses them', () => {
    expect(verdict('run_commands', { commands: 'git push -f' })).toBe(BLOCK('git push --force'));
    expect(verdict('execute_command', { command: 'git push --force' })).toBe(BLOCK('git push --force'));
    expect(verdict('bash', { command: 'vercel --prod' })).toBe(BLOCK('vercel --prod'));
  });
});

describe('file writes (editor, apply_patch)', () => {
  it.each([
    ['editor', { path: 'C:\\repo\\.env', new_text: 'K=1' }],
    ['editor', { path: '.env', new_text: 'K=1' }],
    ['editor', { path: 'sub/.env.local', new_text: 'K=1' }],
    ['editor', { path: 'C:\\repo\\sub\\.env.production', new_text: 'K=1' }],
    ['apply_patch', { input: '*** Begin Patch\n*** Add File: .env\n+K=1\n*** End Patch' }],
    ['apply_patch', { patch: '*** Begin Patch\n*** Update File: config/.env.staging\n@@\n-A=1\n+A=2\n*** End Patch' }],
    ['apply_patch', { diff: 'diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-A\n+B' }],
    ['write_to_file', { path: '.env', content: 'K=1' }],
  ])('blocks %s %j', (tool, input) => {
    expect(verdict(tool, input)).toBe(BLOCK('a .env write'));
  });

  it.each([
    ['editor', { path: '.env.example', new_text: 'K=' }],
    ['editor', { path: 'src/app.ts', new_text: 'x' }],
    ['editor', { path: 'docs/environment.md', new_text: 'x' }],
    ['apply_patch', { input: '*** Begin Patch\n*** Update File: src/app.ts\n@@\n-a\n+b\n*** End Patch' }],
    ['apply_patch', { input: '*** Begin Patch\n*** Add File: .env.example\n+K=\n*** End Patch' }],
  ])('allows %s %j', (tool, input) => {
    expect(verdict(tool, input)).toBe('allow');
  });

  it('applies the .env rule only to writing tools: reading .env, or mentioning it in a prompt, is not a write', () => {
    expect(verdict('read_files', { files: [{ path: '.env' }] })).toBe('allow');
    expect(verdict('search_codebase', { queries: ['.env'] })).toBe('allow');
    expect(verdict('subagent_backend_architect', { prompt: 'never write to .env or run git push --force' })).toBe('allow');
  });
});

describe('the hook context', () => {
  it('finds the tool name wherever the build puts it: toolCall.toolName (observed), tool.name, or toolCall.name (the docs example)', () => {
    const input = { commands: ['git push -f'] };
    const reason = BLOCK('git push --force');
    const attempt = (shaped: unknown): string => {
      try {
        plugin.hooks.beforeTool(shaped);
        return 'allow';
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(attempt({ toolCall: { toolName: 'run_commands', input }, input })).toBe(reason);
    expect(attempt({ tool: { name: 'run_commands' }, input })).toBe(reason);
    expect(attempt({ toolCall: { name: 'run_commands', input } })).toBe(reason);
  });

  it('never throws anything but a block: a missing, empty or odd context is simply allowed', () => {
    const odd: unknown[] = [undefined, null, {}, { toolCall: null }, { toolCall: { toolName: 'run_commands' } }, { toolCall: { toolName: 'run_commands', input: null }, input: null }, { toolCall: { toolName: 'editor', input: 'str' }, input: 'str' }, { tool: { name: 7 }, input: { commands: [1, null, {}] } }, 'text', 42];
    for (const shaped of odd) expect(() => plugin.hooks.beforeTool(shaped), JSON.stringify(shaped)).not.toThrow();
    expect(verdict('run_commands', { commands: [1, null, { a: 1 }, 'git status'] })).toBe('allow');
  });

  it('returns nothing on an allowed call (no value for the runtime to misread)', () => {
    expect(plugin.hooks.beforeTool(context('read_files', { files: [{ path: 'src/a.ts' }] }))).toBeUndefined();
  });
});
