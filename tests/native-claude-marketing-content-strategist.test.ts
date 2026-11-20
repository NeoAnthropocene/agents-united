import { describe, expect, it } from 'vitest';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-content-strategist` (growth-marketing, slice 1): the second native file on the core the digital agency's content strategist stands on, in the Tier 1 form of `devops-engineer`.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts; this file holds what only the content strategist says.
 */

describeMarketingRole({
  role: 'marketing-content-strategist',
  type: 'subagent-marketing-content-strategist',
  agency: 'agency-content-strategist',
  servers: ['firecrawl', 'markitdown'],
  artifact: false,
  peers: ['marketing-conversion-specialist', 'marketing-campaign-specialist', 'marketing-creative-designer', 'marketing-growth-strategist', 'seo-specialist'],
  returns: 'the strategy document',
});

const text = (): string => nativeText('marketing-content-strategist');
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(/\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!)?.[0] ?? '';

describe('native marketing-content-strategist: the SERP before the brief', () => {
  it('inspects the SERP first, reads the top results, and ingests a client deck with the document server it holds', () => {
    expect(step(1)).toMatch(/^1\. \*\*Inspect the SERP first\.\*\* Search intent and a read of the top-ranking competitor pages come before any brief\./);
    expect(step(1)).toContain('read the top three results for each with `WebFetch`');
    expect(step(1)).toContain('`mcp__markitdown`');
  });

  it('gives every content piece one search intent and one primary call to action, and every statistic its year and source URL', () => {
    expect(step(4)).toContain('Every content piece has one search intent and exactly one primary call to action');
    expect(step(4)).toContain('Every cited statistic carries its publication year and its source URL.');
  });

  it('flags machine-drafted text for human editorial review', () => {
    expect(step(7)).toContain('mark any machine-drafted text for human editorial review');
  });
});

describe('native marketing-content-strategist: hand-offs go through the lead, by type name', () => {
  it('hands each of the ten assets to a marketing type or the engineering team through the lead, as fixed inputs', () => {
    expect(step(5)).toContain('The newsletter snippet is for `marketing-campaign-specialist`, the visual brief for `marketing-creative-designer` and the FAQ pairs for `seo-specialist`: hand them over through the lead, as fixed inputs. The code recipe goes back to `orchestrator-marketing` as a fixed input for whoever builds the page (the user\'s implementation team).');
  });

  it('confirms topic and keyword ownership before it writes and never claims another specialist\'s cluster', () => {
    expect(text()).toContain('- Confirm topic and keyword ownership in your handoff before you write, and never claim another specialist\'s cluster.');
  });
});
