import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting T (run on 2026-10-12 by the maintainer, Claude Code 2.1.296): H10k2 and G1 interactive again, on the hook of ADR 0051 as amended after Sitting S (the message of a hold depends on
 * the round of holds), in folders built from the clone at `bedad6a`. The hook worked: both leads were released within three rounds and neither stopped, asked the user to reply or blamed the hook. H10k2 reached
 * the offer; then the maintainer went past the scripted stop, ran the command the lead printed and restarted three times, and neither the lead nor Jamileh ever saw the image tool: the lead's `tools` did not
 * name it, the session cut the lead's tool pool to its `tools`, and a teammate gets the MCP tools of the main conversation. Like the pins of the earlier sittings, this suite makes the observation checkable: the
 * ledger agrees with the sessions' own cost records kept beside it, the prompts are those of the protocol, the two sessions and the tool pools are read from their own records, the counts of the tables are the
 * counts in them, and the protocol, ADR 0049, ADR 0051 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.296-designer-sitting-t.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-12-sitting-t-records');
const H10K2_SESSION = 'd8b12589-ddfc-4dcd-8da1-42b2844787d8';
const G1_SESSION = '8370a0ca-ef75-4398-8b4f-a302841c1e95';

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

const H10K2_HEADING = "H10k2, the lead's offer and the restart (session `d8b12589`)";
const G1_HEADING = 'G1, a consultation ordered in the prompt (session `8370a0ca`)';

