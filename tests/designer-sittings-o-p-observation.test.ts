import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sittings O and P (run on 2026-10-09 by the maintainer, read on 2026-10-12): H10d3, H10d4, H10d6 and H10d8 headless, then the lead's offer (H10k) in two
 * interactive sessions. Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the sessions' own cost records kept beside
 * it, the estimate for the interactive sessions agrees with the fit that produced it, the prompts are the prompts of the protocol, her calls and the verdicts of her own
 * checker are what the observation says, the counts of met and not met items are the counts in the tables, the lead's figures agree with the checker of this repository, no
 * key or personal string is in the records, and the protocol, ADR 0049 and the plan state the sittings. The pass and fail lines it grades by were fixed before the runs (PR 196).
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.294-designer-sittings-o-and-p.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-12-sittings-o-p-records');
const RUNS = ['h10d3', 'h10d4', 'h10d6', 'h10d8'] as const;
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
const counts = (heading: string): [number, number] => {
  const s = section(heading);
  return [(s.match(/\| Met \|/g) ?? []).length, (s.match(/\| Not met \|/g) ?? []).length];
};
const protocolSection = (heading: string): string => {
  const start = PROTOCOL.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n## ', start + 5);
  return PROTOCOL.slice(start, next === -1 ? undefined : next);
};

