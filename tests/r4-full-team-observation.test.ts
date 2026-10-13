import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting W (R4, run on 2026-10-13 by the maintainer, Claude Code 2.1.296): the full-roster regression of Plan 035 N3 (the H1 brief plus "Consult ava read-only first.", the lead and the nine
 * specialists) on the build of PR 200 (the clone at `867eaa9`), one interactive session, no image server and no key. The opening was as ADR 0053 says and nothing was held (the line was the lead's second
 * message, the first gated call was released at the hook's first look, 1 ms); the nine files were written in four tiers; the lead received eight of the ten shutdown confirmations, because the session was closed
 * while its final report said that the last two were still to arrive; and five of the nine delivery briefs again omitted a value that the brief fixes "in every brief". Like the pins of the earlier sittings,
 * this suite makes the observation checkable: the ledger agrees with the session's own cost record kept beside it, the prompt is the protocol's, the counts of the tables are the counts in the kept records,
 * the nine files are the ones whose hashes were recorded, and the protocol, ADR 0053 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-13-claude-2.1.296-r4-full-team.md';
const RECORDS = path.join(OBS_DIR, '2026-10-13-r4-records');
const SESSION = '06bd962d-3cad-4fa6-988f-2b0e3c0a85f8';

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
const tableOf = (o: string, header: string): string => {
  const start = o.indexOf(header);
  expect(start, header).toBeGreaterThan(-1);
  return o.slice(start, o.indexOf('\n\n', start));
};

describe('the R4 observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone, the session, and that no key was involved', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('867eaa9');
    expect(o).toMatch(/21 files compared with the clone, all equal, the gate script among them/);
    expect(o).toMatch(/There is no `--max-budget-usd` in an interactive session/);
    expect(o).toMatch(/no image server and no key/);
    expect(o).toContain(SESSION);
    expect(o).toMatch(/ten teammate records/);
  });

  it('keeps the prompt, and it is the H1 brief of the protocol plus the sentence of the R3 handoff', () => {
    const h1 = protocolSection('## H1 The three fixes in the full-roster team');
    const fence = /### Prompt\n```text\n([\s\S]*?)\n```/.exec(h1);
    expect(fence).not.toBeNull();
    expect(record('prompt.txt').trim()).toBe(`${fence![1]!.trim()}\n\nConsult ava read-only first.`);
    const handoff = text(path.resolve('docs/plan-033-r3-handoff.md'));
    expect(handoff).toContain(record('prompt.txt').trim());
  });

  it('keeps the cost record, and the ledger agrees with it', () => {
    const cost = JSON.parse(record('cost-state.txt')) as { totalCostUSD: number; hasUnknownModelCost: boolean; totalAPIDurationSeconds: number; totalDurationSeconds: number; models: Array<{ model: string; costUSD: number }> };
    expect(cost.totalCostUSD).toBeCloseTo(2.6287492, 6);
    expect(cost.hasUnknownModelCost).toBe(false);
    expect(Math.round(cost.totalAPIDurationSeconds)).toBe(474);
    expect(Math.round(cost.totalDurationSeconds)).toBe(724);
    expect(cost.models.map(m => m.model).sort()).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    const o = observation();
    expect(o).toMatch(/\| 1 \| R4, H1 plus "Consult ava read-only first\." \| `06bd962d-3cad-4fa6-988f-2b0e3c0a85f8` \| 39 \| 474 s \| 724 s \| 2\.6287 \|/);
    expect(o).toMatch(/no longer interested in cost calculations/);
    expect(record('session-report.txt')).toMatch(/cost 2\.6287 USD \(the session's own record\) · API 474 s · wall 724 s/);
  });

  it('reads the opening from the kept summary: no hold, the line in message 2, the first gated call in message 3, an accurate line, no welcome words', () => {
    const s = record('summary.txt');
    expect(s).toContain('SUMMARY holds=0 in 0 message(s)');
    expect(s).toContain('line: message 2 at +8.3s');
    expect(s).toContain('first gated call: message 3 at +11.1s');
    expect(s).toContain('line written before the first gated call: yes');
    expect(s).toContain('line accurate: yes');
    expect(s).toContain('welcome words: none');
    expect(s).toMatch(/msg\s+2 \+\s*8\.3s\s+LINE "Mode: Limited Operational\. Callable: Context7, Firecrawl\. Missing: GitHub, Pla"\s+ToolSearch x1/);
    const t = record('timeline.txt');
    expect(t.match(/lead \w+ text: Mode: Limited Operational\./g)).toHaveLength(1);
    expect(t).toContain('text: Mode: Limited Operational. Callable: Context7, Firecrawl. Missing: GitHub, Playwright, Chrome DevTools, Figma. Extras: Stitch.');
  });

  it('keeps the gate\'s log: one decision for the whole session, the first look, the line already in the file', () => {
    const entries = record('gate-log.txt').split('\n').filter(Boolean).map(row => JSON.parse(row) as Record<string, unknown>);
    expect(entries).toEqual([{ at: '2026-10-13T09:09:56.106Z', tool: 'Agent', event: 'released', by: 'line', waitedMs: 1 }]);
    expect(record('timeline.txt')).toMatch(/The decisions of the mode-line gate \(one line each\):\n\s+09:09:56\.106 Agent released \{"by":"line","waitedMs":1\}/);
  });

  it('shows in the kept timeline: no hook error, ten structured shutdown requests, eight approvals received, the map accepted once', () => {
    const t = record('timeline.txt');
    expect(t).not.toMatch(/hook error/);
    expect(t.match(/"type":"shutdown_request"/g)).toHaveLength(10);
    expect(t.match(/"type":"shutdown_approved"/g)).toHaveLength(8);
    expect(t.match(/"type":"teammate_terminated"/g)).toHaveLength(8);
    expect(t.match(/call AskUserQuestion/g)).toHaveLength(1);
    expect(t).toContain('"Accept map (Recommended)"');
    expect(t).toContain('Only the last two shutdown confirmations (Emre, Defne) are still to arrive.');
    expect(t).not.toMatch(/shutdown_approved[^\n]*"from":"(emre|defne)"/);
  });

  it('keeps the helper\'s report: H1a, H1b and H1c seen, ten requests and ten responses, eight received by the lead, none from Emre and Defne, no start while blocked', () => {
    const r = record('session-report.txt');
    expect(r).toMatch(/H1a [^\n]*: \*\*seen\*\*/);
    expect(r).toMatch(/H1b [^\n]*: \*\*seen\*\*/);
    expect(r).toMatch(/H1c [^\n]*: \*\*seen\*\*/);
    expect(r).toContain('structured shutdown_request: 10, plain-text shutdown requests: 0, shutdown responses received by the lead: 8 (none from emre, defne)');
    expect(r).toContain('shutdown responses sent by teammates: 10 of 10 requested (approved 10)');
    expect(r).toContain('41 task call(s), 9 task(s); starts while blocked: 0');
    expect(r).toMatch(/10 teammate record\(s\)/);
    expect((r.match(/final report has Peer messages received and Open items: yes/g) ?? []).length).toBe(10);
    expect(r).toContain('no tool call has an mcp__ name');
  });

  it('keeps the checks the helper does not make: the order of the acceptance, the owner and the first write; the responses of the teammates; the briefs', () => {
    const c = record('checks.txt');
    expect(c).toMatch(/ask 09:10:19\.124 {2}answered 09:10:40\.535 {2}task 1 owner set 09:10:51\.306/);
    expect(c).toMatch(/agent-aava-c16947af0052c53b\.jsonl\s+ava\s+first 09:10:59\.961 last 09:11:32\.461 firstWrite 09:11:15\.080/);
    expect(c).toMatch(/agent-aava-540caf3d662d29a3\.jsonl\s+ava\s+first 09:09:56\.632 last 09:10:15\.779 firstWrite {2}responses/);
    expect((c.match(/approve:true object:true/g) ?? []).length).toBe(10);
    expect(c).toMatch(/hook error:0/);
    expect(c).not.toMatch(/hook error:[1-9]/);
    expect(c).toContain('approved: ava@09:10:16.315, ava@09:11:32.930, kaan@09:12:22.119, yavuz@09:12:27.204, jamileh@09:12:48.333, selin@09:13:07.967, deniz@09:13:17.783, jale@09:13:29.377');
    expect(c).toContain('briefs with both values: 5 of 10');
    expect(c).toMatch(/jamileh\s+agency-creative-designer\s+colour-token:yes testId:NO/);
    for (const name of ['yavuz', 'selin', 'jale']) expect(c, name).toMatch(new RegExp(`${name}\\s+\\S+\\s+colour-token:NO\\s+testId:yes`));
    expect(c).toMatch(/defne\s+\S+\s+colour-token:NO\s+testId:NO/);
  });

  it('keeps the re-read order of the five shell-less roles: every last write or edit is followed by a read in a later response', () => {
    const r = record('reread.txt');
    expect((r.match(/later response: true/g) ?? []).length).toBe(5);
    expect(r).not.toMatch(/later response: false/);
  });

  it('keeps nine files of at most 40 lines whose hashes are those the collector recorded', () => {
    const rows = record('artifacts.txt').split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length === 3 && /^[0-9A-F]{64}$/.test(p[2]!));
    expect(rows.map(r => r[0]).sort()).toEqual(['HeroSection.tsx', 'compliance-review.md', 'content-plan.md', 'design-tokens.json', 'hero.spec.ts', 'hero.ts', 'launch-kit.md', 'seo-audit.md', 'strategy.md'].sort());
    for (const [name, lines, hash] of rows as Array<[string, string, string]>) {
      const body = record(path.join('fixtures', name));
      const count = body.split('\n').length - (body.endsWith('\n') ? 1 : 0);
      expect(count, name).toBe(Number(lines));
      expect(count, name).toBeLessThanOrEqual(40);
      expect(crypto.createHash('sha256').update(body, 'utf8').digest('hex').toUpperCase(), name).toBe(hash);
    }
    expect(record('fixtures/design-tokens.json')).toContain('"primary": "#B8400F"');
    expect(JSON.parse(record('fixtures/design-tokens.json')).color.cta.primary).toBe('#B8400F');
    for (const name of ['strategy.md', 'hero.ts']) expect(record(path.join('fixtures', name)), name).toContain('color.cta.primary');
    expect(rows.filter(([name]) => record(path.join('fixtures', name!)).includes('hero-primary-cta'))).toHaveLength(6);
  });

  it('counts the opening table (6 met) and says what the expectations were', () => {
    const o = observation();
    const opening = tableOf(o, '| Item | Result | Evidence |');
    expect((opening.match(/\| Met \|/g) ?? []).length).toBe(6);
    expect(opening).not.toMatch(/Not met/);
    const expectations = tableOf(o, '| # | Expectation | Verdict | Evidence and limit |');
    expect(expectations.split('\n').filter(l => /^\| [1-8] \|/.test(l))).toHaveLength(8);
    expect(expectations).toMatch(/\| 3 \| Structured shutdowns, none refused \| \*\*Seen for the responses; completion confirmed for 8 of 10, unverified for the last 2\*\* \|/);
    expect(expectations).toMatch(/\*\*not for Emre and Defne\*\*/);
    expect(expectations).toMatch(/\*\*the wait did not act\*\*, as in Sitting V/);
  });

  it('says what R4 found: the opening held, the contract was left out of five of nine briefs, the end races with the confirmations, ListAgents showed the other sessions', () => {
    const o = observation();
    expect(o).toMatch(/\*\*The opening was as ADR 0053 says and the hook held nothing; the artifact and runtime expectations of R3 were seen again; the completion of the last two shutdowns was not/);
    expect(o).toMatch(/\*\*Violated, in five of nine delivery briefs, as in R3\.\*\*/);
    expect(o).toMatch(/"Every teammate was told the CTA colour token is `color\.cta\.primary` and the CTA test id is `hero-primary-cta`", which the briefs do not show/);
    expect(o).toMatch(/\*\*The end of the run races with the last shutdown confirmations, again\*\*/);
    expect(o).toMatch(/\*\*`ListAgents` returned the maintainer's other sessions to the lead\.\*\*/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/That the wait absorbs a late save in an interactive session, and that 8 s is enough/);
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    const files = [path.join(OBS_DIR, NAME), ...walk(RECORDS)];
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const t = text(f);
      const rel = path.relative(OBS_DIR, f);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
    expect(record('timeline.txt')).toContain("[ListAgents: the titles of four of the user's other sessions, removed from this record]");
  });
});

