import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8, 2026-10-05). In the with-skill run of the second `accessibility-audit` eval ("the client's lawyer
 * wants a one-line statement that our site is WCAG 2.1 AA compliant, axe came back clean") the role never loaded the skill,
 * and its answer was the answer it gave without the skill: the description said "Skip it to claim a site is accessible or
 * compliant", so the host's listing told the model to skip exactly the request that the skill's own edge case handles
 * ("decline; give the audit with its limits and hand the question to Defne"). A skill whose description sends the model
 * away from the case its body answers is never loaded for it. The description now names that request as a trigger and the
 * skill declines it.
 */

const SKILL = path.resolve('registry/skills/accessibility-audit/SKILL.md');
const text = fs.readFileSync(SKILL, 'utf8').replace(/\r\n/g, '\n');
const meta = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as { description: string };
const description = meta.description.replace(/\s+/g, ' ').trim();
const section = (heading: string): string => text.split(`## ${heading}\n`)[1]?.split(/\n## /)[0] ?? '';

describe('accessibility-audit loads for a compliance-statement request', () => {
  it('names the request as a trigger phrase of the description', () => {
    expect(description).toMatch(/compliance statement/i);
    expect(description).toMatch(/can we say we are accessible|we are WCAG compliant/i);
  });

  it('no longer tells the model to skip the skill for that request, and keeps its other skip', () => {
    expect(description).not.toMatch(/skip it to claim/i);
    expect(description).toMatch(/skip it for the root cause of one violation/i);
  });

  it('says in the description what the skill does with the request: it declines and hands the legal question to Defne', () => {
    expect(description).toMatch(/declines/i);
    expect(description).toMatch(/Defne/);
  });

  it('keeps the description within the listing cap of the skill layout', () => {
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('agrees with itself: Execution Triggers loads the skill for the request, only to decline it, and does not say not to use it', () => {
    const triggers = section('Execution Triggers');
    expect(triggers).toMatch(/compliance statement/i);
    expect(triggers).toMatch(/decline/i);
    expect(triggers).not.toMatch(/do not use it to claim/i);
  });
});
