/**
 * Plan 032 — candidate scan: a read-only look at a repository that might be the upstream of catalog skills.
 *
 * The provenance recovery (`provenance.ts`) only follows a skill's DECLARED `metadata.source`; a skill that declares none
 * is recorded "in-house" without anyone looking for a same-named upstream. This scan opens a candidate repository, audits
 * each of its skills in quarantine (the same gate as ingest), and reports which of them share a name with a catalog skill
 * and how much of their text that skill carries. It writes a report and changes no skill and no provenance record: an
 * adoption is a separate, reviewed step (docs/skill-intake.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { auditDirectory } from './audit.ts';
import { git, listFiles, loadCatalog, materialise, openRepo, partitionExtras } from './provenance.ts';
import type { CatalogSkill } from './provenance.ts';

export interface LineOverlap {
  upstreamLines: number;
  localLines: number;
  shared: number;
  /** Share of the upstream lines the local text also contains, 0..1 to two decimals. */
  upstreamInLocal: number;
}

const stripFrontmatter = (text: string): string => text.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '');
const lineSet = (text: string): Set<string> =>
  new Set(
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
  );

/** How much of `upstream` the `local` text carries, comparing distinct trimmed non-blank lines. */
export function lineOverlap(upstream: string, local: string): LineOverlap {
  const up = lineSet(upstream);
  const lo = lineSet(local);
  let shared = 0;
  for (const line of up) if (lo.has(line)) shared++;
  return {
    upstreamLines: up.size,
    localLines: lo.size,
    shared,
    upstreamInLocal: up.size === 0 ? 0 : Math.round((shared / up.size) * 100) / 100,
  };
}

export interface CandidateRecord {
  name: string;
  /** Repo-relative folder of the skill. */
  path: string;
  /** The catalog skill with the same name, if any. */
  collidesWith?: string;
  /** Overlap of the two SKILL.md bodies; only for a name collision. */
  overlap?: LineOverlap;
  files: string[];
  extras: { content: string[]; skipped: string[]; deferred: string[] };
  bytes: number;
  licenceFile?: string;
  audit: { verdict: string; findings: Array<{ rule: string; severity: string; file: string; line: number }> };
}

const LICENCE_FILE = /^licen[cs]e(\.md|\.txt)?$/i;

export function describeCandidate(input: { name: string; repoPath: string; dir: string; local?: Pick<CatalogSkill, 'name' | 'dir'> }): CandidateRecord {
  const files = listFiles(input.dir).sort();
  const report = auditDirectory(input.dir, { mode: 'skill' });
  const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(input.dir, ...file.split('/'))).size, 0);
  const record: CandidateRecord = {
    name: input.name,
    path: input.repoPath,
    files,
    extras: partitionExtras(files.filter(file => file !== 'SKILL.md' && !LICENCE_FILE.test(file))),
    bytes,
    licenceFile: files.find(file => !file.includes('/') && LICENCE_FILE.test(file)),
    audit: { verdict: report.verdict, findings: report.findings.map(f => ({ rule: f.rule, severity: f.severity, file: f.file, line: f.line })) },
  };
  if (input.local) {
    record.collidesWith = input.local.name;
    const upstreamText = stripFrontmatter(fs.readFileSync(path.join(input.dir, 'SKILL.md'), 'utf8'));
    const localText = stripFrontmatter(fs.readFileSync(path.join(input.local.dir, 'SKILL.md'), 'utf8'));
    record.overlap = lineOverlap(upstreamText, localText);
  }
  return record;
}

export interface CandidateReport {
  schema: 1;
  repo: string;
  sha: string;
  scannedAt: string;
  /** The repository's own licence text head, when it has a root licence file. */
  repoLicence?: { file: string; firstLines: string[] };
  skills: CandidateRecord[];
}

export interface ScanOptions {
  owner: string;
  repo: string;
  sha?: string;
  skillsDir: string;
  cacheRoot: string;
  quarantineRoot: string;
  today: string;
  log?: (line: string) => void;
}

/** Opens the repository (blobless, depth 1), audits every skill folder in quarantine and describes it. */
export function scanCandidateRepo(options: ScanOptions): CandidateReport {
  const log = options.log ?? (() => {});
  const catalog = new Map(loadCatalog(options.skillsDir).map(skill => [skill.name, skill]));
  log(`open ${options.owner}/${options.repo}`);
  const cache = openRepo(options.cacheRoot, options.owner, options.repo, options.sha);

  let repoLicence: CandidateReport['repoLicence'];
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']) {
    try {
      const text = git(['show', `HEAD:${name}`], cache.dir, 60_000);
      repoLicence = { file: name, firstLines: text.replace(/\r\n/g, '\n').split('\n').filter(Boolean).slice(0, 3) };
      break;
    } catch {
      continue;
    }
  }

  const skills: CandidateRecord[] = [];
  for (const repoPath of [...cache.skillDirs].sort()) {
    const name = path.posix.basename(repoPath);
    const quarantine = path.join(options.quarantineRoot, `${options.owner}__${options.repo}`, name);
    log(`audit ${repoPath}`);
    materialise(cache, repoPath, quarantine);
    skills.push(describeCandidate({ name, repoPath, dir: quarantine, local: catalog.get(name) }));
  }
  return { schema: 1, repo: `${options.owner}/${options.repo}`, sha: cache.head, scannedAt: options.today, repoLicence, skills };
}
