import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditDirectory } from '../scripts/hostlib/audit.ts';
import { detectLicence, droppedExtras, findSkillDir, loadCatalog, parseSource } from '../scripts/hostlib/provenance.ts';
import type { RepoCache, SkillRecord } from '../scripts/hostlib/provenance.ts';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-prov-'));
  dirs.push(dir);
  return dir;
};

const SHA = '6d05be4889017b06fb15069f371afd220daffb62';
const cache = (skillDirs: string[]): RepoCache => ({ dir: '/unused', head: SHA, skillDirs });

describe('parseSource', () => {
  it('treats missing and self-referencing sources as in-house', () => {
    expect(parseSource(undefined).kind).toBe('in-house');
    expect(parseSource('https://github.com/NeoAnthropocene/agents-united').kind).toBe('in-house');
  });

  it('extracts owner, repo, pinned sha and path from a GitHub tree URL', () => {
    expect(parseSource(`https://github.com/trailofbits/skills-curated/tree/${SHA}/plugins/x`)).toMatchObject({
      kind: 'github', owner: 'trailofbits', repo: 'skills-curated', sha: SHA, path: 'plugins/x',
    });
  });

  it('uses metadata.commit only when it is a full sha', () => {
    expect(parseSource('https://github.com/a/b', SHA).sha).toBe(SHA);
    expect(parseSource('https://github.com/a/b', 'abc123').sha).toBeUndefined();
  });

  it('maps skills.sh URLs to their GitHub repo and skill folder name', () => {
    expect(parseSource('https://skills.sh/wshobson/agents/mobile-ios-design')).toMatchObject({
      kind: 'skills-sh', owner: 'wshobson', repo: 'agents', skill: 'mobile-ios-design',
    });
  });

  it('applies verified repo aliases for credited names that are not the real repository', () => {
    expect(parseSource('https://github.com/GoogleChrome/devtools-mcp')).toMatchObject({ owner: 'ChromeDevTools', repo: 'chrome-devtools-mcp' });
  });

  it('classifies vendor sites and junk without pretending they are repositories', () => {
    expect(parseSource('https://www.ui-skills.com/skills/x/y').kind).toBe('vendor-site');
    expect(parseSource('https://labs.google/stitch').kind).toBe('vendor-site');
  });
});

describe('findSkillDir', () => {
  it('prefers an exact folder-name match, shortest path first', () => {
    const found = findSkillDir(cache(['skills/a/grill-me', 'other/deep/path/grill-me']), 'grill-me');
    expect(found.dir).toBe('skills/a/grill-me');
    expect(found.ambiguous).toEqual(['other/deep/path/grill-me']);
    expect(found.fuzzy).toBeUndefined();
  });

  it('resolves a hint that names the plugin folder containing the skill', () => {
    const found = findSkillDir(cache(['plugins/p/skills/p', 'plugins/q/skills/q']), 'threat-modeling', 'plugins/p');
    expect(found).toMatchObject({ dir: 'plugins/p/skills/p', fuzzy: true });
  });

  it('accepts a unique name relation as a flagged rename (git-guardrails -> git-guardrails-claude-code)', () => {
    const found = findSkillDir(cache(['skills/misc/git-guardrails-claude-code', 'skills/misc/grill-me']), 'git-guardrails');
    expect(found).toMatchObject({ dir: 'skills/misc/git-guardrails-claude-code', fuzzy: true });
  });

  it('refuses an ambiguous relation and never guesses among several candidates', () => {
    const found = findSkillDir(cache(['a/hf-jobs', 'b/hf-jobs-extra', 'c/other', 'd/thing']), 'hf-managed-jobs-x');
    expect(found.dir).toBeUndefined();
  });

  it('takes the only skill of a single-skill repository', () => {
    expect(findSkillDir(cache(['.']), 'maestro-mobile-testing')).toMatchObject({ dir: '.', fuzzy: true });
  });
});

