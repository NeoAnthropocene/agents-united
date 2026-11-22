import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `e2e-tester` (Bundle `qa-automation`): what its authored body must keep saying. It holds a shell, so every claim about what
 * the bound guard blocks, and what it does not stop, is fired against the real script. Its canonical agent has `commandExecutionPolicy: ask`
 * and `permissionMode: acceptEdits`; the guard hook of the canonical agent (recursive deletes, privilege escalation, shutdown) is part of the
 * shared core's safety.
 */

const text = (): string => nativeText('e2e-tester');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-e2e-tester.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const sessionSection = (body: string): string => /\n## Session task tracking\n([\s\S]*)$/.exec(body)![1]!.trim();

describe('native e2e-tester: the exact tool set, model and effort', () => {
  it('holds exactly this tool set', () => {
    expect([...toolsOf(text())].sort()).toEqual([
      'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill',
      'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
      'mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__playwright',
    ]);
  });

  it('is the tool set of devops-engineer, whose canonical agent has the same tool list, with the three servers of its own canonical agent', () => {
    const shared = (body: string): string[] => toolsOf(body).filter(tool => !tool.startsWith('mcp__')).sort();
    expect(shared(text())).toEqual(shared(nativeText('devops-engineer')));
  });

  it('pins model sonnet and effort medium (ADR 0018 decision 7)', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds no delegation, workflow, scheduling or user-question tool, and says scheduling is not available', () => {
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate', 'CronDelete', 'CronList', 'AskUserQuestion', 'WebFetch', 'WebSearch']) expect(toolsOf(text()), forbidden).not.toContain(forbidden);
    expect(text()).toContain('- Running workflows, scheduling and spawning teammates or subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`: a recurring nightly run is a `schedule` request, not something you set up.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-e2e-tester')!.capabilities).toContain('messaging');
  });
});

describe('native e2e-tester: the MCP servers, skills and permission mode of its canonical agent', () => {
  it('holds playwright, chrome-devtools-mcp and context7, and nothing beyond them', () => {
    const servers = toolsOf(text()).filter(tool => tool.startsWith('mcp__')).sort();
    expect(servers).toEqual(['mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__playwright']);
    expect([...canonical().matchAll(/^  - name: (.+)$/gm)].map(match => `mcp__${match[1]}`).sort()).toEqual(servers);
  });

  it('names the same four skills as the canonical agent and the contract, in its skill table', () => {
    const listed = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, '')).sort();
    expect(listed).toHaveLength(4);
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-e2e-tester.contract.json'), 'utf8')) as { skills: string[] };
    expect([...contract.skills].sort()).toEqual(listed);
    const table = [...text().matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(match => match[1]).sort();
    expect(table).toEqual(listed);
  });

  it('keeps permissionMode acceptEdits, as the canonical agent has it, and states its limit in step 5', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
    expect(step(5)).toContain('`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking.');
  });
});

describe('native e2e-tester: the guard claims', () => {
  it('step 5 names what the guard reads, and what it does not stop', () => {
    const five = step(5);
    expect(five).toContain('reads command text and file paths: it does not stop a run against a production URL');
    expect(five).toContain('it does not stop a `git add` or `git commit` of a captured storage state');
    expect(five).toMatch(/your own obligation/);
    expect(five).toContain('report it as not run instead of asserting success.');
  });

  it('Boundaries carry the one guard sentence, and say where the guard comes from in both modes', () => {
    const sentence = `A guard blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary.`;
    expect(text().split(sentence)).toHaveLength(2);
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(text()).toContain(`${sentence} As a subagent it comes from this file. As a teammate it comes from the settings-level session guard, which exists only if it was switched on at install (it is optional); when you cannot tell, rely on no guard and keep its rules as your own obligation. Never try to get around it.`);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-e2e-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const run = (tool: string, command: string): boolean => attempt(text(), project, { tool, input: { command } }, { agentType: 'e2e-tester' }).blocked;
    const write = (tool: string, file: string): boolean => attempt(text(), project, { tool, input: { file_path: file } }, { agentType: 'e2e-tester' }).blocked;

    it.each(['Bash', 'PowerShell'])('blocks the forms of the canonical agent\'s own guard (rm -rf, sudo, shutdown) and the named forms through %s', tool => {
      for (const command of ['rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'git push --force origin main', 'vercel --prod']) expect(run(tool, command), `${tool}: ${command}`).toBe(true);
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of .env and .env.local, and lets .env.example and a spec file through', tool => {
      expect(write(tool, path.join(project, '.env'))).toBe(true);
      expect(write(tool, path.join(project, '.env.local'))).toBe(true);
      expect(write(tool, path.join(project, '.env.example'))).toBe(false);
      expect(write(tool, path.join(project, 'tests/e2e/checkout.spec.ts'))).toBe(false);
    });

    it.each([
      'npx playwright test tests/e2e/checkout.spec.ts',
      'npx playwright test --project=chromium --base-url=https://shop.example.com',
      'git add playwright/.auth/storageState.json',
      'git commit -m "add auth state"',
    ])('does not stop %s, as step 5 says', command => {
      expect(run('Bash', command)).toBe(false);
    });

    it.each(['Bash', 'PowerShell'])('does not stop a recursive delete of a build folder such as rm -rf node_modules through %s', tool => {
      expect(run(tool, 'rm -rf node_modules'), `${tool}: rm -rf node_modules`).toBe(false);
    });
  });
});

describe('native e2e-tester: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
  });

  it('step 7 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(7)).toContain('as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool (to a subagent, and only in auto mode); where it does not, your ordinary final response is the hand-back.');
  });

  it("carries the siblings' Session task tracking section byte for byte, as the last section", () => {
    expect(sessionSection(text())).toBe(sessionSection(nativeText('devops-engineer')));
    expect(sessionSection(text())).toBe(sessionSection(nativeText('accessibility-lead')));
    expect(text().trimEnd().endsWith(sessionSection(text()))).toBe(true);
  });
});

describe('native e2e-tester: the shared scope_boundaries and safety', () => {
  it('carries the five numbered directives of the canonical agent line for line, and the protocol', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-e2e-tester')!.scope_boundaries.replace(/\s+/g, ' ');
    const section = /\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!;
    const directives = [...section.matchAll(/^(\d+)\. (.+)$/gm)].map(match => `${match[1]}. ${match[2]}`.replace(/\s+/g, ' '));
    expect(directives).toHaveLength(5);
    for (const directive of directives) expect(scope, directive).toContain(directive);
    for (const phase of ['Journey mapping', 'Spec authoring', 'Execution and diagnosis', 'say so explicitly instead of asserting success']) expect(scope, phase).toContain(phase);
  });

  it('carries the three Safety Guardrails of the canonical agent word for word, and its destructive-command guard', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-e2e-tester')!.safety;
    const guardrails = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!.split('\n').filter(line => line.startsWith('- '));
    expect(guardrails).toHaveLength(3);
    for (const line of guardrails) expect(safety).toContain(line.slice(2));
    expect(safety).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation or shutdown.');
    expect(canonical()).toContain('Deny run_command if CommandLine matches /(rm -rf|sudo|shutdown)/i');
  });

  it('names no tool and no host in the core', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-e2e-tester')!;
    const all = [core.identity, core.mission, core.scope_boundaries, core.output_contract, core.safety, ...core.invariants].join('\n');
    for (const token of ['run_command', 'view_file', 'send_message', 'manage_task', 'Bash', 'SubagentHandback', 'Claude']) expect(all, token).not.toContain(token);
  });
});
