import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { loadHostProfile, validateHostProfile } from '../src/core/host-profile.js';
import { InstallEngine } from '../src/core/installer.js';
import { UpdateEngine } from '../src/core/updater.js';
import type { BundleDefinition, LockfileManifest, ResolvedAssets } from '../src/core/types.js';

/**
 * Plan 036 S1b (the maintainer's answer to Q1, option b, 2026-10-08): "Stop generative-ui loading on Claude installs."
 * S1 took the skill out of the creative designer's table; this closes the install level. `generative-ui` is written for
 * Antigravity, and it is also model-invocable on Claude in five bundles, so another role could load it. The Claude host
 * profile (`registry/hosts/claude/profile.json`) carries `unsupportedSkills`: skills the host does not install, each
 * with the date since which it is left out and the reason. The Claude projection (the native lane and the legacy one
 * alike, both planned by `ClaudeProjector.planCompoundProjection`, and the doctor plans with it too) skips them, and an
 * update prunes a copy that an earlier release installed. The canonical store keeps the skill: it is host-neutral, and
 * Antigravity reads it from there.
 */

const REGISTRY = path.resolve('registry');
const SKILL = 'generative-ui';
const BUNDLE = 'digital-agency';
const sha = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;

interface Entry {
  name: string;
  since: string;
  rationale: string;
}
const profileJson = (): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(REGISTRY, 'hosts/claude/profile.json'), 'utf8')) as Record<string, unknown>;

describe('the Claude host profile lists the skills Claude does not install', () => {
  const list = (): Entry[] => (loadHostProfile(REGISTRY, 'claude') as unknown as { unsupportedSkills?: Entry[] }).unsupportedSkills ?? [];

  it('names generative-ui with the date it was left out and a reason that says whose tools it uses', () => {
    expect(list()).toEqual([{ name: SKILL, since: '2026-10-08', rationale: expect.stringMatching(/Antigravity/) }]);
    expect(list()[0]!.rationale).toMatch(/write_to_file/);
  });

  it('names only skills that exist in the registry, so a retired skill cannot stay on the list', () => {
    for (const entry of list()) expect(fs.existsSync(path.join(REGISTRY, 'skills', entry.name, 'SKILL.md')), entry.name).toBe(true);
  });

  it('is data only: every other key of the profile is unchanged by the list, and the profile still validates', () => {
    expect(() => validateHostProfile(profileJson())).not.toThrow();
  });
});

describe('validation of unsupportedSkills', () => {
  const withList = (unsupportedSkills: unknown): Record<string, unknown> => ({ ...profileJson(), unsupportedSkills });
  const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ name: 'probe-skill', since: '2026-10-08', rationale: 'It calls a tool that only another host has.', ...over });

  it('accepts a well-formed list, and an absent one', () => {
    expect(() => validateHostProfile(withList([entry()]))).not.toThrow();
    const { unsupportedSkills: _dropped, ...without } = profileJson();
    expect(() => validateHostProfile(without)).not.toThrow();
  });

  it.each([
    ['a duplicate name', [entry(), entry()], /unsupportedSkills: duplicate entry "probe-skill"/],
    ['a name that is not a skill slug', [entry({ name: 'Probe Skill' })], /unsupportedSkills\.0\.name/],
    ['a date that is not a date', [entry({ since: 'yesterday' })], /unsupportedSkills\.0\.since/],
    ['a rationale that says nothing', [entry({ rationale: 'no' })], /unsupportedSkills\.0\.rationale/],
    ['a key the schema does not know', [entry({ note: 'x' })], /unsupportedSkills\.0.*note/],
    ['a list that is not an array', { name: 'probe-skill' }, /unsupportedSkills/],
  ])('rejects %s', (_label, value, message) => {
    expect(() => validateHostProfile(withList(value))).toThrow(message);
  });
});

