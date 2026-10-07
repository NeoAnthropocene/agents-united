import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUARD_SCRIPT, nativeGuardFileHooks } from '../src/core/guard.js';
import { checkFloor, checkHooks, syncFloor, syncHooks } from '../src/core/native-floor.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { splitTools } from '../src/core/native-guard.js';
import { syncRoster } from '../src/core/native-roster.js';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';
import { attempt, preToolUseGroups } from './helpers/claude-host-hooks.js';
import { allowlist, rosterTypes } from './helpers/native-coordinator.js';
import { withRoutes } from '../src/core/claude-mcp-routes.js';

/**
 * Plan 032 PR E — the native Claude agents (milestone 1: code-reviewer; milestone 2: backend-architect,
 * frontend-architect, repo-index; milestone 3: the orchestrator, a main-thread agent). Each file is authored; its Contract Floor block and guard hooks are generated
 * (regenerate with `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`). Tools must equal the
 * class-derived grant plus the role's declared server tools, and the embedded guard must really block.
 */

interface RoleSpec {
  name: string;
  stem: string;
  guard: 'read-only' | 'destructive';
  permissionMode: 'plan' | 'acceptEdits';
  skills: string[];
  /** Explicit server tools (read-only roles) or whole servers (roles that may write, as the legacy lane grants). */
  serverTools: string[];
  mutating: boolean;
  /** Tools the role must hold on top of what its classes happen to give: the point of each is in the comment. */
  mustHold: string[];
  /** A coordinator: runs as the main thread (`claude --agent`), so its ceiling includes what a subagent never gets, and it carries the domain map. */
  mainThread?: boolean;
  /** The bundle whose domain map a coordinator carries (default: the Tier-1 engineering bundle). */
  coordinatorBundle?: string;
  /** What the role searches and works with, when its classes differ from a Tier-1 engineer's (no `LSP` without code intelligence, no `Bash` without a shell). */
  searchTools?: string[];
  workTools?: string[];
  model: string;
  effort: string;
}

const MCP_READ_TOOLS = [
  'mcp__github__search_code',
  'mcp__github__get_file_contents',
  'mcp__github__list_pull_requests',
  'mcp__github__pull_request_read',
  'mcp__context7__resolve-library-id',
  'mcp__context7__query-docs',
];

/** A role that does the work it is delegated needs the shells, editors, monitors, worktrees and task tools, and MCP discovery. */
const WRITER_MUST_HOLD = ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Monitor', 'EnterWorktree', 'ExitWorktree', 'TodoWrite', 'ToolSearch'];

