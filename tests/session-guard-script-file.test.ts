import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fsSync from 'node:fs';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionGuardStateLabel } from '../src/cli.js';
import { DoctorEngine, teammateGuardClause } from '../src/core/doctor.js';
import { EARLIER_GUARD_SCRIPTS, GUARD_SCRIPT } from '../src/core/guard.js';
import { InstallEngine } from '../src/core/installer.js';
import {
  EARLIER_SESSION_SCRIPTS,
  inspectSessionGuard,
  inspectSessionGuardScript,
  mergeSessionGuard,
  removeOwnedSessionGuard,
  sessionGuardCommands,
  sessionGuardHandler,
  sessionGuardHooks,
  sessionGuardScript,
  sessionGuardScriptContent,
  sessionGuardScriptLeftNote,
  sessionGuardScriptPath,
  sameSessionGuardPath,
} from '../src/core/session-guard.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';

/**
 * ADR 0068 addendum (2026-11-18, finding G6): the session guard's script lives in a file, so the Host's notice shows a short path and
 * not the 2,000 characters of script that begin with the words of the "guard failed" message. Temp folders and a faked home only; no
 * Claude Code session and no Host is started (the script file is run with plain `node`, as the hook would).
 */

const NAME = 'agents-united-session-guard.js';
const ROOT = path.join(os.tmpdir(), `agents-united-guard-script-file-${process.pid}`);
const HOME = path.join(ROOT, 'home');
const PROJECT = path.join(ROOT, 'project');
const PROJECT_LOCK = path.join(PROJECT, '.agents', 'agents-united.json');
const HOME_LOCK = path.join(HOME, '.agents', 'agents-united.json');
const SETTINGS = path.join(PROJECT, '.claude', 'settings.json');
const SETTINGS_LOCAL = path.join(PROJECT, '.claude', 'settings.local.json');
const SCRIPT = path.join(PROJECT, '.claude', 'hooks', NAME);
const USER_SETTINGS = path.join(HOME, '.claude', 'settings.json');
const USER_SCRIPT = path.join(HOME, '.claude', 'hooks', NAME);
const REFERENCE = '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-session-guard.js';

type Json = Record<string, any>;
const sha = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
const installIn = (dir: string, opts: Json = {}) =>
  new InstallEngine().install('software-engineering', { targetDir: path.join(dir, '.agents'), method: 'copy', fanout: ['claude'], ...opts } as never);
const installProject = (opts: Json = {}) => installIn(PROJECT, opts);
const installGlobal = (opts: Json = {}) => installIn(HOME, { scope: 'global', ...opts });
const update = (opts: Json = {}) => new UpdateEngine().update('__all__', { hosts: ['agents'], cwd: PROJECT, ...opts } as never);
const uninstall = () => new UninstallEngine().uninstall('software-engineering', { targetDir: path.join(PROJECT, '.agents'), yes: true } as never);
const lock = async (file: string): Promise<Json> => fs.readJson(file);
const groupsOf = async (file: string): Promise<Array<{ matcher: string; hooks: Json[] }>> => (await fs.readJson(file)).hooks?.PreToolUse ?? [];
const doctor = (dir: string) => DoctorEngine.runDoctor(path.join(dir, '.agents'), 'claude');
const runScript = (file: string, stdin: string) => {
  const result = spawnSync(process.execPath, [file], { input: stdin, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};
const bashCall = (command: string): string => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
/** An inline handler as the earlier versions wrote it. */
const inline = (script: string, withFailure = true): Json => ({ type: 'command', command: 'node', args: ['-e', script], ...(withFailure ? { onFailure: 'block' } : {}) });
const writeInlineSettings = async (file: string, handler: Json): Promise<void> => {
  await fs.outputJson(file, { hooks: { PreToolUse: sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [handler] })) } }, { spaces: 2 });
};

beforeEach(async () => {
  await fs.remove(ROOT);
  await fs.ensureDir(HOME);
  await fs.ensureDir(PROJECT);
  vi.spyOn(os, 'homedir').mockReturnValue(HOME);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(ROOT);
});

describe('the handler names a script file, with exactly four keys', () => {
  it.each(['project', 'local'] as const)('%s: ${CLAUDE_PROJECT_DIR} path, node, onFailure block', variant => {
    const handler = sessionGuardHandler(variant);
    expect(handler).toEqual({ type: 'command', command: 'node', args: [REFERENCE], onFailure: 'block' });
    expect(Object.keys(handler)).toEqual(['type', 'command', 'args', 'onFailure']);
  });

  it.each(['user', 'user-project'] as const)('%s: an absolute path under the home folder (a user-level hook has no placeholder for it)', reach => {
    const handler = sessionGuardHandler(reach);
    expect(handler).toEqual({ type: 'command', command: 'node', args: [USER_SCRIPT], onFailure: 'block' });
    expect(path.isAbsolute(handler.args[0])).toBe(true);
    expect(Object.keys(handler)).toEqual(['type', 'command', 'args', 'onFailure']);
  });

  it('the matchers are the role guards\' matchers', () => {
    expect(sessionGuardHooks('project').PreToolUse.map(group => group.matcher)).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
  });

  it('what the Host prints in front of a refusal is short and holds no failure-message text (G6)', () => {
    const notice = `PreToolUse:Bash hook error: [${[sessionGuardHandler('project').command, ...sessionGuardHandler('project').args].join(' ')}]: x`;
    expect(notice.length).toBeLessThan(160);
    expect(notice).not.toContain('Blocked by agents-united guard');
    expect(notice).not.toContain('To get out');
    expect(JSON.stringify(sessionGuardHooks('project'))).not.toContain('Blocked by agents-united guard');
    expect(JSON.stringify(sessionGuardHooks('user'))).not.toContain('agents update');
  });

  it('the script text itself is unchanged: the file holds exactly the session script, one text per kind of settings file', () => {
    expect(sessionGuardScriptContent('project')).toBe(`${sessionGuardScript('project')}\n`);
    expect(sessionGuardScriptContent('user')).toBe(`${sessionGuardScript('user')}\n`);
    expect(sessionGuardScript('project')).toContain('Blocked by agents-united guard: the guard failed while reading this tool call.');
    expect(sessionGuardScript('project')).toContain(sessionGuardCommands('project').remove);
  });

  it('the script file sits beside the settings file it serves', () => {
    expect(sessionGuardScriptPath(SETTINGS)).toBe(SCRIPT);
    expect(sessionGuardScriptPath(SETTINGS_LOCAL)).toBe(SCRIPT);
    expect(sessionGuardScriptPath(USER_SETTINGS)).toBe(USER_SCRIPT);
  });
});

describe('mergeSessionGuard writes the script file and the entries that name it', () => {
  it('creates both; the settings file holds only the short entries', async () => {
    const result = await mergeSessionGuard(SETTINGS);
    expect(result.status).toBe('created');
    expect(result.script).toEqual({ status: 'created', hash: sha(sessionGuardScriptContent('project')) });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    const text = await fs.readFile(SETTINGS, 'utf8');
    expect(text).toContain(REFERENCE);
    expect(text).not.toContain('Blocked by agents-united guard');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('present');
  });

  it('the local file shares the one script beside it', async () => {
    await mergeSessionGuard(SETTINGS_LOCAL);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('the user file gets the user text and an absolute path', async () => {
    await mergeSessionGuard(USER_SETTINGS);
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await groupsOf(USER_SETTINGS))[0].hooks[0].args).toEqual([USER_SCRIPT]);
  });

  it('is idempotent: a second merge changes no byte of either file', async () => {
    await mergeSessionGuard(SETTINGS);
    const settings = await fs.readFile(SETTINGS, 'utf8');
    const script = await fs.readFile(SCRIPT, 'utf8');
    const again = await mergeSessionGuard(SETTINGS);
    expect(again.status).toBe('unchanged');
    expect(again.script.status).toBe('unchanged');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(settings);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(script);
  });

  it('does not touch the other files in the hooks folder (the role guards live there too)', async () => {
    const role = path.join(PROJECT, '.claude', 'hooks', 'agents-united-guard.js');
    await fs.outputFile(role, '// a role guard\n');
    await mergeSessionGuard(SETTINGS);
    expect(await fs.readFile(role, 'utf8')).toBe('// a role guard\n');
  });

  it('a settings file that is not valid JSON is left alone, but the script is written so a hand-pasted entry works', async () => {
    await fs.outputFile(SETTINGS, '{ // mine\n}');
    const result = await mergeSessionGuard(SETTINGS);
    expect(result.status).toBe('skipped-invalid');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe('{ // mine\n}');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });
});

