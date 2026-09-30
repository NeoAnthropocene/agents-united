/**
 * Plan 032 PR D follow-up — resolve the upstream licence of third-party skills that have none declared.
 *
 * Evidence, strongest first, read at the pinned commit: a licence file (nearest the skill, then each parent
 * folder up to the repository root), a `license:` field in the skill's own frontmatter, a README licence
 * section. Only a licence file makes a skill restorable: the restore step must copy real licence text into the
 * skill folder (docs/skill-intake.md step 1, ADR 0024). Results are recorded without the licence text.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { classifyLicence } from '../../src/core/skill-licence-lint.ts';
import { detectLicenceText, git } from './provenance.ts';
import type { ResolvedLicenceRecord, SkillRecord } from './provenance.ts';

export interface RepoReader {
  /** Names (not paths) of the entries directly inside `dir` (`.` or `` for the repository root). */
  listDir(dir: string): string[];
  /** File content at the pinned commit, or undefined when absent. */
  read(rel: string): string | undefined;
}

export interface ResolvedLicence extends Omit<ResolvedLicenceRecord, 'resolvedAt'> {
  /** The licence file's full text; present only for `licence-file` evidence and never persisted. */
  text?: string;
}

const LICENCE_FILE = /^(licen[cs]e|copying)(\.[a-z]+)?$/i;
const COPYRIGHT_LINE = /^\s*(Copyright\b.*|\(c\)\s.*)$/im;
/** Labels `detectLicenceText` returns that the lint's SPDX table does not know, mapped to a tier. */
const BLOCKED_LABELS = new Set(['NonCommercial', 'GPL-family', 'LGPL']);

function join(dir: string, name: string): string {
  return dir === '.' || dir === '' ? name : `${dir}/${name}`;
}

/** Licence-like files from the skill folder up to the repository root, nearest first. */
export function licenceCandidates(reader: RepoReader, skillPath: string): string[] {
  const parts = skillPath === '.' || skillPath === '' ? [] : skillPath.split('/');
  const found: string[] = [];
  for (let depth = parts.length; depth >= 0; depth -= 1) {
    const dir = parts.slice(0, depth).join('/') || '.';
    for (const name of reader.listDir(dir).sort()) if (LICENCE_FILE.test(name)) found.push(join(dir, name));
  }
  return found;
}

function tierOf(spdx: string | undefined): ResolvedLicence['tier'] {
  if (!spdx) return 'unknown';
  if (BLOCKED_LABELS.has(spdx)) return 'blocked';
  return classifyLicence(spdx);
}

function finish(partial: Omit<ResolvedLicence, 'tier' | 'restorable'>): ResolvedLicence {
  const tier = tierOf(partial.spdx);
  return { ...partial, tier, restorable: partial.evidence === 'licence-file' && (tier === 'permissive' || tier === 'weak-copyleft' || tier === 'share-alike') };
}

/** An SPDX id from a one-line statement such as "MIT" or "Apache License 2.0", or undefined. */
function spdxFromStatement(text: string): string | undefined {
  if (/\bMIT\b/.test(text)) return 'MIT';
  if (/Apache[- ]?(License)?[- ]?(v)?2(\.0)?/i.test(text)) return 'Apache-2.0';
  if (/\bISC\b/.test(text)) return 'ISC';
  if (/BSD[- ]3/i.test(text)) return 'BSD-3-Clause';
  if (/BSD[- ]2/i.test(text)) return 'BSD-2-Clause';
  return undefined;
}

