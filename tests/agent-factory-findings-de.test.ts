import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPORT_KEYS, runBundleCheck } from '../src/core/bundle-check.js';
import { domainProposal, makeFixture, serialize, writeFiles } from './helpers/bundle-proposal.js';
import type { Fixture } from './helpers/bundle-proposal.js';

// Three findings of a live test of the agent factory (D-1, E-1, E-2): the texts say what the checks require.

const ROOT = path.resolve(__dirname, '..');
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

const NO_TASK = 'With no task path, or a path that does not exist or is not a task record of this Skill, stop with a blocked note naming the path; never choose another task file.';
const AUTHORING_ENTRIES = [
  'registry/skills/author-skill/SKILL.md',
  'registry/skills/author-contract/SKILL.md',
  'registry/skills/author-bundle/SKILL.md',
  'registry/hosts/claude/skills/author-skill/SKILL.md',
  'registry/hosts/claude/skills/author-contract/SKILL.md',
  'registry/hosts/claude/skills/author-bundle/SKILL.md',
];

describe('D-1: a task path that does not exist stops the authoring fork', () => {
  it.each(AUTHORING_ENTRIES)('%s carries the one wording, once, and stays inside the Skill size limits', entry => {
    const text = read(entry);
    expect(text.split(NO_TASK)).toHaveLength(2);
    expect(text).not.toContain('If no task is found');
    expect(text).not.toContain('With no task, stop');
    expect(text.length).toBeLessThanOrEqual(6000);
    expect(text.split('\n').length - 1).toBeLessThanOrEqual(90);
  });
});

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

describe('E-1: the evaluator learns the citation span limit the record check enforces', () => {
  const checker = read('registry/skills/evaluate-artifact/scripts/check-review.mjs');
  const match = /cite\.endLine - cite\.startLine >= (\d+)/.exec(checker);

  it('finds the limit in the checker source', () => {
    expect(match).not.toBeNull();
  });

  it('states the same number in references/evidence.md, so the two cannot drift', () => {
    const refused = Number(match![1]);
    const evidence = read('registry/skills/evaluate-artifact/references/evidence.md');
    expect(evidence).toContain(`A citation spans at most ${WORDS[refused]} logical lines (its end line at most ${WORDS[refused - 1]} after its start line)`);
    expect(evidence).toContain('cite a longer passage as several citations or by its most telling lines');
    expect(evidence).toContain("the caller's record check refuses the whole review otherwise");
  });
});

describe('E-1: the coordinator may start one fresh evaluator after a refused review result', () => {
  const REFUSED = 'When `check-review.mjs --job --result` refuses a review result, never edit the result. You may start ONE fresh evaluator for the same review job, with the checker\'s reason quoted in the prompt, if the journey\'s one additional evaluator turn is still unused (it counts as that turn of the worker-turn limit, so no evaluator turn is then left for a repair\'s review); that is a new evaluator turn, not a repair of the candidate, and needs no other authorization. First move the refused result to `result.refused.json` beside it; if that name already exists, stop and report instead of overwriting; only then save the fresh evaluator\'s result unedited as `result.json`, and report both. A second refusal is reported, not retried.';
  it.each([
    'registry/skills/coordinate-artifact/references/verification.md',
    'registry/skills/coordinate-artifact/references/skill-authoring.md',
    'registry/skills/coordinate-artifact/references/contract-authoring.md',
    'registry/hosts/claude/agents/orchestrator-agent-factory.md',
  ])('%s carries the wording once', file => {
    expect(read(file).split(REFUSED)).toHaveLength(2);
  });

  it('names no launch form in the added wording', () => {
    expect(REFUSED).not.toMatch(/foreground|run_in_background/);
  });

  it('rests on the turn rule of repair.md and the agent file, and names the fresh evaluator as the one additional evaluator turn', () => {
    expect(read('registry/skills/coordinate-artifact/references/repair.md')).toContain('One initial realizer plus evaluator, at most one additional of each: <=4 sequential worker turns');
    expect(read('registry/hosts/claude/agents/orchestrator-agent-factory.md')).toContain('maximum one explicitly preauthorized scoped repair means at most four sequential worker turns');
    expect(REFUSED).toContain("if the journey's one additional evaluator turn is still unused (it counts as that turn of the worker-turn limit, so no evaluator turn is then left for a repair's review)");
    expect(REFUSED).toContain('First move the refused result to `result.refused.json` beside it; if that name already exists, stop and report instead of overwriting; only then save');
  });
});

describe('E-2: the Bundle report guide says the upstream section is always present', () => {
  const guide = JSON.parse(read('registry/skills/author-bundle/assets/report.json')) as { required: Record<string, string> };
  const sentence = /write exactly: (.+)$/.exec(guide.required.upstream)?.[1];
  const fixtures: Fixture[] = [];
  afterEach(() => { for (const made of fixtures.splice(0)) fs.rmSync(made.root, { recursive: true, force: true }); });

  const shapeOf = (report: Record<string, unknown>) => {
    const proposal = domainProposal();
    proposal.report = report;
    const made = makeFixture('au-findings-de-');
    fixtures.push(made);
    writeFiles(made.proposal, serialize(proposal));
    const result = runBundleCheck({ artifact: made.proposal, registry: made.registry });
    return result.checks.find(check => check.id === 'shape')!;
  };

  it('lists exactly the sections the check requires, and says the upstream one is always present', () => {
    expect(Object.keys(guide.required).sort()).toEqual([...REPORT_KEYS].sort());
    expect(guide.required.upstream).toMatch(/^Always present, even for local intent\./);
    expect(sentence).toBe('Local intent: nothing is prepared for upstream.');
    expect(read('registry/skills/author-bundle/references/verification.md')).toContain(`"${sentence}"`);
  });

  it('passes the shape check for a local-intent report that holds the section in the documented form', () => {
    const report: Record<string, unknown> = Object.fromEntries(REPORT_KEYS.map(key => [key, `the ${key} section`]));
    report.upstream = sentence;
    const shape = shapeOf(report);
    expect(shape.status, JSON.stringify(shape.findings)).toBe('passed');
  });

  it('still refuses a report that leaves the upstream section out', () => {
    const report: Record<string, unknown> = Object.fromEntries(REPORT_KEYS.map(key => [key, `the ${key} section`]));
    delete report.upstream;
    const shape = shapeOf(report);
    expect(shape.status).toBe('failed');
    expect(shape.findings.map(item => item.message).join('\n')).toContain('"upstream"');
  });
});
