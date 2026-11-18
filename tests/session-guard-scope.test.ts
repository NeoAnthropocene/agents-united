import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionGuardCommandLines } from '../src/cli.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import {
  EARLIER_SESSION_SCRIPTS,
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
/** The script the entries of a settings file run: the file beside it (the entries name it; they no longer carry the text). */
const scriptIn = async (file: string): Promise<string> => {
  const reference: string = (await groupsOf(file))[0].hooks[0].args[0];
  expect(path.basename(reference)).toBe('agents-united-session-guard.js');
  return fs.readFile(path.join(path.dirname(file), 'hooks', 'agents-united-session-guard.js'), 'utf8');
};
/** An earlier version's handler: the script inline, `node -e`. */
const inlineHandler = (script: string): Json => ({ type: 'command', command: 'node', args: ['-e', script], onFailure: 'block' });
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

  const USER_PAIR = 'agents update --all --global (repairs the install) or agents update --all --global --no-session-guard (removes the session guard)';
  const USER_ALTERNATIVE = "if a project installed this guard, run the same commands without --global from that project's folder";

  it('the user-file text names both possibilities, whoever installed it (project-recorded)', async () => {
    await installProject({ sessionGuard: 'user' });
    const message = blockMessage(await scriptIn(USER_SETTINGS));
    expect(message).toContain(USER_PAIR);
    expect(message).toContain(USER_ALTERNATIVE);
    expect(message).toMatch(/in your own terminal, not in this session/);

    // Doctor keeps the reach distinction: the commands of the lockfile it reads, and the folder of a project-recorded guard.
    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('wired');
    expect(report.sessionGuardCommands).toMatchObject({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard', folder: path.resolve(PROJECT) });
    expect(report.sessionGuardCommands?.manual).toContain(USER_SETTINGS);
  });

  it('the user-file text is the same when a global install wrote it, and doctor names --global and no folder', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const message = blockMessage(await scriptIn(USER_SETTINGS));
    expect(message).toContain(USER_PAIR);
    expect(message).toContain(USER_ALTERNATIVE);

    const report = await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('wired');
    expect(report.sessionGuardCommands).toMatchObject(sessionGuardCommands('user'));
    expect(report.sessionGuardCommands).not.toHaveProperty('folder');
  });

  it('a project guard names the plain commands, as before, and the manual route', async () => {
    await installProject({ sessionGuard: 'project' });
    const message = blockMessage(await scriptIn(PROJECT_SETTINGS));
    expect(message).toContain('agents update --all (repairs the install)');
    expect(message).not.toContain('--global');
    expect(message).toContain("delete by hand the hook entries that contain 'agents-united guard' from .claude/settings.json or .claude/settings.local.json in the project");
    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));
    expect(report.sessionGuardCommands?.manual).toContain(PROJECT_SETTINGS);
  });

  it('every way-out message carries the manual route, by kind of file, with no absolute path', () => {
    const user = sessionGuardScript('user');
    expect(user).toContain("delete by hand the hook entries that contain 'agents-united guard' from settings.json in the .claude folder of your home directory");
    expect(blockMessage(user)).toContain('settings.json in the .claude folder of your home directory');
    for (const script of [sessionGuardScript('project'), sessionGuardScript('local'), user]) {
      expect(script).not.toContain(HOME);
      expect(script).not.toContain(PROJECT);
      expect(script).not.toMatch(/[A-Za-z]:\\\\|[\\/]Users[\\/]|[\\/]home[\\/]/);
      expect(script.length).toBeLessThan(2400);
    }
  });

  it('the user settings file is shared: a second install leaves it byte-identical, and a plain update of either changes nothing', async () => {
    await installGlobal({ sessionGuard: 'user' });
    const first = await fs.readFile(USER_SETTINGS, 'utf8');
    await installProject({ sessionGuard: 'user' });
    expect(await fs.readFile(USER_SETTINGS, 'utf8')).toBe(first);
    await installGlobal({});
    await installProject({});
    expect(await fs.readFile(USER_SETTINGS, 'utf8')).toBe(first);
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect((await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude')).sessionGuard).toBe('wired');
    expect((await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude')).sessionGuard).toBe('wired');
    expect((await groupsOf(USER_SETTINGS)).map(group => group.matcher)).toEqual(sessionGuardHooks('user').PreToolUse.map(group => group.matcher));
  });

  it('the earlier user-file texts (global-recorded and project-recorded) are outdated, and an update renews them to the one text', async () => {
    const [earlierProject, earlierUser, earlierUserProject] = EARLIER_SESSION_SCRIPTS;
    await installGlobal({ sessionGuard: 'user' });
    const current = await fs.readFile(USER_SETTINGS, 'utf8');
    for (const script of [earlierUser, earlierUserProject]) {
      const settings = JSON.parse(current) as { hooks: { PreToolUse: Array<{ hooks: Json[] }> } };
      for (const group of settings.hooks.PreToolUse) group.hooks[0] = inlineHandler(script);
      await fs.writeFile(USER_SETTINGS, JSON.stringify(settings, null, 2));
      expect(await inspectSessionGuard(USER_SETTINGS)).toBe('outdated');
      expect((await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude')).sessionGuard).toBe('outdated');
      await installGlobal({});
      expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
      expect(JSON.parse(await fs.readFile(USER_SETTINGS, 'utf8')).hooks.PreToolUse[0].hooks[0].args).toEqual([path.join(HOME, '.claude', 'hooks', 'agents-united-session-guard.js')]);
      expect(await scriptIn(USER_SETTINGS)).toBe(`${sessionGuardScript('user')}\n`);
    }
    // The project text of the version before is outdated in a project file.
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(PROJECT_SETTINGS);
    for (const group of settings.hooks.PreToolUse) group.hooks[0] = inlineHandler(earlierProject);
    await fs.writeJson(PROJECT_SETTINGS, settings, { spaces: 2 });
    expect(await inspectSessionGuard(PROJECT_SETTINGS)).toBe('outdated');
  });

  it('the doctor prints the folder, the restore command and the manual route when it has them', () => {
    const lines = sessionGuardCommandLines({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard', folder: '/work/app', restore: 'agents update --all --session-guard user', manual: 'By hand: x.' });
    expect(lines).toHaveLength(5);
    expect(lines[2]).toContain('/work/app');
    expect(lines[3]).toContain('agents update --all --session-guard user');
    expect(lines[4]).toContain('By hand: x.');
    expect(sessionGuardCommandLines({ repair: 'a', remove: 'b' })).toHaveLength(2);
  });

  it('the project text and the user text are two scripts; a project-recorded user guard carries the user text', () => {
    expect(sessionGuardScript('user-project')).toBe(sessionGuardScript('user'));
    expect(sessionGuardScript('user')).not.toBe(sessionGuardScript('project'));
    expect(sessionGuardScript('local')).toBe(sessionGuardScript('project'));
    expect(sessionGuardScript('user')).toContain('Blocked by agents-united guard');
  });
});

describe('1: a way out is not undone by an unrelated update of the shared user settings file', () => {
  const restoreProject = 'agents update --all --session-guard user';
  const restoreGlobal = 'agents update --all --global --session-guard user';

  it('end to end: removed through the global lockfile, not written back by the project\'s plain update, doctor names the restore command, an explicit restore writes it', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await installProject({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');

    // The way out: the global command removes the guard from the user file.
    await update({ global: true, sessionGuard: false });
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    // The project lockfile still records it as on.
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });

    // A plain update (the project scope) and a plain install do not write it back; the output says why.
    const plain = await update({});
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect(plain.projections.flatMap(projection => projection.warnings ?? []).join('\n')).toContain(restoreProject);
    await installProject({});
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });

    // Doctor reports it as missing and names the command that puts it back on purpose, and the manual route.
    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('missing');
    expect(report.sessionGuardCommands?.restore).toBe(restoreProject);
    expect(report.warnings.join('\n')).toContain(restoreProject);
    const lines = sessionGuardCommandLines(report.sessionGuardCommands).join('\n');
    expect(lines).toContain(restoreProject);

    // An explicit restore writes it.
    await update({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    expect((await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude')).sessionGuard).toBe('wired');
  });

  it('a bare --session-guard restores it where it was recorded', async () => {
    await installProject({ sessionGuard: 'user' });
    await fs.remove(USER_SETTINGS);
    await update({});
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    await update({ sessionGuard: true });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
  });

  it('the global lockfile names --global in the restore command', async () => {
    await installGlobal({ sessionGuard: 'user' });
    await fs.remove(USER_SETTINGS);
    const report = await DoctorEngine.runDoctor(path.join(HOME, '.agents'), 'claude');
    expect(report.sessionGuard).toBe('missing');
    expect(report.sessionGuardCommands?.restore).toBe(restoreGlobal);
    await installGlobal({});
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    await installGlobal({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
  });

  it('moving the guard to another place removes our entries from the earlier file first, and says so, so --no-session-guard still finds everything', async () => {
    await installProject({ sessionGuard: 'project' });
    expect(await inspectSessionGuard(PROJECT_SETTINGS)).toBe('wired');

    const moved = await update({ sessionGuard: 'user' });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
    // The earlier file is no longer left behind untracked.
    expect(await fs.pathExists(PROJECT_SETTINGS)).toBe(false);
    expect((await lock(PROJECT_LOCK)).sessionGuard).toMatchObject({ file: USER_SETTINGS });
    const notes = (moved.sessionGuardNotes ?? []).join('\n');
    expect(notes).toContain(PROJECT_SETTINGS);
    expect(notes).toMatch(/moved|removed our entries from/);

    await update({ sessionGuard: false });
    expect(await fs.pathExists(USER_SETTINGS)).toBe(false);
    expect(await fs.pathExists(PROJECT_SETTINGS)).toBe(false);
  });

  it('moving the guard leaves the earlier file\'s other content and a hand-edited entry alone', async () => {
    await installProject({ sessionGuard: 'project' });
    const settings = await fs.readJson(PROJECT_SETTINGS);
    settings.env = { KEEP: '1' };
    await fs.writeJson(PROJECT_SETTINGS, settings, { spaces: 2 });
    await update({ sessionGuard: 'local' });
    expect((await fs.readJson(PROJECT_SETTINGS)).env).toEqual({ KEEP: '1' });
    expect((await groupsOf(PROJECT_SETTINGS))).toEqual([]);
    expect(await inspectSessionGuard(path.join(PROJECT, '.claude', 'settings.local.json'))).toBe('wired');
  });

  it('a guard that is present but outdated in the user file is still renewed by a plain update', async () => {
    await installProject({ sessionGuard: 'user' });
    const settings = await fs.readJson(USER_SETTINGS);
    for (const group of settings.hooks.PreToolUse) group.hooks[0] = inlineHandler(EARLIER_SESSION_SCRIPTS[1]);
    await fs.writeJson(USER_SETTINGS, settings, { spaces: 2 });
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('outdated');
    await update({});
    expect(await inspectSessionGuard(USER_SETTINGS)).toBe('wired');
  });

  it.each([
    ['project', PROJECT_SETTINGS],
    ['local', path.join(PROJECT, '.claude', 'settings.local.json')],
  ] as const)('a missing guard in the %s settings file is restored by a plain update, as before', async (variant, file) => {
    await installProject({ sessionGuard: variant });
    await fs.remove(file);
    await update({});
    expect(await inspectSessionGuard(file)).toBe('wired');
    await fs.remove(file);
    await installProject({});
    expect(await inspectSessionGuard(file)).toBe('wired');
    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.sessionGuardCommands).not.toHaveProperty('restore');
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
    expect(notes).toMatch(/shared by every install/);
    expect(notes).toContain('agents update --all --session-guard user');
    expect(notes).toMatch(/plain update does not re-create it/);
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
    expect(notes).toMatch(/shared by every install/);
    expect(notes).toContain('agents update --all --session-guard user');
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

describe('7: a guard change that was made is reported when a later step fails', () => {
  /** A lockfile that names a bundle the registry does not know: the preflight install of that record throws after the guard step ran. */
  const breakLater = async (): Promise<void> => {
    const file = await lock(PROJECT_LOCK);
    file.installed.bundles.push('ghost-bundle-xyz');
    file.bundleVersions = { ...(file.bundleVersions ?? {}), 'ghost-bundle-xyz': '1.0.0' };
    await fs.writeJson(PROJECT_LOCK, file);
  };

  it('the error carries the notes and the count of what was changed', async () => {
    await installProject({ sessionGuard: 'project' });
    await breakLater();
    const failure = await update({ sessionGuard: false }).then(() => undefined, (error: unknown) => error as Error & { sessionGuardNotes?: string[]; sessionGuardChanged?: number });
    expect(failure?.message).toContain('ghost-bundle-xyz');
    expect(failure?.sessionGuardChanged).toBe(1);
    expect((failure?.sessionGuardNotes ?? []).some(line => line.startsWith('Changed:') && line.includes(PROJECT_LOCK))).toBe(true);
    // The change itself was made.
    expect((await lock(PROJECT_LOCK)).sessionGuard).toEqual({ off: true });
    expect(await fs.pathExists(PROJECT_SETTINGS)).toBe(false);
  });

  it('a failure with no guard change keeps its error as it was', async () => {
    await installProject({ sessionGuard: 'project' });
    await breakLater();
    const failure = await update({}).then(() => undefined, (error: unknown) => error as Error & { sessionGuardNotes?: string[] });
    expect(failure?.message).toContain('ghost-bundle-xyz');
    expect(failure?.sessionGuardNotes).toBeUndefined();
  });

  it('the CLI prints the Changed line before the error, and exits 1', async () => {
    await installProject({ sessionGuard: 'project' });
    await breakLater();
    const run = cliRun(PROJECT, ['update', '--all', '--no-session-guard']);
    expect(run.status).toBe(1);
    expect(run.text).toContain('Changed:');
    expect(run.text).toContain(PROJECT_LOCK);
    expect(run.text).toContain('ghost-bundle-xyz');
    expect(run.text.indexOf('Changed:')).toBeLessThan(run.text.indexOf('ghost-bundle-xyz'));
    expect(run.text).toContain('changed before the failure');
  });

  it('the CLI does not say anything was changed when the notes are only "Left as it was"', async () => {
    await installProject({ fanout: ['cline'] });
    await breakLater();
    const run = cliRun(PROJECT, ['update', '--all', '--no-session-guard']);
    expect(run.status).toBe(1);
    expect(run.text).toContain('Left as it was:');
    expect(run.text).toContain('ghost-bundle-xyz');
    expect(run.text).not.toMatch(/changed before the failure/i);
    expect(run.text).not.toContain('Changed:');
  });
});
