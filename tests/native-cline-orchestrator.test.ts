import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadHostProfile, loadToolPolicy } from '../src/core/host-profile.js';
import { CLINE_ORCHESTRATOR_FLOOR_MARKERS, checkFloor, syncFloor } from '../src/core/native-floor.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 Phase 8 / ADR 0028 decision 6 — the Cline orchestrator slice. The lead agent is not a file-defined agent, so the
 * coordinator ships as an always-loaded rule (`.cline/rules/`) plus a skill (`.cline/skills/`) that coordinates the four native
 * specialists. A real session showed why the tools must be named: told only a role name, the lead model reached for
 * `team_run_task` and reported the agent missing, while told `subagent_code_reviewer` it worked
 * (host-library/cline/observations/2026-10-02-cli-3.0.68.md). The rule's Contract Floor block is generated from the core
 * (regenerate with `UPDATE_NATIVE=1 npx vitest run tests/native-cline-orchestrator.test.ts`).
 */

const registry = path.resolve('registry');
const HOST = path.join(registry, 'hosts/cline');
const RULE_FILE = path.join(HOST, 'rules/agents-united-orchestrator-engineering.md');
const SKILL_DIR = path.join(HOST, 'skills/orchestrator-engineering');
const SKILL_FILE = path.join(SKILL_DIR, 'SKILL.md');
const CORE_STEM = 'orchestrator-engineering';

const profile = loadHostProfile(registry, 'cline');
const policy = loadToolPolicy(registry, 'cline');
const claudeTools = new Set([...loadToolPolicy(registry, 'claude').catalog.map(tool => tool.name), 'SubagentHandback', 'ReportFindings']);

/** The four specialists, from the shipped agent files, as the lead sees them: one `subagent_<name>` tool each. */
const AGENTS_DIR = path.join(HOST, 'agents');
const specialists = fs
  .readdirSync(AGENTS_DIR)
  .filter(file => file.endsWith('.yml'))
  .map(file => file.replace(/\.yml$/, ''))
  .sort();
const toolOf = (name: string): string => `subagent_${name.replace(/-/g, '_')}`;
const SPECIALIST_TOOLS = specialists.map(toolOf);
const READ_ONLY = ['code-reviewer', 'repo-index'].map(toolOf);
const WRITERS = ['backend-architect', 'frontend-architect'].map(toolOf);

const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

let core: SemanticCore;
beforeAll(async () => {
  core = (await loadSemanticCore(registry)).get(CORE_STEM)!;
  if (process.env.UPDATE_NATIVE === '1' && fs.existsSync(RULE_FILE)) {
    fs.writeFileSync(RULE_FILE, syncFloor(read(RULE_FILE), core, CLINE_ORCHESTRATOR_FLOOR_MARKERS));
  }
});

/** The text outside the generated floor block: the part that is authored. */
const authored = (text: string): string => {
  const start = text.indexOf(CLINE_ORCHESTRATOR_FLOOR_MARKERS.start);
  const end = text.indexOf(CLINE_ORCHESTRATOR_FLOOR_MARKERS.end);
  return start < 0 ? text : `${text.slice(0, start)}${text.slice(end + CLINE_ORCHESTRATOR_FLOOR_MARKERS.end.length)}`;
};
const ticked = (text: string): string[] => [...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]);

describe('the files', () => {
  it('ships exactly one rule and one skill, and the orchestrator is still not a file-defined agent', () => {
    expect(fs.readdirSync(path.join(HOST, 'rules'))).toEqual(['agents-united-orchestrator-engineering.md']);
    expect(fs.readdirSync(path.join(HOST, 'skills'))).toEqual(['orchestrator-engineering']);
    expect(fs.readdirSync(SKILL_DIR)).toEqual(['SKILL.md']);
    expect(specialists).toEqual(['backend-architect', 'code-reviewer', 'frontend-architect', 'repo-index']);
  });
});

