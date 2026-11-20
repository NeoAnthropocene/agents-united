import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `business-panel-experts` specialist: what its authored body must keep saying, the exact tool set it holds, the question it cannot
 * ask, and the guard sentence, which a test fires against the real script. The peers section is the engineering family's form (the same as
 * `devops-engineer`), not the digital agency's.
 */

const ROLE = 'business-panel-experts';
const STEM = 'subagent-business-panel-experts';
const CANONICAL = (): string => fs.readFileSync(path.resolve(`registry/agents/${STEM}.md`), 'utf8').replace(/\r\n/g, '\n');
const text = (): string => nativeText(ROLE);
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const sessionSection = (body: string): string => /\n## Session task tracking\n([\s\S]*)$/.exec(body)![1]!.trim();

/** The whole tools line: the read, search, edit, web, messaging, hand-back, skill, task and discovery classes of the core. No server: the pair declares none. */
const EXPECTED_TOOLS = [
  'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WebFetch', 'WebSearch', 'Write',
];

describe('native business-panel-experts: its exact tool set and posture', () => {
  it('holds exactly these tools: no shell, no server, no watcher, no delegation, no scheduling', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['Bash', 'PowerShell', 'Agent', 'Workflow', 'CronCreate', 'CronList', 'CronDelete', 'Monitor', 'TaskStop', 'AskUserQuestion', 'EnterWorktree', 'ExitWorktree'])
      expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
    expect(toolsLine().split(', ').filter(tool => tool.startsWith('mcp__'))).toEqual([]);
  });

  it('is sonnet at medium effort, with the canonical permission mode', () => {
    const meta = (key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(text())?.[1];
    expect([meta('model'), meta('effort')]).toEqual(['sonnet', 'medium']);
    const canonical = /^permissionMode: (.+)$/m.exec(CANONICAL())?.[1];
    expect(canonical).toBe('acceptEdits');
    expect(meta('permissionMode')).toBe(canonical);
  });

  it('declares the task tracking class its sibling cores declare, and the tools it resolves to', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    expect(core.capabilities).toContain('task-tracking');
    expect(core.capabilities).not.toContain('scheduling');
    for (const task of ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']) expect(toolsLine().split(', '), task).toContain(task);
  });
});

describe('native business-panel-experts: the question tool it cannot hold', () => {
  it('keeps the ask-user class in the core, and the resolver drops the tool for a subagent, so the tools line lacks it', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    expect(core.capabilities).toContain('ask-user');
    const grant = resolveGrant(loadToolPolicy('registry', 'claude'), core.capabilities ?? [], { subagent: true, background: false });
    expect(grant.dropped).toContainEqual({ tool: 'AskUserQuestion', reason: 'never available to subagents' });
    expect(grant.tools).not.toContain('AskUserQuestion');
    expect(toolsLine().split(', ')).not.toContain('AskUserQuestion');
  });

  it('says so in one sentence that names no tool, and records no delta for it', () => {
    const sentence = 'You cannot put a question to the user yourself in this host. Put any question for the user under `Open items` in your report; the lead asks it.';
    expect(text().split(sentence)).toHaveLength(2);
    expect(text()).not.toMatch(/AskUserQuestion/);
    const deltas = fs.readFileSync(path.resolve('registry/hosts/claude/deltas.json'), 'utf8');
    expect(deltas).not.toContain(ROLE);
  });
});

describe('native business-panel-experts: what it keeps from the canonical agent', () => {
  it('keeps every numbered directive of the canonical agent in its floor, and every phase of the protocol in its steps', () => {
    const canonical = CANONICAL();
    const directives = [...canonical.matchAll(/^\d+\. \*\*(.+?)\*\*/gm)].map(match => match[1]).slice(0, 5);
    expect(directives).toEqual(['Evidence-Based Economics.', 'Unit Economics First.', 'Competitive Moat Assessment.', 'ROI & Payback Rigour.', 'Structured Executive Reporting.']);
    for (const title of directives) expect(text(), title).toContain(`**${title}**`);
    const steps = section('How to evaluate');
    for (const needle of ['LTV = (average revenue per user x gross margin %) / churn rate', 'LTV:CAC', '2x2', '30-60-90']) expect(steps, needle).toContain(needle);
  });

  it('has no disclaimer to keep: the canonical agent states none, and the native one adds none', () => {
    expect(CANONICAL()).not.toMatch(/not (legal|financial|investment|binding)|disclaimer|no guarantee/i);
    expect(text()).not.toMatch(/not (legal|financial|investment|binding)|disclaimer/i);
  });

  it('names its two skills in a table, the skills of its contract', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve(`registry/core/${STEM}.contract.json`), 'utf8')) as { skills: string[] };
    const named = [...section('How to evaluate').matchAll(/^\| [^|]+\| `([a-z0-9-]+)` \|$/gm)].map(match => match[1]).sort();
    expect(named).toEqual([...contract.skills].sort());
  });
});

