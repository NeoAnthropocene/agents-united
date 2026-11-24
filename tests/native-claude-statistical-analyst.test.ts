import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withRoutes } from '../src/core/claude-mcp-routes.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `statistical-analyst` specialist: what its authored body must keep saying, the exact tool set it holds, and the guard sentence, which a
 * test fires against the real script. It holds a shell, editors and the one server of its canonical agent; the canonical `schedule` tool is not bound.
 * The peers section is the engineering family's form (the same as `devops-engineer`), not the digital agency's.
 */

const ROLE = 'statistical-analyst';
const STEM = 'subagent-statistical-analyst';
const text = (): string => nativeText(ROLE);
/** The generated requests block names `schedule` and the schedule tools; only the scan for those words leaves it out, every other word is checked against the whole text. */
const withoutRequests = (value: string): string => value.replace(/<!-- agents-united:requests:start[^>]*-->[\s\S]*?<!-- agents-united:requests:end -->\n?/, '');
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to analyze'))![0];
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
/** The shared clause every Claude role with a shell carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
const canonical = (): string => fs.readFileSync(path.resolve(`registry/agents/${STEM}.md`), 'utf8').replace(/\r\n/g, '\n');

/** The whole tools line: the read, search, edit, shell, watcher, messaging, hand-back, skill, task and discovery classes of the core, then its one server by every route that exists. */
const EXPECTED_TOOLS = [
  'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
  'mcp__markitdown',
];

describe('native statistical-analyst: its exact tool set and posture', () => {
  it('holds exactly these tools: a shell and editors, no web, no delegation, no scheduling, no question to the user', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate', 'CronList', 'CronDelete', 'AskUserQuestion', 'WebFetch', 'WebSearch', 'EnterWorktree', 'ExitWorktree']) expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
  });

  it('declares the one server of its canonical agent, by every route the generator knows', () => {
    const servers = [...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]);
    expect(servers).toEqual(['markitdown']);
    expect(toolsLine().split(', ').filter(tool => tool.startsWith('mcp__'))).toEqual(withRoutes(servers.map(server => `mcp__${server}`)));
  });

  it('is sonnet at medium effort, with the canonical permission mode', () => {
    const meta = (key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(text())?.[1];
    expect([meta('model'), meta('effort')]).toEqual(['sonnet', 'medium']);
    const mode = /^permissionMode: (.+)$/m.exec(canonical())?.[1];
    expect(mode).toBe('acceptEdits');
    expect(meta('permissionMode')).toBe(mode);
  });
});

