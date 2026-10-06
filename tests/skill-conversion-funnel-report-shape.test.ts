import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8, 2026-10-05). `conversion-funnel-optimization` did not beat no skill: 9 of 11 assertions with the
 * skill and 8 of 11 without (one of the without runs had read the skill's worked example, so the gap is, if anything,
 * overstated). In both with-skill runs the role never opened `examples/templates.md`, so the report shape that sat there (seven
 * parts, each finding with its owner) was never in front of it, and the hand-off assertion failed with the skill: the answer
 * named Deniz and no one else. The shape now sits in SKILL.md as a table whose last column is the hand-off, and SKILL.md is
 * leaner than it was (5,909 characters before this change), so that the skill costs less to load than it did.
 */

const SKILL = path.resolve('registry/skills/conversion-funnel-optimization/SKILL.md');
const text = fs.readFileSync(SKILL, 'utf8').replace(/\r\n/g, '\n');
const tableRows = text.split('\n').filter((l) => l.startsWith('|'));
const table = tableRows.join('\n');
const section = (heading: string): string => text.split(`## ${heading}\n`)[1]?.split(/\n## /)[0] ?? '';

describe('conversion-funnel-optimization carries its report shape in SKILL.md', () => {
  it('has a table of the seven report parts with a hand-off column', () => {
    expect(tableRows[0] ?? '').toMatch(/\|\s*Part\s*\|\s*Holds\s*\|\s*Hand-off\s*\|/);
    const parts = tableRows.slice(2).map((r) => r.split('|')[1].trim());
    expect(parts).toEqual(['1 Summary', '2 Funnel', '3 Findings', '4 Backlog', '5 Briefs', '6 Walked', '7 Gaps']);
  });

  it('names every owner of a finding in the table, and the skill that writes the tests', () => {
    for (const name of ['Jamileh', 'Deniz', 'Selin', 'Emre', '`ab-test-setup`']) expect(table, name).toContain(name);
  });

  it('says what a finding is labelled when no page was read, instead of leaving the part empty', () => {
    expect(table).toContain('from the numbers, page not walked');
  });

  it('sits in the Input/Output section and still points at the copy-ready blocks', () => {
    const io = section('Input/Output Requirements');
    expect(io).toContain('| Part | Holds | Hand-off |');
    expect(io).toContain('examples/templates.md');
  });

  it('is leaner than before: at most 5,500 characters, with the reason kept for each anti-pattern', () => {
    expect(text.length).toBeLessThanOrEqual(5500);
    const anti = section('Code & Config Exemplars').split('Anti-patterns, each with its reason:\n')[1] ?? '';
    const lines = anti.split('\n').filter((l) => l.startsWith('- '));
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const l of lines) expect(l, l).toMatch(/: .{12,}/);
  });
});
