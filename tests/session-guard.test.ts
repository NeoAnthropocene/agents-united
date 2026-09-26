import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { guardHandler } from '../src/core/guard.js';

/**
 * Plan 023 Workstream A / Step A1 — RED suite for the plain-session guard (owner decisions
 * D1–D2, approved 2026-09-26).
 *
 * The Plan 022 guard lives in role frontmatter, so a plain `claude` session (no `--agent`) is
 * unguarded. A1–A2 add ONE consent-gated managed entry to project `.claude/settings.json`
 * (`local` variant: `.claude/settings.local.json`; user-global never by default). Hook entries
 * merge across settings levels (Claude Code hooks reference), so our two PreToolUse groups sit
 * beside the user's own hooks. This is the first write into a user-owned settings file, so the
 * contract is conservative:
 *   - create when absent; merge-preserving every other key/entry when present; idempotent;
 *   - invalid JSON (incl. JSONC comments) is NEVER rewritten — skipped with a warning;
 *   - ownership = exact handler equality (command + args), recorded as a hash in the lockfile;
 *   - uninstall removes only our groups; deletes the file only if we created it and it is empty;
 *   - doctor reports wired | missing | modified | skipped-invalid | off;
 *   - consent is sticky in the lockfile; global scope is off unless explicitly requested.
 *
 * RED-PHASE CONTRACT — `../src/core/session-guard.js` lands in Step A2. Module access goes
 * through `api()` (the `creationApi()` pattern): a missing module or export surfaces as a
 * descriptive "MISSING API" error, never a collection-time crash. Expected surface:
 *
 *   mergeSessionGuard(file: string): Promise<{ status: 'created'|'merged'|'unchanged'|'skipped-invalid'; handlerHash: string }>
 *   removeSessionGuard(file: string, opts: { createdFile: boolean }): Promise<'removed'|'deleted-file'|'absent'|'skipped-invalid'>
 *   inspectSessionGuard(file: string): Promise<'wired'|'missing'|'modified'|'skipped-invalid'|'absent'>
 *   guardHandlerHash(): string
 *
 * Integration surface: InstallOptions.sessionGuard?: 'project'|'local'|'user'|false;
 * lockfile `sessionGuard: { file, handlerHash, createdFile } | { off: true }`;
 * HealthReport.sessionGuard?: 'wired'|'missing'|'modified'|'skipped-invalid'|'off'.
 */
interface SessionGuardModule {
  mergeSessionGuard(file: string): Promise<{ status: string; handlerHash: string }>;
  removeSessionGuard(file: string, opts: { createdFile: boolean }): Promise<string>;
  inspectSessionGuard(file: string): Promise<string>;
  guardHandlerHash(): string;
}

async function api(): Promise<SessionGuardModule> {
  // A non-literal specifier keeps `tsc` green while the module does not exist yet (RED phase).
  const specifier = '../src/core/session-guard.js';
  const mod = (await import(specifier).catch((err: unknown) => {
    throw new Error(
      `MISSING API: src/core/session-guard.ts cannot be loaded (Plan 023 Step A2 contract) — ${err instanceof Error ? err.message : String(err)}`,
    );
  })) as unknown as Partial<SessionGuardModule>;
  for (const name of ['mergeSessionGuard', 'removeSessionGuard', 'inspectSessionGuard', 'guardHandlerHash'] as const) {
    if (typeof mod[name] !== 'function') throw new Error(`MISSING API: session-guard.ts must export ${name} (Plan 023 Step A2)`);
  }
  return mod as SessionGuardModule;
}

const WORKSPACE = path.resolve(process.cwd(), 'scratch/test-session-guard-workspace');
const AGENTS_DIR = path.join(WORKSPACE, '.agents');
const SETTINGS = path.join(WORKSPACE, '.claude', 'settings.json');
const SETTINGS_LOCAL = path.join(WORKSPACE, '.claude', 'settings.local.json');

/** A realistic user file: permissions, env, and the user's OWN PreToolUse hook. CRLF + 4-space indent. */
const USER_SETTINGS = {
  permissions: { allow: ['Bash(npm test)'], deny: ['Read(./secrets/**)'] },
  env: { FOO: 'bar' },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/audit.sh' }] }],
  },
};
const USER_SETTINGS_TEXT = JSON.stringify(USER_SETTINGS, null, 4).replace(/\n/g, '\r\n') + '\r\n';

type Group = { matcher: string; hooks: Array<{ type: string; command: string; args?: string[] }> };
const readJson = async (file: string): Promise<{ hooks?: { PreToolUse?: Group[] } } & Record<string, unknown>> => fs.readJson(file);
const isOurs = (group: Group): boolean =>
  group.hooks.some(h => h.command === guardHandler().command && JSON.stringify(h.args) === JSON.stringify(guardHandler().args));
