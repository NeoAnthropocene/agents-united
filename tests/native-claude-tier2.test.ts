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

  // Observed on Claude Code 2.1.289 (Plan 035 H4 and H3, 2026-10-05): the step above was in the bodies and was not followed. Ava, and Kaan in
  // two sessions, wrote and marked their task completed within 1.5 s with no `Read` after the write, and two of them said "I did not re-read the
  // file". The re-read now stands in front of the completion update, where the decision is made.
  it('re-reads before it marks its task completed, and says why a successful write is not a check', () => {
    expect(afterFloor(name)).toMatch(/\*\*Hand back\.\*\* Re-read what you wrote with `Read` first, before you mark your task completed and before you report: a `Write` or `Edit` that says it succeeded is not a check/);
  });

  // Observed on Claude Code 2.1.291 (Plan 035 H1 rerun, 2026-10-06, session 3a0dca4d): Yavuz wrote his file, read lines 36 to 42, trimmed one line
  // with an `Edit` to meet the 40-line cap and marked the task completed in the same response as the edit, then reported "I did not re-read the
  // file after the edit". Four of five shell-less roles re-read correctly; the rule had no word for a write that comes after the re-read.
  it('starts the re-read over after a later edit, and never completes in the same response as a write or an edit', () => {
    expect(afterFloor(name)).toMatch(/A later `Edit` or `Write` starts the re-read over: `Read` the changed file again before you mark the task completed, and never put the completion update in the same response as a write or an edit/);
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

// Observed on Claude Code 2.1.291 (Plan 035 H9, 2026-10-06): the lead told Emre and Selin to use Playwright and chrome-devtools-mcp, which were not
// connected ("Emre and Selin have Playwright and chrome-devtools-mcp in their own tool lists"), offered a script or an npm install and never the servers,
// ran no `claude mcp add`, checked nothing and gave no restart command; for GitHub it delegated to Defne first and printed a `gh` fallback for "print
// the command". The maintainer's probe: a server added to `.mcp.json` mid-session is absent from the running session, `/mcp reconnect` says "not found",
// and a restart offers it for approval.
describe('the lead: the preflight of the integrations the plan needs', () => {
  const HEADING = '\n## Preflight: the integrations the plan needs';
  const body = (): string => afterFloor(LEAD);
  const preflight = (): string => {
    const text = body();
    const start = text.indexOf(HEADING);
    expect(start, 'the Preflight section exists').toBeGreaterThan(-1);
    const end = text.indexOf('\n## ', start + 5);
    return text.slice(start, end === -1 ? undefined : end);
  };

  it('sits between the plan and the team, and runs before the first task or spawn', () => {
    const text = body();
    expect(text.indexOf('\n## Plan with the user')).toBeLessThan(text.indexOf(HEADING));
    expect(text.indexOf(HEADING)).toBeLessThan(text.indexOf('\n## Run the team'));
    expect(preflight()).toMatch(/before the first `TaskCreate` or `Agent` call/);
  });

  it('takes a role\'s tool list for an allowlist, not for proof, and checks in its own session with ToolSearch', () => {
    expect(preflight()).toMatch(/allowlist, not proof that a server is connected/);
    expect(preflight()).toMatch(/check each one in this session with `ToolSearch`/);
    expect(preflight()).toMatch(/Never delegate a slice whose integration is not callable/);
  });

  it('classes the missing servers: four need no account or key, four need a credential', () => {
    const text = preflight();
    expect(text).toMatch(/No account or key:[^\n]*context7[^\n]*playwright[^\n]*chrome-devtools-mcp[^\n]*markitdown/);
    expect(text).toMatch(/Needs a credential:[^\n]*github[^\n]*firecrawl[^\n]*stitch[^\n]*figma/);
  });

  it('loads mcp-setup when a needed server is missing, not only when the user asks', () => {
    expect(body()).toMatch(/\| Connecting an integration \| `mcp-setup` \| An integration the plan needs is missing, or the user asks to set one up \|/);
    expect(preflight()).toMatch(/Load `mcp-setup` and read its Claude Code reference before you propose a package/);
    // Observed in the H9 retest: a lead that skipped the skill installed `@playwright/mcp@latest` from memory.
    expect(preflight()).toMatch(/install the command it gives, pinned, never one from memory/);
    expect(preflight()).toMatch(/its version, its source and anything it downloads/);
    expect(preflight()).not.toMatch(/290 MB/);
  });

  it('asks before it installs, installs in project scope with `--` before the command, and checks the install', () => {
    const text = preflight();
    expect(text).toMatch(/`AskUserQuestion`/);
    expect(text).toContain('claude mcp add --scope project <name> -- <command> [args]');
    expect(text).toMatch(/never user scope or local scope/);
    expect(text).toMatch(/only after a yes/);
    expect(text).toContain('`claude mcp get <name>`');
    expect(text).toContain('`claude mcp list`');
    expect(text).toMatch(/anything it downloads/);
  });

  it('knows a running session never loads a server added later, and ends the install with a restart command and a starting prompt', () => {
    const text = preflight();
    expect(text).toMatch(/A running session never loads a server added after it started/);
    expect(text).toMatch(/`\/mcp reconnect` says it is not found/);
    expect(text).toMatch(/spawn nobody, create no deliverable/);
    expect(text).toContain('claude --continue --agent orchestrator-digital-agency');
    expect(text).toMatch(/both team variables/);
    expect(text).toMatch(/Use this MCP server/);
    expect(text).toMatch(/\*\*starting prompt\*\*/);
    expect(text).toMatch(/at most 25 lines/);
    expect(text).toMatch(/A resume does not restore teammates/);
  });

  it('never asks for a key in the chat and prints a command with a placeholder for a credentialed server', () => {
    const text = preflight();
    expect(text).toMatch(/Never ask for a key in the chat/);
    expect(text).toContain('<your-token>');
    expect(text).toMatch(/Limited Operational/);
  });

  it('checks again after the restart, before it spawns anyone', () => {
    expect(preflight()).toMatch(/When you are back after the restart,\*{0,2} check again with `ToolSearch` before you spawn anyone/);
  });
});
