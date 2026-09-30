import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyExtra, partitionExtras } from '../scripts/hostlib/provenance.ts';
import { auditDirectory } from '../scripts/hostlib/audit.ts';
import { attributionHeader, restoreExtras, stripAttributionHeader } from '../scripts/hostlib/restore.ts';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';

/**
 * Plan 032 PR D — restoring the extras a port dropped, one bundle at a time, from the pinned
 * upstream snapshot in host-library/_upstream/. Policy (owner decision 2026-09-30): docs only.
 * Upstream packaging files are skipped on purpose; scripts and attribution marks are deferred to
 * later PRs, each needing the audit gate and lintSkillPortability.
 */

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-restore-'));
  roots.push(dir);
  return dir;
};
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const list = (root: string, prefix = ''): string[] =>
  fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? list(root, rel) : [rel];
  });

describe('classifyExtra / partitionExtras', () => {
  it.each([
    ['references/query-missing-indexes.md', 'content'],
    ['rules/decision-ingestion-strategy.md', 'content'],
    ['examples/README.md', 'content'],
    ['schemas/recommendation_schema.yaml', 'content'],
    ['mappings/doc_links.yaml', 'content'],
    ['advanced/authentication.md', 'content'],
    ['workflows/analyzing-results.md', 'content'],
    ['resources/fixtures/codeql-no-level.sarif', 'content'],
    ['README.md', 'packaging'],
    ['AGENTS.md', 'packaging'],
    ['CHANGELOG.md', 'packaging'],
    ['metadata.json', 'packaging'],
    ['SECURITY.md', 'packaging'],
    ['agents/openai.yaml', 'packaging'],
    ['references/_contributing.md', 'packaging'],
    ['references/_sections.md', 'packaging'],
    ['references/_template.md', 'packaging'],
    ['scripts/run-scans.sh', 'script'],
    ['scripts/test_collect.py', 'script'],
    ['tools/build.mjs', 'script'],
    ['assets/trail-of-bits-mark.svg', 'asset'],
    ['docs/diagram.png', 'asset'],
  ])('%s is %s', (file, kind) => {
    expect(classifyExtra(file)).toBe(kind);
  });

  it('splits a list into what to restore, what is skipped on purpose and what is deferred', () => {
    expect(partitionExtras(['rules/a.md', 'README.md', 'scripts/x.sh', 'assets/m.svg', 'agents/openai.yaml'])).toEqual({
      content: ['rules/a.md'],
      skipped: ['README.md', 'agents/openai.yaml'],
      deferred: ['scripts/x.sh', 'assets/m.svg'],
    });
  });
});

describe('attributionHeader / stripAttributionHeader', () => {
  it('puts an HTML comment after markdown frontmatter so the frontmatter stays first', () => {
    const out = attributionHeader('references/a.md', '---\ntitle: T\n---\n\n# Body\n');
    expect(out.startsWith('---\ntitle: T\n---\n')).toBe(true);
    expect(out).toContain('Restored verbatim from upstream references/a.md');
    expect(out).toContain('Licence: see ../LICENSE');
    expect(out).toContain('pinned in ../NOTICE.md');
    expect(stripAttributionHeader('references/a.md', out)).toBe('---\ntitle: T\n---\n\n# Body\n');
  });

  it('puts the comment on top of markdown without frontmatter, and # lines on top of yaml', () => {
    const md = attributionHeader('rules/r.md', '# R\n');
    expect(md.startsWith('<!--')).toBe(true);
    expect(stripAttributionHeader('rules/r.md', md)).toBe('# R\n');
    const y = attributionHeader('schemas/s.yaml', 'a: 1\n');
    expect(y.startsWith('# Restored verbatim from')).toBe(true);
    expect(stripAttributionHeader('schemas/s.yaml', y)).toBe('a: 1\n');
  });

  it('counts the folder depth for the licence link', () => {
    expect(attributionHeader('TOP.md', '# x\n')).toContain('Licence: see LICENSE');
    expect(attributionHeader('a/b/c.md', '# x\n')).toContain('Licence: see ../../LICENSE');
  });

  it('refuses files that cannot carry an inline attribution', () => {
    expect(() => attributionHeader('data/x.json', '{}')).toThrow(/cannot carry an inline attribution/);
  });
});

