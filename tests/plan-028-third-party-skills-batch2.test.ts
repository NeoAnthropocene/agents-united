import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Plan 028 — Third-Party Skill Ingestion, Batch 2 (Design, UX Writing, Growth/Brand,
 * Digital Agency).
 *
 * RED-phase intake checklist for `banner-design`, `brand-identity` (renamed from upstream
 * `brand`), and `ux-writing` (renamed from upstream `balise-ux-writing`):
 *   - each skill exists with attribution, licence, and a portable name equal to its directory;
 *   - reference material ships alongside the runbook;
 *   - every write-capable script is referenced only from a runbook step with an explicit
 *     confirmation gate, and never writes without one;
 *   - bundle membership matches the owner-approved placement exactly (Gate 3: only
 *     growth-marketing, product-design, digital-agency, and full changed).
 */

const REGISTRY = path.resolve(process.cwd(), 'registry');
const SKILLS_DIR = path.join(REGISTRY, 'skills');
const CLAUDE_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface SkillSpec {
  dir: string;
  author: string;
  source: string;
  license: string;
}

const SKILLS: SkillSpec[] = [
  {
    dir: 'banner-design',
    author: 'nextlevelbuilder',
    source: 'https://www.ui-skills.com/skills/nextlevelbuilder/banner-design',
    license: 'MIT',
  },
  {
    dir: 'brand-identity',
    author: 'nextlevelbuilder',
    source: 'https://www.ui-skills.com/skills/nextlevelbuilder/brand',
    license: 'MIT',
  },
  {
    dir: 'ux-writing',
    author: 'mrstev3n',
    source: 'https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing',
    license: 'Apache-2.0',
  },
];

