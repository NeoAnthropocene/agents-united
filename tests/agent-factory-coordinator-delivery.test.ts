import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { LockfileManifest } from '../src/core/types.js';
import { SKILL_MD_MAX_CHARS, SKILL_MD_MAX_LINES, checkSkillLayout } from './helpers/skill-layout.js';
import { COORDINATOR_DECLARATION, COORDINATOR_ROOT, COORDINATOR_SUPPORT, coordinatorTree, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

/** The four support files the one-Skill-draft route adds to the coordinator closure (P8b stage 1). */
const NEW_SKILL_ROUTE_SUPPORT = ['references/skill-authoring.md', 'scripts/check-skill-return.mjs', 'assets/skill-task.schema.json', 'assets/skill-return.schema.json'] as const;

describe('factory coordinator required native delivery through public installation', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  beforeEach(async () => { fixture = await prepareFactoryCoordinator(); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('refuses the missing coordinator declaration before changing the entire workspace', async () => {
    await fs.remove(fixture.source(COORDINATOR_DECLARATION));
    await fs.outputFile(fixture.installed('notes/keep.md'), 'Preserve supplied evidence.\n');
    const before = await coordinatorTree(fixture.workspace);
    let error: unknown;
    try { await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options); }
    catch (failure) { error = failure; }
    expect(error instanceof Error ? error.message : 'installation succeeded').toMatch(/coordinate-artifact.*missing.*(binding|declaration)/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('installs the exact main and both complete worker closures with owned hashes and an independent receipt', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const receipt = await fs.readJson(fixture.installed(`${COORDINATOR_ROOT}/assets/claude-binding.json`));
    expect(receipt.requiredRoles).toEqual(['factory-realizer', 'factory-evaluator']);
    expect(receipt.requiredSupport).toEqual([...COORDINATOR_SUPPORT]);
    expect(receipt.requiredSupport).toHaveLength(11);
    for (const rel of NEW_SKILL_ROUTE_SUPPORT) {
      expect(receipt.requiredSupport, rel).toContain(rel);
      expect(await fs.pathExists(fixture.installed(`${COORDINATOR_ROOT}/${rel}`)), rel).toBe(true);
    }
    expect(receipt.roles).toEqual([{
      name: 'orchestrator-agent-factory', definition: 'orchestrator-agent-factory',
      contract: 'core/orchestrator-agent-factory.contract.json', source: 'hosts/claude/agents/orchestrator-agent-factory.md',
      installed: '.claude/agents/orchestrator-agent-factory.md', loading: 'main', skills: ['coordinate-artifact'], guard: 'destructive',
    }]);
    const native = await fs.readFile(fixture.installed('.claude/agents/orchestrator-agent-factory.md'), 'utf8');
    const meta = YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(native)![1]!);
    expect(meta).toMatchObject({ name: 'orchestrator-agent-factory', model: 'inherit', effort: 'medium', background: false, skills: ['coordinate-artifact'] });
    expect(meta.tools).toContain('Agent(factory-realizer, factory-evaluator)');
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    for (const skill of ['coordinate-artifact', 'realize-artifact', 'evaluate-artifact']) {
      const root = `.claude/skills/${skill}`;
      const binding = await fs.readJson(fixture.installed(`${root}/assets/claude-binding.json`));
      for (const rel of [binding.installed, `${root}/assets/claude-binding.json`, ...binding.roles.map((role: { installed: string }) => role.installed), ...binding.requiredSupport.map((file: string) => `${root}/${file}`), ...binding.references.map((ref: { installed: string }) => ref.installed), ...binding.requiredInstalled]) {
        const bytes = await fs.readFile(fixture.installed(rel));
        expect(lock.projections?.[rel]?.owners, rel).toContain('agent-factory');
        expect(lock.projections?.[rel]?.hash, rel).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
      }
    }
    expect(await fs.pathExists(fixture.source('agents/orchestrator-agent-factory.md'))).toBe(false);
  });
  it.each([
    'Agent', 'Agent, Agent(factory-realizer, factory-evaluator)', 'Agent(factory-realizer)',
    'Agent(factory-realizer, factory-evaluator, Explore)', 'Agent(factory-realizer, factory-realizer)',
    'Agent(*)', 'Agent(factory-realizer, Agent(factory-evaluator))', 'Task(factory-realizer, factory-evaluator)',
  ])('refuses unsafe delegate grant %s before any workspace mutation', async grant => {
    const file = fixture.source('hosts/claude/agents/orchestrator-agent-factory.md');
    const text = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, text.replace('Agent(factory-realizer, factory-evaluator)', grant));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*(Agent|delegate)|grant mismatch/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('refuses an unreviewed extra coordinator support file before writes', async () => {
    await fs.outputFile(fixture.source('skills/coordinate-artifact/assets/unreviewed.json'), '{}\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*unreviewed.*support/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(COORDINATOR_SUPPORT)('refuses a native entry that omits the declared support %s before writes', async rel => {
    const entry = fixture.source('hosts/claude/skills/coordinate-artifact/SKILL.md');
    await fs.writeFile(entry, (await fs.readFile(entry, 'utf8')).replaceAll(rel, 'omitted-support'));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*omits required consultation/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(NEW_SKILL_ROUTE_SUPPORT)('refuses a coordinator declaration that drops the new support %s before writes', async rel => {
    const file = fixture.source(COORDINATOR_DECLARATION), binding = await fs.readJson(file);
    binding.requiredSupport = binding.requiredSupport.filter((item: string) => item !== rel);
    await fs.writeJson(file, binding);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*required support differs/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('keeps both coordinator entries inside the layout cap and flags an entry over 6,000 characters', async () => {
    const lf = (text: string): string => text.replace(/\r\n/g, '\n');
    for (const rel of ['skills/coordinate-artifact/SKILL.md', 'hosts/claude/skills/coordinate-artifact/SKILL.md']) {
      const text = lf(await fs.readFile(fixture.source(rel), 'utf8'));
      expect(text.length, rel).toBeLessThanOrEqual(SKILL_MD_MAX_CHARS);
      expect(text.split('\n').length, rel).toBeLessThanOrEqual(SKILL_MD_MAX_LINES);
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-coordinator-layout-'));
    try {
      const native = lf(await fs.readFile(fixture.source('hosts/claude/skills/coordinate-artifact/SKILL.md'), 'utf8'));
      await fs.outputFile(path.join(root, 'coordinate-artifact/SKILL.md'), native + '\n' + 'padding '.repeat(200) + '\n');
      expect(checkSkillLayout(root, 'coordinate-artifact').join('\n')).toContain('(max ' + SKILL_MD_MAX_CHARS + ')');
    } finally { await fs.remove(root); }
  });

  it('refuses a coordinator dependency whose required runbook closure has been weakened', async () => {
    const file = fixture.source('hosts/claude/agent-factory-realize.binding.json');
    const binding = await fs.readJson(file);
    binding.requiredSupport = binding.requiredSupport.filter((rel: string) => rel !== 'references/handback.md');
    await fs.writeJson(file, binding);
    const entry = fixture.source('hosts/claude/skills/realize-artifact/SKILL.md');
    await fs.writeFile(entry, (await fs.readFile(entry, 'utf8')).replaceAll('references/handback.md', 'omitted-handback'));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*worker.*closure/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('keeps the realizer exact classes even when both its core and tool list request Task tools', async () => {
    const core = fixture.source('core/subagent-realize-for-host.core.md');
    await fs.writeFile(core, (await fs.readFile(core, 'utf8')).replace('report, handback]', 'report, handback, task-tracking]'));
    const native = fixture.source('hosts/claude/agents/factory-realizer.md');
    await fs.writeFile(native, (await fs.readFile(native, 'utf8')).replace('tools: ', 'tools: TaskCreate, TaskGet, TaskList, TaskUpdate, TodoWrite, '));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*worker.*capabilit/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('refuses an unowned coordinator before canonical writes', async () => {
    const file = fixture.source('bundles.json');
    const catalog = await fs.readJson(file);
    delete catalog.bundles['agent-factory'];
    catalog.bundles.unowned = { name: 'unowned', skills: ['coordinate-artifact'] };
    await fs.writeJson(file, catalog);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('unowned', { ...fixture.options, targetDir: fixture.installed('.agents'), hosts: ['agents'], fanout: [], nativeLane: false })).rejects.toThrow(/coordinate-artifact.*owning.*agent-factory/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('refuses direct plugin planning for the coordinator without relying on worker tasks', async () => {
    const resolver = new RegistryResolver(fixture.registry);
    const bundle = (await resolver.getBundle('agent-factory'))!;
    const resolved = await resolver.resolve('agent-factory');
    resolved.skills = ['coordinate-artifact'];
    await expect(ClaudeProjector.planPluginLane(bundle, resolved, fixture.registry, true)).rejects.toThrow(/factory.*plugin.*unavailable/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual({});
  });

  it.each([
    'core/orchestrator-agent-factory.core.md', 'core/orchestrator-agent-factory.contract.json',
    'hosts/claude/agents/orchestrator-agent-factory.md', 'hosts/claude/skills/coordinate-artifact/SKILL.md', 'skills/coordinate-artifact/SKILL.md',
    ...COORDINATOR_SUPPORT.map(rel => `skills/coordinate-artifact/${rel}`),
    'rules/git-guardrails.md', 'rules/skill-attribution.md',
    'hosts/claude/agent-factory-realize.binding.json', 'hosts/claude/agent-factory-evaluate.binding.json',
    'hosts/claude/agents/factory-realizer.md', 'hosts/claude/agents/factory-evaluator.md',
    'skills/realize-artifact/scripts/check-handback.mjs', 'skills/evaluate-artifact/assets/rubric.json',
    'hosts/claude/hooks/agents-united-guard.js', 'hosts/claude/hooks/agents-united-readonly-guard.js',
  ])('refuses missing complete-closure source %s before writes', async rel => {
    await fs.remove(fixture.source(rel));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/missing|required|does not exist/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(['missing', 'wrong', 'extra', 'duplicate'])('rejects %s requiredRoles without accepting an arbitrary dependency graph', async kind => {
    const file = fixture.source(COORDINATOR_DECLARATION), binding = await fs.readJson(file);
    if (kind === 'missing') delete binding.requiredRoles;
    else if (kind === 'wrong') binding.requiredRoles = ['Explore', 'factory-evaluator'];
    else if (kind === 'extra') binding.requiredRoles.push('Explore');
    else binding.requiredRoles = ['factory-realizer', 'factory-realizer'];
    await fs.writeJson(file, binding);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/declaration/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each([{ loading: 'subagent' }, { name: 'another-main' }])('rejects an altered main role binding %j', async delta => {
    const file = fixture.source(COORDINATOR_DECLARATION), binding = await fs.readJson(file);
    Object.assign(binding.roles[0], delta); await fs.writeJson(file, binding);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/exact main role/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each([{ model: 'opus' }, { background: true }, { permissionMode: 'acceptEdits' }, { memory: 'project' }, { disallowedTools: ['Agent'] }])('rejects unreviewed main mechanics %j', async delta => {
    const file = fixture.source('hosts/claude/agents/orchestrator-agent-factory.md'), text = await fs.readFile(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)!;
    await fs.writeFile(file, `---\n${YAML.stringify({ ...YAML.parse(match[1]!), ...delta })}---\n${match[2]}`);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/main must retain|deny overlay|unknown native key/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(['fork', 'injection', 'workflow', 'receipt collision'])('rejects runbook %s before writes', async kind => {
    const entry = fixture.source('hosts/claude/skills/coordinate-artifact/SKILL.md');
    if (kind === 'fork') await fs.writeFile(entry, (await fs.readFile(entry, 'utf8')).replace('user-invocable: false', 'user-invocable: false\ncontext: fork'));
    else if (kind === 'injection') await fs.appendFile(entry, '\n!`node unreviewed.mjs`\n');
    else if (kind === 'workflow') await fs.outputFile(fixture.source('hosts/claude/workflows/coordinate-artifact.js'), '// shadow\n');
    else await fs.outputFile(fixture.source('skills/coordinate-artifact/assets/claude-binding.json'), '{}\n');
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/preload|runbook|shadow|duplicate/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(['overlay', 'injection'])('refuses a realizer preload %s in the coordinator complete closure before writes', async kind => {
    const entry = fixture.source('hosts/claude/skills/realize-artifact/SKILL.md');
    const text = await fs.readFile(entry, 'utf8');
    await fs.writeFile(entry, kind === 'overlay' ? text.replace('user-invocable: false', 'user-invocable: false\nallowed-tools: Bash(*)') : `${text}\n!\`node unreviewed.mjs\`\n`);
    const before = await coordinatorTree(fixture.workspace);
    let failure: unknown;
    try { await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options); } catch (error) { failure = error; }
    expect(failure instanceof Error ? failure.message : 'installation succeeded').toMatch(/preload|injection|mechanics/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it.each(['coordinate-artifact', 'coordinate-artifact.md'])('keeps restricted partial %s unavailable before writes', async identifier => {
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install(identifier, fixture.options)).rejects.toThrow(/partial.*direct|bundle by name/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

});
