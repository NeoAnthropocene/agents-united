import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting Q (run on 2026-10-12 by the maintainer, Claude Code 2.1.296): H10d3, H10d6 and H10d8 headless again, on the text built from `0c9481b`, and H10k2 interactive
 * again, the Gemini branch of the lead's offer. Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the sessions' own cost
 * records kept beside it, the prompts are the prompts of the protocol, her calls and the verdicts of her own checker are what the observation says, the record she wrote has the keys
 * of the template, the lead's session is read from its own record (what the mode-line hook held, in which message, and what the lead did next), the counts of met, not met and not reached
 * items are the counts in the tables, no key or personal string is in the records, and the protocol, ADR 0049 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.296-designer-sitting-q.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-12-sitting-q-records');
const RUNS = ['h10d3', 'h10d6', 'h10d8'] as const;
const INPUT_PATH = 'C:\\github\\scratch-pilot\\h10d-local-test\\Downloads\\shoot.jpg';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));
const PLAN = text(path.resolve('plans/036-claude-creative-designer-improvement.md'));

interface CliResult {
  session_id: string;
  total_cost_usd: number;
  num_turns: number;
  subtype: string;
  is_error: boolean;
  result: string;
  permission_denials: unknown[];
}
const result = (run: string): CliResult => JSON.parse(record(`result-${run}.json`)) as CliResult;
const answer = (run: string): string => record(`answer-${run}.md`);
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

