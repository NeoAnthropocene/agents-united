import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withRoutes } from '../src/core/claude-mcp-routes.js';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt, preToolUseGroups } from './helpers/claude-host-hooks.js';
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';

/**
 * The native lead of the research domain, a twin of tests/native-orchestrator.test.ts (which pins the engineering lead): it runs as the main thread, may spawn exactly
 * the five types of the research domain, and carries a generated domain map. Its core has no contract.json by decision (the lead is a coordinator, as the engineering lead is).
 *
 * Five choices below were made by an AI session for the maintainer to overturn. Each is pinned here, so that overturning one is a visible edit:
 *
 * DEVIATION from the canonical lead. The canonical Phase 2 has the lead gather the evidence itself (web search and page reads). Here the lead searches only to scope a request and
 * to spot-check key claims against two independent sources. Evidence gathering goes to `deep-research` (logic audit to `socratic-mentor`, code mapping to `repo-index`,
 * quantitative work to `statistical-analyst`, prior art to `literature-patent-analyst`), and the lead writes the synthesis report from their outputs (the canonical Phase 4).
 * Reason: the whole domain exists to have specialists gather and audit evidence, and a lead that also gathers it has nothing independent to check it against.
 *
 * LEFT OUT, one reason each:
 *  - `Workflow`: no Claude saved workflow exists for research; `workflow-research` and the other workflow-* names of the bundle are skills, which the lead loads with `Skill`.
 *  - `ReportFindings`: it is a review tool, and the department has no reviewer.
 *  - `LSP`: the lead works on no code slice; code mapping is delegated to `repo-index`.
 *  - `EnterWorktree` and `ExitWorktree`: the specialists write reports, not parallel code changes, so nothing needs an isolated working tree.
 */