const ourGroups = (settings: { hooks?: { PreToolUse?: Group[] } }): Group[] => (settings.hooks?.PreToolUse ?? []).filter(isOurs);
const lockfile = async (): Promise<Record<string, any>> => fs.readJson(path.join(AGENTS_DIR, 'agents-united.json'));

beforeEach(async () => {
  await fs.remove(WORKSPACE);
  await fs.ensureDir(WORKSPACE);
});
afterEach(async () => {
  await fs.remove(WORKSPACE);
});

describe('Plan 023 A — session-guard merge engine (unit)', () => {
  it('creates the settings file with exactly our two exec-form groups when absent', async () => {
    const { mergeSessionGuard, guardHandlerHash } = await api();
    const result = await mergeSessionGuard(SETTINGS);
    expect(result).toEqual({ status: 'created', handlerHash: guardHandlerHash() });
    const settings = await readJson(SETTINGS);
    expect(Object.keys(settings)).toEqual(['hooks']);
    expect(ourGroups(settings).map(g => g.matcher)).toEqual(['Bash', 'Write|Edit|NotebookEdit']);
  });

  it('merges into an existing file, preserving every other key, the user hook, indent and EOL', async () => {
    const { mergeSessionGuard } = await api();
    await fs.outputFile(SETTINGS, USER_SETTINGS_TEXT);
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('merged');
    const text = await fs.readFile(SETTINGS, 'utf8');
    expect(text).toMatch(/\r\n {4}"permissions"/); // 4-space indent + CRLF kept
    const settings = await readJson(SETTINGS);
    expect(settings.permissions).toEqual(USER_SETTINGS.permissions);
    expect(settings.env).toEqual(USER_SETTINGS.env);
    const pre = settings.hooks!.PreToolUse!;
    expect(pre[0]).toEqual(USER_SETTINGS.hooks.PreToolUse[0]); // user's own hook first, untouched
    expect(ourGroups(settings)).toHaveLength(2);
  });

  it('is idempotent: a second merge changes nothing', async () => {
    const { mergeSessionGuard } = await api();
    await fs.outputFile(SETTINGS, USER_SETTINGS_TEXT);
    await mergeSessionGuard(SETTINGS);
    const once = await fs.readFile(SETTINGS, 'utf8');
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('unchanged');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(once);
  });

  it('never rewrites invalid JSON or JSONC — skipped, bytes untouched', async () => {
    const { mergeSessionGuard, removeSessionGuard, inspectSessionGuard } = await api();
    const jsonc = '{\n  // my comment\n  "env": { "A": "1" },\n}\n';
    await fs.outputFile(SETTINGS, jsonc);
    expect((await mergeSessionGuard(SETTINGS)).status).toBe('skipped-invalid');
    expect(await removeSessionGuard(SETTINGS, { createdFile: false })).toBe('skipped-invalid');
    expect(await inspectSessionGuard(SETTINGS)).toBe('skipped-invalid');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(jsonc);
  });

  it('remove takes out only our groups and restores the user file byte-for-byte', async () => {
    const { mergeSessionGuard, removeSessionGuard } = await api();
    await fs.outputFile(SETTINGS, USER_SETTINGS_TEXT);
    await mergeSessionGuard(SETTINGS);
    expect(await removeSessionGuard(SETTINGS, { createdFile: false })).toBe('removed');
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(USER_SETTINGS_TEXT);
  });

  it('remove deletes a file we created when nothing else remains; keeps it if the user added content', async () => {
    const { mergeSessionGuard, removeSessionGuard } = await api();
    await mergeSessionGuard(SETTINGS);
    expect(await removeSessionGuard(SETTINGS, { createdFile: true })).toBe('deleted-file');
    expect(await fs.pathExists(SETTINGS)).toBe(false);

    await mergeSessionGuard(SETTINGS);
    const withUser = await readJson(SETTINGS);
    await fs.writeJson(SETTINGS, { ...withUser, env: { MINE: '1' } }, { spaces: 2 });
    expect(await removeSessionGuard(SETTINGS, { createdFile: true })).toBe('removed');
    expect(await readJson(SETTINGS)).toEqual({ env: { MINE: '1' } });
  });

  it('inspect reports wired / missing / modified / absent', async () => {
    const { mergeSessionGuard, inspectSessionGuard } = await api();
    expect(await inspectSessionGuard(SETTINGS)).toBe('absent');
    await fs.outputFile(SETTINGS, USER_SETTINGS_TEXT);
    expect(await inspectSessionGuard(SETTINGS)).toBe('missing');
    await mergeSessionGuard(SETTINGS);
    expect(await inspectSessionGuard(SETTINGS)).toBe('wired');
    // a hand-edited guard group (same matcher, altered script) is "modified", never silently repaired
    const settings = await readJson(SETTINGS);
    const pre = settings.hooks!.PreToolUse!;
    const bash = pre.find(g => isOurs(g) && g.matcher === 'Bash')!;
    bash.hooks[0].args = ['-e', 'process.exit(0)'];
    await fs.writeJson(SETTINGS, settings, { spaces: 2 });
    expect(await inspectSessionGuard(SETTINGS)).toBe('modified');
  });
});