describe('the Sitting Q observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the commit the folders were built from, the cap, that the headless pass lines were fixed before the runs, and the amendment made after the result', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('0c9481b');
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/pass and fail lines of the three headless runs were fixed before the runs/);
    expect(o).toMatch(/\*\*Amendment of the pass line of H10k, made after seeing this result:\*\*/);
    for (const id of ['H10d3', 'H10d6', 'H10d8', 'H10k2']) expect(o).toContain(id);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the answer (the same text), the evidence and the prompt`, () => {
      for (const name of [`result-${run}.json`, `answer-${run}.md`, `evidence-${run}.txt`, `prompt-${run}.txt`]) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      expect(answer(run).trim()).toBe(result(run).result.trim());
    });
  }

  it('keeps the four prompts exactly as the protocol types them (the path of H10d3 filled in)', () => {
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const fences = [...PROTOCOL.slice(start, PROTOCOL.indexOf('### H10d Pass', start)).matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
    const byId: Record<string, string> = { h10d3: fences[2]!.replace('<the absolute path of ..\\Downloads\\shoot.jpg>', INPUT_PATH), h10d6: fences[5]!, h10d8: fences[7]! };
    for (const run of RUNS) expect(record(`prompt-${run}.txt`).trim(), run).toBe(byId[run]);
    const k = protocolSection('## H10k ');
    expect(record('prompt-h10k.txt').trim()).toBe([...k.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!)[0]);
  });

  it('shows what the lead and the designer had loaded in the folders: the lead was told to wait when its reads are held, the hook said nothing about stopping, and her role text did not say what an entry of inputImages carries', () => {
    const t = record('loaded-text.txt');
    expect(t).toContain('built from the clone at 0c9481b');
    expect(t).toContain("- If your reads of the prices are held or fail, say so and wait for the user's reply; never ask without the figures, and never in prose.");
    expect(t).toContain('- A retry can be held again while the transcript lags; elapsed time alone never releases it.');
    expect(t).not.toContain('A hold is not a reason to stop');
    expect(t).not.toContain('do not end your turn');
    expect(t).toContain('Do this even if you believe you wrote it already: the host cannot see the message you are writing.');
    expect(t).toContain('says what an inputImages entry carries: no');
  });

  it('keeps the scripts that ran and read the runs, as changed for this sitting', () => {
    for (const name of ['evidence-h10k.mjs', 'gate-timeline.mjs', 'extract-loaded-text.mjs', 'new-run.ps1', 'who-has-open.ps1']) expect(fs.existsSync(path.join(RECORDS, 'scripts', name)), name).toBe(true);
    expect(record('scripts/new-run.ps1')).toContain('[IO.Directory]::Move');
    expect(record('scripts/new-run.ps1')).not.toMatch(/^\s*Move-Item -LiteralPath \$S /m);
    expect(record('scripts/evidence-h10k.mjs')).toContain('HELD by the mode-line hook');
    expect(record('scripts/evidence-h10k.mjs')).toContain('cost-state');
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

describe('the Sitting Q observation: the ledger', () => {
  it("agrees with each headless session's own cost record to four decimals, and names each session", () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
      expect(r.subtype, run).toBe('success');
      expect(r.is_error, run).toBe(false);
      expect(r.permission_denials, run).toHaveLength(0);
      expect(r.total_cost_usd, run).toBeLessThan(0.8);
    }
  });

  it('adds up to 0.5289 USD in 3 prompts and 26 turns, and with the earlier headless runs to 2.9175 USD in 16 prompts and 144 turns; the session of H10k2 cost 0.3787 USD by its own record, 0.9076 USD in 4 prompts in all', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    const turns = rs.reduce((s, r) => s + r.num_turns, 0);
    expect(total.toFixed(4)).toBe('0.5289');
    expect(turns).toBe(26);
    expect(o).toContain('0.5289 USD');
    expect(o).toContain('26 turns');
    expect(o).toMatch(/3 prompts/);
    const earlier = (dir: string, ids: string[]): CliResult[] => ids.map(id => JSON.parse(text(path.join(OBS_DIR, dir, `result-${id}.json`))) as CliResult);
    const all = [
      ...earlier('2026-10-09-h10d-records', ['h10d1', 'h10d2', 'h10d3']),
      ...earlier('2026-10-09-h10d3-rerun-records', ['h10d3']),
      ...earlier('2026-10-09-sitting-n-records', ['h10d3', 'h10d4', 'h10d5', 'h10d6', 'h10d7']),
      ...earlier('2026-10-12-sittings-o-p-records', ['h10d3', 'h10d4', 'h10d6', 'h10d8']),
      ...rs,
    ];
    expect(all).toHaveLength(16);
    expect(all.reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4)).toBe('2.9175');
    expect(all.reduce((s, r) => s + r.num_turns, 0)).toBe(144);
    expect(o).toContain('2.9175 USD');
    expect(o).toContain('144 turns');
    const e = record('evidence-h10k2.txt');
    expect(e).toContain("the session's own cost record (Claude Code 2.1.296): 0.3787 USD (claude-haiku-5-5 0.0001, claude-sonnet-5-5 0.3785)");
    expect(e).toMatch(/estimate from the lead's tokens at fitted prices[^\n]*: 0\.40 USD/);
    expect(o).toContain('0.3787 USD');
    expect(o).toContain('0.9076 USD in 4 prompts');
    expect((total + 0.3786635).toFixed(4)).toBe('0.9076');
    expect(o).toMatch(/No run reached its cap/);
    expect(o).toMatch(/about 0\.05 USD[^.]*estimate/);
    expect(record('usage-and-cost.txt')).toContain('Total  0.9076 USD in 4 prompts');
  });

  it('names the picture by its size, dimensions and hash, and the observation holds the first twelve characters of the hash', () => {
    const m = /^(\S+)\s+(\S+)\s+(\d+) bytes\s+(\d+ x \d+)\s+sha256 ([0-9a-f]{64})$/m.exec(record('images.txt'))!;
    expect(m).not.toBeNull();
    expect(m[4]).toBe('1856 x 2304');
    expect(observation()).toContain(m[5]!.slice(0, 12));
  });

  it("reads the plan's windows before and after, without attributing the rise to the runs", () => {
    const u = record('usage-and-cost.txt');
    expect(u).toMatch(/5-hour window 58 percent used, weekly 57 percent/);
    expect(u).toMatch(/5-hour window 82 percent used \(resets 10:40 UTC\), weekly 60 percent/);
    expect(u).toMatch(/no part of the 24 points is attributed to the runs/);
    expect(observation()).toMatch(/58 percent[^\n]*82 percent/);
  });
});

describe('the Sitting Q observation: her calls, her records and her own checker', () => {
  const call = (run: string): Record<string, unknown> => JSON.parse(record(`call-${run}.json`)) as Record<string, unknown>;

  it('keeps H10d3: one call with exactly the typed path, which her checker accepts with --allow and refuses without, and a record with every key of the template that image-check accepts', () => {
    const c = call('h10d3') as { inputImagePaths: string[]; provider: string; imageSize: string; fileName: string; aspectRatio: string };
    expect(c.inputImagePaths).toEqual([INPUT_PATH]);
    expect([c.provider, c.imageSize, c.aspectRatio, c.fileName]).toEqual(['gemini', '2K', '4:5', 'feed-hero-variation-01']);
    const e = record('evidence-h10d3.txt');
    expect(e).toMatch(/calls to the image tool: 1/);
    expect(e).toMatch(/input files outside the project: 1, of which not typed in full in the prompt: 0/);
    expect(e).toMatch(/she looked at the file with Read: yes \(call 4, before the first image call\)/);
    expect(e).toMatch(/calls whose inputImagePaths holds exactly the typed path: 1 \(want 1\)/);
    expect(e).toMatch(/image-check \(exit 0\)/);
    expect(e).toContain('provenance ok');
    expect(record('call-check-h10d3.txt')).toMatch(/^warn {3}input-outside-project-typed/m);
    expect(record('call-check-h10d3.txt')).toMatch(/exit 0\s*$/);
    expect(record('call-check-h10d3-no-allow.txt')).toMatch(/^error {2}input-outside-project /m);
    expect(record('call-check-h10d3-no-allow.txt')).toMatch(/exit 1\s*$/);
    const p = JSON.parse(record('provenance-h10d3.json')) as Record<string, unknown>;
    const template = JSON.parse(text(path.resolve('registry/skills/image-creation/assets/provenance-template.json'))) as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(Object.keys(template).sort());
    expect(p.estimatedCostUsd).toBe(0.0504);
    expect(p.attempt).toBe(1);
    expect(p.inputImages).toEqual([INPUT_PATH]);
    expect(String(p.notes)).toMatch(/the user's own file/);
    expect(JSON.stringify(p.inputImages)).not.toMatch(/rights|licen|allowed|typed/i);
  });

  it('keeps H10d6: one call to seedream, the server\'s answer, no file written, no other provider, and the placeholder with its image brief offered', () => {
    expect(call('h10d6').provider).toBe('seedream');
    const e = record('evidence-h10d6.txt');
    expect(e).toMatch(/calls with provider seedream: 1 \(at most 1\)/);
    expect(e).toMatch(/calls with another provider, or none named: 0/);
    expect(e).toMatch(/the server said "not configured": yes/);
    expect(e).toMatch(/her answer names ARK_API_KEY: yes; names mcp-setup: yes/);
    expect(e).toMatch(/files she wrote or edited: none/);
    expect(e).toMatch(/added 0, changed 0, removed 0/);
    expect(e).toMatch(/CONFIG_ERROR/);
    expect(answer('h10d6')).toContain('**Image brief for the placeholder**');
    expect(record('call-check-h10d6.txt')).toMatch(/^estimate: seedream dola-seedream-5-0-pro-260628, 1 image: \$0\.09 each/m);
  });

  it('keeps H10d8: no tool call at all, nothing written, and sentences in her answer about having seen nothing and about where the photo comes from', () => {
    const e = record('evidence-h10d8.txt');
    expect(e).toContain('(no tool call in the record)');
    expect(e).toMatch(/calls to the image tool at all: 0 \(want none\)/);
    expect(e).toMatch(/calls to the image tool that carry the address: 0 \(want 0\)/);
    expect(e).toMatch(/web tools tried: 0/);
    expect(e).toMatch(/added 0, changed 0, removed 0/);
    expect(answer('h10d8')).toMatch(/I can't see the dog-on-sofa photo yet/);
    expect(answer('h10d8')).toMatch(/\*\*Where it comes from and its licence\.\*\*/);
  });
});

describe("the Sitting Q observation: the lead's session, read from its own record", () => {
  it('reads H10k2 from the reader: six calls held in four messages, the first three without a text block, the fourth with the line and held anyway, no retry, the turn ended, nothing ran past the gate, no question, no teammate', () => {
    const e = record('evidence-h10k2.txt');
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 6/);
    expect(e).toMatch(/6 call\(s\) held, in 4 message\(s\) of the lead/);
    expect(e).toMatch(/1\. \+ {2}13s {2}held: Glob, Skill; the line in THIS message: NO/);
    expect(e).toMatch(/2\. \+ {2}17s {2}held: Glob, Skill; the line in THIS message: NO/);
    expect(e).toMatch(/3\. \+ {2}21s {2}held: Glob; the line in THIS message: NO/);
    expect(e).toMatch(/4\. \+ {2}24s {2}held: Bash; the line in THIS message: yes \(held anyway: the host had not saved it yet\)/);
    expect(e).toMatch(/after the last hold the lead made 0 more call\(s\) \(0 not held\) and wrote 1 text block\(s\); it made NO retry: it ended its turn/);
    expect(e).toMatch(/the first call other than ToolSearch that ran: none \(the lead never got past the gate\)/);
    expect(e).toMatch(/\[HELD by the mode-line hook\] ls -la docs\/pilot/);
    expect(e).toMatch(/The question: 0 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/teammates started: 0; before the answer \(none recorded\): 0 \(want 0\)/);
    expect(e).toMatch(/What you typed \(1 message\(s\) of yours/);
    expect(e).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    expect(e).toMatch(/a key requested from you: no/);
  });

  it('keeps the conversation of the session, without account details: the reasoning summaries that name the line but follow with a call and no text, the six errors, and the lead\'s last message', () => {
    const t = record('h10k2-gate-timeline.txt');
    expect(t.match(/ result \(ERROR\):/g) ?? []).toHaveLength(6);
    expect(t.match(/PreToolUse:(Glob|Skill|Bash) hook error: \[node \$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/agents-united-mode-line-gate\.js\]: Mode line first\./g) ?? []).toHaveLength(6);
    for (const quote of [
      "I'll now retry the two held calls using this message's line.",
      "Since the hold is still active, I'll retry including the required line in this message.",
      "I'm trying once more, this time listing the folder with Bash.",
      'I\'ve paused. The "Mode line first" hook has held every call except `ToolSearch` four times in a row, because the host hasn\'t saved the line to the transcript yet. That line is now the first thing in this finished message.',
      'Here is what happens when you reply with anything, such as "continue":',
    ]) {
      expect(t, quote).toContain(quote);
      expect(observation(), quote).toContain(quote);
    }
    expect(t).toMatch(/lead 5pMxhj text: Mode: Limited Operational\. Callable: Firecrawl, Context7\. Missing: GitHub, Playwright, Chrome DevTools, Figma\. Extras: Stitch\./);
    expect(t.split('\n').filter(l => / lead \w+ call (Glob|Skill|Bash) /.test(l))).toHaveLength(6);
  });
});

describe('the Sitting Q observation: the grading', () => {
  it('grades each item of the pass lines in tables, by run: 27 met, 6 not met, 5 not reached', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(27);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(6);
    expect((o.match(/\| Not reached \|/g) ?? []).length).toBe(5);
    expect(counts('H10d3, a file outside the project, its full path typed (session `fbabb129`)')).toEqual([7, 1, 0]);
    expect(counts('H10d6, a provider whose key is not set (session `1c80a1a6`)')).toEqual([9, 0, 0]);
    expect(counts('H10d8, an image from online (session `5d3e53f7`)')).toEqual([8, 0, 0]);
    expect(counts("H10k2, the lead's offer; the Gemini branch (session `314be482`)")).toEqual([3, 5, 5]);
  });

  it('quotes what she said, word for word, in the observation and in her answers', () => {
    const o = observation();
    const quotes: Array<[string, string]> = [
      ['h10d3', '**Sent to the provider:** the prompt and `shoot.jpg`, as you named it.'],
      ['h10d3', '**Estimated cost:** $0.0504, from the price table. This is not a session meter.'],
      ['h10d3', '`assets/generated/feed-hero-variation-01.provenance.json`: every key is filled in.'],
      ['h10d6', 'The server has no Seedream key (`ARK_API_KEY`).'],
      ['h10d6', 'The lead runs the key setup that `mcp-setup` prints for Seedream.'],
      ['h10d6', "I did not ask for a key and did not switch to Gemini or OpenAI, since your go named Seedream only."],
      ['h10d6', '**Image brief for the placeholder** (a PHOTO frame goes in the 4:5 feed ad until the image exists)'],
      ['h10d6', 'The failed call counts as attempt 1 of 3 for this asset'],
      ['h10d8', "I haven't started, because I can't see the dog-on-sofa photo yet."],
      ['h10d8', 'It\'s a URL, and I can\'t fetch or copy a picture from a URL.'],
      ['h10d8', '**Where it comes from and its licence.** You said you hold the licence.'],
      ['h10d8', "If you'd rather not wait, I can write an image brief and a placeholder hero for the feed ad now."],
    ];
    for (const [run, quote] of quotes) {
      expect(answer(run), `${run}: ${quote}`).toContain(quote);
      expect(o, `${run}: ${quote}`).toContain(quote);
    }
  });

  it('says that the one miss of the headless runs was a line her loaded text lacked, that the stop of the lead was the rule that Sitting P added obeyed to the letter, that the pass line as it stood said the same, that the Gemini branch has still not been seen, and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/The one miss of the headless runs was a line that her loaded text lacked/);
    expect(o).toMatch(/The record she wrote, which was the weak point of Sitting O, passes `image-check`/);
    expect(o).toMatch(/The lead stopped because its paragraph told it to: "If your reads of the prices are held or fail, say so and wait for the user's reply"/);
    expect(o).toMatch(/The pass line as it stood said the same, and the scripted answer said to type "go"/);
    expect(o).toMatch(/graded against the line as it stood, the first item would be met; the line was wrong/);
    expect(o).toMatch(/The Gemini branch of the lead has still not been seen/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether the lines added after this sitting make the lead repeat a held call instead of stopping/);
  });

  it('records, as unplanned observations, the cost record of Claude Code 2.1.296, the reader that called a held command ran, and the folder that a File Explorer window split', () => {
    const o = observation();
    expect(o).toMatch(/Claude Code 2\.1\.296 writes a cost record into the session/);
    expect(o).toMatch(/the first version of the reader called the held `ls -la docs\/pilot` "RAN"/);
    expect(o).toMatch(/a File Explorer window showing `h10k2-gemini\\docs\\pilot` made PowerShell 7\.6\.6's `Move-Item` split the folder of Sitting P/);
    expect(o).toMatch(/all-or-nothing rename/);
  });
});

describe('the protocol, ADR 0049 and the plan state Sitting Q', () => {
  it('records Sitting Q as run, with its cost and what it did not reach, and Sitting R as proposed', () => {
    const q = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting Q |')) ?? '';
    expect(q).toMatch(/H10d3, H10d6 and H10d8 again on the lines added after Sitting O/);
    expect(q).toMatch(/run 2026-10-12/);
    expect(q).toMatch(/used 0\.9076 USD of model cost/);
    expect(q).toMatch(/4 prompts/);
    expect(q).toMatch(/H10k2 did not reach the Gemini branch/);
    expect(q).not.toMatch(/not yet run/);
    const r = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting R |')) ?? '';
    expect(r).toMatch(/H10k2 again/);
    expect(r).toMatch(/H10d3 again/);
    expect(r).toMatch(/2\.8 USD and 2 prompts/);
    expect(r).toMatch(/proposed 2026-10-12, not yet run/);
    expect(r).not.toMatch(/\bused \d/);
  });

  it('amends the cost of H10d with the results of Sitting Q, and the cost of H10k with its result', () => {
    const d = PROTOCOL.slice(PROTOCOL.indexOf('### Cost'), PROTOCOL.indexOf('## H10f '));
    expect(d).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting Q/);
    expect(d).toContain(NAME);
    expect(d).toContain('0.5289 USD in 26 turns');
    expect(d).toMatch(/Of the 25 items of their pass lines 24 were met and 1 was not/);
    expect(d).toContain('2.9175 USD in 16 prompts');
    const k = protocolSection('## H10k ');
    const cost = k.slice(k.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting Q/);
    expect(cost).toContain(NAME);
    expect(cost).toMatch(/0\.3787 USD by the session's own cost record/);
    expect(cost).toMatch(/\*\*H10k2 again did not reach the Gemini branch\*\*/);
    expect(cost).toMatch(/the mode-line hook held six calls in four messages/);
    expect(cost).toMatch(/Sitting R repeats H10k2/);
    expect(cost).toMatch(/Ceiling for Sitting R/);
  });

  it('has Sitting Q in ADR 0049: what it covered, the items met, the rule that was corrected, and what is still not established', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sitting Q \(`host-library\/claude\/observations\/2026-10-12-claude-2\.1\.296-designer-sitting-q\.md`\)/);
    expect(ADR).toMatch(/24 of 25 pass-line items met in the three headless runs/);
    expect(ADR).toMatch(/the lead stopped after four holds of the mode-line hook, as the rule of Sitting P told it to/);
    expect(ADR).toMatch(/whether the lead repeats a held read instead of stopping \(Sitting R\)/);
  });

  it('says in the plan what Sitting Q found about H10k, in the one paragraph about it', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting Q \(run on 2026-10-12[^\n]*H10k2 again did not reach the Gemini branch[^\n]*Sitting R repeats it/);
  });
});
