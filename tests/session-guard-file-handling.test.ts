import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EARLIER_GUARD_SCRIPTS, GUARD_SCRIPT, nativeGuardHooks } from '../src/core/guard.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import {
  inspectSessionGuard,
  mergeSessionGuard,
  removeOwnedSessionGuard,
  sessionGuardHandler,
  sessionGuardHooks,
  sessionGuardScript,
} from '../src/core/session-guard.js';

/**
 * The settings-file side of the session guard: what counts as ours and current, what is only ours, what is never touched, and how the
 * file is read and written. Temp directories only; no real Claude session.
 */

const DIR = path.join(os.tmpdir(), `agents-united-guard-files-${process.pid}`);
const SETTINGS = path.join(DIR, '.claude', 'settings.json');
const OLD_MATCHERS = ['Bash', 'Write|Edit|NotebookEdit'];
const USER_HOOK = { matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/audit.sh' }] };

type Json = Record<string, unknown>;
const readSettings = async (): Promise<Json> => fs.readJson(SETTINGS);
const preToolUse = async (): Promise<Array<{ matcher?: string; hooks: Json[] }>> => ((await readSettings()).hooks as { PreToolUse: never }).PreToolUse;
const ours = (handler: Json | null): boolean => typeof handler?.args === 'object' && String((handler.args as string[])[1] ?? '').includes('Blocked by agents-united guard');
const hashOf = (handler: object): string => crypto.createHash('sha256').update(JSON.stringify(handler)).digest('hex').slice(0, 16);
const writeGroups = async (groups: unknown[], extra: Json = {}): Promise<void> => {
  await fs.outputJson(SETTINGS, { ...extra, hooks: { PreToolUse: groups } }, { spaces: 2 });
};

beforeEach(async () => {
  await fs.remove(DIR);
  await fs.ensureDir(DIR);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(DIR);
});

describe('D: current means the exact key set', () => {
  it.each([
    ['async', { async: true }],
    ['timeout', { timeout: 5 }],
    ['if', { if: 'Bash(git push:*)' }],
    ['shell', { shell: 'powershell' }],
  ])('a handler with an extra key (%s) is modified: reported, never rewritten, never deleted', async (_name, extra) => {
    const handler = { ...sessionGuardHandler('project'), ...extra };
    await writeGroups(sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [handler] })));
    const before = await fs.readFile(SETTINGS, 'utf8');

    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('modified');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toEqual({ status: 'absent', left: 2 });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);
  });

  it('the same four keys in another order are still current', async () => {
    const { onFailure, args, command, type } = sessionGuardHandler('project');
    const reordered = { onFailure, args, command, type };
    await writeGroups(sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [reordered] })));
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });
});

describe('E: the native role guard is recognised by its exact script, not by the marker text', () => {
  const roleWith = (script: string): string =>
    `---\nname: x\ntools: Bash, Edit\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: node\n          args:\n            - -e\n            - ${JSON.stringify(script)}\n---\nbody\n`;

  it('the current script is a destructive guard', () => {
    expect(inspectNativeAgent(roleWith(GUARD_SCRIPT)).guard).toBe('destructive');
  });

  it.each(EARLIER_GUARD_SCRIPTS.map((script, index) => [index, script] as const))('an earlier script of ours (%i) is still a destructive guard', (_index, script) => {
    expect(inspectNativeAgent(roleWith(script)).guard).toBe('destructive');
  });

  it('a script that only carries the marker is no guard', () => {
    expect(inspectNativeAgent(roleWith('process.exit(0);/*Blocked by agents-united guard*/')).guard).toBe('none');
  });

  it('there is one list of earlier scripts and it holds the version before the unreadable-input change', () => {
    expect(EARLIER_GUARD_SCRIPTS.length).toBeGreaterThan(0);
    for (const script of EARLIER_GUARD_SCRIPTS) {
      expect(script).toContain('Blocked by agents-united guard');
      expect(script).not.toBe(GUARD_SCRIPT);
    }
  });
});

