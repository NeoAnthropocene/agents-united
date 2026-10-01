/**
 * Plan 032 / ADR 0025 decisions 4–5 — the host docs library: load/validate `sources.json`,
 * changelog-first change detection (`check`), and snapshot refresh/ingest with the docs audit
 * gate. Pure file + fetch operations; the fetcher is injectable so tests never touch the network.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { auditDocument } from './audit.ts';
import type { AuditFinding } from './audit.ts';
import { classifyEntry, latestPerSection, newEntriesSince, parseChangelog } from './changelog.ts';
import { diffIndex, parseIndex } from './llms-index.ts';
import { ARTIFACT_TYPES } from './types.ts';
import type {
  ArtifactType,
  ChangelogEntry,
  FetchResult,
  Fetcher,
  HostLock,
  HostSources,
  IndexLink,
} from './types.ts';

const artifactType = z.enum(ARTIFACT_TYPES);
const url = z.string().url();

const SourcesSchema = z
  .object({
    host: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    indexes: z
      .array(z.object({ url, role: z.enum(['primary', 'secondary']), snapshot: z.string().regex(/^[\w.-]+$/) }))
      .min(1),
    changelog: z.object({ url, snapshot: z.string().regex(/^[\w.-]+$/) }),
    pages: z.record(artifactType, z.array(z.object({ url, slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/) })).min(1)),
    bundled: z
      .record(
        artifactType,
        z
          .array(
            z.object({
              slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
              origin: z.string().min(1),
              capture: z.string().min(1),
              since: z.string().regex(/^\d+\.\d+\.\d+$/, 'since must be a x.y.z version'),
            }),
          )
          .min(1),
      )
      .optional(),
    keywords: z.record(artifactType, z.array(z.string().min(1)).min(1)),
    domains: z.array(z.string().min(1)).min(1),
    auditAllow: z.array(z.object({ file: z.string(), rule: z.string(), reason: z.string().min(1) })).optional(),
  })
  .strict();

export function validateSources(raw: unknown, where = 'sources.json'): HostSources {
  const parsed = SourcesSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
    throw new Error(`Host library sources invalid (${where}): ${detail}`);
  }
  const sources = parsed.data as HostSources;
  for (const pattern of Object.values(sources.keywords).flat()) {
    try {
      new RegExp(pattern ?? '', 'i');
    } catch {
      throw new Error(`Host library sources invalid (${where}): keyword "${pattern}" is not a valid regex.`);
    }
  }
  const slugs = new Set<string>();
  for (const [type, pages] of Object.entries(sources.pages)) {
    for (const page of pages ?? []) {
      const key = `${type}/${page.slug}`;
      if (slugs.has(key)) throw new Error(`Host library sources invalid (${where}): duplicate page slug ${key}.`);
      slugs.add(key);
      const host = new URL(page.url).hostname;
      if (!sources.domains.includes(host)) {
        throw new Error(`Host library sources invalid (${where}): page ${page.url} is outside declared domains.`);
      }
    }
  }
  for (const [type, entries] of Object.entries(sources.bundled ?? {})) {
    for (const entry of entries ?? []) {
      const key = `${type}/${entry.slug}`;
      if (slugs.has(key)) throw new Error(`Host library sources invalid (${where}): duplicate page slug ${key}.`);
      slugs.add(key);
    }
  }
  for (const entry of [...sources.indexes, sources.changelog]) {
    if (!sources.domains.includes(new URL(entry.url).hostname)) {
      throw new Error(`Host library sources invalid (${where}): ${entry.url} is outside declared domains.`);
    }
  }
  return sources;
}

export function listHosts(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && fs.existsSync(path.join(root, entry.name, 'sources.json')))
    .map(entry => entry.name)
    .sort();
}

export function loadSources(hostDir: string): HostSources {
  const file = path.join(hostDir, 'sources.json');
  return validateSources(JSON.parse(fs.readFileSync(file, 'utf8')), file);
}

export function emptyLock(host: string): HostLock {
  return { host, files: {}, changelog: { lastSeen: {} } };
}

export function loadLock(hostDir: string, host: string): HostLock {
  const file = path.join(hostDir, 'library.lock.json');
  if (!fs.existsSync(file)) return emptyLock(host);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as HostLock;
}

/** Stable JSON: sorted object keys, 2-space indent, trailing newline — diffable in PRs. */
export function stableJson(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.keys(input as Record<string, unknown>)
          .sort()
          .map(key => [key, sort((input as Record<string, unknown>)[key])]),
      );
    }
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function saveLock(hostDir: string, lock: HostLock): void {
  fs.writeFileSync(path.join(hostDir, 'library.lock.json'), stableJson(lock));
}

