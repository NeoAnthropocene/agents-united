import { describe, expect, it } from 'vitest';
import { describeMarketingRole, OUT_OF_DEPARTMENT_HANDOFF } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-conversion-specialist` (n5, slice 1): the second native file on the core the digital agency's conversion specialist stands on, in the Tier 1 form of `devops-engineer`.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts; this file holds what only the conversion specialist says.
 */

describeMarketingRole({
  role: 'marketing-conversion-specialist',
  type: 'subagent-marketing-conversion-specialist',
  agency: 'agency-conversion-specialist',
  servers: ['playwright', 'chrome-devtools-mcp'],
  artifact: false,
  peers: ['marketing-growth-strategist', 'marketing-creative-designer', 'marketing-content-strategist', 'marketing-campaign-specialist', 'plg-strategist'],
  returns: 'the audit report, the props',
});

const text = (): string => nativeText('marketing-conversion-specialist');
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(/\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!)?.[0] ?? '';

describe('native marketing-conversion-specialist: the funnel before the copy', () => {
  it('ingests the funnel first and audits a live page with the two browser servers it holds', () => {
    expect(step(1)).toMatch(/^1\. \*\*Ingest the funnel\.\*\*/);
    expect(step(3)).toContain('`mcp__playwright` and `mcp__chrome-devtools-mcp` open a live page and measure it');
    expect(step(3)).toContain('touch targets of at least 48 by 48 pixels');
    expect(step(3)).toContain('button contrast of at least 4.5 to 1');
  });

  it('scores every hypothesis and gives every A/B brief its sample size, and a stable testId to every call to action', () => {
    expect(step(4)).toContain('Score each hypothesis for Impact, Confidence and Ease');
    expect(step(4)).toContain('minimum detectable effect and sample size per variant');
    expect(step(5)).toContain('a stable `testId` on every call to action');
  });

  it('verifies every trust assertion against a client source before it goes into copy', () => {
    expect(step(5)).toContain('Verify every trust assertion (a badge, a customer count, a case-study metric) against a client source before it goes into copy.');
  });
});

describe('native marketing-conversion-specialist: copy, not design or code', () => {
  it('hands the typed section props back to the lead as a fixed input for whoever builds the page and leaves visual design to the creative designer', () => {
    expect(text()).toContain('- The typed section props are the contract whoever builds the page renders (the user\'s implementation team): hand them back to `orchestrator-marketing` as a fixed input, and never produce the design or the component code yourself. Visual design belongs to `marketing-creative-designer`.');
  });
});

describe('native marketing-conversion-specialist: the hand-off outside the department', () => {
  it('carries the one sentence that sends a hand-off to a role outside marketing through the lead', () => {
    const body = nativeText('marketing-conversion-specialist').split('<!-- agents-united:floor:end -->')[1]!;
    expect(body).toContain(OUT_OF_DEPARTMENT_HANDOFF);
    expect(body.split(OUT_OF_DEPARTMENT_HANDOFF).length).toBe(2);
  });
});