describe('G: the settings file is read and written without loss', () => {
  const ENTRY = { matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/audit.sh' }] };

  it('keeps a BOM through a merge and a removal, and the removal restores the bytes', async () => {
    const original = `\uFEFF${JSON.stringify({ env: { A: '1' }, hooks: { PreToolUse: [ENTRY] } }, null, 2)}\n`;
    await fs.outputFile(SETTINGS, original, 'utf8');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    const merged = await fs.readFile(SETTINGS, 'utf8');
    expect(merged.charCodeAt(0)).toBe(0xfeff);
    expect(merged.charCodeAt(1)).toBe('{'.charCodeAt(0));
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toEqual({ status: 'removed', left: 0 });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(original);
  });

  it('a file we create has no BOM', async () => {
    await mergeSessionGuard(SETTINGS);
    expect((await fs.readFile(SETTINGS, 'utf8')).charCodeAt(0)).toBe('{'.charCodeAt(0));
  });

  it('keeps tab indent, key order and a missing trailing newline', async () => {
    const original = JSON.stringify({ zeta: 1, alpha: { b: 2, a: 1 }, hooks: { PostToolUse: [], PreToolUse: [ENTRY] } }, null, '\t');
    await fs.outputFile(SETTINGS, original);
    await mergeSessionGuard(SETTINGS);
    const merged = await fs.readFile(SETTINGS, 'utf8');
    expect(merged).toMatch(/\n\t"zeta"/);
    expect(merged.endsWith('\n')).toBe(false);
    expect(Object.keys(JSON.parse(merged) as Json)).toEqual(['zeta', 'alpha', 'hooks']);
    await removeOwnedSessionGuard(SETTINGS, { createdFile: false });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(original);
  });

  it('null and other non-object elements in hooks and PreToolUse do not throw and stay in place', async () => {
    const odd = [null, 5, 'text', [], { matcher: 'Read', hooks: [null, 7, ENTRY.hooks[0]] }, { matcher: 'Bash', hooks: 'x' }, { hooks: null }];
    await writeGroups(odd);
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    const after = await preToolUse();
    expect(after.slice(0, odd.length)).toEqual(odd);
    expect(after).toHaveLength(odd.length + 2);
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toEqual({ status: 'removed', left: 0 });
    expect(await preToolUse()).toEqual(odd);
  });

  it('a null among the hooks of one of our groups does not stop the removal', async () => {
    await mergeSessionGuard(SETTINGS);
    const settings = await readSettings();
    const groups = (settings.hooks as { PreToolUse: Array<{ hooks: unknown[] }> }).PreToolUse;
    groups[0].hooks.unshift(null);
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    const firstMatcher = (groups[0] as unknown as { matcher: string }).matcher;
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: false });
    expect(outcome).toEqual({ status: 'removed', left: 0 });
    expect(await preToolUse()).toEqual([{ matcher: firstMatcher, hooks: [null] }]);
  });

  it.each([
    ['zero bytes', ''],
    ['white space only', '  \r\n\t\n'],
    ['a BOM only', '\uFEFF'],
  ])('an empty file (%s) is written into when the guard is turned on, and nothing else is claimed', async (_name, text) => {
    await fs.outputFile(SETTINGS, text, 'utf8');
    expect(await inspectSessionGuard(SETTINGS)).toBe('missing');
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toEqual({ status: 'absent', left: 0 });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(text);
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });

  it('a file that is not an object is still left alone', async () => {
    for (const text of ['[]', 'null', '"x"', '{ // c\n}', '{"hooks": []}', '{"hooks": {"PreToolUse": {}}}']) {
      await fs.outputFile(SETTINGS, text);
      expect((await mergeSessionGuard(SETTINGS)).status, text).toBe('skipped-invalid');
      expect(await fs.readFile(SETTINGS, 'utf8')).toBe(text);
    }
  });
});

