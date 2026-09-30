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
import { droppedExtras, listFiles, partitionExtras } from './provenance.ts';
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
  // No file name: it is the file's own path, and names such as page-object-model or file-upload-download contain words
  // the audit gate reads as addressing the agent.
  return [`${MARKER} upstream (repository and commit pinned in ${up}NOTICE.md).`, `Licence: see ${up}LICENSE.`];
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
  /** ISO date recorded in NOTICE.md; defaults to today. */
  today?: string;
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
  if (content.length > 0) recordRestoreInNotice(skillDir, content, options.today ?? new Date().toISOString().slice(0, 10));
  return { restored: content, skipped, deferred };
}


const NOTICE_HEADING = '## Restored documents (Plan 032 PR D)';
const NOTICE_SECTION = /\n## Restored documents \(Plan 032 PR D\)[\s\S]*?(?=\n## |$)/;

/**
 * Adds (or replaces) the "Restored documents" section of a skill's NOTICE.md: how many upstream documents were
 * copied, into which folders, and when. Everything else in NOTICE.md is left as it is.
 */
export function recordRestoreInNotice(skillDir: string, restored: readonly string[], today: string): void {
  const file = path.join(skillDir, 'NOTICE.md');
  if (!fs.existsSync(file)) throw new Error(`Cannot record the restore: ${file} (NOTICE.md) does not exist.`);
  const folders = new Map<string, number>();
  for (const rel of restored) {
    const folder = rel.includes('/') ? `${rel.split('/')[0]}/` : '(skill root)';
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
  }
  const summary = [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, count]) => `\`${folder}\` (${count})`)
    .join(', ');
  const noun = restored.length === 1 ? 'document' : 'documents';
  const verb = restored.length === 1 ? 'was' : 'were';
  const block =
    `${NOTICE_HEADING}\n\n` +
    `${restored.length} upstream ${noun} ${verb} restored verbatim on ${today} from the pinned snapshot in ` +
    `\`host-library/_upstream/${path.basename(skillDir)}/\`: ${summary}. Each starts with (or, for markdown with ` +
    'frontmatter, has right after the frontmatter) a one-line comment pointing here; nothing in them was edited. ' +
    'Upstream packaging, scripts and attribution marks were not restored.\n';
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const next = NOTICE_SECTION.test(text) ? text.replace(NOTICE_SECTION, `\n${block}`) : `${text.endsWith('\n') ? text : `${text}\n`}\n${block}`;
  fs.writeFileSync(file, next);
}

const PLAIN_TEXT = /\.(md|markdown|txt|ya?ml|json|sarif)$/i;
const normaliseName = (file: string): string => file.toLowerCase().replace(/[_\s]+/g, '-');
const LEADING_COMMENT = /^((?:---\n[\s\S]*?\n---\n)?)<!--[\s\S]*?-->\n*/;

/** Leading attribution comment and blank lines removed, line endings unified: what a file says, not how it was headed. */
function normaliseForMatch(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(LEADING_COMMENT, '$1').trim();
}

/**
 * Upstream files the skill folder lacks, after allowing for a port that only renamed or moved a file: a match by
 * case/separator-normalised path or file name counts as present, and so does a local file whose content is identical
 * once its attribution comment is ignored. Keeps the provenance lists to work that is really left.
 */
export function missingUpstreamFiles(upstreamDir: string, skillDir: string): string[] {
  const localFiles = listFiles(skillDir);
  const missing = droppedExtras(listFiles(upstreamDir), localFiles);
  if (missing.length === 0) return [];
  const names = new Set(localFiles.map(normaliseName));
  const bases = new Set(localFiles.map(file => normaliseName(path.posix.basename(file))));
  let localTexts: Set<string> | undefined;
  const texts = (): Set<string> => {
    localTexts ??= new Set(
      localFiles.filter(file => PLAIN_TEXT.test(file)).map(file => normaliseForMatch(fs.readFileSync(path.join(skillDir, ...file.split('/')), 'utf8'))),
    );
    return localTexts;
  };
  return missing.filter(file => {
    if (names.has(normaliseName(file)) || bases.has(normaliseName(path.posix.basename(file)))) return false;
    if (!PLAIN_TEXT.test(file)) return true;
    return !texts().has(normaliseForMatch(fs.readFileSync(path.join(upstreamDir, ...file.split('/')), 'utf8')));
  });
}
