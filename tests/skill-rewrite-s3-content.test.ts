import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR } from './helpers/native-roles.ts';

/**
 * Plan 035 S3: the content, copy and campaign skills (Yavuz, Jale, Jamileh) are rewritten with real,
 * role-specific substance (ADR 0040). The shared contract is pinned by `skill-rewrite-contract.test.ts`;
 * this file pins that these seven ARE rewritten, that the roles still load them, and the substance each
 * one must carry.
 */

const SKILLS = path.resolve('registry/skills');
const skill = (name: string): string => fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const role = (name: string): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${name}.md`), 'utf8');

const SLICE = ['copywriting-frameworks', 'content-calendar-strategy', 'email-marketing-automation', 'email-drip-sequences', 'social-media-campaign', 'product-launch-playbook', 'ad-creative-design'] as const;

describe('S3: content, copy and campaign skills are rewritten', () => {
  for (const name of SLICE) {
    it(`${name} is at version 3.0.0 with its allowlist marker deleted`, () => {
      expect(skill(name)).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
      expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills', name))).toBe(false);
    });
  }

  it('the roles still load them by name', () => {
    const yavuz = role('agency-content-strategist');
    for (const n of ['copywriting-frameworks', 'content-calendar-strategy']) expect(yavuz).toContain(`\`${n}\``);
    const jale = role('agency-campaign-specialist');
    for (const n of ['email-drip-sequences', 'email-marketing-automation', 'product-launch-playbook', 'social-media-campaign']) expect(jale).toContain(`\`${n}\``);
    expect(role('agency-creative-designer')).toContain('`ad-creative-design`');
    expect(role('agency-conversion-specialist')).toContain('`copywriting-frameworks`');
  });
});

describe('S3: the substance each skill must carry', () => {
  it('copywriting-frameworks: source material first, one claim per piece, a voice profile from real samples, a banned-phrase list, a claim audit and the five-second test', () => {
    const s = skill('copywriting-frameworks');
    expect(s).toMatch(/source material/i);
    expect(s).toMatch(/one claim/i);
    expect(s).toMatch(/voice profile/i);
    expect(s).toMatch(/banned|never write/i);
    expect(s).toMatch(/claim audit/i);
    expect(s).toMatch(/five-second/i);
    expect(s).toMatch(/PAS|problem.{1,20}agitat/i);
    expect(s).toMatch(/Kaan|Jale/);
  });

  it('content-calendar-strategy: pillars before cluster articles, capacity in hours, dependencies, a refresh cadence, and the ten-field brief it feeds', () => {
    const s = skill('content-calendar-strategy');
    expect(s).toMatch(/pillar/i);
    expect(s).toMatch(/capacity/i);
    expect(s).toMatch(/depend/i);
    expect(s).toMatch(/refresh/i);
    expect(s).toMatch(/Selin/);
  });

  it('email-marketing-automation: authentication (SPF, DKIM, DMARC), one-click unsubscribe, consent and suppression, frequency caps, segmentation and the compliance footer', () => {
    const s = skill('email-marketing-automation');
    expect(s).toMatch(/SPF/);
    expect(s).toMatch(/DKIM/);
    expect(s).toMatch(/DMARC/);
    expect(s).toMatch(/one-click unsubscribe/i);
    expect(s).toMatch(/suppression/i);
    expect(s).toMatch(/frequency cap/i);
    expect(s).toMatch(/Defne/);
  });

  it('email-drip-sequences: one purpose per email, an exit condition, spacing, subject and preview limits, and UTM tagging', () => {
    const s = skill('email-drip-sequences');
    expect(s).toMatch(/one purpose/i);
    expect(s).toMatch(/exit/i);
    expect(s).toMatch(/preview/i);
    expect(s).toMatch(/utm_/);
  });

  it('social-media-campaign: platform-native shapes, one claim per post, disclosure of paid or sponsored content, no engagement bait, a response plan, and measurement', () => {
    const s = skill('social-media-campaign');
    expect(s).toMatch(/platform-native|native to the platform/i);
    expect(s).toMatch(/one claim/i);
    expect(s).toMatch(/disclos/i);
    expect(s).toMatch(/engagement bait/i);
    expect(s).toMatch(/response plan|moderation/i);
  });

  it('product-launch-playbook: positioning before copy, a dated T-minus checklist with owners, a launch tier, a rollback or incident plan, no vote solicitation, and post-launch measurement', () => {
    const s = skill('product-launch-playbook');
    expect(s).toMatch(/positioning/i);
    expect(s).toMatch(/T-14/);
    expect(s).toMatch(/owner/i);
    expect(s).toMatch(/tier/i);
    expect(s).toMatch(/rollback|incident/i);
    expect(s).toMatch(/upvote|vote/i);
  });

  it('ad-creative-design: a size and safe-zone table to verify against the platform, a variant matrix of angle by format, a naming convention, contrast, and claims review by Defne', () => {
    const s = skill('ad-creative-design');
    expect(s).toMatch(/1080/);
    expect(s).toMatch(/safe zone/i);
    expect(s).toMatch(/variant/i);
    expect(s).toMatch(/naming/i);
    expect(s).toMatch(/contrast/i);
    expect(s).toMatch(/Defne/);
    expect(s).toMatch(/verify/i);
  });
});
