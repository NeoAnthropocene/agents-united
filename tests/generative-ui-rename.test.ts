import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { UpdateEngine } from '../src/core/updater.js';
import type { LockfileManifest } from '../src/core/types.js';

/**
 * The canonical skill `generative_ui` is renamed `generative-ui` (maintainer decision, 2026-10-03). It was the one grandfathered name that broke the
 * lowercase-with-hyphens rule every host documents: the Claude and Cline projections normalised it at projection time (Plan 016, ADR 0018 decision 2),
 * but Antigravity reads the `.agents/skills/` store copy as written, so the raw name reached the host. With the store holding a compliant name, no
 * projection-time rename is left for any skill.
 *
 * Existing installs recorded `skills/generative_ui/SKILL.md` in their lockfile, and the installer never prunes a store skill that left the registry,
 * so `agents update` carries a migration: the legacy store copy (and its record and roster entry) is replaced by the new one, and a copy the user
 * edited is never deleted.
 */

const registry = path.resolve('registry');
const OLD = 'generative_ui';
const NEW = 'generative-ui';
const read = (file: string): string => fs.readFileSync(file, 'utf8');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

describe('the registry holds the compliant name only', () => {
  it('has the skill folder and frontmatter name generative-ui, and no generative_ui folder', () => {
    expect(fs.existsSync(path.join(registry, 'skills', OLD))).toBe(false);
    const source = read(path.join(registry, 'skills', NEW, 'SKILL.md'));
    expect(/^---\r?\n(?:[\s\S]*?\r?\n)?name: generative-ui\r?\n/.test(source)).toBe(true);
  });

  it('names it in every bundle that carried it, and nowhere in the registry is the old spelling left', () => {
    const bundles = JSON.parse(read(path.join(registry, 'bundles.json'))) as { bundles?: Record<string, { skills?: string[] }> } & Record<string, { skills?: string[] }>;
    const carrying = Object.entries(bundles.bundles ?? bundles).filter(([, bundle]) => (bundle.skills ?? []).includes(NEW));
    expect(carrying.length).toBe(5);
    const offenders = walk(registry).filter(file => /\.(md|json|js|yml|yaml)$/.test(file) && read(file).includes(OLD));
    expect(offenders.map(file => path.relative(registry, file))).toEqual([]);
  });

  it('is no longer a documented exception: README and the skill-intake rule say no skill keeps an underscore', () => {
    expect(read(path.resolve('README.md'))).not.toContain(OLD);
    expect(read(path.resolve('docs/skill-intake.md'))).not.toMatch(/deliberately grandfathered/);
  });
});

describe('agents update migrates an install made before the rename', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-generative-ui-rename');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const BUNDLE = 'product-design';
  const legacyDir = path.join(agentsDir, 'skills', OLD);
  const sha = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;

  /** Rewrites a fresh install into what the previous release left behind: the legacy folder and record instead of the new ones. */
  async function makeLegacyInstall(): Promise<{ legacyText: string }> {
    await new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy' });
    const lock: LockfileManifest = await fs.readJson(lockPath);
    const newKey = `skills/${NEW}/SKILL.md`;
    expect(lock.files[newKey], `${BUNDLE} installs ${NEW}`).toBeDefined();
    const legacyText = read(path.join(agentsDir, newKey)).replace(/^name: generative-ui$/m, 'name: generative_ui');
    await fs.remove(path.join(agentsDir, 'skills', NEW));
    await fs.outputFile(path.join(legacyDir, 'SKILL.md'), legacyText);
    lock.files[`skills/${OLD}/SKILL.md`] = { ...lock.files[newKey], hash: sha(legacyText) };
    delete lock.files[newKey];
    lock.installed.skills = lock.installed.skills.map(skill => (skill === NEW ? OLD : skill));
    lock.bundleVersions = { ...lock.bundleVersions, [BUNDLE]: '0.0.1' };
    await fs.writeJson(lockPath, lock, { spaces: 2 });
    return { legacyText };
  }

  const update = () => new UpdateEngine().update(BUNDLE, { targetDir: agentsDir, scope: 'project', hosts: ['agents'], cwd: workspace, force: false });

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('a fresh install never has the legacy skill (the migration leaves it alone)', async () => {
    await new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy' });
    expect(fs.existsSync(legacyDir)).toBe(false);
    const lock: LockfileManifest = await fs.readJson(lockPath);
    expect(Object.keys(lock.files)).not.toContain(`skills/${OLD}/SKILL.md`);
    expect(lock.installed.skills).toContain(NEW);
    expect(lock.installed.skills).not.toContain(OLD);
  });

  it('replaces the unmodified legacy store copy, its record and its roster entry with the new skill', async () => {
    await makeLegacyInstall();
    await update();
    expect(fs.existsSync(legacyDir)).toBe(false);
    expect(fs.existsSync(path.join(agentsDir, 'skills', NEW, 'SKILL.md'))).toBe(true);
    const lock: LockfileManifest = await fs.readJson(lockPath);
    expect(Object.keys(lock.files)).not.toContain(`skills/${OLD}/SKILL.md`);
    expect(Object.keys(lock.files)).toContain(`skills/${NEW}/SKILL.md`);
    expect(lock.installed.skills).toContain(NEW);
    expect(lock.installed.skills).not.toContain(OLD);
  });

  it('is idempotent: a second update changes nothing', async () => {
    await makeLegacyInstall();
    await update();
    const before = await fs.readFile(lockPath, 'utf8');
    await update();
    expect(fs.existsSync(legacyDir)).toBe(false);
    expect(Object.keys((await fs.readJson(lockPath)).files)).toContain(`skills/${NEW}/SKILL.md`);
    expect((JSON.parse(before) as LockfileManifest).installed.skills).toContain(NEW);
  });

  it('never deletes a legacy copy the user edited: without --force the update is skipped as for any edited file, and with --force the copy and its record stay while the new skill is installed beside it', async () => {
    const { legacyText } = await makeLegacyInstall();
    await fs.writeFile(path.join(legacyDir, 'SKILL.md'), `${legacyText}\nMy own note.\n`);

    const skippedRun = await update();
    expect(skippedRun.skipped.length).toBeGreaterThan(0);
    expect(skippedRun.skipped[0].reason).toMatch(/User modifications/);
    expect(read(path.join(legacyDir, 'SKILL.md'))).toContain('My own note.');
    expect(fs.existsSync(path.join(agentsDir, 'skills', NEW, 'SKILL.md'))).toBe(false);

    await new UpdateEngine().update(BUNDLE, { targetDir: agentsDir, scope: 'project', hosts: ['agents'], cwd: workspace, force: true });
    expect(read(path.join(legacyDir, 'SKILL.md'))).toContain('My own note.');
    expect(fs.existsSync(path.join(agentsDir, 'skills', NEW, 'SKILL.md'))).toBe(true);
    const lock: LockfileManifest = await fs.readJson(lockPath);
    expect(Object.keys(lock.files)).toContain(`skills/${OLD}/SKILL.md`);
  });
});
