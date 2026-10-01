/**
 * Plan 032 / ADR 0025 — skill provenance recovery (deterministic; no LLM, no network beyond `git`).
 *
 * For every catalog skill this classifies its `metadata.source`, resolves third-party originals from
 * their GitHub repo (shallow blobless clone, sparse checkout of the one skill folder into a
 * quarantine directory), pins the commit, runs the security audit gate, and records which upstream
 * files the port dropped. Passing folders are snapshotted into `host-library/_upstream/<skill>/`.
 * It never writes into `registry/skills/`: restoring dropped extras needs adaptation, the licence
 * tier check (ADR 0024) and review, so it is reported, not applied.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { auditDirectory } from './audit.ts';
import type { AuditFinding, Verdict } from './audit.ts';

export type SourceKind = 'in-house' | 'github' | 'skills-sh' | 'vendor-site' | 'invalid';

export interface ParsedSource {
  kind: SourceKind;
  raw: string;
  owner?: string;
  repo?: string;
  /** Pinned commit found in a `/tree/<sha>/…` URL or `metadata.commit`. */
  sha?: string;
  /** Path inside the repo from a `/tree/<ref>/<path>` URL. */
  path?: string;
  /** Skill folder name from a skills.sh URL. */
  skill?: string;
}

/** Credited repository names that differ from the repository that actually holds the skill (verified with `git ls-remote`). */
export const REPO_ALIASES: Record<string, string> = {
  'GoogleChrome/devtools-mcp': 'ChromeDevTools/chrome-devtools-mcp',
  // `metadata.source` pairs this repo name with a SHA that belongs to huggingface/skills (the sibling hf-* skills use it).
  'huggingface/trl': 'huggingface/skills',
};

const IN_HOUSE = /github\.com\/NeoAnthropocene\/agents-united/i;
const SHA = /^[0-9a-f]{40}$/i;

export function parseSource(raw: string | undefined, commit?: string): ParsedSource {
  const value = (raw ?? '').trim();
  if (value === '' || IN_HOUSE.test(value)) return { kind: 'in-house', raw: value };
  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return { kind: 'invalid', raw: value };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'github.com' && parts.length >= 2) {
    const aliased = (REPO_ALIASES[`${parts[0]}/${parts[1].replace(/\.git$/, '')}`] ?? '').split('/');
    const parsed: ParsedSource = aliased.length === 2
      ? { kind: 'github', raw: value, owner: aliased[0], repo: aliased[1] }
      : { kind: 'github', raw: value, owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    if (parts[2] === 'tree' || parts[2] === 'blob') {
      const ref = parts[3];
      if (ref && SHA.test(ref)) parsed.sha = ref.toLowerCase();
      if (parts.length > 4) parsed.path = parts.slice(4).join('/');
    }
    if (!parsed.sha && commit && SHA.test(commit)) parsed.sha = commit.toLowerCase();
    return parsed;
  }
  if (host === 'skills.sh' && parts.length >= 3) {
    const aliased = (REPO_ALIASES[`${parts[0]}/${parts[1]}`] ?? '').split('/');
    return { kind: 'skills-sh', raw: value, owner: aliased.length === 2 ? aliased[0] : parts[0], repo: aliased.length === 2 ? aliased[1] : parts[1], skill: parts[2] };
  }
  return { kind: 'vendor-site', raw: value };
}

export interface CatalogSkill {
  name: string;
  dir: string;
  source?: string;
  commit?: string;
  license?: string;
  files: string[];
}

export function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs, base));
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out;
}

