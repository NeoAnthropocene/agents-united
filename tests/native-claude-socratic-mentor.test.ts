import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { withRoutes } from '../src/core/claude-mcp-routes.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `socratic-mentor` specialist: read-only by class, no tool that puts a question to the user (the host never gives it to a subagent),
 * and a body that says what is true of what is bound. The gap is pinned in code here, not declared as a delta: the core keeps the `ask-user`
 * class and the resolver drops the tool.
 */

const ROLE = 'socratic-mentor';
const STEM = 'subagent-socratic-mentor';
const text = (): string => nativeText(ROLE);
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

/** The whole tools line: the read, search, messaging, hand-back, skill, task and discovery classes of the core, then its one server by every route that exists. */
const EXPECTED_TOOLS = [
  'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch',
  'mcp__context7', 'mcp__plugin_context7_context7',
];

describe('native socratic-mentor: its exact tool set and posture', () => {
  it('holds exactly these tools: nothing that writes, runs a command, delegates or schedules', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Agent', 'Workflow', 'CronCreate', 'Monitor', 'WebFetch', 'WebSearch']) expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
  });

  it('declares the server of its canonical agent, by every route the generator knows', () => {
    const canonical = fs.readFileSync(path.resolve('registry/agents/subagent-socratic-mentor.md'), 'utf8').replace(/\r\n/g, '\n');
    const servers = [...canonical.matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]);
    expect(servers).toEqual(['context7']);
    expect(toolsLine().split(', ').filter(tool => tool.startsWith('mcp__'))).toEqual(withRoutes(servers.map(server => `mcp__${server}`)));
  });

  it('is sonnet at medium effort', () => {
    const meta = (key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(text())?.[1];
    expect([meta('model'), meta('effort')]).toEqual(['sonnet', 'medium']);
  });

  it("carries no permissionMode line, because the projector maps the canonical 'strict' to Claude's default", () => {
    const canonical = /^permissionMode: (.+)$/m.exec(fs.readFileSync(path.resolve('registry/agents/subagent-socratic-mentor.md'), 'utf8').replace(/\r\n/g, '\n'))?.[1];
    expect(canonical).toBe('strict');
    expect(ClaudeProjector.CLAUDE_DIALECT.permissionModeMap.strict).toBe('default');
    expect(/^permissionMode:/m.test(text())).toBe(false);
  });
});

describe('native socratic-mentor: the question tool is the gap, pinned in code', () => {
  it('keeps ask-user in the core, and the resolver drops the tool for a subagent', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    expect(core.capabilities).toContain('ask-user');
    const grant = resolveGrant(loadToolPolicy('registry', 'claude'), core.capabilities ?? [], { subagent: true, background: false });
    expect(grant.dropped).toContainEqual({ tool: 'AskUserQuestion', reason: 'never available to subagents' });
    expect(toolsLine().split(', ')).not.toContain('AskUserQuestion');
    expect(grant.tools).not.toContain('AskUserQuestion');
  });

  it('says in one sentence, without naming the tool, that the lead asks the user', () => {
    const body = text().split('<!-- agents-united:floor:end -->')[1]!;
    expect(body).toContain('You cannot put a question to the user yourself in this host. Your own clarifying questions to the user go under `Open items` and the lead asks them; your probing questions go in the report\'s `Probing Questions` section.');
    expect(body).not.toContain('AskUserQuestion');
    expect(body).not.toContain('ask_question');
  });
});

describe('native socratic-mentor: read-only, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-mentor-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const fire = (tool: string, input: Record<string, unknown> = {}) => attempt(text(), project, { tool, input }, { agentType: ROLE });

  it.each([
    ['Write', { file_path: 'src/a.ts' }],
    ['Edit', { file_path: 'src/a.ts' }],
    ['Bash', { command: 'ls' }],
    ['PowerShell', { command: 'Get-ChildItem' }],
    ['mcp__github__create_issue', {}],
    ['mcp__context7__update_docs', {}],
  ] as Array<[string, Record<string, unknown>]>)('%s is blocked by the bound guard, as the Boundaries say', (tool, input) => {
    expect(fire(tool, input).blocked).toBe(true);
  });

  it.each([
    ['Read', { file_path: 'src/a.ts' }],
    ['Grep', { pattern: 'x' }],
    ['SendMessage', {}],
    ['mcp__context7__query-docs', {}],
    ['mcp__plugin_context7_context7__resolve-library-id', {}],
  ] as Array<[string, Record<string, unknown>]>)('%s passes the guard', (tool, input) => {
    const result = fire(tool, input);
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('says exactly that in Boundaries and in step 5, which also binds the read-only invariant', () => {
    expect(text()).toContain('- A guard blocks any write tool, shell, or mutating connected-server tool, so do not try one; put the change in your report as a suggestion for the engineer. As a subagent it comes from this file; as a teammate it does not apply, so the read-only rule is yours alone.');
    expect(text()).toContain('this role holds no tool that writes a file or runs a command, and as a subagent the guard bound to it blocks any write tool, shell or mutating connected-server tool; as a teammate that guard does not apply, so the read-only rule is yours alone.');
    expect(text()).toContain('unless explicitly instructed after three Socratic turns');
    expect(text()).toContain('ask the engineer to state their own conclusions');
    expect(text()).toContain('The `grill-me` interview is the method: its questions go into your report, at most three, and the lead puts them to the engineer.');
  });
});

describe('native socratic-mentor: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('hands the report back through SubagentHandback and has the lead put the questions to the engineer', () => {
    expect(text()).toContain('Return the report from the Output Contract as your final message through `SubagentHandback`; the lead puts your probing questions to the engineer.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });
});
