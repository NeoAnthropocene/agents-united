import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cli, sessionGuardCommandLines } from '../src/cli.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { GUARD_SCRIPT, guardHandler } from '../src/core/guard.js';
import { InstallEngine } from '../src/core/installer.js';
import {
  guardHandlerHash,
  inspectSessionGuard,
  mergeSessionGuard,
  sessionGuardCommands,
  sessionGuardHandler,
  sessionGuardHooks,
  sessionGuardRestoreCommand,
  sessionGuardScript,
} from '../src/core/session-guard.js';
import { UpdateEngine } from '../src/core/updater.js';
import { READ_ONLY_GUARD_SCRIPT } from '../src/core/readonly-guard.js';

/**
 * The way out of a session guard that blocks because it cannot run (the maintainer's decision of 2026-11-17): the block message,
 * the doctor and `agents update` agree on two commands, `agents update --all` (repair) and `agents update --all --no-session-guard`
 * (remove). Temp directories only; no real Claude session.
 */

const WORKSPACE = path.join(os.tmpdir(), `agents-united-way-out-${process.pid}`);
const AGENTS_DIR = path.join(WORKSPACE, '.agents');
const SETTINGS = path.join(WORKSPACE, '.claude', 'settings.json');
const USER_HOOK = { matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/audit.sh' }] };
const userSettingsText = (eol: string): string =>
  JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, env: { FOO: 'bar' }, hooks: { PreToolUse: [USER_HOOK] } }, null, 4).replace(/\n/g, eol) + eol;

const install = (opts: Record<string, unknown> = {}) =>
  new InstallEngine().install('software-engineering', { targetDir: AGENTS_DIR, method: 'copy', fanout: ['claude'], ...opts });
const update = (opts: Record<string, unknown> = {}) =>
  new UpdateEngine().update('__all__', { targetDir: AGENTS_DIR, scope: 'project', hosts: ['agents'], cwd: WORKSPACE, ...opts } as never);
const lockfile = async (): Promise<Record<string, any>> => fs.readJson(path.join(AGENTS_DIR, 'agents-united.json'));
type Group = { matcher: string; hooks: Array<Record<string, unknown>> };
const groups = async (): Promise<Group[]> => (await fs.readJson(SETTINGS)).hooks?.PreToolUse ?? [];
/** Ours: the file form (the entry names the session guard script) or an inline form that carries the marker text. */
const ourGroups = (all: Group[]): Group[] =>
  all.filter(group =>
    group.hooks.some(h => {
      const args = (h.args as string[] | undefined) ?? [];
      return String(args[1] ?? '').includes('Blocked by agents-united guard') || String(args[0] ?? '').replace(/\\/g, '/').endsWith('/.claude/hooks/agents-united-session-guard.js');
    }));

beforeEach(async () => {
  await fs.remove(WORKSPACE);
  await fs.ensureDir(WORKSPACE);
});
afterEach(async () => {
  await fs.remove(WORKSPACE);
});

