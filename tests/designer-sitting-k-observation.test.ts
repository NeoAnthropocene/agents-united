import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S13, Sitting K (run on 2026-10-08, after Plan 036 S1, S1b, S11 and S12): H10j, the prototype brief, before and after the host-fit fix
 * (F1), and the re-run of H10h and H10i on a real install, with the Design artifact skill and the grant in place. Like the pins of the baseline, the
 * re-tests and P3, this suite makes the observation checkable: its ledger agrees with the sessions' own cost records kept beside it; the copies of what
 * she wrote and published are the copies the observation hashes; the checks it reports (token colours, verbatim copy, the placement rules, the
 * contrast figures, the list form, the counts, the order of the calls) hold on those copies and on the traces; and the protocol states the cost.
 * The pass and fail lines it grades by were fixed before the runs (PR 187).
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const OBSERVATION = path.join(OBS_DIR, '2026-10-08-claude-2.1.294-designer-sitting-k.md');
const RECORDS = path.join(OBS_DIR, '2026-10-08-sitting-k-records');
const FIXTURES = path.resolve('tests/fixtures/designer');
const RUNS = ['h10j-before', 'h10j-after', 'h10h-rerun', 'h10i-rerun'] as const;
const CEILING_USD = 3.2;
const CAP_USD = 0.8;

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));

interface CliResult {
  session_id: string;
  total_cost_usd: number;
  num_turns: number;
  subtype: string;
  is_error: boolean;
  result: string;
}
const result = (run: string, dir: string = RECORDS): CliResult => JSON.parse(text(path.join(dir, `result-${run}.json`))) as CliResult;

const KEPT_COPIES = [
  'published-h10h/canvas.json',
  'published-h10h/Main.dc.html',
  'published-h10h/Story.dc.html',
  'published-h10h/Link.dc.html',
  'published-h10i/tokens.json',
  'published-h10i/README.md',
  'published-h10i/design-system.json',
  'published-h10i/components/Cover/preview.html',
  'prototype-h10j-before.html',
  'prototype-h10j-after.html',
] as const;

/** The tool calls of a trace, in order: `[time, tool, the argument text]`. */
const calls = (run: string): Array<[string, string, string]> => [...record(`trace-${run}.txt`).matchAll(/^(\d\d:\d\d:\d\d\.\d+) A-CALL +(\w+) (.*)$/gm)].map(m => [m[1]!, m[2]!, m[3]!]);
/** The `Artifact` calls of a run, named by what they do: the reader shortens a long argument list, so the step is read from the keys, not parsed. */
const artifactSteps = (run: string): Array<{ step: string; arguments: string }> =>
  calls(run)
    .filter(c => c[1] === 'Artifact')
    .map(c => {
      const action = /"action":"(\w+)"/.exec(c[2]);
      return { step: action ? action[1]! : c[2].includes('"type_url"') ? 'create' : 'update', arguments: c[2] };
    });