export function sha256(text: string): string {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

export function pagePath(type: ArtifactType, slug: string): string {
  return `pages/${type}/${slug}.md`;
}

/** Normalise fetched text so unchanged pages hash identically (line endings + trailing space). */
export function normalise(text: string): string {
  return `${text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}

export const httpFetcher: Fetcher = async (target: string): Promise<FetchResult> => {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: { accept: 'text/markdown, text/plain;q=0.9, */*;q=0.5', 'user-agent': 'agents-united-hostlib' },
      });
      const text = await response.text();
      if (response.ok) return { ok: true, status: response.status, text };
      lastError = `HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) return { ok: false, status: response.status, text: '', error: lastError };
    } catch (error) {
      lastError = error instanceof Error ? `${error.message}${error.cause ? ` (${String((error.cause as { code?: string }).code ?? error.cause)})` : ''}` : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  return { ok: false, status: 0, text: '', error: lastError };
};

// ── check ────────────────────────────────────────────────────────────────────────────────────

export interface ClassifiedEntry extends Pick<ChangelogEntry, 'section' | 'version' | 'title'> {
  types: ArtifactType[];
}

export interface HostCheckReport {
  host: string;
  label: string;
  reachable: boolean;
  errors: string[];
  changelog: {
    url: string;
    newEntries: ClassifiedEntry[];
    lostBaselines: string[];
    latest: Record<string, string>;
  };
  indexes: Array<{ url: string; added: IndexLink[]; removed: IndexLink[] }>;
  affectedTypes: ArtifactType[];
  affectedPages: string[];
  hasChanges: boolean;
}

/** Changelog-first detection. Read-only: writes nothing. */
export async function checkHost(hostDir: string, fetcher: Fetcher): Promise<HostCheckReport> {
  const sources = loadSources(hostDir);
  const lock = loadLock(hostDir, sources.host);
  const errors: string[] = [];

  const report: HostCheckReport = {
    host: sources.host,
    label: sources.label,
    reachable: true,
    errors,
    changelog: { url: sources.changelog.url, newEntries: [], lostBaselines: [], latest: {} },
    indexes: [],
    affectedTypes: [],
    affectedPages: [],
    hasChanges: false,
  };

  const changelog = await fetcher(sources.changelog.url);
  if (!changelog.ok) {
    errors.push(`changelog ${sources.changelog.url}: ${changelog.error ?? `HTTP ${changelog.status}`}`);
    report.reachable = false;
  } else {
    const entries = parseChangelog(changelog.text);
    report.changelog.latest = latestPerSection(entries);
    const fresh = newEntriesSince(entries, lock.changelog.lastSeen);
    report.changelog.lostBaselines = fresh.lostBaselines;
    report.changelog.newEntries = fresh.entries.map(entry => ({
      section: entry.section,
      version: entry.version,
      title: entry.title,
      types: classifyEntry(entry, sources.keywords),
    }));
  }

  for (const index of sources.indexes) {
    const fetched = await fetcher(index.url);
    if (!fetched.ok) {
      errors.push(`index ${index.url}: ${fetched.error ?? `HTTP ${fetched.status}`}`);
      report.reachable = false;
      continue;
    }
    const snapshotFile = path.join(hostDir, index.snapshot);
    const previous = fs.existsSync(snapshotFile) ? parseIndex(fs.readFileSync(snapshotFile, 'utf8')) : [];
    const diff = diffIndex(previous, parseIndex(fetched.text));
    if (previous.length === 0) {
      report.indexes.push({ url: index.url, added: [], removed: [] });
    } else {
      report.indexes.push({ url: index.url, ...diff });
    }
  }

  const types = new Set<ArtifactType>();
  for (const entry of report.changelog.newEntries) entry.types.forEach(type => types.add(type));
  report.affectedTypes = [...types].sort();
  report.affectedPages = report.affectedTypes.flatMap(type =>
    (sources.pages[type] ?? []).map(page => pagePath(type, page.slug)),
  );
  report.hasChanges =
    report.changelog.newEntries.length > 0 ||
    report.changelog.lostBaselines.length > 0 ||
    report.indexes.some(index => index.added.length > 0 || index.removed.length > 0);
  return report;
}

// ── refresh / ingest ─────────────────────────────────────────────────────────────────────────

export interface RefreshOptions {
  /** Artifact types whose curated pages are refreshed. */
  types?: ArtifactType[];
  /** Refresh every curated page. */
  all?: boolean;
  /** Record the current newest changelog versions as seen (after the plan is written). */
  advanceChangelog?: boolean;
  now?: () => Date;
}

export interface SnapshotOutcome {
  file: string;
  url: string;
  status: 'created' | 'updated' | 'unchanged' | 'blocked' | 'failed';
  detail?: string;
  findings?: AuditFinding[];
}

export interface RefreshReport {
  host: string;
  outcomes: SnapshotOutcome[];
  lastSeen: Record<string, string>;
}