describe('the two commands are real options of agents update (tie to the CLI definition)', () => {
  const update = cli.commands.find(command => command.name === 'update')!;
  // The long flags the real definition of `agents update` declares (cac camel-cases `option.name`, so the raw definition is read).
  const optionNames = new Set(update.options.flatMap(option => [...option.rawName.matchAll(/--([a-z-]+)/g)].map(match => match[1])));

  it.each([
    ['project', sessionGuardCommands('project')],
    ['user', sessionGuardCommands('user')],
  ])('%s: both commands name only accepted options of agents update', (_variant, commands) => {
    for (const command of [commands.repair, commands.remove]) {
      const tokens = command.split(' ');
      expect(tokens.slice(0, 2)).toEqual(['agents', 'update']);
      for (const flag of tokens.slice(2).filter(token => token.startsWith('--'))) {
        const name = flag.slice(2);
        expect(optionNames.has(name) || (name.startsWith('no-') && optionNames.has(name.slice(3))), `${flag} in "${command}"`).toBe(true);
      }
    }
  });

  it('the restore command is a real option of agents update too, with --global for the global install', () => {
    for (const scope of ['project', 'global'] as const) {
      const tokens = sessionGuardRestoreCommand(scope).split(' ');
      expect(tokens.slice(0, 2)).toEqual(['agents', 'update']);
      expect(tokens.includes('--global')).toBe(scope === 'global');
      for (const flag of tokens.slice(2).filter(token => token.startsWith('--'))) expect(optionNames.has(flag.slice(2)), flag).toBe(true);
      const parsed = cli.parse(['node', 'agents', ...tokens], { run: false });
      expect(parsed.options.all).toBe(true);
      expect(parsed.options.sessionGuard).toBe('user');
    }
  });

  it('the exact commands, and --global added for a guard in the user settings file', () => {
    expect(sessionGuardCommands('project')).toEqual({ repair: 'agents update --all', remove: 'agents update --all --no-session-guard' });
    expect(sessionGuardCommands('local')).toEqual(sessionGuardCommands('project'));
    expect(sessionGuardCommands('user')).toEqual({ repair: 'agents update --all --global', remove: 'agents update --all --global --no-session-guard' });
  });

  it('the parser reads the removal command as all=true and sessionGuard=false, and the repair command without a sessionGuard value', () => {
    const removal = cli.parse(['node', 'agents', ...sessionGuardCommands('project').remove.split(' ').slice(0)], { run: false });
    expect(removal.options.all).toBe(true);
    expect(removal.options.sessionGuard).toBe(false);
    const repair = cli.parse(['node', 'agents', ...sessionGuardCommands('project').repair.split(' ')], { run: false });
    expect(repair.options.all).toBe(true);
    expect(repair.options.sessionGuard).toBeUndefined();
  });
});

describe('agents update --no-session-guard removes the session guard and --session-guard puts it back', () => {
  it.each([
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ])('%s: removes only our entries, keeps every other byte, records off, and a second run changes nothing', async (_name, eol) => {
    const original = userSettingsText(eol);
    await fs.outputFile(SETTINGS, original);
    await install({ sessionGuard: 'project' });
    expect(ourGroups(await groups())).toHaveLength(2);
    expect(await fs.readFile(SETTINGS, 'utf8')).not.toBe(original);

    await update({ sessionGuard: false });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(original);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });

    await update({ sessionGuard: false });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(original);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });
  });

  it('deletes a settings file that agents-united created when nothing else remains', async () => {
    await install({ sessionGuard: 'project' });
    await update({ sessionGuard: false });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('works when the re-install is skipped because a projected file was edited', async () => {
    await install({ sessionGuard: 'project' });
    // A canonical file edited after the install: the update refuses to overwrite it (no --force), so the record is skipped.
    const edited = Object.keys((await lockfile()).files).find(rel => rel.startsWith('agents/'))!;
    await fs.appendFile(path.join(AGENTS_DIR, edited), '\nmy own note\n');
    const result = await update({ sessionGuard: false });
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });
  });

  it('leaves a hand-modified guard in place, says so, and does not delete it silently', async () => {
    await install({ sessionGuard: 'project' });
    const settings = await fs.readJson(SETTINGS);
    const bash = settings.hooks.PreToolUse.find((group: Group) => group.matcher === 'Bash|PowerShell');
    bash.hooks[0].args = ['-e', `${sessionGuardScript('project')};process.exit(0)`];
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    const result = await update({ sessionGuard: false });
    expect(ourGroups(await groups()).map(group => group.matcher)).toEqual(['Bash|PowerShell']);
    expect(result.sessionGuardNotes?.join('\n')).toMatch(/edited by hand/);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });
  });

  it('install-time --no-session-guard also removes entries a guard left behind', async () => {
    await install({ sessionGuard: 'project' });
    await install({ sessionGuard: false });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });
  });

  it('--session-guard on update turns it back on after it was removed', async () => {
    await install({ sessionGuard: 'project' });
    await update({ sessionGuard: false });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    await update({ sessionGuard: true });
    expect(ourGroups(await groups())).toHaveLength(2);
    expect((await lockfile()).sessionGuard).toMatchObject({ file: '.claude/settings.json', handlerHash: guardHandlerHash('project') });
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });

  it('a plain update leaves the recorded decision alone (off stays off, on stays on)', async () => {
    await install({ sessionGuard: 'project' });
    await update();
    expect(ourGroups(await groups())).toHaveLength(2);
    await update({ sessionGuard: false });
    await update();
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });
});

