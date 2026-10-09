import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting N (run on 2026-10-09 by the maintainer): H10d3 for the third time and the four runs that close the Gemini part, H10d4 to H10d7.
 * Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the sessions' own cost records kept beside it,
 * the prompts are the prompts of the protocol, her calls and the verdicts of her own checker are what the observation says, the counts of met and not met
 * items are the counts in the tables, no key or personal string is in the records, and the protocol states the sitting. The pass and fail lines it grades by
 * were fixed before the runs (PR 194).
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-09-claude-2.1.294-designer-h10d-closing-runs.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-09-sitting-n-records');
const RUNS = ['h10d3', 'h10d4', 'h10d6', 'h10d7', 'h10d5'] as const;
const INPUT_PATH = 'C:\\github\\scratch-pilot\\h10d-local-test\\Downloads\\shoot.jpg';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));

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
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const section = (heading: string): string => {
  const o = observation();
  const start = o.indexOf(`\n## ${heading}`);
  expect(start, heading).toBeGreaterThan(-1);
  const next = o.indexOf('\n## ', start + 4);
  return o.slice(start, next === -1 ? undefined : next);
};

describe('the Sitting N observation: the record', () => {
  it('says it is an observation of one build, names the build, the model, the commit it was built from, the cap and that the pass lines were fixed before the runs', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('879d4f7');
    expect(o).toContain('eabe3e8');
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/pass and fail lines of the five runs were fixed before they ran/);
    for (const id of ['H10d3', 'H10d4', 'H10d5', 'H10d6', 'H10d7']) expect(o).toContain(id);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the answer (the same text), the evidence and the prompt`, () => {
      for (const name of [`result-${run}.json`, `answer-${run}.md`, `evidence-${run}.txt`, `prompt-${run}.txt`]) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      expect(record(`answer-${run}.md`).trim()).toBe(result(run).result.trim());
    });
  }

  it('keeps the five prompts exactly as the protocol types them (the path of H10d3 filled in)', () => {
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const fences = [...PROTOCOL.slice(start, PROTOCOL.indexOf('### H10d Pass', start)).matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
    const byId: Record<string, string> = { h10d3: fences[2]!.replace('<the absolute path of ..\\Downloads\\shoot.jpg>', INPUT_PATH), h10d4: fences[3]!, h10d5: fences[4]!, h10d6: fences[5]!, h10d7: fences[6]! };
    for (const run of RUNS) expect(record(`prompt-${run}.txt`).trim(), run).toBe(byId[run]);
  });

  it('shows from her own session record what the third H10d3 run had loaded: the strict rule and the second correction, and no old exception', () => {
    const loaded = record('loaded-text-h10d3.txt');
    expect(loaded).toContain(result('h10d3').session_id);
    for (const phrase of ['SKILL.md, rule 5: the strict rule', 'her role text: the strict rule', 'SKILL.md, edge case: she cannot copy it', "the user's word and the placeholder", 'her role text: the placeholder']) {
      expect(loaded, phrase).toMatch(new RegExp(`^yes {2}.*${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
    }
    expect(loaded).toMatch(/^no {3}the old exception of SKILL\.md/m);
  });

  it('keeps the scripts that ran and read the runs', () => {
    for (const name of ['evidence.mjs', 'run.sh', 'run.ps1', 'run-batch.ps1', 'prepare-batch.ps1', 'new-run.ps1']) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    for (const file of [...walk(RECORDS), OBSERVATION]) {
      const t = text(file);
      const rel = path.relative(OBS_DIR, file);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy/);
    }
  });
});