const BUNDLE = 'deep-research';
const ROLE = 'orchestrator-research';
const file = path.resolve('registry/hosts/claude/agents/orchestrator-research.md');
const read = (): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
// The generated requests block (ADR 0076) names `Workflow` and `schedule` for the case a lead holds them: only the scans for those words leave it out.
const withoutRequests = (value: string): string => value.replace(/<!-- agents-united:requests:start[^>]*-->[\s\S]*?<!-- agents-united:requests:end -->\n?/, '');
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);
const body = (): string => read().split('<!-- agents-united:floor:end -->')[1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(read())![1]!.trim();
const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/orchestrator-research.md'), 'utf8').replace(/\r\n/g, '\n');
const coreFile = (): string => fs.readFileSync(path.resolve('registry/core/orchestrator-research.core.md'), 'utf8').replace(/\r\n/g, '\n');

/** The whole tools line: the Agent allowlist, then the classes of the core in alphabetical order, then the four servers by every route that exists. */
const EXPECTED_TOOLS = [
  `Agent(deep-research, literature-patent-analyst, repo-index, socratic-mentor, statistical-analyst)`,
  'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'Monitor', 'NotebookEdit', 'PowerShell',
  'PushNotification', 'Read', 'ReadMcpResourceTool', 'RemoteTrigger', 'ScheduleWakeup', 'SendMessage', 'SendUserFile', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop',
  'TaskUpdate', 'TodoWrite', 'ToolSearch', 'WaitForMcpServers', 'WebFetch', 'WebSearch', 'Write',
  ...withRoutes(['mcp__github', 'mcp__context7', 'mcp__firecrawl', 'mcp__markitdown']),
];

/** The shared clause every Claude role that holds a shell carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';

describe('native orchestrator-research (a main-thread coordinator)', () => {
  it('holds exactly these tools, the allowlist first', () => {
    expect(splitTools(frontmatter().tools)).toEqual(EXPECTED_TOOLS);
  });

  it('may spawn exactly the five specialist types of the research domain, through an Agent allowlist and never a bare Agent', () => {
    const tools = splitTools(frontmatter().tools);
    expect(tools.filter(tool => tool.startsWith('Agent'))).toEqual([allowlist(BUNDLE)]);
    expect(tools).not.toContain('Agent');
    expect(allowlist(BUNDLE).slice('Agent('.length, -1).split(', ')).toEqual(['deep-research', 'literature-patent-analyst', 'repo-index', 'socratic-mentor', 'statistical-analyst']);
  });

  it('is opus at medium effort, accepts edits as its canonical agent does, and carries no mode line or mode-line gate', () => {
    const canonicalMode = /^permissionMode: (.+)$/m.exec(canonical())?.[1];
    expect(canonicalMode).toBe('acceptEdits');
    expect([frontmatter().model, frontmatter().effort, frontmatter().permissionMode]).toEqual(['opus', 'medium', canonicalMode]);
    expect(frontmatter().skills ?? []).toEqual([]);
    expect(read()).not.toMatch(/Operation Mode|mode line/i);
    const commands = preToolUseGroups(read()).flatMap(group => group.hooks.map(hook => String(hook.args?.[0])));
    expect(commands.every(command => command.endsWith('/agents-united-guard.js'))).toBe(true);
  });

  it('carries the domain map exactly as generated from the bundles and the native agents', () => {
    expect(checkRoster(read(), rosterTypes(BUNDLE))).toEqual([]);
  });

  it('names every type of its domain in the map, with the bundles that provide it', () => {
    for (const type of domainTypes(bundles(), BUNDLE)) {
      expect(read(), type.name).toContain(`| \`${type.name}\` | ${type.bundles.map(bundle => `\`${bundle}\``).join(', ')} |`);
      for (const bundle of type.bundles) expect(Object.keys(bundles()), bundle).toContain(bundle);
    }
  });

  it('says what each native research specialist can do on this host, the two analytics roles included', () => {
    const roster = read().slice(read().indexOf('agents-united:roster:start'), read().indexOf('agents-united:roster:end'));
    expect(roster).toMatch(/\| `deep-research` \| `deep-research`, `deep-research-analytics` \|[^\n]*edits files; Glob\/Grep search/);
    expect(roster).toMatch(/\| `socratic-mentor` \| `deep-research` \|[^\n]*read-only; Glob\/Grep search/);
    expect(roster).toMatch(/\| `statistical-analyst` \| `deep-research-analytics` \|[^\n]*edits files and runs commands; searches through Bash; Monitor; MCP: markitdown/);
    expect(roster).toMatch(/\| `literature-patent-analyst` \| `deep-research-analytics` \|[^\n]*edits files and runs commands; searches through Bash; MCP: firecrawl, markitdown/);
    expect(roster).not.toContain('Not yet a native agent');
  });

  it('Step 0 tells the user how to install a missing type, which bundle brings the two analysts, and how to refresh the running session', () => {
    const zero = section('Step 0: what is installed');
    expect(zero).toContain('agents add <bundle>');
    expect(zero).toMatch(/`statistical-analyst` and `literature-patent-analyst`[^\n]*`agents add deep-research-analytics`/);
    expect(zero).toContain('/reload-skills');
  });

  it('states that it must run as the main thread, and what it does when it cannot', () => {
    expect(body()).toContain('claude --agent orchestrator-research');
    expect(body()).toContain('agents start deep-research --host claude');
    expect(body()).toMatch(/AskUserQuestion is not available to a subagent/);
    expect(body()).toMatch(/If you find you were spawned as a subagent, say so at once/);
  });

  it('refers only to slash commands that exist as skills, and to bundles that exist', () => {
    for (const match of body().matchAll(/`\/([a-z0-9-]+)`/g)) {
      if (match[1] === 'reload-skills') continue; // a Claude Code command, not a skill of ours
      expect(fs.existsSync(path.resolve('registry/skills', match[1]!, 'SKILL.md')), `/${match[1]}`).toBe(true);
    }
    for (const match of body().matchAll(/agents add ([a-z][a-z0-9:-]*)/g)) {
      const name = match[1]!.replace(/^domain:/, '');
      expect(match[1]!.startsWith('domain:') || Object.keys(bundles()).includes(name), `agents add ${match[1]}`).toBe(true);
    }
  });

  it('recommends the whole suite by a domain that exists, and every bundle of the cross-bundle table, as commands and never as Agent types', () => {
    const domains = new Set(Object.values(bundles()).map((bundle: any) => bundle.domain));
    expect(domains.has('research')).toBe(true);
    expect(body()).toContain('agents add domain:research');
    const entry = splitTools(frontmatter().tools).find(tool => tool.startsWith('Agent('))!;
    for (const bundle of ['deep-research-analytics', 'ai-ml-engineering', 'business-strategy', 'seo-content-marketing', 'system-architecture']) {
      expect(Object.keys(bundles()), bundle).toContain(bundle);
      expect(body(), bundle).toContain(`agents add ${bundle}`);
      expect(entry, bundle).not.toContain(bundle);
    }
    // The specialists of the recommended bundles are not in the allowlist: it holds the research domain's five types and nothing else.
    expect(entry.slice('Agent('.length, -1).split(', ')).toEqual(domainTypes(bundles(), BUNDLE).map(type => type.name));
    expect(section('Delegate')).toMatch(/Work beyond research synthesis is recommended, not delegated\./);
  });

  it('is a coordinator, so it delegates evidence gathering and says that it searches only to scope a request and to spot-check', () => {
    expect(body()).toContain('You delegate evidence gathering, logic audit, code mapping, quantitative work and prior-art search to specialists');
    expect(body()).toContain('You search only to scope a request and to spot-check key claims');
    expect(section('Plan with the user')).toContain('**Planning Aid Boundary.**');
    expect(normalize(section('Plan with the user'))).toContain('A clear brief is not a waiver');
  });

  it('keeps the consult gate with its whole budget', () => {
    const plan = normalize(section('Plan with the user'));
    expect(plan).toContain('**Consult before you map.** Before the delegation map, consult at least one relevant specialist with a short, read-only brief, unless the user waived it.');
    for (const part of ['one to three specialists', 'at most two directed questions per specialist pair', 'at most two planning rounds', 'at most 1000 words per consult', 'Record who you consulted or the waiver']) expect(plan, part).toContain(part);
    expect(plan).toMatch(/Present the delegation map before executing/);
  });

  it('names the brief fields, the relay duties, contract first, the missing report as an open item, and installed-type awareness', () => {
    const delegate = normalize(section('Delegate'));
    for (const part of ['self-contained brief', 'Peer messages received', 'Open items', '**Contract first.**', 'You are the only relay', 'A missing report is an open item', 'Only delegate to a type in your allowlist and in the install record']) {
      expect(delegate, part).toContain(part);
    }
    expect(delegate).toMatch(/Specialists cannot ask the user/);
  });
});

describe('native orchestrator-research: the answers go back to the same mentor (ADR 0076)', () => {
  it('the owner row of socratic-mentor says its questions come back as ask-user entries, turn by turn, and the answers return to the same mentor', () => {
    const row = /^\| `socratic-mentor` \| `deep-research` \| Logical consistency auditing[^\n]*$/m.exec(body())![0];
    expect(row).toContain('Read-only; its probing questions come back as `ask-user` entries, turn by turn: you put them to the user and return the answers to the same mentor.');
  });

  it('the lead block returns every result to the same specialist and never launches a second agent of that type', () => {
    const block = /<!-- agents-united:requests:start[^>]*-->\n([\s\S]*?)\n<!-- agents-united:requests:end -->/.exec(read())![1]!;
    expect(block).toContain('Return every result to the same specialist');
    expect(block).toContain('Never launch a second agent of that type to carry an answer');
  });
});

describe('native orchestrator-research: the four leave-outs, pinned', () => {
  const held = (): string[] => splitTools(frontmatter().tools).map(tool => tool.split('(')[0]!);

  it.each(['Workflow', 'ReportFindings', 'LSP', 'EnterWorktree', 'ExitWorktree'])('holds no %s, and the body names none of them', tool => {
    expect(held()).not.toContain(tool);
    expect(tool === 'Workflow' ? withoutRequests(body()) : body()).not.toContain(`\`${tool}\``);
  });

  it('does not run saved workflows: the workflow-* names are skills that it loads with Skill, and no native workflow is named', () => {
    expect(held()).toContain('Skill');
    expect(body()).not.toMatch(/workflow-(review|implement|test)\b/);
    for (const name of ['workflow-research', 'workflow-brainstorm', 'workflow-explain', 'workflow-grill']) {
      expect(fs.existsSync(path.resolve('registry/skills', name, 'SKILL.md')), name).toBe(true);
    }
  });

  it('declares none of the four capability classes in its core, which is why the tools are absent', async () => {
    const core = (await loadSemanticCore('registry')).get(ROLE)!;
    for (const capability of ['workflow', 'report', 'code-intel', 'worktree']) expect(core.capabilities, capability).not.toContain(capability);
    for (const capability of ['web', 'delegate', 'ask-user', 'shell', 'edit', 'background-monitor', 'messaging', 'task-tracking']) expect(core.capabilities, capability).toContain(capability);
  });

  it('holds the web tools only to scope a request and to spot-check, and says so', () => {
    expect(held()).toEqual(expect.arrayContaining(['WebSearch', 'WebFetch']));
    expect(normalize(section('Verify before delivering'))).toContain('Check each key claim yourself against at least two independent primary sources');
  });
});

describe('native orchestrator-research: the guard and the src/ rule, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-research-lead-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const name of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', name), path.join(project, '.claude/hooks', name));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const shell = (tool: string, command: string) => attempt(read(), project, { tool, input: { command } }, { agentType: ROLE });
  const write = (tool: string, target: string) => attempt(read(), project, { tool, input: tool === 'NotebookEdit' ? { notebook_path: target } : { file_path: target } }, { agentType: ROLE });

  it('carries the one guard sentence once, in Boundaries', () => {
    expect(read().split(GUARD_SENTENCE)).toHaveLength(2);
    expect(section('Boundaries of this host')).toContain(`- ${GUARD_SENTENCE}`);
  });

  it.each([
    ['Bash', 'git push --force origin main'],
    ['PowerShell', 'git push -f origin main'],
    ['Bash', 'vercel --prod'],
    ['Bash', 'rm -rf /'],
    ['Bash', 'sudo ls'],
    ['Bash', 'shutdown now'],
    ['Bash', 'az group delete --name g --yes'],
  ])('%s %s is blocked, as the sentence says', (tool, command) => {
    expect(shell(tool, command).blocked).toBe(true);
  });

  it.each(['Write', 'Edit', 'NotebookEdit'])('%s to a .env file is blocked, as the sentence says', tool => {
    expect(write(tool, path.join(project, '.env')).blocked).toBe(true);
  });

  it('does not block a forced push with a lease or an ordinary command, which the sentence does not claim', () => {
    for (const command of ['git push --force-with-lease origin dev', 'git status', 'rg -n citation docs/research']) expect(shell('Bash', command).blocked, command).toBe(false);
  });

  it('does not block a write under src/, so the rule not to change runtime source is the lead\'s own, and the body says it is not the guard\'s', () => {
    const result = write('Write', path.join(project, 'src/index.ts'));
    expect([result.offered, result.blocked]).toEqual([true, false]);
    expect(write('Write', path.join(project, 'docs/research/streams-2026-11-20.md')).blocked).toBe(false);
    const bullet = /^- Do not change project runtime source code[^\n]*$/m.exec(section('Boundaries of this host'))![0];
    expect(bullet).toContain('(`src/`)');
    expect(bullet).toContain('output research documentation only');
    expect(bullet).toMatch(/your own rule/);
    expect(bullet).toMatch(/guard does not (enforce|stop) it/);
    expect(bullet.replace(/the guard does not (enforce|stop) it/, '')).not.toMatch(/guard (blocks|stops|prevents)/);
  });

  it('keeps the Glob/Grep note of the engineering lead and sends broad search to repo-index', () => {
    expect(section('Boundaries of this host')).toContain('- You hold `Bash`, so `Glob` and `Grep` are not available on macOS, Linux and WSL; search through `Bash` (`rg`, `git grep`). For broad searching, delegate to `repo-index`, which has them.');
  });
});

describe('native orchestrator-research: the shared core carries the canonical lead\'s duties', () => {
  const scope = async (): Promise<string> => normalize((await loadSemanticCore('registry')).get(ROLE)!.scope_boundaries);

  it('has no contract.json, by decision: it is a coordinator, as the engineering lead is', () => {
    expect(fs.existsSync(path.resolve('registry/core/orchestrator-research.contract.json'))).toBe(false);
    expect(fs.existsSync(path.resolve('registry/core/orchestrator-engineering.contract.json'))).toBe(false);
  });

  it('never uses the word schedule in the core or the native file: the canonical lead\'s wake-up timers are not bound here', () => {
    expect(coreFile()).not.toMatch(/\bschedule\b/i);
    expect(withoutRequests(read())).not.toMatch(/\bschedule\b/i);
    expect(read()).not.toMatch(/TimerCondition|IsDaemon/);
  });

  it('keeps the four Boundary Constraints of the canonical lead (the last one is reworded as documentation only)', async () => {
    const canonicalBullets = [...(/\n## [^\n]*Boundary Constraints[^\n]*\n([\s\S]*?)(?=\n---)/.exec(canonical())?.[1] ?? '').matchAll(/^- \*\*(.+?)\*\*: (.+)$/gm)].map(match => match[1]!.toLowerCase());
    expect(canonicalBullets).toEqual(['mandatory citation', 'objective neutrality', 'no hallucinated references', 'scoped read-only operations']);
    const text = await scope();
    expect(text).toContain('Boundary constraints:');
    for (const rule of [
      '- **Mandatory citation**: every empirical claim or benchmark statistic cites an explicit source URL or document reference.',
      '- **Objective neutrality**: present trade-offs objectively, without unverified bias.',
      '- **No hallucinated references**: never invent sources, APIs or performance statistics.',
      '- **Documentation only**: do not change project runtime source code (`src/`); output research documentation only. This is your own rule.',
    ]) expect(text, rule).toContain(rule);
  });

  it('keeps the planning consultation gate and the four phases, with the deviation stated in Phase 2', async () => {
    const text = await scope();
    expect(text).toContain('Planning consultation. Before finalizing any delegation map:');
    expect(text).toContain('**Mandatory specialist consult gate (unconditional)**: consult at least one relevant specialist during planning before emitting the delegation map, unless the user explicitly waives it.');
    expect(text).toContain('Specialists advise only; they write no deliverable files during planning.');
    expect(text).toContain('**Then the delegation map**:');
    for (const phase of ['Phase 1, topic decomposition and Socratic alignment:', 'Phase 2, evidence gathering by specialists, with spot-checks by you:', 'Phase 3, specialist delegation and logical audit:', 'Phase 4, report synthesis and verification gate:']) {
      expect(text, phase).toContain(phase);
    }
    expect(text).toContain('Search yourself only to scope a request, and to spot-check each key claim against at least two independent primary sources before it reaches the report.');
    expect(text).toContain('Write the synthesis report from the specialists\' outputs');
  });

  it('delegates the five kinds of work to the specialists the canonical lead names', async () => {
    const text = await scope();
    for (const duty of [
      'Delegate multi-query evidence gathering, extraction of deep content and document summarization to the deep research specialist.',
      'Delegate academic literature review and patent prior-art search to the literature and patent analyst, and quantitative work (hypothesis tests, power calculations, benchmark statistics) to the statistical analyst.',
      'Delegate logical consistency auditing, assumption testing and counter-argument analysis to the Socratic mentor.',
      'Delegate codebase indexing and symbol dependency mapping to the repo indexer.',
    ]) expect(text, duty).toContain(duty);
    for (const name of ['deep-research', 'socratic-mentor', 'repo-index']) expect(canonical(), name).toContain(`subagent-${name}`);
  });

  it('lays the report out as the canonical lead does', async () => {
    const contract = (await loadSemanticCore('registry')).get(ROLE)!.output_contract;
    for (const heading of ['Executive Summary', 'Empirical Evidence & Findings Matrix', 'Trade-off Analysis & Architectural Implications', 'Strategic Recommendations', 'References & Primary Sources']) {
      expect(canonical(), heading).toContain(`## ${heading}`);
      expect(contract, heading).toContain(`**${heading}**`);
    }
    expect(contract).toContain('Cross-Bundle Recommendations (if applicable)');
    expect(section('The report')).toContain('docs/research/');
  });
});
