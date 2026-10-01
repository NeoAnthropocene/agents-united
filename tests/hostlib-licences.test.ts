import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { applyResolvedLicence, licenceCandidates, resolveLicence, withLicenceMetadata } from '../scripts/hostlib/licences.ts';
import type { RepoReader } from '../scripts/hostlib/licences.ts';
import { restoreExtras } from '../scripts/hostlib/restore.ts';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';

/**
 * Plan 032 PR D follow-up — resolve the upstream licence of every third-party skill that has none
 * declared, from evidence at the pinned commit: a licence file (nearest the skill first), else a
 * frontmatter `license:`, else a README statement. Only a licence file makes a skill restorable,
 * because the restore step has to copy real licence text into the skill folder.
 */

const MIT_TEXT = 'MIT License\n\nCopyright (c) 2026 Acme Corp\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n';
const APACHE_TEXT = '                                 Apache License\n                           Version 2.0, January 2004\n';

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-licences-'));
  roots.push(dir);
  return dir;
};

/** An in-memory repository: path -> content. */
function repo(files: Record<string, string>): RepoReader {
  return {
    listDir: dir => {
      const prefix = dir === '.' || dir === '' ? '' : `${dir}/`;
      return Object.keys(files)
        .filter(file => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
        .map(file => file.slice(prefix.length));
    },
    read: file => files[file],
  };
}

describe('licenceCandidates', () => {
  it('lists licence-like files from the skill folder up to the root, nearest first', () => {
    const reader = repo({ LICENSE: 'x', 'skills/a/LICENSE.md': 'y', 'skills/COPYING': 'z', 'skills/a/SKILL.md': 's', 'skills/a/NOTICE': 'n', README: 'r' });
    expect(licenceCandidates(reader, 'skills/a')).toEqual(['skills/a/LICENSE.md', 'skills/COPYING', 'LICENSE']);
  });

  it('treats "." as the repository root', () => {
    expect(licenceCandidates(repo({ 'LICENSE.txt': 'x' }), '.')).toEqual(['LICENSE.txt']);
  });
});

describe('resolveLicence', () => {
  it('reads an MIT licence file at the repository root, with its copyright line', () => {
    const r = resolveLicence(repo({ LICENSE: MIT_TEXT }), 'skills/a');
    expect(r).toMatchObject({ spdx: 'MIT', tier: 'permissive', evidence: 'licence-file', file: 'LICENSE', copyright: 'Copyright (c) 2026 Acme Corp', restorable: true });
    expect(r.text).toBe(MIT_TEXT);
  });

  it('prefers the licence file nearest the skill over the repository root', () => {
    const r = resolveLicence(repo({ LICENSE: MIT_TEXT, 'skills/a/LICENSE': APACHE_TEXT }), 'skills/a');
    expect(r).toMatchObject({ spdx: 'Apache-2.0', file: 'skills/a/LICENSE' });
  });

  it('falls back to a frontmatter license, which is not restorable', () => {
    const r = resolveLicence(repo({ 'SKILL.md': '---\nname: x\nlicense: MIT\n---\n# x\n' }), '.');
    expect(r).toMatchObject({ spdx: 'MIT', evidence: 'frontmatter', file: 'SKILL.md', restorable: false });
    expect(r.text).toBeUndefined();
  });

  it('also reads metadata.license from frontmatter', () => {
    const r = resolveLicence(repo({ 'skills/a/SKILL.md': '---\nname: a\nmetadata:\n  license: Apache-2.0\n---\n' }), 'skills/a');
    expect(r).toMatchObject({ spdx: 'Apache-2.0', evidence: 'frontmatter' });
  });

  it('falls back to a README license section, which is not restorable', () => {
    const r = resolveLicence(repo({ 'README.md': '# Skills\n\nStuff.\n\n## License\n\nMIT\n' }), 'skills/a');
    expect(r).toMatchObject({ spdx: 'MIT', evidence: 'readme', file: 'README.md', restorable: false });
  });

  it('reports none when there is no evidence at all', () => {
    expect(resolveLicence(repo({ 'README.md': '# Skills\n' }), 'skills/a')).toMatchObject({ evidence: 'none', tier: 'unknown', restorable: false });
  });

  it('a licence file it cannot classify is unknown and not restorable', () => {
    const r = resolveLicence(repo({ LICENSE: 'All rights reserved. Do not copy.\n' }), 'skills/a');
    expect(r).toMatchObject({ evidence: 'licence-file', tier: 'unknown', restorable: false });
    expect(r.spdx).toBeUndefined();
  });

  it('a blocked licence file is never restorable', () => {
    const r = resolveLicence(repo({ LICENSE: 'Creative Commons Attribution-NonCommercial 4.0\n' }), 'skills/a');
    expect(r).toMatchObject({ spdx: 'NonCommercial', tier: 'blocked', restorable: false });
  });
});

describe('withLicenceMetadata', () => {
  it('adds license after the last metadata key and keeps everything else', () => {
    const before = '---\nname: x\ndescription: d\nmetadata:\n  author: A\n  source: https://example.com\n  icon: i\ndisable-slash-command: true\n---\n\n# Body\n';
    const after = withLicenceMetadata(before, 'MIT');
    expect(yaml.parse(after.match(/^---\n([\s\S]*?)\n---/)![1]).metadata).toEqual({ author: 'A', source: 'https://example.com', icon: 'i', license: 'MIT' });
    expect(after).toContain('disable-slash-command: true');
    expect(after.endsWith('\n\n# Body\n')).toBe(true);
  });

  it('creates a metadata block when there is none', () => {
    const after = withLicenceMetadata('---\nname: x\n---\n# B\n', 'Apache-2.0');
    expect(yaml.parse(after.match(/^---\n([\s\S]*?)\n---/)![1])).toEqual({ name: 'x', metadata: { license: 'Apache-2.0' } });
  });

  it('is idempotent and replaces a different existing value', () => {
    const once = withLicenceMetadata('---\nname: x\nmetadata:\n  author: A\n---\n', 'MIT');
    expect(withLicenceMetadata(once, 'MIT')).toBe(once);
    expect(withLicenceMetadata(once, 'Apache-2.0')).toContain('license: Apache-2.0');
    expect(withLicenceMetadata(once, 'Apache-2.0').match(/license:/g)).toHaveLength(1);
  });

  it('keeps CRLF line endings', () => {
    const after = withLicenceMetadata('---\r\nname: x\r\nmetadata:\r\n  author: A\r\n---\r\n# B\r\n', 'MIT');
    expect(after).not.toMatch(/[^\r]\n/);
    expect(after).toContain('  license: MIT\r\n');
  });
});

describe('applyResolvedLicence', () => {
  const record = { skill: 'demo', provenance: 'third-party-pinned', repo: 'acme/skills', path: 'skills/demo', sha: 'c'.repeat(40), pinKind: 'recovered-head' } as never;

  function skillsDir(): string {
    const dir = path.join(tmp(), 'skills');
    fs.mkdirSync(path.join(dir, 'demo'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'demo', 'SKILL.md'), '---\nname: demo\nmetadata:\n  author: A\n---\n# demo\n');
    return dir;
  }

  it('writes LICENSE, a NOTICE.md naming repository, path, pinned commit and the recovered-pin caveat, and metadata.license', () => {
    const dir = skillsDir();
    applyResolvedLicence({ skillsDir: dir, record, resolution: resolveLicence(repo({ LICENSE: MIT_TEXT }), 'skills/demo'), today: '2026-09-30' });
    expect(fs.readFileSync(path.join(dir, 'demo', 'LICENSE'), 'utf8')).toBe(MIT_TEXT);
    const notice = fs.readFileSync(path.join(dir, 'demo', 'NOTICE.md'), 'utf8');
    expect(notice).toContain('github.com/acme/skills');
    expect(notice).toContain('c'.repeat(40));
    expect(notice).toContain('MIT');
    expect(notice).toContain('Copyright (c) 2026 Acme Corp');
    expect(notice).toMatch(/repository HEAD on 2026-09-30/);
    expect(notice).toMatch(/Plan 032/);
    expect(fs.readFileSync(path.join(dir, 'demo', 'SKILL.md'), 'utf8')).toContain('  license: MIT');
  });

  it('is idempotent', () => {
    const dir = skillsDir();
    const resolution = resolveLicence(repo({ LICENSE: MIT_TEXT }), 'skills/demo');
    applyResolvedLicence({ skillsDir: dir, record, resolution, today: '2026-09-30' });
    const snapshot = ['SKILL.md', 'LICENSE', 'NOTICE.md'].map(file => fs.readFileSync(path.join(dir, 'demo', file), 'utf8'));
    applyResolvedLicence({ skillsDir: dir, record, resolution, today: '2026-09-30' });
    expect(['SKILL.md', 'LICENSE', 'NOTICE.md'].map(file => fs.readFileSync(path.join(dir, 'demo', file), 'utf8'))).toEqual(snapshot);
  });

  it.each([
    ['a README-only licence', { 'README.md': '## License\n\nMIT\n' }, /README/],
    ['a frontmatter-only licence', { 'skills/demo/SKILL.md': '---\nlicense: MIT\n---\n' }, /frontmatter/],
    ['no evidence', {}, /no licence evidence/],
    ['an unclassified licence file', { LICENSE: 'Proprietary.\n' }, /unknown/],
    ['a blocked licence file', { LICENSE: 'Creative Commons Attribution-NonCommercial 4.0\n' }, /blocked/],
  ])('refuses %s and writes nothing', (_name, files, expected) => {
    const dir = skillsDir();
    expect(() => applyResolvedLicence({ skillsDir: dir, record, resolution: resolveLicence(repo(files), 'skills/demo'), today: '2026-09-30' })).toThrow(expected);
    expect(fs.readdirSync(path.join(dir, 'demo'))).toEqual(['SKILL.md']);
  });
});

describe('the restore guard uses a resolved licence only when it comes from a licence file', () => {
  function restoreFixture(resolvedLicence: Record<string, unknown> | undefined) {
    const root = tmp();
    fs.mkdirSync(path.join(root, '_upstream', 'demo', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, '_upstream', 'demo', 'rules', 'a.md'), '# A\n');
    fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', 'demo', 'LICENSE'), 'MIT License\n');
    fs.writeFileSync(path.join(root, 'skills', 'demo', 'NOTICE.md'), '# N\n');
    const record = { skill: 'demo', provenance: 'third-party-pinned', repo: 'a/b', path: 'p', sha: 'd'.repeat(40), snapshot: true, audit: { verdict: 'pass', findings: [] }, droppedExtras: ['rules/a.md'], resolvedLicence } as never;
    return { skillsDir: path.join(root, 'skills'), upstreamDir: path.join(root, '_upstream'), record };
  }

  it('accepts a licence-file resolution when nothing was declared', () => {
    const fx = restoreFixture({ spdx: 'MIT', tier: 'permissive', evidence: 'licence-file', restorable: true });
    expect(restoreExtras(fx).restored).toEqual(['rules/a.md']);
  });

  it.each([
    ['a README statement', { spdx: 'MIT', tier: 'permissive', evidence: 'readme', restorable: false }, /only a README statement/],
    ['a frontmatter statement', { spdx: 'MIT', tier: 'permissive', evidence: 'frontmatter', restorable: false }, /only a frontmatter statement/],
    ['a blocked licence file', { spdx: 'NonCommercial', tier: 'blocked', evidence: 'licence-file', restorable: false }, /licence tier "blocked"/],
    ['no resolution', undefined, /no declared licence/],
  ])('refuses %s', (_name, resolved, expected) => {
    expect(() => restoreExtras(restoreFixture(resolved as never))).toThrow(expected);
  });
});

describe('the committed resolutions', () => {
  const skills = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, any>> }).skills;
  const noDeclared = Object.entries(skills).filter(([, record]) => record.provenance === 'third-party-pinned' && !record.declaredLicence);

  const EXPECTED: Record<string, { spdx: string; evidence: string }> = {
    'diagnosing-bugs': { spdx: 'MIT', evidence: 'licence-file' },
    'domain-modeling': { spdx: 'MIT', evidence: 'licence-file' },
    'git-guardrails': { spdx: 'MIT', evidence: 'licence-file' },
    'grill-me': { spdx: 'MIT', evidence: 'licence-file' },
    'grill-with-docs': { spdx: 'MIT', evidence: 'licence-file' },
    handoff: { spdx: 'MIT', evidence: 'licence-file' },
    'to-spec': { spdx: 'MIT', evidence: 'licence-file' },
    'to-tickets': { spdx: 'MIT', evidence: 'licence-file' },
    'mobile-android-design': { spdx: 'MIT', evidence: 'licence-file' },
    'mobile-ios-design': { spdx: 'MIT', evidence: 'licence-file' },
    'mobile-platform-offline-validate': { spdx: 'Apache-2.0', evidence: 'licence-file' },
    'playwright-best-practices': { spdx: 'MIT', evidence: 'licence-file' },
    'react-best-practices': { spdx: 'MIT', evidence: 'frontmatter' },
    'maestro-mobile-testing': { spdx: 'MIT', evidence: 'frontmatter' },
  };

  it('every pinned skill without a declared licence now carries a resolution with its evidence', () => {
    expect(noDeclared.map(([name]) => name).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [name, record] of noDeclared) {
      expect(record.resolvedLicence, name).toMatchObject(EXPECTED[name]);
      expect(record.resolvedLicence.resolvedAt, name).toBe('2026-09-30');
      expect(record.resolvedLicence.restorable, name).toBe(EXPECTED[name].evidence === 'licence-file');
      expect(record.resolvedLicence.text, `${name} must not persist licence text in the records`).toBeUndefined();
    }
  });

  it('skills resolved from a licence file carry LICENSE, NOTICE.md and metadata.license, and pass the licence lint', () => {
    for (const [name, record] of noDeclared.filter(([, r]) => r.resolvedLicence.restorable)) {
      const dir = path.resolve('registry/skills', name);
      expect(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8'), name).toMatch(record.resolvedLicence.spdx === 'MIT' ? /Permission is hereby granted/ : /Apache License/);
      expect(fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8'), name).toContain(record.sha);
      const front = yaml.parse(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as { metadata: { license: string; source: string } };
      expect(front.metadata.license, name).toBe(record.resolvedLicence.spdx);
      const files = fs.readdirSync(dir);
      expect(lintSkillLicence({ dirName: name, license: front.metadata.license, source: front.metadata.source, files }), name).toEqual([]);
    }
  });

  it('the frontmatter-only skill without an owner acceptance is not materialised and stays blocked from restore', () => {
    // react-best-practices was later accepted by the owner (see hostlib-restore-final.test.ts); maestro remains blocked.
    for (const name of ['maestro-mobile-testing']) {
      const dir = path.resolve('registry/skills', name);
      expect(fs.existsSync(path.join(dir, 'LICENSE')), name).toBe(false);
      expect(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), name).not.toMatch(/^\s+license:/m);
    }
  });
});
