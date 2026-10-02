import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anchorsOf } from '../scripts/hostlib/guides.ts';
import { loadHostProfile, loadToolPolicy, resolveGrant, toolPolicyReport, validateHostProfile, validateToolPolicy } from '../src/core/host-profile.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';

/**
 * Plan 032 Phase 8 / ADR 0028 — the Cline host profile and class-based tool policy. Two groups: the validators now accept what a
 * host that is not Claude needs (underscore tool names, observation-file sources, no legacy profile, a changelog section to
 * pin to), and the committed `registry/hosts/cline/*` files are pinned to the guides, the observations and ADR 0013, so a
 * refresh or a new CLI release that changes the vocabulary fails here and surfaces in the host-update PR.
 */

const registry = path.resolve('registry');
const LIB = path.resolve('host-library/cline');
const OBS = 'observations/2026-10-02-cli-3.0.68.md';
const read = (rel: string): string => fs.readFileSync(path.join(LIB, rel), 'utf8');

const CLAUDE_PROFILE = JSON.parse(fs.readFileSync(path.join(registry, 'hosts/claude/profile.json'), 'utf8')) as Record<string, any>;
const tool = (over: Record<string, unknown> = {}) => ({ name: 'read_files', class: 'read', subagents: 'available', backgroundSubagent: true, mutating: false, conditions: [], ...over });
const policy = (...catalog: unknown[]) => ({ host: 'demo', profile: 'demo@1.0.0', catalog });

describe('validators accept what a non-Claude host needs', () => {
  it('allows underscores in a tool name, and still rejects hyphens, spaces and a leading digit', () => {
    expect(validateToolPolicy(policy(tool({ name: 'search_codebase', class: 'search' }))).catalog[0].name).toBe('search_codebase');
    for (const name of ['read-files', 'read files', '1read', '']) expect(() => validateToolPolicy(policy(tool({ name }))), name).toThrow(/Tool policy invalid/);
  });

  it('accepts a condition sourced from an observations file, and still rejects any other path', () => {
    const condition = (source: string) => ({ kind: 'surface', detail: 'CLI only', source });
    expect(() => validateToolPolicy(policy(tool({ conditions: [condition(`${OBS}#configured-agents`)] })))).not.toThrow();
    expect(() => validateToolPolicy(policy(tool({ conditions: [condition('pages/tools/all-cline-tools.md#tools')] })))).not.toThrow();
    for (const source of ['docs/adr/0028.md', 'observations/../../etc/passwd', 'https://example.com/x.md', 'observations/x.txt']) {
      expect(() => validateToolPolicy(policy(tool({ conditions: [condition(source)] }))), source).toThrow(/Tool policy invalid/);
    }
  });

  it('accepts a profile with no legacy profile, no ignored agent keys and a changelog section to pin to', () => {
    const profile = structuredClone(CLAUDE_PROFILE);
    delete profile.legacyProfile;
    profile.artifacts.plugin.ignoredAgentKeys = [];
    profile.reviewedSection = 'CLI';
    const loaded = validateHostProfile(profile);
    expect(loaded.legacyProfile).toBeUndefined();
    expect(loaded.artifacts.plugin.ignoredAgentKeys).toEqual([]);
    expect(loaded.reviewedSection).toBe('CLI');
  });

  it('still rejects what is genuinely malformed: empty allowed keys, a duplicate ignored key, an empty section', () => {
    const bad = (mutate: (profile: Record<string, any>) => void) => {
      const profile = structuredClone(CLAUDE_PROFILE);
      mutate(profile);
      return () => validateHostProfile(profile);
    };
    expect(bad(p => (p.artifacts.agent.allowedKeys = []))).toThrow(/Host profile invalid/);
    expect(bad(p => (p.artifacts.plugin.ignoredAgentKeys = ['hooks', 'hooks']))).toThrow(/duplicate/);
    expect(bad(p => (p.reviewedSection = ''))).toThrow(/Host profile invalid/);
  });
});