const TOKEN_HEX = (): Set<string> => new Set([...text(path.join(FIXTURES, 'design-tokens.json')).matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map(m => m[1]!.toUpperCase()));
const hexIn = (source: string): Set<string> => new Set([...source.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase()));
/** The part of an answer under a bold heading, up to the next bold heading or the end. */
const under = (answer: string, heading: string): string => {
  const start = answer.indexOf(`**${heading}**`);
  expect(start, heading).toBeGreaterThan(-1);
  const next = answer.indexOf('\n**', start + heading.length + 4);
  return answer.slice(start, next === -1 ? undefined : next);
};

describe('the Sitting K observation: the record', () => {
  it('says it is an observation of one build, names the build, the model, the cap and the method, and that the pass lines were fixed before the runs', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/Claude Pro, extra usage off/);
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/claude-sonnet-5-5/);
    for (const id of ['H10j', 'H10h', 'H10i']) expect(o).toContain(id);
    expect(o).toMatch(/pass and fail lines[^.]*fixed before the runs/i);
    for (const commit of ['221a8eb', '6ac3308', 'a0fca93']) expect(o, commit).toContain(commit);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the helper report, the trace and the answer`, () => {
      for (const name of [`result-${run}.json`, `session-report-${run}.txt`, `trace-${run}.txt`, `answer-${run}.md`]) {
        expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      }
      expect(record(`session-report-${run}.txt`)).toMatch(/1 prompt\(s\)/);
      expect(record(`answer-${run}.md`).trim()).toBe(result(run).result.trim());
    });
  }

  it('keeps the three prompts exactly as the protocol types them', () => {
    const fences = (heading: string): string => {
      const start = PROTOCOL.indexOf(`### ${heading}\n`);
      expect(start, heading).toBeGreaterThan(-1);
      return /```text\n([\s\S]*?)\n```/.exec(PROTOCOL.slice(start))![1]!;
    };
    expect(record('prompt-h10j.txt').trim()).toBe(fences('H10j Prompt'));
    expect(record('prompt-h10h-rerun.txt').trim()).toBe(fences('H10h Prompt'));
    expect(record('prompt-h10i-rerun.txt').trim()).toBe(fences('H10i Prompt'));
  });

  it('keeps what each run wrote in its scratch directory: the prototypes of H10j, and nothing for the two re-runs (she published from the session scratchpad)', () => {
    const written = record('files-written.txt');
    expect(written).toMatch(/^h10j-before: added docs\/pilot\/prototype\/index\.html/m);
    expect(written).toMatch(/^h10j-after: added docs\/pilot\/prototype\/index\.html/m);
    expect(written).toMatch(/^h10h-rerun: none$/m);
    expect(written).toMatch(/^h10i-rerun: none$/m);
  });

  it('keeps the copies of what she wrote and published, the scripts and what they printed', () => {
    for (const rel of KEPT_COPIES) expect(fs.existsSync(path.join(RECORDS, rel)), rel).toBe(true);
    for (const name of ['check-h10j.mjs', 'check-h10j.txt', 'check-rerun.mjs', 'check-rerun.txt', 'measure-boards.mjs', 'boards-measurement.txt', 'contrast-check.mjs', 'contrast-check.txt', 'compare-tokens.mjs', 'tokens-comparison.txt', 'cover-render.txt']) {
      expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
    }
  });

  it("keeps no full link to the two private artifacts: only the type publisher's two public type links stay whole", () => {
    const allowed = new Set(['QKN21svewxgyPb6SYRqWnd', '5M7UeXXcx16TP3vzVFNDzd']); // the Design and Design System types, published by the host
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    let links = 0;
    for (const file of [...walk(RECORDS), OBSERVATION]) {
      for (const m of text(file).matchAll(/claude\.ai\/artifact\/([A-Za-z0-9]+)(\[elided\])?/g)) {
        links += 1;
        expect(allowed.has(m[1]!) || m[2] !== undefined, `${path.relative(OBS_DIR, file)}: ${m[1]}`).toBe(true);
      }
    }
    expect(links).toBeGreaterThan(0);
  });

  it('hashes the copies it keeps: the first twelve characters of each sha256 are in the observation', () => {
    const o = observation();
    for (const rel of KEPT_COPIES) {
      const sha = createHash('sha256').update(text(path.join(RECORDS, rel)), 'utf8').digest('hex'); // line endings normalised: a Windows checkout may hold CRLF
      expect(o, rel).toContain(sha.slice(0, 12));
    }
  });
});

describe('the Sitting K observation: the ledger', () => {
  it("agrees with each session's own cost record to four decimals, and names each session", () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
    }
  });

  it('adds up to the stated total in four prompts and 60 turns, under the 3.2 USD and 4 prompt ceiling, with no run at its cap', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toMatch(/4 prompts/);
    expect(o).toContain(`${rs.reduce((s, r) => s + r.num_turns, 0)} turns`);
    expect(o).toMatch(/3\.2 USD and 4 prompts/);
    expect(total).toBeLessThan(CEILING_USD);
    for (const r of rs) {
      expect(r.subtype).toBe('success');
      expect(r.is_error).toBe(false);
      expect(r.total_cost_usd).toBeLessThan(CAP_USD);
    }
    expect(o).toMatch(/no run reached its cap/i);
  });

  it("adds the day's earlier ledger to give the sitting total, and reads the plan limits with the executor's own turns named", () => {
    const earlier = [
      ...['h10a-suite', 'h10b-plain', 'h10b-injected', 'h10c-photo'].map(run => result(run, path.join(OBS_DIR, '2026-10-08-h10-records'))),
      ...['h10g1-bare', 'h10g2-note', 'h10f1-display', 'h10f2-longcopy'].map(run => result(run, path.join(OBS_DIR, '2026-10-08-h10-retests-records'))),
      ...['p3a-canvas', 'p3b-designsystem'].map(run => result(run, path.join(OBS_DIR, '2026-10-08-p3-records'))),
    ];
    const day = [...earlier, ...RUNS.map(run => result(run))].reduce((s, r) => s + r.total_cost_usd, 0);
    expect(observation()).toContain(day.toFixed(4));
    expect(observation()).toMatch(/14 prompts/);
    expect(observation()).toMatch(/5-hour/);
    expect(observation()).toMatch(/1 percent[^.]*17 percent|17 percent[^.]*1 percent/);
    expect(observation()).toMatch(/executor's own turns/i);
  });
});