const ROLES: RoleSpec[] = [
  { name: 'code-reviewer', stem: 'subagent-code-reviewer', guard: 'read-only', permissionMode: 'plan', skills: ['security-audit'], serverTools: MCP_READ_TOOLS, mutating: false, mustHold: ['Glob', 'Grep', 'LSP', 'ReportFindings', 'ToolSearch'], model: 'sonnet', effort: 'medium' },
  { name: 'repo-index', stem: 'subagent-repo-index', guard: 'read-only', permissionMode: 'plan', skills: [], serverTools: MCP_READ_TOOLS, mutating: false, mustHold: ['Glob', 'Grep', 'LSP', 'ToolSearch'], model: 'sonnet', effort: 'medium' },
  { name: 'backend-architect', stem: 'subagent-backend-architect', guard: 'destructive', permissionMode: 'acceptEdits', skills: [], serverTools: ['mcp__github', 'mcp__context7'], mutating: true, mustHold: WRITER_MUST_HOLD, model: 'sonnet', effort: 'medium' },
  { name: 'frontend-architect', stem: 'subagent-frontend-architect', guard: 'destructive', permissionMode: 'acceptEdits', skills: [], serverTools: ['mcp__stitch', 'mcp__context7', 'mcp__chrome-devtools-mcp'], mutating: true, mustHold: WRITER_MUST_HOLD, model: 'sonnet', effort: 'medium' },
  {
    name: 'orchestrator-engineering',
    stem: 'orchestrator-engineering',
    guard: 'destructive',
    permissionMode: 'acceptEdits',
    skills: [],
    serverTools: ['mcp__github', 'mcp__context7', 'mcp__chrome-devtools-mcp', 'mcp__firecrawl'],
    mutating: true,
    // Delegation and orchestration: the roster allowlist, dynamic workflows, the user, schedules, watchers and worktrees.
    mustHold: [...WRITER_MUST_HOLD, 'Agent', 'Workflow', 'AskUserQuestion', 'CronCreate', 'SendMessage', 'Skill'],
    mainThread: true,
    // Maintainer decision, plan 032 close-out (after the first real Claude session): the native coordinator is pinned opus / medium.
    model: 'opus',
    effort: 'medium',
  },
  // Tier 2 (plan 032 follow-up 2, ADR 0036): the digital-agency team. Teammates are specialists with editors and no shell, so no `Bash`,
  // `LSP` or worktree; they carry the destructive-command guard in their own frontmatter (it guards them as subagents and the lead's
  // main thread; for an in-process teammate only a settings-level guard applies, see the Tier-2 suite).
  ...[
    { name: 'agency-growth-strategist', stem: 'subagent-marketing-growth-strategist', serverTools: withRoutes(['mcp__firecrawl']) },
    { name: 'agency-creative-designer', stem: 'subagent-marketing-creative-designer', serverTools: withRoutes(['mcp__figma', 'mcp__stitch']) },
    { name: 'agency-conversion-specialist', stem: 'subagent-marketing-conversion-specialist', serverTools: withRoutes(['mcp__chrome-devtools-mcp', 'mcp__playwright']) },
  ].map(
    (spec): RoleSpec => ({
      ...spec,
      guard: 'destructive',
      permissionMode: 'acceptEdits',
      skills: [],
      mutating: true,
      mustHold: ['Edit', 'Write', 'WebFetch', 'WebSearch', 'Skill', 'SendMessage', 'SubagentHandback', 'ToolSearch'],
      searchTools: ['Glob', 'Grep', 'Read'],
      workTools: ['Edit', 'Write'],
      model: 'sonnet',
      effort: 'medium',
    })
  ),
  // Tier 2, the rest of the roster (ADR 0039). The three with editors and no shell are cut like the pilots; the four that run commands (SEO audits,
  // test runs, compliance evidence, the build) hold a shell, so they are also guarded as writers, and the two that watch long runs hold `Monitor`.
  ...[
    { name: 'agency-content-strategist', stem: 'subagent-marketing-content-strategist', serverTools: withRoutes(['mcp__firecrawl', 'mcp__markitdown']) },
    { name: 'agency-campaign-specialist', stem: 'subagent-marketing-campaign-specialist', serverTools: withRoutes(['mcp__context7']) },
  ].map(
    (spec): RoleSpec => ({
      ...spec,
      guard: 'destructive',
      permissionMode: 'acceptEdits',
      skills: [],
      mutating: true,
      mustHold: ['Edit', 'Write', 'WebFetch', 'WebSearch', 'Skill', 'SendMessage', 'SubagentHandback', 'ToolSearch'],
      searchTools: ['Glob', 'Grep', 'Read'],
      workTools: ['Edit', 'Write'],
      model: 'sonnet',
      effort: 'medium',
    })
  ),
  ...[
    { name: 'agency-seo-specialist', stem: 'subagent-seo-specialist', serverTools: withRoutes(['mcp__firecrawl', 'mcp__chrome-devtools-mcp']), extra: ['WebFetch', 'WebSearch'] },
    { name: 'agency-qa-automation-lead', stem: 'subagent-qa-automation-lead', serverTools: withRoutes(['mcp__playwright', 'mcp__chrome-devtools-mcp', 'mcp__context7']), extra: ['Monitor', 'TaskCreate', 'TaskUpdate'] },
    { name: 'agency-compliance-grc-specialist', stem: 'subagent-compliance-grc-specialist', serverTools: withRoutes(['mcp__markitdown', 'mcp__context7', 'mcp__github__search_code', 'mcp__github__get_file_contents', 'mcp__github__list_pull_requests', 'mcp__github__pull_request_read']), extra: ['WebFetch', 'WebSearch'] },
    { name: 'agency-frontend-architect', stem: 'subagent-frontend-architect', serverTools: withRoutes(['mcp__stitch', 'mcp__context7', 'mcp__chrome-devtools-mcp']), extra: ['LSP', 'Monitor', 'EnterWorktree', 'ExitWorktree', 'TodoWrite'] },
  ].map(
    ({ extra, ...spec }): RoleSpec => ({
      ...spec,
      guard: 'destructive',
      permissionMode: 'acceptEdits',
      skills: [],
      mutating: true,
      mustHold: ['Bash', 'PowerShell', 'Edit', 'Write', 'Skill', 'SendMessage', 'SubagentHandback', 'ToolSearch', ...extra],
      // Only the frontend architect has code intelligence; the other three search with `Glob` and `Grep` and have no `LSP`.
      searchTools: extra.includes('LSP') ? ['Glob', 'Grep', 'LSP', 'Read'] : ['Glob', 'Grep', 'Read'],
      model: 'sonnet',
      effort: 'medium',
    })
  ),
  {
    name: 'orchestrator-digital-agency',
    stem: 'orchestrator-digital-agency',
    guard: 'destructive',
    permissionMode: 'acceptEdits',
    skills: [],
    serverTools: withRoutes(['mcp__chrome-devtools-mcp', 'mcp__context7', 'mcp__figma', 'mcp__firecrawl', 'mcp__github', 'mcp__markitdown', 'mcp__playwright', 'mcp__stitch']),
    mutating: true,
    // The lead of an Agent Team: the roster allowlist, the user, the shared task list, schedules and watchers; no workflows (the bundle has none).
    mustHold: ['Agent', 'AskUserQuestion', 'SendMessage', 'Skill', 'TaskCreate', 'TaskList', 'TaskUpdate', 'Bash', 'Edit', 'Write', 'CronCreate', 'Monitor', 'PushNotification', 'ToolSearch'],
    mainThread: true,
    coordinatorBundle: 'digital-agency',
    searchTools: ['Glob', 'Grep', 'Read'],
    model: 'opus',
    effort: 'medium',
  },
];