describe('the protocol, ADR 0053 and the plan state Sitting W', () => {
  it('records Sitting W as run, with no ceiling and its cost record', () => {
    const w = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting W |')) ?? '';
    expect(w).toMatch(/R4, the full-roster regression/);
    expect(w).toMatch(/Consult ava read-only first/);
    expect(w).toContain('867eaa9');
    expect(w).toMatch(/no ceiling was set/);
    expect(w).toMatch(/proposed 2026-10-13; run 2026-10-13/);
    expect(w).toMatch(/used 2\.6287 USD of model cost/);
    expect(w).toMatch(/no hold/);
    expect(w).toMatch(/last two shutdown confirmations \(Emre, Defne\) did not reach the lead/);
    expect(w).toMatch(/five of nine briefs/);
    expect(PROTOCOL).toMatch(/Total of all ceilings: 55\.0 USD, and 65\.0 USD with Sitting F\./);
  });

  it('amends H1 with the result of R4', () => {
    const h1 = protocolSection('## H1 The three fixes in the full-roster team');
    expect(h1).toMatch(/Amended 2026-10-13 \(Plan 036 S19, Sitting W/);
    expect(h1).toContain(NAME);
    expect(h1).toMatch(/\*\*The opening held\*\*/);
    expect(h1).toMatch(/seven of the eight expectations were seen/);
    expect(h1).toMatch(/10 structured requests[^\n]*10 structured approvals sent, 8 delivered to the lead/);
    expect(h1).toMatch(/\*\*The instruction "fixed in every brief" was violated in five of nine briefs again\*\*/);
    expect(h1).toMatch(/wait for the lead's next short message/);
  });

  it('says in ADR 0053 what R4 showed and what it did not', () => {
    expect(ADR).toMatch(/The full team \(R4, 2026-10-13\) opened the same way with no hold\./);
    expect(ADR).toMatch(/R4 \(2026-10-13\) ran the lead and all nine specialists on this build/);
    expect(ADR).toMatch(/the wait again did not act/);
    expect(ADR).toMatch(/so no slow save was there to test/);
  });

  it('says in the plan what R4 found, in the one paragraph about H10k', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting V \(run on 2026-10-13[^\n]*so a slow save is still untested\. The full team \(R4, Sitting W, `host-library\/claude\/observations\/2026-10-13-claude-2\.1\.296-r4-full-team\.md`\)/);
  });
});
