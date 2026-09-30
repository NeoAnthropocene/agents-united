/**
 * Plan 032 — changelog parsing for the changelog-first host-update workflow.
 *
 * Supported shapes (all newest-first):
 * - flat:      `## 2.1.285` (Claude Code), `## [4.1.22]` (Cline, Keep-a-Changelog);
 * - sectioned: `## Antigravity CLI` product sections containing
 *              `### [v2.18.1](/releases?…)` version headings, each optionally followed by a
 *              title heading (`### Manage & Install plugins in AGY`).
 */
import type { ArtifactType, ChangelogEntry } from './types.ts';

const HEADING = /^(#{2,3})\s+(.*?)\s*$/;
/** A heading whose leading token is a version: `2.1.285`, `[4.1.22]`, `[v2.18.1](url "t")`. */
const VERSION_HEADING = /^\[?v?(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)\]?(?:\([^)]*\))?(?:\s*[-–—:]\s*(.*))?$/;

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  // Flat changelogs put versions at level 2 (any other `##` inside them is body text, e.g. a stray
  // `## Added`); sectioned ones nest versions at level 3 under `## <Product>` sections.
  const versionLevels = lines.flatMap(line => {
    const heading = line.match(HEADING);
    return heading && VERSION_HEADING.test(heading[2]) ? [heading[1].length] : [];
  });
  const flat = versionLevels.filter(level => level === 2).length >= versionLevels.length / 2;
  const entries: ChangelogEntry[] = [];
  let section = '';
  let current: ChangelogEntry | null = null;
  let body: string[] = [];
  let expectTitle = false;
  let versionLevel = 0;

  const flush = (): void => {
    if (current) {
      current.body = body.join('\n').trim();
      entries.push(current);
    }
    current = null;
    body = [];
  };

  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const version = text.match(VERSION_HEADING);
      if (version) {
        flush();
        current = { section, version: version[1], title: (version[2] ?? '').trim(), body: '' };
        versionLevel = level;
        // Only a sibling heading (same level) can be a release title; deeper headings such as
        // Keep-a-Changelog's `### Added` under `## [4.1.22]` are body content.
        expectTitle = current.title === '';
        continue;
      }
      if (level === 2 && !flat) {
        // A non-version level-2 heading opens a product section (sectioned changelogs).
        flush();
        section = text;
        expectTitle = false;
        continue;
      }
      if (current && expectTitle && level === versionLevel) {
        current.title = text;
        expectTitle = false;
        continue;
      }
    }
    if (current) {
      if (expectTitle && line.trim() !== '' && !/^(latest|[a-z]+ \d{1,2}, \d{4})$/i.test(line.trim())) {
        expectTitle = false;
      }
      body.push(line);
    }
  }
  flush();
  return entries;
}

export function sectionsOf(entries: ChangelogEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.section))];
}

/** The newest version per section — what a refresh records as "seen". */
export function latestPerSection(entries: ChangelogEntry[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const entry of entries) {
    if (!(entry.section in latest)) latest[entry.section] = entry.version;
  }
  return latest;
}

export interface NewEntriesResult {
  entries: ChangelogEntry[];
  /** Sections whose recorded last-seen version no longer appears (baseline lost → capped scan). */
  lostBaselines: string[];
}

/**
 * Entries newer than the recorded last-seen version of their section. Changelogs are newest-first,
 * so everything above the last-seen entry is new. A section without a baseline contributes nothing
 * on the very first run (the seed records the baseline); a section whose baseline vanished
 * contributes at most `cap` entries and is reported.
 */
export function newEntriesSince(
  entries: ChangelogEntry[],
  lastSeen: Record<string, string>,
  cap = 20,
): NewEntriesResult {
  const result: ChangelogEntry[] = [];
  const lostBaselines: string[] = [];
  for (const section of sectionsOf(entries)) {
    const inSection = entries.filter(entry => entry.section === section);
    if (!(section in lastSeen)) {
      // New section appeared since the last check: its entries are all new (capped).
      if (Object.keys(lastSeen).length > 0) result.push(...inSection.slice(0, cap));
      continue;
    }
    const index = inSection.findIndex(entry => entry.version === lastSeen[section]);
    if (index === -1) {
      lostBaselines.push(section);
      result.push(...inSection.slice(0, cap));
      continue;
    }
    result.push(...inSection.slice(0, index));
  }
  return { entries: result, lostBaselines };
}

/** Map a changelog entry to the artifact types its text mentions (keyword map from sources.json). */
export function classifyEntry(
  entry: ChangelogEntry,
  keywords: Partial<Record<ArtifactType, string[]>>,
): ArtifactType[] {
  const text = `${entry.title}\n${entry.body}`;
  const types: ArtifactType[] = [];
  for (const [type, patterns] of Object.entries(keywords) as Array<[ArtifactType, string[]]>) {
    if (patterns.some(pattern => new RegExp(pattern, 'i').test(text))) types.push(type);
  }
  return types.sort();
}
