import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';
import { EARLIER_GUARD_SCRIPTS, GUARD_SCRIPT, guardFileHandler, guardHandler, managedGuardHooks, nativeGuardFileHooks, nativeGuardHandler, nativeGuardHooks } from '../src/core/guard.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { renderHooks } from '../src/core/native-floor.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { modeLineGateHooks } from '../src/core/mode-line-gate.js';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardFileHooks, readOnlyGuardHandler, readOnlyGuardHooks } from '../src/core/readonly-guard.js';
import { expectedWorkerHooks } from '../src/core/handback-check.js';
import yaml from 'yaml';
import { attempt, ON_FAILURE_BLOCK_MESSAGE, preToolUseGroups, type HookHandler } from './helpers/claude-host-hooks.js';

/**
 * Plan 033 P20 — the native guards block when their hook cannot run. A Claude Code hook whose script cannot run does not block by default (an interactive sitting on
 * 2.1.325 ran the guarded command with the script moved away), so every handler of the destructive-command guard and the read-only guard sets
 * `onFailure: "block"` (host-library/claude/pages/hook/hooks.md, "Block the action when a hook fails"; Claude Code 2.1.295 or later). The mode-line
 * gate is not a guard of what a role may do, and a lead whose gate script is missing could make no tool call, so its handler does not carry the field.
 * Offline: the Host is never started; the scripts are run with `node` and a crafted stdin, as the other guard tests do.
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const HOOKS = path.resolve('registry/hosts/claude/hooks');
const BLOCK = { onFailure: 'block' } as const;
const handlersOf = (groups: Array<{ hooks: unknown[] }>): HookHandler[] => groups.flatMap(group => group.hooks as HookHandler[]);

describe('the generated guard handlers carry onFailure "block", last in key order', () => {
  it('the script-file handlers of both guards', () => {
    expect(guardFileHandler('destructive')).toEqual({ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-guard.js'], ...BLOCK });
    expect(guardFileHandler('read-only')).toEqual({ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js'], ...BLOCK });
    for (const kind of ['destructive', 'read-only'] as const) expect(Object.keys(guardFileHandler(kind))).toEqual(['type', 'command', 'args', 'onFailure']);
  });

  it('the inline node -e handlers of both guards', () => {
    expect(nativeGuardHandler()).toEqual({ type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT], ...BLOCK });
    expect(readOnlyGuardHandler()).toEqual({ type: 'command', command: 'node', args: ['-e', READ_ONLY_GUARD_SCRIPT], ...BLOCK });
    expect(Object.keys(nativeGuardHandler())).toEqual(['type', 'command', 'args', 'onFailure']);
    expect(Object.keys(readOnlyGuardHandler())).toEqual(['type', 'command', 'args', 'onFailure']);
  });

  it.each([
    ['nativeGuardHooks', nativeGuardHooks],
    ['nativeGuardFileHooks', nativeGuardFileHooks],
    ['readOnlyGuardHooks', readOnlyGuardHooks],
    ['readOnlyGuardFileHooks', readOnlyGuardFileHooks],
  ])('every handler of %s', (_name, build) => {
    const handlers = handlersOf(build().PreToolUse);
    expect(handlers.length).toBeGreaterThan(0);
    for (const handler of handlers) expect(handler.onFailure).toBe('block');
  });

  it('the mode-line gate handler does not: it is not a guard of what a role may do', () => {
    expect(guardFileHandler('mode-line')).toEqual({ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js'] });
    for (const handler of handlersOf(modeLineGateHooks().PreToolUse)) expect(handler).not.toHaveProperty('onFailure');
  });

  // The maintainer's decision of 2026-11-17: the legacy inline form and the settings-level session guard block when they cannot run.
  it('the legacy projection and the settings-level session guard carry the fail-closed handler', () => {
    expect(guardHandler()).toEqual({ type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT], ...BLOCK });
    expect(Object.keys(guardHandler())).toEqual(['type', 'command', 'args', 'onFailure']);
    const handlers = handlersOf(managedGuardHooks().PreToolUse);
    expect(handlers.length).toBe(2);
    for (const handler of handlers) expect(handler.onFailure).toBe('block');
  });

  it('through the Host model: a session-guard handler whose script fails blocks the call', () => {
    const failing = { ...guardHandler(), args: ['-e', 'process.exit(1)'] };
    const agent = `---\n${yaml.stringify({ tools: 'Bash', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [failing] }] } })}---\n`;
    const result = attempt(agent, path.resolve('scratch'), { tool: 'Bash', input: { command: 'echo hello world' } });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain(ON_FAILURE_BLOCK_MESSAGE);
  });
});

describe('every committed native Claude agent with a hooks block', () => {
  const files = fs.readdirSync(AGENTS).filter(file => file.endsWith('.md'));
  const withHooks = files.filter(file => preToolUseGroups(fs.readFileSync(path.join(AGENTS, file), 'utf8')).length > 0);

  it('is a real roster', () => {
    expect(withHooks.length).toBeGreaterThanOrEqual(22);
  });

  it.each(withHooks)('%s: onFailure "block" on each guard handler and on no mode-line handler', file => {
    const handlers = handlersOf(preToolUseGroups(fs.readFileSync(path.join(AGENTS, file), 'utf8')));
    expect(handlers.length).toBeGreaterThan(0);
    let guards = 0;
    for (const handler of handlers) {
      const target = String(handler.args?.[0] ?? '');
      if (/agents-united-mode-line-gate\.js$/.test(target)) {
        expect(handler, `${file} mode-line`).not.toHaveProperty('onFailure');
      } else if (/\/precheck-handback\.mjs$/.test(target)) {
        // The hand-back hook of the factory evaluator (ADR 0070) is not a guard: it fails open on purpose, so it carries no onFailure, and no other role has it.
        expect(file).toBe('factory-evaluator.md');
        expect(handler, `${file} hand-back`).not.toHaveProperty('onFailure');
      } else {
        expect(target, `${file} guard`).toMatch(/agents-united-(readonly-)?guard\.js$/);
        expect(handler.onFailure, `${file} ${target}`).toBe('block');
        guards++;
      }
    }
    expect(guards).toBeGreaterThan(0);
  });
});

// This calls the real generator functions `nativeGuardFileHooks`, `readOnlyGuardFileHooks`, `modeLineGateHooks` and `renderHooks` (the rendering behind `syncHooks`).
// It re-implements two choices the `UPDATE_NATIVE=1` path makes in tests/native-claude-agents.test.ts: which guard kind a role has (here read from the file with
// `inspectNativeAgent`) and the mode-line group of the digital-agency lead. No single exported function renders a role's whole hooks block.
describe('the hooks block of every committed native Claude agent is what the real generator renders', () => {
  const files = fs.readdirSync(AGENTS).filter(file => file.endsWith('.md'));
  it.each(files)('%s', file => {
    const text = fs.readFileSync(path.join(AGENTS, file), 'utf8').replace(/\r\n/g, '\n');
    const { guard } = inspectNativeAgent(text);
    if (guard === 'none') {
      expect(text, `${file} has no guard and no generated hooks block`).not.toContain('agents-united:hooks:start');
      return;
    }
    const base = expectedWorkerHooks(file.replace(/\.md$/, ''), guard);
    const hooks = file === 'orchestrator-digital-agency.md' ? { PreToolUse: [...base.PreToolUse, ...modeLineGateHooks().PreToolUse] } : base;
    const block = /# agents-united:hooks:start[^\n]*\n([\s\S]*?)\n  # agents-united:hooks:end/.exec(text)?.[1];
    expect(block, file).toBe(renderHooks(hooks));
  });
});

describe('the inline form (a global install) carries the field too', () => {
  it.each([
    ['backend-architect', 'agents-united-guard'],
    ['code-reviewer', 'agents-united-readonly-guard'],
  ])('%s: each guard handler of the rendered role has onFailure "block"', (role, _name) => {
    const text = ClaudeProjector.nativeRoleContent(path.resolve('registry'), role, `.agents/agents/${role}.md`, 'inline') ?? '';
    const handlers = handlersOf(preToolUseGroups(text));
    expect(handlers.length).toBeGreaterThan(0);
    for (const handler of handlers) {
      expect(handler.args?.[0], role).toBe('-e');
      expect(handler.onFailure, role).toBe('block');
    }
  });
});

describe('through the Host model: a payload the destructive guard cannot read blocks the call', () => {
  const role = ClaudeProjector.nativeRoleContent(path.resolve('registry'), 'backend-architect', '.agents/agents/backend-architect.md', 'inline') ?? '';
  const dir = path.resolve('scratch');
  const bash = { tool: 'Bash', input: { command: 'echo hello world' } };

  it.each(['', '   ', '{', 'null', '[]'])('stdin %j blocks, with the unreadable-input reason', stdin => {
    const result = attempt(role, dir, bash, { stdin });
    expect(result.fired).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/^Blocked by agents-united guard: unreadable hook input/);
  });

  it('a readable payload for a harmless call still passes', () => {
    expect(attempt(role, dir, bash).blocked).toBe(false);
  });
});

describe('a role installed with an earlier destructive guard script is still seen as guarded', () => {
  // The script as it was before the unreadable-input change (the 2026-11-17 decision): same ownership marker, other text. It is read from
  // the one list of earlier scripts; a role is recognised by that exact text, not by the marker alone.
  const OLD_SCRIPT = EARLIER_GUARD_SCRIPTS[0];
  const roleWith = (script: string): string =>
    `---\nname: x\ntools: Bash, Read\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: node\n          args: ["-e", ${JSON.stringify(script)}]\n---\nbody\n`;

  it('the old text really differs from the current script and keeps the marker', () => {
    expect(OLD_SCRIPT).not.toBe(GUARD_SCRIPT);
    expect(OLD_SCRIPT).toContain('Blocked by agents-united guard');
  });
  it('is read as a destructive guard by its exact text', () => {
    expect(inspectNativeAgent(roleWith(OLD_SCRIPT)).guard).toBe('destructive');
    expect(inspectNativeAgent(roleWith(GUARD_SCRIPT)).guard).toBe('destructive');
  });
  it('a script with neither text is no guard, even when it carries the marker, and the read-only guard stays read-only', () => {
    expect(inspectNativeAgent(roleWith('process.exit(0)')).guard).toBe('none');
    expect(inspectNativeAgent(roleWith(`process.exit(0);/*Blocked by agents-united guard*/`)).guard).toBe('none');
    expect(inspectNativeAgent(roleWith(`${OLD_SCRIPT};process.exit(0)`)).guard).toBe('none');
    expect(inspectNativeAgent(roleWith(READ_ONLY_GUARD_SCRIPT)).guard).toBe('read-only');
  });
});

describe('the other Hosts are untouched', () => {
  it('no Antigravity or Cline registry file mentions onFailure', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
    for (const host of ['antigravity', 'cline']) {
      for (const file of walk(path.resolve('registry/hosts', host))) {
        if (/\.(png|jpg|jpeg|gif|webp|zip|woff2?)$/i.test(file)) continue;
        expect(fs.readFileSync(file, 'utf8'), file).not.toContain('onFailure');
      }
    }
  });

  it('the Antigravity and Cline guard sources (and the Cline plugin file) do not use the Claude handler builders', () => {
    for (const file of ['src/core/antigravity-hooks.ts', 'src/core/antigravity-projector.ts', 'src/core/cline-projector.ts', 'registry/hosts/cline/plugins/agents-united-guard.js']) {
      const text = fs.readFileSync(path.resolve(file), 'utf8');
      expect(text, file).not.toMatch(/guardFileHandler|nativeGuardHandler|readOnlyGuardHandler|onFailure/);
    }
  });
});

describe('the guard scripts exit 0 where they allow and 2 where they block (the destructive guard blocks input it cannot read); every other exit blocks through onFailure', () => {
  const run = (script: string, stdin: string): { status: number | null; stderr: string } => {
    const result = spawnSync(process.execPath, [path.join(HOOKS, script)], { input: stdin, encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr };
  };
  const call = (tool_name: string, tool_input: Record<string, unknown> = {}): string => JSON.stringify({ tool_name, tool_input });

  it('destructive guard: a destructive call exits 2', () => {
    expect(run('agents-united-guard.js', call('Bash', { command: 'git push --force origin main' })).status).toBe(2);
  });

  it('destructive guard: a harmless call, an unknown tool name, {} and an object without tool_input allow and exit 0', () => {
    expect(run('agents-united-guard.js', call('Bash', { command: 'echo hello world' })).status).toBe(0);
    expect(run('agents-united-guard.js', call('SomeFutureTool', { anything: 1 })).status).toBe(0);
    expect(run('agents-united-guard.js', '{}').status).toBe(0);
    expect(run('agents-united-guard.js', '{"tool_name":"Bash"}').status).toBe(0);
  });

  // The maintainer's decision of 2026-11-17: input the guard cannot read is blocked, not allowed.
  it.each([
    ['empty', ''],
    ['white space', ' \n\t '],
    ['an unclosed brace', '{'],
    ['not json', '{not json'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a JSON string', '"git push --force"'],
    ['a number', '42'],
    ['true', 'true'],
  ])('destructive guard: %s input is unreadable and exits 2 with the unreadable-input message', (_name, stdin) => {
    const result = run('agents-united-guard.js', stdin);
    expect(result.status).toBe(2);
    expect(result.stderr.startsWith('Blocked by agents-united guard: unreadable hook input')).toBe(true);
    expect(result.stderr).toMatch(/input of this tool call could not be read/);
  });

  it('destructive guard: a valid payload behind a BOM is read, not blocked', () => {
    expect(run('agents-united-guard.js', '﻿' + call('Bash', { command: 'echo hello world' })).status).toBe(0);
    const blocked = run('agents-united-guard.js', '﻿' + call('Bash', { command: 'git push --force origin main' }));
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toMatch(/git push --force requires/);
  });

  it('read-only guard: a mutating call exits 2; unreadable, empty and null input exit 2 too (it fails closed on its own)', () => {
    expect(run('agents-united-readonly-guard.js', call('Write', { file_path: 'a.txt' })).status).toBe(2);
    for (const stdin of ['', '{not json', 'null']) {
      const result = run('agents-united-readonly-guard.js', stdin);
      expect(result.status, JSON.stringify(stdin)).toBe(2);
      expect(result.stderr).toMatch(/unreadable hook input/);
    }
  });

  it('read-only guard: a read-only tool and an unknown tool name exit 0', () => {
    expect(run('agents-united-readonly-guard.js', call('Read', { file_path: 'a.txt' })).status).toBe(0);
    expect(run('agents-united-readonly-guard.js', call('SomeFutureTool')).status).toBe(0);
    expect(run('agents-united-readonly-guard.js', '{}').status).toBe(0);
  });

  it('a guard script that is gone makes node exit 1: a failure in the Host sense, so onFailure "block" blocks', () => {
    const result = spawnSync(process.execPath, [path.join(HOOKS, 'no-such-guard.js')], { input: call('Bash', { command: 'echo x' }), encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Cannot find module/);
  });
});
