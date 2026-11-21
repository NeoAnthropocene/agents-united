import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `legal-contract-analyst` specialist: what its authored body must keep saying, the exact tool set it holds (a shell to run the license
 * scanner, editors, search and the markitdown server for contract documents), the question and the web tools it cannot use, the boundary of its canonical
 * agent that it states word for word, and the guard sentence, which a test fires against the real script. The peers and session sections are the
 * engineering family's form (the same as `devops-engineer`), not the digital agency's.
 */

const ROLE = 'legal-contract-analyst';
const STEM = 'subagent-legal-contract-analyst';
const CANONICAL = (): string => fs.readFileSync(path.resolve(`registry/agents/${STEM}.md`), 'utf8').replace(/\r\n/g, '\n');
const text = (): string => nativeText(ROLE);
const toolsLine = (): string => /^tools: (.*)$/m.exec(text())![1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const sessionSection = (body: string): string => /\n## Session task tracking\n([\s\S]*)$/.exec(body)![1]!.trim();
/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
/** The boundary of the canonical agent, as it stands there. */
const BOUNDARY = '*Important Note: You provide structured technical and operational contract analysis to support business decision-making, not formal legal representation or binding legal counsel.*';

/** The whole tools line: the read, search, edit, shell, messaging, hand-back, skill, task and discovery classes of the core, and the markitdown server of the canonical agent. */
const EXPECTED_TOOLS = [
  'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write', 'mcp__markitdown',
];

describe('native legal-contract-analyst: its exact tool set and posture', () => {
  it('holds exactly these tools: a shell, the markitdown server, no web tool, no watcher, no delegation, no scheduling', () => {
    expect(toolsLine().split(', ')).toEqual(EXPECTED_TOOLS);
    for (const forbidden of ['Agent', 'Workflow', 'Monitor', 'TaskStop', 'CronCreate', 'CronList', 'CronDelete', 'WebFetch', 'WebSearch', 'AskUserQuestion', 'EnterWorktree', 'ExitWorktree'])
      expect(toolsLine().split(', '), forbidden).not.toContain(forbidden);
    expect(toolsLine().split(', ').filter(tool => tool.startsWith('mcp__'))).toEqual(['mcp__markitdown']);
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

  it('binds the one server of its canonical agent, and says what it is for', () => {
    expect([...CANONICAL().matchAll(/^  - name: (.+)$/gm)].map(match => match[1])).toEqual(['markitdown']);
    expect(text()).toContain('- Contracts, policies and licence texts that are not plain text (a PDF, spreadsheet, slide deck or Word file) are read through `mcp__markitdown`; `ToolSearch` shows what it offers.');
  });

  it('holds no web tool and says so in no tool name that its tools line lacks', () => {
    expect(text()).not.toMatch(/`(WebSearch|WebFetch)`/);
    expect(section('Boundaries of this host')).toContain('You hold no web search or web fetch tool of your own');
  });
});

describe('native legal-contract-analyst: the question tool it never had', () => {
  it('has no ask-user class in its core, so the resolver has nothing to drop, and the tools line lacks the tool', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    expect(core.capabilities).not.toContain('ask-user');
    const grant = resolveGrant(loadToolPolicy('registry', 'claude'), core.capabilities ?? [], { subagent: true, background: false });
    expect(grant.tools).not.toContain('AskUserQuestion');
    expect(toolsLine().split(', ')).not.toContain('AskUserQuestion');
  });

  it('sends contractual risks and ambiguities to Open items in one sentence that names no tool, and records no delta', () => {
    const sentence = '- You hold no tool for asking the user. Critical contractual risks and ambiguities (an unclear clause, a missing exhibit, the governing jurisdiction) go under `Open items` in your report; the lead decides.';
    expect(text().split(sentence)).toHaveLength(2);
    expect(text()).not.toMatch(/AskUserQuestion/);
    expect(fs.readFileSync(path.resolve('registry/hosts/claude/deltas.json'), 'utf8')).not.toContain(ROLE);
  });
});

describe('native legal-contract-analyst: what it keeps from the canonical agent', () => {
  it('keeps every numbered directive of the canonical agent in its floor, word for word, and every phase of the protocol in its steps', () => {
    const canonical = CANONICAL();
    const directives = [...canonical.matchAll(/^\d+\. \*\*(.+?)\*\*/gm)].map(match => match[1]).slice(0, 4);
    expect(directives).toEqual(['Copyleft Contamination Prevention.', 'Clear SLA Credit Mechanics.', 'Intellectual Property Protection.', 'Structured Risk Scoring.']);
    for (const line of canonical.split('\n').filter(candidate => /^[1-4]\. \*\*/.test(candidate)).slice(0, 4)) expect(text(), line).toContain(line);
    const floor = /<!-- agents-united:floor:start[^>]*-->([\s\S]*?)<!-- agents-united:floor:end -->/.exec(text())![1]!;
    expect(floor).toContain('exclude planned maintenance');
    expect(floor).not.toContain('scheduled maintenance');
    const steps = section('How to review');
    for (const needle of ['LICENSE', 'NOTICE', 'GPL', 'AGPL', 'Limitation of Liability', '72 hours', 'indemnification', 'TERMS_OF_SERVICE.md', 'PRIVACY_POLICY.md', 'SLA.md', 'Dealbreaker', 'redline']) expect(steps, needle).toContain(needle);
  });

  it('states the boundary of the canonical agent word for word, and the report opens with it', () => {
    expect(CANONICAL()).toContain(BOUNDARY);
    expect(text().split(BOUNDARY)).toHaveLength(2);
    expect(/^4\. .*$/m.exec(section('How to review'))![0]).toContain('Open the report with that Important Note, in the same words.');
  });

  it('runs the license scan of the canonical protocol with its exact command', () => {
    expect(CANONICAL()).toContain('npx license-checker --summary --production');
    expect(/^1\. .*$/m.exec(section('How to review'))![0]).toContain('`npx license-checker --summary --production`');
  });

  it('names its two skills in a table, the skills of its contract', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve(`registry/core/${STEM}.contract.json`), 'utf8')) as { skills: string[] };
    const named = [...section('How to review').matchAll(/^\| [^|]+\| `([a-z0-9-]+)` \|$/gm)].map(match => match[1]).sort();
    expect(named).toEqual([...contract.skills].sort());
  });

  it('keeps the report shape of the canonical agent, in its order, and saves it under docs/legal/', () => {
    const parts = ['**Executive Summary**', '**License Distribution Summary**', '**Key Contractual Redline Recommendations**'];
    const positions = parts.map(part => section('How to review').indexOf(part));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(/^4\. .*$/m.exec(section('How to review'))![0]).toContain('`docs/legal/<topic>-<date>.md`');
  });
});

