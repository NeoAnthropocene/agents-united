import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionGuardStateLabel } from '../src/cli.js';
import { DoctorEngine } from '../src/core/doctor.js';
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
  sessionGuardScriptPath,
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
    expect(forced.stderr).toBe('Blocked by agents-united guard: git push --force requires explicit human approval outside the agent session.\n');
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