describe('Plan 023 A — session guard through install / doctor / uninstall (integration)', () => {
  const add = (opts: Record<string, unknown> = {}) =>
    new InstallEngine().install('software-engineering', { targetDir: AGENTS_DIR, method: 'copy', fanout: ['claude'], ...opts });

  it('consent "project" wires .claude/settings.json and records ownership in the lockfile', async () => {
    const { guardHandlerHash } = await api();
    await add({ sessionGuard: 'project' });
    expect(ourGroups(await readJson(SETTINGS))).toHaveLength(2);
    expect((await lockfile()).sessionGuard).toEqual({
      file: '.claude/settings.json',
      handlerHash: guardHandlerHash(),
      createdFile: true,
    });
    const report = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect((report as unknown as { sessionGuard?: string }).sessionGuard).toBe('wired');
  });

  it('consent "local" wires .claude/settings.local.json instead', async () => {
    await add({ sessionGuard: 'local' });
    expect(ourGroups(await readJson(SETTINGS_LOCAL))).toHaveLength(2);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('declining writes nothing and the decision is sticky across re-installs', async () => {
    await add({ sessionGuard: false });
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    expect((await lockfile()).sessionGuard).toEqual({ off: true });
    await add(); // no flag: inherits the recorded decision
    expect(await fs.pathExists(SETTINGS)).toBe(false);
    const report = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect((report as unknown as { sessionGuard?: string }).sessionGuard).toBe('off');
  });

  it('an approved guard is re-merged on a plain re-install (sticky yes)', async () => {
    await add({ sessionGuard: 'project' });
    await fs.remove(SETTINGS);
    await add();
    expect(ourGroups(await readJson(SETTINGS))).toHaveLength(2);
  });

  it('without the Claude lane, no settings file is ever written', async () => {
    await new InstallEngine().install('software-engineering', { targetDir: AGENTS_DIR, method: 'copy', fanout: ['cline'], sessionGuard: 'project' } as never);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('global scope never writes user settings unless "user" is requested explicitly', async () => {
    const fakeHome = path.join(WORKSPACE, 'home');
    const globalAgents = path.join(fakeHome, '.agents');
    await new InstallEngine().install('software-engineering', {
      targetDir: globalAgents, scope: 'global', method: 'copy', fanout: ['claude'],
    } as never);
    expect(await fs.pathExists(path.join(fakeHome, '.claude', 'settings.json'))).toBe(false);
  });

  it('removing the last bundle removes only our groups; the user file survives byte-for-byte', async () => {
    await fs.outputFile(SETTINGS, USER_SETTINGS_TEXT);
    await add({ sessionGuard: 'project' });
    expect((await lockfile()).sessionGuard.createdFile).toBe(false);
    await new UninstallEngine().uninstall('software-engineering', { targetDir: AGENTS_DIR, yes: true } as never);
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(USER_SETTINGS_TEXT);
  });

  it('removing the last bundle deletes a settings file agents-united created', async () => {
    await add({ sessionGuard: 'project' });
    expect(await fs.pathExists(SETTINGS)).toBe(true);
    await new UninstallEngine().uninstall('software-engineering', { targetDir: AGENTS_DIR, yes: true } as never);
    expect(await fs.pathExists(SETTINGS)).toBe(false);
  });

  it('invalid user JSON: install proceeds, file untouched, doctor warns with the paste-in snippet hint', async () => {
    const jsonc = '{\n  // team settings\n  "env": {}\n}\n';
    await fs.outputFile(SETTINGS, jsonc);
    await add({ sessionGuard: 'project' });
    expect(await fs.readFile(SETTINGS, 'utf8')).toBe(jsonc);
    const report = await DoctorEngine.runDoctor(AGENTS_DIR, 'claude');
    expect((report as unknown as { sessionGuard?: string }).sessionGuard).toBe('skipped-invalid');
    const warning = report.warnings.find(w => /session guard/i.test(w)) ?? '';
    expect(warning).toMatch(/not valid JSON/i);
    expect(warning).toMatch(/paste/i);
  });
});
