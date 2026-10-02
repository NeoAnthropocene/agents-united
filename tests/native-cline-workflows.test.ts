import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadToolPolicy } from '../src/core/host-profile.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';

/**
 * Plan 032 Phase 8 / ADR 0028 decision 5 — Cline skills and workflows. The Claude package turns the three multi-agent runbooks into scripted
 * workflows; Cline documents no scripted runtime, so their native form is a markdown workflow (`.cline/workflows/<name>.md`, a `/<name>`
 * command) that the lead follows by calling the `subagent_<name>` tools. Real sessions showed that the lead must be told the tool names, and that
 * several `subagent_*` calls in one turn run concurrently (host-library/cline/observations/2026-10-02-cli-3.0.68.md). The single-agent
 * `workflow-*` runbooks stay skills. The bundle's skills are portable as written, so none is copied: this suite keeps them Cline-loadable.
 */

const registry = path.resolve('registry');
const HOST = path.join(registry, 'hosts/cline');
const WORKFLOWS_DIR = path.join(HOST, 'workflows');
const policy = loadToolPolicy(registry, 'cline');
const claudeTools = new Set([...loadToolPolicy(registry, 'claude').catalog.map(tool => tool.name), 'SubagentHandback', 'ReportFindings']);
const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const ticked = (text: string): string[] => [...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]);

const SPECIALISTS = fs
  .readdirSync(path.join(HOST, 'agents'))
  .map(file => `subagent_${file.replace(/\.yml$/, '').replace(/-/g, '_')}`)
  .sort();

interface WorkflowSpec {
  name: string;
  /** Tools the workflow must name because it delegates to them. */
  uses: string[];
  verdicts: string[];
  /** Phrases that pin the behaviour it shares with the Claude script. */
  mustSay: RegExp[];
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    name: 'workflow-review',
    uses: ['subagent_code_reviewer'],
    verdicts: ['Request Changes', 'Comment', 'Approve'],
    mustSay: [/same turn/i, /refute/i, /unverified/i, /small[^\n]*medium[^\n]*large|`small`[\s\S]*`medium`[\s\S]*`large`/i, /read-only/i, /`git diff`|git diff/],
  },
  {
    name: 'workflow-implement',
    uses: ['subagent_backend_architect', 'subagent_frontend_architect', 'subagent_code_reviewer'],
    verdicts: ['Blocked', 'Incomplete', 'Needs Work', 'Ready'],
    mustSay: [/one after another|in order/i, /failing test|test-first/i, /never commit/i, /`run_commands`/, /fix (round|loop)/i, /`small`[\s\S]*`medium`[\s\S]*`large`/],
  },
  {
    name: 'workflow-test',
    uses: ['subagent_backend_architect', 'subagent_frontend_architect'],
    verdicts: ['Green', 'Red', 'Below Target', 'Unknown'],
    mustSay: [/`run_commands`/, /never (skip|disable)/i, /test-bug/, /product-bug/, /environment/, /unknown/, /by (test )?file/i, /`small`[\s\S]*`medium`[\s\S]*`large`/],
  },
];

describe('the native Cline workflows', () => {
  it('ship exactly the three multi-agent runbooks, each replacing the skill of the same name', () => {
    expect(fs.readdirSync(WORKFLOWS_DIR).sort()).toEqual(WORKFLOWS.map(entry => `${entry.name}.md`).sort());
    for (const entry of WORKFLOWS) expect(fs.existsSync(path.join(registry, 'skills', entry.name, 'SKILL.md')), `skill ${entry.name}`).toBe(true);
  });

  it('keep the verdict vocabulary of the Claude workflow of the same name, so the two hosts answer in the same words', () => {
    for (const entry of WORKFLOWS) {
      const script = read(path.join(registry, 'hosts/claude/workflows', `${entry.name}.js`));
      for (const verdict of entry.verdicts) expect(script, `${entry.name} script says ${verdict}`).toContain(`'${verdict}'`);
    }
  });
});

