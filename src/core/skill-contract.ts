import YAML from 'yaml';

/**
 * Plan 035 (ADR 0040): the contract of a rewritten skill, shared by `skill-rewrite-contract.test.ts` and
 * `skill-layout.test.ts`. The four things a fit skill has (a worked example, anti-patterns, the evidence to
 * produce, a hand-off) may live in SKILL.md or in its supporting files; the rest is checked on SKILL.md.
 */

export const REQUIRED_HEADINGS = [
  '## Overview & Purpose',
  '## Execution Triggers',
  '## Input/Output Requirements',
  '## Step-by-Step Runbook',
  '## Code & Config Exemplars',
  '## Edge Cases & Error Recovery',
  '## Verification Checklist',
];

/** Phrases that only the template (or an unfinished skill) contains. */
export const BANNED_PHRASES: ReadonlyArray<RegExp> = [
  /deterministic framework/i,
  /clean git working directory/i,
  /npm run typecheck/i,
  /npx agents-united doctor/i,
  /zero dummy placeholder/i,
  /<placeholder>/i,
  /\bTODO\b/,
  /\bTBD\b/,
  /lorem ipsum/i,
  /git commit -m/i,
];

export const MAX_BODY_LINES = 500;
/** About 5k tokens at 4 characters per token (docs/skill-intake.md step 5). */
export const MAX_CHARS = 20000;

/** A front matter value as message text: its `String()` form, or its JSON form when that conversion raises (an object with a `toString` key). */
function showValue(value: unknown): string {
  try {
    return String(value);
  } catch {
    try {
      return JSON.stringify(value) ?? 'unreadable value';
    } catch {
      return 'unreadable value';
    }
  }
}

export function validateRewrittenSkill(name: string, content: string, supportText = '', options: { requireProjectAuthor?: boolean; forbidSource?: boolean } = {}): string[] {
  const errors: string[] = [];
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return [`${name}: no front matter`];
  // Front matter that fails to parse, or parses to null (`---\n~\n---`), has no metadata to read:
  // report it like any other candidate defect instead of raising. A parsed scalar or list keeps
  // today's property reads (all undefined), so those findings are unchanged.
  let meta: { name?: string; description?: string; metadata?: { author?: string; version?: string | number; source?: string } };
  try {
    const parsed: unknown = YAML.parse(fm[1]);
    meta = (parsed === null ? {} : parsed) as typeof meta;
    if (parsed === null) errors.push(`${name}: front matter is not a YAML mapping`);
  } catch (error) {
    meta = {};
    errors.push(`${name}: front matter is not valid YAML (${error instanceof Error ? error.message : String(error)})`);
  }
  const body = content.slice(fm[0].length);
  if (meta.name !== name) errors.push(`${name}: front matter name is ${showValue(meta.name)}`);
  const descriptionValue = meta.description ?? '';
  const description = (typeof descriptionValue === 'string' ? descriptionValue : '').replace(/\s+/g, ' ').trim();
  if (description.length < 40 || description.length > 1024) errors.push(`${name}: description must be 40 to 1,024 characters, is ${description.length}`);
  if (options.requireProjectAuthor ?? true) {
    if (meta.metadata?.author !== 'agents-united') errors.push(`${name}: metadata.author must be agents-united`);
  }
  if (options.forbidSource ?? true) {
    if (meta.metadata?.source) errors.push(`${name}: original work carries no metadata.source`);
  }
  for (const heading of REQUIRED_HEADINGS) {
    if (!new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'm').test(body)) errors.push(`${name}: missing section "${heading}"`);
  }
  if (content.split(/\r?\n/).length > MAX_BODY_LINES) errors.push(`${name}: over ${MAX_BODY_LINES} lines`);
  if (content.length > MAX_CHARS) errors.push(`${name}: over ${MAX_CHARS} characters (about 5k tokens)`);
  for (const phrase of BANNED_PHRASES) {
    if (phrase.test(content)) errors.push(`${name}: contains template phrase ${phrase}`);
  }
  const whole = `${body}
${supportText}`;
  if (!/worked example/i.test(whole)) errors.push(`${name}: no "worked example"`);
  if (!/anti-pattern/i.test(whole)) errors.push(`${name}: no anti-patterns`);
  if (!/evidence/i.test(whole)) errors.push(`${name}: names no evidence to produce`);
  if (!/hand(s)?[ -]?(off|over)|hand(s)? to |handoff/i.test(whole)) errors.push(`${name}: no hand-off to a teammate`);
  return errors;
}

