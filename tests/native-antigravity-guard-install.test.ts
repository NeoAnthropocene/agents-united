import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ANTIGRAVITY_GUARD_SCRIPT,
  ANTIGRAVITY_HOOKS_FILE,
  ANTIGRAVITY_HOOK_NAME,
  hookEntryHash,
  inspectAntigravityHook,
  loadGuardHookEntry,
  mergeAntigravityHook,
  removeAntigravityHook,
} from '../src/core/antigravity-hooks.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { ANTIGRAVITY_WRITER_TOOLS, inspectAntigravityNativeAgent } from '../src/core/native-guard.js';
import { nativeHookSource, renderNativeHook } from '../src/core/native-package.js';
import { loadToolPolicy } from '../src/core/host-profile.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 032 Phase 8 / ADR 0031 addendum — the Antigravity guard in the `--native` lane. The script is a tracked projection (hash, owners,
 * refcounted like every native file). `.agents/hooks.json` is the user's own file and is only MERGED: our one key `agents-united-guard` is
 * added beside whatever hooks the user has, formatting is kept, and removing the guard removes that key and nothing else. Whether the hook
 * is in effect is judged by that key alone, so a hook the user adds never reads as drift.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const read = (file: string): string => fs.readFileSync(file, 'utf8');
const entry = loadGuardHookEntry(REGISTRY);
const USER_HOOKS = { 'my-linter': { PostToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: './scripts/lint.sh', timeout: 10 }] }] } };

describe('the guard hook entry', () => {
  it('is the one key of the committed hooks.json, with a hash that ignores key order and white space', () => {
    expect(ANTIGRAVITY_HOOK_NAME).toBe('agents-united-guard');
    expect(entry).toEqual(JSON.parse(read(path.join(REGISTRY, 'hosts/antigravity/hooks/hooks.json')))[ANTIGRAVITY_HOOK_NAME]);
    expect(hookEntryHash(entry)).toMatch(/^[0-9a-f]{16}$/);
    expect(hookEntryHash(JSON.parse(JSON.stringify(entry, null, 4)))).toBe(hookEntryHash(entry));
    expect(hookEntryHash({ b: 1, a: { d: 2, c: 3 } })).toBe(hookEntryHash({ a: { c: 3, d: 2 }, b: 1 }));
    expect(hookEntryHash({ ...entry, enabled: false })).not.toBe(hookEntryHash(entry));
  });

  it('names the file and the script the lane installs, and the writer tools the doctor looks for are exactly the catalog\'s shell and editing tools', () => {
    expect(ANTIGRAVITY_HOOKS_FILE).toBe('.agents/hooks.json');
    expect(ANTIGRAVITY_GUARD_SCRIPT).toBe('.agents/hooks/agents-united-guard.js');
    expect(nativeHookSource(REGISTRY, 'antigravity', 'agents-united-guard')).toBe(path.join(REGISTRY, 'hosts/antigravity/hooks/agents-united-guard.js'));
    const guarded = loadToolPolicy(REGISTRY, 'antigravity').catalog.filter(tool => ['shell', 'edit'].includes(tool.class)).map(tool => tool.name).sort();
    expect([...ANTIGRAVITY_WRITER_TOOLS].sort()).toEqual(guarded);
  });

  it('is installed as code the host runs, unchanged, with the marker as a trailing comment', () => {
    const source = read(path.join(REGISTRY, 'hosts/antigravity/hooks/agents-united-guard.js'));
    const rendered = renderNativeHook(source, 'hosts/antigravity/hooks/agents-united-guard.js', 'antigravity');
    expect(rendered.startsWith(source.replace(/\r\n/g, '\n').replace(/\n*$/, '\n'))).toBe(true);
    const last = rendered.trimEnd().split('\n').pop()!;
    expect(last).toMatch(/^\/\/ managed-by: agents-united \| profile: antigravity-native \| canonical: hosts\/antigravity\/hooks\/agents-united-guard\.js \| source: sha256:[0-9a-f]{64} \| do not edit$/);
  });
});

describe('inspecting what an agent says about itself', () => {
  it('reads the tools of a native agent and says whether it holds one that runs a command or writes a file', () => {
    const writer = read(path.join(REGISTRY, 'hosts/antigravity/agents/backend-architect.md'));
    const reader = read(path.join(REGISTRY, 'hosts/antigravity/agents/code-reviewer.md'));
    expect(inspectAntigravityNativeAgent(writer).holdsWriter).toBe(true);
    expect(inspectAntigravityNativeAgent(reader).holdsWriter).toBe(false);
    expect(inspectAntigravityNativeAgent(reader).tools).toContain('view_file');
    expect(inspectAntigravityNativeAgent('no frontmatter at all')).toEqual({ tools: [], holdsWriter: false });
    expect(inspectAntigravityNativeAgent('---\r\ntools:\r\n  - run_command\r\n---\r\n').holdsWriter).toBe(true);
  });
});

