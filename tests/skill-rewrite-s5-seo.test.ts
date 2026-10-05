import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR } from './helpers/native-roles.ts';
import { laidOutSkills, skillFolderText } from './helpers/skill-layout.ts';

/**
 * Plan 035 S5: the SEO skills (Selin) are rewritten with real, role-specific substance (ADR 0040).
 * The shared contract is pinned by `skill-rewrite-contract.test.ts`; this file pins that these four ARE
 * rewritten, that Selin still loads them, and the substance each must carry.
 */

const SKILLS = path.resolve('registry/skills');
/** SKILL.md together with the supporting files of a laid-out skill (Plan 035, D16): the substance may sit in examples/ or references/. */
const skill = (name: string): string => skillFolderText(SKILLS, name);
const role = (name: string): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${name}.md`), 'utf8');

const SLICE = ['seo-audit', 'technical-seo-audit', 'programmatic-seo', 'schema-markup-strategy'] as const;

describe('S5: SEO skills are rewritten', () => {
  for (const name of SLICE) {
    it(`${name} is at version 3.0.0 with its allowlist marker deleted`, () => {
      expect(skill(name)).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
      expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills', name))).toBe(false);
    });
  }

  it('all four are converted to the skill layout: each is listed in tests/fixtures/laid-out-skills, where tests/skill-layout.test.ts holds it to the layout', () => {
    expect(laidOutSkills()).toEqual(expect.arrayContaining([...SLICE]));
  });

  it('the two audits carry a helper for Selin (who has a shell); programmatic-seo and schema-markup-strategy have none', () => {
    const withScripts = SLICE.filter(n => fs.existsSync(path.join(SKILLS, n, 'scripts')));
    expect(withScripts).toEqual(['seo-audit', 'technical-seo-audit']);
  });

  it('Selin loads all four, and Yavuz still loads seo-audit', () => {
    const selin = role('agency-seo-specialist');
    for (const n of SLICE) expect(selin).toContain(`\`${n}\``);
    expect(role('agency-content-strategist')).toContain('`seo-audit`');
  });
});

describe('S5: the substance each skill must carry', () => {
  it('seo-audit: technical blockers before content, one primary intent per URL, severity, the health score rule, impact against effort, and findings that name a page and an owner', () => {
    const s = skill('seo-audit');
    expect(s).toMatch(/technical blockers? (come |go )?first|before content/i);
    expect(s).toMatch(/search intent/i);
    expect(s).toMatch(/critical/i);
    expect(s).toMatch(/health score/i);
    expect(s).toMatch(/impact/i);
    expect(s).toMatch(/Yavuz/);
    expect(s).toMatch(/Deniz/);
  });

  it('technical-seo-audit: every one of the 15 checks with how to verify it, robots and sitemap limits, redirect chains, canonical, Core Web Vitals at the 75th percentile with field versus lab data, and how to check from a shell on both platforms', () => {
    const s = skill('technical-seo-audit');
    expect(s).toMatch(/robots\.txt/);
    expect(s).toMatch(/50,000/);
    expect(s).toMatch(/canonical/i);
    expect(s).toMatch(/redirect chain/i);
    expect(s).toMatch(/75th percentile/i);
    expect(s).toMatch(/field data/i);
    expect(s).toMatch(/lab/i);
    expect(s).toMatch(/curl\.exe|Invoke-WebRequest/);
    expect(s).toMatch(/noindex/);
    expect(s).toMatch(/staging/i);
  });

  it('programmatic-seo: the data must differ per page, a boilerplate ceiling, no thin pages published, hub pages and internal links, sitemap partitions, and monitoring of indexation', () => {
    const s = skill('programmatic-seo');
    expect(s).toMatch(/thin/i);
    expect(s).toMatch(/boilerplate/i);
    expect(s).toMatch(/hub/i);
    expect(s).toMatch(/sitemap/i);
    expect(s).toMatch(/410|noindex/);
    expect(s).toMatch(/cannibali[sz]/i);
  });

  it('schema-markup-strategy: JSON-LD matched to the visible page, required properties checked at the source, the FAQ and how-to restrictions, no marked-up content that is not on the page, and validation steps', () => {
    const s = skill('schema-markup-strategy');
    expect(s).toMatch(/JSON-LD/);
    expect(s).toMatch(/visible/i);
    expect(s).toMatch(/FAQPage/);
    expect(s).toMatch(/restrict|eligib/i);
    expect(s).toMatch(/Rich Results Test/i);
    expect(s).toMatch(/@graph/);
  });
});
