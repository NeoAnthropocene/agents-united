import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withRoutes } from '../src/core/claude-mcp-routes.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `literature-patent-analyst` specialist: what its authored body must keep saying, the exact tool set it holds, and the guard sentence, which a
 * test fires against the real script. It holds a shell, editors and the two servers of its canonical agent, and no tool that reads the web by itself:
 * web content comes only through the firecrawl server. The peers section is the engineering family's form (the same as `devops-engineer`).
 */

const ROLE = 'literature-patent-analyst';
const STEM = 'subagent-literature-patent-analyst';
const text = (): string => nativeText(ROLE);
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to review'))![0];
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
/** The shared clause every Claude role with a shell carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
const canonical = (): string => fs.readFileSync(path.resolve(`registry/agents/${STEM}.md`), 'utf8').replace(/\r\n/g, '\n');

/** The whole tools line: the read, search, edit, shell, messaging, hand-back, skill, task and discovery classes of the core, then the two servers by every route that exists. */
const EXPECTED_TOOLS = [
  'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
  'mcp__firecrawl', 'mcp__claude_ai_Firecrawl', 'mcp__markitdown',
];

describe('native literature-patent-analyst: its exact tool set and posture', () => {
  it('holds exactly these tools: a shell and editors, no web tool of its own, no watcher, no delegation, no scheduling, no question to the user', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['WebFetch', 'WebSearch', 'Monitor', 'TaskStop', 'Agent', 'Workflow', 'CronCreate', 'CronList', 'CronDelete', 'AskUserQuestion', 'EnterWorktree', 'ExitWorktree']) expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
  });

  it('declares the two servers of its canonical agent, by every route the generator knows', () => {
    const servers = [...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]);
    expect(servers).toEqual(['firecrawl', 'markitdown']);
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

describe('native literature-patent-analyst: the canonical tools that are bound', () => {
  it('has no web class in its core, as its canonical agent has no search or read tool, and binds the shell and task tracking', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    expect(core.capabilities).not.toContain('web');
    expect(canonical()).not.toMatch(/search_web|read_url_content/);
    for (const capability of ['shell', 'edit', 'task-tracking']) expect(core.capabilities, capability).toContain(capability);
    for (const tool of ['Bash', 'PowerShell', 'Edit', 'Write', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']) expect(toolsLine().split(', '), tool).toContain(tool);
  });

  it('says nothing about timers, schedules, cron, a command runner, a web tool it does not hold or a question tool', () => {
    expect(text()).not.toMatch(/cron|schedul|run_command|timer|liveness|AskUserQuestion|ask_question|WebSearch|WebFetch/i);
  });

  it('says that web content comes only through the firecrawl server when it is connected', () => {
    expect(step(2)).toContain('You hold no direct web search or fetch tool: web content comes only through the `mcp__firecrawl` server when it is connected');
    expect(step(2)).toContain('A source you could not read goes under `Open items`, not into the matrix.');
  });
});

describe('native literature-patent-analyst: acceptEdits, the guard and the obligations, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-literature-guard-'));
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
    expect(five).toContain(`blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(five).not.toContain('blocks only');
    expect(five).toMatch(/does not stop an edit that overwrites another file, a delete of one file or of a build folder/);
    expect(five).toMatch(/does not catch every destructive form/);
    expect(five).toMatch(/run no destructive command/);
    expect(five).toMatch(/your own obligation/);
  });

  it.each(['git push --force origin main', 'git push -f origin main', 'vercel --prod', 'echo x > .env', 'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now'])('blocks the shell call %s, as step 5 says', command => {
    expect(call('Bash', { command }).blocked).toBe(true);
    expect(call('PowerShell', { command }).blocked).toBe(true);
  });

  it.each(['python tabulate.py', 'rm -rf build', 'git push --force-with-lease', 'node deltas.js > deltas.txt'])('does not block %s, which is why step 5 makes it an obligation', command => {
    const result = call('Bash', { command });
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it.each(['docs/research/speculative-decoding-2026-11-20.md', 'refs/review.bib', '.env.example'])('%s is not blocked', file => {
    const result = write('Write', path.join(project, file));
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('Boundaries say where the guard comes from in both modes', () => {
    expect(text()).toContain(`- A guard blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file; as a teammate it comes from the project's settings.`);
    expect(text().split('A guard blocks')).toHaveLength(2);
  });
});

describe('native literature-patent-analyst: what its steps say', () => {
  it('cites exactly, dissects the method and separates patent claims', () => {
    expect(step(3)).toContain('Cite every paper in BibTeX or APA with title, authors, year, venue and a DOI or arXiv identifier');
    expect(step(3)).toContain('Record, beside the reported peak metrics, the hardware (GPU count, training hours), the dataset composition and the failure modes');
    expect(step(3)).toContain('separate independent broad claims from narrow dependent limitations');
    expect(step(3)).toContain('Report a patent finding as prior-art research, not as a legal opinion on validity or infringement.');
  });

  it('presents a comparative table and computes its deltas with a script through the shell it holds', () => {
    expect(step(4)).toContain('Present findings in a comparative table (architecture, dataset, baseline metric delta, computational cost)');
    expect(step(4)).toContain('through `Bash` or `PowerShell`');
    expect(step(4)).toContain('report the command');
  });

  it('puts scope ambiguities under Open items and never asks the user', () => {
    expect(step(1)).toContain('An ambiguity in the scope goes under `Open items`; you never ask the user directly.');
  });

  it('names the skills of its contract in a table of situations it can do with its tools, and they exist', () => {
    const rows = [...section('How to review').matchAll(/^\| ([^|\n]+) \| `([a-z0-9-]+)` \|$/gm)];
    expect(rows.map(row => row[2])).toEqual(['technical-documentation', 'domain-modeling']);
    const contract = JSON.parse(fs.readFileSync(path.resolve(`registry/core/${STEM}.contract.json`), 'utf8')) as { skills: string[] };
    expect(rows.map(row => row[2]).sort()).toEqual([...contract.skills].sort());
  });

  it('says what the two servers are for, and that they may not be connected', () => {
    expect(section('Boundaries of this host')).toContain('Web pages come only through `mcp__firecrawl`, and `mcp__markitdown` converts a document you were given into text; either may not be connected, and then you say so under `Open items`.');
  });
});

describe('native literature-patent-analyst: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it("carries devops-engineer's Session task tracking section", () => {
    expect(section('Session task tracking')).toBe(
      new RegExp('\\n## Session task tracking\\n([\\s\\S]*?)$').exec(nativeText('devops-engineer'))![1]!.trim()
    );
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(step(6)).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });

  it('names no lead and no sibling specialist', () => {
    expect(text()).not.toMatch(/orchestrator-|statistical-analyst|deep-research|socratic-mentor|devops-engineer/);
  });
});
