import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8) and the maintainer's concern of 2026-10-06: a specialist that runs on a request without the data it needs
 * returns a provisional plan at full cost (a ten-experiment playbook scored on priors; a 6.3k-token audit file of hypotheses). The
 * lead's `agency-brief-and-premises` asked for the objective, the audience, the metric, the date, the budget and what was tried, and
 * never for the data a specialist skill needs (funnel counts by step and device, weekly traffic, baseline rates, page access), so
 * nobody collected it before the delegation map. The skill and the lead now do, in the same round as the plan-changing questions.
 */

const SKILL_DIR = path.resolve('registry/skills/agency-brief-and-premises');
const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const lead = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const step = (n: number): string => skill.split('\n').find((l) => l.startsWith(`${n}. `)) ?? '';
interface Eval { id: number; prompt: string; expected_output: string }
const evals = (JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'evals', 'evals.json'), 'utf8')) as { evals: Eval[] }).evals;

describe('agency-brief-and-premises collects the data the specialists need', () => {
  it('lists the data the first slices need, from each skill\'s Inputs line, when it reads before it asks', () => {
    expect(step(2)).toMatch(/list the data the first slices need[^.]*`Inputs` line/);
    expect(step(2)).toMatch(/mark what you have/);
  });

  it('asks for the missing data in the same round, as one list with who can supply each, and says why', () => {
    expect(step(4)).toMatch(/Ask the missing data in the same round, as one list with who can supply each/);
    expect(step(4)).toMatch(/provisional plan/);
  });

  it('keeps one question at a time for the plan-changing questions', () => {
    expect(step(4)).toMatch(/^4\. \*\*Ask one question at a time\*\*/);
  });

  it('stays within the 6,000-character cap of the skill layout', () => {
    expect(skill.length).toBeLessThanOrEqual(6000);
  });
});

describe('the lead asks for the data in the same round as its alignment questions', () => {
  it('says so in Plan with the user, pointing at the brief skill', () => {
    const plan = lead.split('\n## Plan with the user\n')[1]?.split(/\n## /)[0] ?? '';
    expect(plan).toMatch(/Ask in the same round for the data the first slices need/);
    expect(plan).toMatch(/`agency-brief-and-premises`[^.]*`Inputs` line/);
    expect(plan).toMatch(/no specialist runs on guesses/);
  });
});

describe('eval 1 of the brief skill expects the data list', () => {
  const first = evals.find((e) => e.id === 1)!;

  it('wants the funnel counts, the traffic, the current rate and the analytics access listed, with who can supply each', () => {
    expect(first.expected_output).toMatch(/funnel counts by stage/);
    expect(first.expected_output).toMatch(/weekly traffic/);
    expect(first.expected_output).toMatch(/who can supply/);
  });

  it('still wants the gate: no specialist briefed before the brief and the map are accepted', () => {
    expect(first.expected_output).toMatch(/briefs no specialist to produce one before the brief and then the delegation map are accepted/);
  });
});
