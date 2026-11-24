import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationOf, withRoutes } from '../src/core/claude-mcp-routes.js';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { withoutPublishingBlock } from './helpers/artifact-holders.js';
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * The native `orchestrator-business` (business-strategy bundle, Tier 1, a DOMAIN lead run as the main thread): what its authored body must keep saying, and the exact
 * tools it holds. It is cut from the system-architecture lead for a department whose work is documents: no saved workflow, no code intelligence, no reviewer and no
 * worktree. It delegates every deliverable and writes only the synthesis brief, and it checks every figure it passes on. Every claim about a tool, a server or a guard
 * has to be true of what is bound, and the claims about the guard are fired at the real script.
 */

const ROLE = 'orchestrator-business';
const BUNDLE = 'business-strategy';
const text = (): string => nativeText(ROLE);
// The generated requests block (ADR 0076) is not authored text: scans of the authored wording leave it out.
const withoutRequests = (value: string): string => value.replace(/<!-- agents-united:requests:start[^>]*-->[\s\S]*?<!-- agents-united:requests:end -->\n?/, '');
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]!);
const tools = (): string[] => splitTools(String(frontmatter().tools));
const names = (): string[] => tools().map(tool => tool.split('(')[0]!);
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())![1]!.trim();
const canonicalLead = (): string => fs.readFileSync(path.resolve('registry/agents/orchestrator-business.md'), 'utf8').replace(/\r\n/g, '\n');
const canonicalAgent = (type: string): string => fs.readFileSync(path.resolve(`registry/agents/subagent-${type}.md`), 'utf8').replace(/\r\n/g, '\n');
const serversOf = (source: string): string[] => [...source.matchAll(/^ {2}- name: (\S+)$/gm)].map(match => match[1]!);
const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const BUSINESS_TYPES = ['business-panel-experts', 'financial-analyst', 'legal-contract-analyst', 'market-intelligence-analyst', 'operations-strategist'];

/**
 * The exact tools of the lead (sorted equality): the system-architecture lead's set minus `Workflow`, `LSP`, `ReportFindings`, `EnterWorktree` and `ExitWorktree` (reasons in the
 * test that names them), with the `Agent` allowlist of the five business types and the four servers of the canonical lead, each under its plugin or connector route.
 */
const EXPECTED_TOOLS = [
  `Agent(${BUSINESS_TYPES.join(', ')})`,
  'Artifact', 'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'PowerShell',
  'PushNotification', 'Read', 'ReadMcpResourceTool', 'RemoteTrigger', 'ScheduleWakeup', 'SendMessage', 'SendUserFile', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop',
  'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WaitForMcpServers', 'WebFetch', 'WebSearch', 'Write',
  ...withRoutes(['mcp__markitdown', 'mcp__context7', 'mcp__firecrawl', 'mcp__github']),
  'mcp__claude_ai_Claude_Docs',
];

/** The one sentence every Claude role carries about the guard (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` or `>>` redirect to a `.env` path the guard recognises in the command text, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';
/** The boundary the legal contract analyst states of itself, copied from its canonical agent, and carried by the lead wherever its synthesis uses that analysis. */
const LEGAL_BOUNDARY = 'structured technical and operational contract analysis to support business decision-making, not formal legal representation or binding legal counsel';

