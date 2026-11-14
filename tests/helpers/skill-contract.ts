/** Plan 035 (ADR 0040): the contract moved to src/core/skill-contract.ts (P8a); this re-export keeps the test imports. */
export {
  REQUIRED_HEADINGS,
  BANNED_PHRASES,
  MAX_BODY_LINES,
  MAX_CHARS,
  validateRewrittenSkill,
} from '../../src/core/skill-contract.js';