describe('I: the session guard covers the same tools as the native role guards', () => {
  const run = (tool_name: string, tool_input: Json) =>
    spawnSync(process.execPath, ['-e', sessionGuardScript('project')], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' });

  it('uses the matchers of the native role guards, from one source', () => {
    const wanted = nativeGuardHooks().PreToolUse.map(group => group.matcher);
    expect(wanted).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
    expect(sessionGuardHooks('project').PreToolUse.map(group => group.matcher)).toEqual(wanted);
    expect(sessionGuardHooks('user').PreToolUse.map(group => group.matcher)).toEqual(wanted);
  });

  it('the script judges a PowerShell command through the same field as a Bash command', () => {
    expect(run('PowerShell', { command: 'git push --force origin main' }).status).toBe(2);
    expect(run('PowerShell', { command: 'git push -f origin main' }).status).toBe(2);
    expect(run('PowerShell', { command: 'vercel --prod' }).status).toBe(2);
    expect(run('PowerShell', { command: 'Get-ChildItem' }).status).toBe(0);
    expect(run('Bash', { command: 'git push --force origin main' }).status).toBe(2);
  });

  it('the script judges a MultiEdit target through file_path like Edit', () => {
    expect(run('MultiEdit', { file_path: 'C:\\repo\\.env', edits: [] }).status).toBe(2);
    expect(run('MultiEdit', { file_path: 'C:\\repo\\src\\a.ts', edits: [] }).status).toBe(0);
  });

  it('a file written with the earlier matchers is outdated, not modified, and update renews it where it stands', async () => {
    const handler = sessionGuardHandler('project');
    await writeGroups([USER_HOOK, { matcher: OLD_MATCHERS[0], hooks: [handler] }, { matcher: 'Read', hooks: [{ type: 'command', command: 'echo' }] }, { matcher: OLD_MATCHERS[1], hooks: [handler] }]);
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    expect((await preToolUse()).map(group => group.matcher)).toEqual(['Bash', 'Bash|PowerShell', 'Read', 'Write|Edit|MultiEdit|NotebookEdit']);
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('unchanged');
  });

  it('an earlier group that also holds the user\'s own hook keeps that hook under its old matcher', async () => {
    const handler = sessionGuardHandler('project');
    const mine = { type: 'command', command: './mine.sh' };
    await writeGroups([{ matcher: 'Bash', hooks: [mine, handler] }, { matcher: OLD_MATCHERS[1], hooks: [handler] }]);
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
    await mergeSessionGuard(SETTINGS);
    const groups = await preToolUse();
    expect(groups[0]).toEqual({ matcher: 'Bash', hooks: [mine] });
    expect(groups.filter(group => group.hooks.some(ours)).map(group => group.matcher).sort()).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });

  it('removal takes our handler out of an earlier-matcher group and keeps the user\'s hook', async () => {
    const handler = sessionGuardHandler('project');
    const mine = { type: 'command', command: './mine.sh' };
    await writeGroups([{ matcher: 'Bash', hooks: [mine, handler] }, { matcher: OLD_MATCHERS[1], hooks: [handler] }]);
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toEqual({ status: 'removed', left: 0 });
    expect(await preToolUse()).toEqual([{ matcher: 'Bash', hooks: [mine] }]);
  });

  it('a group of ours with a matcher we never wrote counts as an edit, and removal still takes our handler out of it', async () => {
    await writeGroups([{ matcher: 'Bash|Edit', hooks: [sessionGuardHandler('project')] }, { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [sessionGuardHandler('project')] }]);
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).toEqual({ status: 'deleted-file', left: 0 });
  });
});

describe('J: a handler is outdated by its recorded hash alone', () => {
  const unknownForm = {
    type: 'command',
    command: 'node',
    args: ['-e', 'process.stderr.write("Blocked by agents-united guard: an earlier wording");process.exit(2)'],
    legacy: true,
  };

  it('is modified without the recorded hash and outdated with it, and update renews it only with it', async () => {
    await writeGroups(sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [unknownForm] })));
    const before = await fs.readFile(SETTINGS, 'utf8');
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
    expect(await inspectSessionGuard(SETTINGS, 'deadbeefdeadbeef')).toBe('modified');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('modified');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);

    expect(await inspectSessionGuard(SETTINGS, hashOf(unknownForm))).toBe('outdated');
    expect((await mergeSessionGuard(SETTINGS, { replaceHash: hashOf(unknownForm) })).status).toBe('merged');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });
});
