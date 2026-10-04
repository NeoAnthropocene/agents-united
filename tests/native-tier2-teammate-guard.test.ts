import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { nativeTeamNote, sessionGuardPrompt } from '../src/core/native-teams.js';

/**
 * Plan 032 close-out follow-up (2), slice 2 (ADR 0036) — a teammate is not guarded by the frontmatter hook of the definition it reuses.
 * Observed on Claude Code 2.1.288 (`host-library/claude/observations/2026-10-04-claude-2.1.288-agent-teams.md`): an in-process teammate
 * reusing a definition with `Write` granted and the read-only guard in its frontmatter wrote a file with no hook record; a settings-level
 * guard refused the same teammate's `git push --force` and `.env` write. So the Tier-2 install must make that gap visible, and the consent
 * prompt for the settings-level guard (maintainer decision: offer it, default yes, warn without it) must say why it matters here.
 */

describe('nativeTeamNote (printed after a native Tier-2 install)', () => {
  const base = { bundle: 'digital-agency', tier: 'organization' as const, nativeLane: true };

  it('is empty for a Tier-1 bundle and for an install without the native lane', () => {
    expect(nativeTeamNote({ ...base, tier: 'domain', sessionGuard: false })).toBeUndefined();
    expect(nativeTeamNote({ ...base, nativeLane: false, sessionGuard: false })).toBeUndefined();
    expect(nativeTeamNote({ ...base, tier: undefined, sessionGuard: false })).toBeUndefined();
  });

  it('says how to start the team, that teams are experimental and interactive, and why a settings-level guard matters', () => {
    const note = nativeTeamNote({ ...base, sessionGuard: false })!;
    expect(note).toContain('agents start digital-agency --host claude');
    expect(note).toMatch(/Agent Team/);
    expect(note).toMatch(/experimental/i);
    expect(note).toMatch(/interactive/i);
    expect(note).toMatch(/frontmatter hook/);
    expect(note).toMatch(/teammate/i);
  });

  it('tells the user how to add the guard when it is missing, and says it is installed when it is', () => {
    expect(nativeTeamNote({ ...base, sessionGuard: false })).toMatch(/agents update digital-agency --session-guard/);
    const wired = nativeTeamNote({ ...base, sessionGuard: true })!;
    expect(wired).toMatch(/guard is installed/i);
    expect(wired).not.toMatch(/--session-guard/);
  });
});

describe('sessionGuardPrompt (the consent question, default yes)', () => {
  it('keeps the existing question for a Tier-1 install, in both scopes', () => {
    expect(sessionGuardPrompt({ scope: 'project', tier: 'domain', nativeLane: true })).toEqual({
      message: 'Also guard plain Claude sessions in this repo? (blocks git push --force, .env writes and vercel --prod via .claude/settings.json)',
      initialValue: true,
    });
    expect(sessionGuardPrompt({ scope: 'global', tier: undefined, nativeLane: false }).message).toMatch(/~\/\.claude\/settings\.json/);
  });

  it('adds, for a native Tier-2 install, that this is the only guard a teammate gets, and still defaults to yes', () => {
    const prompt = sessionGuardPrompt({ scope: 'project', tier: 'organization', nativeLane: true });
    expect(prompt.initialValue).toBe(true);
    expect(prompt.message).toMatch(/teammate/i);
    expect(prompt.message).toMatch(/\.claude\/settings\.json/);
    expect(prompt.message).toMatch(/git push --force/);
  });

  it('does not add it for a Tier-2 install without the native lane (the roles are legacy projections there)', () => {
    expect(sessionGuardPrompt({ scope: 'project', tier: 'organization', nativeLane: false }).message).not.toMatch(/teammate/i);
  });
});

describe('doctor on a native Tier-2 install', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-tier2-teammate-guard');
  const sidecar = path.join(workspace, '.claude', '.agents-united');
  const install = (bundle: string, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(bundle, { targetDir: sidecar, method: 'copy', fanout: ['claude'], nativeLane: true, ...extra } as never);
  const teamWarnings = async (): Promise<string[]> => (await DoctorEngine.runDoctor(sidecar, 'claude')).warnings.filter(warning => /teammate/i.test(warning));

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('warns that the team is unguarded without the settings-level guard, names the bundle and the command', async () => {
    await install('digital-agency');
    const found = await teamWarnings();
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('digital-agency');
    expect(found[0]).toMatch(/frontmatter hook/);
    expect(found[0]).toContain('agents update digital-agency --session-guard');
  });

  it('is silent once the settings-level guard is installed', async () => {
    await install('digital-agency', { sessionGuard: 'local' });
    expect(await teamWarnings()).toEqual([]);
  });

  it('warns again when the settings-level guard is removed by hand', async () => {
    await install('digital-agency', { sessionGuard: 'local' });
    await fs.writeJson(path.join(workspace, '.claude/settings.local.json'), {});
    expect((await teamWarnings()).length).toBe(1);
  });

  it('says nothing for a Tier-1 bundle, which has no teammates', async () => {
    await install('software-engineering');
    expect(await teamWarnings()).toEqual([]);
  });

  it('says nothing when the native lane is off', async () => {
    await install('digital-agency', { nativeLane: false });
    expect(await teamWarnings()).toEqual([]);
  });
});