const WRITERS = ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const fileOf = (role: RoleSpec): string => path.resolve('registry/hosts/claude/agents', `${role.name}.md`);
const guardGroups = (role: RoleSpec): Record<string, unknown> => ({ ...(role.guard === 'read-only' ? readOnlyGuardFileHooks() : nativeGuardFileHooks()) });

/** A project directory holding the committed guard scripts where the agents' `${CLAUDE_PROJECT_DIR}/.claude/hooks/...` points. */
const guardProject = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-guard-project-'));
afterAll(() => fs.rmSync(guardProject, { recursive: true, force: true }));
const guardScripts = path.resolve('registry/hosts/claude/hooks');
/** The guard scripts are the inline guards of `src/core`, written out as files (one author), by the same regeneration as the hooks block. */
const SCRIPT_FILES: Array<[string, string]> = [
  ['agents-united-guard.js', GUARD_SCRIPT],
  ['agents-united-readonly-guard.js', READ_ONLY_GUARD_SCRIPT],
];

const ceilingOf = (role: RoleSpec): string[] =>
  resolveGrant(loadToolPolicy('registry', 'claude'), cores.get(role.stem)!.capabilities ?? [], { subagent: !role.mainThread, background: false }).tools;

let cores: Map<string, SemanticCore>;
beforeAll(async () => {
  cores = await loadSemanticCore('registry');
  if (process.env.UPDATE_NATIVE === '1') {
    fs.mkdirSync(guardScripts, { recursive: true });
    for (const [file, script] of SCRIPT_FILES) fs.writeFileSync(path.join(guardScripts, file), `${script}\n`);
    // Specialists first: the coordinator's map is built from their committed files.
    for (const role of [...ROLES].sort((a, b) => Number(a.mainThread ?? false) - Number(b.mainThread ?? false))) {
      if (!fs.existsSync(fileOf(role))) continue;
      const tools = ceilingOf(role).map(tool => (role.mainThread && tool === 'Agent' ? allowlist(role.coordinatorBundle) : tool));
      const toolsLine = `tools: ${[...[...tools].sort(), ...role.serverTools].join(', ')}`;
      let synced = syncHooks(syncFloor(fs.readFileSync(fileOf(role), 'utf8'), cores.get(role.stem)!), guardGroups(role)).replace(/^tools: .*$/m, toolsLine);
      if (role.mainThread) synced = syncRoster(synced, rosterTypes(role.coordinatorBundle));
      fs.writeFileSync(fileOf(role), synced);
    }
  }
  // A project directory where the agents' `${CLAUDE_PROJECT_DIR}/.claude/hooks/...` points: the committed scripts, as installed.
  for (const [file] of SCRIPT_FILES) {
    fs.mkdirSync(path.join(guardProject, '.claude/hooks'), { recursive: true });
    fs.copyFileSync(path.join(guardScripts, file), path.join(guardProject, '.claude/hooks', file));
  }
});

