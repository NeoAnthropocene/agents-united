import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationOf } from '../src/core/claude-mcp-routes.js';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, preToolUseGroups } from './helpers/claude-host-hooks.js';
import { withoutPublishingBlock } from './helpers/artifact-holders.js';
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The growth-marketing lead `orchestrator-marketing` (growth-marketing): what its authored body and its tools line must keep saying, beyond the checks every native agent gets in
 * native-claude-agents.test.ts and the ones every coordinator gets in native-orchestrator.test.ts. It is the Tier 1 form of `orchestrator-engineering`, not the digital agency's:
 * no mode line, no mode-line gate, no Agent Teams, no personas, and no saved workflows (the `workflow-marketing-*` skills are used through `Skill`).
 */

const BUNDLE = 'growth-marketing';
const NINE = [
  'lifecycle-email-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer',
  'marketing-growth-strategist', 'paid-acquisition-specialist', 'plg-strategist', 'seo-specialist',
];
/** The shared guard sentence every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to a `.env` path the guard recognises in the command text, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';
const text = (): string => nativeText('orchestrator-marketing');
const meta = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]!);
const tools = (): string[] => splitTools(meta().tools);
const toolNames = (): string[] => tools().map(tool => tool.split('(')[0]!);
const body = (): string => text().split('<!-- agents-united:floor:end -->')[1]!;
/** A `##` section of the file, from its heading to the next `##`. */
const section = (heading: string): string => new RegExp(`\\n## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';

describe('native orchestrator-marketing: posture and tools', () => {
  it('is pinned to the coordinator posture, with the permission mode of its canonical agent', () => {
    expect(meta().name).toBe('orchestrator-marketing');
    expect([meta().model, meta().effort, meta().permissionMode]).toEqual(['opus', 'medium', 'acceptEdits']);
    const canonical = /^permissionMode: (.+)$/m.exec(fs.readFileSync(path.resolve('registry/agents/orchestrator-marketing.md'), 'utf8').replace(/\r\n/g, '\n'))?.[1];
    expect(meta().permissionMode).toBe(canonical);
    expect(meta().skills ?? []).toEqual([]);
  });

  it('may spawn exactly the nine specialist types of the marketing domain, through an allowlist and never a bare Agent', () => {
    expect(tools().filter(tool => tool.startsWith('Agent'))).toEqual([allowlist(BUNDLE)]);
    expect(toolNames().filter(tool => tool === 'Agent')).toHaveLength(1);
    expect(tools()).not.toContain('Agent');
    const listed = /^Agent\((.*)\)$/.exec(tools().find(tool => tool.startsWith('Agent('))!)![1]!.split(', ');
    expect(listed).toEqual(NINE);
    expect(domainTypes(bundles(), BUNDLE).map(type => type.name)).toEqual(NINE);
  });

  it('carries the domain map exactly as generated, and calls no child role not native yet, since every specialist type has a native file now', () => {
    expect(checkRoster(text(), rosterTypes(BUNDLE))).toEqual([]);
    expect(text()).not.toMatch(/Not yet a native agent/);
    for (const type of NINE) {
      const row = text().split('\n').find(line => line.startsWith(`| \`${type}\` |`)) ?? '';
      expect(row, type).not.toMatch(/Not yet a native agent/);
    }
  });

  it('holds the union of the servers its roles\' canonical agents declare, which goes beyond its own canonical agent by a decision made during the roll-out', () => {
    // Beyond the canonical lead (firecrawl, markitdown, context7, github): stitch, figma, playwright and chrome-devtools-mcp, which its roles' canonical agents declare. This was decided during the roll-out
    // (2026-11-20) and is open to the maintainer's review. The reason is the host's rule that a subagent gets the MCP tools of the main conversation, and the main conversation of `--agent` is cut to this list (Sitting T).
    const servers = (file: string): string[] => {
      const front = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.resolve('registry/agents', file), 'utf8').replace(/\r\n/g, '\n'))![1]!) as { mcpServers?: Array<{ name: string } | string> };
      return (front.mcpServers ?? []).map(entry => (typeof entry === 'string' ? entry : entry.name));
    };
    const union = new Set([...servers('orchestrator-marketing.md'), ...NINE.flatMap(type => servers(`subagent-${type}.md`))]);
    expect([...union].sort()).toEqual(['chrome-devtools-mcp', 'context7', 'figma', 'firecrawl', 'github', 'image-gen', 'markitdown', 'playwright', 'stitch']);
    const held = new Set(tools().filter(tool => tool.startsWith('mcp__')).map(integrationOf));
    // The Claude Docs connector (ADR 0078) is held for the Docs and Sheets types of the roles it spawns; no canonical agent declares it.
    expect([...held].sort()).toEqual([...union, 'claude_ai_Claude_Docs'].sort());
    expect(servers('orchestrator-marketing.md').sort()).toEqual(['context7', 'firecrawl', 'github', 'markitdown']);
  });

  it('holds the one image tool and not the image server, no saved-workflow tool, no code intelligence, no structured findings and no worktree tool', () => {
    expect(tools().filter(tool => /image/i.test(tool))).toEqual(['mcp__image-gen__generate_image']);
    for (const absent of ['Workflow', 'LSP', 'ReportFindings', 'EnterWorktree', 'ExitWorktree']) expect(toolNames(), absent).not.toContain(absent);
    for (const present of ['Agent', 'Artifact', 'AskUserQuestion', 'Bash', 'CronCreate', 'Edit', 'Monitor', 'SendMessage', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write']) {
      expect(toolNames(), present).toContain(present);
    }
  });
});