describe('the script file does the same work as the inline script did', () => {
  it('a harmless call passes, a forced push is blocked with the generic reason and not with the failure message', async () => {
    await mergeSessionGuard(SETTINGS);
    expect(runScript(SCRIPT, bashCall('git status --short')).status).toBe(0);
    const forced = runScript(SCRIPT, bashCall('git push --force origin main'));
    expect(forced.status).toBe(2);
    expect(forced.stderr).toBe('Blocked by agents-united guard: git push --force requires explicit human approval outside the agent session. If you mean it, run it yourself in your own terminal.\n');
  });

  it('unreadable input exits 2 with the unreadable-input message, both commands and the manual route', async () => {
    await mergeSessionGuard(SETTINGS);
    const result = runScript(SCRIPT, 'null');
    expect(result.status).toBe(2);
    expect(result.stderr.startsWith('Blocked by agents-united guard: unreadable hook input')).toBe(true);
    expect(result.stderr).toContain(sessionGuardCommands('project').repair);
    expect(result.stderr).toContain(sessionGuardCommands('project').remove);
  });

  it('the user file\'s script names --global and the alternative', async () => {
    await mergeSessionGuard(USER_SETTINGS);
    const result = runScript(USER_SCRIPT, 'null');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('agents update --all --global --no-session-guard');
  });

  it('LIMIT (ADR 0068 addendum): when the file is missing node exits non-zero and prints no way-out message', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.remove(SCRIPT);
    const result = runScript(SCRIPT, bashCall('git push --force origin main'));
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(2);
    expect(`${result.stdout}${result.stderr}`).not.toContain('agents update');
    expect(`${result.stdout}${result.stderr}`).not.toContain('To get out');
  });
});

describe('earlier inline forms are outdated, and an update renews them in place to the file form', () => {
  const earlierHandlers: Array<[string, Json]> = [
    ['the current inline session text (project)', inline(sessionGuardScript('project'))],
    ['the current inline session text (user)', inline(sessionGuardScript('user'))],
    ['the inline session text without onFailure', inline(sessionGuardScript('project'), false)],
    ['the generic script with onFailure', inline(GUARD_SCRIPT)],
    ['the generic script without onFailure', inline(GUARD_SCRIPT, false)],
    ...EARLIER_GUARD_SCRIPTS.map((script, index): [string, Json] => [`an earlier generic script (${index})`, inline(script)]),
    ...EARLIER_SESSION_SCRIPTS.map((script, index): [string, Json] => [`an earlier session script (${index})`, inline(script)]),
  ];

  it.each(earlierHandlers)('%s reads as outdated; merge renews it and writes the script', async (_name, handler) => {
    await writeInlineSettings(SETTINGS, handler);
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
    const result = await mergeSessionGuard(SETTINGS);
    expect(result.status).toBe('merged');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect(JSON.stringify(await groupsOf(SETTINGS))).not.toContain('Blocked by agents-united guard');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('keeps the user\'s own hook and the order of the file, replacing only our handler', async () => {
    const mine = { type: 'command', command: './mine.sh' };
    await fs.outputJson(SETTINGS, { env: { A: '1' }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [mine] }, ...sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [inline(sessionGuardScript('project'))] }))] } }, { spaces: 2 });
    await mergeSessionGuard(SETTINGS);
    const groups = await groupsOf(SETTINGS);
    expect(groups[0]).toEqual({ matcher: 'Bash', hooks: [mine] });
    expect(groups.slice(1).map(group => group.hooks[0])).toEqual([sessionGuardHandler('project'), sessionGuardHandler('project')]);
    expect((await fs.readJson(SETTINGS)).env).toEqual({ A: '1' });
  });

  it('a hand-edited inline handler stays modified: never rewritten, never removed', async () => {
    await writeInlineSettings(SETTINGS, inline(`${sessionGuardScript('project')};process.exit(0)`));
    const before = await fs.readFile(SETTINGS, 'utf8');
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('modified');
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).toMatchObject({ status: 'absent', left: 2 });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);
  });

  it('a file-form handler with an extra key is modified; one that names another file is not ours at all', async () => {
    await writeInlineSettings(SETTINGS, { ...sessionGuardHandler('project'), timeout: 5 });
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
    await writeInlineSettings(SETTINGS, { ...sessionGuardHandler('project'), args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/other-session-guard.js'] });
    expect(await inspectSessionGuard(SETTINGS)).toBe('missing');
  });
});

describe('the state of the script file', () => {
  it('missing, present, outdated (an earlier text of ours), modified (anything else), and tolerant of CRLF', async () => {
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('missing');
    await mergeSessionGuard(SETTINGS);
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('present');

    await fs.writeFile(SCRIPT, sessionGuardScriptContent('project').replace(/\n/g, '\r\n'));
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('present');

    for (const earlier of [...EARLIER_SESSION_SCRIPTS, GUARD_SCRIPT, ...EARLIER_GUARD_SCRIPTS, sessionGuardScript('user')]) {
      await fs.writeFile(SCRIPT, `${earlier}\n`);
      expect(await inspectSessionGuardScript(SETTINGS)).toBe('outdated');
    }

    await fs.writeFile(SCRIPT, `${sessionGuardScript('project')};process.exit(0)\n`);
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('modified');
    await fs.writeFile(SCRIPT, '');
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('modified');
  });

  it('a text whose hash was recorded counts as an earlier text of ours', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.writeFile(SCRIPT, '// a version this build does not know\n');
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('modified');
    expect(await inspectSessionGuardScript(SETTINGS, sha('// a version this build does not know\n'))).toBe('outdated');
  });

  it('merge recreates a missing file, renews an earlier text, and leaves a hand-edited file as it is', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.remove(SCRIPT);
    expect((await mergeSessionGuard(SETTINGS)).script.status).toBe('created');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));

    await fs.writeFile(SCRIPT, `${EARLIER_SESSION_SCRIPTS[0]}\n`);
    expect((await mergeSessionGuard(SETTINGS)).script.status).toBe('renewed');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));

    await fs.writeFile(SCRIPT, '// mine\nprocess.exit(0)\n');
    const result = await mergeSessionGuard(SETTINGS);
    expect(result.script.status).toBe('modified');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe('// mine\nprocess.exit(0)\n');
  });
});

describe('removal takes the script file out with the entries, only when it is ours', () => {
  it('removes the script and the then-empty hooks folder; a file we created in .claude goes with them', async () => {
    await mergeSessionGuard(SETTINGS);
    expect(await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).toMatchObject({ status: 'deleted-file', left: 0 });
    expect(await fs.pathExists(SCRIPT)).toBe(false);
    expect(await fs.pathExists(path.dirname(SCRIPT))).toBe(false);
  });

  it('keeps the hooks folder when other files are in it', async () => {
    const role = path.join(path.dirname(SCRIPT), 'agents-united-guard.js');
    await fs.outputFile(role, '// a role guard\n');
    await mergeSessionGuard(SETTINGS);
    await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    expect(await fs.pathExists(SCRIPT)).toBe(false);
    expect(await fs.readFile(role, 'utf8')).toBe('// a role guard\n');
  });

  it('removes an earlier text of ours (also the recorded one) but leaves a hand-edited file and says so', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.writeFile(SCRIPT, `${EARLIER_SESSION_SCRIPTS[1]}\n`);
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('removed');
    expect(await fs.pathExists(SCRIPT)).toBe(false);

    await mergeSessionGuard(SETTINGS);
    await fs.writeFile(SCRIPT, '// mine\n');
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    expect(outcome.status).toBe('deleted-file');
    expect(outcome.script).toBe('left-edited');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe('// mine\n');
  });

  it('removes the script even when the entries were already deleted by hand', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.writeJson(SETTINGS, {});
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: false });
    expect(outcome).toMatchObject({ status: 'absent', left: 0, script: 'removed' });
    expect(await fs.pathExists(SCRIPT)).toBe(false);
  });

  it('keeps the script while a hand-edited entry of ours is left in the settings file (it may name the file)', async () => {
    await mergeSessionGuard(SETTINGS);
    const settings = await fs.readJson(SETTINGS);
    settings.hooks.PreToolUse[0].hooks[0].async = true;
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: false });
    expect(outcome).toMatchObject({ status: 'removed', left: 1 });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('leaves the script when the settings file cannot be read (the entries may still name it)', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.writeFile(SETTINGS, '{ // mine\n}');
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: false })).status).toBe('skipped-invalid');
    expect(await fs.pathExists(SCRIPT)).toBe(true);
  });
});

