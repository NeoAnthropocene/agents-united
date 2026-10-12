import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting R (run on 2026-10-12 by the maintainer, Claude Code 2.1.296): H10d3 headless again, and H10k2 interactive again, on the text of the corrections after Sitting Q (the clone at
 * `c1a21ab`). The lead reached the Gemini branch of its offer for the first time. Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the sessions'
 * own cost records kept beside it, the prompts are the prompts of the protocol, her call and the verdicts of her own checker are what the observation says, the record she wrote has every key of the
 * template and an `inputImages` entry that carries what the reference asks, the lead's session is read from its own record (the holds, the line written twice before the first call and once more at the
 * end, the questions and their figures against the checker of this repository), the counts of the tables are the counts in them, and the protocol, ADR 0049 and the plan state the sitting.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-12-claude-2.1.296-designer-sitting-r.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-12-sitting-r-records');
const INPUT_PATH = 'C:\\github\\scratch-pilot\\h10d-local-test\\Downloads\\shoot.jpg';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));
const PLAN = text(path.resolve('plans/036-claude-creative-designer-improvement.md'));

interface CliResult { session_id: string; total_cost_usd: number; num_turns: number; subtype: string; is_error: boolean; result: string; permission_denials: unknown[] }
const result = (): CliResult => JSON.parse(record('result-h10d3.json')) as CliResult;
const answer = (): string => record('answer-h10d3.md');
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

