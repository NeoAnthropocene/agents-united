import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { domainTypes } from '../src/core/native-roster.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { bundles, TIER2_COORDINATOR_BUNDLE } from './helpers/native-coordinator.js';
import { LEAD_COMMS_EVIDENCE, TEAMMATE_COMMS_EVIDENCE, TEAMMATE_COMMS_INVARIANTS } from './helpers/comms-law.js';

/**
 * Plan 032 close-out follow-up (2), slice 2 (ADR 0036) — the digital-agency package on Claude Agent Teams, and the Plan 022 comms law bound
 * to it. The generic conformance (floor, guard, class-derived tools, roster) is in tests/native-claude-agents.test.ts; this suite is
 * what only a team has: the lead that spawns named teammates, the two-mode law in every teammate's body, and what the host does and does
 * not apply to a teammate (observed on Claude Code 2.1.288, `host-library/claude/observations/2026-10-04-claude-2.1.288-agent-teams.md`).
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const read = (name: string): string => fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8').replace(/\r\n/g, '\n');
const afterFloor = (name: string): string => read(name).split('<!-- agents-united:floor:end -->')[1] ?? '';

const TEAMMATES: Array<{ name: string; stem: string }> = [
  { name: 'agency-growth-strategist', stem: 'subagent-marketing-growth-strategist' },
  { name: 'agency-creative-designer', stem: 'subagent-marketing-creative-designer' },
  { name: 'agency-conversion-specialist', stem: 'subagent-marketing-conversion-specialist' },
  { name: 'agency-content-strategist', stem: 'subagent-marketing-content-strategist' },
  { name: 'agency-campaign-specialist', stem: 'subagent-marketing-campaign-specialist' },
  { name: 'agency-seo-specialist', stem: 'subagent-seo-specialist' },
  { name: 'agency-qa-automation-lead', stem: 'subagent-qa-automation-lead' },
  { name: 'agency-compliance-grc-specialist', stem: 'subagent-compliance-grc-specialist' },
  { name: 'agency-frontend-architect', stem: 'subagent-frontend-architect' },
  // The Tier-1 specialist the agency no longer uses (it has its own copy, ADR 0039) still runs as a teammate for a user who spawns it: its
  // wording is two-mode too (maintainer decision, ADR 0036), and Tier-1 behaviour is unchanged.
  { name: 'frontend-architect', stem: 'subagent-frontend-architect' },
];
const LEAD = 'orchestrator-digital-agency';
/** The nine teammates of the AstrolabsAI team and the type that plays each (the four named on 2026-10-04: Selin, Emre, Defne, Deniz, ADR 0039). */
const PERSONAS: Record<string, string> = {
  Ava: 'agency-growth-strategist',
  Kaan: 'agency-conversion-specialist',
  Jamileh: 'agency-creative-designer',
  Yavuz: 'agency-content-strategist',
  Jale: 'agency-campaign-specialist',
  Selin: 'agency-seo-specialist',
  Deniz: 'agency-frontend-architect',
  Emre: 'agency-qa-automation-lead',
  Defne: 'agency-compliance-grc-specialist',
};

describe('the cores of the teammates carry the same peer-messaging law', async () => {
  const cores = await loadSemanticCore('registry');
  it.each(TEAMMATES)('$stem states all six comms invariants verbatim', ({ stem }) => {
    expect(cores.get(stem)?.invariants ?? []).toEqual(expect.arrayContaining([...TEAMMATE_COMMS_INVARIANTS]));
  });
  it('the lead states the relay, contract-first and brief invariants', () => {
    expect(cores.get(LEAD)?.invariants ?? []).toEqual(
      expect.arrayContaining([
        'The coordinator relays between specialists and wakes a finished peer before expecting its reply.',
        'Shared interfaces are delegated contract-first and handed to parallel slices as fixed inputs.',
        'Every delegation brief carries objective, scope, acceptance evidence, peer routing, and report format.',
        'A brief lists the peers a specialist may message directly only when a live team session runs; otherwise peers are reached through the coordinator.',
      ]),
    );
  });
});

describe.each(TEAMMATES)('teammate $name', ({ name }) => {
  it.each(TEAMMATE_COMMS_EVIDENCE.map(entry => [entry.invariant, entry.evidence] as const))('binds "%s" to Agent Teams in its body', (_invariant, evidence) => {
    expect(afterFloor(name)).toMatch(evidence);
  });

  it('can reach a peer by name and cannot spawn one', () => {
    const tools = inspectNativeAgent(read(name)).tools.map(tool => tool.split('(')[0]);
    expect(tools).toContain('SendMessage');
    expect(tools).not.toContain('Agent');
  });

  it('no longer forbids a sibling message outright', () => {
    expect(afterFloor(name)).not.toMatch(/Do not message a sibling subagent/);
  });

  it('loads its skills through the Skill tool, because a teammate never preloads a definition\'s skills', () => {
    const body = afterFloor(name);
    expect(inspectNativeAgent(read(name)).meta.skills ?? []).toEqual([]);
    expect(body).toMatch(/`Skill`/);
  });
});