describe('native legal-contract-analyst: the permission mode, the shell and the guard, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-legal-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const write = (tool: string, file: string) => attempt(text(), project, { tool, input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file } }, { agentType: ROLE });
  const shell = (tool: 'Bash' | 'PowerShell', command: string) => attempt(text(), project, { tool, input: { command } }, { agentType: ROLE });
  const five = (): string => /^5\. .*$/m.exec(section('How to review'))![0];

  it('step 5 states the limit of acceptEdits, what the guard blocks and what it does not, and makes the rest an obligation', () => {
    expect(five()).toContain('file edits inside the working folder are approved without a prompt');
    expect(five()).toContain(`blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(five()).not.toContain('blocks only');
    expect(five()).toMatch(/does not stop an edit or a command that overwrites another file/);
    expect(five()).toMatch(/your own obligation/);
    expect(five()).toContain('write only the report, redline and policy drafts the brief asks for');
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked, as step 5 says', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it.each(['docs/legal/contract-review-2026-11-20.md', 'TERMS_OF_SERVICE.md', 'src/index.ts', 'package.json', '.env.example'])('%s is not blocked, which is why step 5 makes the rest an obligation', file => {
    const result = write('Write', path.join(project, file));
    expect([result.offered, result.blocked]).toEqual([true, false]);
  });

  it('a shell call is offered, and every blocked form the guard sentence names is blocked', () => {
    const forms: Array<['Bash' | 'PowerShell', string]> = [
      ['Bash', 'git push --force origin main'],
      ['Bash', 'git push -f origin main'],
      ['Bash', 'vercel --prod'],
      ['Bash', 'rm -rf /'],
      ['Bash', 'rm -rf ~'],
      ['Bash', 'rm -rf .git'],
      ['Bash', 'sudo apt-get install x'],
      ['Bash', 'shutdown -h now'],
      ['Bash', 'mkfs.ext4 /dev/sda1'],
      ['Bash', 'az group delete --name rg'],
      ['Bash', 'gcloud projects delete p'],
      ['Bash', 'echo KEY=1 > .env'],
      ['PowerShell', 'Remove-Item -Recurse -Force C:\\'],
      ['PowerShell', 'Restart-Computer'],
    ];
    for (const [tool, command] of forms) {
      const result = shell(tool, command);
      expect([tool, command, result.offered, result.blocked]).toEqual([tool, command, true, true]);
    }
  });

  it('the license scan and the other commands its work needs are offered and not blocked', () => {
    const passing: Array<['Bash' | 'PowerShell', string]> = [
      ['Bash', 'npx license-checker --summary --production'],
      ['Bash', 'ls LICENSE NOTICE'],
      ['Bash', 'git status'],
      ['Bash', 'git push --force-with-lease'],
      ['Bash', 'rm -rf node_modules'],
      ['Bash', 'terraform apply'],
      ['PowerShell', 'Get-ChildItem'],
    ];
    for (const [tool, command] of passing) {
      const result = shell(tool, command);
      expect([tool, command, result.offered, result.blocked]).toEqual([tool, command, true, false]);
    }
  });

  it('a command that writes a file is not blocked either, which is why only its own deliverables are its own obligation', () => {
    for (const command of ['npx license-checker --summary --production > docs/legal/licenses.md', 'echo x > src/index.ts']) {
      const result = shell('Bash', command);
      expect([command, result.blocked]).toEqual([command, false]);
    }
  });

  it('Boundaries say what the shell is for, and where the guard comes from in both modes', () => {
    const body = section('Boundaries of this host');
    expect(body).toContain('- Your shell (`Bash`, `PowerShell`) is for reading project files and running the license scanner. Show the command you ran and its output in the report.');
    expect(body).toContain(`- A guard blocks forced pushes, \`vercel --prod\`, \`.env\` writes and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file; as a teammate it comes from the project's settings.`);
    expect(text().split('A guard blocks')).toHaveLength(2);
  });
});

