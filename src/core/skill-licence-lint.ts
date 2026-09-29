/**
 * Plan 030 Objective A — licence lint for skills (sibling of `skill-portability-lint.ts`).
 *
 * Enforces the tiered intake rule in `docs/skill-intake.md` §1 and ADR 0024:
 * - Permissive (MIT, Apache-2.0, BSD, ISC, CC-BY, public domain): may be vendored.
 * - Weak copyleft (MPL-2.0) and share-alike (CC-BY-SA-4.0): may be vendored only when the
 *   skill folder carries the licence file, a `NOTICE.md` changes note, and a
 *   `metadata.source` pinned to a 40-character commit SHA. The folder stays under that
 *   licence; the rest of the repository stays MIT.
 * - Blocked (any NonCommercial or NoDerivatives term, GPL/AGPL/LGPL): never vendored.
 *
 * The lint reads only the `metadata.license` identifier, so an identifier it cannot place in
 * a tier is itself a violation: a new licence must be classified here before a skill using
 * it can ship.
 */

export type LicenceTier = 'permissive' | 'weak-copyleft' | 'share-alike' | 'blocked' | 'unknown';

const PERMISSIVE = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC-BY-4.0',
  'CC0-1.0',
  'Unlicense',
]);
const WEAK_COPYLEFT = new Set(['MPL-2.0']);
const SHARE_ALIKE = new Set(['CC-BY-SA-4.0']);
const BLOCKED_PATTERN = /(^|-)(NC|ND)(-|$)|^A?GPL|^LGPL/i;

/** Classifies an SPDX licence identifier into its intake tier. */
export function classifyLicence(id: string): LicenceTier {
  const trimmed = id.trim();
  if (BLOCKED_PATTERN.test(trimmed)) return 'blocked';
  if (PERMISSIVE.has(trimmed)) return 'permissive';
  if (WEAK_COPYLEFT.has(trimmed)) return 'weak-copyleft';
  if (SHARE_ALIKE.has(trimmed)) return 'share-alike';
  return 'unknown';
}

export interface SkillLicenceInput {
  /** The skill's directory name, used in messages. */
  dirName: string;
  /** `metadata.license` from SKILL.md frontmatter; absent for original skills that omit it. */
  license?: string;
  /** `metadata.source` from SKILL.md frontmatter. */
  source?: string;
  /** Every file in the skill folder, as paths relative to it (e.g. "LICENSE", "references/x.md"). */
  files: string[];
}

const SHA_40 = /\b[0-9a-f]{40}\b/;

/** Returns one human-readable violation per problem (empty array = clean). */
export function lintSkillLicence(input: SkillLicenceInput): string[] {
  const { dirName, license, source, files } = input;
  if (license === undefined) return [];

  const violations: string[] = [];
  const tier = classifyLicence(license);
  if (tier === 'blocked') {
    violations.push(
      `Skill "${dirName}": licence "${license}" is blocked (NonCommercial, NoDerivatives or GPL-family) and may not be vendored.`
    );
    return violations;
  }
  if (tier === 'unknown') {
    violations.push(
      `Skill "${dirName}": licence "${license}" is not an SPDX identifier this catalog has classified; add it to src/core/skill-licence-lint.ts first.`
    );
    return violations;
  }
  if (tier === 'permissive') return violations;

  const topLevel = files.map(f => f.replace(/\\/g, '/')).filter(f => !f.includes('/'));
  if (!topLevel.some(f => /^LICEN[CS]E(\.(md|txt))?$/i.test(f))) {
    violations.push(`Skill "${dirName}": ${license} content must carry its licence file (LICENSE) in the skill folder.`);
  }
  if (!topLevel.includes('NOTICE.md')) {
    violations.push(`Skill "${dirName}": ${license} content must carry a NOTICE.md saying what was changed from upstream.`);
  }
  if (!source || !SHA_40.test(source)) {
    violations.push(`Skill "${dirName}": ${license} content must pin metadata.source to a 40-character upstream commit SHA.`);
  }
  return violations;
}