describe('install, update, doctor and uninstall carry the script file', () => {
  it('install writes it, records its hash next to the handler hash, and the doctor says wired', async () => {
    await installProject({ sessionGuard: 'project' });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({
      file: '.claude/settings.json',
      handlerHash: expect.any(String),
      createdFile: true,
      scriptHash: sha(sessionGuardScriptContent('project')),
    });
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
  });

  it('doctor: entries present but the script file missing -> script-missing, with the repair command and the limit; a plain update repairs it', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.remove(SCRIPT);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-missing');
    expect(report.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));
    const warning = report.warnings.find(line => /Session guard script/.test(line)) ?? '';
    expect(warning).toContain('.claude/hooks/agents-united-session-guard.js');
    expect(warning).toContain('agents update --all');
    expect(warning).toMatch(/blocked/i);
    expect(warning).toMatch(/no way-out message/i);

    await installProject({});
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
  });

  it('doctor: the script holds an earlier text of ours -> script-outdated, and a plain update renews it', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, `${EARLIER_SESSION_SCRIPTS[0]}\n`);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-outdated');
    expect(report.warnings.join('\n')).toContain("Run 'agents update' to renew it.");
    await update();
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
  });

  it('doctor: the script was edited -> script-modified; update leaves it and says so', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, '// mine\nprocess.exit(0)\n');
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-modified');
    expect(report.warnings.join('\n')).toMatch(/edited by hand/);
    const result = await update();
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe('// mine\nprocess.exit(0)\n');
    expect(result.projections.flatMap(projection => projection.warnings ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*edited by hand/);
  });

  it('an install from before (the inline form, a lockfile without a script hash) is outdated, and the update moves it to the file form in place', async () => {
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    await fs.remove(path.dirname(SCRIPT));
    const old = await lock(PROJECT_LOCK);
    delete old.sessionGuard.scriptHash;
    await fs.writeJson(PROJECT_LOCK, old, { spaces: 2 });

    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('outdated');

    await update();
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((await groupsOf(SETTINGS)).map(group => group.hooks[0])).toEqual([sessionGuardHandler('project'), sessionGuardHandler('project')]);
    expect((await lock(PROJECT_LOCK)).sessionGuard.scriptHash).toBe(sha(sessionGuardScriptContent('project')));
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
  });

  it('agents update --no-session-guard removes the script with the entries and records off', async () => {
    await installProject({ sessionGuard: 'project' });
    await update({ sessionGuard: false });
    expect(await fs.pathExists(SCRIPT)).toBe(false);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
  });

  it('--no-session-guard leaves a hand-edited script and says so in the notes', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, '// mine\n');
    const result = await update({ sessionGuard: false });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe('// mine\n');
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*edited by hand/);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('uninstall of the last bundle removes the script; an edited script stays and is reported', async () => {
    await installProject({ sessionGuard: 'project' });
    await uninstall();
    expect(await fs.pathExists(SCRIPT)).toBe(false);

    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, '// mine\n');
    const result = await uninstall();
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe('// mine\n');
    expect((result.notes ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*edited by hand/);
  });

  it('moving the guard from the project file to the local file keeps one script', async () => {
    await installProject({ sessionGuard: 'project' });
    await update({ sessionGuard: 'local' });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect(await inspectSessionGuard(SETTINGS_LOCAL)).toBe('wired');
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('the user file: a global install writes the script under the home folder; --no-session-guard removes it; a plain update does not bring it back', async () => {
    await installGlobal({ sessionGuard: 'user' });
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await groupsOf(USER_SETTINGS))[0].hooks[0].args).toEqual([USER_SCRIPT]);
    expect((await lock(HOME_LOCK)).sessionGuard.scriptHash).toBe(sha(sessionGuardScriptContent('user')));
    expect((await doctor(HOME)).sessionGuard).toBe('wired');

    await update({ global: true, sessionGuard: false });
    expect(await fs.pathExists(USER_SCRIPT)).toBe(false);
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);

    await installGlobal({});
    expect(await fs.pathExists(USER_SCRIPT)).toBe(false);
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
  });

  it('the user file recorded by a project install: the doctor names the script file and the folder of the project', async () => {
    await installProject({ sessionGuard: 'user' });
    await fs.remove(USER_SCRIPT);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-missing');
    expect(report.sessionGuardCommands).toMatchObject({ ...sessionGuardCommands('user-project'), folder: path.resolve(PROJECT) });
    expect(report.warnings.join('\n')).toContain(USER_SCRIPT);
  });

  it('the doctor\'s manual route names the script file as well as the entries', async () => {
    await installProject({ sessionGuard: 'project' });
    const report = await doctor(PROJECT);
    expect(report.sessionGuardCommands?.manual).toContain(SETTINGS);
    expect(report.sessionGuardCommands?.manual).toContain('agents-united-session-guard.js');
  });
});

describe('the doctor line for the new states', () => {
  it.each(['script-missing', 'script-outdated', 'script-modified'])('%s has its own label', state => {
    const label = sessionGuardStateLabel(state);
    expect(label).toBeTruthy();
    expect(label).not.toBe(sessionGuardStateLabel('wired'));
  });
});

describe('the manual route inside the script is true for the file form', () => {
  const NEW_PROJECT = 'delete by hand the hook entries that run agents-united-session-guard.js from .claude/settings.json or .claude/settings.local.json in the project, and then delete the script file .claude/hooks/agents-united-session-guard.js in the project.';
  const NEW_USER = 'delete by hand the hook entries that run agents-united-session-guard.js from settings.json in the .claude folder of your home directory, and then delete the script file agents-united-session-guard.js in the hooks folder beside it.';
  const OLD_PROJECT = "delete by hand the hook entries that contain 'agents-united guard' from .claude/settings.json or .claude/settings.local.json in the project.";
  const OLD_USER = "delete by hand the hook entries that contain 'agents-united guard' from settings.json in the .claude folder of your home directory.";
  /** The session script as the version before this change wrote it. */
  const before = (kind: 'project' | 'user'): string =>
    sessionGuardScript(kind).split(kind === 'project' ? NEW_PROJECT : NEW_USER).join(kind === 'project' ? OLD_PROJECT : OLD_USER);

  it('both failure messages carry the new sentence, and no script text keeps the old phrase', () => {
    expect(sessionGuardScript('project')).toContain(`Without the CLI, ${NEW_PROJECT}`);
    expect(sessionGuardScript('user')).toContain(`Without the CLI, ${NEW_USER}`);
    for (const kind of ['project', 'user'] as const) {
      expect(sessionGuardScript(kind)).not.toContain("contain 'agents-united guard'");
      // In the unreadable-input message and in the uncaughtException message: twice.
      expect(sessionGuardScript(kind).split('delete by hand the hook entries that run agents-united-session-guard.js').length - 1).toBe(2);
    }
    expect(sessionGuardScript('project').length).toBeLessThan(2400);
    expect(sessionGuardScript('user').length).toBeLessThan(2400);
  });

  it('the running script prints it, with no absolute path', async () => {
    await mergeSessionGuard(SETTINGS);
    expect(runScript(SCRIPT, 'null').stderr).toContain(NEW_PROJECT);
    await mergeSessionGuard(USER_SETTINGS);
    const user = runScript(USER_SCRIPT, 'null').stderr;
    expect(user).toContain(NEW_USER);
    expect(user).not.toContain(HOME);
  });

  it('the doctor words the route the same way, naming the settings file and the script file', async () => {
    await installProject({ sessionGuard: 'project' });
    const report = await doctor(PROJECT);
    expect(report.sessionGuardCommands?.manual).toBe(`Without the CLI, delete by hand the hook entries that run agents-united-session-guard.js from ${SETTINGS}, and then delete the script file ${SCRIPT}.`);
  });

  it('the texts of the version before are earlier texts of ours (project and user)', () => {
    expect(before('project')).not.toBe(sessionGuardScript('project'));
    expect(before('user')).not.toBe(sessionGuardScript('user'));
    expect(EARLIER_SESSION_SCRIPTS).toContain(before('project'));
    expect(EARLIER_SESSION_SCRIPTS).toContain(before('user'));
  });

  it('a script file or an inline entry that carries the old sentence is outdated, and an update renews it', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, `${before('project')}\n`);
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('outdated');
    expect((await doctor(PROJECT)).sessionGuard).toBe('script-outdated');
    await update();
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');

    await writeInlineSettings(SETTINGS, inline(before('project')));
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');

    await mergeSessionGuard(USER_SETTINGS);
    await fs.writeFile(USER_SCRIPT, `${before('user')}\n`);
    expect(await inspectSessionGuardScript(USER_SETTINGS)).toBe('outdated');
  });
});