describe('merging into hooks.json', () => {
  const dir = path.resolve(process.cwd(), 'scratch/test-antigravity-hooks-merge');
  const file = path.join(dir, '.agents/hooks.json');
  beforeEach(async () => {
    await fs.remove(dir);
    await fs.ensureDir(dir);
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('creates the file when there is none, with only our key', async () => {
    const result = await mergeAntigravityHook(file, entry);
    expect(result.status).toBe('created');
    expect(result.entryHash).toBe(hookEntryHash(entry));
    expect(JSON.parse(read(file))).toEqual({ [ANTIGRAVITY_HOOK_NAME]: entry });
    expect(await inspectAntigravityHook(file, entry)).toBe('wired');
  });

  it('adds the key beside the user\'s own hooks, keeps their order, indent, line endings and final newline, and is idempotent', async () => {
    const before = `${JSON.stringify(USER_HOOKS, null, '\t').replace(/\n/g, '\r\n')}\r\n`;
    await fs.outputFile(file, before);
    expect((await mergeAntigravityHook(file, entry)).status).toBe('merged');
    const merged = read(file);
    expect(Object.keys(JSON.parse(merged))).toEqual(['my-linter', ANTIGRAVITY_HOOK_NAME]);
    expect(JSON.parse(merged)['my-linter']).toEqual(USER_HOOKS['my-linter']);
    expect(merged).toContain('\r\n\t"my-linter"');
    expect(merged.endsWith('\r\n')).toBe(true);
    expect(merged).not.toMatch(/[^\r]\n/);
    expect((await mergeAntigravityHook(file, entry)).status).toBe('unchanged');
    expect(read(file)).toBe(merged);
  });

  it('never rewrites a file it cannot parse as strict JSON, nor a root that is not an object', async () => {
    for (const text of ['{ // a comment\n "x": {} }', '{ "x": {}, }', '[]', 'null', '']) {
      await fs.outputFile(file, text);
      expect((await mergeAntigravityHook(file, entry)).status, JSON.stringify(text)).toBe('skipped-invalid');
      expect(read(file)).toBe(text);
      expect(await inspectAntigravityHook(file, entry)).toBe('skipped-invalid');
      expect(await removeAntigravityHook(file, { createdFile: false })).toBe('skipped-invalid');
      expect(read(file)).toBe(text);
    }
  });

  it('leaves a key the user edited alone (modified) and never auto-repairs it, but replaces an older version of ours that it recorded', async () => {
    const edited = { ...entry, enabled: false };
    await fs.outputFile(file, JSON.stringify({ [ANTIGRAVITY_HOOK_NAME]: edited }, null, 2));
    const before = read(file);
    expect((await mergeAntigravityHook(file, entry)).status).toBe('modified');
    expect(read(file)).toBe(before);
    expect(await inspectAntigravityHook(file, entry)).toBe('disabled');

    const older = { PreToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: 'node hooks/agents-united-guard.js', timeout: 5 }] }] };
    await fs.outputFile(file, JSON.stringify({ [ANTIGRAVITY_HOOK_NAME]: older, other: {} }, null, 2));
    expect(await inspectAntigravityHook(file, entry)).toBe('modified');
    expect((await mergeAntigravityHook(file, entry)).status).toBe('modified');
    expect((await mergeAntigravityHook(file, entry, { replaceHash: hookEntryHash(older) })).status).toBe('merged');
    expect(JSON.parse(read(file))).toEqual({ [ANTIGRAVITY_HOOK_NAME]: entry, other: {} });
  });

  it('inspects only our key: other hooks, reformatting and key order do not matter', async () => {
    expect(await inspectAntigravityHook(file, entry)).toBe('absent');
    await fs.outputFile(file, JSON.stringify(USER_HOOKS));
    expect(await inspectAntigravityHook(file, entry)).toBe('missing');
    await fs.outputFile(file, JSON.stringify({ ...USER_HOOKS, [ANTIGRAVITY_HOOK_NAME]: JSON.parse(JSON.stringify(entry)), later: {} }, null, 8));
    expect(await inspectAntigravityHook(file, entry)).toBe('wired');
  });

  it('removes only our key, restoring the user\'s bytes, and deletes the file only when it created it and nothing else is left', async () => {
    const original = `${JSON.stringify(USER_HOOKS, null, 2)}\n`;
    await fs.outputFile(file, original);
    await mergeAntigravityHook(file, entry);
    expect(await removeAntigravityHook(file, { createdFile: false })).toBe('removed');
    expect(read(file)).toBe(original);
    expect(await removeAntigravityHook(file, { createdFile: false })).toBe('absent');

    await fs.remove(file);
    await mergeAntigravityHook(file, entry);
    expect(await removeAntigravityHook(file, { createdFile: true })).toBe('deleted-file');
    expect(await fs.pathExists(file)).toBe(false);

    await fs.outputFile(file, JSON.stringify({ [ANTIGRAVITY_HOOK_NAME]: entry }));
    expect(await removeAntigravityHook(file, { createdFile: false })).toBe('removed');
    expect(JSON.parse(read(file))).toEqual({});
    expect(await removeAntigravityHook(path.join(dir, 'nothing.json'), { createdFile: true })).toBe('absent');
  });
});

