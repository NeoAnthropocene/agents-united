import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UpdateEngine } from '../src/core/updater.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { BUNDLE_TASK_ROOT, bundleTemplateTree, prepareBundleTemplate } from './helpers/factory-bundle-template.js';

describe('author-bundle own delivery lifecycle', () => {
  let fixture: Awaited<ReturnType<typeof prepareBundleTemplate>>;
  beforeEach(async () => { fixture = await prepareBundleTemplate(); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('copies its canonical task without maintainer evals even when an implicit store requests symlinks', async () => {
    const store = fixture.installed('.agents');
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, targetDir: store, implicitStore: true, method: 'symlink' });
    expect((await fs.lstat(path.join(store, 'skills/author-bundle'))).isSymbolicLink()).toBe(false);
    expect(await fs.pathExists(path.join(store, 'skills/author-bundle/evals'))).toBe(false);
    expect(await fs.pathExists(fixture.installed(`${BUNDLE_TASK_ROOT}/evals`))).toBe(false);
  });

  it('uses its own receipt to preserve all workspace state on edited removal with source and other receipts absent', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-bundle.binding.json'));
    await fs.appendFile(fixture.installed(`${BUNDLE_TASK_ROOT}/references/verification.md`), '\nPreserve caller edits.\n');
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/modifi|not managed/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });
  it('is idempotent, healthy to doctor and restores missing support through sticky native update', async () => {
    const resolver = new RegistryResolver(fixture.registry), installer = new InstallEngine(resolver);
    await installer.install('agent-factory', fixture.options);
    const first = await bundleTemplateTree(fixture.workspace);
    await installer.install('agent-factory', fixture.options);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(first);
    const report = await DoctorEngine.runDoctor(fixture.state);
    expect(report.issues).toEqual([]);
    expect(report.warnings.filter(warning => /author-bundle|projection|drift|Outdated/i.test(warning))).toEqual([]);
    const file = fixture.installed(`${BUNDLE_TASK_ROOT}/references/prerequisites.md`), original = await fs.readFile(file);
    await fs.remove(file);
    const missing = await DoctorEngine.runDoctor(fixture.state);
    expect([...missing.issues, ...missing.warnings].join('\n')).toMatch(/Missing.*author-bundle.*prerequisites/i);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state });
    expect(await fs.readFile(file)).toEqual(original);
    expect((await fs.readJson(path.join(fixture.state, 'agents-united.json'))).nativeLane).toBe(true);
  });

  it('preserves all state on edited update until explicit forced replacement', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    const file = fixture.installed(`${BUNDLE_TASK_ROOT}/references/verification.md`), original = await fs.readFile(file);
    await fs.appendFile(file, '\nPreserve local review.\n');
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/author-bundle.*modified/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
    await new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.readFile(file)).toEqual(original);
  });

  it('rejects a missing own source binding during update before any state migration', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-bundle.binding.json'));
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new UpdateEngine(resolver).update('agent-factory', { targetDir: fixture.state })).rejects.toThrow(/author-bundle.*missing.*binding/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('preserves the full workspace on a late unmanaged support collision', async () => {
    await fs.outputFile(fixture.installed(`${BUNDLE_TASK_ROOT}/assets/report.json`), 'Keep the caller report.\n');
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/author-bundle.*unmanaged.*collision/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('removes from its own receipt with the source absent, preserving unrelated drafts', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.remove(fixture.source('hosts/claude/agent-factory-bundle.binding.json'));
    await fs.outputFile(fixture.installed('drafts/keep.md'), 'Independent proposal.\n');
    await new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state });
    expect(await fs.pathExists(fixture.installed(`${BUNDLE_TASK_ROOT}/SKILL.md`))).toBe(false);
    expect(await fs.pathExists(fixture.installed(`${BUNDLE_TASK_ROOT}/assets/claude-binding.json`))).toBe(false);
    expect(await fs.readFile(fixture.installed('drafts/keep.md'), 'utf8')).toBe('Independent proposal.\n');
  });

  it('only replaces an edited owned task on explicit forced removal', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    await new InstallEngine(resolver).install('agent-factory', fixture.options);
    await fs.appendFile(fixture.installed(`${BUNDLE_TASK_ROOT}/references/verification.md`), '\nLocal edit.\n');
    await new UninstallEngine(resolver).uninstall('agent-factory', { targetDir: fixture.state, force: true });
    expect(await fs.pathExists(fixture.installed(`${BUNDLE_TASK_ROOT}/references/verification.md`))).toBe(false);
  });

  it('registers the original proposal task only in the production contributor factory', async () => {
    const resolver = new RegistryResolver();
    const catalog = await resolver.loadBundles();
    expect(Object.values(catalog.bundles).filter(bundle => bundle.skills?.includes('author-bundle')).map(bundle => bundle.name)).toEqual(['agent-factory']);
    expect((await resolver.resolve('full')).skills).not.toContain('author-bundle');
  });

});
