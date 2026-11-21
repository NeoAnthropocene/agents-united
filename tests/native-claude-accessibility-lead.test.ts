import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `accessibility-lead` (Bundle `frontend-engineering`): what its authored body must keep saying. Its canonical agent has no
 * command-execution tool (`commandExecutionPolicy: ask`), so the role holds no shell and says it cannot run the audit; every claim about
 * the guard below is fired against the real script.
 */

const text = (): string => nativeText('accessibility-lead');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-accessibility-lead.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();

describe('native accessibility-lead: no command execution, as its canonical agent', () => {
  it('holds no shell and no watcher, and the canonical agent has none either', () => {
    const tools = toolsOf(text());
    for (const shell of ['Bash', 'PowerShell', 'Monitor', 'TaskStop']) expect(tools, shell).not.toContain(shell);
    expect(canonical()).toMatch(/^commandExecutionPolicy: ask$/m);
    const canonicalTools = /^tools:\n((?:  - .+\n)+)/m.exec(canonical())![1]!;
    expect(canonicalTools).not.toMatch(/bash|shell|terminal|run_command|powershell/i);
  });

  it('holds exactly this tool set, and pins model and effort', () => {
    expect([...toolsOf(text())].sort()).toEqual([
      'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill', 'SubagentHandback',
      'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write', 'mcp__chrome-devtools-mcp', 'mcp__context7',
    ]);
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds the editors its canonical agent holds, and the read and search tools', () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit']));
  });

  it('says in step 3 that it cannot run the audit, and sends the command to the lead as a run-command entry under Requests for the lead', () => {
    const three = step(3);
    expect(three).toContain('You hold no shell, so you cannot run the audit command, the project\'s tests or a linter.');
    expect(three).toContain('put the exact command as a `run-command` entry under `Requests for the lead` for the lead to run and return');
  });

  it('step 6 calls a fix verified only after an audit result that was read or returned, and hands back through SubagentHandback', () => {
    const six = step(6);
    expect(six).toContain('A fix is verified only when an audit result after the change was read or returned to you.');
    expect(six).toContain('report it as unverified');
    expect(six).toContain('through `SubagentHandback`');
  });
});

describe('native accessibility-lead: the guard and permission claims', () => {
  it('step 5 names exactly what the bound guard blocks, and what it does not', () => {
    const five = step(5);
    expect(five).toContain('permissionMode: acceptEdits');
    expect(five).toContain('you hold no shell, so no command is approved for you');
    expect(five).toContain('blocks only writes to `.env` files and their variants such as `.env.local` (`.env.example` stays writable), made with `Write`, `Edit` or `NotebookEdit`, and a call whose input it cannot read');
    expect(five).toContain('its rules against forced pushes, `vercel --prod` and destructive shell commands apply to a shell, which you do not hold');
    expect(five).toContain('It does not stop an overwrite of any other file');
    expect(five).toContain('does not enforce the Safety rule against suppressing an audit rule');
    expect(five).toMatch(/is your own obligation/);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-a11y-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const write = (tool: string, file: string): ReturnType<typeof attempt> => attempt(text(), project, { tool, input: { file_path: file } }, { agentType: 'accessibility-lead' });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of a .env file, as step 5 says', tool => {
      const result = write(tool, path.join(project, '.env'));
      expect(result.offered).toBe(true);
      expect(result.blocked).toBe(true);
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of a .env variant such as .env.local, as step 5 says', tool => {
      expect(write(tool, path.join(project, '.env.local')).blocked).toBe(true);
      expect(write(tool, path.join(project, '.env.production')).blocked).toBe(true);
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('does not block a %s of .env.example or of an ordinary component, as step 5 says', tool => {
      expect(write(tool, path.join(project, '.env.example')).blocked).toBe(false);
      expect(write(tool, path.join(project, 'src/components/Dialog.tsx')).blocked).toBe(false);
    });

    it('does not stop an overwrite of a configuration file, as step 5 says', () => {
      expect(write('Write', path.join(project, '.axerc.json')).blocked).toBe(false);
      expect(write('Write', path.join(project, 'package.json')).blocked).toBe(false);
    });

    it('blocks a call whose input it cannot read, as step 5 says, and a Write that carries destructive shell text is data', () => {
      const unreadable = attempt(text(), project, { tool: 'Write' }, { agentType: 'accessibility-lead', stdin: '{' });
      expect(unreadable.blocked).toBe(true);
      expect(unreadable.reason).toContain('unreadable hook input');
      const data = attempt(text(), project, { tool: 'Write', input: { file_path: path.join(project, 'docs/notes.md'), content: 'sudo rm -rf /' } }, { agentType: 'accessibility-lead' });
      expect(data.blocked).toBe(false);
    });

    it('never offers a shell: the guard rules against forced pushes, vercel --prod and destructive commands have no tool to act on', () => {
      for (const tool of ['Bash', 'PowerShell']) {
        for (const command of ['git push --force origin main', 'vercel --prod', 'sudo rm -rf /']) {
          const result = attempt(text(), project, { tool, input: { command } }, { agentType: 'accessibility-lead' });
          expect(result.offered, `${tool}: ${command}`).toBe(false);
        }
      }
    });
  });

  it('Boundaries carry the one guard sentence, say the shell rules do not apply to this role, and say where the guard comes from in both modes', () => {
    const sentence = 'A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';
    expect(text().split(sentence)).toHaveLength(2);
    expect(text()).toContain(`- ${sentence} Its shell rules apply only to a shell, which you do not hold. For your \`Write\`, \`Edit\` and \`NotebookEdit\` calls it blocks \`.env\` files and their variants such as \`.env.local\` (\`.env.example\` stays writable), and a call whose input it cannot read; it checks no other file path. As a subagent it comes from this file; as a teammate it comes from the project's settings.`);
    expect(text()).toContain('- You cannot run commands: the audit, the tests and the build are run by the lead or by a role that holds a shell.');
  });

  it('keeps the audit-rule rule in the Safety floor', () => {
    expect(text()).toContain('- Never suppress, skip, or lower the severity of an automated accessibility rule to make an audit pass — fix the underlying markup.');
  });
});

