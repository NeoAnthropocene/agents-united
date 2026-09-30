import { describe, expect, it } from 'vitest';
import { classifyEntry, latestPerSection, newEntriesSince, parseChangelog } from '../scripts/hostlib/changelog.ts';
import { diffIndex, parseIndex } from '../scripts/hostlib/llms-index.ts';

const CLAUDE = `# Changelog

## 2.1.285

- Added \`CLAUDE_CODE_DISABLE_WEB_FETCH\` to turn off the WebFetch tool
- Fixed hooks firing twice

## 2.1.284

- Added \`claude plugin configure\`
`;

const CLINE = `# Changelog

## [4.1.22]

### Added

- New providers

## [4.1.21]

### Fixed

- Subagents no longer hang

## [3.44.0]

## Added

- stray legacy heading that must stay body text
`;

const ANTIGRAVITY = `# Changelog

## Antigravity 2.0

### [v2.18.1](/releases?tab=hub&version=2.18.1 "View release 2.18.1")

Latest

September 28, 2026

### Manage & Install plugins in AGY

Plugins marketplace in the Customizations tab.

### [v2.17.0](/releases?tab=hub&version=2.17.0 "View release 2.17.0")

### Plan before you build

Adds /plan.

## Antigravity CLI

### [v1.2.11](/releases?tab=hub&version=1.2.11 "View release 1.2.11")

### Hooks get a Stop event

Skills convert to slash commands.
`;

describe('hostlib changelog parser', () => {
  it('parses a flat changelog (Claude Code)', () => {
    const entries = parseChangelog(CLAUDE);
    expect(entries.map(e => e.version)).toEqual(['2.1.285', '2.1.284']);
    expect(entries[0].section).toBe('');
    expect(entries[0].body).toContain('WebFetch');
  });

  it('keeps Keep-a-Changelog subheadings and stray level-2 headings as body (Cline)', () => {
    const entries = parseChangelog(CLINE);
    expect(entries.map(e => e.version)).toEqual(['4.1.22', '4.1.21', '3.44.0']);
    expect(new Set(entries.map(e => e.section))).toEqual(new Set(['']));
    expect(entries[2].body).toContain('stray legacy heading');
  });

  it('parses a sectioned changelog with linked versions and release titles (Antigravity)', () => {
    const entries = parseChangelog(ANTIGRAVITY);
    expect(entries.map(e => `${e.section}|${e.version}|${e.title}`)).toEqual([
      'Antigravity 2.0|2.18.1|Manage & Install plugins in AGY',
      'Antigravity 2.0|2.17.0|Plan before you build',
      'Antigravity CLI|1.2.11|Hooks get a Stop event',
    ]);
    expect(latestPerSection(entries)).toEqual({ 'Antigravity 2.0': '2.18.1', 'Antigravity CLI': '1.2.11' });
  });

  it('reports only entries newer than the recorded baseline, per section', () => {
    const entries = parseChangelog(ANTIGRAVITY);
    const fresh = newEntriesSince(entries, { 'Antigravity 2.0': '2.17.0', 'Antigravity CLI': '1.2.11' });
    expect(fresh.entries.map(e => e.version)).toEqual(['2.18.1']);
    expect(fresh.lostBaselines).toEqual([]);
  });

  it('is idempotent: recording the latest versions yields no new entries', () => {
    const entries = parseChangelog(CLAUDE);
    expect(newEntriesSince(entries, latestPerSection(entries)).entries).toEqual([]);
  });

  it('caps the scan and reports a lost baseline instead of flooding', () => {
    const entries = parseChangelog(CLAUDE);
    const fresh = newEntriesSince(entries, { '': '0.0.1' }, 1);
    expect(fresh.lostBaselines).toEqual(['']);
    expect(fresh.entries).toHaveLength(1);
  });

  it('treats a first run without any baseline as seeding, not as news', () => {
    expect(newEntriesSince(parseChangelog(CLAUDE), {}).entries).toEqual([]);
  });

  it('classifies entries into artifact types with the keyword map', () => {
    const [entry] = parseChangelog(CLAUDE);
    const types = classifyEntry(entry, { hook: ['\\bhooks?\\b'], tools: ['WebFetch'], skill: ['\\bskills?\\b'] });
    expect(types).toEqual(['hook', 'tools']);
  });
});

describe('hostlib llms index', () => {
  it('extracts unique links and diffs added/removed pages', () => {
    const before = parseIndex('- [A](https://x.test/a.md): a\n- [B](https://x.test/b.md): b\n- [A again](https://x.test/a.md)');
    expect(before.map(l => l.url)).toEqual(['https://x.test/a.md', 'https://x.test/b.md']);
    const after = parseIndex('- [B](https://x.test/b.md)\n- [C](https://x.test/c.md)');
    const diff = diffIndex(before, after);
    expect(diff.added.map(l => l.url)).toEqual(['https://x.test/c.md']);
    expect(diff.removed.map(l => l.url)).toEqual(['https://x.test/a.md']);
  });
});