function writeSnapshot(
  hostDir: string,
  sources: HostSources,
  lock: HostLock,
  rel: string,
  sourceUrl: string,
  rawText: string,
  via: string,
  now: Date,
): SnapshotOutcome {
  const text = normalise(rawText);
  const audit = auditDocument(text, rel, sources.auditAllow ?? []);
  if (audit.verdict === 'fail') {
    return { file: rel, url: sourceUrl, status: 'blocked', detail: 'docs audit gate', findings: audit.findings };
  }
  const hash = sha256(text);
  const abs = path.join(hostDir, rel);
  const existed = fs.existsSync(abs);
  if (existed && lock.files[rel]?.sha256 === hash && normalise(fs.readFileSync(abs, 'utf8')) === text) {
    return { file: rel, url: sourceUrl, status: 'unchanged', findings: audit.findings };
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  lock.files[rel] = { url: sourceUrl, sha256: hash, fetchedAt: now.toISOString(), via };
  return { file: rel, url: sourceUrl, status: existed ? 'updated' : 'created', findings: audit.findings };
}

export async function refreshHost(hostDir: string, fetcher: Fetcher, options: RefreshOptions = {}): Promise<RefreshReport> {
  const sources = loadSources(hostDir);
  const lock = loadLock(hostDir, sources.host);
  const now = (options.now ?? (() => new Date()))();
  const outcomes: SnapshotOutcome[] = [];

  const targets: Array<{ rel: string; url: string }> = [
    ...sources.indexes.map(index => ({ rel: index.snapshot, url: index.url })),
    { rel: sources.changelog.snapshot, url: sources.changelog.url },
  ];
  const wanted = options.all ? (Object.keys(sources.pages) as ArtifactType[]) : options.types ?? [];
  for (const type of wanted) {
    for (const page of sources.pages[type] ?? []) targets.push({ rel: pagePath(type, page.slug), url: page.url });
  }

  let changelogText: string | undefined;
  for (const target of targets) {
    const fetched = await fetcher(target.url);
    if (!fetched.ok) {
      outcomes.push({ file: target.rel, url: target.url, status: 'failed', detail: fetched.error ?? `HTTP ${fetched.status}` });
      continue;
    }
    const outcome = writeSnapshot(hostDir, sources, lock, target.rel, target.url, fetched.text, 'http', now);
    outcomes.push(outcome);
    if (target.rel === sources.changelog.snapshot && outcome.status !== 'blocked') changelogText = fetched.text;
  }

  if (options.advanceChangelog && changelogText !== undefined) {
    lock.changelog.lastSeen = latestPerSection(parseChangelog(changelogText));
  }
  lock.changelog.checkedAt = now.toISOString();
  saveLock(hostDir, lock);
  return { host: sources.host, outcomes, lastSeen: lock.changelog.lastSeen };
}

/**
 * Ingest a document fetched through another channel (e.g. an MCP scraper when the environment's
 * network policy blocks the host). It passes the same docs audit gate and is recorded with its
 * channel in `via`. `rel` must be a snapshot path declared by `sources.json`.
 */
export function ingestSnapshot(
  hostDir: string,
  rel: string,
  text: string,
  via: string,
  options: { advanceChangelog?: boolean; now?: () => Date } = {},
): SnapshotOutcome {
  const sources = loadSources(hostDir);
  const lock = loadLock(hostDir, sources.host);
  const declared = new Map<string, string>([
    ...sources.indexes.map(index => [index.snapshot, index.url] as [string, string]),
    [sources.changelog.snapshot, sources.changelog.url],
    ...(Object.entries(sources.pages) as Array<[ArtifactType, Array<{ url: string; slug: string }>]>).flatMap(([type, pages]) =>
      pages.map(page => [pagePath(type, page.slug), page.url] as [string, string]),
    ),
    ...(Object.entries(sources.bundled ?? {}) as Array<[ArtifactType, Array<{ slug: string; origin: string }>]>).flatMap(([type, entries]) =>
      entries.map(entry => [pagePath(type, entry.slug), `bundled:${entry.origin}`] as [string, string]),
    ),
  ]);
  const sourceUrl = declared.get(rel);
  if (!sourceUrl) throw new Error(`ingest: ${rel} is not a snapshot declared in ${sources.host}/sources.json`);
  const now = (options.now ?? (() => new Date()))();
  const outcome = writeSnapshot(hostDir, sources, lock, rel, sourceUrl, text, via, now);
  if (outcome.status !== 'blocked' && rel === sources.changelog.snapshot && options.advanceChangelog) {
    lock.changelog.lastSeen = latestPerSection(parseChangelog(text));
    lock.changelog.checkedAt = now.toISOString();
  }
  if (outcome.status !== 'blocked') saveLock(hostDir, lock);
  return outcome;
}

/** Snapshot integrity: every lock entry's file exists and still hashes to the recorded value. */
export function verifyLock(hostDir: string): string[] {
  const sources = loadSources(hostDir);
  const lock = loadLock(hostDir, sources.host);
  const problems: string[] = [];
  for (const [rel, entry] of Object.entries(lock.files)) {
    const abs = path.join(hostDir, rel);
    if (!fs.existsSync(abs)) {
      problems.push(`${sources.host}/${rel}: recorded in lock but missing on disk`);
      continue;
    }
    // Hash modulo line endings: a Windows checkout with core.autocrlf must not read as tampering.
    if (sha256(normalise(fs.readFileSync(abs, 'utf8'))) !== entry.sha256) problems.push(`${sources.host}/${rel}: hash drift (edited by hand?)`);
  }
  return problems;
}
