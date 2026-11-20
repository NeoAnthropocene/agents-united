import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withRoutes } from '../src/core/claude-mcp-routes.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `deep-research` specialist: what its authored body must keep saying, the exact tool set it holds, and the guard sentence, which a
 * test fires against the real script. The peers section is the engineering family's form (the same as `devops-engineer`), not the digital agency's.
 */

const ROLE = 'deep-research';
const text = (): string => nativeText(ROLE);
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

/** The whole tools line: the editing, search, web, messaging, hand-back, skill, watcher, task and discovery classes of the core, then the two servers by every route that exists. */
const EXPECTED_TOOLS = [
  'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WebFetch', 'WebSearch', 'Write',
  'mcp__firecrawl', 'mcp__claude_ai_Firecrawl', 'mcp__context7', 'mcp__plugin_context7_context7',
];

describe('native deep-research: its exact tool set and posture', () => {
  it('holds exactly these tools, no shell, no delegation, no scheduling', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['Bash', 'PowerShell', 'Agent', 'Workflow', 'CronCreate', 'CronList', 'CronDelete', 'AskUserQuestion', 'EnterWorktree', 'ExitWorktree']) expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
  });

  it('declares the two servers of its canonical agent, by every route the generator knows', () => {
    const canonical = fs.readFileSync(path.resolve('registry/agents/subagent-deep-research.md'), 'utf8').replace(/\r\n/g, '\n');
    const servers = [...canonical.matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]);
    expect(servers).toEqual(['firecrawl', 'context7']);
    expect(toolsLine().split(', ').filter(tool => tool.startsWith('mcp__'))).toEqual(withRoutes(servers.map(server => `mcp__${server}`)));
  });

  it('is sonnet at medium effort, with the canonical permission mode', () => {
    const meta = (key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(text())?.[1];
    expect([meta('model'), meta('effort')]).toEqual(['sonnet', 'medium']);
    const canonical = /^permissionMode: (.+)$/m.exec(fs.readFileSync(path.resolve('registry/agents/subagent-deep-research.md'), 'utf8').replace(/\r\n/g, '\n'))?.[1];
    expect(canonical).toBe('acceptEdits');
    expect(meta('permissionMode')).toBe(canonical);
  });
});

describe('native deep-research: the canonical tools that are bound and the one that is not', () => {
  it('binds task tracking through the class manage_task resolves to, and no scheduling', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-deep-research')!;
    expect(core.capabilities).toContain('task-tracking');
    expect(core.capabilities).not.toContain('scheduling');
    for (const task of ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']) expect(toolsLine().split(', '), task).toContain(task);
  });

  it('says nothing about timers, schedules, cron or a command runner, and starts no background task', () => {
    const body = text();
    expect(body).not.toMatch(/cron|schedul|run_command|timer|liveness/i);
    expect(body).toContain('Do not start a long-running or background task yourself; builds and test runs go to the lead under `Open items`.');
  });
});

describe('native deep-research: the permission mode and the guard, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-research-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const write = (tool: string, file: string) => attempt(text(), project, { tool, input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file } }, { agentType: ROLE });

  it('step 4 states the limit of acceptEdits and what the guard blocks, and only that', () => {
    const four = /^4\. .*$/m.exec(section('How to research'))![0];
    expect(four).toContain('file edits inside the working folder are approved without a prompt');
    expect(four).toContain('blocks only writes to `.env` files');
    expect(four).toMatch(/does not stop an edit that overwrites another file/);
    expect(four).toMatch(/your own obligation/);
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked, as step 4 says', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it.each(['docs/research/streams-2026-11-20.md', 'src/index.ts', '.env.example'])('%s is not blocked, which is why step 4 makes the rest an obligation', file => {
    const result = write('Write', path.join(project, file));
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('holds no shell, so a shell call is not even offered', () => {
    expect(attempt(text(), project, { tool: 'Bash', input: { command: 'git push --force' } }, { agentType: ROLE }).offered).toBe(false);
  });

  it('Boundaries say where the guard comes from in both modes', () => {
    expect(text()).toContain("- A guard blocks writes to `.env` files made with the editing tools. As a subagent it comes from this file; as a teammate it comes from the project's settings.");
  });
});

describe('native deep-research: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('step 6 hands the report back through SubagentHandback in the plain form', () => {
    expect(/^6\. .*$/m.exec(section('How to research'))![0]).toBe('6. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-deep-research')!.capabilities).toContain('messaging');
  });
});
