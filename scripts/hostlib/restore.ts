/**
 * Plan 032 PR D — restore the documents a port dropped, from the pinned upstream snapshot in
 * `host-library/_upstream/<skill>/` into `registry/skills/<skill>/`, one bundle at a time.
 *
 * Guarded by the intake rules (docs/skill-intake.md, ADR 0024): only a third-party pinned skill with a
 * declared, classified licence, a passing audit and an upstream snapshot; the skill folder must already
 * carry `LICENSE` and `NOTICE.md`. Only `content` files are copied (docs and data); packaging is skipped
 * on purpose and scripts/assets are deferred (`classifyExtra`). Every copy is verbatim behind an
 * attribution header, so verification can strip the header and compare byte for byte.
 */
import fs from 'node:fs';
import path from 'node:path';
import { classifyLicence } from '../../src/core/skill-licence-lint.ts';
import { partitionExtras } from './provenance.ts';
import type { SkillRecord } from './provenance.ts';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const MARKER = 'Restored verbatim from';

/**
 * The per-file header names the upstream file and points at `NOTICE.md` (which pins repository, path and
 * commit) and `LICENSE`. It deliberately carries no repository URL: the audit gate flags any HTML comment
 * containing words such as "agent", which upstream repository names often do.
 */
function headerLines(file: string): string[] {
  const depth = file.split('/').length - 1;
  const up = '../'.repeat(depth);
  return [`${MARKER} upstream ${file} (repository and commit pinned in ${up}NOTICE.md).`, `Licence: see ${up}LICENSE.`];
}

/** `content` with an attribution header: an HTML comment after markdown frontmatter, `#` lines for YAML. */
export function attributionHeader(file: string, content: string): string {
  const lines = headerLines(file);
  if (/\.md$/i.test(file)) {
    // One line, and free of words the audit gate reads as addressing the agent.
    const comment = `<!-- ${lines[0]} ${lines[1]} -->\n`;
    const front = FRONTMATTER.exec(content);
    // One added blank line after the comment in both cases, so the strip is exact.
    if (front) return `${front[0]}${comment}\n${content.slice(front[0].length)}`;
    return `${comment}\n${content}`;
  }
  if (/\.ya?ml$/i.test(file)) return `${lines.map(line => `# ${line}`).join('\n')}\n${content}`;
  throw new Error(`${file} cannot carry an inline attribution (only .md and .yaml/.yml); record it in NOTICE.md instead.`);
}

/** Inverse of `attributionHeader`: the upstream bytes. Returns `content` unchanged when there is no header. */
export function stripAttributionHeader(file: string, content: string): string {
  if (/\.md$/i.test(file)) {
    const front = FRONTMATTER.exec(content);
    const head = front ? front[0] : '';
    const rest = content.slice(head.length);
    const match = /^<!-- Restored verbatim from [^\n]*-->\n\n/.exec(rest);
    return match ? head + rest.slice(match[0].length) : content;
  }
  if (/\.ya?ml$/i.test(file)) {
    const match = /^# Restored verbatim from [^\n]*\n# Licence: [^\n]*\n/.exec(content);
    return match ? content.slice(match[0].length) : content;
  }
  return content;
}

export interface RestoreOptions {
  skillsDir: string;
  upstreamDir: string;
  record: SkillRecord;
}

export interface RestoreResult {
  restored: string[];
  skipped: string[];
  deferred: string[];
}

function refuse(skill: string, why: string): never {
  throw new Error(`Refusing to restore ${skill}: ${why}.`);
}

export function restoreExtras(options: RestoreOptions): RestoreResult {
  const { record } = options;
  const skill = record.skill;
  if (record.provenance !== 'third-party-pinned') refuse(skill, 'not a third-party pinned skill');
  if (!record.sha || !record.repo || !record.path) refuse(skill, 'no pinned commit (repo, path and sha are required)');
  // The licence is the one the catalog declares, or else the one resolved from a licence file at the pinned commit
  // (`hostlib:licences`). A README or frontmatter statement is not enough: there is no licence text to carry.
  const resolved = record.resolvedLicence;
  if (!record.declaredLicence && !resolved) refuse(skill, 'no declared licence, so its intake tier is unknown');
  if (!record.declaredLicence && resolved && resolved.evidence !== 'licence-file') {
    const label = resolved.evidence === 'readme' ? 'README' : resolved.evidence;
    refuse(skill, `licence evidence is only a ${label} statement, not a licence file`);
  }
  const tier = record.declaredLicence ? classifyLicence(record.declaredLicence) : resolved!.tier;
  if (tier === 'blocked' || tier === 'unknown') refuse(skill, `licence tier "${tier}" (${record.declaredLicence ?? resolved!.spdx ?? 'unrecognised'})`);
  if (record.audit?.verdict !== 'pass') refuse(skill, `audit verdict "${record.audit?.verdict ?? 'none'}"`);
  if (record.snapshot !== true) refuse(skill, 'no upstream snapshot');

  const skillDir = path.join(options.skillsDir, skill);
  for (const required of ['LICENSE', 'NOTICE.md']) {
    if (!fs.existsSync(path.join(skillDir, required))) refuse(skill, `${required} is missing: add LICENSE and NOTICE.md first`);
  }

  const { content, skipped, deferred } = partitionExtras(record.droppedExtras ?? []);
  const snapshot = path.join(options.upstreamDir, skill);
  const plan = content.map(file => {
    const from = path.join(snapshot, ...file.split('/'));
    if (!fs.existsSync(from)) refuse(skill, `${file} is not in the snapshot`);
    return { file, text: attributionHeader(file, fs.readFileSync(from, 'utf8').replace(/\r\n/g, '\n')) };
  });
  // Every file resolved and attributed before the first write: a refusal never leaves a half-restored folder.
  for (const { file, text } of plan) {
    const to = path.join(skillDir, ...file.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, text);
  }
  return { restored: content, skipped, deferred };
}