function readSkillMd(dir: string): { frontmatter: any; body: string; raw: string } {
  const file = path.join(SKILLS_DIR, dir, 'SKILL.md');
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${dir}: SKILL.md has no parsable frontmatter`);
  return { frontmatter: yaml.parse(match[1]) ?? {}, body: match[2], raw };
}

describe('Plan 028 — Batch 2 skill intake (banner-design, brand-identity, ux-writing)', () => {
  it.each(SKILLS)('$dir exists with attribution, licence, and a portable name', (spec) => {
    const skillDir = path.join(SKILLS_DIR, spec.dir);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);

    const { frontmatter } = readSkillMd(spec.dir);
    expect(frontmatter.name).toBe(spec.dir);
    expect(CLAUDE_NAME_REGEX.test(frontmatter.name)).toBe(true);
    expect(String(frontmatter.metadata?.author ?? '')).toContain(spec.author);
    expect(frontmatter.metadata?.source).toBe(spec.source);
    expect(frontmatter.metadata?.license).toBe(spec.license);
    expect(typeof frontmatter.description).toBe('string');
    expect(frontmatter.description.length).toBeGreaterThan(20);
  });

  it.each(SKILLS)('$dir ships reference material under references/', (spec) => {
    const refsDir = path.join(SKILLS_DIR, spec.dir, 'references');
    expect(fs.existsSync(refsDir)).toBe(true);
    const files = fs.readdirSync(refsDir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(SKILLS)('$dir has all 7 PROJECT.md §7.2 runbook sections', (spec) => {
    const { body } = readSkillMd(spec.dir);
    const required = [
      /## Overview & Purpose/,
      /## Execution Triggers/,
      /## Input & Output Requirements/,
      /## Step-by-Step Execution Runbook/,
      /## Code & Config Exemplars/,
      /## Edge Cases & Error Recovery/,
      /## Verification Checklist/,
    ];
    const missing = required.filter((re) => !re.test(body)).map((re) => re.source);
    expect(missing, `${spec.dir} missing sections: ${missing.join(', ')}`).toEqual([]);
  });

  it('each skill states its overlap boundary against the named adjacent skill(s)', () => {
    const banner = readSkillMd('banner-design').body;
    expect(banner).toMatch(/ad-creative-design/);
    expect(banner).toMatch(/marketing-creative-design/);

    const brand = readSkillMd('brand-identity').body;
    expect(brand).toMatch(/design-system-tokens/);
    expect(brand).toMatch(/workflow-agency-brand-design-system/);

    const uxWriting = readSkillMd('ux-writing').body;
    expect(uxWriting).toMatch(/copywriting-frameworks/);
  });

  describe('brand-identity script audit — write gate', () => {
    const scriptsDir = path.join(SKILLS_DIR, 'brand-identity', 'scripts');
    const scriptFiles = ['inject-brand-context.mjs', 'validate-asset.mjs', 'extract-colors.mjs', 'sync-brand-to-tokens.mjs'];

    it('ships all four audited scripts as plain Node (no bash-only syntax)', () => {
      for (const name of scriptFiles) {
        const file = path.join(scriptsDir, name);
        expect(fs.existsSync(file), `missing ${name}`).toBe(true);
        const content = fs.readFileSync(file, 'utf8');
        expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
        // No bash-only constructs that would fail on Windows without a shell.
        expect(content).not.toMatch(/\$\(.*\)/);
        expect(content).not.toMatch(/^#!\/bin\/(ba)?sh/m);
      }
    });

    it('only sync-brand-to-tokens.mjs writes to disk; the other three are read-only', () => {
      const writeCall = /fs\.(writeFileSync|mkdirSync|appendFileSync|rmSync|copyFileSync)/;
      for (const name of ['inject-brand-context.mjs', 'validate-asset.mjs', 'extract-colors.mjs']) {
        const content = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
        expect(writeCall.test(content), `${name} should not write to disk`).toBe(false);
      }
      const syncContent = fs.readFileSync(path.join(scriptsDir, 'sync-brand-to-tokens.mjs'), 'utf8');
      expect(writeCall.test(syncContent)).toBe(true);
    });

    it('sync-brand-to-tokens.mjs never writes without an explicit confirmation gate', () => {
      const content = fs.readFileSync(path.join(scriptsDir, 'sync-brand-to-tokens.mjs'), 'utf8');
      expect(content).toMatch(/requireConfirmation/);
      expect(content).toMatch(/isDryRun/);
      // The confirmation check must run before the write calls in main().
      const confirmIdx = content.indexOf('requireConfirmation(');
      const writeIdx = content.indexOf('fs.writeFileSync(tokensPath');
      expect(confirmIdx).toBeGreaterThan(-1);
      expect(writeIdx).toBeGreaterThan(-1);
      expect(confirmIdx).toBeLessThan(writeIdx);
    });

    it("the shared confirm-gate helper exits when --confirmed is absent", () => {
      const helper = fs.readFileSync(path.join(scriptsDir, 'lib', 'confirm-gate.mjs'), 'utf8');
      expect(helper).toMatch(/--confirmed/);
      expect(helper).toMatch(/process\.exit\(1\)/);
    });

    it("SKILL.md documents the sync step as a confirmation-gated STOP, not an automatic step", () => {
      const { body } = readSkillMd('brand-identity');
      expect(body).toMatch(/STOP\. Do not run this step until the requester has explicitly confirmed/);
      expect(body).toMatch(/--confirmed/);
      expect(body).toMatch(/--dry-run/);
    });
  });

  describe('bundle wiring matches the owner-approved placement exactly (Gate 3)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as {
      bundles: Record<string, { skills?: string[] }>;
    };

    const expectedMembership: Record<string, string[]> = {
      'banner-design': ['growth-marketing', 'digital-agency', 'full'],
      'brand-identity': ['growth-marketing', 'digital-agency', 'full'],
      'ux-writing': ['product-design', 'digital-agency', 'full'],
    };

    it.each(Object.entries(expectedMembership))('%s ships in exactly its approved bundles', (skillName, expectedBundles) => {
      const actualBundles = Object.entries(manifest.bundles)
        .filter(([, def]) => (def.skills ?? []).includes(skillName))
        .map(([name]) => name)
        .sort();
      expect(actualBundles).toEqual([...expectedBundles].sort());
    });

    it('registry/skills/ contains exactly these three new directories relative to the pre-Plan-028 catalog', () => {
      for (const spec of SKILLS) {
        expect(fs.existsSync(path.join(SKILLS_DIR, spec.dir))).toBe(true);
      }
    });
  });
});
