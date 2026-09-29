import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

/**
 * Plan 024 Step S4 — RED suite for the opt-in command-permission preset (owner decisions
 * E2/E4, approved 2026-09-27).
 *
 * Field finding (2026-09-27): outside auto mode, a background specialist cannot stop to ask
 * for command approval, so `npm test` / `npx tsc` get refused and the specialist can write code
 * but never prove it runs. The preset pre-approves a small, host-neutral set of commands.
 *
 * Security posture (owner asked whether this is a risk — yes, mitigated by design):
 *   - opt-in only, never implied by `-y`;
 *   - written ONLY to the per-user `.claude/settings.local.json`, never the shared/committed
 *     `.claude/settings.json` — regardless of which `sessionGuard` variant is also active;
 *   - `git commit`, `git push`, `rm`, `curl`/`wget`, and any deploy/publish command are excluded
 *     from every tier, unconditionally;
 *   - two tiers: `verify` (default) is fixed read/test commands only; `build` (must be requested
 *     explicitly) additionally allows `npm install` / `npm run` / `npm test`, which execute code
 *     the agent can edit (package scripts) — never on by default;
 *   - the managed guard (Plan 022/023) still runs before every allowed command;
 *   - remove-only-ours uninstall and doctor reporting, exactly like the session guard (Plan 023).
 *
 * Host-neutral design: tiers are defined as plain command prefixes, independent of any host's
 * settings syntax; a per-host renderer turns them into that host's format. Only Claude is
 * implemented today (`Bash(<cmd> *)` entries in `permissions.allow`); every other host reports
 * "not supported yet" rather than guessing a file format.
 *
 * RED-PHASE CONTRACT — `../src/core/permission-preset.js` lands in this step. Module access goes
 * through `api()` with a non-literal specifier (tsc stays green; a missing module surfaces as a
 * descriptive MISSING API failure). Expected surface:
 *
 *   type PermissionTier = 'verify' | 'build'
 *   PERMISSION_TIER_COMMANDS: Record<PermissionTier, readonly string[]>
 *   NEVER_PRESET: readonly RegExp[]
 *   claudeAllowEntries(tier): string[]
 *   mergePermissionPreset(file, tier): Promise<{ status; entries: string[] }>
 *   removePermissionPreset(file, entries, opts: { createdFile }): Promise<RemoveStatus>
 */
interface PermissionPresetModule {
  PERMISSION_TIER_COMMANDS: Record<'verify' | 'build', readonly string[]>;
  NEVER_PRESET: readonly RegExp[];
  claudeAllowEntries(tier: 'verify' | 'build'): string[];
  mergePermissionPreset(file: string, tier: 'verify' | 'build'): Promise<{ status: string; entries: string[] }>;
  removePermissionPreset(file: string, entries: string[], opts: { createdFile: boolean }): Promise<string>;
}

async function api(): Promise<PermissionPresetModule> {
  const specifier = '../src/core/permission-preset.js';
  const mod = (await import(specifier).catch((err: unknown) => {
    throw new Error(
      `MISSING API: src/core/permission-preset.ts cannot be loaded (Plan 024 Step S4 contract) — ${err instanceof Error ? err.message : String(err)}`,
    );
  })) as Partial<PermissionPresetModule>;
  for (const name of ['PERMISSION_TIER_COMMANDS', 'NEVER_PRESET', 'claudeAllowEntries', 'mergePermissionPreset', 'removePermissionPreset'] as const) {
    if (mod[name] === undefined) throw new Error(`MISSING API: permission-preset.ts must export ${name} (Plan 024 Step S4)`);
  }
  return mod as PermissionPresetModule;
}

const WS = path.resolve(process.cwd(), 'scratch/test-permission-preset-workspace');
const AGENTS_DIR = path.join(WS, '.agents');
const LOCAL = path.join(WS, '.claude', 'settings.local.json');
const SHARED = path.join(WS, '.claude', 'settings.json');
const BUNDLE = 'software-engineering';

const readJson = async (file: string): Promise<Record<string, any>> => fs.readJson(file);
const lockfile = async (): Promise<Record<string, any>> => fs.readJson(path.join(AGENTS_DIR, 'agents-united.json'));

