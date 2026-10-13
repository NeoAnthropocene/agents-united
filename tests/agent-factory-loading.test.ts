import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { BundleDefinition, LockfileManifest } from '../src/core/types.js';

const root = path.resolve('scratch/test-agent-factory-loading');
const registryDir = path.join(root, 'registry');
const workspace = path.join(root, 'workspace');
const support = [
  'references/job.md', 'references/provenance.md', 'references/quality.md',
  'examples/one-draft.md', 'assets/report.md', 'scripts/draft.mjs',
];
const skillRoot = '.claude/skills/author-skill';
const bundle: BundleDefinition = {
  name: 'agent-factory', domain: 'contributor', description: 'Fixture authoring entry',
  status: 'under-construction', hostAvailability: { claude: { lane: 'native', scopes: ['workspace'] } }, skills: ['author-skill'], rules: ['skill-attribution.md'],
};
const shared = '---\nname: author-skill\ndescription: Create one local skill draft.\nmetadata:\n  author: NeoAnthropocene\n  version: "1.0.0"\n  license: MIT\n---\n# Shared authoring job\n';
const native = shared.replace('metadata:', 'context: fork\nagent: general-purpose\nbackground: false\nmetadata:')
  + '\nRead [the attribution rule](references/skill-attribution.md) before inspecting a source or writing a draft.\n';
const binding = {
  version: 1, bundle: 'agent-factory', skill: 'author-skill',
  source: 'hosts/claude/skills/author-skill/SKILL.md', installed: `${skillRoot}/SKILL.md`,
  loadingRole: { kind: 'built-in', name: 'general-purpose', context: 'fork', background: false },
  invocation: '/author-skill',
  surface: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native' },
  requiredSupport: support,
  rule: { source: 'rules/skill-attribution.md', installed: `${skillRoot}/references/skill-attribution.md`, consultation: 'before-source-or-draft' },
  reviewedInputs: ['host-library/claude/guide/skill.md', 'host-library/claude/pages/skill/skills.md#run-skills-in-a-subagent'],
};
const resolved = { targetBundle: bundle.name, agents: [], skills: ['author-skill'], rules: ['skill-attribution.md'], workflows: [] };
const at = (rel: string) => path.join(registryDir, ...rel.split('/'));
const installed = (rel: string) => path.join(workspace, ...rel.split('/'));

async function plan() {
  return ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir, undefined, true);
}
async function install() {
  return new InstallEngine(new RegistryResolver(registryDir)).install(bundle.name, {
    targetDir: path.join(workspace, '.agents'), method: 'copy', fanout: ['claude'],
    nativeLane: true, implicitStore: true, allowUnderConstruction: true,
  });
}
async function inventory(dir: string): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...(await inventory(path.join(dir, entry.name))).map(rel => `${entry.name}/${rel}`));
    else out.push(entry.name);
  }
  return out.sort();
}

