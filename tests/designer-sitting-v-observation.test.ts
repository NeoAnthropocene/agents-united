import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting V (run on 2026-10-13 by the maintainer, Claude Code 2.1.296): G1 and a bare "Hi", two interactive sessions, in folders built from the clone at `1fe466e` (the tip of PR 200), with no image
 * server and no key. Both opened as ADR 0053 says and showed no red hook error: in G1 the line was the lead's second message and the first gated call, the `Agent` spawn of Emre, was released at the hook's first
 * look (`released`, `by: line`, 1 ms); in Hello the lead wrote the line and one short question and nothing else. The waiting gate did not have to wait, and the observation says so. Like the pins of the earlier
 * sittings, this suite makes the observation checkable: the ledger agrees with the sessions' own cost records kept beside it, the prompts are those of the protocol, the counts of the table are the counts in it,
 * the gate's log is the one that was written, and the protocol, ADR 0053 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-13-claude-2.1.296-designer-sitting-v.md';
const RECORDS = path.join(OBS_DIR, '2026-10-13-sitting-v-records');
const G1_SESSION = '8bec7cdc-1432-4439-bc89-604d082b37bf';
const HELLO_SESSION = '976a6079-01ef-4de1-ad97-84053a1af794';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(path.join(OBS_DIR, NAME));
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0053-the-opening-of-a-tier-2-orchestrator-is-its-operation-mode-information.md'));
const PLAN = text(path.resolve('plans/036-claude-creative-designer-improvement.md'));
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const protocolSection = (heading: string): string => {
  const start = PROTOCOL.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};

describe('the Sitting V observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone, that an interactive session has no cap, the two sessions, and that no key was involved', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('1fe466e');
    expect(o).toMatch(/21 files compared with the clone before each run, all equal, the gate script among them/);
    expect(o).toMatch(/There is no `--max-budget-usd` in an interactive session/);
    expect(o).toMatch(/no image server and no key/);
    for (const id of [G1_SESSION, HELLO_SESSION]) expect(o).toContain(id);
  });

  it('keeps the prompts, and they are those of the protocol', () => {
    const g1 = /type "(Scratch exercise, no real client\. Consult emre read-only first:[^"]*)"/.exec(PROTOCOL);
    expect(g1).not.toBeNull();
    expect(record('prompt-g1.txt').trim()).toBe(g1![1]);
    expect(record('prompt-hello.txt').trim()).toBe('Hi');
    expect(protocolSection('## H11 ')).toMatch(/Hello: one message, `Hi`/);
  });

  it('keeps the cost records, and the ledger agrees with them', () => {
    const cost = record('usage-and-cost.txt');
    expect(cost).toContain(G1_SESSION);
    expect(cost).toContain(HELLO_SESSION);
    expect(cost).toMatch(/totalCostUSD 0\.51425/);
    expect(cost).toMatch(/totalCostUSD 0\.20927/);
    const o = observation();
    expect(o).toMatch(/\| 1 \| G1, a consultation ordered in the prompt \| `8bec7cdc-1432-4439-bc89-604d082b37bf` \| 7 \| 59 s \| 55 s \| 0\.5143 \|/);
    expect(o).toMatch(/\| 2 \| Hello, a bare "Hi" \| `976a6079-01ef-4de1-ad97-84053a1af794` \| 3 \| 8 s \| 9 s \| 0\.2093 \|/);
    expect(o).toMatch(/0\.7235 USD in 2 prompts/);
    expect(o).toMatch(/no longer interested in cost calculations/);
  });

  it('reads G1 from the kept summary: no hold, the line in message 2, the first gated call in message 3, nothing like a welcome', () => {
    const s = record('g1-summary.txt');
    expect(s).toContain('SUMMARY holds=0 in 0 message(s)');
    expect(s).toContain('line: message 2 at +8.1s');
    expect(s).toContain('first gated call: message 3 at +12.4s');
    expect(s).toContain('line written before the first gated call: yes');
    expect(s).toContain('welcome words: none');
    expect(s).toMatch(/msg\s+2 \+\s*8\.1s\s+LINE "Mode: Limited Operational\. Callable: Context7, Firecrawl\. Missing: GitHub, Pla"\s+ToolSearch x1/);
    expect(record('g1-gate-timeline.txt')).toContain('lead DG9yKg text: Mode: Limited Operational. Callable: Context7, Firecrawl. Missing: GitHub, Playwright, Chrome DevTools, Figma. Extras: Stitch.');
    expect(s).toMatch(/msg\s+3 \+\s*12\.4s\s+\(no text\)\s+Agent:PASS/);
  });

  it('keeps the gate\'s log: one decision, the first look, the line already in the file, and the session done', () => {
    const log = record('gate-log-g1.txt');
    const entries = [...log.matchAll(/^\{.*\}$/gm)].map(m => JSON.parse(m[0]) as Record<string, unknown>);
    expect(entries.filter(e => e.event)).toEqual([{ at: '2026-10-13T07:57:08.061Z', tool: 'Agent', event: 'released', by: 'line', waitedMs: 1 }]);
    expect(entries.filter(e => !e.event)).toEqual([{ done: true, version: 2 }]);
    expect(log).toContain('{"done":true,"version":2}');
    expect(log).toMatch(/The hello session \(976a6079[^)]*\) has no log/);
  });

  it('shows in the G1 timeline: no hook error, the line once, the relay in four sentences and the shutdown approved on the first request', () => {
    const t = record('g1-gate-timeline.txt');
    expect(t).not.toMatch(/hook error/);
    expect(t.match(/lead \w+ text: Mode: Limited Operational\./g)).toHaveLength(1);
    expect(t).toMatch(/call Agent \{"description":"Emre consultation: CTA test plan","name":"emre","subagent_type":"agency-qa-automation-lead"/);
    expect(t).toContain('Emre\'s plan covers three things. First,');
    expect(t).toContain('"type":"shutdown_approved"');
    expect(t).toMatch(/The decisions of the mode-line gate \(one line each\):\n\s+07:57:08\.061 Agent released \{"by":"line","waitedMs":1\}/);
  });

  it('reads Hello from the kept record: the line and one question, no gated call, no gate log, no welcome', () => {
    const s = record('hello-summary.txt');
    expect(s).toContain('SUMMARY holds=0 in 0 message(s)');
    expect(s).toContain('line: message 2 at +7.2s');
    expect(s).toContain('first gated call: none');
    expect(s).toContain('welcome words: none');
    const t = record('hello-gate-timeline.txt');
    const words = [...t.matchAll(/lead \w+ text: (.*)$/gm)].map(m => m[1]);
    expect(words).toEqual(['Mode: Limited Operational. Callable: Context7, Firecrawl. Missing: GitHub, Playwright, Chrome DevTools, Figma. Extras: Stitch.', 'What would you like to work on?']);
    expect(t).toContain('(no gate log for this session: the hook never waited, held or released a call)');
  });

  it('counts the items of the pass line: 6 met and 1 not met', () => {
    const o = observation();
    const start = o.indexOf('| Item of the pass line (H11) |');
    expect(start).toBeGreaterThan(-1);
    const table = o.slice(start, o.indexOf('\n\n', start));
    expect((table.match(/\| Met \|/g) ?? []).length).toBe(6);
    expect((table.match(/\| Not met \|/g) ?? []).length).toBe(1);
    expect(table).toMatch(/G1: the relay is two sentences \| Not met \| four sentences/);
  });

  it('says what Sitting V found, and that the wait did not act', () => {
    const o = observation();
    expect(o).toMatch(/\*\*Both interactive sessions opened as ADR 0053 says and showed no red hook error\.\*\*/);
    expect(o).toMatch(/the waiting gate never had to wait/);
    expect(o).toMatch(/\*\*The waiting gate did not act\.\*\*/);
    expect(o).toMatch(/`released`, `by: line`, `waitedMs: 1`/);
    expect(o).toMatch(/4\.3 s later/);
    expect(o).toMatch(/does not show the wait absorbing a late save/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/That the wait absorbs a late save in an interactive session/);
    expect(o).toMatch(/"AS I can see that fixed our hook error problem\. And the agent outputs the "mode" correctly\."/);
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    const files = [path.join(OBS_DIR, NAME), ...walk(RECORDS)];
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) {
      const t = text(f);
      const rel = path.relative(OBS_DIR, f);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
  });
});