describe('the Sitting T observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone, that an interactive session has no cap, what the grading is against, and that the lines were changed after the result', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('bedad6a');
    expect(o).toMatch(/There is no `--max-budget-usd` in an interactive session/);
    expect(o).toMatch(/The grading is against the pass and fail lines of the clone `bedad6a`/);
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

  it('shows what the lead held: the amended hook installed in the folder, replayed on a transcript with no line, answers by the round; and the lead\'s own sentences', () => {
    const t = record('loaded-text.txt');
    expect(t).toContain('built from the clone at bedad6a');
    expect(t).toContain('hold 1: exit 2; Mode line first. This is an expected hold, not a failure. Before this call');
    expect(t).toContain('even if you believe you wrote it already');
    expect(t).toContain('hold 3: exit 2; Mode line first. This is an expected hold, not a failure (hold 3).');
    expect(t).toContain('The saved transcript has 4 text block(s) of yours and none opens with the mode line');
    expect(t).toContain('Never tell the user that the hook is broken, and never suggest that they disable or edit it');
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

describe('the Sitting T observation: the ledger', () => {
  it("agrees with the sessions' own cost records to four decimals, and adds up: 2.6494 USD in 2 prompts, no image", () => {
    const o = observation();
    const u = record('usage-and-cost.txt');
    expect(u).toContain('totalCostUSD 2.2254199');
    expect(u).toContain('totalCostUSD 0.4240102');
    expect((2.2254199 + 0.4240102).toFixed(4)).toBe('2.6494');
    expect(u).toContain('Total  2.6494 USD in 2 prompts');
    expect(record('evidence-h10k2.txt')).toContain("the session's own cost record (Claude Code 2.1.296): 2.2254 USD (claude-haiku-5-5 0.0007, claude-sonnet-5-5 1.3523, claude-opus-5-5 0.8724)");
    for (const figure of ['2.2254 USD', '0.4240 USD', '2.6494 USD in 2 prompts', '0.8724 USD']) expect(o, figure).toContain(figure);
    expect(o).toMatch(/ceiling of 3\.0 USD and 2 prompts/);
    expect(o).toMatch(/no image was made/);
    expect(u).toMatch(/None were made/);
  });
});

describe("the Sitting T observation: the sessions, read from their own records", () => {
  it('reads H10k2: 5 calls held in 3 messages, the line as a text block at the first repeat, one AskUserQuestion, no teammate before the answer, two after, no key', () => {
    const e = record('evidence-h10k2.txt');
    expect(e).toContain(`session ${H10K2_SESSION}`);
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 5/);
    expect(e).toMatch(/5 call\(s\) held, in 3 message\(s\) of the lead/);
    expect(e).toMatch(/1\. \+ {2}12s {2}held: Glob, Skill; the line in THIS message: NO/);
    expect(e).toMatch(/2\. \+ {2}15s {2}held: Glob, Skill; the line in THIS message: yes \(held anyway: the host had not saved it yet\)/);
    expect(e).toMatch(/3\. \+ {2}18s {2}held: Glob; the line in THIS message: NO[^\n]*the line in an EARLIER message: yes/);
    expect(e).toMatch(/the first call other than ToolSearch that ran: \+ {2}18s {2}Skill/);
    expect(e).toMatch(/The question: 1 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/teammates started: 2; before the answer \(\+ {2}45s\): 0 \(want 0\)/);
    expect(e).toMatch(/What you typed \(10 message\(s\) of yours/);
    expect(e).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    expect(e).toMatch(/a key requested from you: no/);
    expect(e).toContain('3 images at 2K, $0.0504 each, about $0.15; worst case 9 calls (two regenerations each), at most $0.45.');
    expect(e).toContain('3 images at 2K, $0.09 each, about $0.27; worst case 9 calls, at most $0.81.');
  });

  it('keeps the conversation of H10k2: the line once as a text block, 5 results of the hook, the map accepted, and the lead that could not see the tool', () => {
    const t = record('h10k2-gate-timeline.txt');
    expect(occurrences(t, / result \(ERROR\):/g)).toBe(5);
    expect(occurrences(t, / lead \w+ text: Mode: Limited Operational\. Callable: Context7, Firecrawl\. Missing: GitHub, Playwright, Chrome DevTools, Figma\. Extras: Stitch\./g)).toBe(1);
    expect(occurrences(t, / call AskUserQuestion /g)).toBe(1);
    expect(occurrences(t, / call Agent /g)).toBe(2);
    for (const quote of [
      "I'm treating your Gemini choice as the go for exactly that.",
      'After the restart, Claude Code offers "New MCP server found in this project".',
      "I can't see the tool, so I haven't spawned anyone.",
      "Jamileh can't call `image-gen` either.",
    ]) expect(t, quote).toContain(quote);
    expect(t).toMatch(/user text: yes, I accept/);
    expect(t).toMatch(/user text: test with Jamileh/);
    expect(t).toContain('Reconnected to image-gen.');
  });

  it('reads G1: 3 holds in 3 messages, the line as a text block twice, the consultation done, the shutdown approved', () => {
    const t = record('g1-gate-timeline.txt');
    expect(occurrences(t, / result \(ERROR\):/g)).toBe(3);
    expect(occurrences(t, / lead \w+ text: Mode: Limited Operational\./g)).toBe(2);
    expect(t).toContain('(hold 2)');
    expect(t).toContain('The saved transcript has 0 text block(s) of yours and none opens with the mode line');
    expect(t).toContain('Spawned successfully.');
    expect(t).toContain('"type":"shutdown_approved"');
    expect(t).toContain("Emre's plan covers three checks.");
  });

  it('replays the installed hook on each final transcript: it finds the line (exit 0), once in H10k2 and twice in G1', () => {
    const h = record('replay-hook-h10k2.txt');
    const g = record('replay-hook-g1.txt');
    expect(h).toContain('assistant text blocks: 13; of them opening with the mode line: 1');
    expect(g).toContain('assistant text blocks: 6; of them opening with the mode line: 2');
    for (const r of [h, g]) expect(r).toContain('the installed hook on the final transcript: exit 0');
    expect(h).toMatch(/thinking @\d\d:\d\d:\d\d: Running in Limited Operational mode/);
    expect(g).toMatch(/thinking @\d\d:\d\d:\d\d: Running in Limited Operational mode with only Context7 and Firecrawl available/);
  });

  it('shows why the lead never saw the image tool: not in its tools, not in its tool pool, not in Jamileh\'s pool, whatever the restarts', () => {
    const p = record('pool-evidence.txt');
    expect(p).toMatch(/^orchestrator-digital-agency: 47 entries in its tools allowlist; MCP entries: mcp__chrome-devtools-mcp, /m);
    expect(p).toMatch(/orchestrator-digital-agency:[^\n]*\n {2}names the image server or its tool: NO/);
    expect(p).toMatch(/agency-creative-designer: 20 entries[^\n]*\n {2}names the image server or its tool: yes \(mcp__image-gen__generate_image\)/);
    expect(p).toContain("The lead's deferred-tool pool when the session started (12:54:25 UTC): 44 tools: (built-in) 18, mcp__claude_ai_Firecrawl 9, mcp__context7 2, mcp__stitch 15");
    expect(p).toContain('claude.ai Claude Docs: 0; claude.ai Firecrawl: 9; claude.ai Supabase: 0; claude.ai Vercel: 0; context7: 2');
    expect(p).toContain('removed ["TaskCreate","TaskGet","TaskList","TaskUpdate"]');
    expect(occurrences(p, /matches: none/g)).toBe(9);
    expect(p).toContain("Jamileh's pool in the tool check (13:16:20 UTC): 18 deferred tools: (built-in) 3, mcp__stitch 15");
    expect(fs.existsSync(path.join(RECORDS, 'scripts', 'pool-evidence.mjs'))).toBe(true);
  });
});

describe('the Sitting T observation: the grading', () => {
  it('grades each item of the pass lines in tables, by run: 18 met, 4 not met, none not reached', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(18);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(4);
    expect((o.match(/\| Not reached \|/g) ?? []).length).toBe(0);
    expect(counts(H10K2_HEADING)).toEqual([12, 3, 0]);
    expect(counts(G1_HEADING)).toEqual([6, 1, 0]);
  });

  it('quotes what the lead said word for word, in the observation and in the records', () => {
    const o = observation();
    const h = record('h10k2-gate-timeline.txt');
    for (const quote of ["I'm treating your Gemini choice as the go for exactly that.", "I can't see the tool, so I haven't spawned anyone.", "Jamileh can't call `image-gen` either."]) {
      expect(h, quote).toContain(quote);
      expect(o, quote).toContain(quote);
    }
    const g = record('g1-gate-timeline.txt');
    expect(g).toContain("Emre's plan covers three checks.");
    expect(o).toContain("Emre's plan covers three checks.");
  });

  it('says what Sitting T found: the hook worked, the order was again not followed, the host\'s save lagged, the offer was reached, and the restart failed for a reason in our own files', () => {
    const o = observation();
    expect(o).toMatch(/The amended hook released both leads within three rounds of holds/);
    expect(o).toMatch(/The order of ADR 0051 was not followed in any of the four sessions of Sittings S and T/);
    expect(o).toMatch(/still saw no text block of the lead/);
    expect(o).toMatch(/The lead never saw the image tool, and neither did Jamileh/);
    expect(o).toMatch(/The lead's `tools` did not name the image tool/);
    expect(o).toMatch(/a subagent inherits the MCP tools of the main conversation/);
    expect(o).toMatch(/Five servers were connected and the lead's pool held the tools of two/);
    expect(o).toMatch(/The lead told the user to expect an approval prompt that a local server does not have/);
    expect(o).toMatch(/the first restart carried no `--model sonnet`, and neither restart set the task-list variable/);
    expect(o).toMatch(/The image route had only ever been run with Jamileh as the main agent/);
  });

  it('says what is not established: that the fix works (Sitting U, H10m), that she can generate as a teammate, the real charge, and a deterministic guard for the lead', () => {
    const o = observation();
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether the lead and Jamileh find the tool once the lead holds it \(Sitting U, H10m\)/);
    expect(o).toMatch(/Whether she can then make an image as a teammate/);
    expect(o).toMatch(/A hook that denies the lead's own calls to the tool is not built/);
    expect(o).toMatch(/A release after a number of rounds/);
  });
});

describe('the protocol, ADRs 0049 and 0051 and the plan state Sitting T', () => {
  it('records Sitting T as run, with its cost and what it found, and Sitting U as proposed', () => {
    const t = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting T |')) ?? '';
    expect(t).toMatch(/H10k2 again and G1 again/);
    expect(t).toMatch(/3\.0 USD and 2 prompts/);
    expect(t).toMatch(/run 2026-10-12/);
    expect(t).toMatch(/used 2\.6494 USD of model cost in 2 prompts/);
    expect(t).toMatch(/within three rounds of holds/);
    expect(t).toMatch(/neither the lead nor Jamileh saw the image tool/);
    expect(t).not.toMatch(/not yet run/);
    const u = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting U |')) ?? '';
    expect(u).toMatch(/H10m/);
    expect(u).toMatch(/1\.5 USD and 1 prompt/);
    // Sitting U has run since (2026-10-12): its row says so, and tests/designer-sitting-u-observation.test.ts pins what it found.
    expect(u).toMatch(/proposed 2026-10-12/);
  });

  it('defines H10m: the image tool reaches the team (the lead and Jamileh each list it, nothing is generated), with its prompt, evidence, pass and fail', () => {
    const m = protocolSection('## H10m ');
    expect(m).toMatch(/lead and Jamileh each list `mcp__image-gen__generate_image`/);
    expect(m).toMatch(/### H10m Prompt/);
    expect(m).toMatch(/### H10m Pass/);
    expect(m).toMatch(/### H10m Fail/);
    expect(m).toMatch(/add-server\.ps1/);
    expect(m).toMatch(/pool/);
    const prompt = /### H10m Prompt\n[^\n]*\n?```text\n([\s\S]*?)\n```/.exec(m);
    expect(prompt).not.toBeNull();
    expect(prompt![1]).toMatch(/ToolSearch/);
    expect(prompt![1]).toMatch(/jamileh/i);
    expect(prompt![1]).toMatch(/generate no image|generates no image|write no files/);
  });

  it('amends the cost of H10k with the result of Sitting T, and the cost of G1', () => {
    const k = protocolSection('## H10k ');
    const cost = k.slice(k.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting T/);
    expect(cost).toContain(NAME);
    expect(cost).toMatch(/2\.2254 USD by the session's own cost record/);
    expect(cost).toMatch(/5 calls in 3 messages/);
    expect(cost).toMatch(/Sitting U runs H10m/);
    expect(cost).toMatch(/Ceiling for Sitting T[^\n]*\(run; see the amendment below\)/);
    expect(cost).toMatch(/Ceiling for Sitting U/);
    const g = PROTOCOL.slice(PROTOCOL.indexOf('**Amended 2026-10-07 (Plan 035 N3).**'), PROTOCOL.indexOf('## After a sitting'));
    expect(g).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting T/);
    expect(g).toMatch(/G1 ran again on the amended hook \(session `8370a0ca`, 0\.4240 USD/);
  });

  it('has Sitting T in ADR 0049: the lead holds the one tool too, and why; and what is still not established', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sitting T \(`host-library\/claude\/observations\/2026-10-12-claude-2\.1\.296-designer-sitting-t\.md`\)/);
    expect(ADR).toMatch(/\*\*One tool, two roles\.\*\*/);
    expect(ADR).toMatch(/a subagent inherits the MCP tools of the main conversation/);
    expect(ADR).toMatch(/the lead holds it so that her pool has it, and never calls it/);
    // Sitting U answered it (the lead and Jamileh found the tool): ADR 0049 now says "established in Sitting U, H10m".
    expect(ADR).toMatch(/Sitting U, H10m/);
  });

  it('records in ADR 0051 that the amended hook released both leads within three rounds in Sitting T', () => {
    expect(ADR_0051).toContain(NAME);
    expect(ADR_0051).toMatch(/Sitting T/);
    expect(ADR_0051).toMatch(/within three rounds of holds/);
  });

  it('says in the plan what Sitting T found about H10k, in the one paragraph about it', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting T \(run on 2026-10-12[^\n]*released within three rounds[^\n]*the lead did not hold the image tool[^\n]*Sitting U repeats it/);
  });
});
