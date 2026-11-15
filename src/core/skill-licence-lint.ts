/**
 * Plan 030 Objective A — licence lint for skills (sibling of `skill-portability-lint.ts`).
 *
 * Enforces the tiered intake rule in `docs/skill-intake.md` §1 and ADR 0024:
 * - Permissive (MIT, Apache-2.0, BSD, ISC, CC-BY, public domain): may be vendored.
 * - Weak copyleft (MPL-2.0), share-alike (CC-BY-SA-4.0) and custom source-available licences
 *   (represented as `LicenseRef-*`): may be vendored only when the skill folder carries the
 *   licence file, a `NOTICE.md` changes note, and a `metadata.source` pinned to a 40-character
 *   commit SHA. The folder stays under that licence; the rest of the repository stays MIT.
 * - Blocked (any NonCommercial or NoDerivatives term, GPL/AGPL/LGPL): never vendored.
 *
 * The lint reads only the `metadata.license` identifier, so an identifier it cannot place in
 * a tier is itself a violation: a new licence must be classified here before a skill using
 * it can ship. A source-available tier is only for an explicitly optional add-on whose users
 * receive and accept the upstream terms; it never reclassifies that content as MIT.
 */

export type LicenceTier = 'permissive' | 'weak-copyleft' | 'share-alike' | 'source-available' | 'blocked' | 'unknown';

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
const SOURCE_AVAILABLE = new Set(['LicenseRef-Remotion']);
const BLOCKED_PATTERN = /(^|-)(NC|ND)(-|$)|^A?GPL|^LGPL/i;

/** Classifies an SPDX licence identifier into its intake tier. */
export function classifyLicence(id: string): LicenceTier {
  const trimmed = id.trim();
  if (BLOCKED_PATTERN.test(trimmed)) return 'blocked';
  if (PERMISSIVE.has(trimmed)) return 'permissive';
  if (WEAK_COPYLEFT.has(trimmed)) return 'weak-copyleft';
  if (SHARE_ALIKE.has(trimmed)) return 'share-alike';
  if (SOURCE_AVAILABLE.has(trimmed)) return 'source-available';
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

/**
 * The licence rules of the two new authorship policies of `agents skill-check` (Plan 033 P9:
 * `private-owner`, an original Skill by another author, and `adapted-source`, a Skill adapted
 * from a pinned upstream commit). Pure like `lintSkillLicence`: the caller supplies the front
 * matter identifiers, the file inventory with byte sizes, and the text of a top-level NOTICE.md.
 *
 * Both policies require a declared, classified licence: a missing `license`, a blocked tier or
 * an unknown identifier is refused with `lintSkillLicence`'s own wording. `private-owner` accepts
 * every classified tier except `source-available` (which only ever fits an upstream vendor's
 * optional add-on) and asks a weak-copyleft or share-alike folder to carry its licence file.
 * An adapted Skill always carries the upstream licence file and a SHA-pinned source; whenever
 * its licence is not exactly `MIT`, it also carries a NOTICE.md naming that SHA and the licence.
 */
export function lintSkillPolicyLicence(policy: 'private-owner' | 'adapted-source',
  input: { dirName: string; license?: string; source?: string; files: Array<{ path: string; bytes: number }>; noticeText?: string }): string[] {
  const { dirName, license, source, files, noticeText } = input;
  if (license === undefined) {
    return [`Skill "${dirName}": metadata.license is missing; the ${policy} policy needs a declared licence identifier.`];
  }
  const tier = classifyLicence(license);
  if (tier === 'blocked' || tier === 'unknown') {
    return lintSkillLicence({ dirName, license, source, files: files.map(f => f.path) });
  }
  /** Top-level files only; a path may come with `\` separators on Windows candidates. */
  const top = files.filter(f => !f.path.replace(/\\/g, '/').includes('/'));
  const carriesLicence = top.some(f => f.bytes > 0 && /^LICEN[CS]E(\.(md|txt))?$/i.test(f.path.replace(/\\/g, '/')));
  const notice = top.find(f => f.path.replace(/\\/g, '/') === 'NOTICE.md');
  if (policy === 'private-owner') {
    if (tier === 'source-available') {
      return [`Skill "${dirName}": licence "${license}" is source-available (an upstream vendor's optional add-on tier) and is refused for a privately owned original skill.`];
    }
    if ((tier === 'weak-copyleft' || tier === 'share-alike') && !carriesLicence) {
      return [`Skill "${dirName}": ${license} content must carry its licence file (LICENSE) in the skill folder.`];
    }
    return [];
  }
  const violations: string[] = [];
  if (!carriesLicence) {
    violations.push(`Skill "${dirName}": ${license} content must carry its licence file (LICENSE) in the skill folder.`);
  }
  const sha = SHA_40.exec(source ?? '');
  if (sha === null) {
    violations.push(`Skill "${dirName}": ${license} content must pin metadata.source to a 40-character upstream commit SHA.`);
  }
  if (license !== 'MIT') {
    if (notice === undefined || notice.bytes === 0) {
      violations.push(`Skill "${dirName}": ${license} content must carry a NOTICE.md saying what was changed from upstream.`);
    } else if (typeof noticeText !== 'string') {
      violations.push(`Skill "${dirName}": NOTICE.md is present but no notice text was supplied, so what it says cannot be checked.`);
    } else {
      if (sha !== null && !noticeText.includes(sha[0])) {
        violations.push(`Skill "${dirName}": NOTICE.md does not quote the pinned 40-character commit SHA of metadata.source.`);
      }
      if (!noticeText.includes(license)) {
        violations.push(`Skill "${dirName}": NOTICE.md does not name the licence identifier "${license}".`);
      }
    }
  }
  return violations;
}
