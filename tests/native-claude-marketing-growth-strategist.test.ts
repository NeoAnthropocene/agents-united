import { describe, expect, it } from 'vitest';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-growth-strategist` (growth-marketing): the second native file on the core the digital agency's growth strategist stands on, in the Tier 1 form of `devops-engineer`.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts; this file holds what only the growth strategist says.
 */

describeMarketingRole({
  role: 'marketing-growth-strategist',
  type: 'subagent-marketing-growth-strategist',
  agency: 'agency-growth-strategist',
  servers: ['firecrawl'],
  artifact: true,
  peers: ['marketing-conversion-specialist', 'marketing-content-strategist', 'marketing-campaign-specialist', 'marketing-creative-designer', 'plg-strategist', 'paid-acquisition-specialist'],
  returns: 'the playbook',
});

const text = (): string => nativeText('marketing-growth-strategist');
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(/\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!)?.[0] ?? '';

describe('native marketing-growth-strategist: the funnel before the recommendation', () => {
  it('names the funnel bottleneck before it recommends anything, and holds back paid spend until the economics hold', () => {
    expect(step(1)).toMatch(/Name the funnel bottleneck \(Acquisition, Activation, Retention, Revenue or Referral\) before you recommend anything\./);
    expect(step(4)).toContain('Do not recommend paid spend until the unit economics hold');
  });

  it('writes the playbook in the format of the Output Contract, every experiment with a control, a variant and a primary metric', () => {
    expect(step(5)).toContain('in the format of the Output Contract');
    expect(step(5)).toContain('a control, a variant and a primary metric');
  });

  it('uses the one server it holds for a competitor teardown and says what it owns', () => {
    expect(step(3)).toContain('`mcp__firecrawl`');
    expect(text()).toContain('- This role owns strategy, not production: agree channel priorities and measurement in your handoff, and never produce another specialist\'s deliverable.');
  });
});