describe.each(ROLES)('native Claude $name', role => {
  const read = (): string => fs.readFileSync(fileOf(role), 'utf8').replace(/\r\n/g, '\n');
  const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);
  const declared = (): string[] => splitTools(frontmatter().tools);
  /** Tool names with an `Agent(...)` allowlist reduced to `Agent`. */
  const declaredNames = (): string[] => declared().map(tool => tool.split('(')[0]);

  it('honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(checkFloor(read(), cores.get(role.stem)!)).toEqual([]);
  });

  it('carries its guard, exactly as generated, and the embedded guard really blocks', () => {
    expect(checkHooks(read(), guardGroups(role))).toEqual([]);
    const groups = preToolUseGroups(read()).map(group => ({ matcher: group.matcher ?? '', hooks: group.hooks as Array<{ command: string; args: string[] }> }));
    // The host's own rules: which hooks match the call, `${CLAUDE_PROJECT_DIR}` substituted, no shell, exit 2 blocks.
    const fire = (tool_name: string, tool_input: object): number => (attempt(read(), guardProject, { tool: tool_name, input: tool_input as Record<string, unknown> }).blocked ? 2 : 0);
    for (const group of groups) for (const hook of group.hooks) expect([hook.command, hook.args.length, hook.args[0].startsWith('${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-')]).toEqual(['node', 1, true]);
    const covered = (tool: string): boolean => groups.some(group => new RegExp(`^(?:${group.matcher})$`).test(tool));
    if (role.guard === 'read-only') {
      expect(groups).toHaveLength(1);
      expect(fire('Write', { file_path: 'C:\\repo\\src\\a.ts' })).toBe(2);
      expect(fire('Bash', { command: 'git push --force' })).toBe(2);
      expect(fire('mcp__github__create_pull_request', {})).toBe(2);
      expect(fire('Grep', { pattern: 'x' })).toBe(0);
      expect(fire('mcp__github__get_file_contents', {})).toBe(0);
    } else {
      expect(fire('Bash', { command: 'git push --force origin main' })).toBe(2);
      expect(fire('PowerShell', { command: 'git push -f origin main' })).toBe(2);
      expect(fire('Write', { file_path: 'C:\\repo\\.env' })).toBe(2);
      expect(fire('Write', { file_path: 'C:\\repo\\.env.example' })).toBe(0);
      expect(fire('Bash', { command: 'git push --force-with-lease' })).toBe(0);
    }
    // Every shell and file writer the role holds sits behind a guard matcher.
    for (const tool of WRITERS.filter(tool => declared().includes(tool))) expect(covered(tool), `${tool} must be guarded`).toBe(true);
  });

  it('holds its whole capability-class ceiling plus its server tools, and the tools its work needs', () => {
    // The widest resolution (foreground): a tool a background subagent does not keep is simply absent there, so the same
    // definition is right for both. Narrowing a role is done by narrowing its classes in the Semantic Core, not per tool.
    // A coordinator is resolved as the main thread (it launches workflows and asks the user); a specialist as a subagent.
    expect(declaredNames()).toEqual(expect.arrayContaining(role.mustHold));
    expect(declaredNames().filter(tool => !tool.startsWith('mcp__')).sort()).toEqual([...ceilingOf(role)].sort());
    expect(declared().filter(tool => tool.startsWith('mcp__')).sort()).toEqual([...role.serverTools].sort());
  });

  it('has Glob and Grep, and no delegation, workflow or scheduling tool', () => {
    expect(declaredNames()).toEqual(expect.arrayContaining(role.searchTools ?? ['Glob', 'Grep', 'LSP', 'Read']));
    for (const forbidden of role.mainThread ? [] : ['Agent', 'Workflow', 'CronCreate']) expect(declaredNames(), forbidden).not.toContain(forbidden);
    if (!role.mutating) for (const writer of WRITERS) expect(declaredNames(), writer).not.toContain(writer);
    else expect(declaredNames()).toEqual(expect.arrayContaining(role.workTools ?? ['Bash', 'Edit', 'Write']));
  });

  it('keeps the frontmatter small and the description short enough for delegation routing', () => {
    const meta = frontmatter();
    expect(meta.name).toBe(role.name);
    expect(String(meta.description).length).toBeLessThanOrEqual(300);
    expect(meta.permissionMode).toBe(role.permissionMode);
    expect([meta.model, meta.effort]).toEqual([role.model, role.effort]);
    expect(meta.skills ?? []).toEqual(role.skills);
    for (const skill of role.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
  });

  it('names no tool outside its grant, and only skills that exist, in the authored guidance', () => {
    const body = read().split('<!-- agents-united:floor:end -->')[1];
    const catalog = new Set(loadToolPolicy('registry', 'claude').catalog.map(entry => entry.name));
    const held = new Set(declaredNames());
    for (const match of body.matchAll(/`([A-Za-z_][\w-]*)`/g)) {
      const token = match[1];
      if (catalog.has(token) || token.startsWith('mcp__')) {
        const covered = held.has(token) || [...held].some(tool => tool.startsWith('mcp__') && token.startsWith(`${tool}__`));
        expect(covered, `${token} is named but not granted`).toBe(true);
      }
    }
    // Only a table whose second column is headed "Skill" names skills; other tables (bundles, say) are not checked here.
    let inSkillTable = false;
    for (const line of body.split('\n')) {
      if (/^\|[^|]*\|\s*Skill\s*\|/.test(line)) inSkillTable = true;
      else if (!line.startsWith('|')) inSkillTable = false;
      const row = inSkillTable ? /^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/.exec(line) : null;
      if (row) expect(fs.existsSync(path.resolve('registry/skills', row[1], 'SKILL.md')), `skill ${row[1]}`).toBe(true);
    }
  });
});
