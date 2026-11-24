import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `qa-automation-lead` (Bundle `qa-automation`, the Tier-1 copy of the QA core that `agency-qa-automation-lead` also stands on):
 * what its authored body must keep saying. It holds a shell, so every claim about what the bound guard blocks, and what it does not,
 * is fired against the real script.
 */

const text = (): string => nativeText('qa-automation-lead');
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-qa-automation-lead.md'), 'utf8').replace(/\r\n/g, '\n');
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

describe('native qa-automation-lead: the exact tool set, model and effort', () => {
  it('holds exactly this tool set', () => {
    expect([...toolsOf(text())].sort()).toEqual([
      'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill',
      'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
      'mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__playwright',
    ]);
  });

  it('is the agency copy of the same core, less the plugin-prefixed server spellings', () => {
    const agency = toolsOf(nativeText('agency-qa-automation-lead')).filter(tool => !tool.startsWith('mcp__plugin_'));
    expect([...toolsOf(text())].sort()).toEqual([...agency].sort());
  });

  it('pins model sonnet and effort medium (ADR 0018 decision 7)', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds no delegation, workflow, scheduling or user-question tool', () => {
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate', 'CronDelete', 'CronList', 'AskUserQuestion', 'WebFetch', 'WebSearch']) expect(toolsOf(text()), forbidden).not.toContain(forbidden);
  });

  it('says it cannot delegate or schedule, and recommends a nightly run as a schedule request under Requests for the lead', () => {
    expect(text()).toContain('- Running workflows, scheduling and spawning teammates or subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`: a recurring nightly run is a `schedule` request, not something you set up.');
  });
});

describe('native qa-automation-lead: the MCP servers, skills and permission mode of its canonical agent', () => {
  it('holds playwright, chrome-devtools-mcp and context7, and nothing beyond them', () => {
    const servers = toolsOf(text()).filter(tool => tool.startsWith('mcp__')).sort();
    expect(servers).toEqual(['mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__playwright']);
    expect([...canonical().matchAll(/^  - name: (.+)$/gm)].map(match => `mcp__${match[1]}`).sort()).toEqual(servers);
  });

  it('names the same seven skills as the canonical agent in its skill table', () => {
    const listed = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, '')).sort();
    expect(listed).toHaveLength(7);
    const table = [...text().matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(match => match[1]).sort();
    expect(table).toEqual(listed);
  });

  it('keeps permissionMode acceptEdits, as the canonical agent has it, and states its limit in step 5', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
    expect(step(5)).toContain('`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking, when that mode is in force (the main session\'s `acceptEdits`, `auto` or `bypassPermissions` mode replaces it, its `plan` mode keeps you in plan mode, and as a teammate your mode is set by the lead\'s).');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get('subagent-qa-automation-lead')!.capabilities).toContain('messaging');
  });
});

