import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUARD_SCRIPT } from '../src/core/guard.js';
import { loadHostProfile, loadToolPolicy } from '../src/core/host-profile.js';

/**
 * Plan 032 Phase 8 / ADR 0030 — the Antigravity guard: one reviewed JavaScript file run as a `PreToolUse` command hook, plus the
 * `hooks.json` that registers it. It blocks what the Claude and Cline guards block (a forced push, `vercel --prod`, a `.env` write) for
 * every agent that holds a shell or an editor, the main agent and subagents alike. The contract below was observed on agy 1.2.15 in real
 * sessions (host-library/antigravity/observations/2026-10-02-agy-1.2.15.md): the hook gets JSON on stdin and its working directory is the
 * folder holding `hooks.json`; an answer with no `decision`, non-JSON output or a non-zero exit all block the call, so the script must
 * always answer; `deny` carries its `reason` to the agent; `ask` falls back to the user's own permission settings, so it is the only
 * other answer this file gives and it never answers `allow`.
 */

const registry = path.resolve('registry');
const DIR = path.join(registry, 'hosts/antigravity/hooks');
const SCRIPT = path.join(DIR, 'agents-united-guard.js');
const HOOKS = path.join(DIR, 'hooks.json');
const source = fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');

const answer = (stdin: string): { code: number; out: string } => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT], { input: stdin, encoding: 'utf8', timeout: 10_000 }) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { code: failure.status ?? -1, out: failure.stdout ?? '' };
  }
};
const payload = (name: string, args: Record<string, unknown>): string => JSON.stringify({ toolCall: { name, args }, stepIdx: 3, conversationId: 'c-1', workspacePaths: ['/w'] });
const verdict = (name: string, args: Record<string, unknown>): { decision: string; reason?: string } => JSON.parse(answer(payload(name, args)).out) as { decision: string; reason?: string };
const BLOCK = (reason: string): string => `Blocked by agents-united guard: ${reason} requires explicit human approval outside the agent session.`;