describe('native orchestrator-business: its tools', () => {
  it('holds exactly this tools set, so a stray tool fails', () => {
    expect([...tools()].sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('may spawn exactly the five business types of its domain, through an Agent allowlist and never a bare Agent', () => {
    expect(tools().filter(tool => tool.startsWith('Agent'))).toEqual([allowlist(BUNDLE)]);
    expect(tools()).not.toContain('Agent');
    expect(domainTypes(bundles(), BUNDLE).map(type => type.name)).toEqual(BUSINESS_TYPES);
    expect(allowlist(BUNDLE)).toBe(`Agent(${BUSINESS_TYPES.join(', ')})`);
  });

  it('holds none of Workflow, LSP, ReportFindings, EnterWorktree and ExitWorktree, each for a stated reason', () => {
    // Workflow: no bundle of the business domain installs a saved workflow, so the lead fans work out with parallel `Agent` calls.
    // LSP: the lead writes no code. ReportFindings: structured findings belong to a reviewer and the department has none.
    // EnterWorktree and ExitWorktree: the work is documents, as on the marketing and agency leads.
    for (const absent of ['Workflow', 'LSP', 'ReportFindings', 'EnterWorktree', 'ExitWorktree']) expect(names(), absent).not.toContain(absent);
    expect(text()).toMatch(/The business bundles ship no saved workflow/);
    expect(text()).toMatch(/no code-intelligence tool and no worktree tool/);
    expect(withoutRequests(text())).not.toContain('`Workflow`');
    for (const name of ['workflow-review', 'workflow-implement', 'workflow-test']) expect(bundles()[BUNDLE].skills, name).not.toContain(name);
  });

  it('keeps the shell, the editors, the question tool, the watchers, the task tools and the web', () => {
    for (const kept of ['AskUserQuestion', 'Bash', 'PowerShell', 'Read', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Monitor', 'ScheduleWakeup', 'CronCreate', 'CronList', 'CronDelete', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop', 'TodoWrite', 'SendMessage', 'Skill', 'ToolSearch'])
      expect(names(), kept).toContain(kept);
  });

  it('holds the four servers of the canonical lead and no other, each under its manual name and its plugin or connector route', () => {
    expect(serversOf(canonicalLead()).sort()).toEqual(['context7', 'firecrawl', 'github', 'markitdown']);
    const held = tools().filter(tool => tool.startsWith('mcp__'));
    expect([...new Set(held.map(integrationOf))].sort()).toEqual(['claude_ai_Claude_Docs', 'context7', 'firecrawl', 'github', 'markitdown']);
    for (const grant of withRoutes(['mcp__markitdown', 'mcp__context7', 'mcp__firecrawl', 'mcp__github'])) expect(tools(), grant).toContain(grant);
  });

  it('holds every server that a business role holds, so that a role it spawns gets it (a subagent inherits the main conversation\'s tools)', () => {
    const held = tools().filter(tool => tool.startsWith('mcp__'));
    const covers = (wanted: string): boolean => held.some(entry => entry === wanted || wanted.startsWith(`${entry}__`));
    const heldServers = new Set(held.map(integrationOf));
    for (const type of BUSINESS_TYPES) {
      for (const server of serversOf(canonicalAgent(type))) expect(heldServers.has(server), `${type} declares ${server}`).toBe(true);
      const file = path.join(NATIVE_AGENTS_DIR, `${type}.md`);
      if (!fs.existsSync(file)) continue;
      const front = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))![1]!) as { tools: string };
      for (const tool of splitTools(front.tools).filter(entry => entry.startsWith('mcp__'))) expect(covers(tool), `${type}: ${tool}`).toBe(true);
    }
    expect(fs.existsSync(path.join(NATIVE_AGENTS_DIR, 'business-panel-experts.md'))).toBe(true);
  });

  it('holds the posture of a native coordinator: opus, medium effort, acceptEdits, and carries no skills of its own', () => {
    expect([frontmatter().model, frontmatter().effort, frontmatter().permissionMode]).toEqual(['opus', 'medium', 'acceptEdits']);
    expect(frontmatter().skills ?? []).toEqual([]);
  });

  it('is a domain lead: no Operation Mode line, no mode-line gate hook and no welcome (ADR 0053 covers organization leads only)', () => {
    expect(text()).not.toMatch(/Operation Mode|mode line|welcome/i);
    expect(text()).not.toContain('agents-united-mode-line-gate.js');
    expect(text()).toContain('agents-united-guard.js');
    expect(bundles()[BUNDLE].tier).toBe('domain');
  });
});