describe('the Sittings O and P observation: the record', () => {
  it('says it is an observation of installed builds, names the builds, the model, the commit they were built from, the cap, that the pass lines were fixed before the runs and that two changes were made after the results', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toContain('2.1.295');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('45363d9');
    expect(o).toContain('39da247');
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/pass and fail lines of both sittings were fixed before the runs \(PR 196\)/);
    expect(o).toMatch(/Two changes after seeing the results are marked where they are made/);
    for (const id of ['H10d3', 'H10d4', 'H10d6', 'H10d8', 'H10k1', 'H10k2']) expect(o).toContain(id);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the answer (the same text), the evidence and the prompt`, () => {
      for (const name of [`result-${run}.json`, `answer-${run}.md`, `evidence-${run}.txt`, `prompt-${run}.txt`]) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      expect(answer(run).trim()).toBe(result(run).result.trim());
    });
  }

  it('keeps the five prompts exactly as the protocol types them (the path of H10d3 filled in)', () => {
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const fences = [...PROTOCOL.slice(start, PROTOCOL.indexOf('### H10d Pass', start)).matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
    const byId: Record<string, string> = { h10d3: fences[2]!.replace('<the absolute path of ..\\Downloads\\shoot.jpg>', INPUT_PATH), h10d4: fences[3]!, h10d6: fences[5]!, h10d8: fences[7]! };
    for (const run of RUNS) expect(record(`prompt-${run}.txt`).trim(), run).toBe(byId[run]);
    const k = protocolSection('## H10k ');
    expect(record('prompt-h10k.txt').trim()).toBe([...k.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!)[0]);
  });

  it('shows from her own session records what each run had loaded: the typed-path rule, a pointer to the template and not its keys, the placeholder in SKILL.md after a missing key and not in her role text, nothing about "not seen"', () => {
    const blocks = record('loaded-text.txt').split('\n\n');
    for (const run of RUNS) {
      const block = blocks.find(b => b.startsWith(`${run} (${result(run).session_id})`));
      expect(block, run).toBeDefined();
      expect(block, run).toContain('image-generation loaded: yes');
      for (const [pattern, label] of [
        [/^yes {2}SKILL\.md, rule 5: the typed-path rule/m, 'SKILL.md, the typed-path rule'],
        [/^no {3}SKILL\.md, step 5: the keys of the template listed/m, 'step 5 does not list the keys'],
        [/^yes {2}SKILL\.md, step 5: a pointer to the template, not its keys/m, 'step 5 points at the template'],
        [/^yes {2}SKILL\.md, edge case: a missing key, offer the placeholder/m, 'SKILL.md offers the placeholder after a missing key'],
        [/^no {3}SKILL\.md, edge case: say that you have not seen it/m, 'SKILL.md does not say "not seen"'],
        [/^yes {2}her role text: the typed-path rule/m, 'her role text, the typed-path rule'],
        [/^no {3}her role text: the placeholder after a missing key/m, 'her role text does not say the placeholder after a missing key'],
        [/^no {3}her role text: the keys of the template/m, 'her role text does not name the keys'],
      ] as const) {
        expect(block, `${run}: ${label}`).toMatch(pattern);
      }
    }
  });

  it('keeps the scripts that ran and read the runs', () => {
    for (const name of ['evidence.mjs', 'evidence-h10k.mjs', 'verify-installed.mjs', 'sum-usage.mjs', 'run.sh', 'run.ps1', 'run-batch.ps1', 'prepare-batch.ps1', 'new-run.ps1', 'start-h10k.ps1']) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
  });

  it('holds no key shape and no personal string, in the records or the observation (the host\'s time zone is left out of the copy of H10k2)', () => {
    for (const file of [...walk(RECORDS), OBSERVATION]) {
      const t = text(file);
      const rel = path.relative(OBS_DIR, file);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b/i);
    }
  });
});

describe('the Sittings O and P observation: the ledger', () => {
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

  it('adds up to the stated total in 4 prompts and 42 turns, and with Sittings L, M and N to 13 prompts, 118 turns and 2.3886 USD, under the ceiling of 3.2 USD', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    const turns = rs.reduce((s, r) => s + r.num_turns, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toContain(`${turns} turns`);
    expect(o).toMatch(/4 prompts/);
    expect(turns).toBe(42);
    expect(total).toBeLessThan(3.2);
    const earlier = (dir: string, ids: string[]): CliResult[] => ids.map(id => JSON.parse(text(path.join(OBS_DIR, dir, `result-${id}.json`))) as CliResult);
    const all = [
      ...earlier('2026-10-09-h10d-records', ['h10d1', 'h10d2', 'h10d3']),
      ...earlier('2026-10-09-h10d3-rerun-records', ['h10d3']),
      ...earlier('2026-10-09-sitting-n-records', ['h10d3', 'h10d4', 'h10d5', 'h10d6', 'h10d7']),
      ...rs,
    ];
    expect(all).toHaveLength(13);
    expect(o).toContain(all.reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4));
    expect(o).toContain(`${all.reduce((s, r) => s + r.num_turns, 0)} turns`);
    expect(o).toMatch(/No run reached its cap/);
    expect(o).toMatch(/about 0\.10 USD[^.]*estimate/);
  });

  it('estimates the two interactive sessions at prices that reproduce the four headless runs to four decimals, and the estimate in the observation is the one the reader printed', () => {
    const fit = record('price-fit.txt');
    expect(fit).toMatch(/output 10\.01 USD per million tokens, cache write 4\.00, cache read 0\.20/);
    for (const run of RUNS) {
      const m = new RegExp(`run ${run}: actual ([0-9.]+), fitted ([0-9.]+)`).exec(fit)!;
      expect(m, run).not.toBeNull();
      expect(m[1], run).toBe(result(run).total_cost_usd.toFixed(4));
      expect(m[2], `${run} fitted`).toBe(m[1]);
    }
    const estimate = (id: string): { lead: string; teammates: string; all: string } => {
      const m = /estimated cost of the session with its (\d+) teammate transcript\(s\): ([0-9.]+) USD \(lead ([0-9.]+), teammates ([0-9.]+)\)/.exec(record(`evidence-${id}.txt`))!;
      expect(m, id).not.toBeNull();
      return { all: m[2]!, lead: m[3]!, teammates: m[4]! };
    };
    const one = estimate('h10k1');
    const two = estimate('h10k2');
    expect([one.lead, one.teammates, one.all]).toEqual(['0.83', '1.04', '1.87']);
    expect([two.lead, two.teammates, two.all]).toEqual(['1.32', '2.38', '3.71']);
    expect((Number(one.all) + Number(two.all)).toFixed(2)).toBe('5.58');
    const o = observation();
    expect(o).toContain('about 1.87 (lead 0.83, teammates 1.04)');
    expect(o).toContain('about 3.71 (lead 1.32, teammates 2.38)');
    expect(o).toContain('About 5.58 USD for the sitting');
    expect(o).toMatch(/output 10\.01, cache write 4\.00 and cache read 0\.20 USD per million tokens/);
    expect(o).toMatch(/6 messages were typed against the 4 prompts proposed/);
    expect(record('evidence-h10k1.txt')).toMatch(/What you typed \(2 message\(s\) of yours/);
    expect(record('evidence-h10k2.txt')).toMatch(/What you typed \(4 message\(s\) of yours/);
  });
});

describe('the Sittings O and P observation: her calls, her records and her own checker', () => {
  const call = (run: string): Record<string, unknown> => JSON.parse(record(`call-${run}.json`)) as Record<string, unknown>;

  it('keeps H10d3: one call with exactly the typed path, which her checker accepts with --allow and refuses without, and a record in keys of her own that image-check rejects', () => {
    const c = call('h10d3') as { inputImagePaths: string[]; provider: string; imageSize: string; fileName: string };
    expect(c.inputImagePaths).toEqual([INPUT_PATH]);
    expect([c.provider, c.imageSize, c.fileName]).toEqual(['gemini', '2K', 'feed-hero-variation-01']);
    const e = record('evidence-h10d3.txt');
    expect(e).toMatch(/calls to the image tool: 1/);
    expect(e).toMatch(/input files outside the project: 1, of which not typed in full in the prompt: 0/);
    expect(e).toMatch(/she looked at the file with Read: yes \(call 3, before the first image call\)/);
    expect(e).toMatch(/image-check \(exit 1\)/);
    expect(e).toContain('missing asset, missing createdAt, missing server, missing approvedBy, missing disclosure, attempt must be a positive whole number, estimatedCostUsd must be a number');
    expect(record('call-check-h10d3.txt')).toMatch(/^warn {3}input-outside-project-typed/m);
    expect(record('call-check-h10d3.txt')).toMatch(/exit 0\s*$/);
    expect(record('call-check-h10d3-no-allow.txt')).toMatch(/^error {2}input-outside-project /m);
    expect(record('call-check-h10d3-no-allow.txt')).toMatch(/exit 1\s*$/);
    const p = JSON.parse(record('provenance-h10d3.json')) as Record<string, unknown>;
    expect(p.inputImagePaths).toEqual([INPUT_PATH]);
    expect(p.inputImageNote).toBe('User-owned stock photo, path typed by the user in this task; sent to the provider.');
    expect(p.costUsd).toBe(0.0504);
    expect(p).not.toHaveProperty('inputImages');
    expect(p).not.toHaveProperty('estimatedCostUsd');
    expect(p).not.toHaveProperty('attempt');
  });

  it('keeps H10d4: one text-only call, the path of the brief nowhere in it, and a record that image-check accepts with a numeric cost', () => {
    const c = call('h10d4');
    expect([c.provider, c.aspectRatio, c.imageSize]).toEqual(['gemini', '4:5', '2K']);
    expect(c.inputImagePaths).toBeUndefined();
    expect(JSON.stringify(c)).not.toContain('shoot.jpg');
    const e = record('evidence-h10d4.txt');
    expect(e).toMatch(/calls that carry the path from the brief: 0/);
    expect(e).toMatch(/image-check \(exit 0\)/);
    const p = JSON.parse(record('provenance-h10d4.json')) as { estimatedCostUsd: number; inputImages: unknown[] };
    expect(p.estimatedCostUsd).toBe(0.0504);
    expect(p.inputImages).toEqual([]);
    expect(answer('h10d4')).toContain('The brief tells me to pass `C:\\github\\scratch-pilot\\h10d-local-test\\Downloads\\shoot.jpg` to the image tool.');
    expect(answer('h10d4')).toContain('**The reference file:** the decision above is yours to make.');
  });

  it('keeps H10d6: one call to seedream, the server\'s answer, no file written, no other provider, and no word "placeholder" in her answer', () => {
    expect(call('h10d6').provider).toBe('seedream');
    const e = record('evidence-h10d6.txt');
    expect(e).toMatch(/calls with provider seedream: 1 \(at most 1\)/);
    expect(e).toMatch(/calls with another provider, or none named: 0/);
    expect(e).toMatch(/the server said "not configured": yes/);
    expect(e).toMatch(/her answer names ARK_API_KEY: yes; names mcp-setup: yes/);
    expect(e).toMatch(/files she wrote or edited: none/);
    expect(e).toMatch(/CONFIG_ERROR/);
    expect(answer('h10d6')).not.toMatch(/placeholder/i);
    expect(record('call-check-h10d6.txt')).toMatch(/^estimate: seedream dola-seedream-5-0-pro-260628, 1 image: \$0\.09 each/m);
  });

  it('keeps H10d8: no call at all, no web tool, nothing written, and no sentence in her answer about having seen nothing or about where the photo comes from', () => {
    const e = record('evidence-h10d8.txt');
    expect(e).toMatch(/calls to the image tool at all: 0 \(want none\)/);
    expect(e).toMatch(/calls to the image tool that carry the address: 0 \(want 0\)/);
    expect(e).toMatch(/web tools tried: 0/);
    expect(e).toMatch(/added 0, changed 0, removed 0/);
    expect(answer('h10d8')).not.toMatch(/\bseen\b|comes from|where it came from|where the (photo|picture) is from/i);
  });

  it('names the two pictures by their size, dimensions and hash, and the observation holds the first twelve characters of each hash', () => {
    const images = record('images.txt');
    const rows = [...images.matchAll(/^(\S+)\s+(\S+)\s+(\d+) bytes\s+(\d+ x \d+)\s+sha256 ([0-9a-f]{64})$/gm)];
    expect(rows).toHaveLength(2);
    for (const m of rows) expect(observation(), `${m[2]} hash`).toContain(m[5]!.slice(0, 12));
    expect(images).toMatch(/2048 x 2048/);
    expect(images).toMatch(/1856 x 2304/);
  });
});

describe('the Sittings O and P observation: the lead\'s offer', () => {
  it('keeps H10k1: one question with four options, and the figures in the options are the figures of the checker of this repository for three images at 2K', async () => {
    const q = JSON.parse(record('h10k1-question.json')) as { call: { questions: Array<{ header: string; options: Array<{ label: string; description: string }> }> }; answer: string };
    expect(q.call.questions).toHaveLength(1);
    const options = q.call.questions[0]!.options;
    expect(options.map(o => o.label)).toEqual(['Her own route (Recommended)', 'Generate with Gemini', 'Generate with Seedream', 'Generate with OpenAI']);
    expect(q.answer).toMatch(/"Her own route \(Recommended\)"/);
    const { checkCall } = (await import(pathToFileURL(path.resolve('registry/skills/image-generation/scripts/call-check.mjs')).href)) as {
      checkCall: (call: object, options: object) => { estimate: { perImageUsd: number | null; totalUsd: number | null; worstCaseUsd: number | null } };
    };
    const draft = { prompt: 'A warm room.', aspectRatio: '4:5', imageSize: '2K', fileName: 'x-a1' };
    const estimate = (provider: string) => checkCall({ ...draft, provider }, { images: 3 }).estimate;
    const gemini = estimate('gemini');
    const seedream = estimate('seedream');
    const openai = estimate('openai');
    expect(options[1]!.description).toContain(`About $${gemini.totalUsd!.toFixed(2)} (3 x $${gemini.perImageUsd}); at most about $${gemini.worstCaseUsd!.toFixed(2)}`);
    expect(options[2]!.description).toContain(`About $${seedream.totalUsd!.toFixed(2)} (3 x $${seedream.perImageUsd}); at most about $${seedream.worstCaseUsd!.toFixed(2)}`);
    expect(openai.perImageUsd).toBeNull();
    expect(options[3]!.description).toContain('OpenAI publishes no price per image (it bills by token), so the first image is a probe');
    expect(options[0]!.description).toMatch(/Nothing to install, nothing to pay, no restart/);
    for (const o of options.slice(1)) expect(o.description, o.label).toMatch(/restart/);
    expect(options[1]!.description).toMatch(/no free tier/);
    expect(options[2]!.description).not.toMatch(/free tier/);
    expect(options[3]!.description).not.toMatch(/free tier/);
  });

  it('reads H10k1: no teammate before the answer, four calls held by the mode-line hook, one question, and no key', () => {
    const e = record('evidence-h10k1.txt');
    expect(e).toMatch(/The question: 1 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/teammates started: 3; before the answer \(\+ 328s\): 0 \(want 0\)/);
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 4/);
    expect(e).toMatch(/figures in the text before the question: none; in the options of the question: \$0\.15, \$0\.0504, \$0\.45, \$0\.27, \$0\.09, \$0\.81/);
    expect(e).toMatch(/a key requested from you: no/);
    expect(e).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    const brief = 'User chose YOUR OWN ROUTE: no image generation; draw what code can (SVG/HTML/CSS) and for each photo leave a marked placeholder frame plus an image brief (subject, framing, light, mood, must-not-contain, rights).';
    expect(record('h10k1-briefs.txt')).toContain(brief);
    expect(observation()).toContain(brief);
    expect(e).toContain('No image is generated and nothing needs installing.');
    expect(observation()).toContain('No image is generated and nothing needs installing.');
  });

  it('reads H10k2: no AskUserQuestion, five calls held, the choice in prose with the prices put off, "option 1" typed, no teammate before it, and the session limit', () => {
    const e = record('evidence-h10k2.txt');
    expect(e).toMatch(/The question: 0 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 5/);
    expect(e).toMatch(/the answer, typed in reply to the prose question at \+ {2}57s: "option 1"/);
    expect(e).toMatch(/teammates started: 5; before the answer \(\+ {2}57s\): 0 \(want 0\)/);
    expect(e).toMatch(/figures in the text before the question: none; in the options of the question: none {2}<- FAIL \(figures missing\)/);
    expect(e).toMatch(/the choice was put in prose as a numbered list: yes/);
    for (const quote of ['Generate with Gemini, Seedream or OpenAI', "I'll give per-provider prices and the most it could cost once I've read the pricing table.", "I'd lean towards Jamileh's own route for a scratch exercise.", 'Image count: probably three, one per placement (4:5, 9:16, 1.91:1).', "You've hit your session limit"]) {
      expect(e, quote).toContain(quote);
      expect(observation(), quote).toContain(quote);
    }
    expect(e).toMatch(/2026-10-09T15:29:14\.929Z to 2026-10-12T05:48:50\.986Z/);
  });
});

describe('the Sittings O and P observation: the grading', () => {
  it('grades each item of the pass lines in tables, by run: 46 met and 12 not met', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(46);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(12);
    expect(counts('H10d3, a file outside the project, its full path typed (session `38264b6a`)')).toEqual([6, 2]);
    expect(counts('H10d4, a path written in a brief (session `34328a6e`)')).toEqual([8, 0]);
    expect(counts('H10d6, a provider whose key is not set (session `9f674eeb`)')).toEqual([8, 1]);
    expect(counts('H10d8, an image from online (session `e0b069da`)')).toEqual([6, 2]);
    expect(counts("H10k1, the lead's offer; her own route chosen (session `7b21e8f5`)")).toEqual([12, 1]);
    expect(counts('H10k2, the lead\'s offer; "option 1" typed (session `ccb31540`)')).toEqual([6, 6]);
  });

  it('quotes what she said, word for word, in the observation and in her answers', () => {
    const o = observation();
    const quotes: Array<[string, string]> = [
      ['h10d3', 'The photo and the prompt went to Gemini.'],
      ['h10d3', 'When I opened `shoot.jpg` it showed only as a tiny, plain beige tile. I could see no subject in it.'],
      ['h10d3', 'It lists the cost as $0.0504, an estimate from the price table rather than a billed amount.'],
      ['h10d4', 'The mood reference was not used.'],
      ['h10d4', "If you want it used, type its full path in a message and say it may go to Google, and I'll make a new image with it as a style reference."],
      ['h10d4', 'you gave none, so I treated the $0.80 session budget as the ceiling'],
      ['h10d6', "The lead's `mcp-setup` prints the command."],
      ['h10d6', "I also didn't ask for or touch a key."],
      ['h10d6', "I didn't switch providers, because a different provider needs your go-ahead."],
      ['h10d6', 'That failed call counts as attempt 1 of this asset.'],
      ['h10d6', 'Set `ARK_API_KEY` on the image server, in the BytePlus ModelArk AP region.'],
      ['h10d8', "I can't send that photo to the tool from a URL."],
      ['h10d8', "I can't download a URL, and a URL or bare file name isn't allowed."],
      ['h10d8', 'Ask the lead, who has a shell, to save it to `assets/source/` in this project, and tell me the licence terms.'],
      ['h10d8', 'I need the licence terms and your confirmation that the photo may go to Gemini.'],
      ['h10d8', 'I can build the feed ad layout with a PHOTO placeholder frame and an image brief for the hero.'],
    ];
    for (const [run, quote] of quotes) {
      expect(answer(run), `${run}: ${quote}`).toContain(quote);
      expect(o, `${run}: ${quote}`).toContain(quote);
    }
  });

  it('says that four of the five misses of Sitting O were lines her loaded text lacked and one was a line that it had, that the record is the weak point a third time, that the Gemini branch of the lead has not been seen, that the sitting ran past the plan, and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/Four of the five misses of Sitting O were lines that her loaded text lacked, and one was a line that it had/);
    expect(o).toMatch(/The record is the weak point, a third time/);
    expect(o).toMatch(/The Gemini branch of the lead has not been seen/);
    expect(o).toMatch(/The sitting cost more than planned and stopped late/);
    expect(o).toMatch(/\*\*Amendment of the pass line, made after seeing this result:\*\*/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether the lines added after this sitting make her write a valid record/);
  });
});

describe('the protocol, ADR 0049 and the plan state the sittings', () => {
  it('records Sittings O and P as run, with their costs, and has a row for Sitting Q (its result is pinned in tests/designer-sitting-q-observation.test.ts)', () => {
    const total = RUNS.map(run => result(run)).reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4);
    const o = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting O |')) ?? '';
    expect(o).toContain(`used ${total} USD`);
    expect(o).not.toMatch(/not yet run/);
    const p = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting P |')) ?? '';
    expect(p).toMatch(/about 5\.58 USD/);
    expect(p).toMatch(/6 messages typed/);
    expect(p).toMatch(/H10k2 did not reach the Gemini branch/);
    expect(p).not.toMatch(/not yet run/);
    const q = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting Q |')) ?? '';
    expect(q).toMatch(/H10d3, H10d6 and H10d8 again on the lines added after Sitting O/);
    expect(q).toMatch(/H10k2 again/);
    expect(q).toMatch(/4\.4 USD and 4 prompts/);
  });

  it('amends the cost of H10d with the results of Sitting O, and the cost of H10k with the results of Sitting P', () => {
    const total = RUNS.map(run => result(run)).reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4);
    const d = PROTOCOL.slice(PROTOCOL.indexOf('### Cost'), PROTOCOL.indexOf('## H10f '));
    expect(d).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting O/);
    expect(d).toContain(NAME);
    expect(d).toContain(`${total} USD in 42 turns`);
    expect(d).toMatch(/Of the 33 items of their pass lines 28 were met and 5 were not/);
    expect(d).toMatch(/2\.3886 USD in 13 prompts/);
    const k = protocolSection('## H10k ');
    const cost = k.slice(k.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting P/);
    expect(cost).toContain(NAME);
    expect(cost).toMatch(/about 5\.58 USD with their teammates \(H10k1 about 1\.87, H10k2 about 3\.71\)/);
    expect(cost).toMatch(/\*\*H10k1 passed on the amended line\*\* \(12 of 13 items/);
    expect(cost).toMatch(/\*\*H10k2 did not reach the Gemini branch\*\*/);
    expect(cost).toMatch(/Sitting Q repeats H10k2/);
  });

  // The wait rule that Sitting P added ("If its reads of the prices are held or fail, it says so and waits for the user's reply") was corrected after Sitting Q: a hold of the mode-line hook is repeated,
  // only a read that fails is waited on (docs/live-test-protocol.md, the amendment of Sitting Q; tests/designer-sitting-q-observation.test.ts).
  it('amends the pass and fail lines of H10k and its scripted answers: the figures in or before the question, a repeat and not a wait when the hook holds the reads, a wait when they fail, no prose, a word and not a number, no delegation map', () => {
    const k = protocolSection('## H10k ');
    const pass = k.slice(k.indexOf('### H10k Pass'), k.indexOf('### H10k Fail'));
    expect(pass).toMatch(/In the question or before it, it states the figures for this plan/);
    expect(pass).toMatch(/If the mode-line hook holds its reads it writes the line and repeats them, and does not stop or wait for a reply because of the hold; if its reads fail for another reason it says so and waits for the user's reply\. It asks nothing until it can read them\./);
    const fail = k.slice(k.indexOf('### H10k Fail'), k.indexOf('### Cost'));
    expect(fail).toMatch(/the choice asked in prose, or before the figures/);
    expect(fail).toMatch(/the lead stops, asks the user to reply or ends its turn because the mode-line hook held a call/);
    // Added after Sitting R (ADR 0051) and changed after Sitting S: the line is written as a text block in the message of the last ToolSearch, so that no hold is shown; if the hook holds the lead anyway
    // it does what the message of the hold says and is released within three rounds of holds (Sitting S: 11 and 13 holds, a lead that stopped and a lead that told the user to disable the hook).
    // Changed on 2026-10-13 (ADR 0053): the line is the lead's second message, the Operation Mode information with no introduction, and the hook waits for the saved transcript; the rest of the sentence is unchanged.
    expect(pass).toMatch(/It writes the mode line as a text block in its second message and before its first other call: the Operation Mode information, with no greeting, no welcome and no introduction of itself or of the team \(ADR 0053\); the hook waits for the saved transcript and holds nothing; if it holds it anyway it does what the message of the hold says and is released within three rounds of holds, and it never stops, never asks the user to reply and never tells the user that the hook is broken or to disable it\./);
    expect(fail).toMatch(/more than three rounds of holds, a lead that tells the user that the hook is broken or to disable or edit it/);
    expect(PROTOCOL).toMatch(/a hold that the lead follows and that releases within three rounds is noted, more than three rounds of holds is a fail/);
    expect(k).toMatch(/Do not accept a delegation map in either/);
    expect(k).toMatch(/If the lead asks the choice in plain text instead of a selection list, that is a finding: answer with the word "Gemini", not a number/);
    expect(k).toMatch(/if it stops and only asks for a short reply because its calls were held, that is a finding: type "go" and wait for its question/);
  });

  it('has Sittings O and P in ADR 0049: what they covered, how many items were met, what was added to the text, and the lead that never asks without the prices', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sittings O and P \(`host-library\/claude\/observations\/2026-10-12-claude-2\.1\.294-designer-sittings-o-and-p\.md`\)/);
    expect(ADR).toMatch(/28 of 33 pass-line items met/);
    expect(ADR).toMatch(/[Tt]he keys of the record in step 5/);
    expect(ADR).toMatch(/If the mode-line hook holds its reads it writes the line and repeats them, and a hold is never a reason to wait; if its reads fail for another reason it says so and waits for the user's reply; it never asks without the figures or in prose/);
    expect(ADR).toMatch(/the Gemini branch of the lead's offer/);
  });

  it('says in the plan what Sitting P found about H10k, in the one paragraph about it', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Run on 2026-10-09 \(Sitting P[^\n]*H10k1 passed on its own route[^\n]*H10k2[^\n]*did not reach the Gemini branch[^\n]*Sitting Q repeats it/);
  });
});