describe('native accessibility-lead: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line (the Tier 1 form of frontend-architect's)", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
    const family = peersSection(nativeText('frontend-architect'));
    const tier2 = ' or as a teammate of a live Agent Team (Tier 2, the digital agency)';
    expect(family).toContain(tier2);
    expect(peersSection(text()).split('\n')).toEqual(family.replace(tier2, ' or as a teammate of a coordinated team').split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-accessibility-lead')!.capabilities).toContain('messaging');
  });
});

describe('native accessibility-lead: the MCP servers and skills of its canonical agent', () => {
  it('holds chrome-devtools-mcp and context7, and nothing beyond them', () => {
    const servers = toolsOf(text()).filter(tool => tool.startsWith('mcp__')).sort();
    expect(servers).toEqual(['mcp__chrome-devtools-mcp', 'mcp__context7']);
    expect([...canonical().matchAll(/^  - name: (.+)$/gm)].map(match => match[1]).sort()).toEqual(['chrome-devtools-mcp', 'context7']);
  });

  it('names the same four skills as the canonical agent, the contract and its skill table', async () => {
    const listed = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, '')).sort();
    expect(listed).toHaveLength(4);
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-accessibility-lead.contract.json'), 'utf8')) as { skills: string[] };
    expect([...contract.skills].sort()).toEqual(listed);
    const table = [...text().matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(match => match[1]).sort();
    expect(table).toEqual(listed);
  });
});

describe('native accessibility-lead: permission mode', () => {
  it('equals the value of the canonical registry agent', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
  });
});

describe('native accessibility-lead: the shared scope_boundaries and safety', () => {
  it('names the five canonical directives, and the three phases of the audit protocol', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-accessibility-lead')!.scope_boundaries;
    for (const title of ['Semantic HTML & Landmark Roles', 'Keyboard Navigation & Focus Management', 'Color Contrast & Dynamic Text', 'Accessible Form Controls', 'Screen Reader Optimization']) expect(scope, title).toContain(`**${title}**`);
    for (const obligation of ['200% text zoom', 'aria-describedby', 'aria-invalid', 'aria-live', 'focus traps inside modal dialogs', '4.5:1', '3:1']) expect(scope, obligation).toContain(obligation);
    for (const phase of ['Phase 1, automated audit', 'Phase 2, manual verification', 'Phase 3, remediation']) expect(scope, phase).toContain(phase);
    expect(scope).toContain('read existing audit output or ask the coordinator to run the audit and return its output');
  });

  it('carries the three Safety Guardrails of the canonical agent word for word', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-accessibility-lead')!.safety;
    const guardrails = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!.split('\n').filter(line => line.startsWith('- '));
    expect(guardrails).toHaveLength(3);
    for (const line of guardrails) expect(safety).toContain(line.slice(2));
  });
});