describe('one script, two settings files: project and local share it', () => {
  const both = async (): Promise<void> => {
    await mergeSessionGuard(SETTINGS);
    await mergeSessionGuard(SETTINGS_LOCAL);
  };
  const guardWorks = (): void => {
    expect(runScript(SCRIPT, bashCall('git status --short')).status).toBe(0);
    expect(runScript(SCRIPT, bashCall('git push --force origin main')).status).toBe(2);
  };

  it('removing the guard from the project file keeps the script while the local file still has it, and says why', async () => {
    await both();
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    expect(outcome).toMatchObject({ status: 'deleted-file', left: 0, script: 'kept-shared', scriptSharedWith: SETTINGS_LOCAL });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect(await inspectSessionGuard(SETTINGS_LOCAL)).toBe('wired');
    guardWorks();
  });

  it('removing the guard from the local file keeps the script while the project file still has it', async () => {
    await both();
    const outcome = await removeOwnedSessionGuard(SETTINGS_LOCAL, { createdFile: true });
    expect(outcome).toMatchObject({ status: 'deleted-file', left: 0, script: 'kept-shared', scriptSharedWith: SETTINGS });
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    guardWorks();
  });

  it('both removed: the first keeps the script, the second removes it and the empty folder', async () => {
    await both();
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('kept-shared');
    expect((await removeOwnedSessionGuard(SETTINGS_LOCAL, { createdFile: true })).script).toBe('removed');
    expect(await fs.pathExists(SCRIPT)).toBe(false);
    expect(await fs.pathExists(path.dirname(SCRIPT))).toBe(false);
  });

  it('a hand-edited entry of ours in the other file that names the script also keeps it', async () => {
    await both();
    const local = await fs.readJson(SETTINGS_LOCAL);
    local.hooks.PreToolUse[0].hooks[0].timeout = 5;
    await fs.writeJson(SETTINGS_LOCAL, local, { spaces: 2 });
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('kept-shared');
    expect(await fs.pathExists(SCRIPT)).toBe(true);
  });

  it('an other file that cannot be read counts as in use (the script is kept)', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.outputFile(SETTINGS_LOCAL, '{ // mine\n}');
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('kept-shared');
    expect(await fs.pathExists(SCRIPT)).toBe(true);
  });

  it('an other file without entries of ours does not keep it', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.outputJson(SETTINGS_LOCAL, { env: { A: '1' } });
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('removed');
  });

  it('the user file has its own script and is not affected by the project files, nor they by it', async () => {
    await mergeSessionGuard(SETTINGS);
    await mergeSessionGuard(USER_SETTINGS);
    expect((await removeOwnedSessionGuard(USER_SETTINGS, { createdFile: true })).script).toBe('removed');
    expect(await fs.pathExists(USER_SCRIPT)).toBe(false);
    expect(await fs.pathExists(SCRIPT)).toBe(true);
    expect((await removeOwnedSessionGuard(SETTINGS, { createdFile: true })).script).toBe('removed');
  });

  it('--no-session-guard on an install that records the project file keeps the script while the local file has it, and reports it', async () => {
    await installProject({ sessionGuard: 'project' });
    await mergeSessionGuard(SETTINGS_LOCAL);
    const result = await update({ sessionGuard: false });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*kept[^\n]*\.claude\/settings\.local\.json/);
    guardWorks();
  });

  it('uninstall of the last bundle keeps the script while the other file has it, and says so', async () => {
    await installProject({ sessionGuard: 'project' });
    await mergeSessionGuard(SETTINGS_LOCAL);
    const result = await uninstall();
    expect(await fs.pathExists(SCRIPT)).toBe(true);
    expect((result.notes ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*kept[^\n]*\.claude\/settings\.local\.json/);
    guardWorks();
  });

  it.each([
    ['project', 'local', SETTINGS_LOCAL],
    ['local', 'project', SETTINGS],
  ] as const)('moving the guard from the %s file to the %s file leaves the script in place and the guard working', async (from, to, toFile) => {
    await installProject({ sessionGuard: from });
    await update({ sessionGuard: to });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect(await inspectSessionGuard(toFile)).toBe('wired');
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
    guardWorks();
  });

  it('moving while the target file already has the guard: the target is written first and recorded, the script stays, and no "kept" note is needed', async () => {
    await installProject({ sessionGuard: 'project' });
    await mergeSessionGuard(SETTINGS_LOCAL);
    const result = await update({ sessionGuard: 'local' });
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect((result.sessionGuardNotes ?? []).join('\n')).not.toMatch(/was kept/);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.local.json' });
    guardWorks();
  });

  it('a sibling settings file that could not be read is not claimed to have entries (point 5)', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.outputFile(SETTINGS_LOCAL, '{ // mine\n}');
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    expect(outcome).toMatchObject({ script: 'kept-shared', scriptSharedWith: SETTINGS_LOCAL, scriptSharedUnreadable: true });
    const note = sessionGuardScriptLeftNote(SETTINGS, outcome, abs => abs) ?? '';
    expect(note).toContain('could not be read');
    expect(note).toContain('kept');
    expect(note).not.toContain('still has hook entries');
  });
});

describe('a script that is not ours is never wired (point 1) and a script path that is not a readable file is the same (point 6)', () => {
  const FOREIGN = '// mine\nprocess.exit(0)\n';

  it('a fresh merge writes no entry and no settings file; the foreign script stays', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    const result = await mergeSessionGuard(SETTINGS);
    expect(result.status).toBe('script-edited');
    expect(result.script.status).toBe('modified');
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);
  });

  it('inline entries of ours stay exactly as they are: still guarding, still outdated', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    const before = await fs.readFile(SETTINGS, 'utf8');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('script-edited');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
  });

  it('a folder at the script path does not throw, reads as modified, is never deleted and never wired', async () => {
    await fs.ensureDir(SCRIPT);
    expect(await inspectSessionGuardScript(SETTINGS)).toBe('modified');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('script-edited');
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: false });
    expect(outcome.script).toBe('left-edited');
    expect((await fs.stat(SCRIPT)).isDirectory()).toBe(true);
    const note = sessionGuardScriptLeftNote(SETTINGS, outcome, abs => abs) ?? '';
    expect(note).toContain('edited by hand or cannot be read as a file');
  });

  it('install: nothing is written to the settings file, the output names the file and says the guard was not written, the doctor shows it', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    const result = await installProject({ sessionGuard: 'project' });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);
    const warnings = result.projections.flatMap(projection => projection.warnings ?? []).join('\n');
    expect(warnings).toMatch(/not written or renewed/);
    expect(warnings).toContain('.claude/hooks/agents-united-session-guard.js');
    expect(warnings).toMatch(/edited by hand/);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-modified');
    expect(report.warnings.join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*edited by hand/);
    expect(report.warnings.join('\n')).not.toMatch(/Run 'agents update' to restore it/);
  });

  it('update: an install with inline entries is not converted while a foreign script sits there, and the doctor shows it', async () => {
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    await fs.writeFile(SCRIPT, FOREIGN);
    const before = await fs.readFile(SETTINGS, 'utf8');
    const result = await update();
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(before);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);
    expect(result.projections.flatMap(projection => projection.warnings ?? []).join('\n')).toMatch(/not written or renewed/);
    expect((await doctor(PROJECT)).sessionGuard).toBe('script-modified');
  });

  it('update --session-guard says it was not written, not that it is on', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    await installProject({ fanout: ['claude'] });
    const result = await update({ sessionGuard: 'project' });
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).not.toMatch(/the session guard is on in/);
    expect(notes).toMatch(/not written or renewed/);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });
});

describe('a user-file entry whose only difference is the home folder is outdated and renewed (point 2)', () => {
  const OTHER = path.join(ROOT, 'other-home', '.claude', 'hooks', NAME);
  const withArgs = async (args: string[], extra: Json = {}): Promise<void> => {
    await fs.outputJson(
      USER_SETTINGS,
      { hooks: { PreToolUse: sessionGuardHooks('user').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [{ ...sessionGuardHandler('user'), args, ...extra }] })) } },
      { spaces: 2 },
    );
  };

  it('another absolute folder in front of the file name: outdated; merge renews it and writes the script under the current home', async () => {
    await withArgs([OTHER]);
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('outdated');
    expect((await mergeSessionGuard(USER_SETTINGS)).status).toBe('merged');
    expect((await groupsOf(USER_SETTINGS)).map(group => group.hooks[0])).toEqual([sessionGuardHandler('user'), sessionGuardHandler('user')]);
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
  });

  it('an extra key keeps it modified, a different file name is not ours, and a project file with an absolute path is modified', async () => {
    await withArgs([OTHER], { timeout: 5 });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('modified');
    await withArgs([path.join(ROOT, 'other-home', '.claude', 'hooks', 'other-session-guard.js')]);
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('missing');
    await withArgs([OTHER]);
    await fs.copy(USER_SETTINGS, SETTINGS);
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
  });

  it('a global install whose home folder changed: the doctor says outdated and agents update renews it, so guarded calls are not blocked on a missing file', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await withArgs([OTHER]);
    expect((await doctor(HOME)).sessionGuard).toBe('outdated');
    await installGlobal({});
    expect((await groupsOf(USER_SETTINGS))[0].hooks[0].args).toEqual([USER_SCRIPT]);
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await doctor(HOME)).sessionGuard).toBe('wired');
  });

  it('removal takes such an entry out too', async () => {
    await withArgs([OTHER]);
    expect(await removeOwnedSessionGuard(USER_SETTINGS, { createdFile: true })).toMatchObject({ status: 'deleted-file', left: 0 });
  });
});

describe('the doctor reports a missing script whenever any entry of ours names it (point 3)', () => {
  it.each([
    ['one group in the file form and one inline (outdated)', async () => {
      const settings = await fs.readJson(SETTINGS);
      settings.hooks.PreToolUse[1].hooks[0] = inline(sessionGuardScript('project'));
      await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    }, 'script-missing'],
    ['an extra key on the entry (modified)', async () => {
      const settings = await fs.readJson(SETTINGS);
      settings.hooks.PreToolUse[0].hooks[0].timeout = 5;
      await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    }, 'script-missing'],
  ])('%s', async (_name, change, expected) => {
    await installProject({ sessionGuard: 'project' });
    await change();
    await fs.remove(SCRIPT);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe(expected);
    expect(report.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));
    const warning = report.warnings.find(line => /Session guard script/.test(line)) ?? '';
    expect(warning).toContain('.claude/hooks/agents-united-session-guard.js');
    expect(warning).toContain('agents update --all');
    expect(warning).toMatch(/no way-out message/i);
  });

  it('entries that do not name the script (all inline) do not raise it', async () => {
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    await fs.remove(SCRIPT);
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('outdated');
    expect(report.warnings.join('\n')).not.toMatch(/Session guard script/);
  });
});

describe('agents update --session-guard reports the repair of the script file (point 4)', () => {
  it('re-creating a missing script is a change, and the note says so', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.remove(SCRIPT);
    const result = await update({ sessionGuard: 'project' });
    expect(result.sessionGuardChanged).toBe(1);
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/^Changed:/m);
    expect(notes).toMatch(/re-created/);
    expect(notes).not.toMatch(/Left as it was/);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('renewing an earlier text of the script is a change, and the note says so', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, `${EARLIER_SESSION_SCRIPTS[0]}\n`);
    const result = await update({ sessionGuard: true });
    expect(result.sessionGuardChanged).toBe(1);
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/renewed/);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('nothing to repair stays "Left as it was"', async () => {
    await installProject({ sessionGuard: 'project' });
    const result = await update({ sessionGuard: 'project' });
    expect(result.sessionGuardChanged).toBe(0);
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/Left as it was[^\n]*already on/);
  });
});