describe('native business-panel-experts: the permission mode and the guard, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-business-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const write = (tool: string, file: string) => attempt(text(), project, { tool, input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file } }, { agentType: ROLE });
  const shell = (tool: 'Bash' | 'PowerShell', command: string) => attempt(text(), project, { tool, input: { command } }, { agentType: ROLE });

  it('step 5 states the limit of acceptEdits and what the guard does about edits, and only that', () => {
    const five = /^5\. .*$/m.exec(section('How to evaluate'))![0];
    expect(five).toContain('file edits inside the working folder are approved without a prompt');
    expect(five).toContain('refuses writes to `.env` files made with the editing tools');
    expect(five).toMatch(/does not stop an edit that overwrites another file/);
    expect(five).toMatch(/your own obligation/);
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked, as step 5 says', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it.each(['docs/strategy/pricing-2026-11-20.md', 'src/index.ts', 'package.json', '.env.example'])('%s is not blocked, which is why step 5 makes the rest an obligation', file => {
    const result = write('Write', path.join(project, file));
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('holds no shell, so a shell call is not even offered; the guard sentence is still true of the script it carries, form by form', () => {
    const forms: Array<['Bash' | 'PowerShell', string]> = [
      ['Bash', 'git push --force origin main'],
      ['Bash', 'vercel --prod'],
      ['Bash', 'rm -rf /'],
      ['Bash', 'rm -rf ~'],
      ['Bash', 'rm -rf .git'],
      ['Bash', 'sudo apt-get install x'],
      ['Bash', 'shutdown -h now'],
      ['Bash', 'mkfs.ext4 /dev/sda1'],
      ['Bash', 'az group delete --name rg'],
      ['Bash', 'gcloud projects delete p'],
      ['PowerShell', 'Remove-Item -Recurse -Force C:\\'],
      ['PowerShell', 'Restart-Computer'],
    ];
    for (const [tool, command] of forms) {
      const result = shell(tool, command);
      expect([tool, command, result.offered, result.blocked]).toEqual([tool, command, false, true]);
    }
    for (const [tool, command] of [['Bash', 'git push --force-with-lease'], ['Bash', 'terraform apply'], ['Bash', 'rm -rf node_modules'], ['PowerShell', 'Get-ChildItem']] as const) {
      const result = shell(tool, command);
      expect([tool, command, result.blocked]).toEqual([tool, command, false]);
    }
  });

  it('Boundaries say the role has editors and no shell, and where the guard comes from in both modes', () => {
    const body = section('Boundaries of this host');
    expect(body).toContain('- You hold editors and no shell. When the work needs a command, put it under `Open items` for the lead.');
    expect(body).toContain("it is a seat belt, not a boundary. As a subagent it comes from this file; as a teammate it comes from the project's settings. Never try to get around it.");
  });
});

describe('native business-panel-experts: the engineering family sections', () => {
  it("has devops-engineer's peers section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it("has devops-engineer's session task tracking section line for line", () => {
    expect(sessionSection(text()).split('\n')).toEqual(sessionSection(nativeText('devops-engineer')).split('\n'));
  });

  it('names no lead and no sibling in its authored body', () => {
    const body = text().split('<!-- agents-united:floor:end -->')[1]!;
    expect(body).not.toMatch(/(orchestrator-w+|backend-architect|frontend-architect|devops-engineer|deep-research|Chris|Ava|Kaan|Jale|Selin|Yavuz)/);
  });

  it('step 7 hands the report back through SubagentHandback in the plain form', () => {
    expect(/^7\. .*$/m.exec(section('How to evaluate'))![0]).toBe('7. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });
});
