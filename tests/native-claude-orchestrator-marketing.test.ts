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
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The growth-marketing lead `orchestrator-marketing` (n5, slice 1): what its authored body and its tools line must keep saying, beyond the checks every native agent gets in
 * native-claude-agents.test.ts and the ones every coordinator gets in native-orchestrator.test.ts. It is the Tier 1 form of `orchestrator-engineering`, not the digital agency's:
 * no mode line, no mode-line gate, no Agent Teams, no personas, and no saved workflows (the `workflow-marketing-*` skills are used through `Skill`).
 */

const BUNDLE = 'growth-marketing';
const NINE = [
  'lifecycle-email-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer',
  'marketing-growth-strategist', 'paid-acquisition-specialist', 'plg-strategist', 'seo-specialist',
];
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

  it('carries the domain map exactly as generated, and says plainly that the two child roles without a native file are not native yet', () => {
    expect(checkRoster(text(), rosterTypes(BUNDLE))).toEqual([]);
    for (const type of ['lifecycle-email-specialist', 'plg-strategist']) {
      expect(text(), type).toMatch(new RegExp(`\\| \`${type}\` \\|[^\\n]*Not yet a native agent`));
    }
    for (const type of NINE.filter(name => name.startsWith('marketing-') || name === 'seo-specialist' || name === 'paid-acquisition-specialist')) {
      const row = text().split('\n').find(line => line.startsWith(`| \`${type}\` |`)) ?? '';
      expect(row, type).not.toMatch(/Not yet a native agent/);
    }
  });

  it('holds the union of the servers its roles\' canonical agents declare, which goes beyond its own canonical agent on the master operator\'s decision', () => {
    // Beyond the canonical lead (firecrawl, markitdown, context7, github): stitch, figma, playwright and chrome-devtools-mcp, which its roles' canonical agents declare. This is the master operator's
    // decision of 2026-11-20. The reason is the host's rule that a subagent gets the MCP tools of the main conversation, and the main conversation of `--agent` is cut to this list (Sitting T).
    const servers = (file: string): string[] => {
      const front = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.resolve('registry/agents', file), 'utf8').replace(/\r\n/g, '\n'))![1]!) as { mcpServers?: Array<{ name: string } | string> };
      return (front.mcpServers ?? []).map(entry => (typeof entry === 'string' ? entry : entry.name));
    };
    const union = new Set([...servers('orchestrator-marketing.md'), ...NINE.flatMap(type => servers(`subagent-${type}.md`))]);
    expect([...union].sort()).toEqual(['chrome-devtools-mcp', 'context7', 'figma', 'firecrawl', 'github', 'markitdown', 'playwright', 'stitch']);
    const held = new Set(tools().filter(tool => tool.startsWith('mcp__')).map(integrationOf));
    expect([...held].sort()).toEqual([...union].sort());
    expect(servers('orchestrator-marketing.md').sort()).toEqual(['context7', 'firecrawl', 'github', 'markitdown']);
  });

  it('holds no image server and no image tool, no saved-workflow tool, no code intelligence, no structured findings and no worktree tool', () => {
    expect(tools().filter(tool => /image/i.test(tool))).toEqual([]);
    for (const absent of ['Workflow', 'LSP', 'ReportFindings', 'EnterWorktree', 'ExitWorktree', 'Artifact']) expect(toolNames(), absent).not.toContain(absent);
    for (const present of ['Agent', 'AskUserQuestion', 'Bash', 'CronCreate', 'Edit', 'Monitor', 'SendMessage', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write']) {
      expect(toolNames(), present).toContain(present);
    }
  });
});

describe('native orchestrator-marketing: no image generation', () => {
  it('says in plain words that no image-generation tool is bound in this lane, and what to do instead', () => {
    expect(section('Boundaries of this host')).toContain('No image-generation tool is bound in this lane');
    expect(section('Boundaries of this host')).toMatch(/briefs|outside the session/);
    expect(text()).not.toMatch(/\bimage-gen\b|generate_image/);
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
});

describe('native orchestrator-marketing: the skills it names', () => {
  it('names only slash commands that are skills of the growth-marketing bundle (or host commands), and each skill exists', () => {
    const skills = new Set(bundles()[BUNDLE].skills as string[]);
    const named = [...body().matchAll(/`\/([a-z0-9-]+)`/g)].map(match => match[1]!).filter(name => name !== 'reload-skills' && name !== 'config');
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
    expect(verify()).toContain('A guard blocks forced pushes, `vercel --prod` and `.env` writes');
    expect(verify()).toMatch(/Nothing else is enforced by a hook/);
    expect(verify()).not.toMatch(/guard blocks[^.]*(production deploys|destructive)/);
  });

  describe('the guard', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-marketing-lead-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: 'orchestrator-marketing' }).blocked;

    it.each(['git push --force origin main', 'vercel --prod'])('blocks %s, as the verify step says', command => {
      expect(blocked('Bash', { command })).toBe(true);
    });

    it('blocks a write to .env and lets .env.example through', () => {
      expect(blocked('Write', { file_path: 'C:\\repo\\.env' })).toBe(true);
      expect(blocked('Write', { file_path: 'C:\\repo\\.env.example' })).toBe(false);
    });

    it('does not block a commit to main, a deploy, or a data-erasing shell command, so the verify step does not claim it', () => {
      for (const command of ['git commit -m x', 'terraform apply', 'rm -rf build']) expect(blocked('Bash', { command }), command).toBe(false);
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
