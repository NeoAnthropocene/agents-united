import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR } from './helpers/native-roles.ts';
import { laidOutSkills, skillFolderText } from './helpers/skill-layout.ts';

/**
 * Plan 035 S4: the design, front-end and QA skills (Jamileh, Deniz, Emre) are rewritten with real,
 * role-specific substance (ADR 0040), and the skills no role loaded are wired to the role that plainly
 * owns the topic (decision D4). The shared contract is pinned by `skill-rewrite-contract.test.ts`.
 */

const SKILLS = path.resolve('registry/skills');
/** SKILL.md together with the supporting files of a laid-out skill (Plan 035, D16): the substance may sit in examples/ or references/. */
const skill = (name: string): string => skillFolderText(SKILLS, name);
const role = (name: string): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${name}.md`), 'utf8');

const SLICE = ['design-system-tokens', 'ui-component-spec', 'responsive-design-audit', 'accessibility-audit', 'design-handoff-spec', 'marketing-creative-design'] as const;

describe('S4: design, front-end and QA skills are rewritten', () => {
  for (const name of SLICE) {
    it(`${name} is at version 3.0.0 with its allowlist marker deleted`, () => {
      expect(skill(name)).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
      expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills', name))).toBe(false);
    });
  }
});

describe('S4: the six are converted to the skill layout (Plan 035, D16)', () => {
  it('each is listed in tests/fixtures/laid-out-skills, where tests/skill-layout.test.ts holds it to the layout', () => {
    expect(laidOutSkills()).toEqual(expect.arrayContaining([...SLICE]));
  });

  it('only accessibility-audit has scripts: design-system-tokens carries tables instead, because its loader has no shell', () => {
    const withScripts = SLICE.filter(n => fs.existsSync(path.join(SKILLS, n, 'scripts')));
    expect(withScripts).toEqual(['accessibility-audit']);
  });
});

describe('S4: skills no role loaded are wired to their owner (D4)', () => {
  it('Deniz loads ui-component-spec', () => expect(role('agency-frontend-architect')).toContain('`ui-component-spec`'));
  it('Jamileh loads brand-identity and banner-design', () => {
    const j = role('agency-creative-designer');
    expect(j).toContain('`brand-identity`');
    expect(j).toContain('`banner-design`');
  });
  it('Jamileh and Kaan load ux-writing', () => {
    expect(role('agency-creative-designer')).toContain('`ux-writing`');
    expect(role('agency-conversion-specialist')).toContain('`ux-writing`');
  });
  it('every wired skill is in the digital-agency bundle', () => {
    const bundle: string[] = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')).bundles['digital-agency'].skills;
    for (const n of ['ui-component-spec', 'brand-identity', 'banner-design', 'ux-writing']) expect(bundle).toContain(n);
  });
});

describe('S4: the substance each skill must carry', () => {
  it('design-system-tokens: three tiers (primitive, semantic, component), contrast pairs with ratios, a type and spacing scale rule, dark mode, no raw values in components, and the hand-off to Deniz', () => {
    const s = skill('design-system-tokens');
    expect(s).toMatch(/primitive/i);
    expect(s).toMatch(/semantic/i);
    expect(s).toMatch(/4\.5/);
    expect(s).toMatch(/scale/i);
    expect(s).toMatch(/dark/i);
    expect(s).toMatch(/design-tokens\.json/);
    expect(s).toMatch(/Deniz/);
  });

  it('ui-component-spec: anatomy, typed props, every state, keyboard and focus behaviour, test ids and content rules', () => {
    const s = skill('ui-component-spec');
    expect(s).toMatch(/anatomy/i);
    expect(s).toMatch(/props/i);
    expect(s).toMatch(/disabled/i);
    expect(s).toMatch(/keyboard/i);
    expect(s).toMatch(/focus/i);
    expect(s).toMatch(/data-testid/);
    expect(s).toMatch(/Emre/);
  });

  it('responsive-design-audit: the 375, 768 and 1440 matrix, reflow at 320, no horizontal scroll, touch target size, a Playwright check, and evidence per viewport', () => {
    const s = skill('responsive-design-audit');
    expect(s).toMatch(/375/);
    expect(s).toMatch(/768/);
    expect(s).toMatch(/1440/);
    expect(s).toMatch(/320/);
    expect(s).toMatch(/scrollWidth|horizontal scroll/i);
    expect(s).toMatch(/touch target/i);
    expect(s).toMatch(/playwright/i);
  });

  it('accessibility-audit: an automated pass with axe, a manual keyboard pass, severity mapping with the gate rule, what automation cannot see, and routing of each finding', () => {
    const s = skill('accessibility-audit');
    expect(s).toMatch(/axe/i);
    expect(s).toMatch(/keyboard/i);
    expect(s).toMatch(/critical/i);
    expect(s).toMatch(/serious/i);
    expect(s).toMatch(/cannot (see|detect|find)|does not (see|detect|prove)/i);
    expect(s).toMatch(/WCAG 2\.[12]/);
    expect(s).toMatch(/Deniz/);
    expect(s).toMatch(/Jamileh/);
  });

  it('design-handoff-spec: tokens not raw values, every state, responsive rules per breakpoint, motion and reduced motion, test ids, a definition of ready, and open questions', () => {
    const s = skill('design-handoff-spec');
    expect(s).toMatch(/token/i);
    expect(s).toMatch(/breakpoint/i);
    expect(s).toMatch(/reduced[- ]motion/i);
    expect(s).toMatch(/data-testid|test id/i);
    expect(s).toMatch(/definition of ready/i);
    expect(s).toMatch(/open question/i);
  });

  it('marketing-creative-design: draws its boundary with ad-creative-design, an export table with size budgets, brand-asset kit contents, and accessibility', () => {
    const s = skill('marketing-creative-design');
    expect(s).toMatch(/ad-creative-design/);
    expect(s).toMatch(/KB/);
    expect(s).toMatch(/SVG/);
    expect(s).toMatch(/contrast/i);
  });
});

describe('S4: provenance of the design skills with a not-found record is settled in writing', () => {
  const doc = fs.readFileSync(path.resolve('docs/skill-quality/design-provenance.md'), 'utf8');
  it('records the scan of both upstream repositories with their pinned commits and licences', () => {
    expect(doc).toContain('477bcb28c981');
    expect(doc).toContain('f596a61fa8f4');
    expect(doc).toMatch(/MIT/);
    expect(doc).toMatch(/Apache-2\.0/);
  });
  it('gives a verdict for each of the six skills', () => {
    for (const n of ['banner-design', 'brand-identity', 'ux-writing', 'stitch-design-taste', 'generative-ui', 'modern-web-guidance']) expect(doc).toContain(`\`${n}\``);
  });
  it('the two scan reports are committed beside the other candidate scans', () => {
    expect(fs.existsSync(path.resolve('host-library/_upstream/candidates/nextlevelbuilder__ui-ux-pro-max-skill.json'))).toBe(true);
    expect(fs.existsSync(path.resolve('host-library/_upstream/candidates/mrstev3n__balise-skills.json'))).toBe(true);
  });
});