beforeEach(async () => {
  await fs.remove(WS);
  await fs.ensureDir(WS);
});
afterEach(async () => {
  await fs.remove(WS);
});

describe('Plan 024 S4 — permission tiers (unit, no I/O)', () => {
  it('never includes a destructive or exfiltration command, in either tier', async () => {
    const { PERMISSION_TIER_COMMANDS, NEVER_PRESET } = await api();
    for (const tier of ['verify', 'build'] as const) {
      for (const cmd of PERMISSION_TIER_COMMANDS[tier]) {
        for (const pattern of NEVER_PRESET) {
          expect(pattern.test(cmd), `${tier} tier command "${cmd}" matches forbidden pattern ${pattern}`).toBe(false);
        }
      }
    }
  });

  it('NEVER_PRESET itself rejects the commands it names', async () => {
    const { NEVER_PRESET } = await api();
    const dangerous = ['git push origin main', 'git commit -m x', 'rm -rf .', 'curl http://evil', 'wget http://evil', 'vercel deploy --prod', 'npm publish'];
    for (const cmd of dangerous) {
      expect(NEVER_PRESET.some(p => p.test(cmd)), cmd).toBe(true);
    }
  });

  it('build is a strict superset of verify, and only build grants npm install/run/test', async () => {
    const { PERMISSION_TIER_COMMANDS } = await api();
    for (const cmd of PERMISSION_TIER_COMMANDS.verify) {
      expect(PERMISSION_TIER_COMMANDS.build).toContain(cmd);
    }
    expect(PERMISSION_TIER_COMMANDS.verify.some(c => c.startsWith('npm install'))).toBe(false);
    expect(PERMISSION_TIER_COMMANDS.verify.some(c => c.startsWith('npm run'))).toBe(false);
    expect(PERMISSION_TIER_COMMANDS.build.some(c => c.startsWith('npm install'))).toBe(true);
    expect(PERMISSION_TIER_COMMANDS.build.some(c => c.startsWith('npm run'))).toBe(true);
  });

  it('claudeAllowEntries renders each command as a Bash(<cmd> *) allow entry', async () => {
    const { claudeAllowEntries, PERMISSION_TIER_COMMANDS } = await api();
    const entries = claudeAllowEntries('verify');
    expect(entries).toHaveLength(PERMISSION_TIER_COMMANDS.verify.length);
    for (const cmd of PERMISSION_TIER_COMMANDS.verify) {
      expect(entries).toContain(`Bash(${cmd} *)`);
    }
  });
});

describe('Plan 024 S4 — merge engine (unit, file I/O)', () => {
  it('creates settings.local.json with the verify tier when absent', async () => {
    const { mergePermissionPreset, claudeAllowEntries } = await api();
    const result = await mergePermissionPreset(LOCAL, 'verify');
    expect(result.status).toBe('created');
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(claudeAllowEntries('verify')));
  });

  it('merges into an existing local file, keeping the user\'s own permissions and other keys', async () => {
    const { mergePermissionPreset } = await api();
    await fs.outputJson(LOCAL, { permissions: { allow: ['Bash(npm run build)'], deny: ['Read(./secrets/**)'] }, env: { FOO: 'bar' } }, { spaces: 2 });
    await mergePermissionPreset(LOCAL, 'verify');
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow).toContain('Bash(npm run build)');
    expect(settings.permissions.deny).toEqual(['Read(./secrets/**)']);
    expect(settings.env).toEqual({ FOO: 'bar' });
  });

  it('is idempotent: a second merge adds nothing new', async () => {
    const { mergePermissionPreset } = await api();
    await mergePermissionPreset(LOCAL, 'verify');
    const before = await fs.readFile(LOCAL, 'utf8');
    expect((await mergePermissionPreset(LOCAL, 'verify')).status).toBe('unchanged');
    expect(await fs.readFile(LOCAL, 'utf8')).toBe(before);
  });

  it('upgrading verify -> build adds only the new entries', async () => {
    const { mergePermissionPreset, claudeAllowEntries } = await api();
    await mergePermissionPreset(LOCAL, 'verify');
    const result = await mergePermissionPreset(LOCAL, 'build');
    expect(result.status).toBe('merged');
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(claudeAllowEntries('build')));
  });

  it('never rewrites invalid JSON', async () => {
    const { mergePermissionPreset } = await api();
    const jsonc = '{\n  // comment\n  "env": {}\n}\n';
    await fs.outputFile(LOCAL, jsonc);
    expect((await mergePermissionPreset(LOCAL, 'verify')).status).toBe('skipped-invalid');
    expect(await fs.readFile(LOCAL, 'utf8')).toBe(jsonc);
  });

  it('remove takes out only the recorded entries and leaves the rest untouched', async () => {
    const { mergePermissionPreset, removePermissionPreset } = await api();
    await fs.outputJson(LOCAL, { permissions: { allow: ['Bash(npm run build)'] } }, { spaces: 2 });
    const { entries } = await mergePermissionPreset(LOCAL, 'verify');
    expect(await removePermissionPreset(LOCAL, entries, { createdFile: false })).toBe('removed');
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow).toEqual(['Bash(npm run build)']);
  });

  it('remove deletes a file it created once nothing remains', async () => {
    const { mergePermissionPreset, removePermissionPreset } = await api();
    const { entries } = await mergePermissionPreset(LOCAL, 'verify');
    expect(await removePermissionPreset(LOCAL, entries, { createdFile: true })).toBe('deleted-file');
    expect(await fs.pathExists(LOCAL)).toBe(false);
  });
});

