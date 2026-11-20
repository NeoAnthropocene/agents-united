import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { EVIDENCE } from './helpers/native-invariant-evidence.js';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `lifecycle-email-specialist` (n5, slice 5): the first native file on a core of its own, in the Tier 1 form of `devops-engineer`, for the `lifecycle-email-marketing` add-on.
 * No Tier 2 copy stands on this core (the digital agency has no lifecycle email specialist), so its tools are pinned by the class ceiling of its core in native-claude-agents.test.ts and not by a sibling file.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts (here with the add-on switched on and no Tier 2 copy); this file holds what only the lifecycle email specialist says.
 */

describeMarketingRole({
  role: 'lifecycle-email-specialist',
  type: 'subagent-lifecycle-email-specialist',
  servers: ['markitdown'],
  artifact: false,
  peers: ['marketing-campaign-specialist', 'marketing-growth-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer'],
  returns: 'the email sequence templates with their trigger definitions and delay intervals, the segment rules, the split-test matrices',
  bundle: 'lifecycle-email-marketing',
});

const text = (): string => nativeText('lifecycle-email-specialist');
const floorOf = (source: string): string => /<!-- agents-united:floor:start[\s\S]*?<!-- agents-united:floor:end -->/.exec(source)![0];
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native lifecycle-email-specialist: a core of its own', () => {
  it('has no Tier 2 copy, carries the identity of its core in the floor and holds only the markitdown server of its canonical agent', () => {
    expect(fs.existsSync(path.resolve('registry/hosts/claude/agents/agency-lifecycle-email-specialist.md'))).toBe(false);
    expect(floorOf(text())).toContain('You are the Lifecycle Email Marketing Specialist of the growth-marketing department, working under the marketing lead orchestrator.');
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(tools.filter(tool => tool.startsWith('mcp__'))).toEqual(['mcp__markitdown']);
  });

  it('holds the task tools its core grants through task-tracking, and no web tool because its core has no web class, and says so about the web in its Boundaries', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-lifecycle-email-specialist')!;
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(core.capabilities).toContain('task-tracking');
    expect(core.capabilities).not.toContain('web');
    expect(tools).toEqual(expect.arrayContaining(['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']));
    expect(tools).not.toContain('WebFetch');
    expect(tools).not.toContain('WebSearch');
    expect(section('Boundaries of this host')).toContain('- You hold no web tools and no access to a live email platform, a subscriber list or its analytics.');
  });
});

describe('native lifecycle-email-specialist: the five directives of the core, in the order of the work', () => {
  it('reads the data it is given and converts a brand guide, deck or export to markdown with the markitdown server', () => {
    expect(step(1)).toMatch(/^1\. \*\*Take in the brief and the data\.\*\*/);
    expect(step(1)).toContain('the lifecycle stages, the existing emails and templates, the brand voice notes and the segment descriptions or export summaries you are given');
    expect(step(1)).toContain('Convert a brand guide, a deck, a document or a spreadsheet export to markdown with `mcp__markitdown`');
  });

  it('architects the four behavior-triggered journeys with trigger, entry and exit conditions, delay and goal', () => {
    expect(step(3)).toContain('Architect the behavior-triggered journeys.');
    expect(step(3)).toContain('welcome onboarding, inactivity re-engagement, upgrade nudge and milestone celebration');
    expect(step(3)).toContain('the trigger event, the entry and exit conditions, the delay between emails and the goal');
  });

  it('designs churn prevention triggers and cancellation salvage flows, and states what every offer costs and when it must not fire', () => {
    expect(step(4)).toContain('proactive churn triggers (such as decreased login frequency) and multi-step cancellation salvage flows with discount offers or downgrade options');
    expect(step(4)).toContain('state what it costs and the moment it must not fire');
  });

  it('writes deliverability-aware copy with one call to action and claims no inbox placement it could not observe', () => {
    expect(step(5)).toContain('the subject line, the preview text, a personal narrative hook, the body in markdown or HTML and one clear call to action for every email');
    expect(step(5)).toContain('Sender authentication (SPF, DKIM and DMARC) is a precondition you name under `Open items`');
    expect(step(5)).toContain('you never claim an inbox placement you could not observe');
  });

  it('defines the segments from roles, usage tiers and engagement history', () => {
    expect(step(6)).toContain('user roles, product usage tiers and engagement history');
  });

  it('designs split tests for subject lines, send times and sender identities, and states the assumption behind every figure', () => {
    expect(step(7)).toContain('matrices for subject lines, send times and sender identities, each with its metric and a sample-size note');
    expect(step(7)).toContain('Every open-rate, conversion or retention figure carries its assumption; an estimate is never presented as an observed result.');
  });
});

describe('native lifecycle-email-specialist: the sequences go back to the lead', () => {
  it('hands the sequences with their triggers and timing back to orchestrator-marketing as a fixed input, naming no engineering role', () => {
    expect(step(8)).toContain('Hand the sequences with their triggers and timing back to `orchestrator-marketing` as a fixed input for whoever loads them into the email platform (the user\'s team); you author and specify, you send no email and configure no platform.');
    expect(text().split('<!-- agents-united:floor:end -->')[1]).not.toMatch(/engineering (role|team)|frontend|backend/i);
  });

  it('sends launch campaigns, channel priorities, conversion copy and template design to their owners through the lead, and sends nothing itself', () => {
    const boundaries = section('Boundaries of this host');
    expect(boundaries).toContain('loading and sending them belongs to whoever runs the email platform, through the lead.');
    expect(boundaries).toContain('- Launch and announcement campaign sequencing is `marketing-campaign-specialist`\'s, channel priorities and funnel metrics are `marketing-growth-strategist`\'s, landing-page conversion copy and its tests are `marketing-conversion-specialist`\'s and the visual design of email templates is `marketing-creative-designer`\'s: hand them over through the lead.');
  });
});

describe('native lifecycle-email-specialist: the skill table is the four lifecycle-email-marketing skills', () => {
  it('names exactly the skills its contract lists, all of them in lifecycle-email-marketing', () => {
    const skills = [...text().matchAll(/^\| [^|]+ \| `([a-z0-9-]+)` \|/gm)].map(match => match[1]!).sort();
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-lifecycle-email-specialist.contract.json'), 'utf8')) as { skills: string[] };
    expect(skills).toEqual([...contract.skills].sort());
    expect(skills).toEqual(['churn-prevention-playbook', 'copywriting-frameworks', 'email-drip-sequences', 'email-marketing-automation']);
  });
});

describe('native lifecycle-email-specialist: the two invariants beyond the shared comms ones', () => {
  it('binds a finished peer to the lead and a missing peer input to a stated assumption, through the shared evidence rules', () => {
    const finished = EVIDENCE['Do not message a peer that has already finished; ask the coordinator to relay instead.']!;
    const missing = EVIDENCE['If an expected peer input never arrives, proceed on a stated assumption and list the gap under open items.']!;
    expect(finished.test(text())).toBe(true);
    expect(missing.test(text())).toBe(true);
    expect(section('Working with peers')).toContain('when a peer has finished, ask the lead.');
    expect(section('Working with peers')).toContain('- **Never hang on a missing peer.** Proceed on a stated assumption and list the gap under `Open items`.');
  });
});