describe('the shared USER script has no reference count (point 9)', () => {
  it('removing the guard through the global install takes entries and script; the project install then sees it missing and its plain update leaves it missing', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await installProject({ sessionGuard: 'user' });
    expect(await fs.pathExists(USER_SCRIPT)).toBe(true);

    await update({ global: true, sessionGuard: false });
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect(await fs.pathExists(USER_SCRIPT)).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });

    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('missing');
    expect(report.sessionGuard).not.toBe('wired');

    await update();
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect(await fs.pathExists(USER_SCRIPT)).toBe(false);
    expect((await doctor(PROJECT)).sessionGuard).toBe('missing');
  });
});

describe('a move never leaves the guard unwired (round 2, point 1)', () => {
  const FOREIGN = '// mine\nprocess.exit(0)\n';
  const files = { project: SETTINGS, local: SETTINGS_LOCAL, user: USER_SETTINGS } as const;
  const scripts = { project: SCRIPT, local: SCRIPT, user: USER_SCRIPT } as const;
  const snapshot = async (file: string): Promise<string | undefined> => ((await fs.pathExists(file)) ? fs.readFile(file, 'utf8') : undefined);

  it.each([
    ['project', 'local'],
    ['local', 'project'],
    ['project', 'user'],
    ['user', 'project'],
  ] as const)('%s to %s: refused when the script at the TARGET is not ours; neither settings file nor the record changes, and the output says why', async (from, to) => {
    await installProject({ sessionGuard: from });
    await fs.outputFile(scripts[to], FOREIGN);
    const before = { from: await snapshot(files[from]), to: await snapshot(files[to]), lock: (await lock(PROJECT_LOCK)).sessionGuard };

    const result = await update({ sessionGuard: to });

    expect(await snapshot(files[from])).toBe(before.from);
    expect(await snapshot(files[to])).toBe(before.to);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual(before.lock);
    expect(await fs.readFile(scripts[to], 'utf8')).toBe(FOREIGN);
    expect(result.sessionGuardChanged).toBe(0);
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/not moved/);
    expect(notes).toMatch(/edited by hand/);
    expect(notes).toContain('agents-united-session-guard.js');
    expect(await inspectSessionGuard(files[from])).toBe('wired');
  });

  it('only the target\'s script decides: project to user succeeds when the PROJECT script is edited, and user to project when the USER script is', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, FOREIGN);
    await update({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);

    await fs.writeFile(USER_SCRIPT, FOREIGN);
    await fs.remove(SCRIPT);
    await update({ sessionGuard: 'project' });
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('a move with no edited script is made, as before', async () => {
    await installProject({ sessionGuard: 'project' });
    await update({ sessionGuard: 'local' });
    expect(await inspectSessionGuard(SETTINGS_LOCAL)).toBe('wired');
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.local.json' });
  });
});

describe('what the "not written" warning says about the entries there (round 2, point 1) and the advice for the user file (point 2)', () => {
  const FOREIGN = '// mine\nprocess.exit(0)\n';
  const warningsOf = (result: { projections: Array<{ warnings?: string[] }> }): string => result.projections.flatMap(projection => projection.warnings ?? []).join('\n');

  it('no entry of ours in the file: it says that nothing guards plain sessions there, and never claims an inline entry keeps guarding', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    const text = warningsOf(await installProject({ sessionGuard: 'project' }));
    expect(text).toMatch(/not written or renewed/);
    expect(text).toMatch(/nothing guards plain Claude sessions through \.claude\/settings\.json/);
    expect(text).not.toMatch(/keeps guarding/);
  });

  it('an inline entry of ours is there: the claim is made', async () => {
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    await fs.writeFile(SCRIPT, FOREIGN);
    const text = warningsOf(await update());
    expect(text).toMatch(/inline entry of ours already there keeps guarding as before/);
    expect(text).not.toMatch(/nothing guards/);
  });

  it('the user file with no entry: the sentence names the restore command, because a plain update does not re-create it', async () => {
    await fs.outputFile(USER_SCRIPT, FOREIGN);
    const globalText = warningsOf(await installGlobal({ sessionGuard: 'user' }));
    expect(globalText).toContain('agents update --all --global --session-guard user');
    const report = await doctor(HOME);
    expect(report.sessionGuard).toBe('script-modified');
    expect(report.warnings.join('\n')).toContain('agents update --all --global --session-guard user');
    expect(report.warnings.join('\n')).not.toMatch(/then run 'agents update'\./);
    expect(report.sessionGuardCommands?.restore).toBe('agents update --all --global --session-guard user');

    const projectText = warningsOf(await installProject({ sessionGuard: 'user' }));
    expect(projectText).toContain('agents update --all --session-guard user');
    expect(projectText).not.toContain('--global');
    expect((await doctor(PROJECT)).warnings.join('\n')).toContain('agents update --all --session-guard user');
  });

  it('a project file with no entry keeps the plain advice', async () => {
    await fs.outputFile(SCRIPT, FOREIGN);
    await installProject({ sessionGuard: 'project' });
    const text = (await doctor(PROJECT)).warnings.join('\n');
    expect(text).toMatch(/then run 'agents update'\./);
    expect(text).toMatch(/nothing guards plain Claude sessions/);
  });
});

describe('a script that is not ours, wired entries (round 2, point 3)', () => {
  it('the doctor says plainly that guarded calls may be allowed or blocked as that file decides', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, '// mine\nprocess.exit(0)\n');
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-modified');
    expect(report.warnings.join('\n')).toMatch(/guarded calls may be allowed or blocked/);
    expect(report.warnings.join('\n')).toMatch(/edited by hand/);
  });
});

describe('the sibling settings file cannot be read (round 2, point 4) and the kept note is true in both cases (point 5)', () => {
  it('a folder named like the sibling settings file does not abort the removal; the script is kept with the unreadable wording', async () => {
    await mergeSessionGuard(SETTINGS);
    await fs.ensureDir(SETTINGS_LOCAL);
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    expect(outcome).toMatchObject({ script: 'kept-shared', scriptSharedWith: SETTINGS_LOCAL, scriptSharedUnreadable: true });
    expect(await fs.pathExists(SCRIPT)).toBe(true);
  });

  it('uninstall and --no-session-guard do not abort either', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.ensureDir(SETTINGS_LOCAL);
    const result = await update({ sessionGuard: false });
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/could not be read/);
    await installProject({ sessionGuard: 'project' });
    const gone = await uninstall();
    expect((gone.notes ?? []).join('\n')).toMatch(/could not be read/);
    expect(await fs.pathExists(SCRIPT)).toBe(true);
  });

  it('the wording does not promise that a command removes it: entries no install recorded are removed by hand', async () => {
    await both();
    const outcome = await removeOwnedSessionGuard(SETTINGS, { createdFile: true });
    const note = sessionGuardScriptLeftNote(SETTINGS, outcome, abs => abs) ?? '';
    expect(note).toContain('still has hook entries that run it');
    expect(note).toContain('stays while that file has such entries');
    expect(note).toMatch(/entries there that no install recorded .* by hand/);
    expect(note).not.toContain('It goes when');
    async function both(): Promise<void> {
      await mergeSessionGuard(SETTINGS);
      await mergeSessionGuard(SETTINGS_LOCAL);
    }
  });
});

describe('agents update --all repairs the mixed states the doctor reports (round 2, point 7)', () => {
  it('outdated (inline) entries and a missing script: one update leaves a wired guard and a script', async () => {
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, inline(sessionGuardScript('project')));
    await fs.remove(path.dirname(SCRIPT));
    expect((await doctor(PROJECT)).sessionGuard).toBe('outdated');
    await update();
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
  });

  it('one group inline, one in the file form, and a missing script', async () => {
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(SETTINGS);
    settings.hooks.PreToolUse[1].hooks[0] = inline(sessionGuardScript('project'));
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    await fs.remove(SCRIPT);
    expect((await doctor(PROJECT)).sessionGuard).toBe('script-missing');
    await update();
    expect((await doctor(PROJECT)).sessionGuard).toBe('wired');
    expect((await groupsOf(SETTINGS)).map(group => group.hooks[0])).toEqual([sessionGuardHandler('project'), sessionGuardHandler('project')]);
  });
});

describe('the lockfile records the guard, the settings file holds nothing of ours, a foreign script sits at the path (round 2, point 7)', () => {
  const FOREIGN = '// mine\nprocess.exit(0)\n';
  const USER_CONTENT = { env: { KEEP: '1' } };
  const setup = async (): Promise<void> => {
    await fs.outputJson(SETTINGS, USER_CONTENT, { spaces: 2 });
    await fs.outputFile(SCRIPT, FOREIGN);
    await installProject({ sessionGuard: 'project' });
    expect(await fs.readJson(SETTINGS)).toEqual(USER_CONTENT);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.json' });
  };

  it('--no-session-guard deletes nothing of the user\'s, records off, and the notes name the script that was left', async () => {
    await setup();
    const result = await update({ sessionGuard: false });
    expect(await fs.readJson(SETTINGS)).toEqual(USER_CONTENT);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/^Changed:/m);
    expect(notes).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*left in place/);
  });

  it('uninstall deletes nothing of the user\'s, and the notes name the script that was left', async () => {
    await setup();
    const result = await uninstall();
    expect(await fs.readJson(SETTINGS)).toEqual(USER_CONTENT);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(FOREIGN);
    expect((result.notes ?? []).join('\n')).toMatch(/\.claude\/hooks\/agents-united-session-guard\.js[^\n]*left in place/);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toBeUndefined();
  });
});