describe('Plan 024 S4 — installer/uninstaller integration', () => {
  const add = (opts: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: AGENTS_DIR, method: 'copy', fanout: ['claude'], ...opts } as never);

  it('is off by default: no permissionPreset option writes nothing', async () => {
    await add();
    expect(await fs.pathExists(LOCAL)).toBe(false);
  });

  it('"verify" writes only .claude/settings.local.json, never .claude/settings.json', async () => {
    await add({ permissionPreset: 'verify' });
    expect(await fs.pathExists(LOCAL)).toBe(true);
    expect(await fs.pathExists(SHARED)).toBe(false);
    const lock = await lockfile();
    expect(lock.permissionPreset.tier).toBe('verify');
    expect(lock.permissionPreset.file).toBe('.claude/settings.local.json');
  });

  it('permissions never land in settings.json even when sessionGuard: "project" is also requested', async () => {
    await add({ permissionPreset: 'verify', sessionGuard: 'project' });
    expect(await fs.pathExists(LOCAL)).toBe(true);
    const shared = await readJson(SHARED);
    expect(shared.permissions).toBeUndefined();
  });

  it('"build" tier is opt-in and never implied', async () => {
    await add({ permissionPreset: 'verify' });
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow.some((e: string) => e.includes('npm install'))).toBe(false);
  });

  it('uninstalling the last bundle removes only our recorded entries', async () => {
    await fs.outputJson(LOCAL, { permissions: { allow: ['Bash(npm run build)'] } }, { spaces: 2 });
    await add({ permissionPreset: 'verify' });
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: AGENTS_DIR, yes: true } as never);
    const settings = await readJson(LOCAL);
    expect(settings.permissions.allow).toEqual(['Bash(npm run build)']);
  });

  it('a fan-out that includes a host with no verified renderer yet gets an honest "not supported" note, and no file is guessed for it', async () => {
    const result = await new InstallEngine().install(BUNDLE, {
      targetDir: AGENTS_DIR, method: 'copy', fanout: ['claude', 'cline'], permissionPreset: 'verify',
    } as never);
    expect(await fs.pathExists(LOCAL)).toBe(true); // claude still gets it
    expect(await fs.pathExists(path.join(WS, '.cline'))).toBe(true); // cline lane still ran
    const clineFiles = await fs.readdir(path.join(WS, '.cline')).catch(() => []);
    expect(clineFiles.some(f => /permission/i.test(f))).toBe(false); // but no guessed cline permission file
    const warnings = result.projections.flatMap(p => p.warnings ?? []);
    expect(warnings.some(w => /permission preset.*not supported.*cline/i.test(w))).toBe(true);
  });
});
