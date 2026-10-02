import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anchorsOf } from '../scripts/hostlib/guides.ts';
import {
  CAPABILITY_CLASSES,
  compareRealization,
  loadHostProfile,
  loadToolPolicy,
  resolveGrant,
  toolPolicyReport,
  validateHostProfile,
  validateToolPolicy,
} from '../src/core/host-profile.js';
import { loadSemanticCore, validateCoreSchema } from '../src/core/semantic-core.js';

/**
 * Plan 032 Phases 3 + 5 (ADR 0025 decisions 1, 8) — the Claude host profile and the class-based
 * tool policy. Unit tests use a tiny inline policy; the committed-data tests pin the real
 * `registry/hosts/claude/*` files against the host docs library snapshots, so a refresh that
 * adds a tool, a frontmatter key or a hook event fails here and surfaces in the host-update PR.
 */

const LIB = path.resolve('host-library/claude');
const page = (rel: string): string => fs.readFileSync(path.join(LIB, 'pages', rel), 'utf8');

/** First-column backticked names of the table rows in `text` between two markers. */
function tableNames(text: string, from: RegExp, to: RegExp): string[] {
  const start = text.search(from);
  const end = text.slice(start).search(to);
  expect(start, `marker ${from} not found`).toBeGreaterThanOrEqual(0);
  const section = text.slice(start, end === -1 ? undefined : start + end);
  const names: string[] = [];
  for (const line of section.split('\n')) {
    const match = /^\| (?:\[)?`([^`]+)`/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

const TINY = {
  host: 'demo',
  profile: 'demo@1.0.0',
  catalog: [
    { name: 'Read', class: 'read', subagents: 'available', backgroundSubagent: true, mutating: false, conditions: [] },
    { name: 'Grep', class: 'search', subagents: 'available', backgroundSubagent: true, mutating: false, conditions: [] },
    { name: 'Bash', class: 'shell', subagents: 'available', backgroundSubagent: true, mutating: true, conditions: [] },
    { name: 'Workflow', class: 'workflow', subagents: 'never', backgroundSubagent: false, mutating: true, conditions: [] },
    { name: 'TaskCreate', class: 'task-tracking', subagents: 'available', backgroundSubagent: false, mutating: false, conditions: [] },
    { name: 'EndConversation', class: 'meta', subagents: 'never', backgroundSubagent: false, mutating: false, conditions: [] },
  ],
};

describe('validateToolPolicy', () => {
  it('accepts a well-formed policy', () => {
    expect(validateToolPolicy(TINY).catalog).toHaveLength(6);
  });

  it.each([
    ['a duplicate tool', { ...TINY, catalog: [TINY.catalog[0], TINY.catalog[0]] }, /duplicate tool "Read"/],
    ['an unknown class', { ...TINY, catalog: [{ ...TINY.catalog[0], class: 'telepathy' }] }, /unknown capability class "telepathy"/],
    ['a bad subagent availability', { ...TINY, catalog: [{ ...TINY.catalog[0], subagents: 'sometimes' }] }, /subagents/],
    ['a missing mutating flag', { ...TINY, catalog: [{ name: 'Read', class: 'read', subagents: 'available', backgroundSubagent: true, conditions: [] }] }, /mutating/],
    ['an unknown top-level key', { ...TINY, extra: 1 }, /extra/],
    ['a condition without a source', { ...TINY, catalog: [{ ...TINY.catalog[0], conditions: [{ kind: 'platform', detail: 'x' }] }] }, /source/],
    ['an unknown condition kind', { ...TINY, catalog: [{ ...TINY.catalog[0], conditions: [{ kind: 'mood', detail: 'x', source: 'pages/tools/tools-reference.md' }] }] }, /kind/],
    ['a mutating flag on a read-only class', { ...TINY, catalog: [{ ...TINY.catalog[0], mutating: true }] }, /read-only class "read" contains mutating tool "Read"/],
  ])('rejects %s', (_name, bad, expected) => {
    expect(() => validateToolPolicy(bad)).toThrow(expected);
  });
});

describe('validateHostProfile', () => {
  const good = () => JSON.parse(fs.readFileSync(path.resolve('registry/hosts/claude/profile.json'), 'utf8')) as Record<string, unknown>;

  it('accepts the committed profile', () => {
    expect(validateHostProfile(good()).host).toBe('claude');
  });

  it.each([
    ['a missing library pointer', (p: Record<string, unknown>) => delete p.library, /library/],
    ['an unknown key', (p: Record<string, unknown>) => (p.surprise = 1), /surprise/],
    ['an empty allowed-key list', (p: Record<string, unknown>) => ((p.artifacts as any).agent.allowedKeys = []), /agent\.allowedKeys/],
    ['a duplicated hook event', (p: Record<string, unknown>) => ((p.artifacts as any).hook.events = ['Stop', 'Stop']), /hook\.events.*duplicate/],
    ['a non-semver version', (p: Record<string, unknown>) => (p.version = 'latest'), /version/],
  ])('rejects %s', (_name, mutate, expected) => {
    const profile = good();
    mutate(profile);
    expect(() => validateHostProfile(profile)).toThrow(expected);
  });
});

describe('resolveGrant', () => {
  const policy = validateToolPolicy(TINY);

  it('resolves classes to catalog tools in catalog order', () => {
    expect(resolveGrant(policy, ['search', 'read'], {}).tools).toEqual(['Read', 'Grep']);
  });

  it('drops tools that are never available to subagents, and says why', () => {
    const main = resolveGrant(policy, ['read', 'workflow'], { subagent: false });
    const sub = resolveGrant(policy, ['read', 'workflow'], { subagent: true });
    expect(main.tools).toContain('Workflow');
    expect(sub.tools).toEqual(['Read']);
    expect(sub.dropped).toEqual([{ tool: 'Workflow', reason: 'never available to subagents' }]);
  });

  it('drops tools a background subagent does not keep', () => {
    const fg = resolveGrant(policy, ['read', 'task-tracking'], { subagent: true, background: false });
    const bg = resolveGrant(policy, ['read', 'task-tracking'], { subagent: true, background: true });
    expect(fg.tools).toContain('TaskCreate');
    expect(bg.tools).toEqual(['Read']);
    expect(bg.dropped[0].reason).toMatch(/background/);
  });

  it('never grants a tool the host has deprecated, and says why', () => {
    const withDeprecated = validateToolPolicy({
      ...TINY,
      catalog: [...TINY.catalog, { name: 'OldRead', class: 'read', subagents: 'available', backgroundSubagent: true, mutating: false, deprecated: true, conditions: [] }],
    });
    const grant = resolveGrant(withDeprecated, ['read'], { subagent: true, background: false });
    expect(grant.tools).toEqual(['Read']);
    expect(grant.dropped).toEqual([{ tool: 'OldRead', reason: 'deprecated by the host' }]);
  });

  it('refuses a non-grantable class and an unknown one', () => {
    expect(() => resolveGrant(policy, ['meta'], {})).toThrow(/not grantable/);
    expect(() => resolveGrant(policy, ['telepathy' as never], {})).toThrow(/unknown capability class/);
  });

  it('does not duplicate tools when a class is listed twice', () => {
    expect(resolveGrant(policy, ['read', 'read'], {}).tools).toEqual(['Read']);
  });
});

describe('compareRealization', () => {
  it('reports tools the classes would add and tools granted by hand outside the classes', () => {
    const policy = validateToolPolicy(TINY);
    const grant = resolveGrant(policy, ['read', 'search'], {});
    expect(compareRealization(grant, ['Read', 'Skill'])).toEqual({ gains: ['Grep'], extras: ['Skill'] });
  });
});

describe('Semantic Core capabilities', () => {
  const core = (extra: Record<string, unknown>) => ({
    identity: 'i',
    mission: 'm',
    scope_boundaries: 's',
    output_contract: 'o',
    safety: 'f',
    invariants: ['x'],
    ...extra,
  });

  it('keeps capabilities optional so legacy inline cores still validate', () => {
    expect(validateCoreSchema(core({})).capabilities).toBeUndefined();
  });

  it('carries a valid capability list through', () => {
    expect(validateCoreSchema(core({ capabilities: ['read', 'search'] })).capabilities).toEqual(['read', 'search']);
  });

  it.each([
    ['an unknown class', ['read', 'telepathy'], /unknown capability class "telepathy"/],
    ['a duplicate', ['read', 'read'], /duplicate/],
    ['an empty list', [], /non-empty/],
    ['a non-grantable class', ['meta'], /not grantable/],
  ])('rejects %s', (_name, capabilities, expected) => {
    expect(() => validateCoreSchema(core({ capabilities }))).toThrow(expected);
  });

  it('never lets a capability class name trip the host-token purity scan', () => {
    expect(() => validateCoreSchema(core({ capabilities: [...CAPABILITY_CLASSES].filter(c => c !== 'meta') }))).not.toThrow();
  });
});

describe('the committed Claude host profile and tool policy', () => {
  const registry = path.resolve('registry');
  const profile = loadHostProfile(registry, 'claude');
  const policy = loadToolPolicy(registry, 'claude');
  const lock = JSON.parse(fs.readFileSync(path.join(LIB, 'library.lock.json'), 'utf8')) as {
    changelog: { lastSeen: Record<string, string> };
    files: Record<string, unknown>;
  };
  const baseline = Object.values(lock.changelog.lastSeen)[0];

  it('points at the host docs library and is pinned to the changelog baseline', () => {
    expect(profile.library).toBe('host-library/claude');
    expect(fs.existsSync(path.resolve(profile.library))).toBe(true);
    expect(profile.version).toBe(baseline);
    expect(profile.reviewedAgainst).toBe(baseline);
    expect(profile.toolPolicy).toBe('tool-policy.json');
  });

  it('keeps the legacy 2.1.271 profile as the version floor and covers its tool surface', () => {
    expect(profile.legacyProfile, 'the Claude profile keeps its legacy version floor').toBeDefined();
    const legacy = JSON.parse(fs.readFileSync(path.resolve(profile.legacyProfile!), 'utf8')) as { toolSurface: Record<string, string[]> };
    const names = new Set(policy.catalog.map(tool => tool.name));
    for (const tool of Object.values(legacy.toolSurface).flat()) expect(names.has(tool), `legacy tool ${tool}`).toBe(true);
    expect(profile.minVersion).toBe('2.1.271');
  });

  it('lists exactly the tools of the tools-reference snapshot (a new upstream tool fails here)', () => {
    const upstream = new Set(tableNames(page('tools/tools-reference.md'), /^\| Tool \| Description/m, /^## Configure tools/m));
    const catalog = new Set(policy.catalog.map(tool => tool.name));
    expect([...upstream].filter(name => !catalog.has(name)), 'tools missing from tool-policy.json').toEqual([]);
    expect([...catalog].filter(name => !upstream.has(name)), 'catalog tools not in the snapshot').toEqual([]);
    expect(upstream.size).toBeGreaterThanOrEqual(46);
  });

  it('gives every condition a source that resolves to a snapshot heading', () => {
    const problems: string[] = [];
    for (const tool of policy.catalog) {
      for (const condition of tool.conditions) {
        const [file, anchor] = condition.source.split('#');
        if (!(file in lock.files)) {
          problems.push(`${tool.name}: ${file} is not a locked snapshot`);
          continue;
        }
        if (anchor && !anchorsOf(fs.readFileSync(path.join(LIB, file), 'utf8')).has(anchor)) problems.push(`${tool.name}: ${condition.source} matches no heading`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('records the availability traps the guides document', () => {
    const byName = Object.fromEntries(policy.catalog.map(tool => [tool.name, tool]));
    expect(byName.Glob.conditions.some(c => c.kind === 'platform' && /macOS, Linux, and WSL/.test(c.detail))).toBe(true);
    expect(byName.Grep.conditions.some(c => c.kind === 'platform')).toBe(true);
    expect(byName.Workflow.subagents).toBe('never');
    expect(byName.AskUserQuestion.subagents).toBe('never');
    expect(byName.EndConversation.subagents).toBe('never');
    expect(byName.ReportFindings.conditions.some(c => c.kind === 'version' && /2\.1\.196/.test(c.detail))).toBe(true);
    expect(byName.TaskCreate.conditions.some(c => c.kind === 'model')).toBe(true);
    expect(byName.LSP.conditions.some(c => c.kind === 'dependency')).toBe(true);
    expect(byName.TaskOutput.deprecated).toBe(true);
    expect(policy.catalog.filter(tool => tool.deprecated).map(tool => tool.name)).toEqual(['TaskOutput']);
    expect(policy.classes.meta.grantable).toBe(false);
  });

  it('matches the agent, skill and hook-event vocabularies of the snapshots', () => {
    const agentKeys = tableNames(page('agent/sub-agents.md'), /<h3 id="supported-frontmatter-fields">/, /^#### Subagent files Claude Code skips/m);
    expect([...profile.artifacts.agent.allowedKeys].sort()).toEqual([...agentKeys].sort());
    const skillKeys = tableNames(page('skill/skills.md'), /^### Frontmatter reference/m, /^#### Using skill frontmatter outside/m);
    expect([...profile.artifacts.skill.allowedKeys].sort()).toEqual([...skillKeys].sort());
    const events = tableNames(page('hook/hooks.md'), /^\| Event \| When it fires/m, /^### How a hook resolves/m);
    expect([...profile.artifacts.hook.events].sort()).toEqual([...events].sort());
  });

  it('matches the plugin manifest keys and standard layout of the snapshots', () => {
    const keys = tableNames(page('plugin/plugins-manifest-reference.md'), /^\| Field \| Type \| Description/m, /^### `name`/m).filter(key => !key.includes('.'));
    expect([...profile.artifacts.plugin.manifestKeys].sort()).toEqual([...keys].sort());
    expect(profile.artifacts.plugin.ignoredAgentKeys.sort()).toEqual(['hooks', 'initialPrompt', 'mcpServers', 'permissionMode']);
  });

  it('keeps the portable skill keys inside the skill keys and to the six Agent Skills spec fields', () => {
    expect([...profile.artifacts.skill.portableKeys].sort()).toEqual(['allowed-tools', 'compatibility', 'description', 'license', 'metadata', 'name']);
    for (const key of profile.artifacts.skill.portableKeys) expect(profile.artifacts.skill.allowedKeys).toContain(key);
  });

  describe('capability classes on the shipped cores', () => {
    it('every core declares capabilities, all grantable', async () => {
      const cores = await loadSemanticCore(registry);
      expect([...cores.keys()].length).toBeGreaterThanOrEqual(5);
      for (const [name, core] of cores) {
        expect(core.capabilities?.length, `${name} capabilities`).toBeGreaterThan(0);
        for (const capability of core.capabilities ?? []) expect(policy.classes[capability].grantable, `${name}:${capability}`).toBe(true);
      }
    });

    it('read-only roles resolve to no mutating tool, foreground or background, subagent or not', async () => {
      const cores = await loadSemanticCore(registry);
      for (const role of ['subagent-code-reviewer', 'subagent-repo-index']) {
        const capabilities = cores.get(role)!.capabilities!;
        expect(capabilities, role).not.toContain('edit');
        expect(capabilities, role).not.toContain('shell');
        for (const ctx of [{ subagent: true }, { subagent: true, background: true }, { subagent: false }]) {
          const mutating = resolveGrant(policy, capabilities, ctx).tools.filter(tool => policy.catalog.find(entry => entry.name === tool)!.mutating);
          expect(mutating, `${role} ${JSON.stringify(ctx)}`).toEqual([]);
        }
      }
    });

    it('the reviewer gets search, code intelligence and structured reporting; the orchestrator gets delegation and workflows', async () => {
      const cores = await loadSemanticCore(registry);
      const reviewer = resolveGrant(policy, cores.get('subagent-code-reviewer')!.capabilities!, { subagent: true }).tools;
      expect(reviewer).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob', 'LSP', 'WebFetch', 'WebSearch', 'ReportFindings']));
      const orchestrator = resolveGrant(policy, cores.get('orchestrator-engineering')!.capabilities!, { subagent: false }).tools;
      expect(orchestrator).toEqual(expect.arrayContaining(['Agent', 'Workflow', 'AskUserQuestion', 'Monitor', 'PushNotification']));
      expect(orchestrator).not.toContain('EndConversation');
    });

    it('a workflow-launching orchestrator loses Workflow when resolved as a subagent', async () => {
      const cores = await loadSemanticCore(registry);
      const asSub = resolveGrant(policy, cores.get('orchestrator-engineering')!.capabilities!, { subagent: true });
      expect(asSub.tools).not.toContain('Workflow');
      expect(asSub.dropped.map(d => d.tool)).toEqual(expect.arrayContaining(['Workflow', 'AskUserQuestion']));
    });
  });

  describe('efficiency lint over the hand-written realizations', () => {
    const realizationsDir = path.join(registry, 'realizations', 'claude');
    const realizations = fs
      .readdirSync(realizationsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({ role: file.replace(/\.json$/, ''), tools: (JSON.parse(fs.readFileSync(path.join(realizationsDir, file), 'utf8')) as { tools: string[] }).tools }));

    it('every tool a realization grants exists in the catalog', () => {
      const names = new Set(policy.catalog.map(tool => tool.name));
      for (const { role, tools } of realizations) for (const tool of tools) expect(names.has(tool), `${role} grants unknown tool ${tool}`).toBe(true);
    });

    it('reports what the class-derived grants would add or drop per role, and the tools no role reaches', async () => {
      const cores = await loadSemanticCore(registry);
      const report = toolPolicyReport(
        policy,
        realizations.map(({ role, tools }) => ({ role, capabilities: cores.get(role)!.capabilities!, subagent: role !== 'orchestrator-engineering', realizationTools: tools })),
      );
      expect(report.roles.map(r => r.role).sort()).toEqual(realizations.map(r => r.role).sort());
      const reviewer = report.roles.find(r => r.role === 'subagent-code-reviewer')!;
      expect(reviewer.gains).toEqual(expect.arrayContaining(['LSP', 'ReportFindings']));
      expect(report.unreachable.map(u => u.tool)).toEqual(expect.arrayContaining(['EndConversation', 'SendFeedback']));
      expect(report.text).toMatch(/subagent-code-reviewer/);
      expect(report.text).toMatch(/unreachable/i);
    });
  });
});
