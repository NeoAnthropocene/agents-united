import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadHostProfile, loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { CLINE_FLOOR_MARKERS, checkFloor, syncFloor } from '../src/core/native-floor.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 Phase 8 / ADR 0028 — the native Cline agents: four specialists as configured agents (`.cline/agents/<role>.yml`, each a
 * `subagent_<name>` tool for the lead). The orchestrator is not a file-defined agent (ADR 0028 decision 6). Each file is authored; its
 * Contract Floor block and its `tools:` list are generated (regenerate with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-cline-agents.test.ts`). `tools:` must equal the class-derived grant, because the host
 * enforces that list: a read-only role holds no mutating tool, so it needs no hook.
 */

interface RoleSpec {
  name: string;
  stem: string;
  writer: boolean;
  maxIterations: number;
}

const ROLES: RoleSpec[] = [
  { name: 'code-reviewer', stem: 'subagent-code-reviewer', writer: false, maxIterations: 12 },
  { name: 'repo-index', stem: 'subagent-repo-index', writer: false, maxIterations: 12 },
  { name: 'backend-architect', stem: 'subagent-backend-architect', writer: true, maxIterations: 30 },
  { name: 'frontend-architect', stem: 'subagent-frontend-architect', writer: true, maxIterations: 30 },
];

const registry = path.resolve('registry');
const AGENTS_DIR = path.join(registry, 'hosts/cline/agents');
const fileOf = (role: RoleSpec): string => path.join(AGENTS_DIR, `${role.name}.yml`);
const profile = loadHostProfile(registry, 'cline');
const policy = loadToolPolicy(registry, 'cline');
const claudeTools = new Set([...loadToolPolicy(registry, 'claude').catalog.map(tool => tool.name), 'SubagentHandback', 'ReportFindings']);
const MUTATING = policy.catalog.filter(tool => tool.mutating).map(tool => tool.name);
const WRITER_TOOLS = ['run_commands', 'editor', 'apply_patch'];

let cores: Map<string, SemanticCore>;
const ceilingOf = (role: RoleSpec): string[] => resolveGrant(policy, cores.get(role.stem)!.capabilities ?? [], { subagent: true, background: false }).tools;

beforeAll(async () => {
  cores = await loadSemanticCore(registry);
  if (process.env.UPDATE_NATIVE === '1') {
    for (const role of ROLES.filter(entry => fs.existsSync(fileOf(entry)))) {
      const list = ceilingOf(role).map(tool => `  - ${tool}`).join('\n');
      const synced = syncFloor(fs.readFileSync(fileOf(role), 'utf8'), cores.get(role.stem)!, CLINE_FLOOR_MARKERS).replace(/^tools:\n(?: {2}- .*\n)+/m, `tools:\n${list}\n`);
      fs.writeFileSync(fileOf(role), synced);
    }
  }
});

/** The agent text outside its generated floor block: the part that is authored. */
const nativeText = (text: string): string => {
  const start = text.indexOf(CLINE_FLOOR_MARKERS.start);
  const end = text.indexOf(CLINE_FLOOR_MARKERS.end);
  return `${text.slice(0, start)}${text.slice(end + CLINE_FLOOR_MARKERS.end.length)}`;
};

describe('the native Cline roster', () => {
  it('ships the four specialists as configured agents, and no file-defined orchestrator', () => {
    expect(fs.readdirSync(AGENTS_DIR).sort()).toEqual(ROLES.map(role => `${role.name}.yml`).sort());
  });
});

describe.each(ROLES)('native Cline $name', role => {
  const read = (): string => fs.readFileSync(fileOf(role), 'utf8').replace(/\r\n/g, '\n');
  const frontmatter = (): Record<string, unknown> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]) as Record<string, unknown>;
  const tools = (): string[] => frontmatter().tools as string[];

  it('honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(checkFloor(read(), cores.get(role.stem)!, CLINE_FLOOR_MARKERS)).toEqual([]);
  });

  it('uses only the frontmatter keys of the profile, carries the required ones, and names itself like its file', () => {
    const meta = frontmatter();
    for (const key of Object.keys(meta)) expect(profile.artifacts.agent.allowedKeys, `unknown key ${key}`).toContain(key);
    for (const key of profile.artifacts.agent.requiredKeys) expect(meta[key], `required key ${key}`).toBeTruthy();
    expect(meta.name).toBe(role.name);
    expect(String(meta.description).length).toBeGreaterThan(60);
    expect(String(meta.description).length).toBeLessThan(400);
    expect(meta.maxIterations).toBe(role.maxIterations);
    // `skills:` only filters what a configured agent can discover, so listing skills would hide the situational ones the body names.
    expect(meta).not.toHaveProperty('skills');
    expect(meta).not.toHaveProperty('providerId');
    expect(meta).not.toHaveProperty('modelId');
  });

  it('holds exactly its class-derived tool ceiling, in canonical names, because the host enforces the list', () => {
    expect(Array.isArray(frontmatter().tools)).toBe(true);
    expect(new Set(tools()).size).toBe(tools().length);
    expect([...tools()].sort()).toEqual([...ceilingOf(role)].sort());
    for (const tool of tools()) expect(policy.catalog.some(entry => entry.name === tool), `${tool} is in the catalog`).toBe(true);
    expect(tools()).toEqual(expect.arrayContaining(['read_files', 'search_codebase', 'skills']));
  });

  it(role.writer ? 'holds the shell and both editors, as its work needs' : 'holds no mutating tool at all, so the host alone keeps it read-only', () => {
    if (role.writer) {
      expect(tools()).toEqual(expect.arrayContaining(WRITER_TOOLS));
    } else {
      expect(tools().filter(tool => MUTATING.includes(tool))).toEqual([]);
      for (const tool of [...WRITER_TOOLS, 'spawn_agent', 'ask_question']) expect(tools(), tool).not.toContain(tool);
    }
  });

  it('is Cline-native in its own words: no Claude tool, server tool, path or product name, and every tool it names exists', () => {
    const text = nativeText(read());
    const ticked = [...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]);
    for (const token of ticked) {
      expect(claudeTools.has(token), `Claude tool ${token}`).toBe(false);
      expect(token.startsWith('mcp__'), `server tool ${token}`).toBe(false);
    }
    for (const token of ticked.filter(item => /^[a-z]+(_[a-z]+)+$/.test(item) && !item.startsWith('subagent_'))) {
      expect(policy.catalog.some(entry => entry.name === token), `${token} is a Cline catalog tool`).toBe(true);
    }
    expect(text).not.toMatch(/\bClaude\b|\.claude\/|CLAUDE\.md|SubagentHandback|AskUserQuestion/);
    expect(text).toContain(`subagent_${role.name.replace(/-/g, '_')}`);
  });

  it('names only skills that exist in the registry', () => {
    const rows = nativeText(read()).split('\n').filter(line => line.startsWith('|') && !/^\|\s*(Situation|-)/.test(line));
    const skills = rows.flatMap(row => [...row.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(match => match[1]));
    for (const skill of skills) expect(fs.existsSync(path.join(registry, 'skills', skill, 'SKILL.md')), `skill ${skill}`).toBe(true);
    if (role.name !== 'code-reviewer') expect(skills.length).toBeGreaterThan(0);
  });

  it(role.writer ? 'says plainly that the guard plugin protects the CLI only' : 'says plainly that the host, not a hook, keeps it read-only', () => {
    const text = nativeText(read());
    if (role.writer) {
      expect(text).toMatch(/guard plugin/);
      expect(text).toMatch(/only on the CLI/);
      expect(text).toMatch(/IDE extensions/);
    } else {
      expect(text).toMatch(/enforced by Cline itself/);
      expect(text).toMatch(/\btools:/);
    }
    expect(text).toMatch(/Open items|ask the user|do not ask the user/i);
  });
});
