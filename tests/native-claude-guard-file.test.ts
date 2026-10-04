import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { GUARD_SCRIPT, nativeGuardHooks } from '../src/core/guard.js';
import { InstallEngine } from '../src/core/installer.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { syncHooks } from '../src/core/native-floor.js';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardHooks } from '../src/core/readonly-guard.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { attempt, preToolUseGroups } from './helpers/claude-host-hooks.js';

/**
 * Plan 032 close-out follow-up (6), slice 1 — the Claude guard as a separate script file. Claude prints the whole `node -e <script>`
 * in every block message (about 600 characters of regular expressions, which also reaches the model), so the native lane now ships the
 * two guards as files in `.claude/hooks/` and the role's frontmatter names the file. The script is the guard that already exists, byte for
 * byte; it is a tracked projection like the Antigravity guard (hash, owners, refcount), and the doctor warns when it is gone because a
 * hook whose script cannot start does not block (host-library/claude/guide/hook.md: it fails open). A GLOBAL install cannot name a
 * script portably (`${CLAUDE_PROJECT_DIR}` is the only placeholder, and it is the open project), so it keeps the inline guard.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const OTHER_BUNDLE = 'system-architecture'; // shares backend-architect with BUNDLE, and has no read-only role
const read = (file: string): string => fs.readFileSync(file, 'utf8');
const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;

const SCRIPTS = {
  destructive: { name: 'agents-united-guard', source: GUARD_SCRIPT },
  'read-only': { name: 'agents-united-readonly-guard', source: READ_ONLY_GUARD_SCRIPT },
} as const;
type Kind = keyof typeof SCRIPTS;
const scriptRel = (kind: Kind): string => `.claude/hooks/${SCRIPTS[kind].name}.js`;
const reference = (kind: Kind): string => `\${CLAUDE_PROJECT_DIR}/${scriptRel(kind)}`;

const ROLES: Record<string, Kind> = {
  'backend-architect': 'destructive',
  'frontend-architect': 'destructive',
  'orchestrator-engineering': 'destructive',
  'code-reviewer': 'read-only',
  'repo-index': 'read-only',
};

describe('the committed guard scripts', () => {
  it.each(Object.keys(SCRIPTS) as Kind[])('%s is the existing inline guard, byte for byte, so the logic has one author', kind => {
    const file = path.join(REGISTRY, 'hosts/claude/hooks', `${SCRIPTS[kind].name}.js`);
    expect(read(file).replace(/\r\n/g, '\n')).toBe(`${SCRIPTS[kind].source}\n`);
  });

  it.each(Object.entries(ROLES))('%s names its guard by file, in exec form, and carries no script text', (role, kind) => {
    const text = read(path.join(REGISTRY, 'hosts/claude/agents', `${role}.md`));
    const groups = preToolUseGroups(text);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.hooks).toEqual([{ type: 'command', command: 'node', args: [reference(kind)] }]);
    }
    expect(text).not.toContain('process.stdin');
    expect(text).not.toMatch(/"args":\["-e"/);
    // The matchers are the ones the inline guards always had: only the handler changed.
    const inline = kind === 'read-only' ? readOnlyGuardHooks().PreToolUse : nativeGuardHooks().PreToolUse;
    expect(groups.map(group => group.matcher)).toEqual(inline.map(group => group.matcher));
  });

  it.each(Object.entries(ROLES))('%s is still seen as guarded by the doctor\'s reader', (role, kind) => {
    const facts = inspectNativeAgent(read(path.join(REGISTRY, 'hosts/claude/agents', `${role}.md`)));
    expect(facts.guard).toBe(kind);
  });
});

describe('the guard files in the native install lane (project scope)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-claude-guard-file');
  const sidecar = path.join(workspace, '.claude', '.agents-united');
  const lockPath = path.join(sidecar, 'agents-united.json');
  const at = (rel: string): string => path.join(workspace, rel);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, bundle = BUNDLE) =>
    new InstallEngine().install(bundle, { targetDir: sidecar, method: 'copy', fanout: ['claude'], nativeLane, ...extra } as never);
  const role = (name: string): string => read(at(`.claude/agents/${name}.md`));
  const expectedScript = (kind: Kind): string => {
    const source = read(path.join(REGISTRY, 'hosts/claude/hooks', `${SCRIPTS[kind].name}.js`)).replace(/\r\n/g, '\n').replace(/\n*$/, '\n');
    return `${source}// managed-by: agents-united | profile: claude-native | canonical: hosts/claude/hooks/${SCRIPTS[kind].name}.js | source: ${sha256(source)} | do not edit\n`;
  };

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('writes no script with the lane off', async () => {
    await install();
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(await fs.pathExists(at(scriptRel(kind))), kind).toBe(false);
  });

  it('installs both scripts as tracked projections: unchanged code, the marker as a trailing comment, owners and a hash', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    for (const kind of Object.keys(SCRIPTS) as Kind[]) {
      expect(read(at(scriptRel(kind)))).toBe(expectedScript(kind));
      const record = lock.projections[scriptRel(kind)];
      expect(record, kind).toMatchObject({ host: 'claude', kind: 'hook', managedMarker: true });
      expect(record.owners).toContain(BUNDLE);
      expect(record.hash).toBe(sha256(read(at(scriptRel(kind)))));
    }
  });

  it('points every installed role at the script of its kind, and the roles are the committed files', async () => {
    await install(true);
    for (const [name, kind] of Object.entries(ROLES)) {
      const text = role(name);
      expect(preToolUseGroups(text).flatMap(group => group.hooks.flatMap(hook => hook.args ?? [])), name).toEqual(
        preToolUseGroups(text).map(() => reference(kind))
      );
      expect(inspectNativeAgent(text).guard, name).toBe(kind);
    }
  });

  it('blocks through the installed script when the host calls it as documented, from any working directory', async () => {
    await install(true);
    const away = os.tmpdir();
    const forced = attempt(role('backend-architect'), workspace, { tool: 'Bash', input: { command: 'echo git push --force' } }, { cwd: away });
    expect([forced.fired, forced.blocked]).toEqual([1, true]);
    expect(forced.reason).toMatch(/Blocked by agents-united guard: git push --force/);
    expect(attempt(role('backend-architect'), workspace, { tool: 'Write', input: { file_path: path.join(workspace, '.env.test') } }, { cwd: away }).blocked).toBe(true);
    expect(attempt(role('backend-architect'), workspace, { tool: 'Bash', input: { command: 'echo hello world' } }, { cwd: away }).blocked).toBe(false);
    const readOnly = attempt(role('code-reviewer'), workspace, { tool: 'Write', input: { file_path: path.join(workspace, 'a.ts'), content: 'x' } }, { cwd: away });
    expect([readOnly.fired, readOnly.blocked]).toEqual([1, true]);
    expect(readOnly.reason).toMatch(/Blocked by agents-united read-only guard: Write/);
  });

  it('keeps the host\'s block message short: the command line it prints and the reason are both small', async () => {
    await install(true);
    for (const [name, kind] of Object.entries(ROLES)) {
      const group = preToolUseGroups(role(name))[0];
      const printed = ['node', ...(group.hooks[0].args ?? [])].join(' ');
      expect(printed, name).toBe(`node ${reference(kind)}`);
      expect(printed.length, name).toBeLessThan(90);
    }
    const reason = attempt(role('backend-architect'), workspace, { tool: 'Bash', input: { command: 'git push -f origin main' } }).reason;
    expect(reason.length).toBeLessThan(200);
  });

  it('is byte-stable: a second install changes neither the roles nor the scripts', async () => {
    await install(true);
    const before = new Map([...Object.keys(ROLES).map(name => [`.claude/agents/${name}.md`, role(name)] as const), ...(Object.keys(SCRIPTS) as Kind[]).map(kind => [scriptRel(kind), read(at(scriptRel(kind)))] as const)]);
    await install(true);
    for (const [rel, text] of before) expect(read(at(rel)), rel).toBe(text);
  });

  it('turning the lane off removes the scripts, and the roles stop naming them', async () => {
    await install(true);
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(await fs.pathExists(at(scriptRel(kind))), `${kind} was installed`).toBe(true);
    await install(false, { force: true });
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(await fs.pathExists(at(scriptRel(kind))), kind).toBe(false);
    for (const name of Object.keys(ROLES)) expect(role(name), name).not.toContain('.claude/hooks/agents-united');
    expect((await fs.readJson(lockPath)).projections['.claude/hooks/agents-united-guard.js']).toBeUndefined();
  });

  it('removing the bundle removes the scripts and leaves a hook of the user\'s own where it is', async () => {
    await fs.outputFile(at('.claude/hooks/mine.sh'), '#!/bin/sh\nexit 0\n');
    await install(true);
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(await fs.pathExists(at(scriptRel(kind))), `${kind} was installed`).toBe(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: sidecar });
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(await fs.pathExists(at(scriptRel(kind))), kind).toBe(false);
    expect(read(at('.claude/hooks/mine.sh'))).toBe('#!/bin/sh\nexit 0\n');
  });

  it('removes an emptied .claude/hooks folder it created', async () => {
    await install(true);
    expect(await fs.pathExists(at('.claude/hooks'))).toBe(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: sidecar });
    expect(await fs.pathExists(at('.claude/hooks'))).toBe(false);
  });

  it('is shared by bundles: a script stays while a bundle that owns a role needing it remains, and only that script', async () => {
    await install(true);
    await install(undefined, {}, OTHER_BUNDLE);
    const lock = await fs.readJson(lockPath);
    expect(lock.projections[scriptRel('destructive')].owners).toEqual(expect.arrayContaining([BUNDLE, OTHER_BUNDLE]));
    expect(lock.projections[scriptRel('read-only')].owners).toEqual([BUNDLE]);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: sidecar });
    expect(await fs.pathExists(at(scriptRel('destructive')))).toBe(true);
    expect(await fs.pathExists(at(scriptRel('read-only')))).toBe(false);
    await new UninstallEngine().uninstall(OTHER_BUNDLE, { targetDir: sidecar });
    expect(await fs.pathExists(at(scriptRel('destructive')))).toBe(false);
  });

  it('upgrades an install made before this change (inline guards, recorded hashes) on the next update, without --force', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    for (const [name, kind] of Object.entries(ROLES)) {
      const old = syncHooks(role(name), kind === 'read-only' ? readOnlyGuardHooks() : nativeGuardHooks());
      await fs.writeFile(at(`.claude/agents/${name}.md`), old);
      lock.projections[`.claude/agents/${name}.md`].hash = sha256(old);
      expect(inspectNativeAgent(old).guard, name).toBe(kind);
    }
    for (const kind of Object.keys(SCRIPTS) as Kind[]) {
      await fs.remove(at(scriptRel(kind)));
      delete lock.projections[scriptRel(kind)];
    }
    await fs.writeJson(lockPath, lock);
    await install(undefined);
    for (const [name, kind] of Object.entries(ROLES)) expect(preToolUseGroups(role(name))[0].hooks[0].args, name).toEqual([reference(kind)]);
    for (const kind of Object.keys(SCRIPTS) as Kind[]) expect(read(at(scriptRel(kind))), kind).toBe(expectedScript(kind));
  });

  describe('doctor', () => {
    const warnings = async (): Promise<string[]> => (await DoctorEngine.runDoctor(sidecar, 'claude')).warnings;
    const guardWarnings = async (): Promise<string[]> => (await warnings()).filter(warning => /guard script/i.test(warning));

    it('finds a fresh install healthy', async () => {
      await install(true);
      const report = await DoctorEngine.runDoctor(sidecar, 'claude');
      expect(report.issues).toEqual([]);
      expect(await guardWarnings()).toEqual([]);
    });

    it('warns, naming the script and the roles, when the destructive-command script is gone, because the host then lets the call through', async () => {
      await install(true);
      await fs.remove(at(scriptRel('destructive')));
      const found = await guardWarnings();
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(scriptRel('destructive'));
      expect(found[0]).toMatch(/backend-architect/);
      expect(found[0]).toMatch(/orchestrator-engineering/);
      expect(found[0]).not.toMatch(/code-reviewer/);
      expect(found[0]).toMatch(/lets the call through/);
      expect(found[0]).toContain(`agents update ${BUNDLE} --fanout claude`);
    });

    it('warns the same way for the read-only script, which guards the reviewers', async () => {
      await install(true);
      await fs.remove(at(scriptRel('read-only')));
      const found = await guardWarnings();
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(scriptRel('read-only'));
      expect(found[0]).toMatch(/code-reviewer/);
    });

    it('reports a script edited by hand as content drift, like any managed file', async () => {
      await install(true);
      await fs.appendFile(at(scriptRel('destructive')), '\nprocess.exit(0);\n');
      expect((await warnings()).join('\n')).toMatch(/Content drift \.claude\/hooks\/agents-united-guard\.js/);
    });

    it('still reports a role that lost its hooks line', async () => {
      await install(true);
      const file = at('.claude/agents/backend-architect.md');
      await fs.writeFile(file, read(file).replace(/^ {2}PreToolUse: .*$/m, '  PreToolUse: []'));
      expect((await warnings()).join('\n')).toMatch(/Native agent backend-architect holds a shell or file writer but carries no guard/);
    });
  });
});

describe('a GLOBAL native Claude install keeps the inline guard (no portable way to name a script)', () => {
  const home = path.resolve(process.cwd(), 'scratch/test-native-claude-guard-global-home');

  beforeEach(async () => {
    await fs.remove(home);
    await fs.ensureDir(home);
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('HOME', home);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.remove(home);
  });

  it('writes the roles with `node -e <script>` into the home directory and no script file', async () => {
    // Safety: a global install writes into the home directory, so refuse to run unless the override took effect.
    expect(path.resolve(os.homedir()), 'the home override did not take effect; refusing to install globally').toBe(home);
    await new InstallEngine().install(BUNDLE, { global: true, method: 'copy', fanout: ['claude'], nativeLane: true } as never);
    for (const [name, kind] of Object.entries(ROLES)) {
      const text = read(path.join(home, '.claude/agents', `${name}.md`));
      const handler = preToolUseGroups(text)[0].hooks[0];
      expect([handler.command, handler.args?.[0]], name).toEqual(['node', '-e']);
      expect(handler.args?.[1], name).toBe(kind === 'read-only' ? READ_ONLY_GUARD_SCRIPT : GUARD_SCRIPT);
      expect(inspectNativeAgent(text).guard, name).toBe(kind);
    }
    expect(await fs.pathExists(path.join(home, '.claude/hooks'))).toBe(false);
    const reviewer = read(path.join(home, '.claude/agents/code-reviewer.md'));
    expect(attempt(reviewer, home, { tool: 'Write', input: { file_path: path.join(home, 'a.ts') } }).blocked).toBe(true);
  });
});
