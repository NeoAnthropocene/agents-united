import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadHostProfile, loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { ANTIGRAVITY_FLOOR_MARKERS, checkFloor, syncFloor } from '../src/core/native-floor.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 Phase 8 / ADR 0030 — the native Antigravity agents: four specialists and the orchestrator as `.agents/agents/<role>.md`.
 * Each file is authored; its Contract Floor block and its `tools:` list are generated (regenerate with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-antigravity-agents.test.ts`). The frontmatter has only documented keys and never `hooks:`,
 * which hides an agent from discovery (plan 031). Unlike Cline, whether the host enforces a `tools:` list is unverified (ADR 0030
 * decision 4), so a read-only role holds no writing tool and says plainly that nothing else is promised.
 */

interface RoleSpec {
  name: string;
  stem: string;
  kind: 'reader' | 'writer' | 'orchestrator';
}

const ROLES: RoleSpec[] = [
  { name: 'code-reviewer', stem: 'subagent-code-reviewer', kind: 'reader' },
  { name: 'repo-index', stem: 'subagent-repo-index', kind: 'reader' },
  { name: 'backend-architect', stem: 'subagent-backend-architect', kind: 'writer' },
  { name: 'frontend-architect', stem: 'subagent-frontend-architect', kind: 'writer' },
  { name: 'orchestrator-engineering', stem: 'orchestrator-engineering', kind: 'orchestrator' },
];
const SPECIALISTS = ROLES.filter(role => role.kind !== 'orchestrator').map(role => role.name);

const registry = path.resolve('registry');
const AGENTS_DIR = path.join(registry, 'hosts/antigravity/agents');
const fileOf = (role: RoleSpec): string => path.join(AGENTS_DIR, `${role.name}.md`);
const profile = loadHostProfile(registry, 'antigravity');
const policy = loadToolPolicy(registry, 'antigravity');
const MUTATING = policy.catalog.filter(tool => tool.mutating).map(tool => tool.name);
const WRITER_TOOLS = ['run_command', 'write_to_file', 'replace_file_content'];
const FOREIGN_TOOLS = ['subagent_', 'read_files', 'search_codebase', 'run_commands', 'apply_patch', 'spawn_agent', 'team_run_task', 'fetch_web_content', 'AskUserQuestion', 'SubagentHandback', 'Agent('];

let cores: Map<string, SemanticCore>;
const ceilingOf = (role: RoleSpec): string[] =>
  resolveGrant(policy, cores.get(role.stem)!.capabilities ?? [], role.kind === 'orchestrator' ? { subagent: false } : { subagent: true, background: false }).tools;

beforeAll(async () => {
  cores = await loadSemanticCore(registry);
  if (process.env.UPDATE_NATIVE === '1') {
    for (const role of ROLES.filter(entry => fs.existsSync(fileOf(entry)))) {
      const list = ceilingOf(role).map(tool => `  - ${tool}`).join('\n');
      const synced = syncFloor(fs.readFileSync(fileOf(role), 'utf8'), cores.get(role.stem)!, ANTIGRAVITY_FLOOR_MARKERS).replace(/^tools:\n(?: {2}- .*\n)+/m, `tools:\n${list}\n`);
      fs.writeFileSync(fileOf(role), synced);
    }
  }
});

/** The agent text outside its generated floor block: the part that is authored. */
const nativeText = (text: string): string => {
  const start = text.indexOf(ANTIGRAVITY_FLOOR_MARKERS.start);
  const end = text.indexOf(ANTIGRAVITY_FLOOR_MARKERS.end);
  return `${text.slice(0, start)}${text.slice(end + ANTIGRAVITY_FLOOR_MARKERS.end.length)}`;
};
const ticked = (text: string): string[] => [...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]);

describe('the native Antigravity roster', () => {
  it('ships the four specialists and the orchestrator as agent files, and nothing else', () => {
    expect(fs.readdirSync(AGENTS_DIR).sort()).toEqual(ROLES.map(role => `${role.name}.md`).sort());
  });
});

describe.each(ROLES)('native Antigravity $name', role => {
  const read = (): string => fs.readFileSync(fileOf(role), 'utf8').replace(/\r\n/g, '\n');
  const frontmatter = (): Record<string, unknown> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]) as Record<string, unknown>;
  const tools = (): string[] => frontmatter().tools as string[];

  it('honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(checkFloor(read(), cores.get(role.stem)!, ANTIGRAVITY_FLOOR_MARKERS)).toEqual([]);
  });

  it('uses only documented frontmatter keys and never `hooks:`, carries the required ones, and names itself like its file', () => {
    const meta = frontmatter();
    for (const key of Object.keys(meta)) expect(profile.artifacts.agent.allowedKeys, `unknown key ${key}`).toContain(key);
    for (const key of profile.artifacts.agent.requiredKeys) expect(meta[key], `required key ${key}`).toBeTruthy();
    expect(meta).not.toHaveProperty('hooks');
    expect(meta.name).toBe(role.name);
    expect(String(meta.description).length).toBeGreaterThan(60);
    expect(String(meta.description).length).toBeLessThan(400);
    // Left to the host default or to a later slice, because their effect is unverified or deferred (ADR 0030).
    for (const key of ['model', 'skills', 'plugins', 'mcpServers', 'commandExecutionPolicy']) expect(meta, key).not.toHaveProperty(key);
  });

  it(role.kind === 'orchestrator' ? 'is a main agent that cannot itself be invoked as a subagent' : 'is a subagent the orchestrator can invoke by name, and not a primary agent', () => {
    const meta = frontmatter();
    expect(meta.mainAgent).toBe(role.kind === 'orchestrator');
    expect(meta.subagent).toBe(role.kind !== 'orchestrator');
  });

  it('holds exactly its class-derived tool ceiling, in the catalog names, with no meta tool', () => {
    expect(Array.isArray(frontmatter().tools)).toBe(true);
    expect(new Set(tools()).size).toBe(tools().length);
    expect([...tools()].sort()).toEqual([...ceilingOf(role)].sort());
    for (const tool of tools()) {
      const entry = policy.catalog.find(item => item.name === tool);
      expect(entry, `${tool} is in the catalog`).toBeDefined();
      expect(entry!.class, `${tool} is not a meta tool`).not.toBe('meta');
    }
    expect(tools()).toEqual(expect.arrayContaining(['view_file', 'grep_search']));
  });

  it(role.kind === 'reader' ? 'holds no mutating tool at all, because nothing else is promised' : 'holds the shell and the editors, as its work needs', () => {
    if (role.kind === 'reader') {
      expect(tools().filter(tool => MUTATING.includes(tool))).toEqual([]);
    } else {
      expect(tools()).toEqual(expect.arrayContaining(WRITER_TOOLS));
    }
    if (role.kind !== 'orchestrator') {
      for (const tool of ['invoke_subagent', 'define_subagent', 'manage_subagents', 'schedule']) expect(tools(), `${tool} is the orchestrator's`).not.toContain(tool);
    }
  });

  it('is Antigravity-native in its own words: no Claude or Cline tool or product name, and every snake_case tool it names is in the catalog', () => {
    const text = nativeText(read());
    for (const token of ticked(text).filter(item => /^[a-z]+(_[a-z]+)+$/.test(item))) {
      expect(policy.catalog.some(entry => entry.name === token), `${token} is an Antigravity catalog tool`).toBe(true);
    }
    for (const foreign of FOREIGN_TOOLS) expect(text, foreign).not.toContain(foreign);
    expect(text).not.toMatch(/\bClaude\b|\bCline\b|\.claude\/|\.cline\/|CLAUDE\.md/);
  });

  it('names only skills that exist in the registry', () => {
    // Only the "Situation | Skill" tables name skills; the orchestrator's roster table names agents.
    let inSkillTable = false;
    const rows = nativeText(read())
      .split('\n')
      .filter(line => {
        if (/^\|\s*Situation/.test(line)) inSkillTable = true;
        else if (!line.startsWith('|')) inSkillTable = false;
        return inSkillTable && line.startsWith('|') && !/^\|\s*(Situation|-)/.test(line);
      });
    const skills = rows.flatMap(row => [...row.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(match => match[1]));
    for (const skill of skills) expect(fs.existsSync(path.join(registry, 'skills', skill, 'SKILL.md')), `skill ${skill}`).toBe(true);
    if (role.name !== 'code-reviewer') expect(skills.length).toBeGreaterThan(0);
  });

  it('says plainly what its list does and does not promise, and what the host does not do for it', () => {
    const text = nativeText(read());
    expect(text).toMatch(/Boundaries of this host/);
    if (role.kind === 'reader') {
      expect(text).toMatch(/\btools:/);
      expect(text).toMatch(/not verified|unverified/i);
      expect(text).toMatch(/do not (try|attempt)/i);
    }
    if (role.kind === 'writer') {
      expect(text).toMatch(/guard/i);
      expect(text).toMatch(/never push|never attempt/i);
    }
    expect(text).toMatch(/Open items|ask the user|do not ask the user/i);
  });
});