describe('the Sitting R observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the clone the folders were built from, the cap, and that no pass line was changed after the result', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('c1a21ab');
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/No pass or fail line was changed after seeing these results/);
    for (const id of ['H10d3', 'H10k2']) expect(o).toContain(id);
  });

  it('keeps the records of H10d3: the CLI result, the answer (the same text), the evidence and the prompt, and the prompts are those of the protocol', () => {
    for (const name of ['result-h10d3.json', 'answer-h10d3.md', 'evidence-h10d3.txt', 'prompt-h10d3.txt', 'prompt-h10k.txt']) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
    expect(answer().trim()).toBe(result().result.trim());
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const fences = [...PROTOCOL.slice(start, PROTOCOL.indexOf('### H10d Pass', start)).matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
    expect(record('prompt-h10d3.txt').trim()).toBe(fences[2]!.replace('<the absolute path of ..\\Downloads\\shoot.jpg>', INPUT_PATH));
    const k = protocolSection('## H10k ');
    expect(record('prompt-h10k.txt').trim()).toBe([...k.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!)[0]);
  });

  it("shows what the lead and the designer had loaded: the hook's message and the lead's rule told it to write the line again with every repeat, and her role text said what an entry of inputImages carries", () => {
    const t = record('loaded-text.txt');
    expect(t).toContain('built from the clone at c1a21ab');
    expect(t).toContain('a hold is never a reason to wait');
    expect(t).toContain('Do this even if you believe you wrote it already');
    expect(t).toContain('Repeat the call in your next message with the line written again, and if it is held again, repeat it again');
    expect(t).not.toContain('Write the line once');
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

describe('the Sitting R observation: the ledger', () => {
  it("agrees with the headless session's own cost record to four decimals, names the session, and adds up: 0.5939 USD in 2 prompts, and 3.1624 USD in 17 headless prompts and 158 turns in all", () => {
    const o = observation();
    const r = result();
    expect(o).toContain(r.session_id);
    expect(o).toContain(r.total_cost_usd.toFixed(4));
    expect(r.subtype).toBe('success');
    expect(r.is_error).toBe(false);
    expect(r.permission_denials).toHaveLength(0);
    expect(r.total_cost_usd).toBeLessThan(0.8);
    const e = record('evidence-h10k2.txt');
    expect(e).toContain("the session's own cost record (Claude Code 2.1.296): 0.3491 USD (claude-haiku-5-5 0.0001, claude-sonnet-5-5 0.3489)");
    expect(o).toContain('0.3491 USD');
    expect((r.total_cost_usd + 0.3490816).toFixed(4)).toBe('0.5939');
    expect(o).toContain('0.5939 USD in 2 prompts');
    const earlier = (dir: string, ids: string[]): CliResult[] => ids.map(id => JSON.parse(text(path.join(OBS_DIR, dir, `result-${id}.json`))) as CliResult);
    const all = [
      ...earlier('2026-10-09-h10d-records', ['h10d1', 'h10d2', 'h10d3']),
      ...earlier('2026-10-09-h10d3-rerun-records', ['h10d3']),
      ...earlier('2026-10-09-sitting-n-records', ['h10d3', 'h10d4', 'h10d5', 'h10d6', 'h10d7']),
      ...earlier('2026-10-12-sittings-o-p-records', ['h10d3', 'h10d4', 'h10d6', 'h10d8']),
      ...earlier('2026-10-12-sitting-q-records', ['h10d3', 'h10d6', 'h10d8']),
      r,
    ];
    expect(all).toHaveLength(17);
    expect(all.reduce((s, x) => s + x.total_cost_usd, 0).toFixed(4)).toBe('3.1624');
    expect(all.reduce((s, x) => s + x.num_turns, 0)).toBe(158);
    expect(o).toContain('3.1624 USD in 17 prompts and 158 turns');
    expect(o).toMatch(/No run reached its cap/);
    expect(o).toMatch(/about 0\.05 USD[^.]*estimate/);
    expect(record('usage-and-cost.txt')).toContain('Total  0.5939 USD in 2 prompts');
  });

  it('names the picture by its size, dimensions and hash, and the observation holds the first twelve characters of the hash', () => {
    const m = /^(\S+)\s+(\S+)\s+(\d+) bytes\s+(\d+ x \d+)\s+sha256 ([0-9a-f]{64})$/m.exec(record('images.txt'))!;
    expect(m).not.toBeNull();
    expect(m[4]).toBe('1856 x 2304');
    expect(observation()).toContain(m[5]!.slice(0, 12));
  });
});

describe('the Sitting R observation: her call, her record and her own checker', () => {
  it('keeps H10d3: one call with exactly the typed path, which her checker accepts with --allow and refuses without, and a record with every key of the template and an inputImages entry that carries the path, the row and who cleared the rights', () => {
    const c = JSON.parse(record('call-h10d3.json')) as { inputImagePaths: string[]; provider: string; imageSize: string; aspectRatio: string; fileName: string };
    expect(c.inputImagePaths).toEqual([INPUT_PATH]);
    expect([c.provider, c.imageSize, c.aspectRatio, c.fileName]).toEqual(['gemini', '2K', '4:5', 'feed-hero-shoot-variation-01']);
    const e = record('evidence-h10d3.txt');
    expect(e).toMatch(/calls to the image tool: 1/);
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
    const entry = (p.inputImages as Array<Record<string, string>>)[0]!;
    expect(entry.path).toBe(INPUT_PATH);
    expect(entry.tableRow).toMatch(/full path the user typed/);
    expect(entry.rightsClearedBy).toMatch(/the user, who stated they own it/);
  });
});

describe("the Sitting R observation: the lead's session, read from its own record", () => {
  it('reads H10k2 from the reader: two calls held in two messages, none with the line first, the second held anyway, then the calls ran; two questions, no teammate before the answer, no key', () => {
    const e = record('evidence-h10k2.txt');
    expect(e).toMatch(/calls held by the mode-line hook in the whole session: 2/);
    expect(e).toMatch(/2 call\(s\) held, in 2 message\(s\) of the lead/);
    expect(e).toMatch(/1\. \+ {2}11s {2}held: Bash; the line in THIS message: NO/);
    expect(e).toMatch(/2\. \+ {2}14s {2}held: Bash; the line in THIS message: yes \(held anyway: the host had not saved it yet\)/);
    expect(e).toMatch(/after the last hold the lead made 7 more call\(s\) \(7 not held\) and wrote 2 text block\(s\)/);
    expect(e).toMatch(/the first call other than ToolSearch that ran: \+ {2}16s {2}Bash/);
    expect(e).toMatch(/The question: 2 call\(s\) of AskUserQuestion/);
    expect(e).toMatch(/teammates started: 0; before the answer \(\+ {2}50s\): 0 \(want 0\)/);
    expect(e).toMatch(/What you typed \(1 message\(s\) of yours/);
    expect(e).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    expect(e).toMatch(/a key requested from you: no/);
  });

  it('keeps the conversation without account details: the line as a text block twice before the first call that ran, no introduction, the restart command with a placeholder, and the mode stated a third time at the end', () => {
    const t = record('h10k2-gate-timeline.txt');
    expect(t.match(/ result \(ERROR\):/g) ?? []).toHaveLength(2);
    expect(t.match(/ lead \w+ text: Mode: Limited Operational\. Callable: Context7, Firecrawl\. Missing: GitHub, Playwright, Chrome DevTools, Figma\. Extras: Stitch\./g) ?? []).toHaveLength(2);
    for (const quote of ["I'm repeating the read of the pilot brief and the install record.", 'The hold is expected, so I\'m repeating the read.', '**Limited Operational:** GitHub, Playwright, Chrome DevTools and Figma are missing.', 'GEMINI_API_KEY=<your-ai-studio-key>']) {
      expect(t, quote).toContain(quote);
    }
    expect(t).not.toMatch(/I'm Chris/);
    expect(t).toMatch(/Your choice is recorded: Gemini fast, 3 images at 2K, about \$0\.15, ceiling \$0\.45\./);
  });

  it("keeps the two questions of the lead with their answers, and the figures in the first are those of this repository's checker for three images at 2K, with no price for one image and no \"no free tier\" in the OpenAI option", async () => {
    const q = JSON.parse(record('h10k2-questions.json')) as { calls: Array<{ call: { questions: Array<{ header: string; options: Array<{ label: string; description: string }> }> }; answer: string }> };
    expect(q.calls).toHaveLength(2);
    const first = q.calls[0]!.call.questions[0]!;
    expect(first.options.map(o => o.label)).toEqual(['Her own route', 'Generate with Gemini', 'Generate with Seedream', 'Generate with OpenAI']);
    expect(q.calls[0]!.answer).toContain('="Generate with Gemini"');
    const { checkCall } = (await import(pathToFileURL(path.resolve('registry/skills/image-generation/scripts/call-check.mjs')).href)) as {
      checkCall: (call: object, options: object) => { estimate: { perImageUsd: number | null; totalUsd: number | null; worstCaseUsd: number | null } };
    };
    const draft = { prompt: 'A warm room.', aspectRatio: '4:5', imageSize: '2K', fileName: 'x-a1' };
    const estimate = (provider: string) => checkCall({ ...draft, provider }, { images: 3 }).estimate;
    const gemini = estimate('gemini');
    const seedream = estimate('seedream');
    expect(first.options[1]!.description).toContain(`3 images at 2K, about $${gemini.totalUsd!.toFixed(2)}, at most $${gemini.worstCaseUsd!.toFixed(2)}`);
    expect(first.options[2]!.description).toContain(`3 images at 2K, about $${seedream.totalUsd!.toFixed(2)}, at most $${seedream.worstCaseUsd!.toFixed(2)}`);
    expect(estimate('openai').perImageUsd).toBeNull();
    expect(first.options[3]!.description).toContain('publishes no price per image, so the first image is a probe');
    for (const o of first.options.slice(1, 3)) expect(o.description, o.label).toMatch(/no free tier/);
    expect(first.options[3]!.description).not.toMatch(/free tier/);
    expect(first.options[1]!.description).not.toContain(String(gemini.perImageUsd));
    expect(first.options[2]!.description).not.toContain(`$${seedream.perImageUsd}`);
    const second = q.calls[1]!.call.questions[0]!;
    expect(second.header).toBe('Ceiling');
    expect(second.options.map(o => o.label)).toEqual(['Up to $0.45 (Recommended)', 'Up to $0.15', 'Do not generate']);
    expect(q.calls[1]!.answer).toContain('="Up to $0.45 (Recommended)"');
  });
});

describe('the Sitting R observation: the grading', () => {
  it('grades each item of the pass lines in tables, by run: 19 met, 2 not met, none not reached', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(19);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(2);
    expect((o.match(/\| Not reached \|/g) ?? []).length).toBe(0);
    expect(counts('H10d3, a file outside the project, its full path typed (session `e6418c0c`)')).toEqual([8, 0, 0]);
    expect(counts("H10k2, the lead's offer; the Gemini branch (session `1269c24c`)")).toEqual([11, 2, 0]);
  });

  it('quotes what she and the lead said, word for word, in the observation and in the records', () => {
    const o = observation();
    const a = answer();
    for (const quote of ['It and the prompt went to the provider, on your go and your statement that you own it.', '**Estimated cost:** about $0.0504, from the price table. I didn\'t read an actual charge from a meter.']) {
      expect(a, quote).toContain(quote);
      expect(o, quote).toContain(quote);
    }
    const t = record('h10k2-gate-timeline.txt');
    for (const quote of ["Gemini needs your own API key, so the next step is yours. Run this in your own terminal. Don't paste the key here. I never need to see it.", '**Restart:** a running session never loads a server added after it started.', '`claude --continue --agent orchestrator-digital-agency`']) {
      expect(t, quote).toContain(quote);
      expect(o, quote).toContain(quote);
    }
  });

  it('says that the Gemini branch was reached for the first time, that the corrections of Sitting Q held, that the line was written twice before the first call and a third time at the end because the loaded text said to write it again with every repeat, and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/The Gemini branch of the lead's offer was reached for the first time/);
    expect(o).toMatch(/The corrections of Sitting Q held/);
    expect(o).toMatch(/The line was written twice before the first call that ran, and a third time at the end/);
    expect(o).toMatch(/Both the message of the hook and the sentence added after Sitting Q told the lead to write the line again with every repeat/);
    expect(o).toMatch(/It never introduced itself/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/Whether the lead follows the order of ADR 0050/);
  });
});

describe('the protocol, ADR 0049 and the plan state Sitting R', () => {
  it('records Sitting R as run, with its cost and what it reached, and Sitting S as proposed', () => {
    const r = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting R |')) ?? '';
    expect(r).toMatch(/H10k2 again, the Gemini branch of the lead's offer/);
    expect(r).toMatch(/run 2026-10-12/);
    expect(r).toMatch(/used 0\.5939 USD of model cost in 2 prompts/);
    expect(r).toMatch(/H10k2 reached the Gemini branch/);
    expect(r).not.toMatch(/not yet run/);
    const s = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting S |')) ?? '';
    expect(s).toMatch(/H10k2 again/);
    expect(s).toMatch(/G1 of Plan 035 N3 again/);
    expect(s).toMatch(/3\.0 USD and 2 prompts/);
    expect(s).toMatch(/proposed 2026-10-12, not yet run/);
    expect(s).not.toMatch(/\bused \d/);
  });

  it('amends the cost of H10d with the result of Sitting R, and the cost of H10k with its result', () => {
    const d = PROTOCOL.slice(PROTOCOL.indexOf('### Cost'), PROTOCOL.indexOf('## H10f '));
    expect(d).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting R/);
    expect(d).toContain(NAME);
    expect(d).toContain('0.2449 USD in 14 turns');
    expect(d).toMatch(/Of the 8 items of its pass line 8 were met/);
    expect(d).toContain('3.1624 USD in 17 prompts');
    const k = protocolSection('## H10k ');
    const cost = k.slice(k.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-12 \(Plan 036 S19, Sitting R/);
    expect(cost).toContain(NAME);
    expect(cost).toMatch(/0\.3491 USD by the session's own cost record/);
    expect(cost).toMatch(/\*\*H10k2 reached the Gemini branch\*\*/);
    expect(cost).toMatch(/two calls held in two messages/);
    expect(cost).toMatch(/Sitting S repeats H10k2/);
    expect(cost).toMatch(/Ceiling for Sitting S/);
  });

  it('has Sitting R in ADR 0049: what it covered, the items met, the first sight of the Gemini branch, and what is still not established', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sitting R \(`host-library\/claude\/observations\/2026-10-12-claude-2\.1\.296-designer-sitting-r\.md`\)/);
    expect(ADR).toMatch(/19 of 21 pass-line items met/);
    expect(ADR).toMatch(/the Gemini branch of the lead's offer, reached for the first time/);
    expect(ADR).toMatch(/whether the lead writes its line once and is not held \(Sitting S\)/);
  });

  it('says in the plan what Sitting R found about H10k, in the one paragraph about it', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\*[^\n]*Sitting R \(run on 2026-10-12[^\n]*H10k2 reached the Gemini branch[^\n]*Sitting S repeats it/);
  });
});
