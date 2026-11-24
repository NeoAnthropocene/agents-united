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
const leadIssues = (manifest: BundlesManifest, dir: string): string[] => collectBundleManifestIssues(manifest, dir);

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

  it('resolves the parent Bundle by alias, as the resolver does', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read' });
    const parent = bundle('parent', { aliases: ['parent-alias'] });
    const child = bundle('child', { parentBundle: 'parent-alias', orchestrator: undefined, skills: [] });
    const issues = leadIssues(manifestOf(parent, child), dir);
    expect(issues.some(issue => issue.includes('bundle "child"'))).toBe(true);
  });

  it('refuses a nativeRoles-mapped lead that lacks Workflow even when the default role would hold it', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read, Workflow', 'demo-scoped': 'Read' });
    const scoped = bundle('x', { agents: ['orchestrator-demo.md'], nativeRoles: { 'orchestrator-demo.md': 'demo-scoped' } });
    const issues = leadIssues(manifestOf(scoped), dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('"demo-scoped"');
  });

  it('uses the default role name when a nativeRoles value is not a string, without a second error about a made-up role', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read, Workflow' });
    const odd = bundle('x', { agents: ['orchestrator-demo.md'], nativeRoles: { 'orchestrator-demo.md': 123 as unknown as string } });
    const issues = leadIssues(manifestOf(odd), dir);
    expect(issues.filter(issue => /lead "/.test(issue))).toEqual([]);
  });

  it('checks the own orchestrator of a child, not the one of its parent', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read', 'orchestrator-other': 'Read, Workflow' });
    const child = bundle('child', { parentBundle: 'parent', orchestrator: 'orchestrator-other.md', skills: [] });
    const issues = leadIssues(manifestOf(bundle('parent'), child), dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('bundle "parent"');
    const reverse = leadIssues(manifestOf(bundle('parent', { orchestrator: 'orchestrator-other.md' }), bundle('child', { parentBundle: 'parent', orchestrator: 'orchestrator-demo.md', skills: [] })), dir);
    expect(reverse).toHaveLength(1);
    expect(reverse[0]).toContain('bundle "child"');
  });

  it('falls back to the parent lead when the own orchestrator is empty, as the resolver does', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read' });
    const child = bundle('child', { parentBundle: 'parent', orchestrator: '', skills: [] });
    expect(leadIssues(manifestOf(bundle('parent'), child), dir).some(issue => issue.includes('bundle "child"'))).toBe(true);
  });

  it('exempts a Bundle with no lead of its own or inherited: a plain session holds Workflow and the user runs the command', () => {
    const dir = registryWith();
    expect(leadIssues(manifestOf(bundle('x', { orchestrator: undefined })), dir)).toEqual([]);
  });

  it('reads the role of a subagent-prefixed lead file without the prefix', () => {
    const holds = registryWith({ 'demo-lead': 'Read, Workflow' });
    expect(leadIssues(manifestOf(bundle('x', { orchestrator: 'subagent-demo-lead.md' })), holds)).toEqual([]);
    const lacks = registryWith({ 'demo-lead': 'Read' });
    const issues = leadIssues(manifestOf(bundle('x', { orchestrator: 'subagent-demo-lead.md' })), lacks);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('"demo-lead"');
  });

  it('is inert in a registry that has no Claude native workflows at all', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read' });
    fs.removeSync(path.join(dir, 'hosts/claude/workflows'));
    expect(leadIssues(manifestOf(bundle('x')), dir)).toEqual([]);
  });

  it('says which skills it resolves, in the singular or the plural', () => {
    const dir = registryWith({ 'orchestrator-demo': 'Read' });
    fs.outputFileSync(path.join(dir, 'hosts/claude/workflows/workflow-other.js'), "export const meta = { name: 'workflow-other' }\n");
    const one = leadIssues(manifestOf(bundle('x')), dir)[0]!;
    expect(one).toContain('resolves the skill "workflow-demo", which a native Claude workflow replaces');
    const two = leadIssues(manifestOf(bundle('x', { skills: ['workflow-demo', 'workflow-other'] })), dir)[0]!;
    expect(two).toContain('resolves the skills "workflow-demo", "workflow-other", which native Claude workflows replace');
  });

  it('leaves a lead that the proposal has not created yet alone only when asked to allow unresolved leads', () => {
    const dir = registryWith();
    const late = bundle('x', { orchestrator: 'orchestrator-late.md' });
    expect(collectBundleManifestIssues(manifestOf(late), dir)).toHaveLength(1);
    expect(collectBundleManifestIssues(manifestOf(late), dir, { unresolvedLeadsAllowedFor: new Set(['x']) })).toEqual([]);
    fs.outputFileSync(path.join(dir, 'agents/orchestrator-late.md'), canonicalLead('orchestrator-late'));
    expect(collectBundleManifestIssues(manifestOf(late), dir, { unresolvedLeadsAllowedFor: new Set(['x']) })).toHaveLength(1);
  });

  it('leaves unresolved leads alone only for the Bundles it is given, not for an existing Bundle that inherits the skill', () => {
    const dir = registryWith();
    const parent = bundle('parent', { orchestrator: undefined });
    const child = bundle('child', { parentBundle: 'parent', orchestrator: 'orchestrator-late.md', skills: [] });
    const issues = collectBundleManifestIssues(manifestOf(parent, child), dir, { unresolvedLeadsAllowedFor: new Set(['parent']) });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('bundle "child"');
  });

  it('does not cut a lead name that only ends in letters followed by md', () => {
    const dir = registryWith({ 'orchestrator-cmd': 'Read' });
    const issues = leadIssues(manifestOf(bundle('x', { orchestrator: 'orchestrator-cmd' })), dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('"orchestrator-cmd"');
    const mapped = bundle('y', { orchestrator: 'subagent-cmd' });
    expect(leadIssues(manifestOf(mapped), registryWith({ cmd: 'Read, Workflow' }))).toEqual([]);
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