describe('the guard in the native install lane (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-guard');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const at = (rel: string): string => path.join(workspace, rel);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, bundle = BUNDLE) =>
    new InstallEngine().install(bundle, { targetDir: agentsDir, method: 'copy', nativeLane, ...extra });
  const expectedScript = (): string =>
    renderNativeHook(read(nativeHookSource(REGISTRY, 'antigravity', 'agents-united-guard')!), 'hosts/antigravity/hooks/agents-united-guard.js', 'antigravity');
  const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
  const wired = (): Record<string, unknown> => JSON.parse(read(at(ANTIGRAVITY_HOOKS_FILE))) as Record<string, unknown>;

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is off with the lane: nothing is written, nothing recorded', async () => {
    await install();
    expect(await fs.pathExists(at(ANTIGRAVITY_HOOKS_FILE))).toBe(false);
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
    expect((await fs.readJson(lockPath)).antigravityHooks).toBeUndefined();
  });

  it('installs the script as a tracked projection and registers it in a new hooks.json', async () => {
    await install(true);
    expect(read(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(expectedScript());
    expect(wired()).toEqual({ [ANTIGRAVITY_HOOK_NAME]: entry });
    const lock = await fs.readJson(lockPath);
    const record = lock.projections[ANTIGRAVITY_GUARD_SCRIPT];
    expect(record).toMatchObject({ host: 'antigravity', kind: 'hook', managedMarker: true });
    expect(record.owners).toContain(BUNDLE);
    expect(record.hash).toBe(sha256(read(at(ANTIGRAVITY_GUARD_SCRIPT))));
    expect(lock.antigravityHooks).toEqual({ file: ANTIGRAVITY_HOOKS_FILE, entryHash: hookEntryHash(entry), createdFile: true });
    // hooks.json is the user's file, so it is not a hashed projection.
    expect(lock.projections[ANTIGRAVITY_HOOKS_FILE]).toBeUndefined();
  });

  it('merges into a hooks.json the user already has, and keeps their hooks through update, a lane switch and removal', async () => {
    const user = `${JSON.stringify(USER_HOOKS, null, 2)}\n`;
    await fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), user);
    await install(true);
    expect(Object.keys(wired())).toEqual(['my-linter', ANTIGRAVITY_HOOK_NAME]);
    expect((await fs.readJson(lockPath)).antigravityHooks.createdFile).toBe(false);

    await install(undefined, { force: true }); // what `agents update` does: the lane and the guard are sticky
    expect(Object.keys(wired())).toEqual(['my-linter', ANTIGRAVITY_HOOK_NAME]);
    expect(read(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(expectedScript());

    await install(false, { force: true });
    expect(read(at(ANTIGRAVITY_HOOKS_FILE))).toBe(user);
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
    expect((await fs.readJson(lockPath)).antigravityHooks).toBeUndefined();

    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(read(at(ANTIGRAVITY_HOOKS_FILE))).toBe(user);
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
  });

  it('is byte-stable: a second install changes neither file', async () => {
    await install(true);
    const hooks = read(at(ANTIGRAVITY_HOOKS_FILE));
    const script = read(at(ANTIGRAVITY_GUARD_SCRIPT));
    await install(true);
    expect(read(at(ANTIGRAVITY_HOOKS_FILE))).toBe(hooks);
    expect(read(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(script);
  });

  it('turning the lane off removes the key, the script and the folder, and deletes a hooks.json it created', async () => {
    await install(true);
    await install(false, { force: true });
    expect(await fs.pathExists(at(ANTIGRAVITY_HOOKS_FILE))).toBe(false);
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
    expect(await fs.pathExists(at('.agents/hooks'))).toBe(false);
  });

  it('removing the bundle removes the script, the key and a hooks.json it created, and nothing else of the user\'s', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(await fs.pathExists(at(ANTIGRAVITY_HOOKS_FILE))).toBe(false);
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
    expect((await fs.readJson(lockPath)).antigravityHooks).toBeUndefined();
  });

  it('is shared by bundles: it stays until the last bundle that owns it is removed', async () => {
    await install(true);
    await install(undefined, {}, 'system-architecture');
    expect((await fs.readJson(lockPath)).projections[ANTIGRAVITY_GUARD_SCRIPT].owners).toEqual(expect.arrayContaining([BUNDLE, 'system-architecture']));
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(true);
    expect(wired()).toEqual({ [ANTIGRAVITY_HOOK_NAME]: entry });
    await new UninstallEngine().uninstall('system-architecture', { targetDir: agentsDir });
    expect(await fs.pathExists(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(false);
    expect(await fs.pathExists(at(ANTIGRAVITY_HOOKS_FILE))).toBe(false);
  });

  it('leaves a hooks.json it cannot parse untouched, says so, and still installs the script', async () => {
    const jsonc = '{ // my hooks\n  "mine": {}\n}\n';
    await fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), jsonc);
    const result = await install(true);
    expect(read(at(ANTIGRAVITY_HOOKS_FILE))).toBe(jsonc);
    expect(read(at(ANTIGRAVITY_GUARD_SCRIPT))).toBe(expectedScript());
    const info = result.projections.find(p => p.path === ANTIGRAVITY_HOOKS_FILE);
    expect(info?.warnings.join('\n')).toMatch(/not valid JSON/);
    expect(info?.warnings.join('\n')).toContain(ANTIGRAVITY_HOOK_NAME);
  });

  it('a dry run reports the script and hooks.json and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toEqual(expect.arrayContaining([ANTIGRAVITY_GUARD_SCRIPT, ANTIGRAVITY_HOOKS_FILE]));
    expect(await fs.pathExists(at('.agents'))).toBe(false);
  });

  describe('doctor', () => {
    const warnings = async (): Promise<string[]> => (await DoctorEngine.runDoctor(agentsDir)).warnings;
    const guardWarnings = async (): Promise<string[]> => (await warnings()).filter(w => /guard hook/i.test(w));

    it('finds a fresh install healthy', async () => {
      await install(true);
      const report = await DoctorEngine.runDoctor(agentsDir);
      expect(report.issues).toEqual([]);
      expect(await guardWarnings()).toEqual([]);
    });

    it('does not read a hook the user added as drift, and does not mind a reformatted file', async () => {
      await install(true);
      await fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), JSON.stringify({ ...USER_HOOKS, ...wired(), 'another': { Stop: [] } }, null, 8));
      const report = await DoctorEngine.runDoctor(agentsDir);
      expect(report.issues).toEqual([]);
      expect(report.warnings.filter(w => /hooks|drift|guard/i.test(w))).toEqual([]);
    });

    it('warns that the guard is not in effect when the script is gone', async () => {
      await install(true);
      await fs.remove(at(ANTIGRAVITY_GUARD_SCRIPT));
      const text = (await guardWarnings()).join('\n');
      expect(text).toMatch(/backend-architect/);
      expect(text).toContain(ANTIGRAVITY_GUARD_SCRIPT);
      expect(text).toMatch(/agents update software-engineering --native/);
    });

    it.each([
      ['hooks.json is deleted', async (): Promise<void> => void (await fs.remove(at(ANTIGRAVITY_HOOKS_FILE))), /does not exist/],
      ['our key is removed from hooks.json', async (): Promise<void> => fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), JSON.stringify(USER_HOOKS)), /no 'agents-united-guard' entry/],
      ['our key is switched off', async (): Promise<void> => fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), JSON.stringify({ [ANTIGRAVITY_HOOK_NAME]: { ...entry, enabled: false } })), /disabled/],
      ['our key is edited by hand', async (): Promise<void> => fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), JSON.stringify({ [ANTIGRAVITY_HOOK_NAME]: { PreToolUse: [] } })), /edited by hand/],
      ['hooks.json stops being valid JSON', async (): Promise<void> => fs.outputFile(at(ANTIGRAVITY_HOOKS_FILE), '{ nope'), /not valid JSON/],
    ])('warns when %s', async (_label, damage, reason) => {
      await install(true);
      await damage();
      const text = (await guardWarnings()).join('\n');
      expect(text).toMatch(reason);
      expect(text).toMatch(/can run commands or edit files/);
    });

    it('says nothing when no installed native role can run a command or edit a file, because there is nothing to guard', async () => {
      await install(true);
      const lock = await fs.readJson(lockPath);
      for (const rel of Object.keys(lock.projections)) {
        if (!rel.startsWith('.agents/agents/')) continue;
        const text = read(at(rel));
        if (inspectAntigravityNativeAgent(text).holdsWriter) await fs.remove(at(rel));
      }
      await fs.remove(at(ANTIGRAVITY_HOOKS_FILE));
      expect(await guardWarnings()).toEqual([]);
    });

    it('is silent when the lane is off', async () => {
      await install();
      expect(await guardWarnings()).toEqual([]);
    });
  });
});
