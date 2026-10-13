import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting U (run on 2026-10-12 by the maintainer, Claude Code 2.1.296): H10m interactive, in a folder built from the clone at `1bf058c` (the tip of PR 198), with the `image-gen` server added in the
 * local scope by the maintainer with their own key. The fix of Sitting T worked: the lead's `ToolSearch` listed `mcp__image-gen__generate_image` (a pool of 45) and Jamileh's, as a teammate, listed it too (a pool of
 * 23); nobody called it. The mode-line hook held the lead's first `Agent` call three times in three messages, two of them falsely: the host had not saved the line the lead wrote after the first hold, 5 s later.
 * Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the session's own cost record kept beside it, the prompt is the protocol's, the pools and the holds are
 * read from the kept evidence, the counts of the table are the counts in it, and the protocol, ADRs 0049 and 0053 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.296-designer-sitting-u.md';
const RECORDS = path.join(OBS_DIR, '2026-10-12-sitting-u-records');
const SESSION = 'cbb4adf8-346d-44d2-943b-39033b25a50f';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(path.join(OBS_DIR, NAME));
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR_0049 = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));
const PLAN = text(path.resolve('plans/036-claude-creative-designer-improvement.md'));
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const protocolSection = (heading: string): string => {
  const start = PROTOCOL.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};
const section = (heading: string): string => {
  const o = observation();
  const start = o.indexOf(`\n## ${heading}`);
  expect(start, heading).toBeGreaterThan(-1);
  const next = o.indexOf('\n## ', start + 4);
  return o.slice(start, next === -1 ? undefined : next);
};