describe('the Claude projection plan skips an unsupported skill', () => {
  const root = path.resolve(process.cwd(), 'scratch/test-claude-unsupported-skills-plan');
  const bundle = { name: 'probe', agents: [], skills: ['probe-kept', 'probe-dropped'] } as unknown as BundleDefinition;
  const resolved: ResolvedAssets = { targetBundle: 'probe', agents: [], skills: ['probe-kept', 'probe-dropped'], workflows: [], rules: [] };

  async function registryWith(unsupported: Entry[] | undefined): Promise<string> {
    for (const skill of ['probe-kept', 'probe-dropped']) {
      await fs.outputFile(path.join(root, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: A probe skill.\n---\n\n# ${skill}\n`);
      await fs.outputFile(path.join(root, 'skills', skill, 'references', 'note.md'), `A reference of ${skill}.\n`);
    }
    await fs.outputJson(path.join(root, 'hosts/claude/profile.json'), { ...profileJson(), unsupportedSkills: unsupported });
    return root;
  }
  const paths = async (registryDir: string, nativeLane: boolean): Promise<string[]> =>
    (await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir, undefined, nativeLane)).map(a => a.relPath).sort();

  beforeEach(async () => {
    await fs.remove(root);
  });
  afterEach(async () => {
    await fs.remove(root);
  });

  it.each([true, false])('leaves out the skill and everything under its folder, with the native lane %s, and keeps the others', async nativeLane => {
    const dir = await registryWith([{ name: 'probe-dropped', since: '2026-10-08', rationale: 'It uses a tool that only another host has.' }]);
    const planned = await paths(dir, nativeLane);
    expect(planned).toContain('.claude/skills/probe-kept/SKILL.md');
    expect(planned).toContain('.claude/skills/probe-kept/references/note.md');
    expect(planned.filter(p => p.startsWith('.claude/skills/probe-dropped'))).toEqual([]);
  });

  it('plans both skills when the profile lists none, so the skip is the list and nothing else', async () => {
    const dir = await registryWith(undefined);
    const planned = await paths(dir, true);
    expect(planned).toContain('.claude/skills/probe-kept/SKILL.md');
    expect(planned).toContain('.claude/skills/probe-dropped/SKILL.md');
  });

  it('plans every skill when the registry has no Claude profile at all, as a registry of an older shape does', async () => {
    const dir = await registryWith(undefined);
    await fs.remove(path.join(dir, 'hosts'));
    expect(await paths(dir, false)).toContain('.claude/skills/probe-dropped/SKILL.md');
  });
});

describe('a digital-agency install on Claude (native lane, project scope)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-claude-unsupported-skills-install');
  const sidecar = path.join(workspace, '.claude', '.agents-united');
  const lockPath = path.join(sidecar, 'agents-united.json');
  const projected = `.claude/skills/${SKILL}/SKILL.md`;
  const canonical = `skills/${SKILL}/SKILL.md`;
  const install = (): Promise<unknown> => new InstallEngine().install(BUNDLE, { targetDir: sidecar, method: 'copy', fanout: ['claude'], nativeLane: true } as never);
  const update = (force = false) => new UpdateEngine().update(BUNDLE, { scope: 'project', targetDir: sidecar, hosts: ['agents'], cwd: workspace, force });
  const lock = (): Promise<LockfileManifest> => fs.readJson(lockPath);

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('has no generative-ui under .claude/skills, keeps the other skills, and records no projection of it', async () => {
    await install();
    expect(await fs.pathExists(path.join(workspace, '.claude/skills', SKILL))).toBe(false);
    expect(await fs.pathExists(path.join(workspace, '.claude/skills/ad-creative-design/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.claude/skills/frontend-design/SKILL.md'))).toBe(true);
    const l = await lock();
    expect(Object.keys(l.projections ?? {}).filter(key => key.includes(SKILL))).toEqual([]);
    expect(l.files[canonical]?.projectedTo ?? []).not.toContain(projected);
  });

  it('keeps the canonical store copy, which is host-neutral, and the doctor finds nothing missing', async () => {
    await install();
    expect(await fs.pathExists(path.join(sidecar, 'skills', SKILL, 'SKILL.md'))).toBe(true);
    expect((await lock()).installed.skills).toContain(SKILL);
    const report = await DoctorEngine.runDoctor(sidecar, 'claude');
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(w => /generative-ui|Missing projection|Content drift|Stale|Outdated/.test(w))).toEqual([]);
  });

  describe('agents update on an install that an earlier release made', () => {
    /** The state the earlier release left: the skill projected under .claude/skills, recorded as a projection and as a pointer of its canonical file. */
    async function makeEarlierInstall(): Promise<string> {
      await install();
      const l = await lock();
      const source = fs.readFileSync(path.join(REGISTRY, 'skills', SKILL, 'SKILL.md'), 'utf8');
      const content = ClaudeProjector.renderSkill(source, canonical).content;
      await fs.outputFile(path.join(workspace, projected), content);
      l.projections = { ...l.projections, [projected]: { host: 'claude', kind: 'skill', canonical, owners: [BUNDLE], hash: sha(content), installedAt: new Date().toISOString(), managedMarker: true } };
      l.files[canonical]!.projectedTo = [...(l.files[canonical]!.projectedTo ?? []), projected];
      await fs.writeJson(lockPath, l, { spaces: 2 });
      return content;
    }

    it('removes the old copy, its projection record and its pointer, and leaves the other skills alone', async () => {
      await makeEarlierInstall();
      expect(await fs.pathExists(path.join(workspace, projected))).toBe(true);
      const run = await update();
      expect(run.skipped).toEqual([]);
      expect(await fs.pathExists(path.join(workspace, '.claude/skills', SKILL))).toBe(false);
      const l = await lock();
      expect(Object.keys(l.projections ?? {})).not.toContain(projected);
      expect(l.files[canonical]?.projectedTo ?? []).not.toContain(projected);
      expect(await fs.pathExists(path.join(workspace, '.claude/skills/ad-creative-design/SKILL.md'))).toBe(true);
      const report = await DoctorEngine.runDoctor(sidecar, 'claude');
      expect(report.issues).toEqual([]);
      expect(report.warnings.filter(w => /generative-ui|Missing projection|Content drift|Stale|Outdated/.test(w))).toEqual([]);
    });

    it('is idempotent: a second update changes no projection', async () => {
      await makeEarlierInstall();
      await update();
      const before = Object.keys((await lock()).projections ?? {}).sort();
      await update();
      expect(Object.keys((await lock()).projections ?? {}).sort()).toEqual(before);
      expect(await fs.pathExists(path.join(workspace, '.claude/skills', SKILL))).toBe(false);
    });

    it('never clobbers a copy the user took over: without --force it is skipped and kept, with --force it goes', async () => {
      const content = await makeEarlierInstall();
      await fs.writeFile(path.join(workspace, projected), content.replace(/<!--[^>]*managed-by[^>]*-->\r?\n?/, '') + '\nMy own note.\n');
      const skippedRun = await update();
      expect(skippedRun.skipped.length).toBeGreaterThan(0);
      expect(skippedRun.skipped[0]!.reason).toMatch(/User modifications detected in projection/);
      expect(fs.readFileSync(path.join(workspace, projected), 'utf8')).toContain('My own note.');
      await update(true);
      expect(await fs.pathExists(path.join(workspace, '.claude/skills', SKILL))).toBe(false);
    });
  });
});
