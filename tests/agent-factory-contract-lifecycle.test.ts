import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import type { InstallOptions, LockfileManifest } from '../src/core/types.js';

describe('production author-contract delivery lifecycle', () => {
  let root: string;
  let state: string;
  let skill: string;
  const options = (extra: InstallOptions = {}): InstallOptions => ({ targetDir: state, method: 'copy', fanout: ['claude'], nativeLane: true, ...extra });
  const inventory = async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    const walk = async (dir: string, prefix = ''): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const rel = `${prefix}${entry.name}`, file = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) result[rel] = `link:${await fs.readlink(file)}`;
        else if (entry.isDirectory()) { result[`${rel}/`] = 'directory'; await walk(file, `${rel}/`); }
        else result[rel] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
      }
    };
    await walk(root);
    return result;
  };
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-contract-life-')));
    state = path.join(root, '.claude/.agents-united');
    skill = path.join(root, '.claude/skills/author-contract');
  });
  afterEach(async () => { await fs.remove(root); });

  it('registers the shipped task only in the contributor Bundle and installs its owned native closure', async () => {
    const result = await new InstallEngine().install('agent-factory', options());
    expect(result.installed.skills).toContain('author-contract');
    const receipt = await fs.readJson(path.join(skill, 'assets/claude-binding.json')) as { requiredSupport: string[]; references: Array<{ installed: string }> };
    const lock = await fs.readJson(path.join(state, 'agents-united.json')) as LockfileManifest;
    const paths = ['.claude/skills/author-contract/SKILL.md', ...receipt.requiredSupport.map(rel => `.claude/skills/author-contract/${rel}`), ...receipt.references.map(ref => ref.installed), '.claude/skills/author-contract/assets/claude-binding.json'];
    for (const rel of paths) {
      const bytes = await fs.readFile(path.join(root, rel));
      expect(lock.projections?.[rel]?.owners, rel).toEqual(['agent-factory']);
      expect(lock.projections?.[rel]?.hash, rel).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    }
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    const catalog = await fs.readJson(path.resolve('registry/bundles.json')) as { bundles: Record<string, { skills?: string[] }> };
    expect(Object.entries(catalog.bundles).filter(([, bundle]) => bundle.skills?.includes('author-contract')).map(([name]) => name)).toEqual(['agent-factory']);
    const report = await DoctorEngine.runDoctor(state);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(warning => /author-contract|projection|drift|Outdated/i.test(warning))).toEqual([]);
  });
  it('keeps maintainer evals out of an implicit store even when symlinks are requested', async () => {
    const store = path.join(root, '.agents');
    await new InstallEngine().install('agent-factory', options({ targetDir: store, method: 'symlink', implicitStore: true }));
    expect((await fs.lstat(path.join(store, 'skills/author-contract'))).isSymbolicLink()).toBe(false);
    expect(await fs.pathExists(path.join(store, 'skills/author-contract/evals'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(store, 'skills/author-contract/scripts/draft-pair.mjs'))).toBe(true);
  });
  it('preserves the whole workspace when a late required support path is unmanaged', async () => {
    const conflict = path.join(skill, 'references/verification.md');
    await fs.outputFile(conflict, 'Unmanaged user evidence must survive.\n');
    const before = await inventory();
    let error: unknown;
    try { await new InstallEngine().install('agent-factory', options()); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : error).toMatch(/unmanaged|not managed|collision|conflict/i);
    expect(await fs.readFile(conflict, 'utf8')).toBe('Unmanaged user evidence must survive.\n');
    expect(await inventory()).toEqual(before);
  });
  it('restores a missing bound reference through the recorded native update lane', async () => {
    await new InstallEngine().install('agent-factory', options());
    const file = path.join(skill, 'references/rules/domain-modeling-and-adr.md');
    const original = await fs.readFile(file);
    await fs.remove(file);
    const result = await new UpdateEngine().update('agent-factory', { targetDir: state });
    expect(result.updated.map(record => record.name)).toContain('agent-factory');
    expect(await fs.readFile(file)).toEqual(original);
    expect((await fs.readJson(path.join(state, 'agents-united.json'))).nativeLane).toBe(true);
  });
  it('preserves an edited support file and all state until explicit forced update', async () => {
    await new InstallEngine().install('agent-factory', options());
    const file = path.join(skill, 'references/verification.md');
    const original = await fs.readFile(file);
    await fs.appendFile(file, '\nKeep this local author note.\n');
    const before = await inventory();
    await expect(new UpdateEngine().update('agent-factory', { targetDir: state })).rejects.toThrow(/author-contract.*modified/i);
    expect(await inventory()).toEqual(before);
    await new UpdateEngine().update('agent-factory', { targetDir: state, force: true });
    expect(await fs.readFile(file)).toEqual(original);
  });
  it('refuses edited task removal even when the realizer receipt record is absent', async () => {
    await new InstallEngine().install('agent-factory', options());
    const lockFile = path.join(state, 'agents-united.json');
    const lock = await fs.readJson(lockFile) as LockfileManifest;
    if (lock.projections) delete lock.projections['.claude/skills/realize-artifact/assets/claude-binding.json'];
    await fs.writeJson(lockFile, lock);
    await fs.remove(path.join(root, '.claude/skills/realize-artifact/assets/claude-binding.json'));
    await fs.appendFile(path.join(skill, 'references/verification.md'), '\nKeep this local evidence.\n');
    const before = await inventory();
    await expect(new UninstallEngine().uninstall('agent-factory', { targetDir: state })).rejects.toThrow(/modifi|not managed/i);
    expect(await inventory()).toEqual(before);
  });
});