describe('native legal-contract-analyst: the engineering family sections', () => {
  it("has devops-engineer's peers section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it("has devops-engineer's session task tracking section line for line", () => {
    expect(sessionSection(text()).split('\n')).toEqual(sessionSection(nativeText('devops-engineer')).split('\n'));
  });

  it('names no lead and no sibling in its authored body', () => {
    const body = text().split('<!-- agents-united:floor:end -->')[1]!;
    expect(body).not.toMatch(/\b(orchestrator-\w+|backend-architect|frontend-architect|devops-engineer|business-panel-experts|financial-analyst|market-intelligence-analyst|operations-strategist|deep-research)\b/);
  });

  it('step 1 says where its search runs on macOS, Linux and WSL, as backend-architect does', () => {
    const one = /^1\. .*$/m.exec(section('How to review'))![0];
    expect(one).toContain('with `Glob` and `Grep` (on macOS, Linux and WSL this role holds `Bash`, so those two are unavailable there and search runs through `Bash`)');
  });

  it('step 7 hands the report back through SubagentHandback in the plain form', () => {
    expect(/^7\. .*$/m.exec(section('How to review'))![0]).toBe('7. **Hand back.** Return the report from the Output Contract as your final message through `SubagentHandback`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsLine().split(', ')).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });
});