describe('the recorded settings path and the current one differ only in case or slash style (round 2, point 8)', () => {
  it.skipIf(process.platform !== 'win32')('win32: that is not a move; nothing is removed or rewritten and no "moved" is printed', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const before = await fs.readFile(USER_SETTINGS, 'utf8');
    const old = await lock(HOME_LOCK);
    old.sessionGuard.file = USER_SETTINGS.toUpperCase().replace(/\\/g, '/');
    await fs.writeJson(HOME_LOCK, old, { spaces: 2 });

    const result = await installGlobal({});

    expect(result.projections.flatMap(projection => projection.warnings ?? []).join('\n')).not.toMatch(/moved/);
    expect(await fs.readFile(USER_SETTINGS, 'utf8')).toBe(before);
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await doctor(HOME)).sessionGuard).toBe('wired');
  });
});

describe('a move writes the target first; no failure of the target can leave the guard nowhere (round 3, point 1)', () => {
  type Place = 'project' | 'local' | 'user';
  const settingsOf: Record<Place, string> = { project: SETTINGS, local: SETTINGS_LOCAL, user: USER_SETTINGS };
  const scriptOf: Record<Place, string> = { project: SCRIPT, local: SCRIPT, user: USER_SCRIPT };
  const DIRECTIONS = [['project', 'local'], ['local', 'project'], ['project', 'user'], ['user', 'project']] as const;
  const snap = async (file: string): Promise<string | undefined> => {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' ? undefined : 'UNREADABLE';
    }
  };
  const canBlockWrites = process.platform === 'win32' || (typeof process.getuid === 'function' && process.getuid() !== 0);
  const REASONS = [
    ['an invalid-JSON target', 'invalid', /not valid JSON or cannot be read/],
    ['a folder as the target', 'folder', /not valid JSON or cannot be read/],
    ['a target that cannot be written', 'readonly', /writing there failed/],
  ] as const;
  const breakTarget = async (file: string, how: 'invalid' | 'folder' | 'readonly'): Promise<void> => {
    if (how === 'invalid') await fs.outputFile(file, '{ // mine\n}');
    else if (how === 'folder') await fs.ensureDir(file);
    else {
      await fs.outputFile(file, '{}\n');
      await fs.chmod(file, 0o444);
    }
  };
  const unbreak = async (file: string): Promise<void> => {
    await fs.chmod(file, 0o666).catch(() => undefined);
  };
  const state = async (from: Place, to: Place) => ({
    fromSettings: await snap(settingsOf[from]),
    toSettings: await snap(settingsOf[to]),
    fromScript: await snap(scriptOf[from]),
    toScript: await snap(scriptOf[to]),
    record: (await lock(PROJECT_LOCK)).sessionGuard,
  });

  for (const [name, how, reason] of REASONS) {
    // A root user on Linux can write to a read-only file: those cases are skipped there, not passed.
    (how === 'readonly' && !canBlockWrites ? it.skip : it).each(DIRECTIONS)(`${name}: %s to %s is refused, nothing changes on disk, and nothing new is left in the target`, async (from, to) => {
      await installProject({ sessionGuard: from });
      await breakTarget(settingsOf[to], how);
      const before = await state(from, to);
      try {
        const result = await update({ sessionGuard: to });
        expect(await state(from, to)).toEqual(before);
        expect(result.sessionGuardChanged).toBe(0);
        const notes = (result.sessionGuardNotes ?? []).join('\n');
        expect(notes).toMatch(/not moved/);
        expect(notes).toMatch(reason);
        expect(await inspectSessionGuard(settingsOf[from])).toBe('wired');
      } finally {
        if (how === 'readonly') await unbreak(settingsOf[to]);
      }
    });
  }

  it.each([
    ['a foreign script', 'script'],
    ['an invalid-JSON target', 'invalid'],
  ] as const)('install time (agents add --session-guard <other place>), %s: the move is refused with a message, disk and record unchanged', async (_name, how) => {
    for (const [from, to] of [['project', 'local'], ['project', 'user']] as const) {
      await fs.remove(ROOT);
      await fs.ensureDir(HOME);
      await fs.ensureDir(PROJECT);
      await installProject({ sessionGuard: from });
      if (how === 'script') await fs.outputFile(scriptOf[to], '// mine\nprocess.exit(0)\n');
      else await breakTarget(settingsOf[to], 'invalid');
      const before = await state(from, to);
      const result = await installProject({ sessionGuard: to });
      expect(await state(from, to)).toEqual(before);
      const text = result.projections.flatMap(projection => projection.warnings ?? []).join('\n');
      expect(text).toMatch(/not moved/);
      expect(text).toMatch(how === 'script' ? /edited by hand/ : /not valid JSON or cannot be read/);
    }
  });

  it.each(DIRECTIONS)('the successful move %s to %s: entries and script in the target only, the earlier place stripped, one working script', async (from, to) => {
    await installProject({ sessionGuard: from });
    const result = await update({ sessionGuard: to });
    expect(await inspectSessionGuard(settingsOf[to])).toBe('wired');
    expect(await inspectSessionGuardScript(settingsOf[to])).toBe('present');
    expect(await fs.pathExists(settingsOf[from])).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: to === 'user' ? USER_SETTINGS : `.claude/settings${to === 'local' ? '.local' : ''}.json` });
    if (scriptOf[from] !== scriptOf[to]) expect(await fs.pathExists(scriptOf[from])).toBe(false);
    expect(runScript(scriptOf[to], bashCall('git push --force origin main')).status).toBe(2);
    expect(runScript(scriptOf[to], bashCall('git status --short')).status).toBe(0);
    expect((result.sessionGuardNotes ?? []).join('\n')).not.toMatch(/was kept/);
  });
});

describe('skipped-invalid has its own output (round 3, point 2)', () => {
  it('update --session-guard says the guard is not on, on the first and on the next run', async () => {
    await installProject({ fanout: ['claude'] });
    await fs.outputFile(SETTINGS, '{ // mine\n}');
    for (let run = 0; run < 2; run += 1) {
      const result = await update({ sessionGuard: 'project' });
      const notes = (result.sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/the session guard is not on in/);
      expect(notes).not.toMatch(/is on in|already on/);
      expect(notes).toMatch(/not valid JSON/);
      expect(notes).toMatch(/paste/i);
    }
  });
});

describe('"keeps guarding as before" is said only of an entry that is exactly an earlier form (round 3, point 3)', () => {
  it('an inline entry edited by hand (an extra key): the warning says it was edited by hand and what it allows is not known', async () => {
    await writeInlineSettings(SETTINGS, { ...inline(sessionGuardScript('project')), async: true });
    await fs.outputFile(SCRIPT, '// mine\nprocess.exit(0)\n');
    const result = await installProject({ sessionGuard: 'project' });
    const text = result.projections.flatMap(projection => projection.warnings ?? []).join('\n');
    expect(text).not.toMatch(/keeps guarding/);
    expect(text).toMatch(/edited by hand and what it allows is not known/);
  });
});

describe('removal that leaves a hand-edited entry says the script was left as well (round 3, point 4)', () => {
  it('--no-session-guard and uninstall', async () => {
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(SETTINGS);
    settings.hooks.PreToolUse[0].hooks[0].async = true;
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    const result = await update({ sessionGuard: false });
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/script[^\n]*left in place as well[^\n]*edited entry/);
    expect(await fs.pathExists(SCRIPT)).toBe(true);

    await installProject({ sessionGuard: 'project' });
    const again = await fs.readJson(SETTINGS);
    again.hooks.PreToolUse[0].hooks[0].async = true;
    await fs.writeJson(SETTINGS, again, { spaces: 2 });
    const gone = await uninstall();
    expect((gone.notes ?? []).join('\n')).toMatch(/script[^\n]*left in place as well[^\n]*edited entry/);
  });
});

describe('sameSessionGuardPath is platform independent (round 3, point 5)', () => {
  it('Windows: letter case and slash style do not matter', () => {
    expect(sameSessionGuardPath('C:\\Users\\Me\\.claude\\settings.json', 'c:/users/me/.claude/settings.json', undefined, 'win32')).toBe(true);
    expect(sameSessionGuardPath('C:\\Users\\Me\\a.json', 'C:\\Users\\Me\\b.json', undefined, 'win32')).toBe(false);
    expect(sameSessionGuardPath('.claude\\settings.json', '.claude/settings.json', 'C:\\proj', 'win32')).toBe(true);
  });
  it('elsewhere: letter case matters, `.` and `..` do not', () => {
    expect(sameSessionGuardPath('/Users/Me/.claude/settings.json', '/users/me/.claude/settings.json', undefined, 'linux')).toBe(false);
    expect(sameSessionGuardPath('/home/me/x/../.claude/settings.json', '/home/me/.claude/settings.json', undefined, 'linux')).toBe(true);
    expect(sameSessionGuardPath('.claude/settings.json', '/work/p/.claude/settings.json', '/work/p', 'linux')).toBe(true);
  });
});