describe('the session script blocks with both commands when it cannot do its work', () => {
  const run = (script: string, stdin: string) => {
    const result = spawnSync(process.execPath, ['-e', script], { input: stdin, encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr };
  };
  const { repair, remove } = sessionGuardCommands('project');

  it('unreadable input exits 2 with the unreadable-input message, both commands and the own-terminal sentence', () => {
    for (const stdin of ['', '{not json', 'null', '[]']) {
      const result = run(sessionGuardScript('project'), stdin);
      expect(result.status, JSON.stringify(stdin)).toBe(2);
      expect(result.stderr.startsWith('Blocked by agents-united guard: unreadable hook input')).toBe(true);
      expect(result.stderr).toContain(repair);
      expect(result.stderr).toContain(remove);
      expect(result.stderr).toMatch(/in your own terminal, not in this session \(this session's shell calls are blocked\)/);
    }
  });

  it('an error thrown inside the script exits 2 with both commands (the uncaughtException handler)', () => {
    // The stdin is valid; the script is run with a `String` that throws, which stands for any error inside the script.
    const broken = `String=()=>{throw new Error("boom")};${sessionGuardScript('project')}`;
    const result = run(broken, JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hi' } }));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Blocked by agents-united guard: the guard failed while reading this tool call.');
    expect(result.stderr).toContain(repair);
    expect(result.stderr).toContain(remove);
  });

  it('still blocks what the generic guard blocks, with the generic reason, and lets a harmless call through', () => {
    const forced = run(sessionGuardScript('project'), JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }));
    expect(forced.status).toBe(2);
    expect(forced.stderr).toMatch(/git push --force requires explicit human approval/);
    expect(run(sessionGuardScript('project'), JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hello' } })).status).toBe(0);
    expect(run(sessionGuardScript('project'), '{}').status).toBe(0);
  });

  it('the user variant names --global in both commands', () => {
    const result = run(sessionGuardScript('user'), 'null');
    expect(result.stderr).toContain('agents update --all --global ');
    expect(result.stderr).toContain('agents update --all --global --no-session-guard');
  });

  it('one template: the patterns are the generic script\'s, and the regex literal count is unchanged', () => {
    const count = (script: string): number => [...script.matchAll(/\/((?:\\.|[^/\\\n])+)\/\.test\(/g)].length;
    expect(count(GUARD_SCRIPT)).toBeGreaterThanOrEqual(4);
    expect(count(sessionGuardScript('project'))).toBe(count(GUARD_SCRIPT));
    expect(count(sessionGuardScript('user'))).toBe(count(GUARD_SCRIPT));
    expect(sessionGuardScript('project')).toContain(GUARD_SCRIPT.slice(GUARD_SCRIPT.indexOf('const t=')));
  });

  it('keeps the ownership marker', () => {
    expect(sessionGuardScript('project')).toContain('Blocked by agents-united guard');
  });

  // The reviewer suspected an exit 0 when stdin closes without `end` or `error`. A host closes the pipe or sends end of file, and both end the
  // stream with `end`: the guard blocks (exit 2). Only a script that destroys its own stdin ends it with `close` alone, which no host does.
  it('input that the host closes (end of file, or a pipe closed at once) blocks with exit 2, never 0', async () => {
    const eof = spawnSync(process.execPath, ['-e', sessionGuardScript('project')], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    expect(eof.status).toBe(2);
    expect(eof.stderr.startsWith('Blocked by agents-united guard: unreadable hook input')).toBe(true);

    const closed = await new Promise<{ code: number | null; stderr: string }>(resolve => {
      const child = spawn(process.execPath, ['-e', sessionGuardScript('project')], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => (stderr += String(chunk)));
      child.on('close', code => resolve({ code, stderr }));
      child.stdin.destroy();
    });
    expect(closed.code).toBe(2);
    expect(closed.stderr).toContain('unreadable hook input');
  });

  it('the role guards keep the generic script without the session-only text', () => {
    for (const script of [GUARD_SCRIPT, READ_ONLY_GUARD_SCRIPT]) {
      expect(script).not.toContain('agents update');
      expect(script).not.toContain('uncaughtException');
      expect(script).not.toContain('To get out');
    }
    expect(guardHandler().args[1]).toBe(GUARD_SCRIPT);
    expect(sessionGuardHandler('project').args).toHaveLength(1); // the session guard names a script file; the text is not in the entry
    expect(sessionGuardScript('project')).not.toBe(GUARD_SCRIPT);
  });
});

describe('earlier forms of the session guard are outdated, the new form is current', () => {
  const asFile = async (handler: Record<string, unknown>): Promise<void> => {
    const entry = (matcher: string) => ({ matcher, hooks: [handler] });
    await fs.outputJson(SETTINGS, { hooks: { PreToolUse: sessionGuardHooks('project').PreToolUse.map(group => entry(group.matcher)) } }, { spaces: 2 });
  };
  const preS2 = String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i={};try{i=JSON.parse(s)}catch(e){}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`;

  it('the new form is current (wired)', async () => {
    await asFile({ ...sessionGuardHandler('project') });
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });

  it('the S3 form (the generic script with onFailure) is outdated, and update renews it', async () => {
    await asFile({ ...guardHandler() });
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
  });

  it('the generic script without onFailure and the pre-S2 script are outdated', async () => {
    await asFile({ type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT] });
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
    await asFile({ type: 'command', command: 'node', args: ['-e', preS2] });
    expect(await inspectSessionGuard(SETTINGS)).toBe('outdated');
  });

  it('a hand-edited handler is still modified', async () => {
    await asFile({ ...sessionGuardHandler('project'), args: ['-e', `${sessionGuardScript('project')};process.exit(0)`] });
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
  });
});

describe('the doctor carries both commands for the CLI to print once', () => {
  it('data: both commands wherever a session guard is recorded, in every state but off', async () => {
    await install({ sessionGuard: 'project' });
    const report = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect(report.sessionGuard).toBe('wired');
    expect(report.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));

    // One group only, so the other matcher has no group of ours: an edit, not an earlier version.
    await fs.writeJson(SETTINGS, { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ ...guardHandler() }] }] } });
    const edited = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect(edited.sessionGuard).toBe('modified');
    expect(edited.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));

    // Both groups hold the earlier generic handler: an earlier version of ours, which `agents update` renews.
    const earlier = sessionGuardHooks('project').PreToolUse.map(group => ({ matcher: group.matcher, hooks: [{ ...guardHandler() }] }));
    await fs.writeJson(SETTINGS, { hooks: { PreToolUse: earlier } });
    const outdated = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect(outdated.sessionGuard).toBe('outdated');
    expect(outdated.sessionGuardCommands).toMatchObject(sessionGuardCommands('project'));

    await update({ sessionGuard: false });
    const off = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect(off.sessionGuard).toBe('off');
    expect(off.sessionGuardCommands).toBeUndefined();
  });

  it('the outdated pointer stays', async () => {
    await install({ sessionGuard: 'project' });
    const settings = await fs.readJson(SETTINGS);
    for (const group of settings.hooks.PreToolUse) group.hooks = [{ ...guardHandler() }];
    await fs.writeJson(SETTINGS, settings);
    const report = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect(report.sessionGuard).toBe('outdated');
    expect(report.warnings.join('\n')).toContain("Run 'agents update' to renew it.");
  });

  it('the CLI lines name each command once', () => {
    const lines = sessionGuardCommandLines(sessionGuardCommands('project'));
    expect(lines).toHaveLength(2);
    const text = lines.join('\n');
    expect(text.split(sessionGuardCommands('project').remove).length - 1).toBe(1);
    expect(text.match(/agents update --all(?! --no-session-guard)/g)).toHaveLength(1);
    expect(sessionGuardCommandLines(undefined)).toEqual([]);
  });
});
