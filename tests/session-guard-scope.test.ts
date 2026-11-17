import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionGuardCommandLines } from '../src/cli.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import {
  inspectSessionGuard,
  sessionGuardCommands,
  sessionGuardHooks,
  sessionGuardReach,
  sessionGuardScript,
} from '../src/core/session-guard.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';

/**
 * Which commands a session guard names and which install a command reaches: the guard in the user settings file recorded by a project
 * install, `agents update --no-session-guard` limited to the scope it addresses, an honest report when nothing matched, and the uninstall
 * that removes only what is ours. The home directory is faked, so the real ~/.claude is never touched; no real Claude session is started.
 */

const ROOT = path.join(os.tmpdir(), `agents-united-guard-scope-${process.pid}`);
const HOME = path.join(ROOT, 'home');
const PROJECT = path.join(ROOT, 'project');
const PROJECT_LOCK = path.join(PROJECT, '.agents', 'agents-united.json');
const HOME_LOCK = path.join(HOME, '.agents', 'agents-united.json');
const PROJECT_SETTINGS = path.join(PROJECT, '.claude', 'settings.json');
const USER_SETTINGS = path.join(HOME, '.claude', 'settings.json');

type Json = Record<string, any>;
const install = (dir: string, opts: Json = {}) =>
  new InstallEngine().install('software-engineering', { targetDir: path.join(dir, '.agents'), method: 'copy', fanout: ['claude'], ...opts } as never);
