import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { nativeGuardHooks } from '../src/core/guard.js';
import { checkFloor, checkHooks, syncFloor, syncHooks } from '../src/core/native-floor.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { readOnlyGuardHooks } from '../src/core/readonly-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 PR E — the native Claude agents (milestone 1: code-reviewer; milestone 2: backend-architect,
 * frontend-architect, repo-index). Each file is authored; its Contract Floor block and guard hooks are generated
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
  { name: 'code-reviewer', stem: 'subagent-code-reviewer', guard: 'read-only', permissionMode: 'plan', skills: ['security-audit'], serverTools: MCP_READ_TOOLS, mutating: false, mustHold: ['Glob', 'Grep', 'LSP', 'ReportFindings', 'ToolSearch'] },
  { name: 'repo-index', stem: 'subagent-repo-index', guard: 'read-only', permissionMode: 'plan', skills: [], serverTools: MCP_READ_TOOLS, mutating: false, mustHold: ['Glob', 'Grep', 'LSP', 'ToolSearch'] },
  { name: 'backend-architect', stem: 'subagent-backend-architect', guard: 'destructive', permissionMode: 'acceptEdits', skills: [], serverTools: ['mcp__github', 'mcp__context7'], mutating: true, mustHold: WRITER_MUST_HOLD },
  { name: 'frontend-architect', stem: 'subagent-frontend-architect', guard: 'destructive', permissionMode: 'acceptEdits', skills: [], serverTools: ['mcp__stitch', 'mcp__context7', 'mcp__chrome-devtools-mcp'], mutating: true, mustHold: WRITER_MUST_HOLD },
];

const WRITERS = ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const fileOf = (role: RoleSpec): string => path.resolve('registry/hosts/claude/agents', `${role.name}.md`);
const guardGroups = (role: RoleSpec): Record<string, unknown> => ({ ...(role.guard === 'read-only' ? readOnlyGuardHooks() : nativeGuardHooks()) });

let cores: Map<string, SemanticCore>;
beforeAll(async () => {
  cores = await loadSemanticCore('registry');
  if (process.env.UPDATE_NATIVE === '1') {
    for (const role of ROLES) {
      if (!fs.existsSync(fileOf(role))) continue;
      const ceiling = resolveGrant(loadToolPolicy('registry', 'claude'), cores.get(role.stem)!.capabilities ?? [], { subagent: true, background: false }).tools;
      const toolsLine = `tools: ${[...[...ceiling].sort(), ...role.serverTools].join(', ')}`;
      const synced = syncHooks(syncFloor(fs.readFileSync(fileOf(role), 'utf8'), cores.get(role.stem)!), guardGroups(role)).replace(/^tools: .*$/m, toolsLine);
      fs.writeFileSync(fileOf(role), synced);
    }
  }
});

describe.each(ROLES)('native Claude $name', role => {
  const read = (): string => fs.readFileSync(fileOf(role), 'utf8').replace(/\r\n/g, '\n');
  const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);
  const declared = (): string[] => String(frontmatter().tools).split(',').map(tool => tool.trim());

  it('honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(checkFloor(read(), cores.get(role.stem)!)).toEqual([]);
  });

  it('carries its guard, exactly as generated, and the embedded guard really blocks', () => {
    expect(checkHooks(read(), guardGroups(role))).toEqual([]);
    const groups = frontmatter().hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ command: string; args: string[] }> }>;
    const fire = (tool_name: string, tool_input: object): number | null => {
      const { command, args } = groups[0].hooks[0];
      return spawnSync(command, args, { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' }).status;
    };
    for (const group of groups) for (const hook of group.hooks) expect([hook.command, hook.args[0]]).toEqual(['node', '-e']);
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
    const core = cores.get(role.stem)!;
    const grant = resolveGrant(loadToolPolicy('registry', 'claude'), core.capabilities ?? [], { subagent: true, background: false });
    expect(declared()).toEqual(expect.arrayContaining(role.mustHold));
    expect(declared().filter(tool => !tool.startsWith('mcp__')).sort()).toEqual([...grant.tools].sort());
    expect(declared().filter(tool => tool.startsWith('mcp__')).sort()).toEqual([...role.serverTools].sort());
  });

  it('has Glob and Grep, and no delegation, workflow or scheduling tool', () => {
    expect(declared()).toEqual(expect.arrayContaining(['Glob', 'Grep', 'LSP', 'Read']));
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate']) expect(declared(), forbidden).not.toContain(forbidden);
    if (!role.mutating) for (const writer of WRITERS) expect(declared(), writer).not.toContain(writer);
    else expect(declared()).toEqual(expect.arrayContaining(['Bash', 'Edit', 'Write']));
  });

  it('keeps the frontmatter small and the description short enough for delegation routing', () => {
    const meta = frontmatter();
    expect(meta.name).toBe(role.name);
    expect(String(meta.description).length).toBeLessThanOrEqual(300);
    expect(meta.permissionMode).toBe(role.permissionMode);
    expect(meta.skills ?? []).toEqual(role.skills);
    for (const skill of role.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
  });

  it('names no tool outside its grant, and only skills that exist, in the authored guidance', () => {
    const body = read().split('<!-- agents-united:floor:end -->')[1];
    const catalog = new Set(loadToolPolicy('registry', 'claude').catalog.map(entry => entry.name));
    const held = new Set(declared());
    for (const match of body.matchAll(/`([A-Za-z_][\w-]*)`/g)) {
      const token = match[1];
      if (catalog.has(token) || token.startsWith('mcp__')) {
        const covered = held.has(token) || [...held].some(tool => tool.startsWith('mcp__') && token.startsWith(`${tool}__`));
        expect(covered, `${token} is named but not granted`).toBe(true);
      }
    }
    for (const match of body.matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)) {
      expect(fs.existsSync(path.resolve('registry/skills', match[1], 'SKILL.md')), `skill ${match[1]}`).toBe(true);
    }
  });
});
