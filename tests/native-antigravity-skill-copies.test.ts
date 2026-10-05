import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { isMaintainerOnlySkillPath } from '../src/core/skill-folder.js';
import { linkedSkillAdvice, listLinkedSkills } from '../src/core/skill-links.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';

/**
 * Plan 032 Phase 8 — decision 1 of the 2026-10-03 probes (observations: agy 1.2.16 lists a real skill folder and does not list one that is a
 * link; on Windows the default install makes each skill folder an NTFS junction into the registry). With the Antigravity native lane on, the
 * skills in `.agents/skills/` are therefore installed as real copies, hashed per file in the lockfile; without the lane nothing changes, but the
 * doctor and the install say that agy will not list links.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const SKILL = 'test-driven-development';
const sha = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const isLink = (target: string): boolean => fs.lstatSync(target).isSymbolicLink();

describe('Antigravity native lane: skills are copies, not links', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-skill-copies');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const skillDir = path.join(agentsDir, 'skills', SKILL);
  const registrySkill = path.join(REGISTRY, 'skills', SKILL);
  // `method: 'symlink'` is the default of `agents add`; the lane must turn it into copies for skills only.
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'symlink', nativeLane, ...extra });
  const update = (force = false) => new UpdateEngine().update(BUNDLE, { targetDir: agentsDir, scope: 'project', hosts: ['agents'], cwd: workspace, force });
  const skillFolders = (): string[] => fs.readdirSync(path.join(agentsDir, 'skills')).sort();
  /** Appends to the installed SKILL.md, but never through a link: a link here is the registry itself, and a failing run must not edit it. */
  const editSkill = async (text: string): Promise<void> => {
    if (isLink(skillDir)) throw new Error('the skill folder is a link into the registry: refusing to edit it');
    await fs.appendFile(path.join(skillDir, 'SKILL.md'), text);
  };

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('installs every skill as a real folder with the registry bytes, and records each file as a copy with its own hash', async () => {
    await install(true);
    const names = skillFolders();
    expect(names.length).toBeGreaterThan(20);
    for (const name of names) expect(isLink(path.join(agentsDir, 'skills', name)), name).toBe(false);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe(fs.readFileSync(path.join(registrySkill, 'SKILL.md'), 'utf8'));
    const lock = await fs.readJson(lockPath);
    const skillRecords = Object.entries(lock.files).filter(([rel]) => rel.startsWith('skills/')) as Array<[string, { method: string; hash: string; owners: string[] }]>;
    expect(skillRecords.length).toBeGreaterThanOrEqual(names.length);
    for (const [rel, record] of skillRecords) {
      expect(record.method, rel).toBe('copy');
      expect(record.hash, rel).toBe(`sha256:${sha(path.join(agentsDir, rel))}`);
    }
    expect(lock.files[`skills/${SKILL}/SKILL.md`].owners).toContain(BUNDLE);
    expect(lock.installed.skills).toContain(SKILL);
  });

  it('copies the sidecar files of a skill too (references, scripts), not only SKILL.md, and leaves the maintainer-only evals/ out (Plan 035)', async () => {
    await install(true);
    const subfolders = fs.readdirSync(path.join(REGISTRY, 'skills'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap(entry => fs.readdirSync(path.join(REGISTRY, 'skills', entry.name), { withFileTypes: true }).filter(sub => sub.isDirectory()).map(sub => `${entry.name}/${sub.name}`))
      .filter(rel => fs.existsSync(path.join(agentsDir, 'skills', rel.split('/')[0])));
    const isMaintainerOnly = (rel: string): boolean => isMaintainerOnlySkillPath(rel.split('/').slice(1).join('/'));
    const registryFiles = subfolders.filter(rel => !isMaintainerOnly(rel));
    expect(registryFiles.length, 'the registry has skills with subfolders').toBeGreaterThan(0);
    for (const rel of registryFiles.slice(0, 5)) expect(fs.existsSync(path.join(agentsDir, 'skills', rel)), rel).toBe(true);
    for (const rel of subfolders.filter(isMaintainerOnly)) expect(fs.existsSync(path.join(agentsDir, 'skills', rel)), `${rel} is not installed`).toBe(false);
  });

  it('leaves the registry untouched', async () => {
    const before = sha(path.join(registrySkill, 'SKILL.md'));
    await install(true);
    await editSkill('\nA local edit.\n');
    expect(sha(path.join(registrySkill, 'SKILL.md'))).toBe(before);
  });

  it('is unchanged without the lane: skills stay links recorded as symlinks', async () => {
    await install();
    expect(isLink(skillDir)).toBe(true);
    const lock = await fs.readJson(lockPath);
    expect(lock.files[`skills/${SKILL}/SKILL.md`].method).toBe('symlink');
    expect(lock.nativeLanes).toBeUndefined();
  });

  it('honours an explicit --copy the same as before (copies, with or without the lane)', async () => {
    await install(true, { method: 'copy' });
    expect(isLink(skillDir)).toBe(false);
    expect((await fs.readJson(lockPath)).files[`skills/${SKILL}/SKILL.md`].method).toBe('copy');
  });

  it('migrates an existing link install: turning the lane on replaces each link by a copy and never touches the registry', async () => {
    await install();
    expect(isLink(skillDir)).toBe(true);
    const registryBefore = fs.readdirSync(registrySkill).sort();
    const registryHash = sha(path.join(registrySkill, 'SKILL.md'));
    await install(true);
    expect(isLink(skillDir)).toBe(false);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
    expect(fs.readdirSync(registrySkill).sort()).toEqual(registryBefore);
    expect(sha(path.join(registrySkill, 'SKILL.md'))).toBe(registryHash);
    expect((await fs.readJson(lockPath)).files[`skills/${SKILL}/SKILL.md`].method).toBe('copy');
  });

  it('migrates on `agents update` (the lane is sticky, the install is re-run without the flag and with force)', async () => {
    await install();
    const lock = await fs.readJson(lockPath);
    lock.nativeLanes = { antigravity: true };
    await fs.writeJson(lockPath, lock, { spaces: 2 });
    await update(true);
    expect(isLink(skillDir)).toBe(false);
    expect((await fs.readJson(lockPath)).files[`skills/${SKILL}/SKILL.md`].method).toBe('copy');
  });

  it('is byte-stable: a second install keeps the copies and rewrites nothing that did not change', async () => {
    await install(true);
    const first = fs.readFileSync(path.join(skillDir, 'SKILL.md'));
    await install(true);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md')).equals(first)).toBe(true);
    expect(isLink(skillDir)).toBe(false);
  });

  it('refuses to overwrite a copy the user edited, without --force, on install', async () => {
    await install(true);
    await editSkill('\nMy own addition.\n');
    await expect(install(true)).rejects.toThrow(/user modifications/);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toContain('My own addition.');
    await install(true, { force: true });
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).not.toContain('My own addition.');
  });

  it('`agents update` skips a bundle with an edited skill copy instead of overwriting it, even though the lockfile method is symlink', async () => {
    await install(true);
    expect((await fs.readJson(lockPath)).method).toBe('symlink');
    await editSkill('\nMy own addition.\n');
    const result = await update(false);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0].reason).toMatch(/User modifications/);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toContain('My own addition.');
  });

  it('turning the lane off without --force never throws away an edited copy; with --force the links come back', async () => {
    await install(true);
    await editSkill('\nMy own addition.\n');
    await expect(install(false)).rejects.toThrow(/user modifications/);
    expect(isLink(skillDir)).toBe(false);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toContain('My own addition.');
    await install(false, { force: true });
    expect(isLink(skillDir)).toBe(true);
    expect((await fs.readJson(lockPath)).files[`skills/${SKILL}/SKILL.md`].method).toBe('symlink');
  });

  it('removing the bundle removes the copied skill files and leaves the registry alone', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    // As for any copy install, the emptied folder itself is not pruned.
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(registrySkill, 'SKILL.md'))).toBe(true);
  });

  it('a dry run writes nothing', async () => {
    await install(true, { dryRun: true });
    expect(fs.existsSync(agentsDir)).toBe(false);
  });

  describe('doctor and the install note for links agy will not list', () => {
    it('listLinkedSkills names the skill folders that are links, and only on Windows (the observation is for junctions; POSIX symlinks were not tried)', async () => {
      await install();
      const skills = path.join(agentsDir, 'skills');
      expect((await listLinkedSkills(skills, 'win32')).sort()).toEqual(skillFolders().filter(name => isLink(path.join(skills, name))));
      expect((await listLinkedSkills(skills, 'win32')).length).toBeGreaterThan(20);
      expect(await listLinkedSkills(skills, 'linux')).toEqual([]);
      expect(await listLinkedSkills(path.join(workspace, 'missing'), 'win32')).toEqual([]);
    });

    it('lists nothing for a real-folder install', async () => {
      await install(true);
      expect(await listLinkedSkills(path.join(agentsDir, 'skills'), 'win32')).toEqual([]);
    });

    it('advice is empty for no links, and otherwise says what was observed, what was not, and the two ways out', () => {
      expect(linkedSkillAdvice([])).toBeUndefined();
      const advice = linkedSkillAdvice(['a', 'b'], BUNDLE) as string;
      expect(advice).toMatch(/2 skill folders/);
      expect(advice).toMatch(/agy 1\.2\.16/);
      expect(advice).toMatch(/not list/i);
      expect(advice).toMatch(/--native/);
      expect(advice).toMatch(/--copy/);
      expect(advice).toMatch(/not tried|untested|unverified/i);
      expect(linkedSkillAdvice(['a'])).toMatch(/1 skill folder\b/);
    });

    it.runIf(process.platform === 'win32')('the doctor warns about linked skills on Windows, and is quiet once the lane has made copies', async () => {
      await install();
      const linked = (await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => /skill folders/.test(w));
      expect(linked).toHaveLength(1);
      await install(true);
      expect((await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => /skill folders/.test(w))).toEqual([]);
    });
  });
});

