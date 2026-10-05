import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S10: parked Plan 033 (the `agent-factory` bundle) records what Plan 035 learned, and stays parked.
 * The findings are the skill quality gate (ADR 0040), the session-report helper, the live-test kit, and what the
 * audit showed about skill attribution and provenance. This suite pins that they are recorded, that each says
 * what it changes in the plan, and that the plan is still only proposed (nothing is built, nothing is promoted).
 */

const plan = fs.readFileSync(path.resolve('plans/033-agent-factory-bundle.md'), 'utf8').replace(/\r\n/g, '\n');
const index = fs.readFileSync(path.resolve('plans/README.md'), 'utf8');

function section(title: string): string {
  const start = plan.indexOf(`\n## ${title}`);
  expect(start, `section "${title}" exists`).toBeGreaterThan(-1);
  const next = plan.indexOf('\n## ', start + 5);
  return plan.slice(start, next === -1 ? undefined : next);
}

describe('Plan 033 after Plan 035', () => {
  it('stays parked: still PROPOSED, nothing built, and the index row says so', () => {
    expect(plan).toMatch(/\*\*State\*\*: PROPOSED/);
    expect(plan).toMatch(/Nothing is built/);
    expect(index).toMatch(/\| \[033\][^\n]*\*\*PROPOSED/);
  });

  it('records the findings of Plan 035 in their own section', () => {
    const s = section('Findings from Plan 035');
    expect(s).toMatch(/2026-10-04/);
    expect(s).toMatch(/stays parked/i);
  });

  it('records the skill quality gate: ADR 0040, the ratchet, the rewrite contract, and the size of the debt', () => {
    const s = section('Findings from Plan 035');
    expect(s).toMatch(/ADR 0040/);
    expect(s).toMatch(/ratchet/i);
    expect(s).toMatch(/version 3\.0\.0|3\.0\.0/);
    expect(s).toMatch(/62 of 188/);
    expect(s).toMatch(/39/);
  });

  it('records what the audit showed about attribution and provenance, and what the skill-attribution rule should add', () => {
    const s = section('Findings from Plan 035');
    expect(s).toMatch(/provenance/i);
    expect(s).toMatch(/metadata\.source/);
    expect(s).toMatch(/overstat/i);
    expect(s).toMatch(/inspiration/i);
    expect(s).toMatch(/hostlib:candidates/);
    expect(s).toMatch(/skill-attribution/);
  });

  it('records the session-report helper and the live-test kit as reusable for the host-parametric subagents', () => {
    const s = section('Findings from Plan 035');
    expect(s).toMatch(/hostlib:session/);
    expect(s).toMatch(/live-test-protocol/);
    expect(s).toMatch(/Cline/);
    expect(s).toMatch(/Antigravity/);
  });

  it('says what each finding changes in the slices, and lists the questions it adds', () => {
    const s = section('Findings from Plan 035');
    expect(s).toMatch(/slice 2/i);
    expect(s).toMatch(/slice 3/i);
    expect(s).toMatch(/slice 4/i);
    expect(s).toMatch(/New open questions/i);
  });

  it('points at the Plan 035 pull requests that hold the evidence', () => {
    const s = section('Findings from Plan 035');
    for (const pr of ['#128', '#129', '#135', '#136']) expect(s).toContain(pr);
  });
});
