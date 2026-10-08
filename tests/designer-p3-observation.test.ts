import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 probe P3 (run on 2026-10-08, after the baseline and the re-tests): the designer, holding the `Artifact` tool
 * in a scratch copy of her role, publishes a private Design canvas (H10h) and a private Design System (H10i) to the
 * maintainer's claude.ai account. Like the earlier pins, this suite makes the observation checkable: its ledger agrees
 * with the sessions' own cost records kept beside it; the copies of what she published are the copies the observation
 * hashes; the checks it reports (token colours, verbatim copy, the list form, the placement rule, the cover) hold on
 * those copies; and the protocol types the two prompts exactly as they were run.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const OBSERVATION = path.join(OBS_DIR, '2026-10-08-claude-2.1.294-designer-p3-artifact-probe.md');
const RECORDS = path.join(OBS_DIR, '2026-10-08-p3-records');
const FIXTURES = path.resolve('tests/fixtures/designer');
const RUNS = ['p3a-canvas', 'p3b-designsystem'] as const;
const CEILING_USD = 1.6;
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
}
const result = (run: string, dir: string = RECORDS): CliResult => JSON.parse(text(path.join(dir, `result-${run}.json`))) as CliResult;

const KEPT_COPIES = [
  'published-p3a/canvas.json',
  'published-p3a/Main.dc.html',
  'published-p3a/Story.dc.html',
  'published-p3a/LinkAd.dc.html',
  'published-p3b/tokens.json',
  'published-p3b/README.md',
  'published-p3b/design-system.json',
  'published-p3b/components/Cover/preview.html',
] as const;