describe('the Sitting K observation: H10j, the prototype brief', () => {
  const answer = (run: string): string => record(`answer-${run}.md`);

  it('saw F1 in the run built from before S1 and S1b, and not in the run built with them', () => {
    const before = calls('h10j-before').filter(c => c[1] === 'Skill').map(c => c[2]);
    const after = calls('h10j-after').filter(c => c[1] === 'Skill').map(c => c[2]);
    expect(before).toEqual(['{"skill":"generative-ui"}']);
    expect(after).toEqual(['{"skill":"frontend-design"}']);
    expect(record('trace-h10j-after.txt')).not.toContain('generative-ui');
    const o = observation();
    expect(o).toMatch(/F1[^.]*seen/i);
    expect(o).toMatch(/generative-ui/);
    expect(o).toMatch(/frontend-design/);
  });

  it("finds the skill installed in the first directory and absent from the others, as the manifests before the runs say", () => {
    const o = observation();
    expect(o).toMatch(/\.claude\/skills\/generative-ui/);
    expect(o).toMatch(/design-artifact-publishing/);
  });

  it('wrote no tool name of another host and no colour outside the tokens, in either prototype or either answer', () => {
    const tokens = TOKEN_HEX();
    for (const run of ['before', 'after']) {
      const html = record(`prototype-h10j-${run}.html`);
      for (const token of ['<agent-embed', 'ArtifactMetadata', 'write_to_file']) {
        expect(html, `${run} ${token}`).not.toContain(token);
        expect(answer(`h10j-${run}`), `${run} answer ${token}`).not.toContain(token);
      }
      const used = hexIn(html);
      expect(used.size, run).toBeGreaterThan(0);
      for (const hex of used) expect(tokens.has(hex), `${run} ${hex}`).toBe(true);
      // The one colour function is the dialog's backdrop: the cocoa 900 token with an alpha.
      expect([...html.matchAll(/rgba?\(([^)]*)\)/g)].map(m => m[1]!.replace(/\s+/g, '').replace(/,\.6$/, ',0.6'))).toEqual(['43,29,20,0.6']);
    }
  });

  it('has three sitters, a Book now button on each and a native dialog that opens, in plain HTML, CSS and script, in both prototypes', () => {
    for (const run of ['before', 'after']) {
      const html = record(`prototype-h10j-${run}.html`);
      expect(html, run).toContain('<dialog');
      expect(html, run).toMatch(/showModal\(\)/);
      expect(html, run).not.toMatch(/<script[^>]+src=/);
      expect(html, run).toMatch(/Book now/);
    }
    // The first builds its list from an array of three objects; the second writes three cards in the markup.
    expect([...record('prototype-h10j-before.html').matchAll(/^\s*\{ id: "/gm)]).toHaveLength(3);
    expect([...record('prototype-h10j-after.html').matchAll(/class="card"/g)]).toHaveLength(3);
  });

  it('says in both answers that the prototype was not opened in a browser, and asks for the render under Open items in the first run only', () => {
    for (const run of ['h10j-before', 'h10j-after']) expect(answer(run), run).toMatch(/haven't opened it in a browser/);
    expect(under(answer('h10j-before'), 'Open items')).toMatch(/open the file and click through/i);
    expect(under(answer('h10j-after'), 'Open items')).not.toMatch(/open the file|click through|render|browser/i);
    expect(observation()).toMatch(/render ask[^.]*Open items/i);
  });

  it('grades each item of the pass lines in a table, with the one miss of the second H10j run marked not met and the render ask named', () => {
    const o = observation();
    expect(o).toMatch(/\| Not met \| [^|\n]*Open items/);
    expect((o.match(/\| Met \|/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});

describe('the Sitting K observation: H10h, the Design canvas re-run', () => {
  const canvas = (): { boards: Record<string, { w: number; h: number }>; designSystems: unknown[]; order: string[]; notes: Record<string, { text: string }> } =>
    JSON.parse(record('published-h10h/canvas.json')) as ReturnType<typeof canvas>;
  const BOARDS = ['Main.dc.html', 'Story.dc.html', 'Link.dc.html'] as const;

  it('lists the three boards at the three sizes, in order, with no other design system attached', () => {
    const c = canvas();
    expect(c.order).toEqual([...BOARDS]);
    expect(Object.entries(c.boards).map(([k, b]) => [k, b.w, b.h])).toEqual([
      ['Main.dc.html', 1080, 1350],
      ['Story.dc.html', 1080, 1920],
      ['Link.dc.html', 1200, 628],
    ]);
    expect(c.designSystems).toEqual([]);
  });

  it('uses the six token colours and no others on every board, and sets the copy of hero.ts word for word', () => {
    const tokens = TOKEN_HEX();
    expect(tokens.size).toBe(6);
    const hero = text(path.join(FIXTURES, 'hero.ts'));
    for (const name of BOARDS) {
      const board = record(`published-h10h/${name}`);
      const used = hexIn(board);
      expect(used.size, name).toBeGreaterThan(0);
      for (const hex of used) expect(tokens.has(hex), `${name} ${hex}`).toBe(true);
      for (const line of ['Sitters you can trust', 'Background-checked, reviewed by neighbours, insured up to $1M.', '4.9 average rating, 12,000 stays', 'Book now']) {
        expect(hero, line).toContain(line);
        expect(board, `${name} ${line}`).toContain(line);
      }
    }
  });

  it('keeps the claims for review on the canvas and in the answer, and names Defne', () => {
    expect(canvas().notes.claims!.text).toMatch(/claims review/);
    for (const figure of ['4.9 average rating', '12,000 stays', 'insured up to $1M', 'background-checked']) expect(canvas().notes.claims!.text, figure).toContain(figure);
    expect(record('answer-h10h-rerun.md')).toMatch(/Claims for Defne/);
  });

  it('keeps a measurement in which all three placement rules hold, with the feed label at y 1121 to 1162 against a zone that starts at 1215', () => {
    const m = record('boards-measurement.txt');
    expect(m).toMatch(/y 1121 - 1162 .*Book now/);
    expect(m).toMatch(/rule, feed: text clear of the bottom 10 percent \(y >= 1215\): kept/);
    expect(m).toMatch(/rule, story: no text in the top 250 px or the bottom 250 px: kept/);
    expect(m).toMatch(/rule, link ad: nothing outside the canvas: kept/);
    expect(observation()).toMatch(/1121/);
    expect(observation()).toMatch(/1215/);
  });

  it('computes the contrast of every pair she gave, in this run and the next, and finds all eleven figures right', () => {
    const c = record('contrast-check.txt');
    expect(c).toMatch(/11 figures, 0 wrong/);
    expect([...c.matchAll(/right to one decimal/g)].length).toBe(11);
    expect(observation()).toMatch(/11 of 11|all eleven/i);
  });

  it('loaded the publishing skill first, then the two design skills before the first write, published once, and read back all four files', () => {
    const list = calls('h10h-rerun');
    const skills = list.filter(c => c[1] === 'Skill').map(c => JSON.parse(c[2]).skill as string);
    expect(skills).toEqual(['design-artifact-publishing', 'ad-creative-design', 'design-system-tokens']);
    const firstWrite = list.findIndex(c => c[1] === 'Write');
    expect(list.findIndex(c => c[1] === 'Skill' && c[2].includes('ad-creative-design'))).toBeLessThan(firstWrite);
    const artifact = artifactSteps('h10h-rerun');
    expect(artifact.map(a => a.step)).toEqual(['quickstart', 'create', 'update', 'list', 'read']);
    expect([...artifact[4]!.arguments.matchAll(/project\//g)]).toHaveLength(4);
    expect(list.filter(c => c[1] === 'Write')).toHaveLength(4);
  });
});

describe('the Sitting K observation: H10i, the Design System re-run', () => {
  const tokens = (): { colors: Array<{ usage?: string }>; spacing: Array<{ usage?: string }>; radius: Array<{ usage?: string }> } =>
    JSON.parse(record('published-h10i/tokens.json')) as ReturnType<typeof tokens>;

  it('holds tokens.json to the converter: the validator finds no problem, no nested $value, 0 differences, and the type block differs only by usage fields', () => {
    const t = record('tokens-comparison.txt');
    expect(t).toMatch(/validator on her file: no problems/);
    expect(t).toMatch(/a nested \$value anywhere in her file: false/);
    expect(t).toMatch(/token differences, order aside: 0/);
    expect([...t.matchAll(/differences in name, value or usage: 0/g)].length).toBe(3);
    expect(t).toMatch(/type the same: false/);
    expect(t).toContain('"usage":"for 1080 px wide canvases"');
    expect(observation()).toMatch(/for 1080 px wide canvases/);
  });

  it('has 18 colour, spacing and radius tokens of which 16 have an empty usage note, and her answer says 15, so a count in her report is wrong', () => {
    const t = tokens();
    const all = [...(t.colors ?? []), ...(t.spacing ?? []), ...(t.radius ?? [])];
    expect(all).toHaveLength(18);
    expect(all.filter(x => !x.usage).length).toBe(16);
    expect(record('answer-h10i-rerun.md')).toMatch(/15 of 18 colour, spacing and radius tokens have an empty usage note/);
    const o = observation();
    expect(o).toMatch(/15 of 18/);
    expect(o).toMatch(/16 of 18/);
  });

  it('renders the cover with the name and tagline in a 440 px zone and every block right of x = 480', () => {
    const r = record('cover-render.txt');
    const name = /"name":\{"x0":(\d+),"x1":(\d+)/.exec(r)!;
    expect([Number(name[1]), Number(name[2])]).toEqual([32, 472]);
    const rects = [...r.matchAll(/"x0":(\d+),"x1":(\d+),"y0":\d+,"y1":\d+,"rx"/g)].map(m => Number(m[1]));
    expect(rects.length).toBeGreaterThan(3);
    for (const x of rects) expect(x).toBeGreaterThanOrEqual(480);
    expect(record('published-h10i/components/Cover/preview.html')).toMatch(/rx="24"/);
  });

  it('loaded the publishing skill and the tokens skill, opened the token reference before writing, read back the first publish, corrected two sentences and republished without reading it back', () => {
    const list = calls('h10i-rerun');
    expect(list.filter(c => c[1] === 'Skill').map(c => JSON.parse(c[2]).skill as string)).toEqual(['design-artifact-publishing', 'design-system-tokens']);
    const firstWrite = list.findIndex(c => c[1] === 'Write');
    const reference = list.findIndex(c => c[1] === 'Read' && c[2].includes('claude-design-format.md'));
    expect(reference).toBeGreaterThan(-1);
    expect(reference).toBeLessThan(firstWrite);
    expect(artifactSteps('h10i-rerun').map(a => a.step)).toEqual(['quickstart', 'create', 'read', 'read', 'update', 'list', 'read', 'update']);
    expect(list.filter(c => c[1] === 'Edit')).toHaveLength(2);
    expect(record('answer-h10i-rerun.md')).toMatch(/did not read the corrected README or cover back/);
    expect(observation()).toMatch(/not read back after the republish|did not read the corrected/i);
  });

  it('says in the README only what the source says, marks the two cover inferences, and still claims a list of open items that the README does not hold', () => {
    const readme = record('published-h10i/README.md');
    expect(readme).toMatch(/tagline[^.]*placeholder/);
    expect(readme).toMatch(/inferred from the radius tokens/);
    expect(readme).toMatch(/they are listed as open items for the owner/);
    expect(readme).not.toMatch(/^#+ .*open items/im);
    expect(observation()).toMatch(/listed as open items/);
  });
});

describe('the protocol states the cost of the sitting', () => {
  it('records the Sitting K row as run, with its cost, and amends the H10j cost with the measured figures', () => {
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4);
    const row = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting K |')) ?? '';
    expect(row).toContain(`used ${total} USD`);
    expect(row).not.toMatch(/proposed/i);
    const h10j = PROTOCOL.slice(PROTOCOL.indexOf('## H10j '), PROTOCOL.indexOf('## H2 and H7'));
    expect(h10j).toMatch(/Amended 2026-10-08 \(Plan 036 S13/);
    expect(h10j).toContain(total);
    expect(h10j).toContain('2026-10-08-claude-2.1.294-designer-sitting-k.md');
  });
});