describe('native orchestrator-business: its domain map and cross-bundle table', () => {
  it('carries the roster exactly as generated from the bundles and the native agents', () => {
    expect(checkRoster(text(), rosterTypes(BUNDLE))).toEqual([]);
  });

  it('names every business type in the map with the bundles that provide it', () => {
    for (const type of domainTypes(bundles(), BUNDLE)) {
      expect(text(), type.name).toContain(`| \`${type.name}\` | ${type.bundles.map(bundle => `\`${bundle}\``).join(', ')} |`);
    }
  });

  it('tells the user how to install a missing type and refresh the running session', () => {
    expect(text()).toContain('agents add <bundle>');
    expect(text()).toContain('/reload-skills');
  });

  it('states that it must run as the main thread, and what it does when it cannot', () => {
    expect(text()).toContain('claude --agent orchestrator-business');
    expect(text()).toContain('agents start business-strategy --host claude');
    expect(text()).toMatch(/AskUserQuestion is not available to a subagent/);
  });

  it('recommends every bundle of the canonical table, the three child bundles and deep-research, each by a command that exists', () => {
    const body = text();
    const canonical = canonicalLead();
    for (const bundle of ['product-led-growth', 'system-architecture', 'performance-paid-acquisition', 'ai-ml-engineering', 'lifecycle-email-marketing']) {
      expect(canonical, bundle).toContain(`agents add ${bundle}`);
      expect(Object.keys(bundles()), bundle).toContain(bundle);
      expect(body, bundle).toContain(`| \`${bundle}\` | \`agents add ${bundle}\` |`);
    }
    expect(canonical).toContain('agents add domain:business');
    expect(body).toContain('`agents add domain:business`');
    expect(new Set(Object.values(bundles()).map((bundle: any) => bundle.domain)).has('business')).toBe(true);
    expect(Object.keys(bundles())).toContain('full');
    expect(body).toContain('| `full` | `agents add full` |');
    for (const child of ['business-financial-modeling', 'business-market-intelligence', 'business-operations-legal']) {
      expect(bundles()[child].parentBundle, child).toBe(BUNDLE);
      expect(body, child).toContain(`| \`${child}\` | \`agents add ${child}\` |`);
    }
    expect(Object.keys(bundles())).toContain('deep-research');
    expect(body).toContain('| `deep-research` (the `deep-research` type) | `agents add deep-research` |');
  });

  it('refers only to slash commands that exist as skills, to skills of the business bundles, and to bundles that exist', () => {
    const body = withoutPublishingBlock(text());
    const businessSkills = new Set(Object.entries(bundles()).filter(([, bundle]: [string, any]) => bundle.domain === 'business').flatMap(([, bundle]: [string, any]) => bundle.skills ?? []));
    for (const match of body.matchAll(/`\/([a-z0-9-]+)`/g)) {
      if (match[1] === 'reload-skills') continue; // a Claude Code command, not a skill of ours
      expect(fs.existsSync(path.resolve('registry/skills', match[1]!, 'SKILL.md')), `/${match[1]}`).toBe(true);
    }
    const table = section('Plan with the user');
    for (const match of table.matchAll(/^\| [^|]+\| (`\/[^|]+`) \|/gm)) {
      for (const skill of match[1]!.matchAll(/`\/([a-z0-9-]+)`/g)) {
        if (skill[1] === 'host-agent-router') continue; // listed by every bundle
        expect(businessSkills.has(skill[1]!), `/${skill[1]} is a skill of a business bundle`).toBe(true);
      }
    }
    for (const match of body.matchAll(/agents add ([a-z][a-z0-9:-]*)/g)) {
      const name = match[1]!.replace(/^domain:/, '');
      expect(match[1]!.startsWith('domain:') || Object.keys(bundles()).includes(name), `agents add ${match[1]}`).toBe(true);
    }
  });

  it('names the skills of the business bundles that the canonical lead and the bundles list', () => {
    const body = text();
    for (const skill of ['workflow-business-panel', 'workflow-spec-panel', 'workflow-recommend', 'workflow-estimate', 'grill-me', 'domain-modeling', 'architecture-design', 'technical-documentation', 'to-spec', 'to-tickets', 'growth-experiment-design', 'handoff', 'host-agent-router'])
      expect(body, skill).toContain(`\`/${skill}\``);
  });
});

describe('native orchestrator-business: literature review is a recommendation, competitive mapping is delegated', () => {
  it('sends deep competitive feature mapping to market-intelligence-analyst, not to a research type', () => {
    expect(canonicalLead()).toMatch(/deep competitive feature mapping and technical literature review to \*\*`subagent-deep-research`\*\*/);
    expect(tools().find(tool => tool.startsWith('Agent('))).not.toContain('deep-research');
    const delegate = section('Delegate');
    expect(delegate).toMatch(/Deep competitive feature mapping is not literature review: it goes to `market-intelligence-analyst`/);
    expect(section('Delegate')).toContain('| `market-intelligence-analyst` | `business-market-intelligence` | TAM, SAM and SOM sizing, competitor analysis, deep competitive feature mapping, positioning. |');
  });

  it('says the research type is present only when installed, and otherwise hands the work back to the user', () => {
    const body = text();
    expect(body).toContain('that type is present only when its own bundle is installed. When it is not, you hand that work back to the user with the `agents add` line; you never pretend to have done it or improvise a specialist.');
    expect(section('Delegate')).toMatch(/Technical literature review is not delegated\./);
    expect(section('Delegate')).toMatch(/when that bundle is not installed hand the work back to the user/);
  });
});