describe('restoreExtras', () => {
  function fixture(over: Record<string, unknown> = {}): { skillsDir: string; upstreamDir: string; record: Record<string, unknown> } {
    const root = tmp();
    const upstreamDir = path.join(root, '_upstream');
    const skillsDir = path.join(root, 'skills');
    fs.mkdirSync(path.join(upstreamDir, 'demo', 'rules'), { recursive: true });
    fs.mkdirSync(path.join(upstreamDir, 'demo', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(upstreamDir, 'demo', 'SKILL.md'), '# upstream\n');
    fs.writeFileSync(path.join(upstreamDir, 'demo', 'rules', 'a.md'), '# Rule A\n');
    fs.writeFileSync(path.join(upstreamDir, 'demo', 'README.md'), '# upstream readme\n');
    fs.writeFileSync(path.join(upstreamDir, 'demo', 'scripts', 'go.sh'), '#!/bin/sh\n');
    fs.mkdirSync(path.join(skillsDir, 'demo'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'demo', 'SKILL.md'), '---\nname: demo\n---\n# ours\n');
    fs.writeFileSync(path.join(skillsDir, 'demo', 'LICENSE'), 'MIT License\n');
    fs.writeFileSync(path.join(skillsDir, 'demo', 'NOTICE.md'), '# NOTICE\n');
    const record = {
      skill: 'demo',
      provenance: 'third-party-pinned',
      repo: 'acme/skills',
      path: 'skills/demo',
      sha: 'b'.repeat(40),
      declaredLicence: 'MIT',
      snapshot: true,
      audit: { verdict: 'pass', findings: [] },
      droppedExtras: ['README.md', 'rules/a.md', 'scripts/go.sh'],
      ...over,
    };
    return { skillsDir, upstreamDir, record };
  }

  it('copies only content-class files, with a header, and never touches SKILL.md or the licence files', () => {
    const { skillsDir, upstreamDir, record } = fixture();
    const before = fs.readFileSync(path.join(skillsDir, 'demo', 'SKILL.md'), 'utf8');
    const result = restoreExtras({ skillsDir, upstreamDir, record: record as never });
    expect(result.restored).toEqual(['rules/a.md']);
    expect(result.skipped).toEqual(['README.md']);
    expect(result.deferred).toEqual(['scripts/go.sh']);
    const restored = fs.readFileSync(path.join(skillsDir, 'demo', 'rules', 'a.md'), 'utf8');
    expect(stripAttributionHeader('rules/a.md', restored)).toBe('# Rule A\n');
    expect(fs.existsSync(path.join(skillsDir, 'demo', 'README.md'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'demo', 'scripts'))).toBe(false);
    expect(fs.readFileSync(path.join(skillsDir, 'demo', 'SKILL.md'), 'utf8')).toBe(before);
  });

  it('is idempotent: a second run restores nothing new and rewrites identical bytes', () => {
    const { skillsDir, upstreamDir, record } = fixture();
    restoreExtras({ skillsDir, upstreamDir, record: record as never });
    const once = list(path.join(skillsDir, 'demo')).sort();
    const bytes = fs.readFileSync(path.join(skillsDir, 'demo', 'rules', 'a.md'), 'utf8');
    restoreExtras({ skillsDir, upstreamDir, record: record as never });
    expect(list(path.join(skillsDir, 'demo')).sort()).toEqual(once);
    expect(fs.readFileSync(path.join(skillsDir, 'demo', 'rules', 'a.md'), 'utf8')).toBe(bytes);
  });

  it.each([
    ['a blocked licence', { declaredLicence: 'GPL-3.0-only' }, /licence tier "blocked"/],
    ['an unclassified licence', { declaredLicence: 'Weird-1.0' }, /licence tier "unknown"/],
    ['no declared licence', { declaredLicence: undefined }, /no declared licence/],
    ['an audit that did not pass', { audit: { verdict: 'needs-review', findings: [] } }, /audit verdict "needs-review"/],
    ['a skill without a snapshot', { snapshot: false }, /no upstream snapshot/],
    ['an unpinned record', { sha: undefined }, /no pinned commit/],
    ['a not-third-party record', { provenance: 'in-house' }, /not a third-party pinned skill/],
  ])('refuses %s', (_name, over, expected) => {
    const { skillsDir, upstreamDir, record } = fixture(over);
    expect(() => restoreExtras({ skillsDir, upstreamDir, record: record as never })).toThrow(expected);
    expect(list(path.join(skillsDir, 'demo')).sort()).toEqual(['LICENSE', 'NOTICE.md', 'SKILL.md']);
  });

  it('refuses when the skill folder lacks its LICENSE or NOTICE.md', () => {
    const { skillsDir, upstreamDir, record } = fixture();
    fs.rmSync(path.join(skillsDir, 'demo', 'NOTICE.md'));
    expect(() => restoreExtras({ skillsDir, upstreamDir, record: record as never })).toThrow(/add LICENSE and NOTICE\.md first/);
  });

  it('refuses a listed file that is missing from the snapshot', () => {
    const { skillsDir, upstreamDir, record } = fixture({ droppedExtras: ['rules/ghost.md'] });
    expect(() => restoreExtras({ skillsDir, upstreamDir, record: record as never })).toThrow(/rules\/ghost\.md is not in the snapshot/);
  });
});

describe('the committed provenance records', () => {
  const skills = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, unknown>> }).skills;

  it('separates content still to restore from packaging skipped on purpose and scripts/marks deferred', () => {
    for (const [name, record] of Object.entries(skills)) {
      for (const file of (record.droppedExtras as string[] | undefined) ?? []) expect(classifyExtra(file), `${name}: ${file}`).toBe('content');
      for (const file of (record.skippedExtras as string[] | undefined) ?? []) expect(classifyExtra(file), `${name}: ${file}`).toBe('packaging');
      for (const file of (record.deferredExtras as string[] | undefined) ?? []) expect(['script', 'asset'], `${name}: ${file}`).toContain(classifyExtra(file));
    }
  });
});

