import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting S (run on 2026-10-12 by the maintainer, Claude Code 2.1.296): H10k2 interactive again and G1 of Plan 035 N3 again, on the order of ADR 0051 (the lead writes its mode line once, in
 * the message of its last `ToolSearch`, so that no call is held), in folders built from the clone at `cdf9830`. Both sessions failed: the line stood in the lead's reasoning and in no text block, its first
 * other call was held, and the message of the hold, which told a lead that believed it had written the line to repeat the call alone and never to write it a second time, kept the gate holding for 13 calls
 * and for 11. Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the sessions' own cost records kept beside it, the prompts are the prompts of the
 * protocol, the two sessions are read from their own records (the holds, where the lead wrote what it wrote, the installed hook replayed on each final transcript, the amended hook replayed on the same),
 * the counts of the tables are the counts in them, and the protocol, ADR 0049, ADR 0051 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.296-designer-sitting-s.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-12-sitting-s-records');
const H10K2_SESSION = 'a7acda03-49c4-41cc-aa21-21a82975425a';
const G1_SESSION = '7c3e1121-6fe1-4e9d-85c2-9cc6811d489d';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));
const ADR_0051 = text(path.resolve('docs/adr/0051-the-lead-writes-its-mode-line-before-its-first-gated-call.md'));
const PLAN = text(path.resolve('plans/036-claude-creative-designer-improvement.md'));

const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const section = (heading: string): string => {
  const o = observation();
  const start = o.indexOf(`\n## ${heading}`);
  expect(start, heading).toBeGreaterThan(-1);
  const next = o.indexOf('\n## ', start + 4);
  return o.slice(start, next === -1 ? undefined : next);
};
const counts = (heading: string): [number, number, number] => {
  const s = section(heading);
  return [(s.match(/\| Met \|/g) ?? []).length, (s.match(/\| Not met \|/g) ?? []).length, (s.match(/\| Not reached \|/g) ?? []).length];
};
const protocolSection = (heading: string): string => {
  const start = PROTOCOL.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};
const occurrences = (t: string, re: RegExp): number => (t.match(re) ?? []).length;
const distinct = (t: string, re: RegExp): number => new Set([...t.matchAll(re)].map(m => m[1])).size;

const H10K2_HEADING = "H10k2, the lead's offer; the order of ADR 0051 (session `a7acda03`)";
const G1_HEADING = 'G1, a consultation ordered in the prompt (session `7c3e1121`)';

describe('the Sitting S observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone the folders were built from, that an interactive session has no cap, what the grading is against, and that the lines were changed after the result', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('cdf9830');
    expect(o).toMatch(/There is no `--max-budget-usd` in an interactive session/);
    expect(o).toMatch(/The grading is against the pass and fail lines of the clone `cdf9830`/);
    expect(o).toMatch(/changed after seeing these results/);
    for (const id of ['H10k2', 'G1', H10K2_SESSION, G1_SESSION]) expect(o).toContain(id);
  });

  it('keeps the prompts, and they are those of the protocol', () => {
    for (const name of ['prompt-h10k.txt', 'prompt-g1.txt']) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
    const k = protocolSection('## H10k ');
    expect(record('prompt-h10k.txt').trim()).toBe([...k.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!)[0]);
    const g1 = /type "(Scratch exercise, no real client\. Consult emre read-only first:[^"]*)"/.exec(PROTOCOL);
    expect(g1).not.toBeNull();
    expect(record('prompt-g1.txt').trim()).toBe(g1![1]);
  });

  it('shows what the lead had loaded: the message of the hook and its own section told a lead that believed it had written the line to repeat the call alone and never to write it a second time', () => {
    const t = record('loaded-text.txt');
    expect(t).toContain('built from the clone at cdf9830');
    expect(t).toContain('a hold is never a reason to wait');
    expect(t).toContain('If you have, the host has not saved it yet: repeat the call alone, with no text, and again if it is held again; never write the line a second time.');
    expect(t).toContain('Write the line once.');
    expect(t).toContain('The line must be a text block of your reply: your reasoning is not text');
    expect(t).toContain('says what an inputImages entry carries: yes');
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    for (const file of [...walk(RECORDS), OBSERVATION]) {
      const t = text(file);
      const rel = path.relative(OBS_DIR, file);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
  });
});