describe.each(Object.entries(PERSONAS))('persona %s', (persona, type) => {
  it('is named in the description the lead routes by', () => {
    const description = String(inspectNativeAgent(read(type)).meta.description);
    expect(description).toContain(`(${persona})`);
    expect(description.length).toBeLessThanOrEqual(300);
  });

  it('is the name the role plays by, in its identity (a core persona) or in its own body (Deniz shares the persona-free frontend core)', () => {
    const text = type === 'agency-frontend-architect' ? afterFloor(type) : read(type);
    expect(text).toMatch(new RegExp(`You are \\*\\*${persona}\\*\\*|In the digital agency you are ${persona}`));
  });
});

// Observed in the full-roster live run (2026-10-04): Ava reported "38 lines" for a file of 29, and said she had not read it back; Kaan, Jamileh,
// Yavuz and Jale reported estimated line counts. The five roles that hold editors and no shell re-read what they wrote, and label what they did not check.
describe.each(['agency-growth-strategist', 'agency-conversion-specialist', 'agency-creative-designer', 'agency-content-strategist', 'agency-campaign-specialist'])('shell-less teammate %s', name => {
  it('re-reads what it wrote before it reports, and labels an unchecked figure as an estimate', () => {
    expect(afterFloor(name)).toMatch(/\*\*Hand back\.\*\* Re-read what you wrote with `Read` first[^\n]*did not run is an estimate/);
    expect(inspectNativeAgent(read(name)).tools.map(tool => tool.split('(')[0])).toContain('Read');
  });
});

describe('the lead', () => {
  const lead = (): string => read(LEAD);

  it('spawns exactly the roster of its domain, by the names the roster gives (the agency-only copies, not the shared marketing roles)', () => {
    const roster = domainTypes(bundles(), TIER2_COORDINATOR_BUNDLE).map(type => type.name);
    const declared = /Agent\(([^)]*)\)/.exec(String(inspectNativeAgent(lead()).meta.tools))?.[1].split(',').map(name => name.trim());
    expect(declared).toEqual(roster);
    expect(roster).toEqual([
      'agency-campaign-specialist', 'agency-compliance-grc-specialist', 'agency-content-strategist', 'agency-conversion-specialist', 'agency-creative-designer',
      'agency-frontend-architect', 'agency-growth-strategist', 'agency-qa-automation-lead', 'agency-seo-specialist',
    ]);
    for (const shared of ['marketing-growth-strategist', 'frontend-architect', 'seo-specialist']) expect(roster).not.toContain(shared);
  });

  it('does not hold the Workflow tool, because the bundle ships no workflow', () => {
    expect(inspectNativeAgent(lead()).tools.map(tool => tool.split('(')[0])).not.toContain('Workflow');
  });

  it.each(LEAD_COMMS_EVIDENCE.map(entry => [entry.what, entry.evidence] as const))('says: %s', (_what, evidence) => {
    expect(afterFloor(LEAD)).toMatch(evidence);
  });

  it('maps each persona the bundle names to the teammate type that plays it', () => {
    const body = afterFloor(LEAD);
    for (const [persona, type] of Object.entries(PERSONAS)) {
      const row = body.split('\n').find(line => line.startsWith(`| ${persona} |`) && line.includes(`\`${type}\``));
      expect(row, `${persona} is mapped to ${type}`).toBeDefined();
    }
    expect(body, 'no persona row is left without a name').not.toMatch(/\| \(none\) \|/);
  });

  it('spawns each teammate by the persona\'s lower-case name, the nine of them', () => {
    const body = afterFloor(LEAD);
    const spawn = body.split('\n').find(line => line.startsWith('**Spawn each teammate with one `Agent` call'));
    expect(spawn).toBeDefined();
    for (const persona of Object.keys(PERSONAS)) expect(spawn, persona).toContain(`\`${persona.toLowerCase()}\``);
  });

  it('puts every persona on the Assembly Line by name', () => {
    const line = afterFloor(LEAD).split('\n').find(row => row.startsWith('**The Agency Assembly Line.**')) ?? '';
    for (const persona of Object.keys(PERSONAS)) expect(line, persona).toContain(persona);
  });

  it('is started as the main agent, and says what to do when it was spawned as a subagent', () => {
    const body = afterFloor(LEAD);
    expect(body).toMatch(/claude --agent orchestrator-digital-agency/);
    expect(body).toMatch(/spawned as a subagent/i);
  });
});