describe('earlier and target are one physical file under two names (round 4, point 1)', () => {
  const canFileSymlink = ((): boolean => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'sg-probe-'));
    try {
      fsSync.writeFileSync(path.join(dir, 't'), 'x');
      fsSync.symlinkSync(path.join(dir, 't'), path.join(dir, 'l'), 'file');
      return true;
    } catch {
      return false;
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  })();
  const repoint = async (recordedPath: string): Promise<void> => {
    const old = await lock(HOME_LOCK);
    old.sessionGuard.file = recordedPath;
    await fs.writeJson(HOME_LOCK, old, { spaces: 2 });
  };
  const expectUntouched = async (before: string, warnings: string): Promise<void> => {
    expect(warnings).not.toMatch(/moved/);
    expect(await fs.readFile(USER_SETTINGS, 'utf8')).toBe(before);
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect((await lock(HOME_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });
    expect((await doctor(HOME)).sessionGuard).toBe('wired');
  };

  it('a linked home folder (a directory junction, which needs no privilege on Windows): entries and script stay, the record points at the current path', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const before = await fs.readFile(USER_SETTINGS, 'utf8');
    const link = path.join(ROOT, 'homelink');
    fsSync.symlinkSync(HOME, link, 'junction');
    await repoint(path.join(link, '.claude', 'settings.json'));
    const result = await installGlobal({});
    await expectUntouched(before, result.projections.flatMap(projection => projection.warnings ?? []).join('\n'));
  });

  it.skipIf(!canFileSymlink)('a symlinked settings file: entries and script stay, the record points at the current path', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const before = await fs.readFile(USER_SETTINGS, 'utf8');
    const link = path.join(ROOT, 'settings-link.json');
    fsSync.symlinkSync(USER_SETTINGS, link, 'file');
    await repoint(link);
    const result = await installGlobal({});
    await expectUntouched(before, result.projections.flatMap(projection => projection.warnings ?? []).join('\n'));
  });

  it('a different file is still a move', async () => {
    await installProject({ sessionGuard: 'project' });
    await update({ sessionGuard: 'local' });
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.local.json' });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });
});

describe('a merge status is not proof that the target guards (round 4, point 2)', () => {
  const edited = (extra: Json = {}): Json => ({ ...sessionGuardHandler('project'), async: true, ...extra });
  const oneGroupEdited = (which: number) => ({
    hooks: { PreToolUse: [sessionGuardHooks('project').PreToolUse[which]].map(group => ({ matcher: group.matcher, hooks: [edited()] })) },
  });
  const bothEdited = () => ({
    hooks: { PreToolUse: sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [edited()] })) },
  });
  const snap = async (file: string): Promise<string | undefined> => ((await fs.pathExists(file)) ? fs.readFile(file, 'utf8') : undefined);

  it.each([
    ['project', 'local', SETTINGS, SETTINGS_LOCAL, SCRIPT, 0],
    ['project', 'local', SETTINGS, SETTINGS_LOCAL, SCRIPT, 1],
    ['project', 'user', SETTINGS, USER_SETTINGS, USER_SCRIPT, 0],
  ] as const)('%s to %s, the target has one of the two groups edited by hand: refused, the group the merge would add is not left in the target, nothing else changes', async (from, to, fromFile, toFile, toScript, which) => {
    await installProject({ sessionGuard: from });
    await fs.outputJson(toFile, oneGroupEdited(which), { spaces: 2 });
    const before = { from: await snap(fromFile), to: await snap(toFile), script: await snap(toScript), record: (await lock(PROJECT_LOCK)).sessionGuard };
    const result = await update({ sessionGuard: to });
    expect(await snap(fromFile)).toBe(before.from);
    expect(await snap(toFile)).toBe(before.to);
    expect(await snap(toScript)).toBe(before.script);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual(before.record);
    expect(result.sessionGuardChanged).toBe(0);
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/not moved[^\n]*holds hook entries of ours that were edited by hand/);
    expect(await inspectSessionGuard(fromFile)).toBe('wired');
  });

  it('a fully hand-edited target is refused too, with both files, the script and the record unchanged', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.outputJson(SETTINGS_LOCAL, bothEdited(), { spaces: 2 });
    const before = { from: await snap(SETTINGS), to: await snap(SETTINGS_LOCAL), script: await snap(SCRIPT), record: (await lock(PROJECT_LOCK)).sessionGuard };
    const result = await update({ sessionGuard: 'local' });
    expect(await snap(SETTINGS)).toBe(before.from);
    expect(await snap(SETTINGS_LOCAL)).toBe(before.to);
    expect(await snap(SCRIPT)).toBe(before.script);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual(before.record);
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/not moved/);
  });

  it('a refused move that re-created the missing shared script says so; "Nothing was changed" is not said then', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.remove(SCRIPT);
    await fs.outputFile(SETTINGS_LOCAL, '{ // mine\n}');
    const result = await update({ sessionGuard: 'local' });
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/not moved/);
    expect(notes).toMatch(/was missing and was re-created/);
    expect(notes).toMatch(/which the entries in \.claude\/settings\.json run, was missing/);
    expect(notes).toMatch(/^Changed:/m);
    expect(result.sessionGuardChanged).toBe(1);
    expect(notes).not.toMatch(/Nothing was changed/);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('project'));
    expect(await fs.readFile(SETTINGS_LOCAL, 'utf8')).toBe('{ // mine\n}');
  });
});

describe('the strip of the earlier file can throw after the target is written (round 4, point 3)', () => {
  const canBlockWrites = process.platform === 'win32' || (typeof process.getuid === 'function' && process.getuid() !== 0);
  it.skipIf(!canBlockWrites)('a read-only earlier file: the target holds the guard, the record goes to the target, the output names the file that still holds entries', async () => {
    await fs.outputJson(SETTINGS, { env: { A: '1' } }, { spaces: 2 });
    await installProject({ sessionGuard: 'project' });
    const earlierBytes = await fs.readFile(SETTINGS, 'utf8');
    await fs.chmod(SETTINGS, 0o444);
    try {
      const result = await update({ sessionGuard: 'local' });
      expect(await fs.readFile(SETTINGS, 'utf8')).toBe(earlierBytes);
      expect(await inspectSessionGuard(SETTINGS_LOCAL)).toBe('wired');
      expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.local.json' });
      const notes = (result.sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/could not be removed/);
      expect(notes).toContain(SETTINGS);
      expect(notes).toMatch(/by hand/);
      expect(notes).not.toMatch(/not moved/);
    } finally {
      await fs.chmod(SETTINGS, 0o666).catch(() => undefined);
    }
  });
});

describe('the teammate warning follows the state of the entries (round 4, point 4)', () => {
  const LABEL = '.claude/hooks/agents-united-session-guard.js';
  it('no entry of ours (missing or absent) and a script that is not ours: not installed, and why a command will not write it', () => {
    for (const entryState of ['missing', 'absent'] as const) {
      const text = teammateGuardClause({ team: 'digital-agency', sessionGuard: 'script-modified', entryState, scriptLabel: LABEL });
      expect(text).toMatch(/which is not installed/);
      expect(text).toContain(LABEL);
      expect(text).toMatch(/not ours/);
      expect(text).toMatch(/agents update will not write it/);
      expect(text).not.toMatch(/installed but not in effect/);
    }
  });
  it('earlier FILE-form entries run the file that is not ours: what it allows is not known, not "keeps guarding"', () => {
    const text = teammateGuardClause({ team: 'digital-agency', sessionGuard: 'script-modified', entryState: 'outdated', entriesKind: 'file', scriptLabel: LABEL });
    expect(text).toMatch(/what it allows is not known/);
    expect(text).not.toMatch(/keeps guarding/);
    expect(text).toContain(LABEL);
  });
  it('earlier inline entries and a script that is not ours: they keep guarding, renewal is blocked', () => {
    const text = teammateGuardClause({ team: 'digital-agency', sessionGuard: 'script-modified', entryState: 'outdated', entriesKind: 'inline', scriptLabel: LABEL });
    expect(text).toMatch(/earlier form that keeps guarding/);
    expect(text).toMatch(/renewal is blocked/);
    expect(text).toContain(LABEL);
    expect(text).not.toMatch(/not installed/);
  });
  it('wired entries and a script edited by hand: installed but not in effect', () => {
    const text = teammateGuardClause({ team: 'digital-agency', sessionGuard: 'script-modified', entryState: 'wired', scriptLabel: LABEL });
    expect(text).toMatch(/installed but not in effect/);
    expect(text).toMatch(/script file was edited by hand/);
  });
  it('no guard at all keeps the original wording and command', () => {
    expect(teammateGuardClause({ team: 'digital-agency', sessionGuard: undefined, entryState: undefined, scriptLabel: LABEL })).toMatch(/which is not installed\. Run: agents update digital-agency --session-guard to add it\./);
  });
});

describe('smaller points (round 4)', () => {
  it('skipped-invalid names the script file the merge wrote', async () => {
    await installProject({ fanout: ['claude'] });
    await fs.outputFile(SETTINGS, '{ // mine\n}');
    const first = (await update({ sessionGuard: 'project' })).sessionGuardNotes ?? [];
    expect(first.join('\n')).toMatch(/Its script file \.claude\/hooks\/agents-united-session-guard\.js was written/);
    expect(first.join('\n')).toMatch(/^Changed:/m);
  });

  it('the doctor calls a hash-only outdated inline entry an earlier form, not an edited one', async () => {
    const hashOf = (handler: object): string => crypto.createHash('sha256').update(JSON.stringify(handler)).digest('hex').slice(0, 16);
    const unknownForm = { type: 'command', command: 'node', args: ['-e', 'process.stderr.write("Blocked by agents-united guard: an earlier wording");process.exit(2)'], legacy: true };
    await installProject({ sessionGuard: 'project' });
    await writeInlineSettings(SETTINGS, unknownForm);
    const old = await lock(PROJECT_LOCK);
    old.sessionGuard.handlerHash = hashOf(unknownForm);
    await fs.writeJson(PROJECT_LOCK, old, { spaces: 2 });
    await fs.writeFile(SCRIPT, '// mine\nprocess.exit(0)\n');
    const report = await doctor(PROJECT);
    expect(report.sessionGuard).toBe('script-modified');
    const text = report.warnings.join('\n');
    expect(text).toMatch(/an earlier form and stay as they are, and they keep guarding/);
    expect(text).not.toMatch(/what it allows is not known/);
  });
});