describe('the Sitting S observation: the ledger', () => {
  it("agrees with the sessions' own cost records to four decimals, and adds up: 0.9458 USD in 2 prompts, with no teammate and no image", () => {
    const o = observation();
    const u = record('usage-and-cost.txt');
    expect(u).toContain('totalCostUSD 0.5451576');
    expect(u).toContain('totalCostUSD 0.4006535');
    expect((0.5451576 + 0.4006535).toFixed(4)).toBe('0.9458');
    expect(u).toContain('Total  0.9458 USD in 2 prompts');
    expect(record('evidence-h10k2.txt')).toContain("the session's own cost record (Claude Code 2.1.296): 0.5452 USD (claude-haiku-5-5 0.0003, claude-sonnet-5-5 0.5449)");
    for (const figure of ['0.5452 USD', '0.4007 USD', '0.9458 USD in 2 prompts']) expect(o, figure).toContain(figure);
    expect(o).toMatch(/ceiling of 3\.0 USD and 2 prompts/);
    expect(o).toMatch(/No teammate started in either session/);
    expect(o).toMatch(/no image was made/);
    expect(u).toMatch(/None were made/);
  });
});

describe("the Sitting S observation: the lead's sessions, read from their own records", () => {
  it('reads H10k2 from the reader: 13 calls held in 12 messages, none of them with the line in a text block, no retry after the last, no call that ran, no AskUserQuestion, no teammate, no key', () => {
    const e = record('evidence-h10k2.txt');
    expect(e).toContain(`session ${H10K2_SESSION}`);
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 13/);
    expect(e).toMatch(/13 call\(s\) held, in 12 message\(s\) of the lead/);
    expect(occurrences(e, /the line in THIS message: NO/g)).toBe(12);
    expect(occurrences(e, /the line in an EARLIER message: no/g)).toBe(12);
    expect(e).not.toMatch(/the line in THIS message: yes/);
    expect(e).toMatch(/after the last hold the lead made 0 more call\(s\) \(0 not held\) and wrote 1 text block\(s\); it made NO retry: it ended its turn/);
    expect(e).toMatch(/the first call other than ToolSearch that ran: none \(the lead never got past the gate\)/);
    expect(e).toMatch(/The question: 0 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/the choice was put in prose as a numbered list: yes/);
    expect(e).toMatch(/teammates started: 0; before the answer \(\+ 379s\): 0 \(want 0\)/);
    expect(e).toMatch(/What you typed \(3 message\(s\) of yours/);
    expect(e).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    expect(e).toMatch(/a key requested from you: no/);
  });

  it('keeps the conversation of H10k2 without account details: the line only in the reasoning, 13 results of the hook in 12 messages, what the lead claimed, and the choice asked in prose', () => {
    const t = record('h10k2-gate-timeline.txt');
    expect(occurrences(t, / result \(ERROR\):/g)).toBe(13);
    expect(distinct(t, /lead (\w+) call (?:Glob|Skill) /g)).toBe(12);
    expect(t).not.toMatch(/ lead \w+ text: Mode:/);
    expect(t).not.toContain('AskUserQuestion');
    expect(occurrences(t, / lead \w+ reasoning summary: Running in Limited Operational mode/g)).toBe(1);
    for (const quote of [
      "Running in Limited Operational mode with Firecrawl, Context7, and Stitch available, but GitHub, Playwright, Chrome DevTools, and Figma missing. I'll proceed as Chris leading the AstrolabsAI team and read `docs/pilot` next.",
      "I wrote the line twice, and about eight retries were all held, so the hook isn't recognising it.",
      'Look at the hook file or the transcript it reads, or temporarily disable that hook entry in `.claude/settings.json`.',
      "Noted: Gemini. I still can't act on it, because the hook is still holding every call, including reading `docs/pilot` and loading skills.",
    ]) expect(t, quote).toContain(quote);
    expect(t).toMatch(/user text: Generate with Gemini/);
    expect(t).toMatch(/user text: 4\n/);
  });

  it('reads G1: the same call repeated 11 times in 11 messages, every one held, the line in the reasoning and in no text block, and the lead stopped to avoid writing the line again', () => {
    const t = record('g1-gate-timeline.txt');
    expect(occurrences(t, / result \(ERROR\):/g)).toBe(11);
    expect(occurrences(t, / call Agent /g)).toBe(11);
    expect(distinct(t, /lead (\w+) call Agent /g)).toBe(11);
    expect(t).not.toMatch(/ lead \w+ text: Mode:/);
    for (const quote of [
      "Running in Limited Operational mode with Firecrawl and Context7 available, but missing GitHub, Playwright, Chrome DevTools, and Figma (Stitch is available as an extra). As Chris, lead of the digital agency team, I'll load the task and messaging tools, then consult Emre read-only.",
      'The mode gate is still holding my Emre consultation, even though the mode line is already in the transcript.',
      'I wrote the mode line as a text block at the start of my second message',
      'Writing the line again would go against my own rule, so I stopped instead of looping.',
    ]) expect(t, quote).toContain(quote);
  });

  it('replays the installed hook on each final transcript: it answers "held" because no text block of the lead opens with the line', () => {
    const h = record('replay-hook-h10k2.txt');
    const g = record('replay-hook-g1.txt');
    expect(h).toContain('assistant text blocks: 4; of them opening with the mode line: 0');
    expect(g).toContain('assistant text blocks: 3; of them opening with the mode line: 0');
    for (const r of [h, g]) expect(r).toContain('the installed hook on the final transcript: exit 2');
    expect(h).toMatch(/thinking @\d\d:\d\d:\d\d: Running in Limited Operational mode with Firecrawl, Context7, and Stitch available/);
    expect(g).toMatch(/thinking @\d\d:\d\d:\d\d: Running in Limited Operational mode with Firecrawl and Context7 available/);
  });

  it('replays the amended hook on the same transcripts: three holds in a row, the first two asking for the line as a text block, the third saying that the hook sees 4 and 3 text blocks and none with the line', () => {
    const r = record('replay-amended-hook.txt');
    const [h, g] = r.split('== G1');
    expect(h).toContain('== H10k2');
    expect(occurrences(r, /hold [123]: exit 2;/g)).toBe(6);
    expect(h).toContain('The saved transcript has 4 text block(s) of yours and none opens with the mode line');
    expect(g).toContain('The saved transcript has 3 text block(s) of yours and none opens with the mode line');
    for (const part of [h, g!]) {
      expect(part).toContain('hold 1: exit 2; Mode line first. This is an expected hold, not a failure. Before this call');
      expect(part).toContain('even if you believe you wrote it already');
      expect(part).toContain('do not tell the user that the hook is broken: it reads text blocks only.');
    }
  });
});