describe('the committed Cline host profile and tool policy', () => {
  const profile = loadHostProfile(registry, 'cline');
  const toolPolicy = loadToolPolicy(registry, 'cline');
  const lock = JSON.parse(read('library.lock.json')) as { changelog: { lastSeen: Record<string, string> }; files: Record<string, unknown> };
  const observations = read(OBS);
  const adr0013 = fs.readFileSync(path.resolve('docs/adr/0013-cline-native-discovery-projection.md'), 'utf8');

  it('points at the docs library, and is pinned to the CLI release baseline of the changelog', () => {
    expect(profile.host).toBe('cline');
    expect(profile.library).toBe('host-library/cline');
    expect(fs.existsSync(path.resolve(profile.library))).toBe(true);
    expect(profile.reviewedSection).toBe('CLI');
    expect(profile.version).toBe(lock.changelog.lastSeen.CLI);
    expect(profile.reviewedAgainst).toBe(lock.changelog.lastSeen.CLI);
    expect(profile.profileId).toBe(`cline@${profile.version}`);
    expect(profile.minVersion).toBe('3.0.61');
    expect(profile.toolPolicy).toBe('tool-policy.json');
    expect(profile.semantics).toMatch(/ADR 0028/);
  });

  it('lists the CLI canonical tools of the observations (and nothing the build lacks), with the docs-only names marked as such', () => {
    const section = /From the binary[^\n]*canonical set is ([^\n]+?)\. An alias table/.exec(observations)![1];
    const canonical = [...section.matchAll(/`([a-z_]+)`/g)].map(match => match[1]);
    expect(canonical).toEqual(['read_files', 'search_codebase', 'run_commands', 'fetch_web_content', 'apply_patch', 'editor', 'skills', 'ask_question', 'submit_and_exit']);
    const names = new Map(toolPolicy.catalog.map(entry => [entry.name, entry]));
    for (const name of canonical) expect(names.has(name), `canonical tool ${name}`).toBe(true);
    for (const name of ['spawn_agent', 'team_spawn_teammate', 'team_run_task', 'web_search']) expect(names.has(name), name).toBe(true);
    expect(names.has('fetch_web'), 'fetch_web is not in the CLI build').toBe(false);
    expect(names.get('use_subagents')?.conditions.some(c => c.kind === 'surface' && /IDE/.test(c.detail))).toBe(true);
    expect(names.get('submit_and_exit')?.class).toBe('meta');
  });

  it('classes the mutating tools as mutating, and puts nothing mutating in a read-only class', () => {
    const byName = Object.fromEntries(toolPolicy.catalog.map(entry => [entry.name, entry]));
    for (const name of ['editor', 'apply_patch', 'run_commands']) expect(byName[name].mutating, name).toBe(true);
    for (const name of ['read_files', 'search_codebase', 'fetch_web_content', 'skills']) expect(byName[name].mutating, name).toBe(false);
    expect(byName.read_files.class).toBe('read');
    expect(byName.search_codebase.class).toBe('search');
    expect(byName.run_commands.class).toBe('shell');
    expect(byName.editor.class).toBe('edit');
  });

  it('gives every condition a source that resolves: a locked snapshot heading, or a heading of the observations file', () => {
    const problems: string[] = [];
    for (const entry of toolPolicy.catalog) {
      for (const condition of entry.conditions) {
        const [file, anchor] = condition.source.split('#');
        const onDisk = path.join(LIB, file);
        if (file.startsWith('pages/') && !(file in lock.files)) problems.push(`${entry.name}: ${file} is not a locked snapshot`);
        else if (!fs.existsSync(onDisk)) problems.push(`${entry.name}: ${file} does not exist`);
        else if (anchor && !anchorsOf(fs.readFileSync(onDisk, 'utf8')).has(anchor)) problems.push(`${entry.name}: ${condition.source} matches no heading`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('marks teams and the IDE-only sub-agent tool as surface-limited, citing the docs', () => {
    const byName = Object.fromEntries(toolPolicy.catalog.map(entry => [entry.name, entry]));
    for (const name of ['team_spawn_teammate', 'team_run_task']) {
      expect(byName[name].conditions.some(c => c.kind === 'surface' && /CLI/.test(c.detail) && /not.*(VS Code|IDE)/i.test(c.detail)), name).toBe(true);
    }
    expect(byName.team_spawn_teammate.conditions.some(c => c.source.startsWith('pages/orchestration/agent-teams.md'))).toBe(true);
  });

  it('declares the configured-agent vocabulary of ADR 0013, and every key appears there', () => {
    const agent = profile.artifacts.agent;
    expect(agent.path).toBe('.cline/agents/<role>.yml');
    expect([...agent.allowedKeys].sort()).toEqual(['description', 'maxIterations', 'modelId', 'name', 'providerId', 'skills', 'tools']);
    expect(agent.requiredKeys).toEqual(['name', 'description']);
    for (const key of agent.allowedKeys) expect(adr0013, `ADR 0013 names ${key}`).toContain(key);
  });

  it('declares the skill keys the docs state, and the hook stages of the snapshot', () => {
    expect(profile.artifacts.skill.path).toBe('.cline/skills/<name>/SKILL.md');
    expect(profile.artifacts.skill.allowedKeys).toEqual(['name', 'description']);
    for (const key of profile.artifacts.skill.portableKeys) expect(profile.artifacts.skill.allowedKeys).toContain(key);
    const page = read('pages/plugin/sdk-plugins.md');
    const block = /## Hook stages[\s\S]*?```txt[^\n]*\r?\n([\s\S]*?)```/i.exec(page)![1];
    const stages = block.split('\n').map(line => line.trim()).filter(Boolean);
    expect([...profile.artifacts.hook.events].sort()).toEqual([...stages].sort());
    expect(profile.artifacts.hook.events).toContain('tool_call_before');
  });

  it('records the verified behaviours as features, including the ones that are not available', () => {
    const features = profile.features;
    expect(features.configuredAgents.status).toBe('available');
    expect(features.hostEnforcedToolRestriction.status).toBe('available');
    expect(features.guardPlugin.note).toMatch(/CLI/);
    expect(features.guardPlugin.note).toMatch(/ends the run/i);
    expect(features.guardPlugin.note).toMatch(/subagent/i);
    expect(features.guardPlugin.note).toMatch(/lead.*continues|continues/i);
    expect(features.agentTeams.note).toMatch(/not.*(VS Code|IDE)/i);
    expect(features.claudeSkillsDir.status).toBe('unsupported');
    expect(features.workflows.status).toBe('listed');
    expect(features.agentPlugins.status).toBe('unverified');
    expect(features.mcpWiring.status).toBe('deferred');
    for (const [name, feature] of Object.entries(features)) expect(feature.note.length, name).toBeGreaterThan(20);
  });

  describe('capability classes on the shipped cores', () => {
    it('every grantable class a core declares resolves, and read-only roles resolve to no mutating Cline tool', async () => {
      const cores = await loadSemanticCore(registry);
      for (const role of ['subagent-code-reviewer', 'subagent-repo-index']) {
        const capabilities = cores.get(role)!.capabilities!;
        for (const context of [{ subagent: true }, { subagent: true, background: true }, { subagent: false }]) {
          const grant = resolveGrant(toolPolicy, capabilities, context);
          const mutating = grant.tools.filter(name => toolPolicy.catalog.find(entry => entry.name === name)!.mutating);
          expect(mutating, `${role} ${JSON.stringify(context)}`).toEqual([]);
          expect(grant.tools, role).toEqual(expect.arrayContaining(['read_files', 'search_codebase']));
        }
      }
    });

    it('the engineering orchestrator can read, edit, run commands and load skills, and never holds the meta tool', async () => {
      const cores = await loadSemanticCore(registry);
      const grant = resolveGrant(toolPolicy, cores.get('orchestrator-engineering')!.capabilities!, { subagent: false });
      expect(grant.tools).toEqual(expect.arrayContaining(['read_files', 'editor', 'run_commands', 'skills']));
      expect(grant.tools).not.toContain('submit_and_exit');
    });

    it('reports per role what the classes grant, and the tools no role reaches', async () => {
      const cores = await loadSemanticCore(registry);
      const roles = ['orchestrator-engineering', 'subagent-code-reviewer', 'subagent-repo-index', 'subagent-backend-architect', 'subagent-frontend-architect'];
      const report = toolPolicyReport(toolPolicy, roles.map(role => ({ role, capabilities: cores.get(role)!.capabilities!, subagent: role !== 'orchestrator-engineering', realizationTools: [] })));
      expect(report.roles.map(entry => entry.role)).toEqual(roles);
      expect(report.unreachable.map(entry => entry.tool)).toContain('submit_and_exit');
      expect(report.text).toMatch(/cline@/);
    });
  });
});
