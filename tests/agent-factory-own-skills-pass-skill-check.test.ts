import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSkillCheck, skillCheckExitCode } from '../src/core/skill-check.js';

/**
 * Plan 033 P25-A: the agent factory judges other Skills with `agents skill-check`, so its own six Skills must pass that
 * check under the in-house policy with the repository's frozen corpus. The check reads the shared entry
 * `registry/skills/<name>/SKILL.md` and its folder; this pins that no factory Skill regresses to a finding.
 */
const POLICY = 'agents-united-original';
const CORPUS = path.resolve('registry/quality/skill-boilerplate-corpus.txt');
const FACTORY_SKILLS = ['coordinate-artifact', 'evaluate-artifact', 'author-skill', 'author-contract', 'author-bundle', 'author-rule', 'repo-doctor'] as const;

describe('the factory\'s own Skills pass the factory\'s own Skill check', () => {
  it.each(FACTORY_SKILLS)('%s passes skill-check with policy agents-united-original and no finding', skill => {
    const result = runSkillCheck({ artifact: path.resolve('registry/skills', skill), corpus: CORPUS, policy: POLICY });
    expect(result.findings, JSON.stringify(result.findings, null, 2)).toEqual([]);
    expect(result.status).toBe('passed');
    expect(skillCheckExitCode(result)).toBe(0);
  });
});