describe.each(WORKFLOWS)('native Cline $name', entry => {
  const file = path.join(WORKFLOWS_DIR, `${entry.name}.md`);
  const text = (): string => read(file);
  const frontmatter = (): Record<string, unknown> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]) as Record<string, unknown>;
  const body = (): string => text().replace(/^---\n[\s\S]*?\n---\n/, '');

  it('has only name and description, the name equal to its file and a description that says when to use it', () => {
    const meta = frontmatter();
    expect(Object.keys(meta).sort()).toEqual(['description', 'name']);
    expect(meta.name).toBe(entry.name);
    expect(String(meta.description).length).toBeGreaterThan(60);
    expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    expect(String(meta.description)).toMatch(/\buse\b/i);
  });

  it('names each specialist tool it delegates to explicitly, names no other subagent tool, and never routes through `team_run_task`', () => {
    const tokens = ticked(body());
    for (const tool of entry.uses) expect(tokens, tool).toContain(tool);
    for (const token of tokens.filter(item => item.startsWith('subagent_'))) expect(SPECIALISTS, `${token} is a shipped specialist`).toContain(token);
    expect(body()).toMatch(/role name/i);
    expect(body()).toMatch(/(never|do not|don't)[^.\n]*`team_run_task`/i);
  });

  it('says what it returns: every verdict word, computed by the lead from the evidence and not from a specialist\'s own claim', () => {
    for (const verdict of entry.verdicts) expect(body(), verdict).toContain(verdict);
    expect(body()).toMatch(/verdict/i);
  });

  it('carries the behaviour it shares with the Claude workflow', () => {
    for (const pattern of entry.mustSay) expect(body(), String(pattern)).toMatch(pattern);
  });

  it('is Cline-native: no Claude tool, server tool, path or product name, and every snake_case tool it names is in the Cline catalog', () => {
    const tokens = ticked(body());
    for (const token of tokens) {
      expect(claudeTools.has(token), `Claude tool ${token}`).toBe(false);
      expect(token.startsWith('mcp__'), `server tool ${token}`).toBe(false);
    }
    for (const token of tokens.filter(item => /^[a-z]+(_[a-z]+)+$/.test(item) && !item.startsWith('subagent_'))) {
      expect(policy.catalog.some(tool => tool.name === token), `${token} is a Cline catalog tool`).toBe(true);
    }
    expect(body()).not.toMatch(/\bClaude\b|\.claude\/|CLAUDE\.md|SubagentHandback|AskUserQuestion|\bAgent\(|`Workflow`|Workflow tool|\bpipeline\(|\bparallel\(/);
  });

  it('stays small enough to load as a command (under about 5k tokens) and never commits for the user', () => {
    expect(Buffer.byteLength(text())).toBeLessThan(9000);
    expect(body()).toMatch(/never[^.\n]*\b(commit|push)|does not commit|do not commit/i);
  });
});

describe('the bundle skills stay Cline-loadable (they are installed as written, not copied)', () => {
  const bundles = JSON.parse(read(path.join(registry, 'bundles.json'))) as { bundles?: Record<string, { skills?: string[] }> } & Record<string, { skills?: string[] }>;
  const skills = (bundles.bundles ?? bundles)['software-engineering'].skills ?? [];
  const BUILT_IN_COMMANDS = ['newtask', 'smol', 'newrule', 'deep-planning', 'reportbug'];

  it('has skills to check', () => {
    expect(skills.length).toBeGreaterThan(30);
  });

  it.each(skills)('%s: portable lint clean, a description Cline can load, no built-in command name', skill => {
    const source = read(path.join(registry, 'skills', skill, 'SKILL.md'));
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source)!;
    const meta = yaml.parse(match[1]) as Record<string, unknown>;
    expect(lintSkillPortability({ dirName: skill, name: String(meta.name), body: match[2] })).toEqual([]);
    expect(String(meta.description).length).toBeGreaterThan(0);
    expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    expect(BUILT_IN_COMMANDS).not.toContain(skill);
  });

  it('carry no frontmatter key beyond the Cline profile except the ones recorded as harmless when ignored', () => {
    const allowed = new Set(['name', 'description', 'metadata', 'license', 'disable-slash-command']);
    for (const skill of skills) {
      const meta = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read(path.join(registry, 'skills', skill, 'SKILL.md')))![1]) as Record<string, unknown>;
      for (const key of Object.keys(meta)) expect(allowed, `${skill}: ${key}`).toContain(key);
    }
  });
});
