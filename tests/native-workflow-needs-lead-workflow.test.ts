import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { listNativeWorkflows } from '../src/core/native-package.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

/**
 * With the native lane on, a committed host workflow stands in for the Skill of the same name, so the Skill is not installed. A workflow runs
 * only through the `Workflow` tool, and the host withholds that tool from a role that does not list it. So the workflow replaces the Skill only
 * when the Bundle's lead (its coordinator role as installed) holds `Workflow`; otherwise the Skill stays and no workflow is projected.
 */

const root = path.resolve('scratch/test-native-workflow-lead');
const registryDir = path.join(root, 'registry');
const at = (rel: string): string => path.join(registryDir, ...rel.split('/'));

const bundle: BundleDefinition = {
  name: 'demo-bundle',
  description: 'Fixture bundle with one lead and one workflow-backed skill',
  orchestrator: 'orchestrator-demo.md',
  skills: ['workflow-demo'],
};
const resolved: ResolvedAssets = {
  targetBundle: 'demo-bundle',
  agents: ['orchestrator-demo.md'],
  skills: ['workflow-demo'],
  workflows: [],
  rules: [],
};

const canonicalLead = '---\nname: orchestrator-demo\ndescription: Lead of the fixture bundle.\n---\nYou lead the fixture bundle.\n';
const nativeLead = (tools: string): string => `---\nname: orchestrator-demo\ndescription: Lead of the fixture bundle.\ntools: ${tools}\n---\nYou lead the fixture bundle.\n`;
const skill = '---\nname: workflow-demo\ndescription: A demo skill that has a saved workflow.\n---\n# Demo skill\n';

const plan = (): Promise<{ relPath: string; kind: string }[]> =>
  ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir, undefined, true);

describe('a native workflow replaces its Skill only when the Bundle lead holds the Workflow tool', () => {
  beforeEach(async () => {
    await fs.remove(root);
    await fs.outputFile(at('agents/orchestrator-demo.md'), canonicalLead);
    await fs.outputFile(at('skills/workflow-demo/SKILL.md'), skill);
    await fs.outputFile(at('hosts/claude/workflows/workflow-demo.js'), "export const meta = { name: 'workflow-demo' }\n");
  });
  afterEach(async () => {
    await fs.remove(root);
  });

  it('projects the workflow and not the Skill when the native lead lists Workflow', async () => {
    await fs.outputFile(at('hosts/claude/agents/orchestrator-demo.md'), nativeLead('Agent, Read, Workflow'));
    const paths = (await plan()).map(a => a.relPath);
    expect(paths).toContain('.claude/workflows/workflow-demo.js');
    expect(paths).not.toContain('.claude/skills/workflow-demo/SKILL.md');
  });

  it('keeps the Skill and projects no workflow when the native lead does not list Workflow', async () => {
    await fs.outputFile(at('hosts/claude/agents/orchestrator-demo.md'), nativeLead('Agent, Read, Skill'));
    const paths = (await plan()).map(a => a.relPath);
    expect(paths).toContain('.claude/skills/workflow-demo/SKILL.md');
    expect(paths).not.toContain('.claude/workflows/workflow-demo.js');
  });

  it('keeps the Skill and projects no workflow when the Bundle has no native lead file (the lead is the canonical projection, which holds no Workflow)', async () => {
    const paths = (await plan()).map(a => a.relPath);
    expect(paths).toContain('.claude/skills/workflow-demo/SKILL.md');
    expect(paths).not.toContain('.claude/workflows/workflow-demo.js');
  });
});

describe('on the committed registry, every Bundle that lists a skill with a native workflow has a lead that holds Workflow', () => {
  const realRegistry = path.resolve('registry');

  it('projects each native workflow in place of its Skill', async () => {
    const resolver = new RegistryResolver(realRegistry);
    const native = new Set(listNativeWorkflows(realRegistry, 'claude'));
    let checked = 0;
    for (const entry of await resolver.listBundles()) {
      const bundleResolved = await resolver.resolve(entry.name);
      const expected = (bundleResolved.skills ?? []).filter(name => native.has(name));
      if (expected.length === 0) continue;
      checked += 1;
      const artifacts = await ClaudeProjector.planCompoundProjection(entry, 'project', bundleResolved, realRegistry, undefined, true);
      const workflows = artifacts.filter(a => a.kind === 'workflow').map(a => path.posix.basename(a.relPath, '.js')).sort();
      expect(workflows, entry.name).toEqual([...expected].sort());
      for (const name of expected) expect(artifacts.map(a => a.relPath), `${entry.name}/${name}`).not.toContain(`.claude/skills/${name}/SKILL.md`);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
