import fs from 'node:fs';
import path from 'node:path';

/** Plan 035 (skill layout): the algorithms moved to src/core/skill-layout.ts (P8a); this file keeps repository fixture discovery. */
export {
  SKILL_MD_MAX_LINES,
  SKILL_MD_MAX_CHARS,
  LISTING_MAX_CHARS,
  DESCRIPTION_MAX_CHARS,
  EVALS_MIN,
  EVALS_MAX,
  KNOWN_KEYS,
  supportingText,
  skillFolderText,
  checkSkillLayout,
} from '../../src/core/skill-layout.js';

/**
 * The skills converted to the layout: one empty marker file per skill in `tests/fixtures/laid-out-skills/`, the mirror of the
 * allowlist of templated skills (ADR 0040). A directory instead of an array keeps parallel pull requests from touching one line.
 */
export const LAID_OUT_DIR = path.resolve('tests/fixtures/laid-out-skills');

export function laidOutSkills(dir: string = LAID_OUT_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort();
}