describe('the restored pilot bundle: system-architecture-data', () => {
  const PILOT = [
    { skill: 'postgres-best-practices', repo: 'supabase/agent-skills', licence: 'MIT', licenceText: /Permission is hereby granted, free of charge/, restored: 31 },
    { skill: 'clickhouse-architecture-advisor', repo: 'ClickHouse/agent-skills', licence: 'Apache-2.0', licenceText: /Apache License\s+Version 2\.0/, restored: 11 },
  ];
  const provenance = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, any>> }).skills;

  it.each(PILOT)('$skill: every upstream content file is restored byte-for-byte after its header', spec => {
    const record = provenance[spec.skill];
    const skillDir = path.resolve('registry/skills', spec.skill);
    const upstream = path.resolve('host-library/_upstream', spec.skill);
    const contentFiles = list(upstream).filter(file => file !== 'SKILL.md' && classifyExtra(file) === 'content');
    expect(contentFiles).toHaveLength(spec.restored);
    for (const file of contentFiles) {
      const restored = fs.readFileSync(path.join(skillDir, file), 'utf8');
      expect(lf(stripAttributionHeader(file, lf(restored))), file).toBe(lf(fs.readFileSync(path.join(upstream, file), 'utf8')));
      expect(restored, file).toContain(`Restored verbatim from upstream ${file}`);
    }
  });

  it.each(PILOT)('$skill: provenance no longer lists restored content as dropped', spec => {
    const record = provenance[spec.skill];
    expect(record.droppedExtras ?? []).toEqual([]);
    expect((record.skippedExtras ?? []).length).toBeGreaterThan(0);
    expect(record.restoredAt).toBe('2026-09-30');
  });

  it.each(PILOT)('$skill: carries its licence text, a notice and a pinned source', spec => {
    const skillDir = path.resolve('registry/skills', spec.skill);
    expect(fs.readFileSync(path.join(skillDir, 'LICENSE'), 'utf8')).toMatch(spec.licenceText);
    const notice = fs.readFileSync(path.join(skillDir, 'NOTICE.md'), 'utf8');
    const record = provenance[spec.skill];
    expect(notice).toContain(`github.com/${spec.repo}`);
    expect(notice).toContain(record.sha);
    expect(notice).toContain(spec.licence);
    expect(notice).toMatch(/Plan 032/);
    const front = yaml.parse(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as { name: string; metadata: { license: string; source: string; commit: string } };
    expect(front.metadata.license).toBe(spec.licence);
    expect(front.metadata.commit).toBe(record.sha);
    expect(lintSkillLicence({ dirName: spec.skill, license: front.metadata.license, source: front.metadata.source, files: list(skillDir) })).toEqual([]);
  });

  it('clickhouse keeps the upstream NOTICE text verbatim (Apache-2.0 section 4d)', () => {
    const notice = fs.readFileSync(path.resolve('registry/skills/clickhouse-architecture-advisor/NOTICE.md'), 'utf8');
    expect(notice).toContain('This repository includes software developed at Vercel, Inc.');
  });

  it.each(PILOT)('$skill: SKILL.md lists every restored file and stays inside the host limits', spec => {
    const skillDir = path.resolve('registry/skills', spec.skill);
    const body = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const restored = list(skillDir).filter(file => !['SKILL.md', 'LICENSE', 'NOTICE.md'].includes(file));
    expect(restored).toHaveLength(spec.restored);
    for (const file of restored) expect(body, `SKILL.md must link ${file}`).toContain(file);
    const frontName = /^name: (.+)$/m.exec(body)![1].trim();
    expect(lintSkillPortability({ dirName: spec.skill, name: frontName, body: body.replace(/^---[\s\S]*?---\r?\n/, '') })).toEqual([]);
  });

  it.each(PILOT)('$skill: the restored folder passes the security audit gate (no hidden-comment or injection findings)', spec => {
    const report = auditDirectory(path.resolve('registry/skills', spec.skill), { mode: 'skill' });
    expect(report.findings.filter(finding => finding.severity !== 'low')).toEqual([]);
    expect(report.verdict).toBe('pass');
  });

  it('writes the attribution as a single-line comment without the upstream repository URL', () => {
    const file = path.resolve('registry/skills/postgres-best-practices/references/query-missing-indexes.md');
    const header = lf(fs.readFileSync(file, 'utf8'))
      .split('\n')
      .find(line => line.startsWith('<!-- Restored verbatim'));
    expect(header).toBe('<!-- Restored verbatim from upstream references/query-missing-indexes.md (repository and commit pinned in ../NOTICE.md). Licence: see ../LICENSE. -->');
  });

  it('restores no script, asset or packaging file', () => {
    for (const { skill } of PILOT) {
      for (const file of list(path.resolve('registry/skills', skill))) expect(['content', 'packaging', 'script', 'asset'].includes(classifyExtra(file))).toBe(true);
      const skippedOrDeferred = list(path.resolve('registry/skills', skill)).filter(file => file !== 'SKILL.md' && ['packaging', 'script', 'asset'].includes(classifyExtra(file)));
      expect(skippedOrDeferred, skill).toEqual([]);
    }
  });
});
