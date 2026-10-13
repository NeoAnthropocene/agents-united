import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { CLASS_DEFINITIONS } from '../src/core/capability-classes.js';
import { loadToolPolicy } from '../src/core/host-profile.js';
import { splitTools } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';

/**
 * ADR 0054 (2026-10-13). In R4, the full-team run on the opening of ADR 0053, the digital-agency lead called `ListAgents` once, before it spawned its second Ava, and the result listed four of the
 * maintainer's other sessions by title, local and cloud. Every native Claude role held the tool, through the `messaging` class that also gives `SendMessage`. The maintainer: "Unless this is not intended by
 * the user the lead shouldn't reach the other agents outside its own session." So the tool that finds sessions outside the team moves to a class that no role declares, the native roles lose it, and the
 * lead's text says who it may message. This suite keeps all three, and keeps `SendMessage`, which a team needs.
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const files = fs.readdirSync(AGENTS).filter(file => file.endsWith('.md')).sort();
const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (file: string): string[] => {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(path.join(AGENTS, file), 'utf8').replace(/\r\n/g, '\n'))![1]!;
  return splitTools((yaml.parse(front) as { tools: string }).tools).map(tool => tool.split('(')[0]!);
};

describe('a native Claude role reaches its own team only (ADR 0054)', () => {
  it('finds the native roles, so that no test below passes on an empty list', () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
    expect(files).toContain('orchestrator-digital-agency.md');
    expect(files).toContain('agency-creative-designer.md');
  });

  it('holds no tool that lists the user\'s other sessions: no native role has ListAgents', () => {
    for (const file of files) expect(toolsOf(file), file).not.toContain('ListAgents');
  });

  it('keeps SendMessage in every native role that declares messaging, because a team needs it', async () => {
    const cores = await loadSemanticCore('registry');
    const messaging = [...cores.values()].filter(core => (core.capabilities ?? []).includes('messaging'));
    expect(messaging.length).toBeGreaterThanOrEqual(10);
    for (const file of files) expect(toolsOf(file), file).toContain('SendMessage');
  });

  it('catalogues ListAgents in the class peer-sessions, which no Semantic Core declares', async () => {
    const policy = loadToolPolicy('registry', 'claude');
    expect(policy.catalog.find(tool => tool.name === 'ListAgents')?.class).toBe('peer-sessions');
    expect(policy.catalog.find(tool => tool.name === 'SendMessage')?.class).toBe('messaging');
    expect(policy.classes['peer-sessions'].tools).toEqual(['ListAgents']);
    expect(CLASS_DEFINITIONS['peer-sessions']).toMatchObject({ grantable: true, readOnly: true });
    expect(CLASS_DEFINITIONS['peer-sessions'].description).toMatch(/other sessions/);
    const cores = await loadSemanticCore('registry');
    expect(cores.size).toBeGreaterThanOrEqual(14);
    for (const [stem, core] of cores) expect(core.capabilities ?? [], stem).not.toContain('peer-sessions');
  });

  it('says in the lead\'s text who it may message: the teammates it spawned, and nobody else', () => {
    const lead = read('registry/hosts/claude/agents/orchestrator-digital-agency.md');
    expect(lead).toContain('**Your own session only.**');
    const paragraph = /\*\*Your own session only\.\*\*([^\n]*)/.exec(lead)![1]!;
    expect(paragraph).toMatch(/teammates you spawned, by the names you gave them/);
    expect(paragraph).toMatch(/the only ones you message/);
    expect(paragraph).toMatch(/other sessions, local or cloud/);
    expect(paragraph).toMatch(/not the user's word/);
    expect(paragraph).toMatch(/they name it and say so/);
    // The guidance names no tool that the lead does not hold (tests/native-claude-agents.test.ts), so the tool that lists sessions is described and never named in backticks.
    expect(lead).not.toContain('`ListAgents`');
  });

  it('is decided in ADR 0054, with the maintainer\'s words, the observation, the class and what was not built', () => {
    const name = fs.readdirSync(path.resolve('docs/adr')).find(file => file.startsWith('0054-'));
    expect(name).toBeDefined();
    const adr = read(`docs/adr/${name}`);
    expect(adr).toMatch(/^# ADR 0054: /);
    expect(adr).toContain("Unless this is not intended by the user the lead shouldn't reach the other agents outside its own session.");
    expect(adr).toContain('2026-10-13-claude-2.1.296-r4-full-team.md');
    expect(adr).toMatch(/`peer-sessions`/);
    expect(adr).toMatch(/\*\*Not built\*\*/);
    expect(adr).toMatch(/guard on `SendMessage`/);
    expect(read('CONTEXT.md')).toMatch(/\*\*Own-session reach\*\*:/);
  });
});