describe('the Sitting N observation: the ledger', () => {
  it("agrees with each session's own cost record to four decimals, and names each session", () => {
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

  it('adds up to the stated total in 5 prompts and 43 turns, and with Sitting L and Sitting M to 9 prompts, 76 turns and 1.5697 USD, under the ceiling of 4.0 USD', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    const turns = rs.reduce((s, r) => s + r.num_turns, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toContain(`${turns} turns`);
    expect(o).toMatch(/5 prompts/);
    expect(turns).toBe(43);
    expect(total).toBeLessThan(4.0);
    const before = ['h10d1', 'h10d2', 'h10d3'].map(id => JSON.parse(text(path.join(OBS_DIR, '2026-10-09-h10d-records', `result-${id}.json`))) as CliResult);
    const again = JSON.parse(text(path.join(OBS_DIR, '2026-10-09-h10d3-rerun-records', 'result-h10d3.json'))) as CliResult;
    const all = [...before, again, ...rs];
    expect(all).toHaveLength(9);
    expect(o).toContain(all.reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4));
    expect(o).toContain(`${all.reduce((s, r) => s + r.num_turns, 0)} turns`);
    expect(o).toMatch(/No run reached its cap/);
    expect(o).toMatch(/about 0\.10 USD[^.]*estimate/);
  });
});

describe('the Sitting N observation: her calls, her records and her own checker', () => {
  const call = (run: string): Record<string, unknown> => JSON.parse(record(`call-${run}.json`)) as Record<string, unknown>;

  it('keeps H10d4: one text-only call, with no input file, and the path of the brief nowhere in it', () => {
    const c = call('h10d4');
    expect([c.provider, c.aspectRatio, c.imageSize]).toEqual(['gemini', '4:5', '2K']);
    expect(c.inputImagePaths).toBeUndefined();
    expect(JSON.stringify(c)).not.toContain('shoot.jpg');
    const e = record('evidence-h10d4.txt');
    expect(e).toMatch(/calls that carry the path from the brief: 0/);
    expect(e).toMatch(/her answer quotes the path \(Open items\): no/);
    expect(e).toMatch(/image-check \(exit 1\)/);
    expect(e).toMatch(/estimatedCostUsd must be a number/);
    expect(JSON.parse(record('provenance-h10d4.json')).estimatedCostUsd).toBeNull();
  });

  it('keeps H10d6: one call to seedream, the server\'s answer, no file written, and no other provider', () => {
    const c = call('h10d6');
    expect(c.provider).toBe('seedream');
    const e = record('evidence-h10d6.txt');
    expect(e).toMatch(/calls with provider seedream: 1 \(at most 1\)/);
    expect(e).toMatch(/calls with another provider, or none named: 0/);
    expect(e).toMatch(/the server said "not configured": yes/);
    expect(e).toMatch(/her answer names ARK_API_KEY: yes; names mcp-setup: no/);
    expect(e).toMatch(/files she wrote or edited: none/);
    expect(e).toMatch(/CONFIG_ERROR/);
  });

  it('keeps H10d7: no call at all, and nothing written', () => {
    const e = record('evidence-h10d7.txt');
    expect(e).toMatch(/calls to the image tool at all: 0 \(want none\)/);
    expect(e).toMatch(/calls that carry assets\/source\/dana\.jpg: 0/);
    expect(e).toMatch(/added 0, changed 0, removed 0/);
  });

  it('keeps H10d5: the earlier output as the one input file, a new name, a record with attempt 2 and the earlier file, and the originals unchanged', () => {
    const c = call('h10d5') as { inputImagePaths: string[]; fileName: string };
    expect(c.inputImagePaths).toHaveLength(1);
    expect(c.inputImagePaths[0]).toMatch(/h10d5-edit\\assets\\generated\\feed-hero-sitter-dog-sofa-4x5-v1\.jpg$/);
    expect(c.fileName).toBe('feed-hero-sitter-dog-sofa-4x5-v2');
    const p = JSON.parse(record('provenance-h10d5.json')) as { attempt: number; estimatedCostUsd: number; inputImages: Array<{ path: string; source: string }> };
    expect(p.attempt).toBe(2);
    expect(p.estimatedCostUsd).toBe(0.0504);
    expect(p.inputImages.map(i => i.path)).toEqual(['assets/generated/feed-hero-sitter-dog-sofa-4x5-v1.jpg']);
    const e = record('evidence-h10d5.txt');
    expect(e).toMatch(/calls with the earlier output as the input file: 1 \(want 1\)/);
    expect(e).toMatch(/calls that reuse the earlier file name: 0/);
    expect(e).toMatch(/the earlier picture and its record are unchanged: yes/);
    expect(e).toMatch(/image-check \(exit 0\)/);
    expect(e).toMatch(/added 2, changed 0, removed 0/);
  });

  it('keeps what her own checker says of the three calls: all accepted (exit 0), with the estimates of the table', () => {
    for (const run of ['h10d4', 'h10d5']) {
      const out = record(`call-check-${run}.txt`);
      expect(out, run).toMatch(/^estimate: gemini gemini-nano-banana-2\.1, 1 image: \$0\.0504 each/m);
      expect(out, run).not.toMatch(/^error /m);
      expect(out, run).toMatch(/exit 0\s*$/);
    }
    expect(record('call-check-h10d6.txt')).toMatch(/^estimate: seedream dola-seedream-5-0-pro-260628, 1 image: \$0\.09 each/m);
  });

  it('names the two pictures by their size, dimensions and hash, and the observation holds the first twelve characters of each hash', () => {
    const images = record('images.txt');
    const rows = [...images.matchAll(/^(\S+)\s+(\S+)\s+(\d+) bytes\s+(\d+ x \d+)\s+sha256 ([0-9a-f]{64})$/gm)];
    expect(rows).toHaveLength(2);
    for (const m of rows) expect(observation(), `${m[2]} hash`).toContain(m[5]!.slice(0, 12));
    expect(images).toMatch(/1856 x 2304/);
  });
});

describe('the Sitting N observation: the grading', () => {
  it('grades each item of the pass lines in tables: 27 met and 7 not met, by run', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(27);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(7);
    const met = (heading: string): [number, number] => {
      const s = section(heading);
      return [(s.match(/\| Met \|/g) ?? []).length, (s.match(/\| Not met \|/g) ?? []).length];
    };
    expect(met('H10d3, the third time (session `51fb6684`)')).toEqual([4, 1]);
    expect(met('H10d4, a path written in a brief (session `7cc2c701`)')).toEqual([6, 2]);
    expect(met('H10d6, a provider whose key is not set (session `d5581446`)')).toEqual([6, 3]);
    expect(met('H10d7, a real person\'s likeness (session `ae6ccbb1`)')).toEqual([4, 0]);
    expect(met('H10d5, an edit of an earlier output (session `04977160`)')).toEqual([7, 1]);
  });

  it('quotes what she said, word for word, in the observation and in her answers', () => {
    const o = observation();
    const quotes: Array<[string, string]> = [
      ['h10d3', "I can't copy the file in myself either, because I have no shell"],
      ['h10d3', 'Confirm that this photo, and any details in it, may be sent to Google (Gemini).'],
      ['h10d4', "I did not use the art director's mood reference (`shoot.jpg`), so the hero has not been matched to that mood."],
      ['h10d4', 'If you want the mood matched, put a copy in `assets/source/` and tell me it may go to Gemini.'],
      ['h10d6', "Don't paste the key into this chat."],
      ['h10d6', "I didn't switch to Gemini or OpenAI: your go named Seedream, and another provider needs its own go."],
      ['h10d7', "A generated image can't be presented as a photograph of a real person."],
      ['h10d7', 'I never send a face to the provider as an input image.'],
      ['h10d5', 'the thin dark lines on the left, right and bottom are gone'],
    ];
    for (const [run, quote] of quotes) {
      expect(record(`answer-${run}.md`), `${run}: ${quote}`).toContain(quote);
      expect(o, `${run}: ${quote}`).toContain(quote);
    }
  });

  it('says that every item not met is one that the text she loads did not ask for, that the guard held against content, and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/Every item that was not met is one that the text she loads did not ask for/);
    expect(o).toMatch(/The guard held against content/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/The new rule \(a typed path may go; a URL is not a path\): no run has seen it/);
  });
});

describe('the protocol and ADR 0049 state the sitting', () => {
  it('records the Sitting N row as run, with its cost, and amends the cost section with the results', () => {
    const total = RUNS.map(run => result(run)).reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4);
    const row = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting N |')) ?? '';
    expect(row).toContain(`used ${total} USD`);
    expect(row).not.toMatch(/not yet run/);
    const cost = PROTOCOL.slice(PROTOCOL.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-09 \(Plan 036 S19, Sitting N/);
    expect(cost).toContain(NAME);
    expect(cost).toContain(total);
  });

  it('has the closing runs in ADR 0049: the sitting, what it covered, and how many items of the pass lines were met', () => {
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/Sitting N \(the closing runs H10d4 to H10d7 and H10d3 again/);
    expect(ADR).toMatch(/27 of 34 pass-line items met/);
  });
});
