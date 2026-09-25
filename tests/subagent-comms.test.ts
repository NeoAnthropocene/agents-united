import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { HOST_DIALECTS } from '../src/core/dialects.js';
import { scanCoreForHostTokens } from '../src/core/semantic-core.js';
import { PILOT_STEMS, runPipeline } from './helpers/created-golden.js';

/**
 * Plan 022 Step 1 — cross-subagent comms conformance suite (C1–C7).
 *
 * Gate 7 proved peer messages are delivered but read only at the receiver's NEXT step, so a
 * specialist that ends its turn after sending never sees the reply. The remediation is a comms
 * law carried in canonical (host-neutral, Plan 018) and bound per host (ADR 0021):
 *   C1 hub-and-spoke by default (the coordinator is the relay point);
 *   C2 inbox check before the final report;
 *   C3 no message to a peer that already finished (the coordinator wakes it);
 *   C4 live-session reply allowance only when the coordinator set it up;
 *   C5 the final report is the one hand-back (no mid-run messages to the lead's main thread);
 *   C6 report sections `Peer messages received` + `Open items` (a missing peer never hangs);
 *   C7 the coordinator's delegation brief (spawn template) + relay / wake-up duty.
 */
const AGENTS_DIR = path.resolve(process.cwd(), 'registry', 'agents');
const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();
const specialists = files.filter(f => f.startsWith('subagent-'));
const coordinators = files.filter(f => f.startsWith('orchestrator-'));
const read = (f: string): string => fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');
const render = (f: string): string =>
  ClaudeProjector.renderRole(read(f), `agents/${f.replace(/^subagent-/, '')}`).content;

/** The section body between its heading and the next `## ` heading. */
function section(body: string, heading: RegExp): string | undefined {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(line => heading.test(line));
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

const SPECIALIST_HEADING = /^## .*Inbox Discipline & Handoff Report/;
const SPECIALIST_CLAUSES: ReadonlyArray<[string, RegExp]> = [
  ['C1 hub-and-spoke', /Hub-and-spoke by default/],
  ['C2 inbox check', /Check your inbox before your final report/],
  ['C3 no message to a finished peer', /No message to a peer that has already finished/],
  ['C4 live-session allowance', /live session/],
  ['C5 one hand-back', /Your final report is your one hand-back/],
  ['C6 missing peer never hangs', /Never hang on a missing peer/],
  ['C6 Peer messages received', /`Peer messages received`/],
  ['C6 Open items', /`Open items`/],
];
const COORDINATOR_HEADING = /^## .*Delegation Brief & Relay Protocol/;
const COORDINATOR_CLAUSES: ReadonlyArray<[string, RegExp]> = [
  ['C7 brief: objective', /\*\*Objective\*\*/],
  ['C7 brief: scope', /\*\*Scope & boundaries\*\*/],
  ['C7 brief: acceptance evidence', /\*\*Acceptance evidence\*\*/],
  ['C7 brief: peer routing', /\*\*Peers & dependencies\*\*/],
  ['C7 brief: report format', /\*\*Report format\*\*[^\n]*`Peer messages received`[^\n]*`Open items`/],
  ['C3/C7 relay & wake-up', /wake the finished peer/],
  ['C6 missing report', /missing specialist report/i],
];
/** Plan 018 host neutrality: no tool or host nouns in the canonical comms law. */
const HOST_NOUNS = /SendMessage|SubagentHandback|\bAgent\(|`Agent`|send_message|invoke_subagent|TaskCreate|\bClaude\b|\bCline\b|Antigravity/;

describe('Plan 022 comms law — canonical specialists (C1–C6)', () => {
  it('every specialist carries the host-neutral Inbox Discipline & Handoff Report section', () => {
    const violations: string[] = [];
    for (const file of specialists) {
      const body = section(read(file), SPECIALIST_HEADING);
      if (!body) {
        violations.push(`${file}: missing the Inbox Discipline & Handoff Report section`);
        continue;
      }
      for (const [label, pattern] of SPECIALIST_CLAUSES) {
        if (!pattern.test(body)) violations.push(`${file}: missing ${label}`);
      }
      const noun = body.match(HOST_NOUNS);
      if (noun) violations.push(`${file}: comms section names a host/tool (${noun[0]})`);
    }
    expect(specialists.length).toBeGreaterThan(0);
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('no specialist is told to spawn its own peers (hub-and-spoke replaces nested spawning)', () => {
    const offenders = specialists.filter(file => /spawn that peer yourself/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('the section survives Claude rendering for every specialist', () => {
    const lost = specialists.filter(file => !SPECIALIST_HEADING.test(render(file).split('\n').find(l => SPECIALIST_HEADING.test(l)) ?? ''));
    expect(lost).toEqual([]);
  });
});

describe('Plan 022 comms law — coordinators (C7)', () => {
  it('every orchestrator carries the Delegation Brief & Relay Protocol', () => {
    const violations: string[] = [];
    for (const file of coordinators) {
      const body = section(read(file), COORDINATOR_HEADING);
      if (!body) {
        violations.push(`${file}: missing the Delegation Brief & Relay Protocol section`);
        continue;
      }
      for (const [label, pattern] of COORDINATOR_CLAUSES) {
        if (!pattern.test(body)) violations.push(`${file}: missing ${label}`);
      }
      const noun = body.match(HOST_NOUNS);
      if (noun) violations.push(`${file}: brief section names a host/tool (${noun[0]})`);
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('Plan 022 comms law — Semantic Core invariants + Claude bindings (created lane)', () => {
  const SPECIALIST_INVARIANTS = [
    'Check for delivered peer messages before the final report.',
    'The handoff report lists peer messages received and open items.',
  ];
  const COORDINATOR_INVARIANTS = [
    'Every delegation brief carries objective, scope, acceptance evidence, peer routing, and report format.',
    'The coordinator relays between specialists and wakes a finished peer before expecting its reply.',
  ];

  it('the comms invariants are tool-free (gate 2 corpus)', () => {
    expect([...SPECIALIST_INVARIANTS, ...COORDINATOR_INVARIANTS].flatMap(scanCoreForHostTokens)).toEqual([]);
  });

  it('HOST_DIALECTS.claude binds every comms invariant', () => {
    const bound = new Set(HOST_DIALECTS.claude.invariantBindings.map(entry => entry.invariant));
    const unbound = [...SPECIALIST_INVARIANTS, ...COORDINATOR_INVARIANTS].filter(inv => !bound.has(inv));
    expect(unbound).toEqual([]);
  });

  it('every pilot core carries its role comms invariants and the created output binds them', async () => {
    const violations: string[] = [];
    for (const stem of PILOT_STEMS) {
      const pipeline = await runPipeline(stem);
      const expected = stem.startsWith('orchestrator-') ? COORDINATOR_INVARIANTS : SPECIALIST_INVARIANTS;
      for (const invariant of expected) {
        if (!pipeline.core.invariants.includes(invariant)) violations.push(`${stem}: core lacks "${invariant}"`);
        const line = pipeline.created.split('\n').findIndex(l => l.endsWith(invariant));
        if (line < 0) violations.push(`${stem}: created output lacks "${invariant}"`);
        else if (/no host binding declared/.test(pipeline.created.split('\n')[line + 1] ?? '')) {
          violations.push(`${stem}: "${invariant}" is unbound in the created output`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
