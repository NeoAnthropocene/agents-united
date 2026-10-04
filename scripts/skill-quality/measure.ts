/**
 * Plan 035 S1, the skill quality measure (ADR 0040).
 *
 * A "templated" skill is one whose body is mostly lines that other skills also carry once the
 * skill's own name is taken out. The measure is deterministic and has no network or model step:
 *
 *   share(skill) = content lines found in the frozen boilerplate corpus / content lines
 *
 * The corpus (`tests/fixtures/skill-boilerplate-corpus.txt`) is frozen at the audit, so a rewrite
 * of one skill can never move the score of another. Regenerate it only by an ADR, never to make
 * a skill pass.
 *
 * CLI: `node scripts/skill-quality/measure.ts report [--bundle <name>]` prints the table,
 *      `node scripts/skill-quality/measure.ts corpus` prints the corpus the catalog yields now.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const TEMPLATED_THRESHOLD = 0.3;
export const STUB_MAX_LINES = 30;
/** A line must carry this many words after normalisation to count (short lines are structure). */
const MIN_WORDS = 3;
/** A normalised line is boilerplate when this many skills carry it. */
export const CORPUS_MIN_SKILLS = 3;

export interface SkillMeasure {
  name: string;
  /** Content lines of the body (after the front matter, without headings, fences, blanks). */
  lines: number;
  /** Lines found in the frozen corpus. */
  templatedLines: number;
  share: number;
  /** Files in the skill folder other than SKILL.md (references, scripts, assets). */
  extraFiles: number;
  /** `metadata.source` is declared: the skill is adapted from an upstream, not written here. */
  thirdParty: boolean;
}

export type SkillVerdict = 'ok' | 'templated' | 'stub';

export function stripFrontMatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function nameForms(name: string): string[] {
  const spaced = name.replace(/-/g, ' ');
  return [spaced, spaced.replace(/ /g, '')];
}

/** One normalised, name-independent form of a body line, or null when the line is structure. */
export function normaliseLine(raw: string, skillName: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('```') || /^\|[\s|:-]+\|?$/.test(trimmed)) return null;
  let line = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const form of nameForms(skillName)) line = line.split(form).join('@');
  if (line.split(' ').filter(Boolean).length < MIN_WORDS) return null;
  return line;
}

export function contentLines(content: string, skillName: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const raw of stripFrontMatter(content).split(/\r?\n/)) {
    if (raw.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const line = normaliseLine(raw, skillName);
    if (line !== null) out.push(line);
  }
  return out;
}

export function listSkills(skillsDir: string): string[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

function readSkill(skillsDir: string, name: string): string {
  return fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
}

/** The corpus the catalog yields now: lines carried by CORPUS_MIN_SKILLS or more skills. */
export function buildCorpus(skillsDir: string): string[] {
  const seen = new Map<string, number>();
  for (const name of listSkills(skillsDir)) {
    for (const line of new Set(contentLines(readSkill(skillsDir, name), name))) seen.set(line, (seen.get(line) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, n]) => n >= CORPUS_MIN_SKILLS)
    .map(([l]) => l)
    .sort();
}

export function loadCorpus(corpusFile: string): Set<string> {
  return new Set(fs.readFileSync(corpusFile, 'utf8').split(/\r?\n/).filter((l) => l !== ''));
}

function countExtraFiles(dir: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countExtraFiles(p);
    else if (e.name !== 'SKILL.md') n += 1;
  }
  return n;
}

/** A declared `metadata.source` that is not this repository: the skill is adapted from an upstream. */
function isThirdPartySource(frontMatter: string): boolean {
  const source = frontMatter.match(/^\s+source:\s*(\S+)/m)?.[1];
  return source !== undefined && !/NeoAnthropocene\/agents-united/i.test(source);
}

export function measureSkill(skillsDir: string, name: string, corpus: Set<string>): SkillMeasure {
  const content = readSkill(skillsDir, name);
  const lines = contentLines(content, name);
  const templatedLines = lines.filter((l) => corpus.has(l)).length;
  const frontMatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  return {
    name,
    lines: lines.length,
    templatedLines,
    share: lines.length === 0 ? 0 : templatedLines / lines.length,
    extraFiles: countExtraFiles(path.join(skillsDir, name)),
    thirdParty: isThirdPartySource(frontMatter),
  };
}

/** Workflow skills (ADR 0016) are phase scripts and short by design: only the templated rule applies. */
export function isWorkflowSkill(name: string): boolean {
  return name.startsWith('workflow-');
}

export function verdictOf(m: SkillMeasure): SkillVerdict {
  if (m.share >= TEMPLATED_THRESHOLD) return 'templated';
  if (!isWorkflowSkill(m.name) && !m.thirdParty && m.extraFiles === 0 && m.lines < STUB_MAX_LINES) return 'stub';
  return 'ok';
}

export function measureAll(skillsDir: string, corpus: Set<string>): SkillMeasure[] {
  return listSkills(skillsDir).map((n) => measureSkill(skillsDir, n, corpus));
}

function main(argv: string[]): void {
  const root = process.cwd();
  const skillsDir = path.join(root, 'registry', 'skills');
  const [cmd, ...rest] = argv;
  if (cmd === 'corpus') {
    process.stdout.write(buildCorpus(skillsDir).join('\n') + '\n');
    return;
  }
  if (cmd === 'report') {
    const bundleName = rest[rest.indexOf('--bundle') + 1];
    const corpus = loadCorpus(path.join(root, 'tests', 'fixtures', 'skill-boilerplate-corpus.txt'));
    let names: string[] | undefined;
    if (rest.includes('--bundle')) {
      const bundles = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'bundles.json'), 'utf8')).bundles;
      names = bundles[bundleName]?.skills;
      if (!names) throw new Error(`unknown bundle ${bundleName}`);
    }
    const rows = measureAll(skillsDir, corpus).filter((m) => !names || names.includes(m.name));
    rows.sort((a, b) => b.share - a.share);
    for (const m of rows) {
      console.log(`${m.share.toFixed(2)}\t${verdictOf(m)}\t${m.lines}\t${m.extraFiles}\t${m.thirdParty ? 'third-party' : 'in-house'}\t${m.name}`);
    }
    return;
  }
  console.error('usage: measure.ts corpus | report [--bundle <name>]');
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
