import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationOf, withRoutes } from '../src/core/claude-mcp-routes.js';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { withoutPublishingBlock } from './helpers/artifact-holders.js';
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * The native `orchestrator-design` (product-design bundle, Tier 1, a DOMAIN lead run as the main thread): what its authored body
 * must keep saying, and the exact tools it holds. It is the design counterpart of `orchestrator-engineering`, cut for a lead that
 * writes no code, ships no saved workflow, and has no image tool on this host. Every claim about a tool, a server or a guard has
 * to be true of what is bound.
 */

const ROLE = 'orchestrator-design';
const BUNDLE = 'product-design';
const text = (): string => nativeText(ROLE);
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]!);
const tools = (): string[] => splitTools(String(frontmatter().tools));
const names = (): string[] => tools().map(tool => tool.split('(')[0]!);
const canonical = (type: string): string => fs.readFileSync(path.resolve(`registry/agents/subagent-${type}.md`), 'utf8').replace(/\r\n/g, '\n');
const serversOf = (type: string): string[] => [...canonical(type).matchAll(/^  - name: (\S+)$/gm)].map(match => match[1]!);

/** Exactly the eight design types of the design domain; `frontend-architect` and `accessibility-lead` are not derivable from the bundles and are reached through the cross-bundle table. */
const DESIGN_TYPES = [
  'design-ops-lead', 'design-researcher', 'design-systems-architect', 'designer-toolkit-expert', 'interaction-designer', 'prototype-tester', 'ui-designer', 'ux-strategist',
];

/**
 * The exact tools of the lead (sorted equality): the engineering lead's set minus `Workflow`, `ReportFindings` and `LSP` (reasons in the next test), with the
 * `Agent` allowlist of the eight design types and the seven servers each under its plugin or connector route.
 */
const EXPECTED_TOOLS = [
  `Agent(${DESIGN_TYPES.join(', ')})`,
  'Artifact', 'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'Edit', 'EnterWorktree', 'ExitWorktree', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor',
  'NotebookEdit', 'PowerShell', 'PushNotification', 'Read', 'ReadMcpResourceTool', 'RemoteTrigger', 'ScheduleWakeup', 'SendMessage', 'SendUserFile', 'Skill', 'TaskCreate',
  'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WaitForMcpServers', 'WebFetch', 'WebSearch', 'Write',
  ...withRoutes(['mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__figma', 'mcp__firecrawl', 'mcp__github', 'mcp__playwright', 'mcp__stitch']),
  'mcp__claude_ai_Claude_Docs',
];