describe.each([
  ['the rule', RULE_FILE],
  ['the skill', SKILL_FILE],
])('%s', (_label, file) => {
  const text = (): string => read(file);

  it('names every specialist tool explicitly, as `subagent_<name>`, and no other subagent tool', () => {
    const tokens = ticked(text());
    for (const tool of SPECIALIST_TOOLS) expect(tokens, tool).toContain(tool);
    for (const token of tokens.filter(item => item.startsWith('subagent_'))) expect(SPECIALIST_TOOLS, `${token} is a shipped specialist`).toContain(token);
  });

  it('says a role name alone is not a tool, and that these roles are not reached through `team_run_task`', () => {
    expect(text()).toMatch(/role name/i);
    expect(text()).toMatch(/(never|do not|don't)[^.\n]*`team_run_task`/i);
  });

  it('is Cline-native: no Claude tool, server tool, path or product name, and every snake_case tool it names is in the Cline catalog', () => {
    const body = authored(text());
    const tokens = ticked(body);
    for (const token of tokens) {
      expect(claudeTools.has(token), `Claude tool ${token}`).toBe(false);
      expect(token.startsWith('mcp__'), `server tool ${token}`).toBe(false);
    }
    for (const token of tokens.filter(item => /^[a-z]+(_[a-z]+)+$/.test(item) && !item.startsWith('subagent_'))) {
      expect(policy.catalog.some(entry => entry.name === token), `${token} is a Cline catalog tool`).toBe(true);
    }
    expect(body).not.toMatch(/\bClaude\b|\.claude\/|CLAUDE\.md|SubagentHandback|AskUserQuestion|\bAgent\(|\bWorkflow\b/);
  });

  it('says which specialists are read-only (host-enforced) and which write, so the lead routes edits and checks correctly', () => {
    const body = authored(text());
    for (const tool of READ_ONLY) expect(body, tool).toMatch(new RegExp(`\`${tool}\`[^\\n]*read-only`, 'i'));
    for (const tool of WRITERS) expect(body, tool).toMatch(new RegExp(`\`${tool}\`[^\\n]*(edit|writ)`, 'i'));
  });

  it('names only skills that exist in the registry', () => {
    const rows = authored(text()).split('\n').filter(line => line.startsWith('|') && !/^\|\s*(Situation|Tool|-)/.test(line));
    const skills = rows.flatMap(row => [...row.matchAll(/`\/?([a-z][a-z0-9-]+)`/g)].map(match => match[1])).filter(name => !name.startsWith('subagent'));
    for (const skill of skills) expect(fs.existsSync(path.join(registry, 'skills', skill, 'SKILL.md')) || skill === 'orchestrator-engineering', `skill ${skill}`).toBe(true);
  });
});

describe('the rule', () => {
  const text = (): string => read(RULE_FILE);

  it('has no frontmatter (a rule without one is always active) and honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(text().startsWith('---')).toBe(false);
    expect(text()).toMatch(/^# /);
    expect(checkFloor(text(), core, CLINE_ORCHESTRATOR_FLOOR_MARKERS)).toEqual([]);
  });

  it('stays lean, because a rule costs context on every turn', () => {
    expect(authored(text()).length).toBeLessThan(3600);
    expect(Buffer.byteLength(text())).toBeLessThan(7000);
  });

  it('hands the procedure to the skill and tells the lead to load it with the `skills` tool', () => {
    expect(text()).toMatch(/`skills`/);
    expect(ticked(text())).toContain('orchestrator-engineering');
  });

  it('tells the lead what to do when a specialist tool is missing: say so first, name the bundle command, call only tools in its list, and self-execute only the smallest slice and report it (as the floor allows)', () => {
    expect(text()).toMatch(/agents add <bundle>/);
    expect(text()).toMatch(/missing from your tool list/i);
    expect(text()).toMatch(/only (a|the) tool[s]? (that is |that are )?in your (tool )?list/i);
    expect(text()).toMatch(/self-execut/i);
    expect(text()).toMatch(/never substitute .*`team_run_task`/i);
    expect(text()).toMatch(/always name the bundle .*agents add <bundle>/i);
    expect(text()).toMatch(/smallest slice/i);
    expect(text()).not.toMatch(/declined to install/i);
  });
});

describe('the skill', () => {
  const text = (): string => read(SKILL_FILE);
  const frontmatter = (): Record<string, unknown> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]) as Record<string, unknown>;

  it('has only the frontmatter keys of the profile, a name equal to its directory, and a description that triggers on delegation work', () => {
    const meta = frontmatter();
    for (const key of Object.keys(meta)) expect(profile.artifacts.skill.allowedKeys, `unknown key ${key}`).toContain(key);
    expect(meta.name).toBe('orchestrator-engineering');
    const description = String(meta.description);
    expect(description.length).toBeGreaterThan(60);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toMatch(/delegat/i);
    expect(description).toMatch(/subagent_/);
  });

  it('stays under the host guideline of about 5k tokens for a SKILL.md', () => {
    expect(Buffer.byteLength(text())).toBeLessThan(12000);
  });

  it('writes every delegation as a self-contained brief with the five parts of the core invariant', () => {
    for (const part of [/objective/i, /scope/i, /acceptance evidence/i, /peer/i, /report format/i]) expect(text()).toMatch(part);
  });

  it('keeps the invariants: plan and align first, contract first for a shared interface, one synthesis point, and relay between specialists', () => {
    expect(text()).toMatch(/contract first|contract-first/i);
    expect(text()).toMatch(/synthesi[sz]/i);
    expect(text()).toMatch(/relay/i);
    expect(text()).toMatch(/Open items/);
    expect(text()).toMatch(/ask the user|ask_question/i);
  });

  it('verifies itself, since the reviewer and indexer cannot run anything: the lead runs the checks with `run_commands` and works test-first', () => {
    expect(ticked(text())).toContain('run_commands');
    expect(text()).toMatch(/test-first|failing test/i);
    expect(text()).toMatch(/git status/);
  });

  it('is honest about the guard plugin protecting the CLI only', () => {
    expect(text()).toMatch(/guard plugin/);
    expect(text()).toMatch(/only on the CLI/);
    expect(text()).toMatch(/IDE extensions/);
  });
});