describe('droppedExtras / detectLicence / loadCatalog', () => {
  it('lists upstream files the catalog copy lacks, ignoring SKILL.md and licence files', () => {
    expect(droppedExtras(['SKILL.md', 'LICENSE', 'scripts/a.py', 'references/x.md', 'rules/r.md'], ['SKILL.md', 'references/x.md'])).toEqual(['rules/r.md', 'scripts/a.py']);
  });

  it('recognises common licences and flags the unknown ones', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT License\n\nPermission is hereby granted, free of charge, to any person...');
    expect(detectLicence(dir)).toBe('MIT');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'Attribution-ShareAlike 4.0 International');
    expect(detectLicence(dir)).toBe('CC-BY-SA-4.0');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'Some custom terms');
    expect(detectLicence(dir)).toBe('unrecognised');
    expect(detectLicence(tmp())).toBeUndefined();
  });

  it('reads name, source, commit and licence from SKILL.md frontmatter', () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, 'demo/references'), { recursive: true });
    fs.writeFileSync(path.join(root, 'demo/SKILL.md'), `---\nname: demo\ndescription: d\nmetadata:\n  source: https://github.com/a/b\n  commit: ${SHA}\n  license: MIT\n---\nbody\n`);
    fs.writeFileSync(path.join(root, 'demo/references/r.md'), 'r');
    const [skill] = loadCatalog(root);
    expect(skill).toMatchObject({ name: 'demo', source: 'https://github.com/a/b', commit: SHA, license: 'MIT' });
    expect(skill.files).toEqual(['SKILL.md', 'references/r.md']);
  });
});

describe('the committed host-library/_upstream provenance', () => {
  const file = path.resolve('host-library/_upstream/skills.json');
  const skills = JSON.parse(fs.readFileSync(file, 'utf8')).skills as Record<string, SkillRecord>;
  const catalog = loadCatalog(path.resolve('registry/skills'));

  it('has exactly one record per catalog skill, each in one of the three provenance classes', () => {
    expect(Object.keys(skills).sort()).toEqual(catalog.map(skill => skill.name).sort());
    for (const record of Object.values(skills)) expect(['third-party-pinned', 'in-house', 'not-found']).toContain(record.provenance);
  });

  it('pins every third-party skill to a repo, path and full 40-character commit', () => {
    const pinned = Object.values(skills).filter(record => record.provenance === 'third-party-pinned');
    expect(pinned.length).toBeGreaterThan(20);
    for (const record of pinned) {
      expect(record.repo, record.skill).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(record.path, record.skill).toBeTruthy();
      expect(record.sha, record.skill).toMatch(/^[0-9a-f]{40}$/);
      expect(['declared', 'recovered-head']).toContain(record.pinKind);
    }
  });

  it('explains every not-found skill with the URLs tried or a note (never blocked, never silent)', () => {
    for (const record of Object.values(skills).filter(r => r.provenance === 'not-found')) {
      expect((record.triedUrls?.length ?? 0) + (record.notes?.length ?? 0), record.skill).toBeGreaterThan(0);
      expect(record.recoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('snapshots only folders that passed the audit gate, and they still pass it', () => {
    const upstream = path.resolve('host-library/_upstream');
    for (const record of Object.values(skills)) {
      const dir = path.join(upstream, record.skill);
      if (record.snapshot) {
        expect(record.audit?.verdict, record.skill).toBe('pass');
        expect(fs.existsSync(path.join(dir, 'SKILL.md')), record.skill).toBe(true);
        expect(auditDirectory(dir).verdict, `${record.skill} re-audit`).not.toBe('fail');
      } else {
        expect(fs.existsSync(dir), `${record.skill} must not be snapshotted`).toBe(false);
      }
    }
  });

  it('holds every skill whose audit did not pass (no snapshot, note explains why)', () => {
    for (const record of Object.values(skills).filter(r => r.audit && r.audit.verdict !== 'pass')) {
      expect(record.snapshot).toBeUndefined();
      expect(record.notes?.some(note => note.includes('security audit'))).toBe(true);
    }
  });
});