describe('the orchestrator as a file-defined main agent (ADR 0030 decision 5)', () => {
  const orchestrator = ROLES.find(role => role.kind === 'orchestrator')!;
  const text = (): string => nativeText(fs.readFileSync(fileOf(orchestrator), 'utf8').replace(/\r\n/g, '\n'));

  it('holds the delegation tools and a shell, and no meta tool', () => {
    const meta = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(fileOf(orchestrator), 'utf8').replace(/\r\n/g, '\n'))![1]) as { tools: string[] };
    expect(meta.tools).toEqual(expect.arrayContaining(['invoke_subagent', 'send_message', 'manage_subagents', 'run_command', 'write_to_file', 'ask_question']));
  });

  it('names the delegation tool, its argument fields and every specialist by its exact name, because a role name alone has misled a lead before', () => {
    const tokens = ticked(text());
    expect(tokens).toContain('invoke_subagent');
    for (const field of ['Prompt', 'Role', 'TypeName']) expect(tokens, field).toContain(field);
    for (const name of SPECIALISTS) expect(tokens, name).toContain(name);
    expect(text()).toMatch(/exactly/i);
  });

  it('says how it is started, and what to do when a specialist is not installed: say so, name the bundle command, never improvise', () => {
    expect(text()).toMatch(/--agent orchestrator-engineering/);
    expect(text()).toMatch(/\/agents/);
    expect(text()).toMatch(/agents add <bundle>/);
    expect(text()).toMatch(/not found|not installed/i);
    expect(text()).toMatch(/verbatim/i);
  });

  it('is honest about what is unverified: concurrent delegation, and enforcement of a tools list', () => {
    expect(text()).toMatch(/(parallel|concurren)[^.\n]*(unverified|not verified)|(unverified|not verified)[^.\n]*(parallel|concurren)/i);
    expect(text()).toMatch(/subagent: false|`subagent: false`/);
  });

  it('keeps the invariants: align first, contract first, you are the only relay, verify yourself with the shell', () => {
    expect(text()).toMatch(/contract first|contract-first/i);
    expect(text()).toMatch(/only relay/i);
    expect(text()).toMatch(/Open items/);
    expect(ticked(text())).toContain('run_command');
    expect(text()).toMatch(/failing test|test-first/i);
    expect(text()).toMatch(/git status/);
  });
});
