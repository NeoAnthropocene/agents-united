import { describe, expect, it } from 'vitest';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-campaign-specialist` (n5, slice 1): the second native file on the core the digital agency's campaign specialist stands on, in the Tier 1 form of `devops-engineer`.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts; this file holds what only the campaign specialist says.
 */

describeMarketingRole({
  role: 'marketing-campaign-specialist',
  type: 'subagent-marketing-campaign-specialist',
  agency: 'agency-campaign-specialist',
  servers: ['context7'],
  artifact: false,
  peers: ['marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-content-strategist', 'marketing-growth-strategist', 'lifecycle-email-specialist'],
  returns: 'the campaign kit',
});

const text = (): string => nativeText('marketing-campaign-specialist');
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(/\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!)?.[0] ?? '';

describe('native marketing-campaign-specialist: tracking, compliance and one action', () => {
  it('tags every outgoing link with the four UTM parameters', () => {
    expect(step(3)).toContain('Every outgoing link carries `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`');
  });

  it('makes every email carry a postal address, a one-click unsubscribe and a truthful sender, and discloses sponsored content', () => {
    expect(step(4)).toContain('Every email template carries a physical postal address, a one-click unsubscribe and a truthful sender identity');
    expect(step(4)).toContain('`List-Unsubscribe`');
    expect(step(5)).toContain('Every sponsored or endorsed asset carries a clear disclosure (`#ad`, `#sponsored`, `rel="sponsored"`)');
  });

  it('gives each campaign asset exactly one primary call to action', () => {
    expect(step(6)).toContain('Every campaign asset has exactly one primary call to action');
  });

  it('looks a platform up with the library server it holds instead of relying on memory', () => {
    expect(step(1)).toContain('look up an email or analytics platform\'s documentation with `mcp__context7` instead of relying on memory');
  });
});

describe('native marketing-campaign-specialist: sequencing, not copy or design', () => {
  it('treats a send time as content, sequences hand-offs through the lead and leaves landing-page copy and visual design to their owners', () => {
    expect(text()).toContain('- A send time in a campaign plan is content, not an action you take. Sequence the hand-offs for copy, creative and tracking through the lead: the campaign brief stays the single source of truth.');
    expect(text()).toContain('Landing-page conversion copy is `marketing-conversion-specialist`\'s and visual design is `marketing-creative-designer`\'s.');
  });
});
