import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { anchorsOf } from '../scripts/hostlib/guides.ts';
import { loadHostProfile, loadToolPolicy, resolveGrant, toolPolicyReport } from '../src/core/host-profile.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';

/**
 * Plan 032 Phase 8 / ADR 0030 — the Antigravity host profile and class-based tool policy. The committed `registry/hosts/antigravity/*`
 * files are pinned to the docs snapshots (the hooks page's tool list and event table, the subagent frontmatter table, the skill
 * frontmatter table), to the guides, and to the observed behaviour of plan 031, so a refresh or a new CLI release that changes the
 * vocabulary fails here and surfaces in the host-update PR.
 */

const registry = path.resolve('registry');
const LIB = path.resolve('host-library/antigravity');
const read = (rel: string): string => fs.readFileSync(path.join(LIB, rel), 'utf8').replace(/\r\n/g, '\n');
const section = (markdown: string, heading: string): string => {
  const start = markdown.indexOf(`\n${heading}\n`);
  const rest = markdown.slice(start + heading.length + 2);
  const level = /^#+/.exec(heading)![0].length;
  const end = rest.search(new RegExp(`\\n#{1,${level}} `));
  return end === -1 ? rest : rest.slice(0, end);
};

describe('the committed Antigravity host profile', () => {
  const profile = loadHostProfile(registry, 'antigravity');
  const lock = JSON.parse(read('library.lock.json')) as { changelog: { lastSeen: Record<string, string> }; files: Record<string, unknown> };

  it('points at the docs library and is pinned to the CLI release baseline of the changelog', () => {
    expect(profile.host).toBe('antigravity');
    expect(profile.library).toBe('host-library/antigravity');
    expect(fs.existsSync(path.resolve(profile.library))).toBe(true);
    expect(profile.reviewedSection).toBe('Antigravity CLI');
    expect(profile.version).toBe(lock.changelog.lastSeen['Antigravity CLI']);
    expect(profile.reviewedAgainst).toBe(lock.changelog.lastSeen['Antigravity CLI']);
    expect(profile.profileId).toBe(`antigravity@${profile.version}`);
    expect(profile.minVersion).toBe('1.2.11');
    expect(profile.toolPolicy).toBe('tool-policy.json');
    expect(profile.semantics).toMatch(/ADR 0030/);
  });

  it('declares the agent frontmatter of the docs table, and never `hooks:`, which hides an agent (plan 031)', () => {
    const table = section(read('pages/agent/subagents.md'), '### Frontmatter Configuration (YAML)');
    const documented = [...table.matchAll(/^\| `([A-Za-z]+)`(?: \/ `([A-Za-z]+)`)? \|/gm)].flatMap(match => [match[1], match[2]].filter(Boolean));
    const agent = profile.artifacts.agent;
    expect(agent.path).toBe('.agents/agents/<role>.md');
    expect([...agent.allowedKeys].sort()).toEqual([...documented].sort());
    expect(agent.requiredKeys).toEqual(['name', 'description']);
    expect(agent.allowedKeys).not.toContain('hooks');
    expect(profile.features.hooksInAgentFrontmatter.status).toBe('breaks-discovery');
    expect(profile.features.hooksInAgentFrontmatter.note).toMatch(/plan 031/i);
  });

  it('declares the skill keys of the docs table', () => {
    const table = section(read('pages/skill/skills.md'), '### Frontmatter fields');
    const documented = [...table.matchAll(/^\| `([a-z]+)` \|/gm)].map(match => match[1]);
    expect(profile.artifacts.skill.path).toBe('.agents/skills/<name>/SKILL.md');
    expect([...profile.artifacts.skill.allowedKeys].sort()).toEqual([...documented].sort());
    for (const key of profile.artifacts.skill.portableKeys) expect(profile.artifacts.skill.allowedKeys).toContain(key);
  });

  it('declares the hook events of the docs table, the one handler type, and the hook files', () => {
    const table = section(read('pages/hook/hooks.md'), '## Supported Events');
    const events = [...table.matchAll(/^\| `([A-Za-z]+)` \|/gm)].map(match => match[1]);
    expect(events).toEqual(['PreToolUse', 'PostToolUse', 'PreInvocation', 'PostInvocation', 'Stop']);
    expect(profile.artifacts.hook.events).toEqual(events);
    expect(profile.artifacts.hook.handlerTypes).toEqual(['command']);
    expect(profile.artifacts.hook.registerAt).toEqual(expect.arrayContaining(['.agents/hooks.json', '~/.gemini/config/hooks.json']));
  });

  it('declares the plugin manifest the schema allows, the install locations, and the MCP and permission vocabularies', () => {
    expect(profile.artifacts.plugin.manifestKeys).toEqual(['name', 'description']);
    expect(profile.artifacts.plugin.layout.project).toBe('.agents/plugins/<name>/');
    expect(profile.artifacts.plugin.layout.global).toBe('~/.gemini/config/plugins/<name>/');
    expect(profile.artifacts.plugin.layout.manifest).toBe('plugin.json');
    expect(profile.artifacts.mcp.transports).toEqual(expect.arrayContaining(['stdio', 'streamableHttp', 'sse']));
    expect(profile.artifacts.mcp.scopes).toEqual(['workspace', 'global']);
    expect(profile.artifacts.permissions.modes).toEqual(['default', 'request-review', 'turbo']);
  });

  it('records what is not simply available: the platform split, the retiring workflows, what was observed and what is still unverified', () => {
    const features = profile.features;
    expect(features.unifiedPermissionEngine.status).toBe('macos-linux-only');
    expect(features.unifiedPermissionEngine.note).toMatch(/Windows/);
    // Observed on Linux (WSL) with agy 1.2.15: the permissions page and the CLI reference disagree, and the reference matched.
    expect(features.unifiedPermissionEngine.note).toMatch(/observed on Linux/i);
    expect(features.cliDefaultPermission.status).toBe('observed');
    expect(features.cliDefaultPermission.note).toMatch(/request-review/);
    expect(features.cliDefaultPermission.note).toMatch(/--sandbox/);
    expect(features.cliDefaultPermission.note).toMatch(/headless/i);
    // Then tried with the sandbox on (proceed-in-sandbox, WSL): it runs, cuts the network, hides ~/.ssh, refuses writes outside the workspace.
    expect(features.terminalSandboxLinux.status).toBe('observed');
    expect(features.terminalSandboxLinux.note).toMatch(/network/i);
    expect(features.terminalSandboxLinux.note).toMatch(/\.ssh/);
    expect(features.terminalSandboxLinux.note).toMatch(/Read-only file system/);
    expect(features.terminalSandboxLinux.note).toMatch(/ask/);
    expect(features.hookContract.note).toMatch(/proceed-in-sandbox/);
    expect(features.workflows.status).toBe('deprecated');
    expect(features.workflows.note).toMatch(/2026-11-01|November 1, 2026/);
    expect(features.hostEnforcedToolRestriction.status).toBe('available');
    expect(features.hostEnforcedToolRestriction.note).toMatch(/observed/i);
    expect(features.hostEnforcedToolRestriction.note).toMatch(/control/i);
    expect(features.subagentInvocation.status).toBe('available');
    expect(features.subagentInvocation.note).toMatch(/subagent: false|subagent:\s*false/);
    expect(features.subagentInvocation.note).toMatch(/global/i);
    expect(features.parallelSubagents.status).toBe('partial');
    expect(features.parallelSubagents.note).toMatch(/same second/i);
    expect(features.parallelSubagents.note).toMatch(/overlap/i);
    expect(features.mcpWiring.status).toBe('partial');
    expect(features.mcpWiring.note).toMatch(/\.agents\/mcp_config\.json/);
    expect(features.mcpWiring.note).toMatch(/switched off|disabled/i);
    expect(features.mcpWiring.note).toMatch(/no secret|never writes? a (secret|credential)/i);
    expect(features.mcpWiring.note).toMatch(/unverified/i);
    expect(features.registryFiles.status).toBe('unverified');
    for (const [name, feature] of Object.entries(features)) expect(feature.note.length, name).toBeGreaterThan(20);
  });
});

