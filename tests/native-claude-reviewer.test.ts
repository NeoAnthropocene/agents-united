import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkFloor, checkHooks, syncFloor, syncHooks } from '../src/core/native-floor.js';
import { spawnSync } from 'node:child_process';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { readOnlyGuardHooks } from '../src/core/readonly-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 PR E, milestone 1 — the native Claude `code-reviewer` (reviewer vertical slice).
 * The file is authored; its Contract Floor block and its guard hooks are generated (regenerate with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-claude-reviewer.test.ts`). Tools must equal the class-derived grant.
 */

const FILE = path.resolve('registry/hosts/claude/agents/code-reviewer.md');
const MCP_READ_TOOLS = [
  'mcp__github__search_code',
  'mcp__github__get_file_contents',
  'mcp__github__list_pull_requests',
  'mcp__github__pull_request_read',
  'mcp__context7__resolve-library-id',
  'mcp__context7__query-docs',
];
/** The destructive-command guard (guard.ts) is subsumed here: the read-only guard already blocks every shell and file writer. */
const guardGroups = (): Record<string, unknown> => ({ ...readOnlyGuardHooks() });

let core: SemanticCore;
beforeAll(async () => {
  core = (await loadSemanticCore('registry')).get('subagent-code-reviewer')!;
  if (process.env.UPDATE_NATIVE === '1') {
    fs.writeFileSync(FILE, syncHooks(syncFloor(fs.readFileSync(FILE, 'utf8'), core), guardGroups()));
  }
});

const read = (): string => fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);

describe('native Claude code-reviewer', () => {
  it('honors the Contract Floor from the Semantic Core, exactly as generated', () => {
    expect(checkFloor(read(), core)).toEqual([]);
  });

  it('carries the read-only guard, exactly as generated, and the embedded guard really blocks', () => {
    expect(checkHooks(read(), guardGroups())).toEqual([]);
    const groups = frontmatter().hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ command: string; args: string[] }> }>;
    expect(groups).toHaveLength(1);
    const { command, args } = groups[0].hooks[0];
    expect([command, args[0]]).toEqual(['node', '-e']);
    const fire = (tool_name: string, tool_input: object): number | null =>
      spawnSync(command, args, { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' }).status;
    expect(fire('Write', { file_path: 'C:\repo\src\a.ts' })).toBe(2);
    expect(fire('Bash', { command: 'git push --force' })).toBe(2);
    expect(fire('mcp__github__create_pull_request', {})).toBe(2);
    expect(fire('Grep', { pattern: 'x' })).toBe(0);
    expect(fire('mcp__github__get_file_contents', {})).toBe(0);
  });

  it('grants exactly the class-derived tools plus the read-only server tools', () => {
    const policy = loadToolPolicy('registry', 'claude');
    const grant = resolveGrant(policy, core.capabilities ?? [], { subagent: true, background: true });
    const declared = String(frontmatter().tools).split(',').map(tool => tool.trim());
    expect(declared.filter(tool => !tool.startsWith('mcp__')).sort()).toEqual([...grant.tools].sort());
    expect(declared.filter(tool => tool.startsWith('mcp__')).sort()).toEqual([...MCP_READ_TOOLS].sort());
  });

  it('has Glob and Grep, and no shell, writer, delegation or workflow tool', () => {
    const declared = String(frontmatter().tools).split(',').map(tool => tool.trim());
    expect(declared).toEqual(expect.arrayContaining(['Glob', 'Grep', 'LSP', 'Read']));
    for (const forbidden of ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Agent', 'Workflow', 'CronCreate']) {
      expect(declared, forbidden).not.toContain(forbidden);
    }
    expect(declared.some(tool => /^mcp__[^_]+(__)?$/.test(tool)), 'no server-level grant').toBe(false);
  });

  it('keeps the frontmatter small and the description short enough for delegation routing', () => {
    const meta = frontmatter();
    expect(meta.name).toBe('code-reviewer');
    expect(String(meta.description).length).toBeLessThanOrEqual(300);
    expect(meta.permissionMode).toBe('plan');
    expect(meta.skills).toEqual(['security-audit']);
    for (const skill of meta.skills as string[]) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
  });

  it('names no tool outside its grant in the authored guidance', () => {
    const body = read().split('<!-- agents-united:floor:end -->')[1];
    const declared = new Set(String(frontmatter().tools).split(',').map(tool => tool.trim()));
    for (const match of body.matchAll(/`(mcp__[a-z0-9_-]+__[a-z0-9_-]+)`/g)) expect(declared.has(match[1]), match[1]).toBe(true);
    for (const tool of ['Grep', 'Glob', 'LSP', 'Read', 'Skill', 'SubagentHandback']) expect(declared.has(tool), tool).toBe(true);
  });
});