function frontmatterLicence(text: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return undefined;
  try {
    const meta = YAML.parse(match[1]) as { license?: unknown; metadata?: { license?: unknown } } | null;
    const value = meta?.license ?? meta?.metadata?.license;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function resolveLicence(reader: RepoReader, skillPath: string): ResolvedLicence {
  const [nearest] = licenceCandidates(reader, skillPath);
  if (nearest) {
    const text = reader.read(nearest) ?? '';
    return finish({ spdx: detectLicenceText(text), evidence: 'licence-file', file: nearest, copyright: COPYRIGHT_LINE.exec(text)?.[1].trim(), text });
  }
  const skillMd = join(skillPath, 'SKILL.md');
  const fm = frontmatterLicence(reader.read(skillMd) ?? '');
  if (fm) return finish({ spdx: fm, evidence: 'frontmatter', file: skillMd });
  const readme = reader.read('README.md') ?? '';
  const section = /^#{1,3}\s*licen[cs]e\b[^\n]*\n+([\s\S]{0,300})/im.exec(readme);
  const fromReadme = section ? spdxFromStatement(section[1]) : undefined;
  if (fromReadme) return finish({ spdx: fromReadme, evidence: 'readme', file: 'README.md' });
  return finish({ evidence: 'none' });
}

/** Adds (or replaces) `metadata.license` in SKILL.md frontmatter, keeping everything else and the line endings. */
export function withLicenceMetadata(skillMd: string, spdx: string): string {
  const nl = skillMd.includes('\r\n') ? '\r\n' : '\n';
  const lines = skillMd.split(/\r?\n/);
  if (lines[0] !== '---') throw new Error('SKILL.md has no frontmatter.');
  const close = lines.indexOf('---', 1);
  if (close === -1) throw new Error('SKILL.md frontmatter is not closed.');
  const meta = lines.findIndex((line, index) => index > 0 && index < close && /^metadata:\s*$/.test(line));
  if (meta === -1) {
    lines.splice(close, 0, 'metadata:', `  license: ${spdx}`);
    return lines.join(nl);
  }
  let last = meta;
  for (let index = meta + 1; index < close && /^\s+\S/.test(lines[index]); index += 1) last = index;
  const existing = lines.findIndex((line, index) => index > meta && index <= last && /^\s+license:/.test(line));
  if (existing !== -1) lines[existing] = `  license: ${spdx}`;
  else lines.splice(last + 1, 0, `  license: ${spdx}`);
  return lines.join(nl);
}

export interface ApplyOptions {
  skillsDir: string;
  record: SkillRecord;
  resolution: ResolvedLicence;
  today: string;
}

const EVIDENCE_LABEL = { readme: 'a README statement', frontmatter: 'a frontmatter statement' } as const;

function terms(spdx: string): string {
  if (spdx === 'MIT') {
    return 'MIT permits use, copying and modification provided the copyright and permission notice travel with copies. `LICENSE` is that notice. New files written for agents-united in this folder (`SKILL.md`, this `NOTICE.md`) are released under MIT as well, like the rest of the repository.';
  }
  if (spdx === 'Apache-2.0') {
    return 'Apache-2.0 permits use, reproduction and distribution of the work and of derivative works, provided the licence text travels with them, changed files carry a statement of change and attribution notices are kept. `LICENSE` is the licence text. The upstream repository shipped no NOTICE file at the pinned commit. The rest of agents-united stays MIT.';
  }
  return `\`LICENSE\` carries the ${spdx} text; its terms apply to this folder.`;
}

/**
 * Materialises a licence-file resolution in the skill folder: `LICENSE` (upstream text), `NOTICE.md` (source,
 * pinned commit, terms, what changed) and `metadata.license`. Refuses unless the evidence is a licence file in an
 * allowed tier, and writes nothing in that case.
 */
export function applyResolvedLicence(options: ApplyOptions): void {
  const { record, resolution } = options;
  const skill = record.skill;
  if (resolution.evidence === 'none') throw new Error(`Refusing to apply a licence to ${skill}: no licence evidence.`);
  if (resolution.evidence !== 'licence-file') {
    throw new Error(`Refusing to apply a licence to ${skill}: the only evidence is ${EVIDENCE_LABEL[resolution.evidence]}, not a licence file.`);
  }
  if (!resolution.restorable || !resolution.spdx || resolution.text === undefined) {
    throw new Error(`Refusing to apply a licence to ${skill}: licence tier "${resolution.tier}"${resolution.spdx ? ` (${resolution.spdx})` : ''}.`);
  }
  const dir = path.join(options.skillsDir, skill);
  const skillMdPath = path.join(dir, 'SKILL.md');
  const skillMd = fs.readFileSync(skillMdPath, 'utf8');
  const url = `https://github.com/${record.repo}`;
  const pin =
    record.pinKind === 'recovered-head'
      ? `Pinned commit: \`${record.sha}\` — the repository HEAD on ${options.today} (recovered, see \`host-library/_upstream/skills.json\`). It is the state at which the licence was read, not necessarily the revision this skill was ported from.`
      : `Pinned commit: \`${record.sha}\`.`;
  const notice = `# NOTICE — \`${skill}\`

## Source

- Upstream: [${record.repo}](${url})
- Upstream path: [\`${record.path}\`](${url}/tree/${record.sha}/${record.path})
- ${pin}
- Licence: **${resolution.spdx}**${resolution.copyright ? ` (${resolution.copyright})` : ''}, read from \`${resolution.file}\` at the pinned commit. The full text is in \`LICENSE\` in this folder.

## Licence terms for this folder

${terms(resolution.spdx)}

## What changed

- \`SKILL.md\` was written for agents-united in this catalog's runbook format (PROJECT.md §7.2); it is not a copy of the upstream \`SKILL.md\`.
- \`LICENSE\`, this \`NOTICE.md\` and \`metadata.license\` were added on ${options.today} (Plan 032, licence resolution). No upstream documents were restored by that step.
`;
  fs.writeFileSync(path.join(dir, 'LICENSE'), resolution.text.endsWith('\n') ? resolution.text : `${resolution.text}\n`);
  fs.writeFileSync(path.join(dir, 'NOTICE.md'), notice);
  fs.writeFileSync(skillMdPath, withLicenceMetadata(skillMd, resolution.spdx));
}

/**
 * Fetches one commit without checking it out (a blobless, depth-1 fetch into a per-commit cache) and reads files
 * straight from git objects. A checkout is unnecessary for licence evidence and fails on Windows for repositories
 * with very long paths.
 */
export function openPinnedReader(cacheRoot: string, owner: string, repo: string, sha: string): RepoReader {
  const dir = path.join(cacheRoot, `lic__${owner}__${repo}__${sha.slice(0, 12)}`);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    git(['init', '-q'], dir);
    git(['remote', 'add', 'origin', `https://github.com/${owner}/${repo}.git`], dir);
    git(['config', 'remote.origin.promisor', 'true'], dir);
    git(['config', 'remote.origin.partialclonefilter', 'blob:none'], dir);
    git(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', sha], dir);
  }
  return {
    listDir: entryDir => {
      const args = ['ls-tree', '--name-only', sha];
      if (entryDir !== '.' && entryDir !== '') args.push(`${entryDir}/`);
      try {
        return git(args, dir, 60_000)
          .split('\n')
          .filter(Boolean)
          .map(entry => path.posix.basename(entry));
      } catch {
        return [];
      }
    },
    read: rel => {
      try {
        return git(['show', `${sha}:${rel}`], dir, 60_000);
      } catch {
        return undefined;
      }
    },
  };
}

/** The persisted form of a resolution: no licence text. */
export function toRecord(resolution: ResolvedLicence, today: string): ResolvedLicenceRecord {
  const { text: _text, ...rest } = resolution;
  void _text;
  return { ...rest, resolvedAt: today };
}
