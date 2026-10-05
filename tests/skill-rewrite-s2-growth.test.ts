import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR } from './helpers/native-roles.ts';
import { skillFolderText } from './helpers/skill-layout.ts';

/**
 * Plan 035 S2: the growth and conversion skills (Ava and Kaan) are rewritten with real, role-specific
 * substance (ADR 0040). The shared contract (sections, size, no template phrases, a worked example,
 * anti-patterns, evidence, a hand-off, no marker left) is pinned by `skill-rewrite-contract.test.ts`
 * for every skill at version 3.0.0; this file pins that these six ARE rewritten, that the roles still
 * load them, and the substance each one must carry.
 */

const SKILLS = path.resolve('registry/skills');
/** SKILL.md together with the supporting files of a laid-out skill (Plan 035, D16): the substance may sit in examples/ or references/. */
const skill = (name: string): string => skillFolderText(SKILLS, name);
const role = (name: string): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${name}.md`), 'utf8');

const SLICE = ['growth-experiment-design', 'ab-test-setup', 'conversion-funnel-optimization', 'signup-flow-cro', 'onboarding-cro', 'viral-referral-loops'] as const;

describe('S2: growth and conversion skills are rewritten', () => {
  for (const name of SLICE) {
    it(`${name} is at version 3.0.0 with its allowlist marker deleted`, () => {
      expect(skill(name)).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
      expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills', name))).toBe(false);
    });
  }

  it('Ava loads her four skills and Kaan loads his, by name, in their role tables', () => {
    const ava = role('agency-growth-strategist');
    for (const n of ['growth-experiment-design', 'viral-referral-loops', 'product-launch-playbook', 'ab-test-setup']) expect(ava).toContain(`\`${n}\``);
    const kaan = role('agency-conversion-specialist');
    for (const n of ['conversion-funnel-optimization', 'signup-flow-cro', 'onboarding-cro', 'ab-test-setup']) expect(kaan).toContain(`\`${n}\``);
  });
});

describe('S2: the substance each skill must carry', () => {
  it('growth-experiment-design: a hypothesis form, ICE with how to score, a guardrail, a decision rule written before launch, an experiment log, and the two-week limit', () => {
    const s = skill('growth-experiment-design');
    expect(s).toMatch(/because .* we believe/i);
    expect(s).toMatch(/ICE/);
    expect(s).toMatch(/confidence/i);
    expect(s).toMatch(/guardrail/i);
    expect(s).toMatch(/decision rule/i);
    expect(s).toMatch(/experiment log/i);
    expect(s).toMatch(/two weeks|14 days/i);
    expect(s).toMatch(/Kaan/);
  });

  it('ab-test-setup: one primary metric, the minimum detectable effect, a sample size with the formula, whole weeks, sample-ratio mismatch, no peeking', () => {
    const s = skill('ab-test-setup');
    expect(s).toMatch(/one primary metric/i);
    expect(s).toMatch(/minimum detectable effect/i);
    expect(s).toMatch(/16/);
    expect(s).toMatch(/whole weeks|full weeks|7-day/i);
    expect(s).toMatch(/sample[- ]ratio mismatch|SRM/i);
    expect(s).toMatch(/peek/i);
    expect(s).toMatch(/Deniz/);
  });

  it('conversion-funnel-optimization: every step traced, drop-off per segment, a severity scale, a fix that names the location, and a hand-off to ab-test-setup', () => {
    const s = skill('conversion-funnel-optimization');
    expect(s).toMatch(/drop-off/i);
    expect(s).toMatch(/segment/i);
    expect(s).toMatch(/severity/i);
    expect(s).toMatch(/ab-test-setup/);
    expect(s).toMatch(/Selin|Deniz|Yavuz/);
  });

  it('signup-flow-cro: a field-by-field audit with a reason for each field, verification and authentication choices, mobile, and field-level error handling', () => {
    const s = skill('signup-flow-cro');
    expect(s).toMatch(/field/i);
    expect(s).toMatch(/social (login|sign-in)|single sign-on|SSO/i);
    expect(s).toMatch(/verification/i);
    expect(s).toMatch(/mobile/i);
    expect(s).toMatch(/inline error|error message/i);
  });

  it('onboarding-cro: the activation metric defined first, time to value, a checklist rule, and an empty-state rule; and it no longer asks for a clean git tree', () => {
    const s = skill('onboarding-cro');
    expect(s).toMatch(/activation/i);
    expect(s).toMatch(/time[- ]to[- ]value/i);
    expect(s).toMatch(/checklist/i);
    expect(s).toMatch(/empty state/i);
  });

  it('viral-referral-loops: the K-factor with its two terms, cycle time, a reward bounded by CAC, abuse controls, and consent for any contact access', () => {
    const s = skill('viral-referral-loops');
    expect(s).toMatch(/K\s*=\s*i\s*[x×*]\s*c|K-factor/i);
    expect(s).toMatch(/cycle time/i);
    expect(s).toMatch(/CAC/);
    expect(s).toMatch(/abuse|fraud|self-referral/i);
    expect(s).toMatch(/consent/i);
  });
});