const installProject = (opts: Json = {}) => install(PROJECT, opts);
const installGlobal = (opts: Json = {}) => install(HOME, { scope: 'global', ...opts });
const update = (opts: Json = {}, target: string = '__all__') => new UpdateEngine().update(target, { hosts: ['agents'], cwd: PROJECT, ...opts } as never);
const lock = async (file: string): Promise<Json> => fs.readJson(file);
const groupsOf = async (file: string): Promise<Array<{ matcher: string; hooks: Json[] }>> => (await fs.readJson(file)).hooks?.PreToolUse ?? [];
const scriptIn = async (file: string): Promise<string> => (await groupsOf(file))[0].hooks[0].args[1];
const blockMessage = (script: string): string => spawnSync(process.execPath, ['-e', script], { input: 'null', encoding: 'utf8' }).stderr;
const cliRun = (cwd: string, args: string[]) => {
  const env: Record<string, string | undefined> = { ...process.env, HOME, USERPROFILE: HOME };
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  const result = spawnSync(process.execPath, [path.resolve('dist/cli.js'), ...args], { cwd, encoding: 'utf8', env: env as NodeJS.ProcessEnv, timeout: 120000 });
  return { status: result.status, text: `${result.stdout}\n${result.stderr}` };
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

describe('A: the commands follow the scope of the install that recorded the guard', () => {
  it('the three states and their commands', () => {
    expect(sessionGuardReach('project', 'project')).toBe('project');
    expect(sessionGuardReach('local', 'project')).toBe('project');
    expect(sessionGuardReach('user', 'global')).toBe('user');
    expect(sessionGuardReach('user', 'project')).toBe('user-project');
    expect(sessionGuardCommands('user-project')).toEqual({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard' });
    expect(sessionGuardCommands('user')).toEqual({ repair: 'agents update --all --global', remove: 'agents update --all --global --no-session-guard' });
  });

  it('a user-file guard recorded by a project install names commands without --global and says where to run them', async () => {
    await installProject({ sessionGuard: 'user' });
    const message = blockMessage(await scriptIn(USER_SETTINGS));
    expect(message).toContain('agents update --all (repairs the install)');
    expect(message).toContain('agents update --all --no-session-guard (removes the session guard)');
    expect(message).not.toContain('--global');
    expect(message).toMatch(/from the folder of the project that installed this guard/);
    expect(message).toMatch(/in your own terminal, not in this session/);

    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('wired');
    expect(report.sessionGuardCommands).toEqual({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard', folder: path.resolve(PROJECT) });
  });

  it('a user-file guard recorded by a global install names --global and no folder', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const message = blockMessage(await scriptIn(USER_SETTINGS));
    expect(message).toContain('agents update --all --global (repairs the install)');
    expect(message).toContain('agents update --all --global --no-session-guard (removes the session guard)');
    expect(message).not.toMatch(/project that installed/);

    const report = await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('wired');
    expect(report.sessionGuardCommands).toEqual(sessionGuardCommands('user'));
  });

  it('a project guard names the plain commands, as before', async () => {
    await installProject({ sessionGuard: 'project' });
    const message = blockMessage(await scriptIn(PROJECT_SETTINGS));
    expect(message).toContain('agents update --all (repairs the install)');
    expect(message).not.toContain('--global');
    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuardCommands).toEqual(sessionGuardCommands('project'));
  });

  it('the user settings file is shared: either install sees it wired, and the last one to write decides which pair the message names', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await installProject({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect(blockMessage(await scriptIn(USER_SETTINGS))).toMatch(/project that installed this guard/);
    expect((await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude')).sessionGuard).toBe('wired');
    expect((await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude')).sessionGuard).toBe('wired');
    expect((await groupsOf(USER_SETTINGS)).map(group => group.matcher)).toEqual(sessionGuardHooks('user').PreToolUse.map(group => group.matcher));

    await installGlobal({});
    expect(blockMessage(await scriptIn(USER_SETTINGS))).toContain('agents update --all --global');
  });

  it('the doctor prints the folder of a project-recorded user guard', () => {
    const lines = sessionGuardCommandLines({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard', folder: '/work/app' });
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('/work/app');
    expect(sessionGuardCommandLines({ repair: 'a', remove: 'b' })).toHaveLength(2);
  });

  it('the three scripts differ only in the way-out text', () => {
    const strip = (script: string): string => script.slice(script.indexOf('let s='));
    expect(sessionGuardScript('user-project')).not.toBe(sessionGuardScript('user'));
    expect(sessionGuardScript('user-project')).not.toBe(sessionGuardScript('project'));
    expect(sessionGuardScript('user-project')).toContain('Blocked by agents-united guard');
    expect(strip(sessionGuardScript('project')).length).toBeGreaterThan(0);
  });
});

describe('B: --no-session-guard reaches only the scope the command addresses', () => {
  it('without --global the global lockfile and the home settings file are left alone, and the notes say which is which', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await installProject({ sessionGuard: 'project' });
    const homeGuard = (await lock(HOME_LOCK)).sessionGuard;
    const homeGroups = await groupsOf(USER_SETTINGS);

    const result = await update({ sessionGuard: false });

    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
    expect(await fs.pathExists(PROJECT_SETTINGS)).toBe(false);
    expect((await lock(HOME_LOCK)).sessionGuard).toEqual(homeGuard);
    expect(await groupsOf(USER_SETTINGS)).toEqual(homeGroups);
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect(result.sessionGuardChanged).toBe(1);

    const lines = (result.sessionGuardNotes ?? []).join('\n').split('\n');
    expect(lines.some(line => line.startsWith('Changed:') && line.includes(PROJECT_LOCK) && line.includes('project scope'))).toBe(true);
    expect(lines.some(line => line.startsWith('Left as it was:') && line.includes(HOME_LOCK) && line.includes('global scope') && line.includes('--global'))).toBe(true);
    expect(lines.some(line => line.startsWith('Changed:') && line.includes(HOME_LOCK))).toBe(false);
  });

  it('with --global only the global lockfile is changed', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await installProject({ sessionGuard: 'project' });
    const projectGuard = (await lock(PROJECT_LOCK)).sessionGuard;

    const result = await update({ global: true, sessionGuard: false });

    expect((await lock(HOME_LOCK)).sessionGuard).toEqual({ off: true });
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual(projectGuard);
    expect(await inspectSessionGuard(PROJECT_SETTINGS)).toBe('wired');
    expect(result.sessionGuardChanged).toBe(1);
  });

  it('a lockfile that records no guard and has no Claude lane gets no "off" recorded', async () => {
    await installProject({ fanout: ['cline'] });
    expect((await lock(PROJECT_LOCK)).sessionGuard).toBeUndefined();
    const result = await update({ sessionGuard: false });
    expect((await lock(PROJECT_LOCK)).sessionGuard).toBeUndefined();
    expect(result.sessionGuardChanged).toBe(0);
    expect((result.sessionGuardNotes ?? []).join('\n')).toMatch(/Left as it was:[^\n]*no session guard[^\n]*no Claude lane/);
  });

  it('a lockfile with a Claude lane but no earlier decision does record the "no"', async () => {
    await installProject({});
    expect((await lock(PROJECT_LOCK)).sessionGuard).toBeUndefined();
    const result = await update({ sessionGuard: false });
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
    expect(result.sessionGuardChanged).toBe(1);
  });

  it('a user-file guard recorded by this project is removed from the home file, and the note says that file is shared', async () => {
    await installProject({ sessionGuard: 'user' });
    const result = await update({ sessionGuard: false });
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    const notes = (result.sessionGuardNotes ?? []).join('\n');
    expect(notes).toContain(USER_SETTINGS);
    expect(notes).toMatch(/shared by every project/);
  });

  it('--session-guard turns the guard on only in the lockfiles of the scope addressed', async () => {
    await installGlobal({});
    await installProject({});
    await update({ sessionGuard: 'project' });
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: '.claude/settings.json' });
    expect((await lock(HOME_LOCK)).sessionGuard).toBeUndefined();
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
  });
});

describe('C: a guard change that matched nothing says so', () => {
  it('an identifier nobody installed changes nothing and reports zero', async () => {
    await installProject({ sessionGuard: 'project' });
    const before = await fs.readFile(PROJECT_SETTINGS, 'utf8');
    const result = await update({ sessionGuard: false }, 'no-such-bundle');
    expect(result.updated).toEqual([]);
    expect(result.sessionGuardChanged).toBe(0);
    expect(await fs.readFile(PROJECT_SETTINGS, 'utf8')).toBe(before);
    expect((await lock(PROJECT_LOCK)).sessionGuard).not.toEqual({ off: true });
  });

  it('the CLI does not claim the guard is off, says nothing matched, and exits non-zero', async () => {
    await installProject({ sessionGuard: 'project' });
    const run = cliRun(PROJECT, ['update', 'no-such-bundle', '--no-session-guard']);
    expect(run.text).not.toMatch(/session guard is off/i);
    expect(run.text).toMatch(/No installed package matches "no-such-bundle"/);
    expect(run.text).toMatch(/session guard was not changed/i);
    expect(run.status).toBe(1);
    expect(await inspectSessionGuard(PROJECT_SETTINGS)).toBe('wired');
  });

  it('the CLI in a folder with no lockfile also says nothing was changed and exits non-zero', async () => {
    const empty = path.join(ROOT, 'empty');
    await fs.ensureDir(empty);
    const run = cliRun(empty, ['update', '--all', '--no-session-guard']);
    expect(run.text).not.toMatch(/session guard is off/i);
    expect(run.text).toMatch(/session guard was not changed/i);
    expect(run.status).toBe(1);
  });

  it('the CLI after a real removal names the lockfile changed and the settings file', async () => {
    await installProject({ sessionGuard: 'project' });
    const run = cliRun(PROJECT, ['update', '--all', '--no-session-guard']);
    expect(run.status).toBe(0);
    expect(run.text).toContain('Changed:');
    expect(run.text).toContain('agents-united.json');
    expect(run.text).toContain(PROJECT_SETTINGS);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
  });
});

describe('F: uninstall removes only what is ours', () => {
  const uninstall = () => new UninstallEngine().uninstall('software-engineering', { targetDir: path.join(PROJECT, '.agents'), yes: true } as never);
  const MINE = { type: 'command', command: './mine.sh' };

  it('keeps a hook of the user\'s own that shares a group with ours', async () => {
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(PROJECT_SETTINGS);
    settings.env = { KEEP: '1' };
    settings.hooks.PreToolUse[0].hooks.unshift(MINE);
    await fs.writeJson(PROJECT_SETTINGS, settings, { spaces: 2 });

    await uninstall();

    const after = await fs.readJson(PROJECT_SETTINGS);
    expect(after.env).toEqual({ KEEP: '1' });
    expect(after.hooks.PreToolUse).toEqual([{ matcher: settings.hooks.PreToolUse[0].matcher, hooks: [MINE] }]);
  });

  it('leaves a hand-edited handler, and says which file holds it', async () => {
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(PROJECT_SETTINGS);
    settings.hooks.PreToolUse[0].hooks[0].async = true;
    await fs.writeJson(PROJECT_SETTINGS, settings, { spaces: 2 });

    const result = await uninstall();

    const after = await groupsOf(PROJECT_SETTINGS);
    expect(after).toHaveLength(1);
    expect(after[0].hooks[0].async).toBe(true);
    const notes = (result.notes ?? []).join('\n');
    expect(notes).toContain('.claude/settings.json');
    expect(notes).toMatch(/edited by hand/);
  });

  it('removes a user-file guard recorded by this project and says that file is shared with other projects', async () => {
    await installProject({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');

    const result = await uninstall();

    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    const notes = (result.notes ?? []).join('\n');
    expect(notes).toContain(USER_SETTINGS);
    expect(notes).toMatch(/shared by every project/);
    expect(notes).toMatch(/removed/);
  });

  it('reports a settings file it cannot read instead of silence', async () => {
    await installProject({ sessionGuard: 'project' });
    await fs.writeFile(PROJECT_SETTINGS, '{ // mine\n}');
    const result = await uninstall();
    expect(await fs.readFile(PROJECT_SETTINGS, 'utf8')).toBe('{ // mine\n}');
    expect((result.notes ?? []).join('\n')).toMatch(/not valid JSON/);
  });
});
