import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

/**
 * Plan 035 (skill layout): what a skill that follows the Claude Code skills guidance looks like in this repository.
 * https://code.claude.com/docs/en/skills.md (read 2026-10-05): once a skill loads, its text stays in context on every
 * later turn, so `SKILL.md` stays short and carries decision rules and navigation; examples, reference material and
 * scripts live in supporting files that are read or run on demand; after compaction only the first 5,000 tokens of a
 * skill are kept, so the most important text comes first; `description` plus `when_to_use` are capped at 1,536
 * characters in the skill listing and the key use case comes first.
 */

export const SKILL_MD_MAX_LINES = 90;
export const SKILL_MD_MAX_CHARS = 6000;
export const LISTING_MAX_CHARS = 1536;
/** The Antigravity skills page caps a description at 1,024 characters; skills are installed there as written. */
export const DESCRIPTION_MAX_CHARS = 1024;
export const EVALS_MIN = 2;
export const EVALS_MAX = 5;

/**
 * Which `skill-check` policies require `evals/evals.json` (the maintainer's decision of 2026-11-17). All three required it at the time;
 * `adapted-source` stops requiring it: an adaptation is the upstream's Skill, and the upstream's evals are not shipped with it (the
 * NOTICE.md of the adapted registry Skills say so). A file that is present is validated under every policy.
 * `registry/skills/coordinate-artifact/scripts/check-skill-return.mjs` cannot import from `src/` and carries a literal copy of this table;
 * `tests/skill-evals-policy.test.ts` ties the copy to it.
 */
export const EVALS_FILE_REQUIRED: Readonly<Record<'agents-united-original' | 'private-owner' | 'adapted-source', boolean>> = {
  'agents-united-original': true,
  'private-owner': true,
  'adapted-source': false,
};

/** Frontmatter keys Claude Code acts on, the Agent Skills ones, and this repository's own `disable-slash-command`. */
export const KNOWN_KEYS = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable', 'allowed-tools',
  'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell', 'metadata', 'license', 'compatibility',
  'disable-slash-command',
]);

/**
 * What a skill folder may hold beside SKILL.md: `examples/` (worked examples), `references/` (read when a step calls for them),
 * `assets/` (templates and lookup files a role copies or fills in; the official skills guide, https://claude.com/docs/skills/how-to.md,
 * names the folder) and `scripts/` (run, not read). Each file is mentioned in SKILL.md at the step that needs it.
 */
const SUPPORT_DIRS = ['examples', 'references', 'assets', 'scripts'];

function walk(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]));
}

/** True for a top-level NOTICE.md or a top-level LICEN[CS]E file: the prose the `excludeTopLevelNotices` option of `supportingText` leaves out. */
const isTopLevelNoticeOrLicence = (f: string): boolean => !f.includes('/') && (/^NOTICE\.md$/i.test(f) || /^LICEN[CS]E(\.(md|txt))?$/i.test(f));

/**
 * Text for a message or a length test from a front matter or evals value of any type. A string is itself, anything else is its
 * `String()` form, and a value whose conversion raises (an object with a `toString` key that is not a function) is its JSON form,
 * so a hostile value becomes a finding instead of a thrown error.
 */
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
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

/**
 * The target of every SKILL.md link into a support folder (`](examples/...)`, `references/`, `assets/`, `scripts/`), exactly as the
 * layout gate looks it up. `skill-check` reads the same targets before any gate runs, so both see one string.
 */