export function loadCatalog(skillsDir: string): CatalogSkill[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map(entry => {
      const dir = path.join(skillsDir, entry.name);
      const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let meta: { metadata?: Record<string, unknown> } = {};
      try {
        meta = (match ? YAML.parse(match[1]) : {}) as typeof meta;
      } catch {
        meta = {};
      }
      const metadata = meta.metadata ?? {};
      return {
        name: entry.name,
        dir,
        source: typeof metadata.source === 'string' ? metadata.source : undefined,
        commit: typeof metadata.commit === 'string' ? metadata.commit : undefined,
        license: typeof metadata.license === 'string' ? metadata.license : undefined,
        files: listFiles(dir).sort(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── git helpers (argument arrays only, never a shell) ────────────────────────────────────────

export function git(args: string[], cwd?: string, timeoutMs = 180_000): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
}

export interface RepoCache {
  dir: string;
  head: string;
  /** Every directory that holds a SKILL.md, repo-relative. */
  skillDirs: string[];
}

export function openRepo(cacheRoot: string, owner: string, repo: string, sha?: string): RepoCache {
  const dir = path.join(cacheRoot, `${owner}__${repo}${sha ? `__${sha.slice(0, 12)}` : ''}`);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    git(['init', '-q'], dir);
    git(['remote', 'add', 'origin', `https://github.com/${owner}/${repo}.git`], dir);
    git(['config', 'core.sparseCheckout', 'true'], dir);
    git(['config', 'remote.origin.promisor', 'true'], dir);
    git(['config', 'remote.origin.partialclonefilter', 'blob:none'], dir);
    git(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', sha ?? 'HEAD'], dir);
    git(['checkout', '-q', '--detach', 'FETCH_HEAD'], dir);
  }
  const head = git(['rev-parse', 'HEAD'], dir).trim();
  const skillDirs = git(['ls-tree', '-r', '--name-only', 'HEAD'], dir, 60_000)
    .split('\n')
    .filter(file => /(^|\/)SKILL\.md$/.test(file))
    .map(file => path.posix.dirname(file));
  return { dir, head, skillDirs };
}

export function findSkillDir(cache: RepoCache, skill: string, hintPath?: string): { dir?: string; ambiguous: string[]; fuzzy?: boolean } {
  if (hintPath) {
    const exact = cache.skillDirs.find(dir => hintPath === dir || hintPath.startsWith(`${dir}/`));
    if (exact) return { dir: exact, ambiguous: [] };
    // The hint may name the plugin/parent folder that contains the skill folder.
    const inside = cache.skillDirs.filter(dir => dir.startsWith(`${hintPath}/`)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const named = inside.find(dir => path.posix.basename(dir) === skill);
    if (named || inside.length > 0) {
      const chosen = named ?? inside[0];
      return { dir: chosen, ambiguous: inside.filter(dir => dir !== chosen), fuzzy: named === undefined };
    }
  }
  const matches = cache.skillDirs.filter(dir => path.posix.basename(dir) === skill).sort((a, b) => a.length - b.length || a.localeCompare(b));
  if (matches.length > 0) return { dir: matches[0], ambiguous: matches.slice(1) };
  // Upstream renames (git-guardrails -> git-guardrails-claude-code, postgres-best-practices ->
  // supabase-postgres-best-practices): accept a UNIQUE name relation, flagged for review.
  const related = cache.skillDirs.filter(dir => {
    const base = path.posix.basename(dir);
    return base.includes(skill) || skill.includes(base);
  });
  if (related.length === 1) return { dir: related[0], ambiguous: [], fuzzy: true };
  // A repo that publishes exactly one skill: it is the one, provided the catalog cites that repo.
  if (cache.skillDirs.length === 1) return { dir: cache.skillDirs[0], ambiguous: [], fuzzy: true };
  return { dir: undefined, ambiguous: related };
}

export function materialise(cache: RepoCache, repoRelDir: string, target: string): void {
  git(['sparse-checkout', 'set', '--no-cone', repoRelDir === '.' ? '/*' : `/${repoRelDir}/`], cache.dir);
  git(['checkout', '-q', '--detach', 'HEAD'], cache.dir);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(cache.dir, repoRelDir), target, { recursive: true, dereference: false });
}

// ── record shape ─────────────────────────────────────────────────────────────────────────────

export type Provenance = 'third-party-pinned' | 'in-house' | 'not-found';

export interface ResolvedLicenceRecord {
  spdx?: string;
  tier: 'permissive' | 'weak-copyleft' | 'share-alike' | 'blocked' | 'unknown';
  /** `licence-file` is the only evidence that makes a skill restorable. */
  evidence: 'licence-file' | 'frontmatter' | 'readme' | 'none';
  file?: string;
  copyright?: string;
  restorable: boolean;
  /** The owner accepted a frontmatter or README declaration that has no licence file behind it (MIT only). */
  ownerAcceptance?: { by: string; date: string; reason: string };
  resolvedAt: string;
}

export interface SkillRecord {
  skill: string;
  provenance: Provenance;
  source?: string;
  repo?: string;
  path?: string;
  sha?: string;
  /** `declared` = SHA came from the catalog; `recovered-head` = repo HEAD on the recovery date. */
  pinKind?: 'declared' | 'recovered-head';
  upstreamLicence?: string;
  declaredLicence?: string;
  audit?: { verdict: Verdict; findings: Array<Pick<AuditFinding, 'rule' | 'severity' | 'file' | 'line'>> };
  snapshot?: boolean;
  /** Upstream documents/data the catalog copy does not have yet (see `classifyExtra`: `content`). */
  droppedExtras?: string[];
  /** Upstream packaging files skipped on purpose (README, AGENTS.md, metadata.json, host agent configs, ...). */
  skippedExtras?: string[];
  /** Scripts and attribution assets: deferred to later PRs (audit gate + lintSkillPortability each). */
  deferredExtras?: string[];
  /** Date the last `hostlib:restore` copied content files for this skill. */
  restoredAt?: string;
  /** Upstream licence read from evidence at the pinned commit (`hostlib:licences`); never holds licence text. */
  resolvedLicence?: ResolvedLicenceRecord;
  ambiguousMatches?: string[];
  triedUrls?: string[];
  notes?: string[];
  recoveredAt: string;
}

const LICENCE_SIGNATURES: Array<[RegExp, string]> = [
  [/MIT License|Permission is hereby granted, free of charge/i, 'MIT'],
  [/Apache License[\s\S]{0,40}Version 2\.0/i, 'Apache-2.0'],
  [/Mozilla Public License[\s\S]{0,40}2\.0/i, 'MPL-2.0'],
  [/Attribution-ShareAlike 4\.0/i, 'CC-BY-SA-4.0'],
  [/Attribution 4\.0 International/i, 'CC-BY-4.0'],
  [/GNU (Affero )?General Public License/i, 'GPL-family'],
  [/GNU Lesser General Public License/i, 'LGPL'],
  [/NonCommercial/i, 'NonCommercial'],
  [/BSD [23]-Clause/i, 'BSD'],
  [/ISC License/i, 'ISC'],
  [/The Unlicense|public domain/i, 'Unlicense/CC0'],
];

/** The licence a licence-file's text looks like (first 6,000 characters), or undefined when it matches none. */
export function detectLicenceText(text: string): string | undefined {
  const head = text.slice(0, 6000);
  return LICENCE_SIGNATURES.find(([re]) => re.test(head))?.[1];
}

export function detectLicence(dir: string): string | undefined {
  const name = fs.existsSync(dir) ? fs.readdirSync(dir).find(file => /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i.test(file) && !/^notice/i.test(file)) : undefined;
  if (!name) return undefined;
  const text = fs.readFileSync(path.join(dir, name), 'utf8').slice(0, 6000);
  return LICENCE_SIGNATURES.find(([re]) => re.test(text))?.[1] ?? 'unrecognised';
}

const KEEP_LOCAL = new Set(['SKILL.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'NOTICE.md']);

export function droppedExtras(upstreamFiles: string[], localFiles: string[]): string[] {
  const local = new Set(localFiles);
  return upstreamFiles.filter(file => !local.has(file) && !KEEP_LOCAL.has(file) && !file.startsWith('.git')).sort();
}

export type ExtraKind = 'content' | 'packaging' | 'script' | 'asset';

const PACKAGING_ROOT_FILES = /^(readme|agents|claude|changelog|security|contributing|code_of_conduct)\.md$|^metadata\.json$/i;
const SCRIPT_EXT = /\.(sh|bash|ps1|py|js|mjs|cjs|ts)$/i;
const ASSET_EXT = /\.(svg|png|jpe?g|gif|webp|ico)$/i;

/**
 * Plan 032 PR D — what an upstream file is, for restore decisions. `content` (documents and data the
 * skill's instructions use) is restored; `packaging` (upstream repo scaffolding and host-specific agent
 * configs) is skipped on purpose; `script` and `asset` are deferred to their own PRs.
 */
export function classifyExtra(file: string): ExtraKind {
  if (!file.includes('/') && PACKAGING_ROOT_FILES.test(file)) return 'packaging';
  if (file.startsWith('agents/')) return 'packaging';
  // Underscore-prefixed files in a rule folder are upstream's own section and template scaffolding.
  if (/^(references|rules)\/_[^/]+$/.test(file)) return 'packaging';
  // Test fixtures belong to the scripts they exercise, so they are deferred with them.
  if (file.startsWith('scripts/') || SCRIPT_EXT.test(file) || /(^|\/)fixtures\//.test(file)) return 'script';
  if (file.startsWith('assets/') || ASSET_EXT.test(file)) return 'asset';
  return 'content';
}

export function partitionExtras(files: string[]): { content: string[]; skipped: string[]; deferred: string[] } {
  const out = { content: [] as string[], skipped: [] as string[], deferred: [] as string[] };
  for (const file of files) {
    const kind = classifyExtra(file);
    if (kind === 'content') out.content.push(file);
    else if (kind === 'packaging') out.skipped.push(file);
    else out.deferred.push(file);
  }
  return out;
}

/** SkillRecord fields for a list of missing upstream files, empty groups omitted. */
export function extrasFields(missing: string[]): Pick<SkillRecord, 'droppedExtras' | 'skippedExtras' | 'deferredExtras'> {
  const { content, skipped, deferred } = partitionExtras(missing);
  return {
    droppedExtras: content,
    ...(skipped.length > 0 ? { skippedExtras: skipped } : {}),
    ...(deferred.length > 0 ? { deferredExtras: deferred } : {}),
  };
}

export interface RecoverOptions {
  skillsDir: string;
  upstreamDir: string;
  cacheRoot: string;
  quarantineRoot: string;
  today: string;
  maxSnapshotBytes?: number;
  only?: string[];
  log?: (line: string) => void;
}

function dirSize(dir: string): number {
  return listFiles(dir).reduce((sum, file) => sum + fs.statSync(path.join(dir, file)).size, 0);
}

export function recover(options: RecoverOptions): SkillRecord[] {
  const log = options.log ?? (() => {});
  const max = options.maxSnapshotBytes ?? 2_000_000;
  const catalog = loadCatalog(options.skillsDir).filter(skill => !options.only || options.only.includes(skill.name));
  const repos = new Map<string, RepoCache | Error>();
  const records: SkillRecord[] = [];

  for (const skill of catalog) {
    const parsed = parseSource(skill.source, skill.commit);
    const base: SkillRecord = { skill: skill.name, provenance: 'in-house', source: skill.source, declaredLicence: skill.license, recoveredAt: options.today };
    if (parsed.kind === 'in-house') {
      records.push(base);
      continue;
    }
    const repoRef = parsed.kind === 'github' || parsed.kind === 'skills-sh' ? { owner: parsed.owner!, repo: parsed.repo! } : undefined;
    if (!repoRef) {
      records.push({ ...base, provenance: 'not-found', triedUrls: [parsed.raw], notes: [parsed.kind === 'vendor-site' ? 'source is not a code repository' : 'source URL could not be parsed'] });
      continue;
    }
    const key = `${repoRef.owner}/${repoRef.repo}#${parsed.sha ?? 'HEAD'}`;
    if (!repos.has(key)) {
      try {
        log(`clone ${key}`);
        repos.set(key, openRepo(options.cacheRoot, repoRef.owner, repoRef.repo, parsed.sha));
      } catch (error) {
        repos.set(key, error instanceof Error ? error : new Error(String(error)));
      }
    }
    const cache = repos.get(key)!;
    const tried = [`https://github.com/${repoRef.owner}/${repoRef.repo}${parsed.sha ? `/tree/${parsed.sha}` : ''}`];
    if (parsed.kind === 'skills-sh') tried.unshift(parsed.raw);
    if (cache instanceof Error) {
      records.push({ ...base, provenance: 'not-found', triedUrls: tried, notes: [`clone failed: ${cache.message.split('\n')[0].slice(0, 120)}`] });
      continue;
    }
    const found = findSkillDir(cache, parsed.skill ?? skill.name, parsed.path);
    if (!found.dir) {
      records.push({ ...base, provenance: 'not-found', repo: `${repoRef.owner}/${repoRef.repo}`, sha: cache.head, triedUrls: tried, notes: [`no SKILL.md folder named "${parsed.skill ?? skill.name}" among ${cache.skillDirs.length} skill folders`] });
      continue;
    }
    const quarantine = path.join(options.quarantineRoot, skill.name);
    materialise(cache, found.dir, quarantine);
    const audit = auditDirectory(quarantine, { mode: 'skill' });
    const upstreamFiles = listFiles(quarantine).sort();
    const record: SkillRecord = {
      ...base,
      provenance: 'third-party-pinned',
      repo: `${repoRef.owner}/${repoRef.repo}`,
      path: found.dir,
      sha: cache.head,
      pinKind: parsed.sha ? 'declared' : 'recovered-head',
      upstreamLicence: detectLicence(quarantine),
      audit: { verdict: audit.verdict, findings: audit.findings.map(f => ({ rule: f.rule, severity: f.severity, file: f.file, line: f.line })) },
      ...extrasFields(droppedExtras(upstreamFiles, skill.files)),
      ambiguousMatches: found.ambiguous.length > 0 ? found.ambiguous : undefined,
      recoveredAt: options.today,
    };
    const notes: string[] = [];
    if (found.fuzzy) notes.push(`matched by name relation or parent path (${found.dir}); confirm it is the same skill before restoring extras`);
    if (audit.verdict !== 'pass') notes.push(`security audit ${audit.verdict}: not snapshotted; keep the current version until reviewed`);
    else if (dirSize(quarantine) > max) notes.push(`upstream folder over ${max} bytes: pinned but not snapshotted`);
    else {
      const target = path.join(options.upstreamDir, skill.name);
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(quarantine, target, { recursive: true, dereference: false });
      record.snapshot = true;
    }
    if (record.upstreamLicence && skill.license && !record.upstreamLicence.toLowerCase().includes(skill.license.toLowerCase().split('-')[0])) {
      notes.push(`licence mismatch: catalog says ${skill.license}, upstream file looks like ${record.upstreamLicence}`);
    }
    if (notes.length > 0) record.notes = notes;
    records.push(record);
  }
  return records;
}
