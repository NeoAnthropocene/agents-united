import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8, 2026-10-05) and the maintainer's concern of 2026-10-06: the skills cost more than no skill when they run
 * on a request that lacks the data they need. Two of the H8 prompts show it: "our SaaS has been flat, give me ten experiments" (no
 * funnel numbers) got a 3.5k-token provisional playbook of ten scored experiments that ended in "What I need from you", and a
 * funnel audit from four numbers and no page wrote a 6.3k-token file of hypotheses. Asking cost about a sixth of that. The lead's
 * `agency-brief-and-premises` asks for the objective, the audience, the metric and the date, not for the data a specialist needs,
 * and a specialist used directly has no lead to ask. So each specialist body now opens "How to work" with an inputs-first rule: a
 * short first reply that asks, with a provisional sketch, instead of the full artifact.
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const SPECIALISTS = [
  'agency-campaign-specialist',
  'agency-compliance-grc-specialist',
  'agency-content-strategist',
  'agency-conversion-specialist',
  'agency-creative-designer',
  'agency-frontend-architect',
  'agency-growth-strategist',
  'agency-qa-automation-lead',
  'agency-seo-specialist',
] as const;

const body = (name: string): string => fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8').replace(/\r\n/g, '\n');
/** The "How to work" section, from its heading to the next level-2 heading. */
const howToWork = (name: string): string => body(name).split('\n## How to work\n')[1]?.split(/\n## /)[0] ?? '';

describe('every specialist body opens "How to work" with an inputs-first rule', () => {
  for (const name of SPECIALISTS) {
    describe(name, () => {
      const section = howToWork(name);
      const rule = section.split('\n').find((l) => l.startsWith('**Inputs first.**')) ?? '';

      it('has the rule as the first thing in the section, before step 1', () => {
        expect(section.trimStart().startsWith('**Inputs first.**')).toBe(true);
        expect(section.indexOf('**Inputs first.**')).toBeLessThan(section.indexOf('\n1. '));
      });

      it('says to check the brief before loading a skill or writing a file, against the skill\'s Inputs line', () => {
        expect(rule).toMatch(/Before you load a skill or write a file/);
        expect(rule).toMatch(/`Inputs` line/);
      });

      it('makes the first reply short: what is missing in the first line, one clause of why per input', () => {
        expect(rule).toMatch(/first reply asks for it and stays short/);
        expect(rule).toMatch(/say in the first line what is missing/i);
        expect(rule).toMatch(/one clause each/);
      });

      it('allows only a labelled provisional sketch, and no file or brief', () => {
        expect(rule).toMatch(/smallest plan the data supports/);
        expect(rule).toMatch(/labelled `provisional`/);
        expect(rule).toMatch(/write no file and no brief/);
        expect(rule).toMatch(/Output Contract waits/);
      });

      it('lifts the rule when the inputs arrive or the user says to proceed', () => {
        expect(rule).toMatch(/Deliver the full artifact when the inputs arrive or the user says to proceed/);
      });

      it('sends a teammate\'s question to the lead under Open items', () => {
        expect(rule).toMatch(/As a teammate, put the question under `Open items`: the lead asks the user/);
      });

      it('defines a required input narrowly, so that a brief with the numbers the question needs is answered in full', () => {
        expect(rule).toMatch(/An input is required only when, without it, your answer would rest on numbers or pages you have not seen/);
        expect(rule).toMatch(/one that would only sharpen the answer goes under `Open items` and you still deliver the full artifact/);
      });

      it('has the first reply say what the numbers it already has show, so that the leak or the bottleneck is still named', () => {
        expect(rule).toMatch(/say what the numbers you have already show/);
      });

      it('is one paragraph of reasonable size', () => {
        expect(rule.length).toBeGreaterThan(500);
        expect(rule.length).toBeLessThan(1300);
      });
    });
  }

  it('is not added to the lead, which collects the data through its brief skill instead', () => {
    expect(body('orchestrator-digital-agency')).not.toContain('**Inputs first.**');
  });

  it('is the same rule in all nine bodies', () => {
    const rules = SPECIALISTS.map((n) => howToWork(n).split('\n').find((l) => l.startsWith('**Inputs first.**')));
    expect(rules[0], 'the rule exists').toBeDefined();
    expect(new Set(rules).size).toBe(1);
  });
});