export function supportLinkTargets(body: string): string[] {
  return [...body.matchAll(/\]\(((?:examples|references|assets|scripts)\/[^)#\s]+)\)/g)].map(link => link[1]!);
}

/** True when a link target holds a `..` segment, written with either separator: such a target is never looked up. */
const hasParentSegment = (target: string): boolean => target.split(/[\\/]/).some(part => part === '..');

/** Every markdown file of the skill folder except SKILL.md and the maintainer-only evals. */
export function supportingText(skillDir: string, options: { excludeTopLevelNotices?: boolean } = {}): string {
  return walk(skillDir)
    .filter(f => f !== 'SKILL.md' && !f.startsWith('evals/') && f.endsWith('.md')
      // When a caller asks for it (the licence-carrying policies), top-level licence and notice
      // prose stays out, so it cannot satisfy the worked-example, anti-pattern, evidence and
      // hand-off checks; files in subfolders are unaffected.
      && (!options.excludeTopLevelNotices || !isTopLevelNoticeOrLicence(f)))
    .map(f => fs.readFileSync(path.join(skillDir, f), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n');
}

/** SKILL.md followed by its supporting markdown: what a depth or substance check sees of a laid-out skill. */
export function skillFolderText(skillsRoot: string, name: string): string {
  const dir = path.join(skillsRoot, name);
  return `${fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')}\n${supportingText(dir)}`;
}

/** `policy` names the `skill-check` policy; the finding for a missing evals file is skipped only for a policy that does not require it. No policy: required. */
export function checkSkillLayout(skillsRoot: string, name: string, policy: keyof typeof EVALS_FILE_REQUIRED = 'agents-united-original'): string[] {
  const errors: string[] = [];
  const dir = path.join(skillsRoot, name);
  const raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [`${name}: no front matter`];
  // Front matter that fails to parse, or parses to null, is reported like any other candidate
  // defect instead of raising; a parsed scalar or list keeps today's Object.keys treatment.
  let meta: Record<string, unknown>;
  try {
    const parsed: unknown = YAML.parse(m[1]!);
    meta = (parsed === null ? {} : parsed) as Record<string, unknown>;
    if (parsed === null) errors.push(`${name}: front matter is not a YAML mapping`);
  } catch (error) {
    meta = {};
    errors.push(`${name}: front matter is not valid YAML (${error instanceof Error ? error.message : String(error)})`);
  }
  const body = raw.slice(m[0].length);

  const lines = raw.split('\n').length;
  if (lines > SKILL_MD_MAX_LINES) errors.push(`${name}: SKILL.md has ${lines} lines (max ${SKILL_MD_MAX_LINES}); move detail to examples/ or references/`);
  if (raw.length > SKILL_MD_MAX_CHARS) errors.push(`${name}: SKILL.md has ${raw.length} characters (max ${SKILL_MD_MAX_CHARS})`);

  for (const key of Object.keys(meta)) if (!KNOWN_KEYS.has(key)) errors.push(`${name}: unknown front matter key "${key}" (Claude Code ignores it silently)`);

  const description = plainText(meta.description ?? '').replace(/\s+/g, ' ').trim();
  const whenToUse = plainText(meta.when_to_use ?? '').replace(/\s+/g, ' ').trim();
  if (!/^Use when /.test(description)) errors.push(`${name}: description must lead with the key use case ("Use when ...")`);
  // `when_to_use` is Claude-only and not recorded for Antigravity or Cline (tests/native-antigravity-skills.test.ts), so the trigger
  // phrases and the "skip it when" go into the description until a host guide says the key is safe on every host.
  if (whenToUse !== '') errors.push(`${name}: do not use when_to_use yet; put the trigger phrases in the description`);
  if (description.length > DESCRIPTION_MAX_CHARS) errors.push(`${name}: description is ${description.length} characters (cap ${DESCRIPTION_MAX_CHARS}, the Antigravity limit; the Claude listing cap is ${LISTING_MAX_CHARS})`);
  if (!/trigger phrases|phrases:/i.test(description)) errors.push(`${name}: the description lists no trigger phrases`);
  if (!/\b(skip|do not use|don't use|not for)\b/i.test(description)) errors.push(`${name}: the description says nothing about when to skip the skill`);

  if (/(^|\s)!`|^```!/m.test(body)) errors.push(`${name}: no "!" command injection in SKILL.md: a role without a shell would abort the skill`);

  const files = walk(dir).filter(f => SUPPORT_DIRS.some(d => f.startsWith(`${d}/`)));
  for (const f of files) {
    if (!body.includes(f)) errors.push(`${name}: ${f} is not referenced from SKILL.md (say what it holds and when to load it)`);
  }
  for (const target of supportLinkTargets(body)) {
    // A target with a `..` segment is not looked up at all: what it names depends on how it is resolved, and may be outside the folder.
    if (hasParentSegment(target)) errors.push(`${name}: SKILL.md links to ${target}, which has a ".." segment; links stay inside the skill folder and are not looked up`);
    else if (!fs.existsSync(path.join(dir, target))) errors.push(`${name}: SKILL.md links to ${target} which does not exist`);
  }

  // A script replaces hand arithmetic for the roles that have a shell (Selin, Emre, Deniz, Defne); Ava, Kaan, Yavuz, Jale and
  // Jamileh have none, so a skill with scripts also carries the formula or a precomputed table in references/.
  const scripts = files.filter(f => f.startsWith('scripts/'));
  for (const s of scripts) {
    if (!s.endsWith('.mjs')) errors.push(`${name}: ${s} is not a Node .mjs script (one runtime for every role that has a shell)`);
    else if (!body.includes(`\${CLAUDE_SKILL_DIR}/${s}`)) errors.push(`${name}: ${s} is not run through \${CLAUDE_SKILL_DIR}/${s} in SKILL.md (the path must not depend on the working directory)`);
  }
  if (scripts.length > 0 && !files.some(f => f.startsWith('references/') && f.endsWith('.md'))) {
    errors.push(`${name}: has scripts/ but no references/ file: a role without a shell needs the formula or a precomputed table`);
  }

  const evalsFile = path.join(dir, 'evals', 'evals.json');
  if (!fs.existsSync(evalsFile)) {
    if (EVALS_FILE_REQUIRED[policy]) errors.push(`${name}: evals/evals.json is missing`);
  } else {
    // An evals document that is not valid JSON, is JSON null, or holds no array of JSON objects
    // is a broken candidate, not an exception: report it and keep the findings collected so far.
    let evalsJson: unknown;
    try {
      evalsJson = JSON.parse(fs.readFileSync(evalsFile, 'utf8'));
    } catch {
      errors.push(`${name}: evals/evals.json is not valid JSON`);
      return errors;
    }
    if (evalsJson === null) {
      errors.push(`${name}: evals/evals.json is not a JSON object`);
      return errors;
    }
    const evals = evalsJson as { skill_name?: unknown; evals?: Array<{ id?: unknown; prompt?: unknown; expected_output?: unknown } | null> };
    if (evals.skill_name !== name) errors.push(`${name}: evals skill_name is ${plainText(evals.skill_name)}`);
    const list = evals.evals ?? [];
    if (!Array.isArray(list)) {
      errors.push(`${name}: evals is not an array (evals/evals.json must hold a list of eval objects)`);
      return errors;
    }
    if (list.length < EVALS_MIN || list.length > EVALS_MAX) errors.push(`${name}: ${list.length} evals (want ${EVALS_MIN} to ${EVALS_MAX})`);
    for (const e of list) {
      if (e === null) {
        errors.push(`${name}: an eval is not an object (each entry must be a JSON object)`);
        continue;
      }
      if (typeof e.id !== 'number') errors.push(`${name}: an eval has no numeric id`);
      // A prompt or an expected output that is present but not a string is a finding of its own; its length is never measured.
      const id = plainText(e.id);
      if (e.prompt !== undefined && e.prompt !== null && typeof e.prompt !== 'string') errors.push(`${name}: eval ${id} prompt is not a string`);
      else if (((e.prompt as string | null | undefined) ?? '').length < 40) errors.push(`${name}: eval ${id} prompt is too short to be realistic`);
      if (e.expected_output !== undefined && e.expected_output !== null && typeof e.expected_output !== 'string') errors.push(`${name}: eval ${id} expected_output is not a string`);
      else if (((e.expected_output as string | null | undefined) ?? '').length < 40) errors.push(`${name}: eval ${id} has no expected_output`);
    }
    const checkable = list.filter(e => e !== null);
    if (new Set(checkable.map(e => e?.prompt)).size !== checkable.length) errors.push(`${name}: duplicate eval prompts`);
  }
  return errors;
}