describe('native orchestrator-marketing: the image tool is held for its creative designer (ADR 0079)', () => {
  it('says that it holds the one image tool so that its creative designer\'s tool pool has it, never calls it, and passes on only the go of the user', () => {
    const boundaries = section('Boundaries of this host');
    expect(boundaries).toContain('You hold the one image tool `mcp__image-gen__generate_image` of the optional `image-gen` server so that the creative designer\'s tool pool has it');
    expect(boundaries).toMatch(/never call it/);
    expect(boundaries).toMatch(/pass on the user's go, naming the images, the provider and the size, and never give one yourself/);
    expect(boundaries).toMatch(/installing the server is the user's own act and not part of this department's setup/i);
    expect(boundaries).toMatch(/image brief/);
  });

  it('no longer says that no image tool is bound, in its Boundaries or in the roster row of its creative designer', () => {
    expect(text()).not.toMatch(/no image-generation tool is bound|No image tool is bound/i);
    const row = text().split('\n').find(line => line.startsWith('| `marketing-creative-designer` |')) ?? '';
    expect(row).toMatch(/photos only via the optional image server/i);
    expect(row).toContain('MCP: figma, image-gen, stitch');
  });
});

describe('native orchestrator-marketing: the Tier 1 form, not the digital agency\'s', () => {
  it('has no mode line, no mode-line gate hook, no Agent Teams, no team protocol and no persona', () => {
    expect(text()).not.toMatch(/mode line|Operation Mode|agents-united-mode-line-gate|Agent Team protocol/i);
    expect(JSON.stringify(preToolUseGroups(text()))).not.toContain('mode-line-gate');
    expect(text()).not.toMatch(/digital agency|Chris\b|Campaign Director|shutdown_request/i);
    expect(text()).not.toMatch(/CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/);
    expect(section('Boundaries of this host')).toMatch(/Agent Teams are experimental/);
  });

  it('carries the one guard of a writer and nothing else: a PreToolUse group for the shells and one for the editors', () => {
    const groups = preToolUseGroups(text());
    expect(groups.map(group => group.matcher)).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
  });

  it('states where it runs and what it does as a subagent, and Step 0 reads the install record and gives the reload command', () => {
    expect(text()).toContain('claude --agent orchestrator-marketing');
    expect(text()).toContain('agents start --host claude');
    expect(section('How this agent runs')).toMatch(/spawned as a subagent/);
    const step0 = section('Step 0: what is installed');
    expect(step0).toContain('.claude/.agents-united/agents-united.json');
    expect(step0).toContain('agents add <bundle>');
    expect(step0).toContain('/reload-skills');
  });

  it('delegates every marketing deliverable and has a session task tracking section in the coordinator form', () => {
    expect(text()).toMatch(/You delegate every marketing deliverable to a specialist/);
    const tracking = section('Session task tracking');
    expect(tracking).toMatch(/take its ID from the actual tool result/i);
    expect(tracking).toMatch(/already accepted map/i);
    expect(tracking).toContain('`TodoWrite`');
    expect(text().indexOf('## Session task tracking')).toBeGreaterThan(text().indexOf('## Verify before delivering'));
  });
});

describe('native orchestrator-marketing: the sub-bundle recommendations are the real bundles', () => {
  const table = (): string[] => body().split('\n').filter(line => line.startsWith('| ') && /agents add /.test(line));

  it('gives each recommended sub-bundle with exactly the agents bundles.json lists for it, and the whole suite as domain:marketing', () => {
    const defs = bundles();
    expect(defs[BUNDLE].recommendedAddons).toEqual(['seo-content-marketing', 'performance-paid-acquisition', 'product-led-growth', 'lifecycle-email-marketing']);
    for (const addon of defs[BUNDLE].recommendedAddons as string[]) {
      const row = table().find(line => line.includes(`\`${addon}\``));
      expect(row, addon).toBeDefined();
      expect(row, addon).toContain(`agents add ${addon}`);
      const agents = (defs[addon].agents as string[]).map(file => file.replace(/\.md$/, '').replace(/^subagent-/, ''));
      for (const agent of agents) expect(row, `${addon}: ${agent}`).toContain(`\`${agent}\``);
      // No agent that the bundle does not have.
      for (const other of NINE.filter(name => !agents.includes(name))) expect(row, `${addon}: ${other}`).not.toContain(`\`${other}\``);
    }
    expect(table().some(line => line.includes('agents add domain:marketing'))).toBe(true);
  });

  it('recommends the frontend-engineering Bundle, with its frontend architect, for the frontend implementation the department hands off', () => {
    const row = table().find(line => line.includes('`frontend-engineering`'));
    expect(row).toBeDefined();
    expect(row).toContain('Frontend implementation of a page the department specified (pages, components, design tokens).');
    expect(row).toContain("You cannot spawn this Bundle's types: the user installs it, the page is built under `orchestrator-engineering` or the user's implementation team, and you hand over the tokens and props under `Open items`");
    expect(row).toContain('agents add frontend-engineering');
    expect(row).toContain('`frontend-architect`, `accessibility-lead`');
    expect(bundles()['frontend-engineering'].agents).toEqual(['subagent-frontend-architect.md', 'subagent-accessibility-lead.md']);
  });
});

describe('native orchestrator-marketing: the skills it names', () => {
  it('names only slash commands that are skills of the growth-marketing bundle (or host commands), and each skill exists', () => {
    const skills = new Set(bundles()[BUNDLE].skills as string[]);
    const named = [...withoutPublishingBlock(body()).matchAll(/`\/([a-z0-9-]+)`/g)].map(match => match[1]!).filter(name => name !== 'reload-skills' && name !== 'config');
    expect(named.length).toBeGreaterThan(5);
    for (const name of named) {
      expect(skills.has(name), `/${name} is not a skill of ${BUNDLE}`).toBe(true);
      expect(fs.existsSync(path.resolve('registry/skills', name, 'SKILL.md')), `/${name}`).toBe(true);
    }
    for (const required of ['grill-me', 'handoff', 'workflow-marketing-panel', 'workflow-marketing-audit', 'workflow-marketing-campaign-builder', 'workflow-marketing-content-pipeline', 'workflow-marketing-growth-experiment', 'workflow-marketing-launch']) {
      expect(named, required).toContain(required);
    }
  });
});

describe('native orchestrator-marketing: verification and the guard, against the real guard script', () => {
  const verify = (): string => section('Verify before delivering');

  it('keeps the guardrails of its canonical agent in the verify step', () => {
    expect(verify()).toMatch(/\*\*Authentic messaging\.\*\*/);
    expect(verify()).toMatch(/\*\*One call to action\.\*\*/);
    expect(verify()).toContain('under 60 characters');
    expect(verify()).toContain('under 155 characters');
    expect(verify()).toContain('OpenGraph');
    expect(verify()).toMatch(/GDPR and CAN-SPAM/);
    expect(verify()).toContain('git status');
    expect(verify()).toMatch(/`main`, `master`, `production` or `release\/\*`/);
  });

  it('says exactly what the bound guard blocks, and that everything else is its own obligation', () => {
    expect(verify().split(GUARD_SENTENCE)).toHaveLength(2);
    expect(verify()).toMatch(/Nothing else is enforced by a hook/);
    expect(verify()).not.toMatch(/guard blocks[^.]*production deploys/);
  });

  it('routes campaign email to the campaign specialist and behaviour-triggered lifecycle email to the lifecycle email specialist, one owner each', async () => {
    const line = /^7\. \*\*Subagent delegation and campaign execution\.\*\*.*$/m.exec(text())?.[0] ?? '';
    const route = 'product launch announcements, campaign email (launch announcements and the nurture drips of a campaign) and PR press kits to the campaign specialist; behaviour-triggered lifecycle email (welcome onboarding, inactivity re-engagement, upgrade nudges, milestone and retention journeys) to the lifecycle email specialist, and the campaign specialist does not design those journeys';
    expect(line).toContain(route);
    expect(line).not.toContain('email sequences');
    const core = (await loadSemanticCore('registry')).get('orchestrator-marketing')!;
    expect(core.scope_boundaries).toContain(route);
  });

  describe('the guard', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-marketing-lead-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'orchestrator-marketing' }).blocked;

    it.each(['git push --force origin main', 'vercel --prod', 'rm -rf /', 'rm -rf $HOME', 'sudo ls', 'shutdown now'])('blocks %s through Bash, as the verify step says', command => {
      expect(blocked('Bash', { command })).toBe(true);
    });

    it.each(['git push --force origin main', 'vercel --prod', 'Remove-Item -Recurse -Force C:\\'])('blocks %s through PowerShell, as the verify step says', command => {
      expect(blocked('PowerShell', { command })).toBe(true);
    });

    it('blocks a .env write through the other editors the lead holds', () => {
      expect(blocked('Edit', { file_path: 'C:\\repo\\.env' })).toBe(true);
      expect(blocked('NotebookEdit', { notebook_path: 'C:\\repo\\.env' })).toBe(true);
    });

    it('blocks a write to .env and lets .env.example through', () => {
      expect(blocked('Write', { file_path: 'C:\\repo\\.env' })).toBe(true);
      expect(blocked('Write', { file_path: 'C:\\repo\\.env.example' })).toBe(false);
    });

    it('does not block a commit to main, a deploy, a lease push or a recursive delete of a build folder, so the verify step does not claim it', () => {
      for (const command of ['git commit -m x', 'terraform apply', 'git push --force-with-lease', 'rm -rf build']) expect(blocked('Bash', { command }), command).toBe(false);
      expect(blocked('PowerShell', { command: 'Remove-Item -Recurse -Force build' })).toBe(false);
    });
  });
});

