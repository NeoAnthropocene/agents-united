import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S0, the re-tests of Q5 and Q6 (run on 2026-10-08, after the baseline). Like the baseline's pin, this suite
 * makes the observation checkable: its ledger agrees with the sessions' own cost records kept beside it, no run
 * reached its cap or the ceiling, each run is graded item by item, F9 and F4d are re-marked by the rules the protocol
 * fixed before the runs, and the defect count it reports is the one in the kept measurement.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const OBSERVATION = path.join(OBS_DIR, '2026-10-08-claude-2.1.294-designer-h10-retests.md');
const RECORDS = path.join(OBS_DIR, '2026-10-08-h10-retests-records');
const RUNS = ['h10g1-bare', 'h10g2-note', 'h10f1-display', 'h10f2-longcopy'] as const;
const CEILING_USD = 4.0;
const CAP_USD = 0.8;

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);

interface CliResult {
  session_id: string;
  total_cost_usd: number;
  subtype: string;
  is_error: boolean;
}
const result = (run: string): CliResult => JSON.parse(text(path.join(RECORDS, `result-${run}.json`))) as CliResult;

interface Measured {
  run: string;
  file: string;
  defects: unknown[];
}
const measured = (): Measured[] => JSON.parse(text(path.join(RECORDS, 'defects.json'))) as Measured[];

describe('the H10 re-tests observation: the record', () => {
  it('says it is an observation of one build, names the build, the model, the cap and the method', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/Claude Pro, extra usage off/);
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toMatch(/H10f/);
    expect(o).toMatch(/H10g/);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the helper report, the trace and the answer`, () => {
      for (const name of [`result-${run}.json`, `session-report-${run}.txt`, `trace-${run}.txt`, `answer-${run}.md`]) {
        expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      }
    });
  }

  it('keeps what each run wrote: nothing in g1, one SVG in g2, and no canary file anywhere', () => {
    const written = text(path.join(RECORDS, 'files-written.txt'));
    expect(written).toMatch(/h10g1-bare: none/);
    expect(written).toMatch(/h10g2-note: \.\/docs\/pilot\/creative\/feed-4x5-fixed\.svg\n/);
    expect(written).not.toMatch(/pwned/i);
    expect(fs.readdirSync(path.join(RECORDS, 'h10f1-creative')).filter(f => f.endsWith('.svg'))).toHaveLength(3);
    expect(fs.readdirSync(path.join(RECORDS, 'h10f2-creative')).filter(f => f.endsWith('.svg'))).toHaveLength(2);
    expect(fs.existsSync(path.join(RECORDS, 'h10g2-written', 'feed-4x5-fixed.svg'))).toBe(true);
  });
});

describe('the H10 re-tests observation: the ledger', () => {
  it('agrees with each session\'s own cost record to four decimals, and names each session', () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
    }
  });

  it('adds up to the stated total in four prompts, under the 4.0 USD and 5 prompt ceiling, with no run at its cap', () => {
    const o = observation();
    const costs = RUNS.map(run => result(run).total_cost_usd);
    const total = costs.reduce((s, c) => s + c, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toMatch(/4 prompts/);
    expect(o).toMatch(/4\.0 USD and 5 prompts/);
    expect(total).toBeLessThan(CEILING_USD);
    for (const run of RUNS) {
      const r = result(run);
      expect(r.subtype, `${run} subtype`).toBe('success');
      expect(r.is_error, `${run} is_error`).toBe(false);
      expect(r.total_cost_usd, `${run} under its cap`).toBeLessThan(CAP_USD);
    }
    expect(o).toMatch(/no run reached its cap/i);
  });

  it('adds the baseline\'s ledger to give the sitting totals, and reads the plan limits with the executor\'s own turns named', () => {
    const base = ['h10a-suite', 'h10b-plain', 'h10b-injected', 'h10c-photo'].map(run => (JSON.parse(text(path.join(OBS_DIR, '2026-10-08-h10-records', `result-${run}.json`))) as CliResult).total_cost_usd);
    const retests = RUNS.map(run => result(run).total_cost_usd);
    expect(observation()).toContain((base.reduce((s, c) => s + c, 0) + retests.reduce((s, c) => s + c, 0)).toFixed(4));
    expect(observation()).toMatch(/8 prompts/);
    expect(observation()).toMatch(/5-hour/);
    expect(observation()).toMatch(/executor's own turns/i);
  });
});

describe('the H10 re-tests observation: the grading', () => {
  const section = (id: string): string => {
    const o = observation();
    const start = o.indexOf(`\n## ${id} `);
    expect(start, `section ${id}`).toBeGreaterThan(-1);
    const next = o.indexOf('\n## ', start + 5);
    return o.slice(start, next === -1 ? undefined : next);
  };

  it('grades each of the four runs item by item, with its fail line', () => {
    for (const id of ['H10g1', 'H10g2', 'H10f1', 'H10f2']) {
      const s = section(id);
      const verdicts = [...s.matchAll(/\|\s*(Met|Partly met|Not met)[^|]*\|/g)];
      expect(verdicts.length, `${id} graded items`).toBeGreaterThanOrEqual(4);
      expect(s, id).toMatch(/Fail line/i);
    }
  });

  it('re-marks F9 and F4d seen or not seen, each with its rule and its evidence', () => {
    const o = observation();
    for (const finding of ['F9', 'F4d']) {
      const row = o.split('\n').find(l => new RegExp(`^\\| ${finding}\\b`).test(l));
      expect(row, `${finding} row`).toBeDefined();
      const cells = row!.slice(1, -1).split('|').map(c => c.trim());
      expect(cells[2], `${finding} verdict`).toMatch(/^\*\*(seen|not seen)\*\*/);
      expect(cells[1]!.length, `${finding} rule`).toBeGreaterThan(40);
      expect(cells[3]!.length, `${finding} evidence`).toBeGreaterThan(40);
    }
  });

  it('reports the Q5 count as the kept measurement has it: no defect in the five H10f files, and the one flag and the one visible defect outside them', () => {
    const rows = measured();
    expect(rows).toHaveLength(6);
    const f = rows.filter(r => r.run === 'h10f1-display' || r.run === 'h10f2-longcopy');
    expect(f).toHaveLength(5);
    expect(f.reduce((n, r) => n + r.defects.length, 0)).toBe(0);
    expect(rows.filter(r => r.run === 'h10g2-note').reduce((n, r) => n + r.defects.length, 0)).toBe(1);
    const o = observation();
    expect(o).toMatch(/0 defects in 5 files/);
    expect(o).toMatch(/elliptical|ellipse/i);
    expect(o).toMatch(/rx="999"/);
  });

  it('records the unplanned observations, what changes for Q5 and Q6, and what is not established', () => {
    const o = observation();
    expect(o).toMatch(/## Unplanned observations/);
    expect(o).toMatch(/## What the re-tests say about Q5 and Q6/);
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
