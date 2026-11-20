import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { EVIDENCE } from './helpers/native-invariant-evidence.js';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `paid-acquisition-specialist`: the first native file on a core of its own, in the Tier 1 form of `devops-engineer`, for the `performance-paid-acquisition` add-on.
 * No Tier 2 copy stands on this core (the digital agency has no paid-acquisition specialist), so its tools are pinned by the class ceiling of its core in native-claude-agents.test.ts and not by a sibling file.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts (here with the add-on switched on and no Tier 2 copy); this file holds what only the paid acquisition specialist says.
 */

describeMarketingRole({
  role: 'paid-acquisition-specialist',
  type: 'subagent-paid-acquisition-specialist',
  servers: ['context7'],
  artifact: false,
  peers: ['marketing-creative-designer', 'marketing-campaign-specialist', 'marketing-conversion-specialist', 'marketing-growth-strategist'],
  returns: 'the campaign blueprint, the keyword matrix, the ad copy variants, the conversion tracking specification',
  bundle: 'performance-paid-acquisition',
});

const text = (): string => nativeText('paid-acquisition-specialist');
const floorOf = (source: string): string => /<!-- agents-united:floor:start[\s\S]*?<!-- agents-united:floor:end -->/.exec(source)![0];
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native paid-acquisition-specialist: a core of its own', () => {
  it('has no Tier 2 copy, carries the identity of its core in the floor and holds only the context7 server of its canonical agent', () => {
    expect(fs.existsSync(path.resolve('registry/hosts/claude/agents/agency-paid-acquisition-specialist.md'))).toBe(false);
    expect(floorOf(text())).toContain('You are the Paid Acquisition and Performance Marketing Specialist of the growth-marketing department, working under the marketing lead orchestrator.');
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(tools.filter(tool => tool.startsWith('mcp__'))).toEqual(['mcp__context7', 'mcp__plugin_context7_context7']);
  });

  it('holds the web and the task tools only when its core grants those classes, and says so about the web in its Boundaries', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-paid-acquisition-specialist')!;
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    const boundaries = section('Boundaries of this host');
    if ((core.capabilities ?? []).includes('web')) {
      expect(tools).toEqual(expect.arrayContaining(['WebFetch', 'WebSearch']));
      expect(boundaries).not.toContain('You hold no web tools');
    } else {
      expect(tools).not.toContain('WebFetch');
      expect(tools).not.toContain('WebSearch');
      expect(boundaries).toContain('- You hold no web tools and no access to an ad platform.');
    }
  });
});

describe('native paid-acquisition-specialist: the five directives of the core, in the order of the work', () => {
  it('reads the data it is given and looks a platform up with the library server instead of memory', () => {
    expect(step(1)).toMatch(/^1\. \*\*Take in the brief and the data\.\*\*/);
    expect(step(1)).toContain('campaign exports, account notes and spend figures you are given');
    expect(step(1)).toContain('with `mcp__context7` instead of relying on memory');
  });

  it('architects the campaign by funnel stage', () => {
    expect(step(3)).toContain('Structure it as top-of-funnel prospecting, middle-of-funnel consideration and bottom-of-funnel retargeting, each with its objective, audience, budget share and success metric.');
  });

  it('builds exact and phrase match keyword sets and a negative keyword list', () => {
    expect(step(4)).toContain('high-intent exact and phrase match keyword sets and a comprehensive negative keyword list for each campaign');
  });

  it('targets B2B accounts by company size, industry, job seniority and tech stack', () => {
    expect(step(5)).toContain('account-based targeting filters by company size, industry, job seniority and tech stack');
  });

  it('pairs headlines with value propositions and emotional hooks in a test matrix whose variants have an identifier, a hypothesis and a metric', () => {
    expect(step(6)).toContain('Pair headlines with value propositions and distinct emotional hooks for multi-variant testing.');
    expect(step(6)).toContain('Every variant has an identifier, a hypothesis and a primary metric');
  });

  it('models CAC, the LTV to CAC ratio and payback, and states the assumption behind every figure', () => {
    expect(step(7)).toContain('Model blended and channel-specific customer acquisition cost, the LTV to CAC ratio and the payback period, and define the UTM taxonomy and the conversion events.');
    expect(step(7)).toContain('State every assumption behind a cost, return or payback figure; an estimate is never presented as an observed result.');
  });
});

describe('native paid-acquisition-specialist: inputs for whoever builds go back to the lead', () => {
  it('hands the tracking specification back to orchestrator-marketing as a fixed input, naming no engineering role', () => {
    expect(step(8)).toContain('Hand the tracking specification back to `orchestrator-marketing` as a fixed input for whoever implements the tags (the user\'s implementation team); you specify the events, you do not change application code.');
    expect(text().split('<!-- agents-united:floor:end -->')[1]).not.toMatch(/engineering (role|team)|frontend|backend/i);
  });

  it('sends the ad visuals, the landing pages and the campaign sequencing to their owners through the lead, and applies nothing in an account', () => {
    expect(step(6)).toContain('The visuals are a brief for `marketing-creative-designer`, handed over through the lead as a fixed input.');
    const boundaries = section('Boundaries of this host');
    expect(boundaries).toContain('the blueprint is a plan: applying it in an account belongs to whoever runs the account, through the lead.');
    expect(boundaries).toContain('- Ad visuals are `marketing-creative-designer`\'s, landing-page conversion work is `marketing-conversion-specialist`\'s and campaign sequencing is `marketing-campaign-specialist`\'s: hand them over through the lead.');
  });
});

describe('native paid-acquisition-specialist: the skill table is the four paid-acquisition skills of the add-on', () => {
  it('names exactly the skills its contract lists, all of them in performance-paid-acquisition', () => {
    const skills = [...text().matchAll(/^\| [^|]+ \| `([a-z0-9-]+)` \|/gm)].map(match => match[1]!).sort();
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-paid-acquisition-specialist.contract.json'), 'utf8')) as { skills: string[] };
    expect(skills).toEqual([...contract.skills].sort());
    expect(skills).toEqual(['ad-attribution-modeling', 'google-ads-optimization', 'meta-ad-creative-testing', 'paid-acquisition-ppc']);
  });
});

describe('native paid-acquisition-specialist: the two invariants beyond the shared comms ones', () => {
  it('binds a finished peer to the lead and a missing peer input to a stated assumption, through the shared evidence rules', () => {
    const finished = EVIDENCE['Do not message a peer that has already finished; ask the coordinator to relay instead.']!;
    const missing = EVIDENCE['If an expected peer input never arrives, proceed on a stated assumption and list the gap under open items.']!;
    expect(finished.test(text())).toBe(true);
    expect(missing.test(text())).toBe(true);
    expect(section('Working with peers')).toContain('when a peer has finished, ask the lead.');
    expect(section('Working with peers')).toContain('- **Never hang on a missing peer.** Proceed on a stated assumption and list the gap under `Open items`.');
  });
});