describe('native statistical-analyst: the canonical tools that are bound and the one that is not', () => {
  it('binds the shell, the watcher and task tracking through the classes of its core, and no scheduling', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    for (const capability of ['shell', 'background-monitor', 'task-tracking']) expect(core.capabilities, capability).toContain(capability);
    expect(core.capabilities).not.toContain('scheduling');
    for (const tool of ['Bash', 'PowerShell', 'Monitor', 'TaskStop', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']) expect(toolsLine().split(', '), tool).toContain(tool);
  });

  it('says nothing about timers, schedules, cron, a command runner or a question tool', () => {
    expect(withoutRequests(text())).not.toMatch(/cron|schedul|AskUserQuestion/i);
    expect(text()).not.toMatch(/run_command|manage_task|timer|liveness|ask_question/i);
  });
});

describe('native statistical-analyst: acceptEdits, the guard and the obligations, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-stat-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const call = (tool: string, input: Record<string, unknown>) => attempt(text(), project, { tool, input }, { agentType: ROLE });
  const write = (tool: string, file: string) => call(tool, tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file });

  it('step 5 states the limit of acceptEdits, what the guard blocks and what it does not, and makes the rest an obligation', () => {
    const five = step(5);
    expect(five).toContain('file edits inside the working folder are approved without a prompt');
    expect(five).toContain(`blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect to an unquoted path without backslashes, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(five).not.toContain('blocks only');
    expect(five).toMatch(/does not stop an edit that overwrites another file, a delete of one file or of a build folder/);
    expect(five).toMatch(/does not catch every destructive form/);
    expect(five).toMatch(/run no destructive command/);
    expect(five).toMatch(/your own obligation/);
  });

  it.each(['git push --force origin main', 'git push -f origin main', 'vercel --prod', 'echo x > .env', 'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'mkfs.ext4 /dev/sda1', 'az group delete --name g --yes'])('blocks the shell call %s, as step 5 says', command => {
    expect(call('Bash', { command }).blocked).toBe(true);
    expect(call('PowerShell', { command }).blocked).toBe(true);
  });

  it.each(['python analysis.py', 'rm -rf build', 'git push --force-with-lease', 'node power.js > results.txt'])('does not block %s, which is why step 5 makes it an obligation', command => {
    const result = call('Bash', { command });
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it.each(['docs/research/ab-test-2026-11-20.md', 'analysis/power.py', '.env.example'])('%s is not blocked', file => {
    const result = write('Write', path.join(project, file));
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('Boundaries say where the guard comes from in both modes', () => {
    expect(text()).toContain(`- A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect to an unquoted path without backslashes, and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.`);
    expect(text().split('A guard blocks')).toHaveLength(2);
  });
});

describe('native statistical-analyst: what its steps say', () => {
  it('gates the sample size, checks the assumptions and corrects for several metrics', () => {
    expect(step(2)).toContain('Test normality, homoscedasticity and independence of the samples before you choose a parametric or a non-parametric test');
    expect(step(3)).toContain('Never approve an A/B test before you have computed the required sample size per variant and the duration');
    expect(step(4)).toContain('Apply a false discovery rate or Bonferroni correction when you test several metrics at once');
    expect(step(4)).toContain('write every formula in KaTeX with its assumptions beside it');
  });

  it('puts the assumed significance level, power and effect size under Open items and never asks the user', () => {
    const three = step(3);
    expect(three).toContain('State the significance level, the power and the minimum detectable effect as assumptions in the report and put each one as a non-blocking `ask-user` entry under `Requests for the lead`; you never ask the user directly.');
  });

  it('computes with a script through the shell it holds and reports the command', () => {
    expect(step(2)).toContain('through `Bash` or `PowerShell`');
    expect(step(2)).toContain('report the exact command and its output');
  });

  it('names the skills of its contract in a table of situations it can do with its tools, and they exist', async () => {
    const rows = [...section('How to analyze').matchAll(/^\| ([^|\n]+) \| `([a-z0-9-]+)` \|$/gm)].filter(row => row[2] !== 'Skill');
    expect(rows.map(row => row[2])).toEqual(['technical-documentation', 'growth-experiment-design']);
    const contract = JSON.parse(fs.readFileSync(path.resolve(`registry/core/${STEM}.contract.json`), 'utf8')) as { skills: string[] };
    expect(rows.map(row => row[2]).sort()).toEqual([...contract.skills].sort());
    expect(section('How to analyze')).toContain("A skill's inputs that the brief does not give go to the lead as `ask-user` entries under `Requests for the lead`; you do not ask the user for them yourself.");
  });

  it('says what the watcher and the converter are for, and that the converter may not be connected', () => {
    expect(section('Boundaries of this host')).toContain('`Monitor` streams the output of a long simulation or test run instead of polling, and `TaskStop` ends a run that you started.');
    expect(section('Boundaries of this host')).toContain('`mcp__markitdown` converts a document you were given into text; it may not be connected, and then you say so under `Open items`.');
  });
});

describe('native statistical-analyst: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it("carries devops-engineer's Session task tracking section", () => {
    expect(section('Session task tracking')).toBe(
      new RegExp('\\n## Session task tracking\\n([\\s\\S]*?)$').exec(nativeText('devops-engineer'))![1]!.trim()
    );
  });

  it('step 6 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });

  it('names no lead and no sibling specialist', () => {
    expect(text()).not.toMatch(/orchestrator-|literature-patent|deep-research|socratic-mentor|devops-engineer/);
  });
});
