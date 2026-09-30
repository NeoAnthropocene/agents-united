/**
 * Plan 032 / ADR 0025 — shared types for the host docs library (`host-library/<host>/`).
 * Maintainer tooling only: never imported by `src/` and never shipped in the npm package.
 */

export const ARTIFACT_TYPES = [
  'agent',
  'skill',
  'hook',
  'mcp',
  'plugin',
  'rule',
  'command',
  'permissions',
  'settings',
  'tools',
  'orchestration',
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface SourcePage {
  url: string;
  /** File name under `pages/<artifactType>/` (without `.md`). */
  slug: string;
}

export interface SourceIndex {
  url: string;
  role: 'primary' | 'secondary';
  /** Snapshot file name relative to the host directory (e.g. `llms.txt`). */
  snapshot: string;
}

export interface AuditAllowEntry {
  /** Snapshot path relative to the host directory. */
  file: string;
  rule: string;
  reason: string;
}

export interface HostSources {
  host: string;
  label: string;
  indexes: SourceIndex[];
  changelog: { url: string; snapshot: string };
  pages: Partial<Record<ArtifactType, SourcePage[]>>;
  /** Changelog keyword (case-insensitive regex source) lists per artifact type. */
  keywords: Partial<Record<ArtifactType, string[]>>;
  /** Hostnames the refresh must reach (documents the routine network policy). */
  domains: string[];
  auditAllow?: AuditAllowEntry[];
}

export interface LockFileEntry {
  url: string;
  sha256: string;
  fetchedAt: string;
  /** `http` for the refresh script; anything else names the ingest channel (e.g. `firecrawl-mcp`). */
  via: string;
}

export interface HostLock {
  host: string;
  files: Record<string, LockFileEntry>;
  changelog: {
    /** Latest version seen per changelog section (`""` = unsectioned changelog). */
    lastSeen: Record<string, string>;
    checkedAt?: string;
  };
}

export interface ChangelogEntry {
  /** Enclosing product section (`## Antigravity CLI`), or `""` for flat changelogs. */
  section: string;
  version: string;
  /** Optional release title (the heading that follows a bare version heading). */
  title: string;
  body: string;
}

export interface IndexLink {
  title: string;
  url: string;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
}

export type Fetcher = (url: string) => Promise<FetchResult>;
