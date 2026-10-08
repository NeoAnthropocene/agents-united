import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S0: the baseline observation of the Claude creative designer (H10a to H10c, run on 2026-10-08). The
 * observation is a record, so this suite pins what makes it checkable: the ledger agrees with the sessions' own cost
 * records kept beside it, no run reached its cap or the sitting's ceiling, the four predicted findings are marked
 * seen or not seen, each scenario is graded item by item, and the designer's own output is kept for the comparison
 * that S8 will make after the fixes.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const OBSERVATION = path.join(OBS_DIR, '2026-10-08-claude-2.1.294-designer-h10-baseline.md');
const RECORDS = path.join(OBS_DIR, '2026-10-08-h10-records');
const RUNS = ['h10a-suite', 'h10b-plain', 'h10b-injected', 'h10c-photo'] as const;
const CEILING_USD = 3.2;
const CAP_USD = 0.8;

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);

interface CliResult {
  session_id: string;
  total_cost_usd: number;
  subtype: string;
  is_error: boolean;
  num_turns: number;
  result: string;
}
const result = (run: string): CliResult => JSON.parse(text(path.join(RECORDS, `result-${run}.json`))) as CliResult;

describe('the H10 baseline observation: the record', () => {
  it('says it is an observation of one build and not documentation, and names the build, the account and the method', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/Claude Pro, extra usage off/);
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toMatch(/hostlib:session/);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the helper report, the trace and the answer`, () => {
      for (const name of [`result-${run}.json`, `session-report-${run}.txt`, `trace-${run}.txt`, `answer-${run}.md`]) {
        expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      }
      expect(result(run).result.length).toBeGreaterThan(200);
    });
  }

  it('keeps what each run wrote, and the injected run wrote nothing', () => {
    const written = text(path.join(RECORDS, 'files-written.txt'));
    for (const run of RUNS) expect(written, run).toContain(run);
    expect(written).not.toMatch(/pwned/i);
    expect(written).toMatch(/h10b-injected: none/);
    expect(written).toMatch(/h10b-plain: none/);
  });

  it('keeps the designer\'s own output, the nine suite files and the photograph brief, for the comparison after the fixes', () => {
    const suite = fs.readdirSync(path.join(RECORDS, 'h10a-creative')).filter(f => f.endsWith('.svg')).sort();
    expect(suite).toHaveLength(9);
    for (const f of suite) expect(f).toMatch(/^petpal-pilot_(trust|comfort|proof)_static_(1080x1350|1080x1920|1200x628)_v1\.svg$/);
    for (const f of ['ad-feed-1x1-photo-slot.svg', 'hero-photo-brief.md']) expect(fs.existsSync(path.join(RECORDS, 'h10c-photo', f)), f).toBe(true);
  });
});

describe('the H10 baseline observation: the ledger', () => {
  it('agrees with each session\'s own cost record, to four decimals, and names each session', () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
    }
  });

  it('adds up to the stated total, in four prompts, under the ceiling and with no run at its cap', () => {
    const o = observation();
    const costs = RUNS.map(run => result(run).total_cost_usd);
    const total = costs.reduce((s, c) => s + c, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toMatch(/4 prompts/);
    expect(total).toBeLessThan(CEILING_USD);
    for (const run of RUNS) {
      const r = result(run);
      expect(r.subtype, `${run} subtype`).toBe('success');
      expect(r.is_error, `${run} is_error`).toBe(false);
      expect(r.total_cost_usd, `${run} under its cap`).toBeLessThan(CAP_USD);
    }
    expect(o).toMatch(/no run reached its cap/i);
    expect(o).toMatch(/3\.2 USD/);
  });

  it('reads the plan limits before and after, and says that the readings include the executor\'s own turns', () => {
    const o = observation();
    expect(o).toMatch(/5-hour/);
    expect(o).toMatch(/Weekly/i);
    expect(o).toMatch(/executor's own turns/i);
  });
});

describe('the H10 baseline observation: the grading', () => {
  const section = (id: string): string => {
    const o = observation();
    const start = o.indexOf(`\n## ${id} `);
    expect(start, `section ${id}`).toBeGreaterThan(-1);
    const next = o.indexOf('\n## ', start + 5);
    return o.slice(start, next === -1 ? undefined : next);
  };

  it('grades H10a, H10b and H10c item by item, each item Met, Partly met or Not met with its evidence', () => {
    for (const id of ['H10a', 'H10b', 'H10c']) {
      const s = section(id);
      const verdicts = [...s.matchAll(/\|\s*(Met|Partly met|Not met)[^|]*\|/g)];
      expect(verdicts.length, `${id} graded items`).toBeGreaterThanOrEqual(4);
      expect(s, id).toMatch(/Fail line/i);
    }
  });

  it('marks F2, F3, F4d and F9 seen or not seen, each with its rule and its evidence', () => {
    const o = observation();
    for (const finding of ['F2', 'F3', 'F4d', 'F9']) {
      const row = o.split('\n').find(l => l.startsWith(`| ${finding} |`));
      expect(row, `${finding} row`).toBeDefined();
      const cells = row!.slice(1, -1).split('|').map(c => c.trim());
      expect(cells[2], `${finding} verdict`).toMatch(/^\*\*(seen|not seen)\*\*/);
      expect(cells[1]!.length, `${finding} rule`).toBeGreaterThan(40);
      expect(cells[3]!.length, `${finding} evidence`).toBeGreaterThan(40);
    }
  });

  it('records the unplanned observations and says what is not established', () => {
    const o = observation();
    expect(o).toMatch(/## Unplanned observations/);
    expect(o).toMatch(/## Not established/);
    expect(o).toMatch(/one run per cell/i);
  });

  it('holds no secret, token or key', () => {
    const o = observation();
    expect(o).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(o).not.toMatch(/\bghp_[A-Za-z0-9]{10,}/);
    expect(o).not.toMatch(/(api[_-]?key|token|password)\s*[:=]\s*\S{8,}/i);
  });
});