describe('the guard script', () => {
  it('is plain, dependency-free JavaScript: no import, no network, no child process, no dynamic code, and process only for stdin and stdout', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    for (const forbidden of [/\brequire\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /child_process/, /\beval\s*\(/, /new Function/, /\bXMLHttpRequest\b/, /node:(fs|net|http|https|child_process|os)/, /\bexport\b/]) {
      expect(source, String(forbidden)).not.toMatch(forbidden);
    }
    for (const use of source.match(/\bprocess\.[a-zA-Z]+/g) ?? []) expect(use).toMatch(/^process\.(stdin|stdout)$/);
    expect(Buffer.byteLength(source)).toBeLessThan(4500);
    expect(source.split('\n').length).toBeLessThan(75);
  });

  it('carries the same patterns as the Claude guard script, so the two cannot drift apart', () => {
    const literals = [...GUARD_SCRIPT.matchAll(/\/((?:\\.|[^/\\\n])+)\/\.test\(/g)].map(match => match[0].slice(0, -'.test('.length));
    expect(literals).toHaveLength(4);
    for (const literal of literals) expect(source, `the Claude guard pattern ${literal}`).toContain(literal);
  });
});

describe('shell commands (run_command)', () => {
  it.each([
    ['git push --force origin main', 'git push --force'],
    ['git push -f origin main', 'git push --force'],
    ['echo git push --force', 'git push --force'],
    ['vercel deploy --prod', 'vercel --prod'],
    ['echo x > .env', 'a .env write'],
    ['printf y >sub/.env.production', 'a .env write'],
  ])('denies %s', (CommandLine, reason) => {
    expect(verdict('run_command', { CommandLine, Cwd: '/w' })).toEqual({ decision: 'deny', reason: BLOCK(reason) });
  });

  it.each(['git push --force-with-lease origin main', 'git push origin main', 'git status', 'npm test', 'echo x > .env.example', 'vercel deploy', 'cat .env', 'git log --oneline'])('hands %s back to the user\'s own permission settings', CommandLine => {
    expect(verdict('run_command', { CommandLine })).toEqual({ decision: 'ask' });
  });
});

describe('file writes (write_to_file, replace_file_content, multi_replace_file_content)', () => {
  it.each([
    ['write_to_file', '.env'],
    ['write_to_file', 'C:\\repo\\.env'],
    ['write_to_file', 'sub/.env.local'],
    ['replace_file_content', '/repo/.env'],
    ['multi_replace_file_content', 'C:\\repo\\sub\\.env.production'],
  ])('denies %s on %s', (name, TargetFile) => {
    expect(verdict(name, { TargetFile })).toEqual({ decision: 'deny', reason: BLOCK('a .env write') });
  });

  it.each([
    ['write_to_file', '.env.example'],
    ['write_to_file', 'src/app.ts'],
    ['replace_file_content', 'docs/environment.md'],
    ['multi_replace_file_content', 'README.md'],
  ])('hands %s on %s back to the user\'s own permission settings', (name, TargetFile) => {
    expect(verdict(name, { TargetFile })).toEqual({ decision: 'ask' });
  });

  it('applies the .env rule only to writing tools: reading .env, or mentioning it in a prompt, is not a write', () => {
    expect(verdict('view_file', { AbsolutePath: '/repo/.env' })).toEqual({ decision: 'ask' });
    expect(verdict('grep_search', { Query: '.env' })).toEqual({ decision: 'ask' });
    expect(verdict('invoke_subagent', { Subagents: '[{"Prompt":"never write .env or run git push --force"}]' })).toEqual({ decision: 'ask' });
  });
});

describe('the answer contract', () => {
  it('always answers with exactly one JSON object holding a decision of deny or ask, never allow, and exits 0', () => {
    for (const stdin of [payload('run_command', { CommandLine: 'git push -f' }), payload('run_command', { CommandLine: 'ls' }), payload('view_file', {}), '', 'not json', '{}', 'null', '[]', '42', JSON.stringify({ toolCall: null }), JSON.stringify({ toolCall: { name: 'run_command' } }), JSON.stringify({ toolCall: { name: 'run_command', args: { CommandLine: 7 } } })]) {
      const result = answer(stdin);
      expect(result.code, JSON.stringify(stdin)).toBe(0);
      const parsed = JSON.parse(result.out) as { decision: string };
      expect(['deny', 'ask'], JSON.stringify(stdin)).toContain(parsed.decision);
      expect(result.out.trim().split('\n')).toHaveLength(1);
    }
  });

  it('answers ask for anything it does not recognise, because an empty answer would block the call (observed)', () => {
    expect(JSON.parse(answer('').out)).toEqual({ decision: 'ask' });
    expect(JSON.parse(answer('{"toolCall":{"name":"some_new_tool","args":{}}}').out)).toEqual({ decision: 'ask' });
  });
});

describe('hooks.json', () => {
  const hooks = JSON.parse(fs.readFileSync(HOOKS, 'utf8')) as Record<string, Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string; timeout: number }> }>>>;
  const profile = loadHostProfile(registry, 'antigravity');
  const policy = loadToolPolicy(registry, 'antigravity');

  it('registers one hook, on the one event the guard handles, with one command handler that points at the shipped script', () => {
    expect(Object.keys(hooks)).toEqual(['agents-united-guard']);
    expect(Object.keys(hooks['agents-united-guard'])).toEqual(['PreToolUse']);
    expect(profile.artifacts.hook.events).toContain('PreToolUse');
    const groups = hooks['agents-united-guard'].PreToolUse;
    expect(groups).toHaveLength(1);
    expect(groups[0].hooks).toHaveLength(1);
    const handler = groups[0].hooks[0];
    expect(handler.type).toBe('command');
    expect(profile.artifacts.hook.handlerTypes).toContain(handler.type);
    expect(handler.timeout).toBeGreaterThan(0);
    expect(handler.timeout).toBeLessThanOrEqual(30);
    // The hook runs with the folder holding hooks.json as its working directory (observed), so the path is relative to `.agents/`.
    expect(handler.command).toBe('node hooks/agents-united-guard.js');
    expect(fs.existsSync(path.join(DIR, handler.command.replace(/^node /, '').replace(/^hooks\//, '')))).toBe(true);
    expect(profile.artifacts.hook.registerAt).toContain('.agents/hooks.json');
  });

  it('matches every shell and editing tool of the catalog, and nothing else', () => {
    const matcher = hooks['agents-united-guard'].PreToolUse[0].matcher.split('|').sort();
    const guarded = policy.catalog.filter(tool => ['shell', 'edit'].includes(tool.class)).map(tool => tool.name).sort();
    expect(matcher).toEqual(guarded);
    expect(guarded).toEqual(['multi_replace_file_content', 'replace_file_content', 'run_command', 'write_to_file']);
  });

  it('is recorded in the profile with what the real sessions showed: fail-closed answers, and the working directory', () => {
    const feature = profile.features.hookContract;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/no decision|without a decision/i);
    expect(feature.note).toMatch(/block/i);
    expect(feature.note).toMatch(/working directory/i);
    expect(feature.note).toMatch(/subagent/i);
    expect(profile.features.hookFile.note).not.toMatch(/not documented or verified/);
    expect(profile.features.hookFile.note).toMatch(/installed by the lane/i);
  });
});