/** The one sentence every Claude role carries about the guard (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';

describe('native orchestrator-design: the guard claim', () => {
  it('carries the one guard sentence once, in the step that says to branch first', () => {
    expect(text().split(GUARD_SENTENCE)).toHaveLength(2);
    expect(text()).toContain(`branch first. ${GUARD_SENTENCE}`);
    expect(text()).not.toMatch(/guard blocks forced pushes and/);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-orchestrator-design-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'orchestrator-design' }).blocked;

    it.each(['vercel --prod', 'git push --force origin main', 'rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'az group delete --name g --yes'])('blocks the shell command %s, as the sentence says', command => {
      expect(blocked('Bash', { command })).toBe(true);
    });

    it.each(['git status', 'npm test', 'git push origin feature/x', 'rm -rf node_modules'])('does not block the ordinary command %s', command => {
      expect(blocked('Bash', { command })).toBe(false);
    });

    it('blocks a PowerShell recursive delete of the home folder, and a write of .env, but not .env.example or a design file', () => {
      expect(blocked('PowerShell', { command: 'Remove-Item -Recurse -Force $HOME' })).toBe(true);
      expect(blocked('Write', { file_path: path.join(project, '.env') })).toBe(true);
      expect(blocked('Write', { file_path: path.join(project, '.env.example') })).toBe(false);
      expect(blocked('Write', { file_path: path.join(project, 'docs/design/brief.md') })).toBe(false);
    });
  });
});

describe('native orchestrator-design: its tools', () => {
  it('holds exactly this tools set, so a stray tool fails', () => {
    expect([...tools()].sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('may spawn exactly the eight design types of its domain, through an Agent allowlist and never a bare Agent', () => {
    expect(tools().filter(tool => tool.startsWith('Agent'))).toEqual([allowlist(BUNDLE)]);
    expect(tools()).not.toContain('Agent');
    expect(domainTypes(bundles(), BUNDLE).map(type => type.name)).toEqual(DESIGN_TYPES);
    expect(allowlist(BUNDLE)).toBe(`Agent(${DESIGN_TYPES.join(', ')})`);
  });

  it('holds neither Workflow, ReportFindings nor LSP, each for a stated reason', () => {
    // Workflow: the design bundles ship no saved workflow, so the lead fans work out with parallel `Agent` calls.
    // ReportFindings: structured findings belong to a reviewer; the lead synthesises the specialists' reports in its own output contract.
    // LSP: the lead writes no code; implementation goes to specialists.
    for (const absent of ['Workflow', 'ReportFindings', 'LSP']) expect(names(), absent).not.toContain(absent);
    expect(text()).toMatch(/design bundles ship no saved workflow/);
  });

  it('holds Playwright, a server beyond the canonical lead, because prototype-tester declares it', () => {
    // A decision beyond the canonical `orchestrator-design`, which declares six servers (stitch, figma,
    // chrome-devtools-mcp, context7, firecrawl, github). `prototype-tester` declares `playwright`, and a role's server works only if its lead holds it too.
    const canonicalLead = fs.readFileSync(path.resolve('registry/agents/orchestrator-design.md'), 'utf8');
    expect([...canonicalLead.matchAll(/^ {2}- name: (\S+)$/gm)].map(match => match[1]).sort()).toEqual(['chrome-devtools-mcp', 'context7', 'figma', 'firecrawl', 'github', 'stitch']);
    expect(tools()).toEqual(expect.arrayContaining(['mcp__playwright', 'mcp__plugin_playwright_playwright']));
  });

  it('holds every server that a design role holds, native or still canonical', () => {
    const held = new Set(tools().filter(tool => tool.startsWith('mcp__')).map(integrationOf));
    for (const type of DESIGN_TYPES) {
      for (const server of serversOf(type)) expect(held.has(server), `${type} declares ${server}`).toBe(true);
      const file = path.join(NATIVE_AGENTS_DIR, `${type}.md`);
      if (!fs.existsSync(file)) continue;
      const front = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))![1]!) as { tools: string };
      for (const tool of splitTools(front.tools).filter(entry => entry.startsWith('mcp__'))) expect(held.has(integrationOf(tool)), `${type}: ${tool}`).toBe(true);
    }
  });

  it('holds each server under its manual name and its plugin or connector route, so a plugin-delivered server is usable', () => {
    for (const grant of withRoutes(['mcp__figma', 'mcp__stitch', 'mcp__playwright', 'mcp__firecrawl', 'mcp__context7', 'mcp__github', 'mcp__chrome-devtools-mcp'])) expect(tools(), grant).toContain(grant);
    expect(tools()).toContain('mcp__plugin_figma_figma');
    expect(tools()).toContain('mcp__claude_ai_Firecrawl');
  });
});

describe('native orchestrator-design: no image tool, no mode line', () => {
  it('binds no image tool and says so in one place', () => {
    expect(tools().filter(tool => /image/i.test(tool))).toEqual([]);
    expect(text()).not.toMatch(/generate_image|mcp__image-gen/);
    const sentence = 'You have no image-generation tool on this host.';
    expect(text().split(sentence)).toHaveLength(2);
    expect(text()).toMatch(/Never describe a placeholder as a generated image\./);
  });

  it('is a domain lead: no Operation Mode line and no mode-line gate hook (ADR 0053 covers organization leads only)', () => {
    expect(text()).not.toMatch(/Operation Mode|mode line/i);
    expect(text()).not.toContain('agents-united-mode-line-gate.js');
    expect(text()).toContain('agents-united-guard.js');
  });

  it('holds the posture of a native coordinator: opus, medium effort, acceptEdits', () => {
    expect([frontmatter().model, frontmatter().effort, frontmatter().permissionMode]).toEqual(['opus', 'medium', 'acceptEdits']);
    expect(frontmatter().skills ?? []).toEqual([]);
  });
});

describe('native orchestrator-design: its domain map', () => {
  it('carries the roster exactly as generated from the bundles and the native agents', () => {
    expect(checkRoster(text(), rosterTypes(BUNDLE))).toEqual([]);
  });

  it('names every design type in the map with the bundle that provides it', () => {
    for (const type of domainTypes(bundles(), BUNDLE)) {
      expect(text(), type.name).toContain(`| \`${type.name}\` | ${type.bundles.map(bundle => `\`${bundle}\``).join(', ')} |`);
    }
  });

  it('keeps frontend-architect and accessibility-lead out of the roster and reaches them through the cross-bundle table with the agents add hand-back', () => {
    const [before, after] = text().split('<!-- agents-united:roster:end -->') as [string, string];
    for (const type of ['frontend-architect', 'accessibility-lead']) {
      expect(tools().some(tool => tool.startsWith('Agent(') && tool.includes(type)), type).toBe(false);
      expect(before.includes(`| \`${type}\` |`), `${type} in the generated roster`).toBe(false);
    }
    const row = (needle: string): string => after.split('\n').find(line => line.startsWith('|') && line.includes(needle)) ?? '';
    expect(row('`frontend-architect`')).toContain('`agents add frontend-engineering`');
    expect(row('`accessibility-lead`')).toContain('`agents add frontend-engineering`');
    expect(after).toContain('`agents add performance-paid-acquisition`');
    expect(after).toContain('`agents add product-led-growth`');
    expect(after).toContain('`agents add domain:design`');
    expect(after).toMatch(/hand that work back to the user with the `agents add` line/);
    expect(after).toMatch(/you never pretend to have done it or improvise a specialist/);
  });

  it('tells the user how to install a missing type and refresh the running session', () => {
    expect(text()).toContain('agents add <bundle>');
    expect(text()).toContain('/reload-skills');
  });

  it('refers only to slash commands that exist as skills, and to bundles that exist', () => {
    for (const match of withoutPublishingBlock(text()).matchAll(/`\/([a-z0-9-]+)`/g)) {
      if (match[1] === 'reload-skills' || match[1] === 'config') continue;
      expect(fs.existsSync(path.resolve('registry/skills', match[1]!, 'SKILL.md')), `/${match[1]}`).toBe(true);
    }
    for (const match of text().matchAll(/agents add ([a-z][a-z0-9:-]*)/g)) {
      const name = match[1]!.replace(/^domain:/, '');
      expect(match[1]!.startsWith('domain:') || Object.keys(bundles()).includes(name), `agents add ${match[1]}`).toBe(true);
    }
  });
});

describe('native orchestrator-design: what it says it does', () => {
  it('states that it must run as the main thread, and what it does when it cannot', () => {
    expect(text()).toContain('claude --agent orchestrator-design');
    expect(text()).toMatch(/AskUserQuestion (is|are) not available/);
  });

  it('checks every server a slice needs with ToolSearch before delegating, names a missing one, and never asks for or writes a key', () => {
    const body = text();
    for (const server of ['Stitch', 'Figma', 'Playwright', 'Chrome DevTools', 'Firecrawl']) expect(body, server).toContain(server);
    expect(body).toContain('`ToolSearch`');
    expect(body).toMatch(/never ask(s)? for a key or write(s)? one/);
    expect(body).toMatch(/only the servers you hold and that are connected/);
  });

  it('runs the consult gate with its bounds and records a consult or a waiver', () => {
    const body = text();
    expect(body).toMatch(/1 to 3 relevant specialists, read-only/);
    expect(body).toMatch(/at most 2 directed questions per pair/);
    expect(body).toMatch(/at most 2 planning rounds/);
    expect(body).toMatch(/at most 1000 words per consult/);
    expect(body).toMatch(/Record who you consulted or the waiver/);
  });

  it('audits accessibility and responsiveness before delivering, through a specialist, and checks the evidence', () => {
    const body = text();
    expect(body).toMatch(/accessibility and responsive audit/i);
    expect(body).toMatch(/you check the evidence/i);
  });

  it('says truthfully who holds the accessibility audit when product-design stands alone, and that frontend-architect has two providers', () => {
    const body = text();
    expect(body).toMatch(/no native specialist holds an accessibility audit/);
    expect(body).toMatch(/`accessibility-lead` when its Bundle is installed, otherwise to `ui-designer` for layout and contrast by calculation/);
    expect(body).toMatch(/the report names what stayed unmeasured/);
    expect(body).toContain('`frontend-architect`, from `frontend-engineering` (software-engineering also provides it)');
  });

  it('states the four boundary constraints of the canonical lead and the design duties, none dropped', async () => {
    const core = fs.readFileSync(path.resolve('registry/core/orchestrator-design.core.md'), 'utf8').replace(/\r\n/g, '\n');
    for (const needle of ['Forbidden Cliché Tropes', 'Accessibility Mandatory', 'Hardware-Accelerated Motion', 'Responsive Math', 'Subagent-first delegation', 'Consult gate', 'Plan solo, delegate execution']) {
      expect(core, needle).toContain(needle);
    }
    expect(core).toMatch(/clamp\(\)/);
    expect(core).toMatch(/transform and opacity/);
    expect(core).toMatch(/7:1/);
  });

  it('keeps the session task tracking section', () => {
    expect(text()).toContain('## Session task tracking');
  });
});