describe('native orchestrator-marketing: the shared pair', () => {
  it('keeps every numbered directive and the four guardrails of the canonical agent in scope_boundaries, and the git guardrail in safety', async () => {
    const core = (await loadSemanticCore('registry')).get('orchestrator-marketing')!;
    for (const part of [
      'Authentic Messaging', 'Conversion-Driven Structure', 'SEO Standards', 'Data Privacy & Compliance',
      'at least one relevant specialist', 'unless the user explicitly waives it', 'at most 2 directed questions per specialist pair', 'at most 2 planning rounds', 'at most 1000 words per consult',
      'single call-to-action', 'under 60 characters', 'under 155 characters', 'OpenGraph', 'GDPR', 'CAN-SPAM',
      'objective', 'scope', 'acceptance evidence', 'peers', 'report format', 'Peer messages received', 'Open items', 'contract first', 'installed',
    ]) {
      expect(core.scope_boundaries.toLowerCase(), part).toContain(part.toLowerCase());
    }
    expect(core.safety).toContain('/git-guardrails');
    expect(core.safety).toContain('host-agent-router');
    expect(core.capabilities).toEqual(expect.arrayContaining(['delegate', 'ask-user', 'messaging', 'task-tracking', 'shell', 'edit']));
    for (const left of ['workflow', 'code-intel', 'report', 'worktree']) expect(core.capabilities, left).not.toContain(left);
  });
});