describe('native qa-automation-lead: the guard claims', () => {
  it('step 5 names what the guard reads, and what it does not stop', () => {
    const five = step(5);
    expect(five).toContain('reads command text and file paths, not the target of a test run');
    expect(five).toContain('it does not stop a Playwright run against a production URL or a test that submits a real form');
    expect(five).toContain('does not enforce the Safety rules against a masked assertion or a disabled check');
    expect(five).toContain('when only production exists, say so under `Open items` instead of submitting');
    expect(five).toMatch(/your own obligation/);
  });

  it('Boundaries carry the one guard sentence, and say where the guard comes from in both modes', () => {
    const sentence = `A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` redirect, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`;
    expect(text().split(sentence)).toHaveLength(2);
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(text()).toContain(`${sentence} As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Never try to get around it.`);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-qa-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const run = (tool: string, command: string): boolean => attempt(text(), project, { tool, input: { command } }, { agentType: 'qa-automation-lead' }).blocked;
    const write = (tool: string, file: string): boolean => attempt(text(), project, { tool, input: { file_path: file } }, { agentType: 'qa-automation-lead' }).blocked;

    it.each(['Bash', 'PowerShell'])('blocks the named forms through %s, as the guard sentence says', tool => {
      for (const command of ['git push --force origin main', 'git push -f origin main', 'vercel --prod', 'rm -rf /', 'sudo ls', 'shutdown now', 'az group delete --name g --yes']) {
        expect(run(tool, command), `${tool}: ${command}`).toBe(true);
      }
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of .env and .env.local, and lets .env.example and a spec file through', tool => {
      expect(write(tool, path.join(project, '.env'))).toBe(true);
      expect(write(tool, path.join(project, '.env.local'))).toBe(true);
      expect(write(tool, path.join(project, '.env.example'))).toBe(false);
      expect(write(tool, path.join(project, 'tests/e2e/funnel.spec.ts'))).toBe(false);
    });

    it.each(['npx playwright test --reporter=list', 'npx playwright test tests/e2e/funnel.spec.ts --base-url=https://shop.example.com', 'npx vitest run tests/e2e/', 'git push --force-with-lease'])('does not stop %s, as step 5 says of a test run', command => {
      expect(run('Bash', command)).toBe(false);
    });

    it.each(['Bash', 'PowerShell'])('does not stop a recursive delete of a build folder such as rm -rf node_modules through %s', tool => {
      expect(run(tool, 'rm -rf node_modules'), `${tool}: rm -rf node_modules`).toBe(false);
    });

    it('does not read what a test asserts: a spec that switches an audit off is written without a block', () => {
      const result = attempt(text(), project, { tool: 'Write', input: { file_path: path.join(project, 'tests/e2e/a11y.spec.ts'), content: "new AxeBuilder({ page }).disableRules(['color-contrast'])" } }, { agentType: 'qa-automation-lead' });
      expect(result.offered).toBe(true);
      expect(result.blocked).toBe(false);
    });
  });

  it('keeps the verify rule in Boundaries and the masking rule in step 6', () => {
    const body = text();
    expect(body).toContain('You verify; you do not implement. The application code and the other specialists\' files are theirs.');
    expect(body).toContain('A failing assertion is fixed at its cause or fails the gate');
  });
});

describe('native qa-automation-lead: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line, plus the planning consultation bullet that binds the core's consultation invariant", () => {
    const own = peersSection(text()).split('\n');
    const consult = own.filter(line => line.startsWith('- **Planning consultation.**'));
    expect(consult).toEqual(["- **Planning consultation.** When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement (your scope, the peer inputs you depend on, your deliverable, at most two open questions) and write no deliverable file."]);
    expect(own.filter(line => !consult.includes(line))).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
  });

  it('step 9 hands the gate report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(9)).toBe('9. **Hand back.** Return the gate report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it("carries the siblings' Session task tracking section byte for byte, as the last section", () => {
    expect(sessionSection(text())).toBe(sessionSection(nativeText('devops-engineer')));
    expect(sessionSection(text())).toBe(sessionSection(nativeText('accessibility-lead')));
    expect(text().trimEnd().endsWith(sessionSection(text()))).toBe(true);
  });
});

describe('native qa-automation-lead: no persona and no agency in the file', () => {
  it('names no person, no agency, no agency lead and no agency peer', () => {
    const body = text();
    for (const word of ['Emre', 'AstrolabsAI', 'Campaign Director', 'Deniz', 'Kaan', 'Defne', 'Selin', 'orchestrator-digital-agency', 'emre-qa', 'Motion Designer', 'Sound Designer']) expect(body, word).not.toContain(word);
    expect(body).not.toMatch(/\bChris\b/);
    for (const peer of ['conversion specialist', 'compliance specialist', 'SEO specialist']) expect(body.toLowerCase(), peer).not.toContain(peer.toLowerCase());
  });

  it('does not carry the agency-only sections', () => {
    for (const heading of ['## Media planning consultation', '## Conditional 3D handoff']) expect(text(), heading).not.toContain(heading);
    expect(text()).not.toContain('**Inputs first.**');
  });
});

describe('native qa-automation-lead: the shared scope_boundaries and safety', () => {
  it('carries the seven directives of the canonical agent', async () => {
    const scope = (await loadSemanticCore('registry')).get('subagent-qa-automation-lead')!.scope_boundaries;
    for (const title of ['Form submission integrity.', 'Attribution and tracking.', 'Zero console errors.', 'The viewport matrix.', 'No flaky tests.', 'Accessibility at WCAG 2.1 AA.', 'Verify, do not implement.']) expect(scope, title).toContain(`**${title}**`);
    for (const obligation of ['375 by 667', '768 by 1024', '1440 by 900', 'auto-waiting assertions', 'zero critical or serious violations', 'Report a defect through the lead']) expect(scope, obligation).toContain(obligation);
  });

  it('carries the four Safety Guardrails of the canonical agent', async () => {
    const safety = (await loadSemanticCore('registry')).get('subagent-qa-automation-lead')!.safety;
    const guardrails = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!.split('\n').filter(line => line.startsWith('- '));
    expect(guardrails).toHaveLength(4);
    for (const line of guardrails) expect(safety).toContain(line.slice(2));
  });
});
