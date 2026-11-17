import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { LockfileManifest } from '../src/core/types.js';
import { BUNDLE_SUPPORT, BUNDLE_RULES, BUNDLE_TASK_ROOT, bundleTemplateTree, prepareBundleTemplate } from './helpers/factory-bundle-template.js';

describe('author-bundle required native delivery through the public installer', () => {
  let fixture: Awaited<ReturnType<typeof prepareBundleTemplate>>;
  beforeEach(async () => { fixture = await prepareBundleTemplate(); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('refuses its missing own declaration before changing the complete workspace', async () => {
    await fs.remove(fixture.source('hosts/claude/agent-factory-bundle.binding.json'));
    await fs.outputFile(fixture.installed('notes/keep.md'), 'Preserve caller evidence.\n');
    const before = await bundleTemplateTree(fixture.workspace);
    let error: unknown;
    try { await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : error).toMatch(/author-bundle.*missing required task binding/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('delivers its complete native entry, ten resources, seven policies and independent owned receipt', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const text = await fs.readFile(fixture.installed(`${BUNDLE_TASK_ROOT}/SKILL.md`), 'utf8');
    expect(YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)![1]!)).toMatchObject({ name: 'author-bundle', context: 'fork', agent: 'general-purpose', background: false });
    const receipt = await fs.readJson(fixture.installed(`${BUNDLE_TASK_ROOT}/assets/claude-binding.json`));
    expect([...receipt.requiredSupport].sort()).toEqual([...BUNDLE_SUPPORT].sort());
    expect(receipt.references.map((ref: { source: string }) => ref.source).sort()).toEqual(BUNDLE_RULES.map(rule => `rules/${rule}`).sort());
    expect(receipt.sourceHash).toBe(`sha256:${crypto.createHash('sha256').update(await fs.readFile(fixture.source('hosts/claude/agent-factory-bundle.binding.json'))).digest('hex')}`);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    for (const rel of [`${BUNDLE_TASK_ROOT}/SKILL.md`, `${BUNDLE_TASK_ROOT}/assets/claude-binding.json`, ...BUNDLE_SUPPORT.map(file => `${BUNDLE_TASK_ROOT}/${file}`), ...receipt.references.map((ref: { installed: string }) => ref.installed)]) {
      const bytes = await fs.readFile(fixture.installed(rel));
      expect(lock.projections?.[rel]?.owners, rel).toEqual(['agent-factory']);
      expect(lock.projections?.[rel]?.hash, rel).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    }
    for (const name of ['author-contract', 'realize-artifact', 'evaluate-artifact']) expect(await fs.pathExists(fixture.installed(`.claude/skills/${name}`))).toBe(false);
    expect(await fs.pathExists(fixture.installed('.claude/agents/general-purpose.md'))).toBe(false);
  });
  it.each(['!`node unreviewed.mjs`', '```!\nnode unreviewed.mjs\n```'])('refuses native dynamic shell injection %s before changing any workspace state', async injection => {
    await fs.appendFile(fixture.source('hosts/claude/skills/author-bundle/SKILL.md'), `\n${injection}\n`);
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/author-bundle.*dynamic shell injection/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('refuses plugin distribution without another factory task providing its restriction', async () => {
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, pluginLane: true, implicitStore: true })).rejects.toThrow(/author-bundle.*plugin.*unavailable/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('refuses unowned author-bundle before canonical or projection writes', async () => {
    const file = fixture.source('bundles.json');
    const catalog = await fs.readJson(file);
    delete catalog.bundles['agent-factory'];
    catalog.bundles.unowned = { name: 'unowned', skills: ['author-bundle'] };
    await fs.writeJson(file, catalog);
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('unowned', { ...fixture.options, targetDir: fixture.installed('.agents'), hosts: ['agents'], fanout: [], nativeLane: false })).rejects.toThrow(/author-bundle.*owning.*agent-factory/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each([
    'hosts/claude/skills/author-bundle/SKILL.md', 'skills/author-bundle/SKILL.md',
    ...BUNDLE_SUPPORT.map(file => `skills/author-bundle/${file}`), ...BUNDLE_RULES.map(rule => `rules/${rule}`),
  ])('refuses missing required source %s with the entire workspace preserved', async rel => {
    await fs.remove(fixture.source(rel));
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/missing|required|does not exist/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each([
    ['background', { background: true }], ['role', { agent: 'Explore' }], ['context', { context: 'main' }],
    ['grant', { 'allowed-tools': ['Bash'] }], ['model', { model: 'opus' }], ['permission', { permissionMode: 'acceptEdits' }],
    ['hook', { hooks: { Stop: [] } }], ['preload', { skills: ['host-agent-router'] }], ['unknown', { customMode: true }],
  ] as const)('refuses unreviewed native %s mechanics before writes', async (_label, delta) => {
    const file = fixture.source('hosts/claude/skills/author-bundle/SKILL.md');
    const text = await fs.readFile(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)!;
    await fs.writeFile(file, `---\n${YAML.stringify({ ...YAML.parse(match[1]!), ...delta })}---\n${match[2]}`);
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/author-bundle.*loader/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each(['duplicate support', 'missing support', 'traversal', 'duplicate policy', 'unknown declaration', 'surface'])('refuses %s in its closed declaration before writes', async kind => {
    const file = fixture.source('hosts/claude/agent-factory-bundle.binding.json');
    const binding = await fs.readJson(file);
    if (kind === 'duplicate support') binding.requiredSupport[1] = binding.requiredSupport[0];
    else if (kind === 'missing support') binding.requiredSupport.pop();
    else if (kind === 'traversal') binding.requiredSupport[0] = '../outside.md';
    else if (kind === 'duplicate policy') binding.references[1] = binding.references[0];
    else if (kind === 'surface') binding.surface.scope = 'global';
    else binding.grants = ['Bash'];
    await fs.writeJson(file, binding);
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/author-bundle.*(declaration|references)/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each([
    ['workflow shadow', 'hosts/claude/workflows/author-bundle.js', /shadow/i],
    ['rule collision', 'skills/author-bundle/references/rules/git-guardrails.md', /collid/i],
    ['receipt collision', 'skills/author-bundle/assets/claude-binding.json', /receipt/i],
    ['unbound support', 'skills/author-bundle/assets/unreviewed.json', /unreviewed.*support/i],
  ] as const)('refuses %s before writes', async (_label, rel, reason) => {
    await fs.outputFile(fixture.source(rel), '{}\n');
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(reason);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it('refuses linked required support before touching the workspace', async () => {
    const rel = 'skills/author-bundle/references/job.md';
    const external = path.join(fixture.root, 'job.md');
    await fs.move(fixture.source(rel), external);
    await fs.symlink(external, fixture.source(rel), 'file');
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/author-bundle.*linked/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each([
    { fanout: ['cline'] }, { scope: 'global' as const }, { nativeLane: false },
  ])('refuses unavailable delivery %j with the whole workspace preserved', async extra => {
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', { ...fixture.options, ...extra })).rejects.toThrow(/unavailable|native lane|workspace/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

  it.each(['author-bundle', 'author-bundle.md', 'author--bundle'])('keeps direct partial %s unavailable before writes', async identifier => {
    const before = await bundleTemplateTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install(identifier, fixture.options)).rejects.toThrow(/partial.*direct|bundle by name/i);
    expect(await bundleTemplateTree(fixture.workspace)).toEqual(before);
  });

});
