import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';

/**
 * Plan 032 Phase 8 — decision 2 of the 2026-10-03 probes. A frontmatter-less `GEMINI.md` is read by agy 1.2.16 (probe a), so with the native
 * lane on the same policy reaches the agent twice: once from the legacy `GEMINI.md` (all of it, always on) and once from the native rules
 * (two always_on, the rest on demand). The lane therefore omits the legacy `.agents/rules/GEMINI.md` for as long as it holds a native rule.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
const GEMINI = 'rules/GEMINI.md';
const sha = (file: string): string => fs.readFileSync(file, 'utf8');
const isLink = (target: string): boolean => fs.lstatSync(target).isSymbolicLink();

describe('Antigravity native lane: the legacy GEMINI.md is omitted', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-gemini-md');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const geminiFile = path.join(agentsDir, GEMINI);
  const registryGemini = path.join(REGISTRY, GEMINI);
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}, bundle = BUNDLE) =>
    new InstallEngine().install(bundle, { targetDir: agentsDir, method: 'symlink', nativeLane, ...extra });
  const update = (force = false) => new UpdateEngine().update(BUNDLE, { targetDir: agentsDir, scope: 'project', hosts: ['agents'], cwd: workspace, force });
  const lock = async (): Promise<{ files: Record<string, unknown>; projections?: Record<string, unknown> }> => fs.readJson(lockPath);
  /** Writes into the installed file, never through a link: a link here is the registry itself. */
  const edit = async (text: string): Promise<void> => {
    if (isLink(geminiFile)) throw new Error('GEMINI.md is a link into the registry: refusing to edit it');
    await fs.appendFile(geminiFile, text);
  };

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is installed without the lane (unchanged), as a link recorded in the lockfile', async () => {
    await install();
    expect(fs.existsSync(geminiFile)).toBe(true);
    expect(isLink(geminiFile)).toBe(true);
    expect(Object.keys((await lock()).files)).toContain(GEMINI);
  });

  it('is not installed with the lane, and nothing records it, while the six native rules are', async () => {
    await install(true);
    expect(fs.existsSync(geminiFile)).toBe(false);
    expect(Object.keys((await lock()).files)).not.toContain(GEMINI);
    const nativeRules = Object.keys((await lock()).projections ?? {}).filter(rel => rel.startsWith('.agents/rules/'));
    expect(nativeRules.length).toBe(6);
    for (const rel of nativeRules) expect(fs.readFileSync(path.join(workspace, rel), 'utf8').startsWith('---\n'), rel).toBe(true);
  });

  it('is omitted for a copy install too', async () => {
    await install(true, { method: 'copy' });
    expect(fs.existsSync(geminiFile)).toBe(false);
  });

  it('migrates an existing install: turning the lane on removes our link and never touches the registry', async () => {
    await install();
    const before = sha(registryGemini);
    await install(true);
    expect(fs.existsSync(geminiFile)).toBe(false);
    expect(sha(registryGemini)).toBe(before);
    expect(Object.keys((await lock()).files)).not.toContain(GEMINI);
  });

  it('migrates on `agents update`: the lane is sticky, so the next update drops it', async () => {
    await install();
    const recorded = await lock();
    await fs.writeJson(lockPath, { ...recorded, nativeLanes: { antigravity: true } }, { spaces: 2 });
    await update(true);
    expect(fs.existsSync(geminiFile)).toBe(false);
  });

  it('removes an unmodified copy we installed', async () => {
    await install(false, { method: 'copy' });
    expect(isLink(geminiFile)).toBe(false);
    await install(true, { method: 'copy' });
    expect(fs.existsSync(geminiFile)).toBe(false);
  });

  it('leaves a copy the user edited, drops our record of it, and says so', async () => {
    await install(false, { method: 'copy' });
    await edit('\nMy own rule.\n');
    const result = await install(true, { method: 'copy' });
    expect(fs.readFileSync(geminiFile, 'utf8')).toContain('My own rule.');
    expect(Object.keys((await lock()).files)).not.toContain(GEMINI);
    const warning = result.projections.find(p => p.path === '.agents/rules/GEMINI.md');
    expect(warning?.warnings.join(' ')).toMatch(/edited|your own/i);
    // A file that is no longer ours is not removed on uninstall.
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(fs.readFileSync(geminiFile, 'utf8')).toContain('My own rule.');
  });

  it('with --force an edited copy is removed as every other native replacement is', async () => {
    await install(false, { method: 'copy' });
    await edit('\nMy own rule.\n');
    await install(true, { method: 'copy', force: true });
    expect(fs.existsSync(geminiFile)).toBe(false);
  });

  it('comes back when the lane is turned off, and stays out while any bundle keeps a native rule', async () => {
    await install(true);
    await install(true, {}, 'system-architecture');
    expect(fs.existsSync(geminiFile)).toBe(false);
    await install(false, { force: true });
    expect(fs.existsSync(geminiFile)).toBe(true);
    expect(Object.keys((await lock()).files)).toContain(GEMINI);
  });

  it('is byte-stable: a second install changes nothing', async () => {
    await install(true);
    const first = await fs.readFile(lockPath, 'utf8');
    await install(true);
    expect(fs.existsSync(geminiFile)).toBe(false);
    expect(JSON.parse(await fs.readFile(lockPath, 'utf8')).files).toEqual(JSON.parse(first).files);
  });

  it('a dry run writes nothing', async () => {
    await install(true, { dryRun: true });
    expect(fs.existsSync(agentsDir)).toBe(false);
  });

  it('leaves the doctor with nothing to say about the missing GEMINI.md', async () => {
    await install(true);
    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => /GEMINI/i.test(w))).toEqual([]);
  });
});

describe('the decision is recorded where the next author looks', () => {
  const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8');

  it('the profile says the lane omits the legacy file, and keeps what was not established', () => {
    const profile = JSON.parse(read('registry/hosts/antigravity/profile.json')) as { features: Record<string, { status: string; note: string }> };
    const feature = profile.features.geminiMd;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/native lane omits/i);
    expect(feature.note).toMatch(/ADR 0031/);
    expect(feature.note).toMatch(/not established/i);
    expect(feature.note).not.toMatch(/whether the lane should omit the legacy file/);
  });

  it('ADR 0031 carries the addendum, with the section the native rules do not carry', () => {
    const adr = read('docs/adr/0031-antigravity-native-install-lane.md');
    expect(adr).toMatch(/Addendum \(2026-10-03[^\n]*GEMINI\.md/);
    expect(adr).toMatch(/skill attribution/i);
    expect(adr).toMatch(/agents update/);
  });
});