describe('the Sitting S observation: the grading', () => {
  it('grades each item of the pass lines in tables, by run: 5 met, 8 not met, 7 not reached', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(5);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(8);
    expect((o.match(/\| Not reached \|/g) ?? []).length).toBe(7);
    expect(counts(H10K2_HEADING)).toEqual([4, 5, 4]);
    expect(counts(G1_HEADING)).toEqual([1, 3, 3]);
  });

  it('quotes what the lead said word for word, in the observation and in the records', () => {
    const o = observation();
    const h = record('h10k2-gate-timeline.txt');
    const g = record('g1-gate-timeline.txt');
    for (const quote of ["I wrote the line twice, and about eight retries were all held, so the hook isn't recognising it.", 'Look at the hook file or the transcript it reads, or temporarily disable that hook entry in `.claude/settings.json`.']) {
      expect(h, quote).toContain(quote);
      expect(o, quote).toContain(quote);
    }
    for (const quote of ['Writing the line again would go against my own rule, so I stopped instead of looping.', 'I wrote the mode line as a text block at the start of my second message']) {
      expect(g, quote).toContain(quote);
      expect(o, quote).toContain(quote);
    }
  });

  it('says what Sitting S found: both sessions failed for the same reason, the order of ADR 0051 was not followed, the hook was right, the lead said it had written a line it had not, and where the wrong turn was', () => {
    const o = observation();
    expect(o).toMatch(/Both sessions failed, for the same reason/);
    expect(o).toMatch(/The order of ADR 0051 was not followed in either session/);
    expect(o).toMatch(/The installed hook, replayed on each final transcript, answers "held"/);
    expect(o).toMatch(/The hook was right and the lead was wrong about what it had written/);
    expect(o).toMatch(/The wrong turn was decision 3 of ADR 0051/);
    expect(o).toMatch(/Every call was held, `AskUserQuestion` included/);
    expect(o).toMatch(/The amended hook, replayed on the two final transcripts, counts 4 and 3 text blocks/);
  });

  it('says what is not established: the amended messages (Sitting T), the order itself, a release after a number of rounds, and the full-roster regressions', () => {
    const o = observation();
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether the lead writes the line within three rounds of holds, with the messages of ADR 0051 as amended, and reaches the offer and the consultation \(Sitting T\)/);
    expect(o).toMatch(/A release after a number of rounds/);
    expect(o).toMatch(/R2 and R3/);
  });
});

