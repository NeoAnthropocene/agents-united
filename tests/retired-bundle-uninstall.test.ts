import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

describe('retired Bundle removal', () => {
  let root: string;
  let registryDir: string;
  let targetDir: string;
  let uninstaller: UninstallEngine;
  const readLock = () => fs.readJson(path.join(targetDir, 'agents-united.json'));
  const skill = (name: string) => path.join(targetDir, 'skills', name, 'SKILL.md');
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'retired-bundle-'));
    registryDir = path.join(root, 'registry');
    targetDir = path.join(root, 'project', '.agents');
    await fs.outputFile(path.join(registryDir, 'rules', 'GEMINI.md'), '# Fixture rule\n');
    await fs.outputJson(path.join(registryDir, 'hosts', 'antigravity', 'mcp', 'servers.json'), { servers: {} });
    for (const name of ['shared-fixture', 'exclusive-fixture']) {
      await fs.outputFile(path.join(registryDir, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture\n---\n\n# ${name}\n`);
    }
    const manifest = { bundles: {
      parent: { name: 'parent', tier: 'organization', domain: 'organization', description: 'Fixture parent', version: '1.0.0', skills: ['shared-fixture'] },
      retired: { name: 'retired', tier: 'organization', domain: 'organization', description: 'Fixture addon', version: '1.0.0', parentBundle: 'parent', skills: ['shared-fixture', 'exclusive-fixture'] },
    } };
    await fs.writeJson(path.join(registryDir, 'bundles.json'), manifest);
    const installer = new InstallEngine(new RegistryResolver(registryDir));
    await installer.install('parent', { targetDir, method: 'copy', hosts: ['agents'] });
    await installer.install('retired', { targetDir, method: 'copy', hosts: ['agents'] });
    await fs.outputFile(path.join(root, 'project', 'my-source.txt'), 'user source\n');
    delete (manifest.bundles as Partial<typeof manifest.bundles>).retired;
    await fs.writeJson(path.join(registryDir, 'bundles.json'), manifest);
    uninstaller = new UninstallEngine(new RegistryResolver(registryDir));
  });
  afterEach(async () => { await fs.remove(root); });

  it('previews without mutation and removes only exclusive owned files', async () => {
    const before = await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8');
    const preview = await uninstaller.uninstall('retired', { targetDir, dryRun: true });
    expect(preview.removed).toContain('skills/exclusive-fixture/SKILL.md');
    expect(preview.kept).toContain('skills/shared-fixture/SKILL.md');
    expect(await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8')).toBe(before);
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(true);
    await uninstaller.uninstall('retired', { targetDir });
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(false);
    expect(await fs.pathExists(skill('shared-fixture'))).toBe(true);
    expect(await fs.readFile(path.join(root, 'project', 'my-source.txt'), 'utf8')).toBe('user source\n');
    const lock = await readLock();
    expect(lock.installed.bundles).toEqual(['parent']);
    expect(lock.files['skills/shared-fixture/SKILL.md'].owners).toEqual(['parent']);
  });

  it('blocks an edited exclusive file without mutating any other file or lock', async () => {
    await fs.writeFile(skill('exclusive-fixture'), 'edited\n');
    const before = await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8');
    const shared = await fs.readFile(skill('shared-fixture'), 'utf8');
    await expect(uninstaller.uninstall('retired', { targetDir })).rejects.toThrow(/user modifications/);
    expect(await fs.readFile(skill('exclusive-fixture'), 'utf8')).toBe('edited\n');
    expect(await fs.readFile(skill('shared-fixture'), 'utf8')).toBe(shared);
    expect(await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8')).toBe(before);
  });

  it('removes an owner whose roster entry was lost', async () => {
    const lock = await readLock();
    lock.installed.bundles = ['parent'];
    await fs.writeJson(path.join(targetDir, 'agents-united.json'), lock);
    await uninstaller.uninstall('retired', { targetDir });
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(false);
    expect((await readLock()).files['skills/shared-fixture/SKILL.md'].owners).toEqual(['parent']);
  });

  it('preflights an edited owned projection before removing any files', async () => {
    const lock = await readLock();
    const rel = '.claude/skills/exclusive-fixture/SKILL.md';
    const projection = path.join(root, 'project', ...rel.split('/'));
    await fs.outputFile(projection, 'edited projection\n');
    lock.projections ??= {};
    lock.projections[rel] = { owners: ['retired'], kind: 'skill', hash: 'sha256:original', managedMarker: false };
    await fs.writeJson(path.join(targetDir, 'agents-united.json'), lock);
    const before = await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8');
    await expect(uninstaller.uninstall('retired', { targetDir })).rejects.toThrow(/user modifications/);
    expect(await fs.readFile(projection, 'utf8')).toBe('edited projection\n');
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(true);
    expect(await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8')).toBe(before);
  });

  it('protects edited projection content even when the managed marker remains', async () => {
    const lock = await readLock();
    const rel = '.claude/agents/retired-fixture.md';
    const projection = path.join(root, 'project', ...rel.split('/'));
    const original = '---\nname: retired-fixture\n---\n<!-- managed-by: agents-united -->\noriginal\n';
    await fs.outputFile(projection, original.replace('original', 'user edit'));
    lock.projections ??= {};
    lock.projections[rel] = { owners: ['retired'], kind: 'role', hash: `sha256:${crypto.createHash('sha256').update(original).digest('hex')}`, managedMarker: true };
    await fs.writeJson(path.join(targetDir, 'agents-united.json'), lock);
    const before = await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8');
    await expect(uninstaller.uninstall('retired', { targetDir })).rejects.toThrow(/user modifications/);
    expect(await fs.readFile(projection, 'utf8')).toContain('user edit');
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(true);
    expect(await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8')).toBe(before);
  });

  it('does not match an unknown identifier to a partial path', async () => {
    const before = await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8');
    await expect(uninstaller.uninstall('exclusive', { targetDir })).rejects.toThrow(/No installed assets/);
    expect(await fs.pathExists(skill('exclusive-fixture'))).toBe(true);
    expect(await fs.readFile(path.join(targetDir, 'agents-united.json'), 'utf8')).toBe(before);
  });
});

