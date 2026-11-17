import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import type { BundleDefinition, InstallOptions, LockfileManifest } from '../src/core/types.js';

describe('author-contract required native loading through the public installer', () => {
  let root: string;
  let registry: string;
  let workspace: string;
  let options: InstallOptions;
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-contract-loading-')));
    registry = path.join(root, 'registry');
    workspace = path.join(root, 'workspace');
    await fs.copy(path.resolve('registry'), registry);
    await fs.ensureDir(workspace);
    // Explicit pending-registration fixture; production activation/package proof is separate.
    const file = path.join(registry, 'bundles.json');
    const catalog = await fs.readJson(file) as { bundles: Record<string, BundleDefinition> };
    const factory = catalog.bundles['agent-factory']!;
    if (!factory.skills?.includes('author-contract')) factory.skills = [...(factory.skills ?? []), 'author-contract'];
    await fs.writeJson(file, catalog);
    options = { targetDir: path.join(workspace, '.claude/.agents-united'), method: 'copy', fanout: ['claude'], nativeLane: true };
  });
  afterEach(async () => { await fs.remove(root); });

  it('refuses a missing task binding before any installation state is written', async () => {
    await fs.remove(path.join(registry, 'hosts/claude/agent-factory-contract.binding.json'));
    let error: unknown;
    try { await new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : error).toMatch(/author-contract.*binding.*missing|contract.*missing.*binding/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('delivers the explicit foreground task, all required references and an owned binding receipt', async () => {
    await new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options);
    const skill = path.join(workspace, '.claude/skills/author-contract');
    const text = await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8');
    const meta = YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)![1]!);
    expect(meta).toMatchObject({ name: 'author-contract', context: 'fork', agent: 'general-purpose', background: false });
    const bindingFile = path.join(registry, 'hosts/claude/agent-factory-contract.binding.json');
    const binding = await fs.readJson(bindingFile) as { requiredSupport: string[]; references: Array<{ source: string; installed: string }> };
    const lock = await fs.readJson(path.join(options.targetDir!, 'agents-united.json')) as LockfileManifest;
    const paths = ['.claude/skills/author-contract/SKILL.md', ...binding.requiredSupport.map(rel => `.claude/skills/author-contract/${rel}`), ...binding.references.map(ref => ref.installed), '.claude/skills/author-contract/assets/claude-binding.json'];
    for (const rel of paths) {
      const bytes = await fs.readFile(path.join(workspace, rel));
      expect(lock.projections?.[rel]?.owners, rel).toContain('agent-factory');
      expect(lock.projections?.[rel]?.hash, rel).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    }
    const receipt = await fs.readJson(path.join(skill, 'assets/claude-binding.json'));
    expect(receipt.loadingRole).toEqual({ kind: 'built-in', name: 'general-purpose', context: 'fork', background: false });
    expect(receipt.sourceHash).toBe(`sha256:${crypto.createHash('sha256').update(await fs.readFile(bindingFile)).digest('hex')}`);
    expect(await fs.pathExists(path.join(workspace, '.claude/agents/general-purpose.md'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(workspace, '.claude/rules/skill-attribution.md'))).toBe(false);
  });
  it.each([
    'hosts/claude/skills/author-contract/SKILL.md',
    'skills/author-contract/scripts/draft-pair.mjs',
    'skills/author-contract/assets/job.schema.json',
    'skills/author-contract/assets/report.json',
    'skills/author-contract/examples/reused-pair.md',
    'rules/skill-attribution.md',
    'rules/domain-modeling-and-adr.md',
  ])('refuses missing required %s before writes', async rel => {
    await fs.remove(path.join(registry, rel));
    const reason = rel === 'rules/skill-attribution.md'
      ? /Registry validation.*rule.*skill-attribution\.md.*does not exist/i
      : /binding.*(missing|required)/i;
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(reason);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it.each([
    ['background', { background: true }],
    ['wrong role', { agent: 'Explore' }],
    ['missing fork', { context: 'main' }],
    ['preapproval', { 'allowed-tools': ['Bash'] }],
    ['hook overlay', { hooks: { Stop: [] } }],
    ['model override', { model: 'opus' }],
  ] as const)('refuses native %s drift before writes', async (_label, delta) => {
    const file = path.join(registry, 'hosts/claude/skills/author-contract/SKILL.md');
    const text = await fs.readFile(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)!;
    const meta = YAML.parse(match[1]!) as Record<string, unknown>;
    await fs.writeFile(file, `---\n${YAML.stringify({ ...meta, ...delta })}---\n${match[2]}`);
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*loader/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('refuses a linked helper, shadowing workflow and a colliding receipt before writes', async () => {
    const helper = path.join(registry, 'skills/author-contract/scripts/draft-pair.mjs');
    const actual = path.join(root, 'held-helper.mjs');
    await fs.move(helper, actual);
    await fs.symlink(actual, helper, 'file');
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*linked/i);
    await fs.remove(helper);
    await fs.move(actual, helper);
    const workflow = path.join(registry, 'hosts/claude/workflows/author-contract.js');
    await fs.outputFile(workflow, '// Unreviewed command collision.\n');
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*shadow/i);
    await fs.remove(workflow);
    await fs.outputJson(path.join(registry, 'skills/author-contract/assets/claude-binding.json'), { foreign: true });
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*receipt/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('refuses unreviewed support that would otherwise enter the complete projection plan', async () => {
    await fs.outputFile(path.join(registry, 'skills/author-contract/scripts/unreviewed.mjs'), 'throw new Error("must never run");\n');
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*unreviewed.*support.*plan/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it.each(['duplicate rules', 'support traversal', 'unknown field', 'required source omitted'])('refuses %s in the explicit task declaration', async kind => {
    const file = path.join(registry, 'hosts/claude/agent-factory-contract.binding.json');
    const binding = await fs.readJson(file) as { references: Array<{ source: string; installed: string }>; requiredSupport: string[]; grant?: string[] };
    if (kind === 'duplicate rules') binding.references[1] = binding.references[0]!;
    else if (kind === 'support traversal') binding.requiredSupport[0] = '../outside.md';
    else if (kind === 'unknown field') binding.grant = ['Bash'];
    else binding.requiredSupport.pop();
    await fs.writeJson(file, binding);
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options)).rejects.toThrow(/author-contract.*(declaration|rule references)/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('refuses an unowned registry request before canonical store writes', async () => {
    const file = path.join(registry, 'bundles.json');
    const catalog = await fs.readJson(file) as { bundles: Record<string, BundleDefinition> };
    delete catalog.bundles['agent-factory'];
    catalog.bundles['unowned-contract'] = { name: 'unowned-contract', description: 'Missing contributor ownership fixture', skills: ['author-contract'] };
    await fs.writeJson(file, catalog);
    let error: unknown;
    try { await new InstallEngine(new RegistryResolver(registry)).install('unowned-contract', { targetDir: path.join(workspace, '.agents'), method: 'copy', hosts: ['agents'], nativeLane: false }); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : error).toMatch(/author-contract.*owning.*agent-factory/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
  it('refuses plugin distribution through installer and public planner without relying on the realizer', async () => {
    const file = path.join(registry, 'bundles.json');
    const catalog = await fs.readJson(file) as { bundles: Record<string, BundleDefinition> };
    catalog.bundles['agent-factory']!.skills = ['author-skill', 'author-contract'];
    await fs.writeJson(file, catalog);
    const resolver = new RegistryResolver(registry);
    let error: unknown;
    try { await new InstallEngine(resolver).install('agent-factory', { ...options, pluginLane: true, implicitStore: true }); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : error).toMatch(/author-contract.*plugin.*unavailable/i);
    expect(await fs.readdir(workspace)).toEqual([]);
    const resolved = await resolver.resolve('agent-factory');
    await expect(ClaudeProjector.planPluginLane(catalog.bundles['agent-factory']!, resolved, registry, true)).rejects.toThrow(/author-contract.*plugin.*unavailable/i);
  });
});