describe('the decision is recorded where the next author looks', () => {
  const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8');

  it('the profile says the lane installs copies, names the ADR and the real session, and keeps what was not established', () => {
    const profile = JSON.parse(read('registry/hosts/antigravity/profile.json')) as { features: Record<string, { status: string; note: string }> };
    const feature = profile.features.skillInstallMethod;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/native lane/i);
    expect(feature.note).toMatch(/real cop(y|ies)/i);
    expect(feature.note).toMatch(/ADR 0033/);
    expect(feature.note).toMatch(/2026-10-03-agy-1\.2\.16-lane-skill-copies\.md/);
    expect(feature.note).not.toMatch(/separate decision, not made here/);
    expect(feature.note).toMatch(/not established/i);
  });

  it('ADR 0033 exists, is accepted, and states the scope (lane only), the migration and the edit protection', () => {
    const adr = read('docs/adr/0033-antigravity-skills-installed-as-copies.md');
    expect(adr).toMatch(/Status\*\*: Accepted/);
    expect(adr).toMatch(/native lane/i);
    expect(adr).toMatch(/agents update/);
    expect(adr).toMatch(/user modifications|edited/i);
    expect(adr).toMatch(/doctor/i);
  });

  it('the observations file records the real session, with its ledger and what it did not show', () => {
    const text = read('host-library/antigravity/observations/2026-10-03-agy-1.2.16-lane-skill-copies.md');
    expect(text).toMatch(/Not established/);
    expect(text).toMatch(/32 headless/);
    expect(text).toMatch(/backend-api-design/);
  });

  it('the skill guide tells an author that the lane installs copies', () => {
    expect(read('host-library/antigravity/guide/skill.md')).toMatch(/native lane.{0,200}cop(y|ies)|cop(y|ies).{0,200}native lane/is);
  });
});