describe('native orchestrator-business: it delegates every deliverable and checks every figure', () => {
  it('names the owner of each of the five types, and writes only the synthesis brief itself', () => {
    const owners = section('Delegate');
    for (const [type, bundle] of [['financial-analyst', 'business-financial-modeling'], ['market-intelligence-analyst', 'business-market-intelligence'], ['operations-strategist', 'business-operations-legal'], ['legal-contract-analyst', 'business-operations-legal'], ['business-panel-experts', 'business-strategy']])
      expect(owners, type).toMatch(new RegExp(`\\| \`${type}\` \\| \`${bundle}\` \\|`));
    expect(text()).toContain('You write only one document yourself: the synthesis brief, built from their reports.');
    expect(text()).toMatch(/You delegate every deliverable to a specialist/);
  });

  it('keeps the canonical verification duties as the lead\'s own steps', () => {
    const verify = section('Verify before delivering');
    for (const needle of [
      'check every figure you synthesise against it and against the stated formulas. You never pass on a figure you have not read.',
      'CAC, LTV, ARR and gross margin are standardized across every report.',
      'accounts for churn, discount rates and customer acquisition friction',
      'Every strategic claim in the brief names the primary source or the financial model behind it.',
    ]) expect(verify, needle).toContain(needle);
    const canonical = canonicalLead();
    expect(canonical).toContain('Every strategic claim must cite primary sources or financial models.');
    expect(canonical).toContain('Standardize financial formulas for CAC, LTV, ARR, and gross margins across all reports.');
    expect(canonical).toContain('Account for market churn, discount rates, and customer acquisition friction in all financial projections.');
  });

  it('allows provisional estimates while planning and labels them', () => {
    expect(section('Plan with the user')).toContain('label each as provisional and name its assumption');
    expect(canonicalLead()).toContain('PROVISIONAL answers and estimates');
  });

  it('states that specialists cannot ask the user, and has the Session task tracking section', () => {
    expect(section('Delegate')).toContain('**Specialists cannot ask the user.** Their questions come back as `ask-user` entries under `Requests for the lead`; you ask the user and return the answer to the specialist that asked (see Requests from specialists).');
    expect(text()).toMatch(/\n## Session task tracking\n/);
  });

  it('keeps the Planning Consultation gate, the clear-brief rule, proportional grilling and installed-type awareness', async () => {
    const scope = normalize((await loadSemanticCore('registry')).get(ROLE)!.scope_boundaries);
    expect(scope).toContain('Planning consultation. Before finalizing any delegation map:');
    expect(scope).toContain('**Mandatory specialist consult gate (unconditional)**: consult at least one relevant specialist during planning before emitting the delegation map, unless the user explicitly waives it. A clear or simple brief is not a waiver;');
    expect(scope).toContain('Specialists advise only; they write no deliverable files during planning.');
    expect(scope).toContain('**Then the delegation map**:');
    expect(scope).toContain('Proportional grilling:');
    expect(scope).toContain('Installed-type awareness:');
    expect(scope).toContain('Delegation briefs and relay.');
    expect(scope).toContain('Boundary constraints:');
    for (const rule of ['**Data-backed verification**', '**Financial rigor**', '**No direct source mutations**', '**Realistic projections**']) expect(scope, rule).toContain(rule);
  });
});

describe('native orchestrator-business: the legal boundary travels with the legal analysis', () => {
  it('quotes the boundary of the legal contract analyst, and the quoted text is a substring of the canonical agent', () => {
    expect(canonicalAgent('legal-contract-analyst')).toContain(LEGAL_BOUNDARY);
    const verify = section('Verify before delivering');
    const quoted = /as a quotation, that this is "([^"]+)"/.exec(verify)?.[1];
    expect(quoted).toBe(LEGAL_BOUNDARY);
    expect(canonicalAgent('legal-contract-analyst')).toContain(quoted!);
  });

  it('carries the same quotation in the core, where the synthesis is defined, and invents no financial disclaimer', async () => {
    const core = (await loadSemanticCore('registry')).get(ROLE)!;
    expect(normalize(core.scope_boundaries)).toContain(`"${LEGAL_BOUNDARY}"`);
    expect(normalize(core.safety)).toContain(`"${LEGAL_BOUNDARY}"`);
    expect(text()).not.toMatch(/not financial advice|financial disclaimer|not investment advice/i);
  });
});