describe('the protocol, ADR 0053 and the plan state Sitting V', () => {
  it('records Sitting V as run, with its cost records and what it found', () => {
    const v = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting V |')) ?? '';
    expect(v).toMatch(/G1 again/);
    expect(v).toMatch(/H11/);
    expect(v).toMatch(/1\.5 USD and 2 prompts/);
    expect(v).toMatch(/proposed 2026-10-13; run 2026-10-13/);
    expect(v).toMatch(/used 0\.7235 USD of model cost in 2 prompts: 0\.5143 USD for G1 and 0\.2093 USD for Hello/);
    expect(v).toMatch(/no red hook error in either session/);
    expect(v).toMatch(/the waiting gate did not have to wait/);
    expect(v).not.toMatch(/not yet run/);
  });

  it('amends H10k with the result of Sitting V and marks its ceiling as run', () => {
    const k = protocolSection('## H10k ');
    expect(k).toMatch(/Amended 2026-10-13 \(Plan 036 S19, Sitting V/);
    expect(k).toContain(NAME);
    expect(k).toMatch(/\*\*No red hook error in either session, and the opening was the line alone\*\*/);
    expect(k).toMatch(/G1 met 4 of 5 items[^\n]*Hello 2 of 2/);
    expect(k).toMatch(/\*\*The waiting gate did not have to wait\*\*/);
    expect(k).toMatch(/Ceiling for Sitting V \(G1 and H11, two short sessions\): 1\.5 USD and 2 prompts \(run; see the amendment below\)/);
    expect(protocolSection('## H11 ')).toMatch(/Ceiling for Sitting V: 1\.5 USD and 2 prompts \(run: 0\.7235 USD\)/);
  });

  it('says in ADR 0053 what Sitting V verified and what it did not', () => {
    expect(ADR).toMatch(/\*\*Verified in part in an interactive session\*\* \(Sitting V, 2026-10-13, G1 and a bare "Hi": no red hook error, and the opening was the line alone\)/);
    expect(ADR).not.toMatch(/Not yet verified in an interactive session/);
    expect(ADR).toMatch(/in Sitting V the log of G1 shows one release at the first look/);
    expect(ADR).toMatch(/so no slow save was there to test/);
  });

  it('says in the plan what Sitting V found, in the one paragraph about H10k', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting V \(run on 2026-10-13[^\n]*opened with the line alone and showed no red hook error; the waiting gate did not have to wait \(1 ms\), so a slow save is still untested/);
  });
});