describe('the P3 observation: the record', () => {
  it('says it is an observation of one build, names the build, the model, the cap and the method, and when the pass lines were written', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/Claude Pro, extra usage off/);
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toMatch(/H10h/);
    expect(o).toMatch(/H10i/);
    expect(o).toMatch(/pass and fail lines[^.]*written after the runs/i);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the prompt, the CLI result, the helper report, the trace and the answer`, () => {
      for (const name of [`prompt-${run}.txt`, `result-${run}.json`, `session-report-${run}.txt`, `trace-${run}.txt`, `answer-${run}.md`]) {
        expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      }
      expect(record(`session-report-${run}.txt`)).toMatch(/1 prompt\(s\)/);
    });
  }

  it('keeps what each run wrote in its scratch directory (nothing: she published from the session scratchpad)', () => {
    const written = record('files-written.txt');
    expect(written).toMatch(/p3a-canvas: none/);
    expect(written).toMatch(/p3b-designsystem: none/);
  });

  it('keeps the copies of what she published, the measuring scripts and what they printed', () => {
    for (const rel of KEPT_COPIES) expect(fs.existsSync(path.join(RECORDS, rel)), rel).toBe(true);
    for (const name of ['measure-boards.mjs', 'boards-measurement.txt', 'contrast-check.mjs', 'contrast-check.txt', 'compare-tokens.mjs', 'tokens-comparison.txt', 'render-cover.mjs', 'cover-render.txt']) {
      expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
    }
  });

  it("keeps no full link to the two private artifacts: only the type publisher's two public type links stay whole", () => {
    const allowed = new Set(['QKN21svewxgyPb6SYRqWnd', '5M7UeXXcx16TP3vzVFNDzd']); // the Design and Design System types, published by the host
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    let links = 0;
    for (const file of walk(RECORDS)) {
      for (const m of text(file).matchAll(/claude\.ai\/artifact\/([A-Za-z0-9]+)(\[elided\])?/g)) {
        links += 1;
        expect(allowed.has(m[1]!) || m[2] !== undefined, `${path.relative(RECORDS, file)}: ${m[1]}`).toBe(true);
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

describe('the P3 observation: the ledger', () => {
  it("agrees with each session's own cost record to four decimals, and names each session", () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
    }
  });

  it('adds up to the stated total in two prompts and 26 turns, under the 1.6 USD and 2 prompt ceiling, with no run at its cap', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toMatch(/2 prompts/);
    expect(o).toContain(`${rs.reduce((s, r) => s + r.num_turns, 0)} turns`);
    expect(o).toMatch(/1\.6 USD and 2 prompts/);
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
    ];
    const day = [...earlier, ...RUNS.map(run => result(run))].reduce((s, r) => s + r.total_cost_usd, 0);
    expect(observation()).toContain(day.toFixed(4));
    expect(observation()).toMatch(/10 prompts/);
    expect(observation()).toMatch(/5-hour/);
    expect(observation()).toMatch(/executor's own turns/i);
  });

  it('says that the executor session refused its own first launch of P3a, so exactly one P3a session exists', () => {
    expect(observation()).toMatch(/first launch[^.]*refused[^.]*classifier/i);
    expect(observation()).toMatch(/never ran|did not run/i);
  });
});

describe('the P3 observation: what she published (H10h, the Design canvas)', () => {
  const canvas = (): { boards: Record<string, { w: number; h: number; x: number; y: number }>; designSystems: unknown[]; order: string[] } =>
    JSON.parse(record('published-p3a/canvas.json')) as ReturnType<typeof canvas>;
  const board = (name: string): string => record(`published-p3a/${name}`);
  const TOKEN_HEX = (): Set<string> => new Set([...text(path.join(FIXTURES, 'design-tokens.json')).matchAll(/"(#[0-9A-Fa-f]{6})"/g)].map(m => m[1]!.toUpperCase()));

  it('lists the three boards at the three sizes, in order, with no other design system attached', () => {
    const c = canvas();
    expect(c.order).toEqual(['Main.dc.html', 'Story.dc.html', 'LinkAd.dc.html']);
    expect(Object.entries(c.boards).map(([k, b]) => [k, b.w, b.h])).toEqual([
      ['Main.dc.html', 1080, 1350],
      ['Story.dc.html', 1080, 1920],
      ['LinkAd.dc.html', 1200, 628],
    ]);
    expect(c.designSystems).toEqual([]);
  });

  it('uses the token colours and no others', () => {
    const tokens = TOKEN_HEX();
    expect(tokens.size).toBe(6);
    for (const name of ['Main.dc.html', 'Story.dc.html', 'LinkAd.dc.html']) {
      const used = new Set([...board(name).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase()));
      expect(used.size, name).toBeGreaterThan(0);
      for (const hex of used) expect(tokens.has(hex), `${name} ${hex}`).toBe(true);
    }
  });

  it("sets the copy of hero.ts verbatim on every board", () => {
    const hero = text(path.join(FIXTURES, 'hero.ts'));
    for (const line of ['Sitters you can trust', 'Background-checked, reviewed by neighbours, insured up to $1M.', 'Book now']) {
      expect(hero, line).toContain(line);
      for (const name of ['Main.dc.html', 'Story.dc.html', 'LinkAd.dc.html']) expect(board(name), `${name} ${line}`).toContain(line);
    }
    for (const figure of ['4.9 average rating', '12,000 stays']) {
      expect(hero, figure).toContain(figure);
      for (const name of ['Main.dc.html', 'Story.dc.html', 'LinkAd.dc.html']) expect(board(name), `${name} ${figure}`).toContain(figure);
    }
    expect(board('Main.dc.html')).toContain('insured up to $1M</p>');
  });

  it('keeps a measurement in which the feed ad breaks the bottom-10-percent rule and the story and the link ad keep theirs, and the observation says so', () => {
    const m = record('boards-measurement.txt');
    expect(m).toMatch(/rule, feed: text clear of the bottom 10 percent \(y >= 1215\): 1 text box\(es\) break it: "Book now" y 1217-1258/);
    expect(m).toMatch(/rule, story: no text in the top 250 px or the bottom 250 px: kept/);
    expect(m).toMatch(/rule, link ad: nothing outside the canvas: kept/);
    const o = observation();
    expect(o).toMatch(/1217/);
    expect(o).toMatch(/bottom 10 percent/);
  });

  it('computes the contrast of every pair she used and finds all seven figures of her README right', () => {
    const c = record('contrast-check.txt');
    expect(c).toMatch(/15\.47 : 1/);
    expect(c).toMatch(/5\.48 : 1/);
    expect(c).toMatch(/figures she gave that are wrong to one decimal: 0/);
    expect(observation()).toMatch(/7 of 7/);
  });
});

describe('the P3 observation: what she published (H10i, the Design System)', () => {
  interface Token {
    name: string;
    value: string;
    usage: string;
  }
  interface Tokens {
    color: { themes: { id: string }[]; tokens: Token[] };
    spacing: { tokens: Token[] };
    radius: { tokens: Token[] };
    type: { families: Record<string, string>; groups: { styles: { name: string; fontSize: string }[] }[] };
  }
  const raw = (): string => record('published-p3b/tokens.json');
  const tokens = (): Tokens => JSON.parse(raw()) as Tokens;

  it('is the list form: no nested $value, twelve colours, four spacing steps, two radii, one family and three styles', () => {
    expect(raw()).not.toContain('$value');
    const t = tokens();
    expect(t.color.tokens).toHaveLength(12);
    expect(t.spacing.tokens).toHaveLength(4);
    expect(t.radius.tokens).toHaveLength(2);
    expect(Object.keys(t.type.families)).toEqual(['base']);
    expect(t.type.groups[0]!.styles.map(s => s.name)).toEqual(['headline', 'body', 'caption']);
  });

  it('names its tokens as the format allows, uniquely, and points every alias at a colour that exists', () => {
    const t = tokens();
    const all = [...t.color.tokens, ...t.spacing.tokens, ...t.radius.tokens];
    for (const tok of all) expect(tok.name, tok.name).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
    expect(new Set(all.map(tok => tok.name)).size).toBe(all.length);
    const colours = new Set(t.color.tokens.map(tok => tok.name));
    const aliases = t.color.tokens.filter(tok => /^\{.+\}$/.test(tok.value));
    expect(aliases).toHaveLength(6);
    for (const a of aliases) expect(colours.has(a.value.slice(1, -1)), a.name).toBe(true);
  });

  it('has an empty usage in 10 of its 12 colours, the count that her own report gets wrong ("Eleven of the twelve"), and the observation says so', () => {
    const t = tokens();
    expect(t.color.tokens.filter(tok => tok.usage === '')).toHaveLength(10);
    expect(t.color.tokens.filter(tok => tok.usage !== '').map(tok => tok.name)).toEqual(['text-muted', 'cta-primary']);
    expect(record('answer-p3b-designsystem.md')).toMatch(/Eleven of the twelve colour tokens/);
    expect(observation()).toMatch(/10 of 12/);
    expect(observation()).toMatch(/Eleven of the twelve/);
  });

  it('is held to the format by the converter of PR 181: the kept comparison finds no problem and no differing token, and the order of two colours is the only difference', () => {
    const c = record('tokens-comparison.txt');
    expect(c).toMatch(/validator on her file: no problems/);
    expect(c).toMatch(/a nested \$value anywhere in her file: false/);
    for (const family of ['color', 'spacing', 'radius']) expect(c).toMatch(new RegExp(`${family}: her file \\d+ tokens, the converter \\d+, differences in name, value or usage: 0`));
    expect(c).toMatch(/themes the same: true/);
    expect(c).toMatch(/type the same: true/);
    expect(c).toMatch(/colour order the same: false/);
    expect(c).toMatch(/token differences, order aside: 0/);
  });

  it('keeps a cover that sits inside the type\'s own rules: the name in a text zone of 440 px, every block right of x = 480, pills with rx equal to half their height', () => {
    const json = record('cover-render.txt').split('\n').find(l => l.startsWith('{'))!;
    const m = JSON.parse(json) as { name: { x0: number; x1: number }; rects: { cls: string; x0: number; y0: number; y1: number; rx: string }[] };
    expect(m.name.x1 - m.name.x0).toBeLessThanOrEqual(440);
    for (const r of m.rects) expect(r.x0, r.cls).toBeGreaterThanOrEqual(480);
    for (const r of m.rects.filter(r => !r.cls.includes('tile'))) expect(Number.parseFloat(r.rx) * 2, r.cls).toBe(r.y1 - r.y0);
  });
});

describe('the P3 observation: the grading', () => {
  const section = (id: string): string => {
    const o = observation();
    const start = o.indexOf(`\n## ${id} `);
    expect(start, `section ${id}`).toBeGreaterThan(-1);
    const next = o.indexOf('\n## ', start + 5);
    return o.slice(start, next === -1 ? undefined : next);
  };
  const verdicts = (s: string): string[] => [...s.matchAll(/\|\s*(Met|Partly met|Not met)[^|]*\|/g)].map(m => m[1]!);

  it('grades each of the two runs item by item, with its fail line', () => {
    for (const id of ['H10h', 'H10i']) {
      const s = section(id);
      expect(verdicts(s).length, `${id} graded items`).toBeGreaterThanOrEqual(6);
      expect(s, id).toMatch(/Fail line/i);
    }
  });

  it('grades the feed ad and the unloaded skill as not met, and the README and her report as partly met', () => {
    expect(verdicts(section('H10h'))).toContain('Not met');
    expect(section('H10h')).toMatch(/ad-creative-design/);
    expect(verdicts(section('H10i'))).toContain('Partly met');
  });

  it('says what P3 means for the grant and for the script question, decides neither, and records the unplanned observations and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/## What P3 says about O3 and the script question/);
    expect(o).toMatch(/D24/);
    expect(o).toMatch(/none is decided here/i);
    expect(o).toMatch(/## Unplanned observations/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/one run per cell/i);
    expect(o).toMatch(/default design system/i);
  });

  it('refers to the two artifacts by title and a short id, never by a full link', () => {
    const o = observation();
    expect(o).toContain('PetPal Paid Social Set');
    expect(o).not.toMatch(/claude\.ai\/artifact\/[A-Za-z0-9]{12,}/);
  });

  it('holds no secret, token or key', () => {
    const o = observation();
    expect(o).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(o).not.toMatch(/\bghp_[A-Za-z0-9]{10,}/);
    expect(o).not.toMatch(/(api[_-]?key|token|password)\s*[:=]\s*\S{8,}/i);
  });
});

