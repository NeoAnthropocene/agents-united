import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { prepareFactoryNative } from './helpers/factory-native.js';
import { prepareFactoryEvaluator, prepareProductionEvaluator } from './helpers/factory-evaluator.js';

describe('independent factory evaluator delivery', () => {
  let root: string | undefined;
  afterEach(async () => { if (root) await fs.remove(root); });

  it('refuses the missing evaluator binding before any workspace mutation when realization is absent', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-delivery-'));
    const fixture = await prepareFactoryNative(root);
    const { registry, workspace } = fixture;
    await fs.outputFile(path.join(registry, 'skills/evaluate-artifact/SKILL.md'),
      '---\nname: evaluate-artifact\ndescription: Review one fixed candidate without changing it.\nlicense: MIT\n---\nReview the caller-selected evidence.\n');
    // Preserve the already approved contributor entry; only realization is absent.
    await fs.outputJson(path.join(registry, 'bundles.json'), { version: 1, bundles: {
      'agent-factory': { ...fixture.bundle, skills: ['author-skill', 'evaluate-artifact'] },
    } });
    await fs.remove(fixture.source('hosts/claude/agent-factory-realize.binding.json'));
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', {
      targetDir: path.join(workspace, '.claude/.agents-united'), fanout: ['claude'], method: 'copy',
      nativeLane: true, allowUnderConstruction: true,
    })).rejects.toThrow(/factory.*missing.*agent-factory-evaluate\.binding\.json/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it('delivers its independent role, read-only guard, preload, reference and receipt without realization', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-closure-'));
    const fixture = await prepareFactoryEvaluator(root);
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    for (const rel of ['.claude/agents/factory-evaluator.md', '.claude/hooks/agents-united-readonly-guard.js',
      '.claude/skills/evaluate-artifact/SKILL.md', '.claude/skills/evaluate-artifact/references/job.md',
      '.claude/skills/evaluate-artifact/references/rules/skill-attribution.md', '.claude/skills/evaluate-artifact/assets/claude-binding.json']) {
      expect(await fs.pathExists(fixture.installed(rel)), rel).toBe(true);
    }
    expect(await fs.pathExists(fixture.installed('.claude/agents/factory-realizer.md'))).toBe(false);
    const receipt = await fs.readJson(fixture.installed('.claude/skills/evaluate-artifact/assets/claude-binding.json'));
    expect(receipt.roles).toMatchObject([{ name: 'factory-evaluator', loading: 'subagent', guard: 'read-only' }]);
    expect(receipt.requiredInstalled).toEqual([]);
  });

  it('refuses a declaration that delivers another name instead of the callable evaluator role', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-name-'));
    const fixture = await prepareFactoryEvaluator(root);
    const role = fixture.binding.roles[0]!;
    const alternate = { ...role, name: 'arbitrary-reader', source: 'hosts/claude/agents/arbitrary-reader.md', installed: '.claude/agents/arbitrary-reader.md' };
    await fs.outputFile(fixture.source(alternate.source), (await fs.readFile(fixture.source(role.source), 'utf8')).replace('name: factory-evaluator', 'name: arbitrary-reader'));
    await fs.writeJson(fixture.source('hosts/claude/agent-factory-evaluate.binding.json'), { ...fixture.binding, roles: [alternate] });
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options))
      .rejects.toThrow(/factory.*required.*evaluator.*role/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('refuses the unreviewed evaluator plugin route before writing installation state', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-plugin-'));
    const fixture = await prepareFactoryEvaluator(root);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', {
      ...fixture.options, pluginLane: true, implicitStore: true,
    })).rejects.toThrow(/factory.*plugin/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('copies evaluator runtime resources without exposing prepared evals through an implicit-store link', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-copy-'));
    const fixture = await prepareFactoryEvaluator(root);
    const state = fixture.installed('.agents');
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', {
      ...fixture.options, targetDir: state, implicitStore: true, method: 'symlink',
    });
    expect(await fs.pathExists(path.join(state, 'skills/evaluate-artifact/evals'))).toBe(false);
    expect((await fs.lstat(path.join(state, 'skills/evaluate-artifact'))).isSymbolicLink()).toBe(false);
    expect(await fs.pathExists(fixture.installed('.claude/skills/evaluate-artifact/evals'))).toBe(false);
  });

  it('refuses an unrelated bundle exposing the evaluator before canonical or native writes', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-owner-'));
    const fixture = await prepareFactoryEvaluator(root);
    await fs.writeJson(fixture.source('bundles.json'), { version: 1, bundles: { ordinary: {
      name: 'ordinary', description: 'Unrelated bundle', skills: ['evaluate-artifact'],
    } } });
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('ordinary', fixture.options))
      .rejects.toThrow(/owning.*agent-factory/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it('delivers the production evaluator, required runbook and complete declared support from the contributor Bundle', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-production-'));
    const state = path.join(root, '.claude/.agents-united');
    await new InstallEngine(new RegistryResolver(path.resolve('registry'))).install('agent-factory', {
      targetDir: state, fanout: ['claude'], method: 'copy', nativeLane: true, allowUnderConstruction: true,
    });
    const skill = path.join(root, '.claude/skills/evaluate-artifact');
    expect(await fs.pathExists(path.join(root, '.claude/agents/factory-evaluator.md'))).toBe(true);
    const binding = await fs.readJson(path.join(skill, 'assets/claude-binding.json'));
    expect(binding.roles).toMatchObject([{ name: 'factory-evaluator', loading: 'subagent', guard: 'read-only' }]);
    expect(binding.requiredSupport).toHaveLength(13);
    expect(binding.references).toHaveLength(7);
    for (const rel of binding.requiredSupport as string[]) expect(await fs.pathExists(path.join(skill, rel)), rel).toBe(true);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(root, '.claude/hooks/agents-united-readonly-guard.js'))).toBe(true);
  });

  it('refuses coordinated core/native edits that widen the fixed evaluator capability classes', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-grant-'));
    const fixture = await prepareFactoryEvaluator(root);
    const coreFile = fixture.source('core/subagent-factory-evaluator.core.md');
    const text = await fs.readFile(coreFile, 'utf8');
    const match = /^---\n([\s\S]*?)\n---/.exec(text)!;
    const core = YAML.parse(match[1]!); core.capabilities.push('edit');
    await fs.writeFile(coreFile, `---\n${YAML.stringify(core)}---\n`);
    const roleFile = fixture.source('hosts/claude/agents/factory-evaluator.md');
    await fs.writeFile(roleFile, (await fs.readFile(roleFile, 'utf8')).replace('tools: Glob,', 'tools: Edit, NotebookEdit, Write, Glob,'));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options))
      .rejects.toThrow(/evaluator.*capabilit|read.only.*class/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it.each([
    'hosts/claude/agent-factory-evaluate.binding.json', 'core/subagent-factory-evaluator.core.md', 'core/subagent-factory-evaluator.contract.json',
    'hosts/claude/agents/factory-evaluator.md', 'hosts/claude/skills/evaluate-artifact/SKILL.md', 'skills/evaluate-artifact/SKILL.md',
    'skills/evaluate-artifact/scripts/check-review.mjs', 'skills/evaluate-artifact/assets/job.schema.json', 'skills/evaluate-artifact/assets/result.schema.json',
    'skills/evaluate-artifact/assets/rubric.json', 'skills/evaluate-artifact/assets/report.json', 'skills/evaluate-artifact/references/evidence.md',
    'skills/evaluate-artifact/examples/shared-pair-review.md', 'rules/quality-aesthetics-accessibility.md', 'hosts/claude/hooks/agents-united-readonly-guard.js',
  ])('refuses the missing required production edge %s before writes without realization', async rel => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-required-'));
    const fixture = await prepareProductionEvaluator(root);
    await fs.remove(fixture.source(rel));
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options))
      .rejects.toThrow(/factory.*(missing|required)/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['allowed-tools', 'Bash'], ['hooks', { Stop: [{ hooks: [{ type: 'command', command: 'node', args: ['--version'] }] }] }],
    ['model', 'opus'], ['background', true], ['shell', 'powershell'],
  ])('refuses an unreviewed %s mechanic in the evaluator preload before writes', async (key, value) => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-preload-'));
    const fixture = await prepareProductionEvaluator(root);
    const file = fixture.source('hosts/claude/skills/evaluate-artifact/SKILL.md');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(await fs.readFile(file, 'utf8'))!;
    const metadata = YAML.parse(match[1]!) as Record<string, unknown>; metadata[key] = value;
    await fs.writeFile(file, `---\n${YAML.stringify(metadata)}---\n${match[2]}`);
    let failure: unknown;
    try { await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/factory.*preload.*mechanic/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });

  it.each(['!`node --version`', '```!\nnode --version\n```'])('refuses dynamic shell injection in a read-only preload before writes: %s', async injection => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-injection-'));
    const fixture = await prepareProductionEvaluator(root);
    const file = fixture.source('hosts/claude/skills/evaluate-artifact/SKILL.md');
    await fs.appendFile(file, `\n${injection}\n`);
    let failure: unknown;
    try { await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/evaluator.*preload.*shell injection/i);
    expect(await fs.readdir(fixture.workspace)).toEqual([]);
  });
});
