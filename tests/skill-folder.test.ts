import { describe, expect, it } from 'vitest';
import { MAINTAINER_ONLY_SKILL_DIRS, isMaintainerOnlySkillPath } from '../src/core/skill-folder.js';

/**
 * Plan 035 (the skill layout): a skill folder may hold a folder the maintainers use and the user never needs, `evals/` (the
 * prompts a skill is tried with). Every install lane asks this one function before it copies a path out of a skill folder.
 */
describe('isMaintainerOnlySkillPath', () => {
  it('names `evals` as the one folder of a skill that is never installed', () => {
    expect([...MAINTAINER_ONLY_SKILL_DIRS]).toEqual(['evals']);
  });

  it('is true for the folder and for everything below it, whichever separator the path uses', () => {
    for (const rel of ['evals', 'evals/evals.json', 'evals/files/sample.csv', 'evals\\evals.json', 'evals\\files\\sample.csv']) {
      expect(isMaintainerOnlySkillPath(rel), rel).toBe(true);
    }
  });

  it('is false for SKILL.md and for the folders a user does get', () => {
    for (const rel of ['SKILL.md', 'references/checklist.md', 'examples/worked-example.md', 'scripts/helper.mjs', 'LICENSE.txt']) {
      expect(isMaintainerOnlySkillPath(rel), rel).toBe(false);
    }
  });

  it('is false for a name that only starts like it, and for an evals folder nested deeper', () => {
    for (const rel of ['evals.md', 'evals-notes/a.md', 'evaluation/a.md', 'references/evals/how-to.md', 'examples/evals']) {
      expect(isMaintainerOnlySkillPath(rel), rel).toBe(false);
    }
  });

  it('is false for the skill folder itself (an empty relative path), so a copy filter keeps the root', () => {
    expect(isMaintainerOnlySkillPath('')).toBe(false);
    expect(isMaintainerOnlySkillPath('.')).toBe(false);
  });
});