describe('H10h and H10i in the live-test protocol: the publish probes of Plan 036', () => {
  const section = (): string => {
    const start = PROTOCOL.indexOf('\n## H10h ');
    expect(start, 'section H10h exists').toBeGreaterThan(-1);
    const next = PROTOCOL.indexOf('\n## ', start + 5);
    return PROTOCOL.slice(start, next === -1 ? undefined : next);
  };
  const sub = (heading: string): string => {
    const s = section();
    const marker = `\n### ${heading}\n`;
    const start = s.indexOf(marker);
    expect(start, `### ${heading}`).toBeGreaterThan(-1);
    const next = s.indexOf('\n### ', start + marker.length);
    return s.slice(start + marker.length, next === -1 ? undefined : next).trim();
  };
  const fence = (block: string): string => /```text\n([\s\S]*?)\n```/.exec(block)![1]!;

  it('says when it was added, which probe it is, and that the pass lines were fixed after the first sitting for the re-run', () => {
    expect(section()).toMatch(/added 2026-10-08/);
    expect(section()).toMatch(/P3/);
    expect(section()).toMatch(/written after Sitting J/i);
  });

  it('has a setup, the evidence, a prompt, a pass and a fail for each run, and a cost with a ceiling', () => {
    for (const heading of ['Setup', 'Evidence', 'Cost']) expect(section(), heading).toContain(`\n### ${heading}\n`);
    for (const run of ['H10h', 'H10i']) for (const part of ['Prompt', 'Pass', 'Fail']) expect(sub(`${run} ${part}`).length, `${run} ${part}`).toBeGreaterThan(0);
    expect(sub('Cost')).toMatch(/Ceiling: 1\.6 USD and 2 prompts/);
    expect(sub('Cost')).toMatch(/--max-budget-usd 0\.8/);
    expect(sub('Cost')).toMatch(/0\.9138 USD/);
  });

  it('types the two prompts exactly as they were run', () => {
    expect(fence(sub('H10h Prompt'))).toBe(record('prompt-p3a-canvas.txt').trim());
    expect(fence(sub('H10i Prompt'))).toBe(record('prompt-p3b-designsystem.txt').trim());
    expect(record('prompt-p3a-canvas.txt')).toMatch(/Claude Design canvas/);
    expect(record('prompt-p3b-designsystem.txt')).toMatch(/design-system-tokens/);
  });

  it('stages each run in its own directory with the Artifact tool appended to her tools line, asks for the maintainer\'s yes, and keeps what is published private and fictional', () => {
    const setup = sub('Setup');
    expect(setup).toContain('p3a-canvas');
    expect(setup).toContain('p3b-designsystem');
    expect(setup).toMatch(/, Artifact/);
    expect(setup).toMatch(/CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0/);
    expect(setup).toMatch(/explicit yes/i);
    expect(setup).toMatch(/private/i);
    expect(setup).toMatch(/fictional/i);
    expect(setup).toMatch(/delete nothing|deletes nothing/i);
    expect(section()).toMatch(/same headless command/i);
    expect(section()).not.toContain('--dangerously-skip-permissions');
  });

  it('reads the artifacts back with the Artifact tool rather than from her answer, and fixes the checks before the re-run', () => {
    const e = sub('Evidence');
    expect(e).toMatch(/read back/i);
    expect(e).toMatch(/measure-boards\.mjs/);
    expect(e).toMatch(/compare-tokens\.mjs/);
    expect(sub('H10h Pass')).toMatch(/ad-creative-design/);
    expect(sub('H10h Pass')).toMatch(/bottom 10 percent/);
    expect(sub('H10h Fail')).toMatch(/shared/i);
    expect(sub('H10i Pass')).toMatch(/list form/);
    expect(sub('H10i Fail')).toMatch(/\$value/);
  });

  it("is listed among the sittings with the maintainer's ceiling, and the old total stays as it was", () => {
    expect(PROTOCOL).toMatch(/\| Sitting J \|[^\n]*\| 1\.6 USD and 2 prompts/);
    expect(PROTOCOL).toMatch(/Total of all ceilings: 55\.0 USD, and 65\.0 USD with Sitting F\./);
    expect(PROTOCOL).toMatch(/\| H10h and H10i \|/);
  });

  it('holds no secret, token or key', () => {
    expect(section()).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(section()).not.toMatch(/(api[_-]?key|token|password)\s*[:=]\s*\S{8,}/i);
  });
});