describe('native orchestrator-business: the guard claims', () => {
  it('carries the one guard sentence once, in the step that says to branch first', () => {
    expect(text().split(GUARD_SENTENCE)).toHaveLength(2);
    expect(text()).toContain(`branch first. ${GUARD_SENTENCE}`);
    expect(text()).not.toMatch(/guard blocks forced pushes and/);
  });

  it('states the limit of acceptEdits and of the guard, and makes source safety the lead\'s own obligation', () => {
    const verify = section('Verify before delivering');
    expect(verify).toContain('No guard stops a write under `src/` or an edit that overwrites another file in the working folder.');
    expect(verify).toContain('Do not modify application source code (`src/`): write only strategy, documentation and roadmap files');
    expect(verify).toMatch(/That is your own obligation, and you give it to every specialist in its brief\./);
    const host = section('Boundaries of this host');
    expect(host).toContain('Your file sets `acceptEdits`, so file edits inside the working folder are approved without a prompt, when that mode is in force (the main session\'s `acceptEdits`, `auto` or `bypassPermissions` mode replaces it, its `plan` mode keeps you in plan mode, and as a teammate your starting mode follows from the lead\'s and can change).');
    expect(host).toContain('refuses writes to `.env` files made with the editing tools');
    expect(text()).toContain('to leave application source code alone');
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-orchestrator-business-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const result = (tool: string, input: Record<string, unknown>) => attempt(text(), project, { tool, input }, { agentType: ROLE });

    it.each(['vercel --prod', 'git push --force origin main', 'git push -f origin main', 'rm -rf /', 'rm -rf ~', 'rm -rf .git', 'sudo ls', 'shutdown now', 'mkfs.ext4 /dev/sda1', 'az group delete --name g --yes', 'gcloud projects delete p'])(
      'blocks the shell command %s, as the sentence says',
      command => {
        const outcome = result('Bash', { command });
        expect([command, outcome.offered, outcome.blocked]).toEqual([command, true, true]);
      },
    );

    it.each(['git status', 'npm test', 'git push origin feature/x', 'rm -rf node_modules'])('does not block the ordinary command %s', command => {
      expect(result('Bash', { command }).blocked).toBe(false);
    });

    it('blocks a PowerShell recursive delete of the home folder', () => {
      expect(result('PowerShell', { command: 'Remove-Item -Recurse -Force $HOME' }).blocked).toBe(true);
      expect(result('PowerShell', { command: 'Restart-Computer' }).blocked).toBe(true);
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked', tool => {
      const input = tool === 'NotebookEdit' ? { notebook_path: path.join(project, '.env') } : { file_path: path.join(project, '.env') };
      expect(result(tool, input).blocked).toBe(true);
    });

    it.each(['docs/strategy/pricing-2026-11-20.md', 'PRODUCT.md', 'ROADMAP.md', '.env.example'])('does not block a write of %s', file => {
      const outcome = result('Write', { file_path: path.join(project, file) });
      expect([outcome.offered, outcome.blocked]).toEqual([true, false]);
    });

    it.each(['src/index.ts', 'src/core/types.ts', 'package.json'])('does not block a write of %s: that is why keeping to strategy files is an obligation of the lead and not of the guard', file => {
      const outcome = result('Write', { file_path: path.join(project, file) });
      expect([outcome.offered, outcome.blocked]).toEqual([true, false]);
    });
  });
});

describe('native orchestrator-business: the shared core', () => {
  it('has a core and no contract.json, and the core is tool-free', async () => {
    expect(fs.existsSync(path.resolve('registry/core/orchestrator-business.core.md'))).toBe(true);
    expect(fs.existsSync(path.resolve('registry/core/orchestrator-business.contract.json'))).toBe(false);
    const raw = fs.readFileSync(path.resolve('registry/core/orchestrator-business.core.md'), 'utf8');
    expect(raw).not.toMatch(/schedule/);
    const core = (await loadSemanticCore('registry')).get(ROLE)!;
    expect(core.capabilities).toEqual(expect.arrayContaining(['task-tracking', 'delegate', 'ask-user', 'shell']));
    for (const absent of ['workflow', 'code-intel', 'report', 'worktree']) expect(core.capabilities, absent).not.toContain(absent);
  });

  it('puts the router sentence in the safety floor and the legal boundary in the safety', async () => {
    const core = (await loadSemanticCore('registry')).get(ROLE)!;
    expect(normalize(core.safety)).toContain('Only when the user explicitly asks to run work on another host CLI, use host-agent-router if installed.');
    expect(normalize(core.safety)).toContain('Technical Literature Review Is Recommended, Not Delegated');
  });
});
