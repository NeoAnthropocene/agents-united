import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { applyResolvedLicence, resolveLicence } from '../scripts/hostlib/licences.ts';
import type { RepoReader } from '../scripts/hostlib/licences.ts';
import { classifyExtra, listFiles } from '../scripts/hostlib/provenance.ts';
import { restoreExtras, stripAttributionHeader } from '../scripts/hostlib/restore.ts';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';

/**
 * Plan 032 PR D, final run: every remaining restorable skill, in one checkpoint PR. Three tooling needs:
 *  - test fixtures that belong to deferred scripts are deferred with them;
 *  - a document whose format cannot carry a comment (JSON) is restored verbatim and listed in NOTICE.md;
 *  - an owner-accepted MIT declaration (frontmatter only, no licence file) is recorded, and its LICENSE states
 *    that the upstream published no copyright notice instead of inventing a holder.
 */

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-final-'));
  roots.push(dir);
  return dir;
};
const write = (root: string, rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const repo = (files: Record<string, string>): RepoReader => ({
  listDir: dir => {
    const prefix = dir === '.' || dir === '' ? '' : `${dir}/`;
    return Object.keys(files)
      .filter(file => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
      .map(file => file.slice(prefix.length));
  },
  read: file => files[file],
});
const ACCEPTANCE = { by: 'owner (NeoAnthropocene)', date: '2026-09-30', reason: 'Upstream declares MIT in SKILL.md frontmatter and README but publishes no licence file.' };

describe('classifyExtra: fixtures belong with deferred scripts', () => {
  it.each([
    ['resources/fixtures/codeql-no-level.sarif', 'script'],
    ['fixtures/a.json', 'script'],
    ['tests/fixtures/x.yaml', 'script'],
    ['report-schema.json', 'content'],
    ['schemas/recommendation_schema.yaml', 'content'],
    ['rules/_sections.md', 'packaging'],
    ['rules/async-parallel.md', 'content'],
  ])('%s is %s', (file, kind) => {
    expect(classifyExtra(file)).toBe(kind);
  });
});

describe('restoreExtras with a format that cannot carry a header', () => {
  it('copies JSON verbatim, lists it in NOTICE.md as headerless, and still headers the markdown', () => {
    const root = tmp();
    write(root, '_upstream/demo/report-schema.json', '{"a": 1}\n');
    write(root, '_upstream/demo/rules/r.md', '# R\n');
    write(root, 'skills/demo/LICENSE', 'MIT License\n');
    write(root, 'skills/demo/NOTICE.md', '# N\n');
    const record = { skill: 'demo', provenance: 'third-party-pinned', repo: 'a/b', path: 'p', sha: 'f'.repeat(40), declaredLicence: 'MIT', snapshot: true, audit: { verdict: 'pass', findings: [] }, droppedExtras: ['report-schema.json', 'rules/r.md'] } as never;
    const result = restoreExtras({ skillsDir: path.join(root, 'skills'), upstreamDir: path.join(root, '_upstream'), record, today: '2026-09-30' });
    expect(result.restored.sort()).toEqual(['report-schema.json', 'rules/r.md']);
    expect(fs.readFileSync(path.join(root, 'skills/demo/report-schema.json'), 'utf8')).toBe('{"a": 1}\n');
    expect(fs.readFileSync(path.join(root, 'skills/demo/rules/r.md'), 'utf8')).toContain('Restored verbatim from upstream');
    const notice = fs.readFileSync(path.join(root, 'skills/demo/NOTICE.md'), 'utf8');
    expect(notice).toContain('2 upstream documents');
    expect(notice).toMatch(/without a header[^\n]*`report-schema\.json`/);
    expect(stripAttributionHeader('report-schema.json', '{"a": 1}\n')).toBe('{"a": 1}\n');
  });
});

describe('owner-accepted declarations', () => {
  const record = { skill: 'demo', provenance: 'third-party-pinned', repo: 'acme/skills', path: 'skills/demo', sha: '1'.repeat(40), pinKind: 'recovered-head' } as never;
  const skillsDir = (): string => {
    const dir = path.join(tmp(), 'skills');
    write(dir, 'demo/SKILL.md', '---\nname: demo\nmetadata:\n  author: A\n---\n# demo\n');
    return dir;
  };
  const frontmatterOnly = (license = 'MIT') => resolveLicence(repo({ 'skills/demo/SKILL.md': `---\nname: demo\nlicense: ${license}\n---\n` }), 'skills/demo');

  it('writes an honest MIT LICENSE, a NOTICE.md that records the acceptance, and metadata.license', () => {
    const dir = skillsDir();
    applyResolvedLicence({ skillsDir: dir, record, resolution: frontmatterOnly(), today: '2026-09-30', ownerAcceptance: ACCEPTANCE });
    const licence = fs.readFileSync(path.join(dir, 'demo', 'LICENSE'), 'utf8');
    expect(licence).toMatch(/Permission is hereby granted, free of charge/);
    expect(licence).toMatch(/No copyright notice is published upstream/);
    expect(licence).not.toMatch(/^Copyright \(c\)/m);
    const notice = fs.readFileSync(path.join(dir, 'demo', 'NOTICE.md'), 'utf8');
    expect(notice).toMatch(/no licence file/i);
    expect(notice).toContain('accepted by the owner');
    expect(notice).toContain(ACCEPTANCE.reason);
    expect(notice).toContain('2026-09-30');
    expect(fs.readFileSync(path.join(dir, 'demo', 'SKILL.md'), 'utf8')).toContain('  license: MIT');
  });

  it.each([
    ['no acceptance', frontmatterOnly(), undefined, /not a licence file/],
    ['a non-MIT declaration', frontmatterOnly('Apache-2.0'), ACCEPTANCE, /only an MIT declaration/],
    ['an empty reason', frontmatterOnly(), { ...ACCEPTANCE, reason: '' }, /reason/],
  ])('refuses %s and writes nothing', (_name, resolution, acceptance, expected) => {
    const dir = skillsDir();
    expect(() => applyResolvedLicence({ skillsDir: dir, record, resolution, today: '2026-09-30', ownerAcceptance: acceptance })).toThrow(expected);
    expect(fs.readdirSync(path.join(dir, 'demo'))).toEqual(['SKILL.md']);
  });

  it('the restore guard accepts a frontmatter declaration only with a recorded owner acceptance', () => {
    const root = tmp();
    write(root, '_upstream/demo/rules/a.md', '# A\n');
    write(root, 'skills/demo/LICENSE', 'MIT License\n');
    write(root, 'skills/demo/NOTICE.md', '# N\n');
    const base = { skill: 'demo', provenance: 'third-party-pinned', repo: 'a/b', path: 'p', sha: '2'.repeat(40), snapshot: true, audit: { verdict: 'pass', findings: [] }, droppedExtras: ['rules/a.md'] };
    const resolved = { spdx: 'MIT', tier: 'permissive', evidence: 'frontmatter', restorable: false, resolvedAt: '2026-09-30' };
    const dirs = { skillsDir: path.join(root, 'skills'), upstreamDir: path.join(root, '_upstream') };
    expect(() => restoreExtras({ ...dirs, record: { ...base, resolvedLicence: resolved } as never })).toThrow(/only a frontmatter statement/);
    expect(restoreExtras({ ...dirs, record: { ...base, resolvedLicence: { ...resolved, ownerAcceptance: ACCEPTANCE } } as never }).restored).toEqual(['rules/a.md']);
  });
});

describe('the finished catalog', () => {
  const skills = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, any>> }).skills;
  const FINAL: Record<string, number> = {
    'domain-modeling': 2,
    'edge-security-audit': 15,
    'mobile-android-design': 4,
    'mobile-ios-design': 3,
    'mobile-platform-offline-validate': 4,
    'react-best-practices': 70,
  };

  it('only the semgrep security hold still lists documents to restore', () => {
    const left = Object.entries(skills).filter(([, record]) => (record.droppedExtras ?? []).length > 0).map(([name]) => name);
    expect(left).toEqual(['semgrep-scanning']);
    expect(skills['semgrep-scanning'].audit.verdict).toBe('needs-review');
    expect(fs.existsSync(path.resolve('registry/skills/semgrep-scanning/rules'))).toBe(false);
  });

  it.each(Object.entries(FINAL))('%s: %i upstream documents restored, behind headers where the format allows', (name, count) => {
    const dir = path.resolve('registry/skills', name);
    const upstream = path.resolve('host-library/_upstream', name);
    // The files this restore wrote: those that carry the header, plus the headerless ones NOTICE.md lists. Other
    // upstream files may already exist locally from the earlier port (for example codeql's references/).
    const notice = lf(fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8'));
    const headerless = [...(/without a header[^\n]*?:\s*([^\n]+)\./.exec(notice)?.[1] ?? '').matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const withHeader = listFiles(dir).filter(file => /\.(md|ya?ml)$/i.test(file) && lf(fs.readFileSync(path.join(dir, file), 'utf8')).includes('Restored verbatim from upstream'));
    expect(withHeader.length + headerless.length).toBe(count);
    for (const file of [...withHeader, ...headerless]) {
      expect(classifyExtra(file), file).toBe('content');
      const text = lf(fs.readFileSync(path.join(dir, file), 'utf8'));
      expect(lf(stripAttributionHeader(file, text)), file).toBe(lf(fs.readFileSync(path.join(upstream, file), 'utf8')));
    }
    expect(notice).toContain(`${count} upstream document`);
    expect(listFiles(upstream).filter(file => classifyExtra(file) === 'content' && file !== 'SKILL.md').length).toBeGreaterThanOrEqual(count);
  });

  it('codeql-scanning restores nothing: its workflows already live in references/ as adapted copies', () => {
    const dir = path.resolve('registry/skills/codeql-scanning');
    expect(fs.existsSync(path.join(dir, 'workflows'))).toBe(false);
    for (const name of ['build-database', 'create-data-extensions', 'run-analysis']) expect(fs.existsSync(path.join(dir, 'references', `workflow-${name}.md`))).toBe(true);
    expect(skills['codeql-scanning'].droppedExtras ?? []).toEqual([]);
    expect(skills['codeql-scanning'].restoredAt).toBeUndefined();
  });

  it('sarif-triage has no documents left: its fixtures are deferred with its scripts', () => {
    expect(skills['sarif-triage'].droppedExtras ?? []).toEqual([]);
    expect((skills['sarif-triage'].deferredExtras as string[]).some(file => file.endsWith('.sarif'))).toBe(true);
  });

  it('react-best-practices carries its owner-accepted MIT declaration honestly', () => {
    const record = skills['react-best-practices'];
    expect(record.resolvedLicence).toMatchObject({ spdx: 'MIT', evidence: 'frontmatter', ownerAcceptance: { date: '2026-09-30' } });
    expect(record.resolvedLicence.ownerAcceptance.reason.length).toBeGreaterThan(20);
    const dir = path.resolve('registry/skills/react-best-practices');
    expect(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')).toMatch(/No copyright notice is published upstream/);
    const notice = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(notice).toContain('accepted by the owner');
    expect(notice).toMatch(/no licence file/i);
    const front = yaml.parse(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as { metadata: { license: string; source: string } };
    expect(front.metadata.license).toBe('MIT');
    expect(lintSkillLicence({ dirName: 'react-best-practices', license: front.metadata.license, source: front.metadata.source, files: fs.readdirSync(dir) })).toEqual([]);
  });

  it('edge-security-audit carries a licence file and notice before its restored documents', () => {
    const dir = path.resolve('registry/skills/edge-security-audit');
    expect(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')).toMatch(/Permission is hereby granted/);
    expect(fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8')).toContain(skills['edge-security-audit'].sha);
  });
});
