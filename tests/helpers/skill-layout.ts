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

/** Every markdown file of the skill folder except SKILL.md and the maintainer-only evals. */
export function supportingText(skillDir: string): string {
  return walk(skillDir)
    .filter(f => f !== 'SKILL.md' && !f.startsWith('evals/') && f.endsWith('.md'))
    .map(f => fs.readFileSync(path.join(skillDir, f), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n');
}

/** SKILL.md followed by its supporting markdown: what a depth or substance check sees of a laid-out skill. */
export function skillFolderText(skillsRoot: string, name: string): string {
  const dir = path.join(skillsRoot, name);
  return `${fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')}\n${supportingText(dir)}`;
}

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

export function checkSkillLayout(skillsRoot: string, name: string): string[] {
  const errors: string[] = [];
  const dir = path.join(skillsRoot, name);
  const raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [`${name}: no front matter`];
  const meta = YAML.parse(m[1]!) as Record<string, unknown>;
  const body = raw.slice(m[0].length);

  const lines = raw.split('\n').length;
  if (lines > SKILL_MD_MAX_LINES) errors.push(`${name}: SKILL.md has ${lines} lines (max ${SKILL_MD_MAX_LINES}); move detail to examples/ or references/`);
  if (raw.length > SKILL_MD_MAX_CHARS) errors.push(`${name}: SKILL.md has ${raw.length} characters (max ${SKILL_MD_MAX_CHARS})`);

  for (const key of Object.keys(meta)) if (!KNOWN_KEYS.has(key)) errors.push(`${name}: unknown front matter key "${key}" (Claude Code ignores it silently)`);

  const description = String(meta.description ?? '').replace(/\s+/g, ' ').trim();
  const whenToUse = String(meta.when_to_use ?? '').replace(/\s+/g, ' ').trim();
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
  for (const link of body.matchAll(/\]\(((?:examples|references|assets|scripts)\/[^)#\s]+)\)/g)) {
    if (!fs.existsSync(path.join(dir, link[1]!))) errors.push(`${name}: SKILL.md links to ${link[1]} which does not exist`);
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
    errors.push(`${name}: evals/evals.json is missing`);
  } else {
    const evals = JSON.parse(fs.readFileSync(evalsFile, 'utf8')) as { skill_name?: string; evals?: Array<{ id?: number; prompt?: string; expected_output?: string }> };
    if (evals.skill_name !== name) errors.push(`${name}: evals skill_name is ${evals.skill_name}`);
    const list = evals.evals ?? [];
    if (list.length < EVALS_MIN || list.length > EVALS_MAX) errors.push(`${name}: ${list.length} evals (want ${EVALS_MIN} to ${EVALS_MAX})`);
    for (const e of list) {
      if (typeof e.id !== 'number') errors.push(`${name}: an eval has no numeric id`);
      if ((e.prompt ?? '').length < 40) errors.push(`${name}: eval ${e.id} prompt is too short to be realistic`);
      if ((e.expected_output ?? '').length < 40) errors.push(`${name}: eval ${e.id} has no expected_output`);
    }
    if (new Set(list.map(e => e.prompt)).size !== list.length) errors.push(`${name}: duplicate eval prompts`);
  }
  return errors;
}