describe('the same user file under two names when it does not exist yet (round 5, point 1)', () => {
  const link = path.join(ROOT, 'homelink');
  const linkedSettings = path.join(link, '.claude', 'settings.json');
  const setup = async (): Promise<void> => {
    await installGlobal({ sessionGuard: 'user' });
    fsSync.symlinkSync(HOME, link, 'junction');
    const old = await lock(HOME_LOCK);
    old.sessionGuard.file = linkedSettings;
    await fs.writeJson(HOME_LOCK, old, { spaces: 2 });
    await fs.remove(USER_SETTINGS);
  };
  const warningsOf = (result: { projections: Array<{ warnings?: string[] }> }): string => result.projections.flatMap(projection => projection.warnings ?? []).join('\n');

  it('(a) a plain update leaves it absent, as for the same path spelled one way, and does not say moved', async () => {
    await setup();
    const text = warningsOf(await installGlobal({}));
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect(text).not.toMatch(/Session guard moved|not moved/);
    expect(text).toContain('agents update --all --global --session-guard user');
  });

  it('(b) --session-guard user writes it once; entries, script and record are there afterwards; no moved text', async () => {
    await setup();
    const text = warningsOf(await installGlobal({ sessionGuard: 'user' }));
    expect(text).not.toMatch(/Session guard moved|not moved/);
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect(await fs.readFile(USER_SCRIPT, 'utf8')).toBe(sessionGuardScriptContent('user'));
    expect((await lock(HOME_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });
    expect((await doctor(HOME)).sessionGuard).toBe('wired');
  });
});

describe('messages of a refused or partly failed move that could be false (round 5, point 2)', () => {
  it('a refused move puts back a script it renewed, so Nothing was changed is true', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(SCRIPT, `${EARLIER_SESSION_SCRIPTS[0]}\n`);
    await fs.outputFile(SETTINGS_LOCAL, '{ // mine\n}');
    // An install, not an update: an update goes on to renew the outdated script of the recorded place after the refused step, as it should.
    const result = await installProject({ sessionGuard: 'local' });
    const notes = result.projections.flatMap(projection => projection.warnings ?? []).join('\n');
    expect(notes).toMatch(/Nothing was changed/);
    expect(await fs.readFile(SCRIPT, 'utf8')).toBe(`${EARLIER_SESSION_SCRIPTS[0]}\n`);
  });

  it('a target that cannot be put back is named, and Nothing was changed is not said', async () => {
    await installProject({ sessionGuard: 'project' });
    const partly = { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ ...sessionGuardHandler('project'), async: true }] }] } };
    await fs.outputJson(SETTINGS_LOCAL, partly, { spaces: 2 });
    const real = fs.writeFile.bind(fs) as (...args: unknown[]) => Promise<void>;
    let writes = 0;
    const spy = vi.spyOn(fs, 'writeFile').mockImplementation(((...args: unknown[]) => {
      if (path.resolve(String(args[0])) === path.resolve(SETTINGS_LOCAL) && ++writes === 2) return Promise.reject(new Error('locked by another program'));
      return real(...args);
    }) as never);
    try {
      const notes = ((await update({ sessionGuard: 'local' })).sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/not moved/);
      expect(notes).toMatch(/could not be restored/);
      expect(notes).toContain('.claude/settings.local.json');
      expect(notes).toMatch(/locked by another program/);
      expect(notes).not.toMatch(/Nothing was changed/);
      expect(notes).not.toMatch(/Left as it was/);
      expect(notes.split('\n')[0]).toMatch(/could not be restored/);
    } finally {
      spy.mockRestore();
    }
  });

  const failScriptRemoval = () => {
    const real = fs.remove.bind(fs) as (...args: unknown[]) => Promise<void>;
    return vi.spyOn(fs, 'remove').mockImplementation(((...args: unknown[]) =>
      path.resolve(String(args[0])) === path.resolve(SCRIPT) ? Promise.reject(new Error('script is in use')) : real(...args)) as never);
  };

  it('--no-session-guard: the entries are removed and the script could not be; the output says exactly that', async () => {
    await installProject({ sessionGuard: 'project' });
    const spy = failScriptRemoval();
    try {
      const notes = ((await update({ sessionGuard: false })).sessionGuardNotes ?? []).join('\n');
      expect(await fs.pathExists(SETTINGS)).toBe(false);
      expect(notes).toMatch(/script[^\n]*could not be removed[^\n]*script is in use/);
      expect(notes).not.toMatch(/entries[^\n]*could not be removed/);
    } finally {
      spy.mockRestore();
    }
  });

  it('a move whose strip removed the entries but not the script: the warning does not say the entries stayed', async () => {
    await installProject({ sessionGuard: 'project' });
    const spy = failScriptRemoval();
    try {
      const result = await update({ sessionGuard: 'user' });
      const notes = (result.sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/our entries were removed from/);
      expect(notes).toMatch(/script[^\n]*could not be removed/);
      expect(notes).not.toMatch(/entries in [^\n]* could not be removed/);
      expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('last notes of a refused move (round 6)', () => {
  const real = (): ((...args: unknown[]) => Promise<void>) => fs.remove.bind(fs) as (...args: unknown[]) => Promise<void>;
  const partlyEdited = { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ ...sessionGuardHandler('user'), async: true }] }] } };

  it('1. the re-created sentence names the file that really uses the script: the sibling of the target, not the earlier file', async () => {
    await installProject({ sessionGuard: 'user' });
    await mergeSessionGuard(SETTINGS_LOCAL);
    await fs.remove(SCRIPT);
    await fs.outputFile(SETTINGS, '{ // mine\n}');
    const notes = ((await update({ sessionGuard: 'project' })).sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/not moved/);
    expect(notes).toMatch(/which the entries in \.claude\/settings\.local\.json run, was missing and was re-created/);
    expect(notes).not.toMatch(/which the entries in [^\n]*home[^\n]* run/);
  });

  it('1. an unreadable sibling is named as such, with no claim about the earlier file', async () => {
    await installProject({ sessionGuard: 'user' });
    await fs.remove(SCRIPT);
    await fs.outputFile(SETTINGS_LOCAL, '{ // mine\n}');
    await fs.outputFile(SETTINGS, '{ // mine\n}');
    const notes = ((await update({ sessionGuard: 'project' })).sessionGuardNotes ?? []).join('\n');
    expect(notes).toMatch(/\.claude\/settings\.local\.json may run[^\n]*could not be read[^\n]*was missing and was re-created/);
    expect(notes).not.toMatch(/which the entries in [^\n]*home[^\n]* run/);
  });

  it('2. when the target could not be put back, the script it names is not removed', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.outputJson(USER_SETTINGS, partlyEdited, { spaces: 2 });
    const write = fs.writeFile.bind(fs) as (...args: unknown[]) => Promise<void>;
    let writes = 0;
    const spy = vi.spyOn(fs, 'writeFile').mockImplementation(((...args: unknown[]) => {
      if (path.resolve(String(args[0])) === path.resolve(USER_SETTINGS) && ++writes === 2) return Promise.reject(new Error('locked by another program'));
      return write(...args);
    }) as never);
    try {
      const notes = ((await update({ sessionGuard: 'user' })).sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/could not be restored/);
      expect(await fs.pathExists(USER_SCRIPT)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('3. a script that could not be taken back does not throw out of the step: a sentence, and the install still writes its lockfile', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.outputFile(USER_SETTINGS, '{ // mine\n}');
    const remove = real();
    const spy = vi.spyOn(fs, 'remove').mockImplementation(((...args: unknown[]) =>
      path.resolve(String(args[0])) === path.resolve(USER_SCRIPT) ? Promise.reject(new Error('script is in use')) : remove(...args)) as never);
    try {
      const result = await installProject({ sessionGuard: 'user' });
      const text = result.projections.flatMap(projection => projection.warnings ?? []).join('\n');
      expect(text).toMatch(/not moved/);
      expect(text).toMatch(/script[^\n]*could not be removed[^\n]*script is in use/);
      expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.json' });
    } finally {
      spy.mockRestore();
    }
  });

  it('4. the script-removal note says no entry was present when none was', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeJson(SETTINGS, {});
    const remove = real();
    const spy = vi.spyOn(fs, 'remove').mockImplementation(((...args: unknown[]) =>
      path.resolve(String(args[0])) === path.resolve(SCRIPT) ? Promise.reject(new Error('script is in use')) : remove(...args)) as never);
    try {
      const notes = ((await update({ sessionGuard: false })).sessionGuardNotes ?? []).join('\n');
      expect(notes).toMatch(/script[^\n]*could not be removed/);
      expect(notes).toMatch(/no entries of ours were present/);
      expect(notes).not.toMatch(/the entries were removed/);
    } finally {
      spy.mockRestore();
    }
  });
});
