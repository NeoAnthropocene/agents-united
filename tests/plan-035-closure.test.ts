import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 N3 (the close-out): the plan says it is closed; its checklist covers every live scenario H1 to H9 and
 * lists the defects and gaps that are still open; an ADR records the outcome and the decision on the
 * `experimental` label; the plans index agrees; and the ADR agrees with the registry about the label. The history
 * (the decisions D1 to D64 and the log) is not rewritten here.
 */

const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');

const plan = read('plans/035-claude-digital-agency-hardening.md');
const index = read('plans/README.md');
const adrFile = fs.readdirSync(path.resolve('docs/adr')).find((f) => /^0043-.*\.md$/.test(f));

function section(text: string, heading: string): string {
  const start = text.indexOf(`\n${heading}`);
  expect(start, `"${heading}" exists`).toBeGreaterThan(-1);
  const level = heading.match(/^#+/)![0];
  const rest = text.slice(start + heading.length + 1);
  const next = rest.search(new RegExp(`\\n#{1,${level.length}} `));
  return next === -1 ? rest : rest.slice(0, next);
}

describe('Plan 035 is closed', () => {
  it('says so in its Status and marks session N3 done in Prompt C', () => {
    expect(section(plan, '## Status')).toMatch(/\*\*State\*\*: \*\*CLOSED 2026-10-07/);
    expect(plan).toMatch(/\*\*Session N3: the close-out[^\n]*\*Done 2026-10-07/);
  });

  it('is indexed as done and points at the outcome ADR', () => {
    expect(index).toMatch(/\| \[035\][^\n]*\*\*DONE\W+closed 2026-10-07\*\*/);
    expect(index).toMatch(/\| \[035\][^\n]*ADR 0043/);
  });
});

describe('the close-out checklist of Plan 035', () => {
  const checklist = (): string => section(plan, '## Close-out checklist');

  it('has one row for each live scenario, H1 to H9, with a verdict and its evidence', () => {
    const s = checklist();
    for (const h of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9']) {
      expect(s, `a row for ${h}`).toMatch(new RegExp(`^\\| ${h}\\b`, 'm'));
    }
    expect(s).toMatch(/\| Scenario \| Verdict \| Evidence/);
  });

  it('lists the defects and gaps that are still open, including what was deliberately not started', () => {
    const open = section(checklist(), '### Defects and gaps still open');
    expect((open.match(/^- /gm) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(open).toMatch(/duplicate/i);
    expect(open).toMatch(/seven (other )?roles/i);
    expect(open).toMatch(/refusal prompts/i);
    expect(open).toMatch(/third eval/i);
    expect(open).toMatch(/six questions at once/i);
    expect(open).toMatch(/Antigravity/);
    expect(open).toMatch(/Cline/);
    expect(open).toMatch(/39/);
  });

  it('records the quota-stopped R2 outcome without claiming a completed full-roster regression', () => {
    const s = section(checklist(), '### R2: quota-stopped');
    expect(s).toContain('75b89b2c');
    expect(s).toContain('n3-regress2');
    expect(s).toMatch(/mode line/i);
    expect(s).toMatch(/unverified/);
    expect(s).toContain('1.2726');
    expect(s).toContain('98% to 100%');
    for (const file of ['session-report-r2-quota-stopped.txt', 'trace-r2-lead.txt', 'trace-r2-ava.txt', 'trace-r2-kaan.txt', 'trace-r2-jamileh.txt', 'trace-r2-yavuz.txt']) {
      expect(fs.existsSync(path.resolve('host-library/claude/observations/2026-10-07-n3-records', file)), file).toBe(true);
    }
  });

  it('records the decision on the `experimental` label and where the draft pull request went', () => {
    const s = section(checklist(), '### The `experimental` label');
    expect(s).toMatch(/#137/);
    expect(s).toMatch(/ADR 0043/);
  });
});

describe('ADR 0043, the outcome of Plan 035', () => {
  const adr = (): string => {
    expect(adrFile, 'docs/adr/0043-*.md exists').toBeDefined();
    return read(path.join('docs/adr', adrFile!));
  };

  it('has the four parts of an ADR and its date', () => {
    const a = adr();
    expect(a).toMatch(/^# ADR 0043: /);
    expect(a).toMatch(/\n- \*\*Status\*\*: \w+, 2026-10-07/);
    expect(a).toMatch(/\n- \*\*Context\*\*:/);
    expect(a).toMatch(/\n- \*\*Decision\*\*:/);
    expect(a).toMatch(/\n- \*\*Consequences\*\*:/);
  });

  it('records the live evidence of all nine scenarios and the open items', () => {
    const a = adr();
    for (const h of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9']) expect(a, h).toContain(h);
    expect(a).toMatch(/ADR 0042/);
    expect(a).toMatch(/Plan 033/);
    expect(a).toMatch(/Not established|still open|Open/);
  });

  it('agrees with the registry about the label of `digital-agency`', () => {
    const bundles = JSON.parse(read('registry/bundles.json')).bundles as Record<string, { status?: string }>;
    const status = bundles['digital-agency']!.status;
    expect(adr()).toMatch(status === undefined ? /label[^\n]*\bremoved\b/i : /label[^\n]*\bkept\b/i);
  });
});