describe('the Sitting U observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone, that an interactive session has no cap, and the session', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('1bf058c');
    expect(o).toMatch(/There is no `--max-budget-usd` in an interactive session/);
    expect(o).toContain(SESSION);
    expect(o).toMatch(/with their own key/);
  });

  it('keeps the prompt of H10m, and it is the protocol\'s', () => {
    const m = protocolSection('## H10m ');
    const prompt = /### H10m Prompt\n[^\n]*\n?```text\n([\s\S]*?)\n```/.exec(m);
    expect(prompt).not.toBeNull();
    expect(record('prompt-h10m.txt').trim()).toBe(prompt![1]);
  });

  it('keeps the cost record, and the ledger agrees with it', () => {
    const cost = record('usage-and-cost.txt');
    expect(cost).toContain(SESSION);
    expect(cost).toMatch(/totalCostUSD 0\.54284/);
    expect(observation()).toMatch(/\| 1 \| H10m, the image tool reaches the team \| `cbb4adf8-346d-44d2-943b-39033b25a50f` \| 10 lead messages \| 49 s \| 125 s \| 0\.5428 \|/);
    expect(observation()).toMatch(/no longer interested in cost calculations/);
  });

  it('reads the pools from the evidence: the lead\'s pool of 45 and Jamileh\'s pool of 23 each hold the tool, and the lead\'s start pool did not change', () => {
    const pool = record('pool-evidence.txt');
    expect(pool).toMatch(/orchestrator-digital-agency: 48 entries in its tools allowlist[^\n]*mcp__image-gen__generate_image/);
    expect(pool).toMatch(/The lead's deferred-tool pool when the session started \(14:44:00 UTC\): 45 tools/);
    expect(pool).toMatch(/A later change of the pool at 14:44:06 UTC: removed \[\], added \[\]/);
    expect(pool).toMatch(/select:mcp__image-gen__generate_image[^\n]*pool 45\s+matches: mcp__image-gen__generate_image/);
    expect(pool).toMatch(/Jamileh's pool in the tool check \(14:44:28 UTC\): 23 deferred tools: \(built-in\) 7, mcp__image-gen 1, mcp__stitch 15/);
    expect(pool).toMatch(/pool 23\s+matches: 1/);
  });

  it('reads the holds from the timeline: three calls held in three messages, the line written twice, and the third hold counting 0 text blocks', () => {
    const t = record('h10m-gate-timeline.txt');
    expect(t.match(/user result \(ERROR\): PreToolUse:Agent hook error/g)).toHaveLength(3);
    expect(t.match(/lead \w+ text: Mode: Limited Operational\./g)).toHaveLength(2);
    expect(t).toMatch(/\(hold 3\)\. The saved transcript has 0 text block\(s\) of yours/);
    expect(t).toMatch(/call Agent[^\n]*\n[^\n]*Spawned successfully/);
    const byMessage = record('by-message.txt');
    expect(byMessage).toMatch(/h10m-pool\/cbb4adf8\n\s+msg\s+3 \+\s+15\.4s\s+Agent:HOLD\n\s+msg\s+4 \+\s+18\.7s\s+LINE\s+Agent:HOLD\n\s+msg\s+5 \+\s+23\.7s\s+Agent:HOLD\n\s+msg\s+6 \+\s+26\.4s\s+LINE\s+Agent:PASS/);
  });

  it('shows that the text entry was written before the call and the hold\'s result, in the file the hook reads', () => {
    const f = record('file-order-h10m.txt');
    const at = (n: number): number => f.search(new RegExp(`line\\s+${n}\\s`));
    expect(f).toMatch(/line\s+72\s+\+\s*18\.7s\s+assistant\s+7cqsLw\s+text\(MODE LINE\)/);
    expect(f).toMatch(/line\s+73\s+\+\s*20\.1s\s+assistant\s+7cqsLw\s+tool_use:Agent/);
    expect(f).toMatch(/line\s+77\s+\+\s*23\.8s\s+user\s+tool_result\(ERROR/);
    expect(at(72)).toBeGreaterThan(-1);
    expect(at(72)).toBeLessThan(at(77));
  });

  it('has the lag table of the interactive sessions: the line missing 2.7, 5.0, 5.7 and 6.0 s after it was written, present by 9.2 and 10.4 s', () => {
    const lag = record('lag-bounds.txt');
    expect(lag).toContain('[0.4, 0.4, 2.7]');
    expect(lag).toContain('[1.5, 5.0]');
    expect(lag).toContain('[0.3, 0.4, 5.7]');
    expect(lag).toContain('[1.6, 6.0]');
    expect(lag).toContain('first passed call after it: 9.2s Agent');
    expect(lag).toContain('first passed call after it: 10.4s Agent');
    expect(observation()).toMatch(/\*\*2\.7 s \(H10k2 of Sitting T\), 5\.0 s \(this session\), 5\.7 s \(H10k2 of Sitting P\) and 6\.0 s \(G1 of Sitting T\)\*\*/);
  });

  it('keeps Jamileh\'s answer to the shutdown request: an object, approved, on her first call', () => {
    const j = record('jamileh-messages.txt');
    expect(j).toContain('"type":"shutdown_response"');
    expect(j).toContain('"approve":true');
    expect(j).toContain('shutdown-1791816279342@jamileh');
    expect(j).toContain('I did not call it and wrote no files');
  });

  it('counts the items of the pass line: 6 met, 1 not met, 1 not shown', () => {
    const s = section('H10m, the lead and Jamileh each list the tool (session `cbb4adf8`)');
    expect((s.match(/\| Met \|/g) ?? []).length).toBe(6);
    expect((s.match(/\| Not met \|/g) ?? []).length).toBe(1);
    expect((s.match(/\| Not shown \|/g) ?? []).length).toBe(1);
  });

  it('says what Sitting U found, and what it did not establish', () => {
    const o = observation();
    expect(o).toMatch(/\*\*The fix of Sitting T works\.\*\*/);
    expect(o).toMatch(/Three red hook errors, two of them false/);
    expect(o).toMatch(/The host saves its transcript late/);
    expect(o).toMatch(/The relay was three sentences/);
    expect(o).toMatch(/ADR 0053 adds a bounded wait for the file to the hook/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether she can make an image as a teammate/);
    expect(o).toMatch(/Whether the waiting hook of ADR 0053 removes the false holds in an interactive session \(Sitting V, H11\)/);
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    const files = [path.join(OBS_DIR, NAME), ...walk(RECORDS)];
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const t = text(f);
      const rel = path.relative(OBS_DIR, f);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
  });
});

describe('the protocol, ADRs 0049 and 0053 and the plan state Sitting U', () => {
  it('records Sitting U as run, with its cost record and what it found, and has the Sitting V row', () => {
    const u = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting U |')) ?? '';
    expect(u).toMatch(/H10m/);
    expect(u).toMatch(/1\.5 USD and 1 prompt/);
    expect(u).toMatch(/run 2026-10-12/);
    expect(u).toMatch(/used 0\.5428 USD of model cost by the session's own cost record/);
    expect(u).toMatch(/held the lead's first `Agent` call 3 times in 3 messages/);
    expect(u).not.toMatch(/not yet run/);
    const v = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting V |')) ?? '';
    expect(v).toMatch(/G1 again/);
    expect(v).toMatch(/H11/);
    expect(v).toMatch(/1\.5 USD and 2 prompts/);
    // Sitting V has run since (2026-10-13): tests/designer-sitting-v-observation.test.ts pins what it found.
    expect(v).toMatch(/proposed 2026-10-13/);
  });

  it('defines H11: the opening, with its setup, prompt, evidence, pass, fail and cost', () => {
    const h = protocolSection('## H11 ');
    for (const part of ['### H11 Setup', '### H11 Prompt', '### H11 Evidence', '### H11 Pass', '### H11 Fail', '### H11 Cost']) expect(h, part).toContain(part);
    expect(h).toMatch(/hello-open/);
    expect(h).toMatch(/Hello: one message, `Hi`/);
    expect(h).toMatch(/no red hook error/);
    expect(h).toMatch(/AGENTS_UNITED_MODE_LINE_WAIT_MS=0/);
  });

  it('amends H10k with the result of Sitting U, the new pass and fail words, and the ceiling of Sitting V', () => {
    const k = protocolSection('## H10k ');
    expect(k).toMatch(/Amended 2026-10-13 \(Plan 036 S19, Sitting U/);
    expect(k).toMatch(/\*\*The fix of Sitting T worked\*\*/);
    expect(k).toMatch(/a pool of 45[^\n]*a pool of 23/);
    expect(k).toMatch(/in its second message and before its first other call: the Operation Mode information, with no greeting, no welcome and no introduction/);
    expect(k).toMatch(/a welcome, a greeting, an introduction of the lead or a list of the team in its opening/);
    expect(k).toMatch(/Ceiling for Sitting U \(H10m, one session\): 1\.5 USD and 1 prompt \(run; see the amendment below\)/);
    expect(k).toMatch(/Ceiling for Sitting V \(G1 and H11, two short sessions\): 1\.5 USD and 2 prompts/);
  });

  it('has Sitting U in ADR 0049: the check ran, and what is still not established', () => {
    expect(ADR_0049).toContain(NAME);
    expect(ADR_0049).toMatch(/\*\*Sitting U\*\*[^\n]*ran that check: the lead's `ToolSearch` listed `mcp__image-gen__generate_image`, Jamileh's, as a teammate, listed it too, and nobody called it/);
    expect(ADR_0049).toMatch(/that the lead and Jamileh find it was established in Sitting U, H10m/);
  });

  it('says in the plan what Sitting U found and what followed (ADR 0053), in the one paragraph about H10k', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting U \(run on 2026-10-12[^\n]*each listed `mcp__image-gen__generate_image` and nobody called it[^\n]*ADR 0053[^\n]*Sitting V checks it live/);
  });
});
