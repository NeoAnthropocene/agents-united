import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectNativeAgent, splitTools } from '../src/core/native-guard.js';
import { ROSTER_END, ROSTER_START, checkRoster, domainTypes, renderRoster, syncRoster } from '../src/core/native-roster.js';
import type { RosterType } from '../src/core/native-roster.js';

/**
 * Plan 032 PR E — the orchestrator's domain map: every specialist type of its domain, the bundle that provides it, and what a
 * native specialist can do on this host. Generated, so it cannot drift from the bundles or from the agents.
 */

describe('splitTools', () => {
  it('splits on top-level commas only, so an Agent allowlist stays one entry', () => {
    expect(splitTools('Agent(a, b, c), Read, Bash')).toEqual(['Agent(a, b, c)', 'Read', 'Bash']);
    expect(splitTools('')).toEqual([]);
    expect(splitTools(undefined)).toEqual([]);
  });

  it('is what inspectNativeAgent uses for the tools of an agent file', () => {
    const facts = inspectNativeAgent('---\nname: x\ntools: Agent(a, b), Read, mcp__github\n---\n');
    expect(facts.tools).toEqual(['Agent(a, b)', 'Read', 'mcp__github']);
  });
});

const BUNDLES = {
  alpha: { name: 'alpha', domain: 'eng', orchestrator: 'orchestrator-eng.md', agents: ['subagent-one.md', 'subagent-two.md'] },
  beta: { name: 'beta', domain: 'eng', agents: ['subagent-two.md', 'subagent-three.md'] },
  gamma: { name: 'gamma', domain: 'other', agents: ['subagent-zed.md'] },
} as never;

describe('domainTypes', () => {
  it('lists every specialist of the coordinator\'s domain once, sorted, with every bundle that provides it', () => {
    expect(domainTypes(BUNDLES, 'alpha')).toEqual([
      { name: 'one', bundles: ['alpha'] },
      { name: 'three', bundles: ['beta'] },
      { name: 'two', bundles: ['alpha', 'beta'] },
    ]);
  });

  it('never lists the coordinator itself, other domains, or an unknown bundle', () => {
    expect(domainTypes(BUNDLES, 'alpha').map(t => t.name)).not.toContain('zed');
    expect(() => domainTypes(BUNDLES, 'missing')).toThrow(/missing/);
  });
});

describe('renderRoster / syncRoster', () => {
  const types: RosterType[] = [
    {
      name: 'reader',
      bundles: ['alpha'],
      native: { description: 'Reads code.', tools: ['Glob', 'Grep', 'Read', 'mcp__github__search_code'], guard: 'read-only' },
    },
    {
      name: 'builder',
      bundles: ['alpha', 'beta'],
      native: { description: 'Builds code.', tools: ['Bash', 'Edit', 'Glob', 'Grep', 'Monitor', 'EnterWorktree', 'Write', 'mcp__github'], guard: 'destructive' },
    },
    { name: 'legacy', bundles: ['beta'] },
  ];

  it('states, per type, the providing bundles, the role and what it can do on this host', () => {
    const table = renderRoster(types);
    expect(table).toMatch(/\| `reader` \| `alpha` \|/);
    expect(table).toMatch(/\| `builder` \| `alpha`, `beta` \|/);
    const reader = table.split('\n').find(line => line.includes('`reader`'))!;
    expect(reader).toContain('Reads code.');
    expect(reader).toContain('read-only');
    expect(reader).toContain('Glob/Grep');
    expect(reader).toContain('MCP: github');
    const builder = table.split('\n').find(line => line.includes('`builder`'))!;
    expect(builder).toContain('edits files and runs commands');
    expect(builder).toContain('searches through Bash');
    expect(builder).toContain('Monitor');
    expect(builder).toContain('worktrees');
    const legacy = table.split('\n').find(line => line.includes('`legacy`'))!;
    expect(legacy).toMatch(/read its definition/i);
  });

  it('syncs only the block between the markers, idempotently, and refuses a file without exactly one pair', () => {
    const template = `intro\n\n${ROSTER_START}\nstale\n${ROSTER_END}\n\noutro\n`;
    const once = syncRoster(template, types);
    expect(once.startsWith('intro\n\n')).toBe(true);
    expect(once.endsWith('\n\noutro\n')).toBe(true);
    expect(once).not.toContain('stale');
    expect(syncRoster(once, types)).toBe(once);
    expect(checkRoster(once, types)).toEqual([]);
    expect(checkRoster(once.replace('Reads code.', 'Writes code.'), types)).toHaveLength(1);
    expect(() => syncRoster('no markers', types)).toThrow(/roster markers/);
    expect(() => syncRoster(`${ROSTER_START}\n${ROSTER_START}\n${ROSTER_END}`, types)).toThrow(/roster markers/);
  });
});

describe('the committed bundles', () => {
  it('give the engineering coordinator its fifteen specialist types, each from the bundles that declare it', () => {
    const raw = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: unknown };
    const types = domainTypes((raw.bundles ?? raw) as never, 'software-engineering');
    expect(types.map(t => t.name)).toEqual([
      'accessibility-lead', 'ai-model-architect', 'android-architect', 'backend-architect', 'code-reviewer', 'cross-platform-specialist',
      'data-engineer', 'devops-engineer', 'distributed-systems-architect', 'e2e-tester', 'frontend-architect', 'ios-architect',
      'ml-platform-engineer', 'qa-automation-lead', 'repo-index',
    ]);
    expect(types.find(t => t.name === 'frontend-architect')!.bundles).toEqual(['frontend-engineering', 'software-engineering']);
    expect(types.find(t => t.name === 'code-reviewer')!.bundles).toEqual(['software-engineering']);
  });
});