describe('the protocol, ADR 0049, ADR 0051 and the plan state Sitting S', () => {
  it('records Sitting S as run, with its cost and what it found, and has a row for Sitting T (its result is pinned in tests/designer-sitting-t-observation.test.ts)', () => {
    const s = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting S |')) ?? '';
    expect(s).toMatch(/H10k2 again/);
    expect(s).toMatch(/G1 of Plan 035 N3 again/);
    expect(s).toMatch(/3\.0 USD and 2 prompts/);
    expect(s).toMatch(/run 2026-10-12/);
    expect(s).toMatch(/used 0\.9458 USD of model cost in 2 prompts/);
    expect(s).toMatch(/both sessions failed/);
    expect(s).not.toMatch(/not yet run/);
    const t = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting T |')) ?? '';
    expect(t).toMatch(/H10k2 again/);
    expect(t).toMatch(/G1 again/);
    expect(t).toMatch(/3\.0 USD and 2 prompts/);
  });

  it('amends the cost of H10k with the result of Sitting S, and the cost of G1 with its result', () => {
    const k = protocolSection('## H10k ');
    const cost = k.slice(k.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting S/);
    expect(cost).toContain(NAME);
    expect(cost).toMatch(/0\.5452 USD by the session's own cost record/);
    expect(cost).toMatch(/\*\*H10k2 again did not reach the Gemini branch, and G1 did not reach the consultation\*\*/);
    expect(cost).toMatch(/13 calls in 12 messages/);
    expect(cost).toMatch(/11 calls in 11 messages/);
    expect(cost).toMatch(/Sitting T repeats H10k2 and G1/);
    expect(cost).toMatch(/Ceiling for Sitting T/);
    expect(cost).toMatch(/Ceiling for Sitting S[^\n]*\(run; see the amendment below\)/);
    const g = PROTOCOL.slice(PROTOCOL.indexOf('**Amended 2026-10-07 (Plan 035 N3).**'), PROTOCOL.indexOf('## After a sitting'));
    expect(g).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting S/);
    expect(g).toContain(NAME);
    expect(g).toMatch(/G1 ran again on the order of ADR 0051 \(session `7c3e1121`, 0\.4007 USD/);
    expect(g).toMatch(/Sitting T repeats G1/);
  });

  it('has Sitting S in ADR 0049: what it covered, that both sessions failed, and what is still not established', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sitting S \(`host-library\/claude\/observations\/2026-10-12-claude-2\.1\.296-designer-sitting-s\.md`\)/);
    expect(ADR).toMatch(/both sessions failed/);
    // "whether the lead, with the messages of the hook by round, writes its line within three rounds" was answered by Sitting T (it did, in both sessions); the ADR's "Not established" now names what Sitting U checks.
  });

  it('cites the record of Sitting S in ADR 0051, where its decision 3 was replaced', () => {
    expect(ADR_0051).toContain(`host-library/claude/observations/${NAME}`);
  });

  it('says in the plan what Sitting S found about H10k, in the one paragraph about it', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting S \(run on 2026-10-12[^\n]*both sessions failed[^\n]*Sitting T repeats it/);
  });
});
