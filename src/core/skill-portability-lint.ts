/**
 * Plan 026 Objective 5 — portability lint for skills, run at catalog-validation time
 * (RegistryResolver) against the Host Primitive Matrix's name/size limits
 * (docs/host-primitive-matrix.md). A skill that fails this lint would silently break on
 * at least one active host (a name Claude/Cline refuse to load, or a body/script only a
 * POSIX shell can run) — this module turns that into a build-time error instead of a
 * runtime surprise.
 *
 * Limits enforced (smallest-host-wins, so passing here means passing everywhere):
 * - Claude Code skill name: ≤64 chars, lowercase ASCII letters/digits/hyphens only, and
 *   must not contain "claude" or "anthropic" as a substring (platform naming rule).
 * - Cline skill name: must equal the skill's own directory name exactly (Cline's
 *   discovery loader keys skills by directory).
 * - Body size: Cline recommends SKILL.md stay under ~5k tokens (docs.cline.bot/
 *   customization/skills, "Keeping Skills Focused") and Claude Code wants the body under
 *   ~500 lines (platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
 *   Token count is estimated at ~4 characters/token (a documented, order-of-magnitude-safe
 *   heuristic — this lint runs offline with no tokenizer dependency); either limit being
 *   exceeded fails, since exceeding either host's limit means splitting content into
 *   `references/` is overdue.
 * - Scripts: a `scripts/**` file with a bash-only shebang (`#!/bin/bash`,
 *   `#!/usr/bin/env bash`) or bash-only syntax (`[[ ... ]]`, `local -a`, process
 *   substitution `<(...)`) fails unless a non-bash counterpart with the same base name
 *   exists alongside it (e.g. `validate.sh` + `validate.ps1` or `validate.py`) — the
 *   skill-intake host check (docs/skill-intake.md) requires scripts runnable on Windows
 *   and POSIX without assuming a bash-like shell.
 */

const CLAUDE_NAME_MAX = 64;
const CLAUDE_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_NAME_SUBSTRINGS = ['claude', 'anthropic'];

/** ~4 chars/token, the same order-of-magnitude heuristic used across this codebase's docs. */
const CHARS_PER_TOKEN_ESTIMATE = 4;
const CLINE_BODY_TOKEN_LIMIT = 5000;
const CLAUDE_BODY_LINE_LIMIT = 500;

const BASH_ONLY_SHEBANG = /^#!.*\bbash\b/;
const BASH_ONLY_SYNTAX = /\[\[.*\]\]|local\s+-[aA]\b|<\(/;

export interface SkillScriptFile {
  /** Path relative to the skill directory, e.g. "scripts/validate.sh". */
  relPath: string;
  content: string;
}

export interface SkillPortabilityInput {
  /** The skill's directory name (what Cline requires `name` to equal). */
  dirName: string;
  /** The `name` field from SKILL.md frontmatter. */
  name: string;
  /** The full SKILL.md body (post-frontmatter markdown). */
  body: string;
  /** Every file under `scripts/`, if any. */
  scripts?: SkillScriptFile[];
}

/**
 * Lints one skill against every active host's naming and size limits. Returns one
 * human-readable violation message per problem found (empty array = clean).
 */
export function lintSkillPortability(input: SkillPortabilityInput): string[] {
  const violations: string[] = [];
  const { dirName, name, body, scripts = [] } = input;

  // --- Name rules -----------------------------------------------------------------
  if (name.length > CLAUDE_NAME_MAX) {
    violations.push(
      `Skill "${name}": name is ${name.length} chars, exceeding Claude Code's ${CLAUDE_NAME_MAX}-char limit.`
    );
  }
  if (!CLAUDE_NAME_REGEX.test(name)) {
    violations.push(
      `Skill "${name}": name must be lowercase letters, digits and hyphens only (Claude Code rule; e.g. "my-skill", not "My_Skill").`
    );
  }
  const lowerName = name.toLowerCase();
  for (const reserved of RESERVED_NAME_SUBSTRINGS) {
    if (lowerName.includes(reserved)) {
      violations.push(`Skill "${name}": name must not contain "${reserved}" (Claude Code reserved-word rule).`);
    }
  }
  if (name !== dirName) {
    violations.push(
      `Skill "${name}": frontmatter name does not match its directory name "${dirName}" (Cline requires them to be identical).`
    );
  }

  // --- Body size --------------------------------------------------------------------
  const lineCount = body.split('\n').length;
  if (lineCount > CLAUDE_BODY_LINE_LIMIT) {
    violations.push(
      `Skill "${name}": SKILL.md body is ${lineCount} lines, exceeding Claude Code's ~${CLAUDE_BODY_LINE_LIMIT}-line guidance. Split long material into references/.`
    );
  }
  const estimatedTokens = Math.ceil(body.length / CHARS_PER_TOKEN_ESTIMATE);
  if (estimatedTokens > CLINE_BODY_TOKEN_LIMIT) {
    violations.push(
      `Skill "${name}": SKILL.md body is an estimated ${estimatedTokens} tokens, exceeding Cline's ~${CLINE_BODY_TOKEN_LIMIT}-token guidance. Split long material into references/ or docs/.`
    );
  }

  // --- Scripts: no bash-only script without a cross-platform counterpart ------------
  const scriptBaseNames = new Set(
    scripts.map(s => s.relPath.replace(/\\/g, '/').split('/').pop() ?? '')
  );
  for (const script of scripts) {
    const isBashShebang = BASH_ONLY_SHEBANG.test(script.content.split('\n')[0] ?? '');
    const isBashSyntax = BASH_ONLY_SYNTAX.test(script.content);
    if (!isBashShebang && !isBashSyntax) continue;
    if (!script.relPath.endsWith('.sh')) continue; // only .sh carries the bash-only presumption

    const baseName = script.relPath.replace(/\\/g, '/').split('/').pop() ?? script.relPath;
    const stem = baseName.replace(/\.sh$/, '');
    const hasCounterpart = [...scriptBaseNames].some(
      other => other !== baseName && other.startsWith(`${stem}.`) && !other.endsWith('.sh')
    );
    if (!hasCounterpart) {
      violations.push(
        `Skill "${name}": ${script.relPath} uses a bash-only shebang or syntax with no cross-platform counterpart ` +
          `(e.g. a .ps1 or .py file with the same name). Windows has no bash by default; scripts must run on Windows and POSIX.`
      );
    }
  }

  return violations;
}

/** Antigravity rule-budget check (Objective 5, warn-only: it does not fail the build). */
const ANTIGRAVITY_RULE_FILE_BYTES = 24 * 1024;

export function warnOversizeAntigravityRule(relPath: string, content: string): string | undefined {
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > ANTIGRAVITY_RULE_FILE_BYTES) {
    return (
      `Rule "${relPath}" is ${bytes} bytes, exceeding Antigravity's ${ANTIGRAVITY_RULE_FILE_BYTES}-byte per-rule-file ` +
      `budget; Antigravity demotes oversize rules to pointers, so long guidance belongs in a referenced file instead.`
    );
  }
  return undefined;
}
