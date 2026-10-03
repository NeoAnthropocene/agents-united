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

/**
 * A reference text that ships inside the host (for example a bundled skill) and has no URL. It is captured through the
 * host itself and ingested with `hostlib:ingest`; `refresh` never fetches it.
 */
export interface BundledSource {
  /** File name under `pages/<artifactType>/` (without `.md`). */
  slug: string;
  /** What the text is and where it ships, recorded in the lockfile. */
  origin: string;
  /** How a maintainer reproduces the capture. */
  capture: string;
  /** First host version that ships the text. */
  since: string;
}

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

/**
 * A host's GitHub release stream used as a changelog source (for hosts that release several products from one repository
 * and keep notes only on GitHub releases). Rendered into a sectioned changelog by `github-releases.ts`.
 */
export interface ReleaseSource {
  /** `owner/name`. */
  repo: string;
  /** Tag prefix that selects one product's releases and is stripped to leave the version. */
  tagPrefix: string;
  /** Changelog section the releases are filed under; also the key of the recorded baseline. */
  section: string;
  /** Snapshot file name relative to the host directory (the rendered changelog). */
  snapshot: string;
  /** API pages of 100 releases to read (1 to 5, default 1). */
  pages?: number;
}

/**
 * A host binary's own changelog used as a changelog source (Antigravity: `agy changelog`, which is free and ahead of the docs). The
 * binary is looked up on PATH by its bare name and run with these fixed arguments and no shell; a machine without it skips the source.
 */
export interface CommandSource {
  /** Bare executable name (no path, no shell syntax). */
  command: string;
  /** Fixed arguments, each a plain token. */
  args: string[];
  /** Changelog section the output is filed under; also the key of the recorded baseline. */
  section: string;
  /** Snapshot file name relative to the host directory (the rendered changelog). */
  snapshot: string;
  /** How the output is read. */
  format: 'agy-changelog';
}

export interface HostSources {
  host: string;
  label: string;
  indexes: SourceIndex[];
  changelog: { url: string; snapshot: string };
  /** GitHub release streams followed in addition to the markdown changelog (optional). */
  releases?: ReleaseSource[];
  /** Host binaries whose changelog output is followed in addition (optional). */
  commands?: CommandSource[];
  pages: Partial<Record<ArtifactType, SourcePage[]>>;
  /** Reference text bundled inside the host, per artifact type (optional). */
  bundled?: Partial<Record<ArtifactType, BundledSource[]>>;
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
