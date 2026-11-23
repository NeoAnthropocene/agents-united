import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { listNativeWorkflows } from '../src/core/native-package.js';
import { RegistryResolver, collectBundleManifestIssues } from '../src/core/registry.js';
import type { BundleDefinition, BundlesManifest } from '../src/core/types.js';

/**
 * With the native lane on, a committed host workflow stands in for the Skill of the same name, so the Skill is not installed. A workflow runs
 * only through the `Workflow` tool, and the host gives that tool to the main session alone, and only when its role lists it. So the registry
 * must never list such a skill in a Bundle whose lead (its orchestrator, or its parent Bundle's, as the resolver inherits it) is not a native
 * role that lists `Workflow`. The rule is a manifest check, so a contributor's Bundle is refused where the other manifest rules are.
 */

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) fs.removeSync(folder);
});

const canonicalLead = (name: string): string => `---\nname: ${name}\ndescription: Lead of a fixture bundle.\n---\nYou lead.\n`;
const nativeLead = (name: string, tools: string): string => `---\nname: ${name}\ndescription: Lead of a fixture bundle.\ntools: ${tools}\n---\nYou lead.\n`;

/** A fixture registry with the workflow `workflow-demo`, and the native leads given as role name -> tools line. */
function registryWith(leads: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'au-lead-workflow-'));
  folders.push(dir);
  fs.outputFileSync(path.join(dir, 'hosts/claude/workflows/workflow-demo.js'), "export const meta = { name: 'workflow-demo' }\n");
  fs.outputFileSync(path.join(dir, 'skills/workflow-demo/SKILL.md'), '---\nname: workflow-demo\ndescription: A demo skill that has a saved workflow.\n---\n# Demo\n');
  for (const [role, tools] of Object.entries(leads)) fs.outputFileSync(path.join(dir, 'hosts/claude/agents', `${role}.md`), nativeLead(role, tools));
  return dir;
}

const bundle = (name: string, extra: Partial<BundleDefinition> = {}): BundleDefinition => ({
  name,
  description: `${name} fixture bundle`,
  tier: 'domain',
  domain: 'engineering',
  orchestrator: 'orchestrator-demo.md',
  agents: [],
  skills: ['workflow-demo'],
  ...extra,
} as BundleDefinition);
const manifestOf = (...bundles: BundleDefinition[]): BundlesManifest => ({ version: 1, bundles: Object.fromEntries(bundles.map(b => [b.name, b])) } as BundlesManifest);
const leadIssues = (manifest: BundlesManifest, dir: string): string[] => collectBundleManifestIssues(manifest, dir).filter(issue => /Workflow/.test(issue));

describe('the manifest check: a skill with a native workflow needs a lead that holds the Workflow tool', () => {
  it('accepts a Bundle whose native lead lists Workflow among entries with a parenthesised list', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Agent(a, b), Read, Workflow' });
    expect(leadIssues(manifestOf(bundle('x')), dir)).toEqual([]);
  });

  it('refuses a Bundle whose native lead does not list Workflow', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Agent(a, b), Read, Skill' });
    const issues = leadIssues(manifestOf(bundle('x')), dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('bundle "x"');
    expect(issues[0]).toContain('workflow-demo');
    expect(issues[0]).toContain('orchestrator-demo');
  });

  it('refuses a Bundle whose lead has no native role file', () => {
    const dir = registryWith();
    fs.outputFileSync(path.join(dir, 'agents/orchestrator-demo.md'), canonicalLead('orchestrator-demo'));
    const issues = leadIssues(manifestOf(bundle('x')), dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('workflow-demo');
  });

  it('refuses a Bundle that inherits the skill and the lead from its parent Bundle when that lead lacks Workflow', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Agent(a, b), Read' });
    const parent = bundle('parent');
    const child = bundle('child', { parentBundle: 'parent', orchestrator: undefined, skills: [] });
    const issues = leadIssues(manifestOf(parent, child), dir);
    expect(issues.some(issue => issue.includes('bundle "child"'))).toBe(true);
    expect(issues.some(issue => issue.includes('bundle "parent"'))).toBe(true);
  });

  it('accepts the inheriting Bundle when the parent lead lists Workflow', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Agent(a, b), Read, Workflow' });
    const child = bundle('child', { parentBundle: 'parent', orchestrator: undefined, skills: [] });
    expect(leadIssues(manifestOf(bundle('parent'), child), dir)).toEqual([]);
  });

  it('reads the scoped native role name of nativeRoles for the lead', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read', 'demo-scoped': 'Read, Workflow' });
    const scoped = bundle('x', { agents: ['orchestrator-demo.md'], nativeRoles: { 'orchestrator-demo.md': 'demo-scoped' } });
    expect(leadIssues(manifestOf(scoped), dir)).toEqual([]);
  });

  it('needs nothing from a Bundle whose skills have no native workflow', () => {
    const dir = registryWith();
    expect(leadIssues(manifestOf(bundle('x', { skills: ['plain-skill'] })), dir)).toEqual([]);
  });

  it('is the error loadBundles throws for such a registry', async () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read' });
    fs.outputFileSync(path.join(dir, 'bundles.json'), JSON.stringify(manifestOf(bundle('x'))));
    await expect(new RegistryResolver(dir).loadBundles()).rejects.toThrow(/Workflow/);
  });
});

describe('on the committed registry, every Bundle that lists a skill with a native workflow has a lead that holds Workflow', () => {
  const realRegistry = path.resolve('registry');

  it('raises no manifest issue about it', () => {
    const manifest = fs.readJsonSync(path.join(realRegistry, 'bundles.json')) as BundlesManifest;
    expect(leadIssues(manifest, realRegistry)).toEqual([]);
  });

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