describe('Plan 033 slice 3 Claude skill loading', () => {
  beforeEach(async () => {
    await fs.remove(root);
    await fs.ensureDir(workspace);
    await fs.outputJson(at('bundles.json'), { version: 1, bundles: { [bundle.name]: bundle } });
    await fs.outputFile(at('skills/author-skill/SKILL.md'), shared);
    for (const rel of support) await fs.outputFile(at(`skills/author-skill/${rel}`), `Support for ${rel}\n`);
    await fs.outputFile(at('skills/author-skill/evals/evals.json'), '{"maintainer":true}\n');
    await fs.outputFile(at(binding.source), native);
    await fs.outputFile(at('rules/GEMINI.md'), '# Baseline fixture\n');
    await fs.outputFile(at(binding.rule.source), '# Attribution fixture\n\nPreserve source and licence evidence.\n');
    await fs.outputJson(at('hosts/claude/agent-factory.binding.json'), binding, { spaces: 2 });
  });
  afterEach(async () => { await fs.remove(root); });

  it('plans the native fork entry, shared resources and on-demand tracked rule', async () => {
    const artifacts = await plan();
    const loader = artifacts.find(artifact => artifact.relPath === `${skillRoot}/SKILL.md`);
    expect(loader?.kind).toBe('skill');
    const frontmatter = YAML.parse(/^---\n([\s\S]*?)\n---/.exec(loader?.content ?? '')?.[1] ?? '');
    expect(frontmatter).toMatchObject({ context: 'fork', agent: 'general-purpose', background: false });
    expect(loader?.content).toContain('profile: claude-native');
    const sourceHash = crypto.createHash('sha256').update(native).digest('hex');
    expect(loader?.content).toContain(`source: sha256:${sourceHash}`);
    for (const rel of support) expect(artifacts.find(artifact => artifact.relPath === `${skillRoot}/${rel}`)?.sourceFilePath).toBe(at(`skills/author-skill/${rel}`));
    const rule = artifacts.find(artifact => artifact.relPath === binding.rule.installed);
    expect(rule).toMatchObject({ kind: 'rule', canonical: binding.rule.source, managedMarker: true });
    expect(rule?.content).toContain('canonical: rules/skill-attribution.md');
    expect(artifacts.some(artifact => artifact.relPath === '.claude/rules/skill-attribution.md')).toBe(false);
    expect(artifacts.some(artifact => artifact.relPath.includes('/evals/'))).toBe(false);
  });

  it('installs in a fresh workspace with the exact loader/rule/support set and tracked ownership', async () => {
    await install();
    expect(await inventory(installed(skillRoot))).toEqual(['SKILL.md', ...support, 'references/skill-attribution.md'].sort());
    expect(await fs.pathExists(installed('.claude/rules/skill-attribution.md'))).toBe(false);
    const lock = await fs.readJson(installed('.agents/agents-united.json')) as LockfileManifest;
    const rule = lock.projections?.[binding.rule.installed];
    expect(rule).toMatchObject({ host: 'claude', kind: 'rule', canonical: 'rules/skill-attribution.md', owners: ['agent-factory'], managedMarker: true });
    const actualHash = crypto.createHash('sha256').update(await fs.readFile(installed(binding.rule.installed))).digest('hex');
    expect(rule?.hash).toBe(`sha256:${actualHash}`);
  });

  it.each<[string, string, RegExp]>([
    ['binding record', 'hosts/claude/agent-factory.binding.json', /binding/i],
    ['native loader', binding.source, /native.*(entry|loader)|SKILL\.md/i],
    ['shared loader', 'skills/author-skill/SKILL.md', /shared|SKILL\.md/i],
    ['attribution rule', binding.rule.source, /attribution|rule/i],
    ...support.map(rel => [`support ${rel}`, `skills/author-skill/${rel}`, /support/i] as [string, string, RegExp]),
  ])('blocks planning and installation before writes for missing %s', async (_label, rel, expected) => {
    await fs.remove(at(rel));
    await expect(plan()).rejects.toThrow(expected);
    await expect(install()).rejects.toThrow(expected);
    expect(await inventory(workspace)).toEqual([]);
  });

  it.each([
    ['missing role', native.replace('agent: general-purpose\n', '')],
    ['wrong role', native.replace('agent: general-purpose', 'agent: Explore')],
    ['main context', native.replace('context: fork', 'context: inline')],
    ['background', native.replace('background: false', 'background: true')],
    ['renamed command', native.replace('name: author-skill', 'name: other-skill')],
  ])('rejects %s in the actual native loader before writing', async (_label, content) => {
    await fs.writeFile(at(binding.source), content);
    await expect(plan()).rejects.toThrow(/loading role|binding|name/i);
    await expect(install()).rejects.toThrow(/loading role|binding|name/i);
    expect(await inventory(workspace)).toEqual([]);
  });

  it('rejects a binding that loses the attribution consultation link', async () => {
    await fs.writeFile(at(binding.source), native.replace('[the attribution rule](references/skill-attribution.md)', 'attribution prose'));
    await expect(plan()).rejects.toThrow(/consultation|attribution/i);
  });

  it.each([
    ['support traversal', { ...binding, requiredSupport: ['../foreign.md'] }],
    ['automatic rule destination', { ...binding, rule: { ...binding.rule, installed: '.claude/rules/skill-attribution.md' } }],
    ['missing builtin role', { ...binding, loadingRole: {} }],
    ['wrong surface', { ...binding, surface: { ...binding.surface, product: 'claude.ai' } }],
  ])('rejects %s in the binding manifest', async (_label, declaration) => {
    await fs.writeJson(at('hosts/claude/agent-factory.binding.json'), declaration);
    await expect(plan()).rejects.toThrow(/binding/i);
  });

  it('rejects a competing native workflow that would shadow the bound skill', async () => {
    await fs.outputFile(at('hosts/claude/workflows/author-skill.js'), 'export const meta = {};\n');
    await expect(plan()).rejects.toThrow(/workflow|shadow/i);
  });

  it('rejects removal of a loader-referenced support edge from its declaration', async () => {
    await fs.appendFile(at(binding.source), '\nRead [the job contract](references/job.md).\n');
    await fs.writeJson(at('hosts/claude/agent-factory.binding.json'), { ...binding, requiredSupport: support.filter(rel => rel !== 'references/job.md') });
    await fs.remove(at('skills/author-skill/references/job.md'));
    await expect(plan()).rejects.toThrow(/binding|required support/i);
    await expect(install()).rejects.toThrow(/binding|required support/i);
    expect(await inventory(workspace)).toEqual([]);
  });

  it('rejects internal linked support directories that the resource lane would omit', async () => {
    const referenceDir = at('skills/author-skill/references');
    const cacheDir = at('skills/author-skill/support-cache');
    await fs.copy(referenceDir, cacheDir);
    await fs.remove(referenceDir);
    await fs.ensureSymlink(cacheDir, referenceDir, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(plan()).rejects.toThrow(/binding|link|required support/i);
    await expect(install()).rejects.toThrow(/binding|link|required support/i);
    expect(await inventory(workspace)).toEqual([]);
  });
  it('rejects an overbudget bound rule before any installation writes', async () => {
    await fs.writeFile(at(binding.rule.source), '# Attribution\n' + 'Required policy line.\n'.repeat(ClaudeProjector.CLAUDE_DIALECT.maxRuleLines));
    await expect(plan()).rejects.toThrow(/adherence budget|exceed/i);
    await expect(install()).rejects.toThrow(/adherence budget|exceed/i);
    expect(await inventory(workspace)).toEqual([]);
  });
  it('continues native skill fallback for unrelated bundles with no binding declaration', async () => {
    const ordinary = { name: 'ordinary', description: 'Existing bundle', skills: ['ordinary-skill'] };
    await fs.outputFile(at('skills/ordinary-skill/SKILL.md'), shared.replaceAll('author-skill', 'ordinary-skill'));
    const artifacts = await ClaudeProjector.planCompoundProjection(ordinary, 'project', { agents: [], skills: ['ordinary-skill'], rules: [], workflows: [] }, registryDir, undefined, true);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toContain('profile: claude |');
  });
});