describe('the committed Antigravity tool policy', () => {
  const policy = loadToolPolicy(registry, 'antigravity');
  const lock = JSON.parse(read('library.lock.json')) as { files: Record<string, unknown> };
  const byName = Object.fromEntries(policy.catalog.map(entry => [entry.name, entry]));

  it('lists exactly the tools of the hooks page, the vocabulary an agent and a hook matcher see, and none of the SDK-only names', () => {
    const tools = section(read('pages/hook/hooks.md'), '## Supported Tools');
    const documented = [...tools.matchAll(/^\*\s+\*\*`([a-z_]+)`\*\*/gm)].map(match => match[1]);
    expect(documented.length).toBe(20);
    expect(policy.catalog.map(entry => entry.name).sort()).toEqual([...documented].sort());
    for (const sdkOnly of ['list_directory', 'search_directory', 'find_file', 'create_file', 'edit_file', 'start_subagent', 'finish']) {
      expect(byName[sdkOnly], `${sdkOnly} is an SDK identifier, recorded as an alias only`).toBeUndefined();
    }
    expect(policy.semantics).toMatch(/SDK/);
    expect(policy.semantics).toMatch(/create_file|start_subagent/);
  });

  it('puts each tool in the class its work serves, and marks the mutating ones', () => {
    const expected: Record<string, [string, boolean]> = {
      view_file: ['read', false],
      list_dir: ['read', false],
      find_by_name: ['search', false],
      grep_search: ['search', false],
      write_to_file: ['edit', true],
      replace_file_content: ['edit', true],
      multi_replace_file_content: ['edit', true],
      run_command: ['shell', true],
      manage_task: ['background-monitor', true],
      schedule: ['scheduling', true],
      search_web: ['web', false],
      read_url_content: ['web', false],
      invoke_subagent: ['delegate', true],
      define_subagent: ['delegate', true],
      manage_subagents: ['delegate', true],
      send_message: ['messaging', false],
      ask_question: ['ask-user', false],
      list_permissions: ['meta', false],
      ask_permission: ['meta', false],
      generate_image: ['meta', true],
    };
    for (const [name, [cls, mutating]] of Object.entries(expected)) {
      expect(byName[name]?.class, `${name} class`).toBe(cls);
      expect(byName[name]?.mutating, `${name} mutating`).toBe(mutating);
    }
  });

  it('gives every condition a source that resolves to a locked snapshot heading', () => {
    const problems: string[] = [];
    for (const entry of policy.catalog) {
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

  it('states the conditions that matter: execution is platform-gated, delegation needs `subagent: true`, a subagent cannot ask the user', () => {
    expect(byName.run_command.conditions.some(c => c.kind === 'platform' && /Windows/.test(c.detail))).toBe(true);
    expect(byName.invoke_subagent.conditions.some(c => /subagent: true/.test(c.detail))).toBe(true);
    expect(byName.ask_question.subagents).toBe('conditional');
    expect(byName.ask_question.backgroundSubagent).toBe(false);
    expect(byName.define_subagent.conditions.some(c => /verbatim/i.test(c.detail))).toBe(true);
  });

  describe('capability classes on the shipped cores', () => {
    it('read-only roles resolve to no mutating Antigravity tool, in every subagent context', async () => {
      const cores = await loadSemanticCore(registry);
      for (const role of ['subagent-code-reviewer', 'subagent-repo-index']) {
        const capabilities = cores.get(role)!.capabilities!;
        for (const context of [{ subagent: true }, { subagent: true, background: true }, { subagent: false }]) {
          const grant = resolveGrant(policy, capabilities, context);
          const mutating = grant.tools.filter(name => byName[name].mutating);
          expect(mutating, `${role} ${JSON.stringify(context)}`).toEqual([]);
          expect(grant.tools, role).toEqual(expect.arrayContaining(['view_file', 'grep_search']));
        }
      }
    });

    it('the orchestrator can read, edit, run commands and invoke subagents, and the writers hold the editors and the shell', async () => {
      const cores = await loadSemanticCore(registry);
      const orchestrator = resolveGrant(policy, cores.get('orchestrator-engineering')!.capabilities!, { subagent: false });
      expect(orchestrator.tools).toEqual(expect.arrayContaining(['view_file', 'write_to_file', 'run_command', 'invoke_subagent']));
      for (const role of ['subagent-backend-architect', 'subagent-frontend-architect']) {
        const grant = resolveGrant(policy, cores.get(role)!.capabilities!, { subagent: true });
        expect(grant.tools, role).toEqual(expect.arrayContaining(['view_file', 'write_to_file', 'replace_file_content', 'run_command']));
      }
    });

    it('reports per role what the classes grant, and the tools no role reaches (the meta ones, never granted)', async () => {
      const cores = await loadSemanticCore(registry);
      const roles = ['orchestrator-engineering', 'subagent-code-reviewer', 'subagent-repo-index', 'subagent-backend-architect', 'subagent-frontend-architect'];
      const report = toolPolicyReport(policy, roles.map(role => ({ role, capabilities: cores.get(role)!.capabilities!, subagent: role !== 'orchestrator-engineering', realizationTools: [] })));
      expect(report.roles.map(entry => entry.role)).toEqual(roles);
      const unreachable = report.unreachable.map(entry => entry.tool);
      for (const tool of ['list_permissions', 'ask_permission', 'generate_image']) expect(unreachable).toContain(tool);
      expect(report.text).toMatch(/antigravity@/);
    });
  });
});
