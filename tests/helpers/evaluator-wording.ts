import fs from 'node:fs';
import path from 'node:path';
import { HANDBACK_MAX_BLOCKS } from '../../src/core/handback-check.js';

// The two fixed evaluator sentences (citation rule, one JSON object) and the limits behind them. The numbers are read from the record
// checker's own constants, so the texts and the check cannot drift; no text in a test names them a second time.

const ROOT = path.resolve(__dirname, '..', '..');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export const CHECKER_FILE = 'registry/skills/evaluate-artifact/scripts/check-review.mjs';

export interface CitationLimits { maxQuoteLines: number; maxQuoteBytes: number }

export function citationLimits(): CitationLimits {
  const source = fs.readFileSync(path.join(ROOT, CHECKER_FILE), 'utf8');
  const match = /const CITATION_LIMITS = \{ maxQuoteLines: (\d+), maxQuoteBytes: (\d+) \};/.exec(source);
  if (!match) throw new Error('check-review.mjs no longer declares CITATION_LIMITS = { maxQuoteLines, maxQuoteBytes }');
  return { maxQuoteLines: Number(match[1]), maxQuoteBytes: Number(match[2]) };
}

/** The citation rule (ADR 0071, quote-located citations), as every text an evaluator loads (and every evaluator prompt) states it. */
export function citationRule(limits: CitationLimits = citationLimits()): string {
  const quoteLines = WORDS[limits.maxQuoteLines]!;
  return `A citation gives its source and a quote copied exactly from that file, at most ${quoteLines} lines and ${limits.maxQuoteBytes} bytes, and no line range: `
    + 'the checker finds the lines itself; give `line` (the line the quote begins on, as the Read tool numbers it) only when the quote occurs more than once in the file; '
    + 'one bad citation gets the whole result refused.';
}

/** The start of the earlier, line-numbered citation rule that ADR 0071 replaced; no text may carry it any more. */
export const OLD_CITATION_RULE_START = 'A citation covers one line or at most';

/** The hand-back rule. */
export const ONE_JSON_RULE = 'Your hand-back (the SubagentHandback message, or your final message where that tool is absent) is exactly ONE JSON object that validates against `assets/result.schema.json`, with no text before or after it, no code fence and no headings.';

/** The coordinator's instruction that puts both sentences into every evaluator prompt. */
export const promptBlock = (): string => `Every evaluator prompt, the first and a fresh one alike, carries these two sentences word for word: "${citationRule()}" "${ONE_JSON_RULE}"`;

/** The coordinator's rule for saving the evaluator's answer. */
export const SAVE_COMPLETE = "Save the evaluator's answer complete and unedited, never a shortened or stand-in file; if you cannot save it complete, say so and save nothing in its place.";

/** ADR 0070: what the evaluator is told about the hand-back hook, in one wording in every text it loads. */
export const HAND_BACK_HOOK_RULE = `Where the Host supports it, a hand-back the caller's check would refuse is blocked and the reason is shown to you; correct every item listed and hand back the complete result again. After ${WORDS[HANDBACK_MAX_BLOCKS]} blocked attempts the next goes through as it is.`;

/** ADR 0070: what the coordinator is told about it, in one wording in each place that carries the refusal rule. */
export const COORDINATOR_HOOK_RULE = "A hand-back hook may have asked the evaluator to correct its result before it reached you (ADR 0070); the caller's check remains the judge, so run it as before, and a headless session runs no such hook.";
