import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { EVIDENCE } from './helpers/native-invariant-evidence.js';
import { describeMarketingRole } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `plg-strategist`: the first native file on a core of its own, in the Tier 1 form of `devops-engineer`, for the `product-led-growth` add-on.
 * No Tier 2 copy stands on this core (the digital agency has no PLG strategist), so its tools are pinned by the class ceiling of its core in native-claude-agents.test.ts and not by a sibling file.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts (here with the add-on switched on and no Tier 2 copy); this file holds what only the PLG strategist says.
 */

describeMarketingRole({
  role: 'plg-strategist',
  type: 'subagent-plg-strategist',
  servers: ['context7'],
  artifact: false,
  peers: ['marketing-growth-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-campaign-specialist'],
  returns: 'the user journey flowcharts, the in-app copy specifications, the experiment hypotheses, the event telemetry schemas',
  bundle: 'product-led-growth',
});

const text = (): string => nativeText('plg-strategist');
const floorOf = (source: string): string => /<!-- agents-united:floor:start[\s\S]*?<!-- agents-united:floor:end -->/.exec(source)![0];
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native plg-strategist: a core of its own', () => {
  it('has no Tier 2 copy, carries the identity of its core in the floor and holds only the context7 server of its canonical agent', () => {
    expect(fs.existsSync(path.resolve('registry/hosts/claude/agents/agency-plg-strategist.md'))).toBe(false);
    expect(floorOf(text())).toContain('You are the Product-Led Growth and Conversion Rate Optimization Strategist of the growth-marketing department, working under the marketing lead orchestrator.');
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(tools.filter(tool => tool.startsWith('mcp__'))).toEqual(['mcp__context7', 'mcp__plugin_context7_context7']);
  });

  it('holds the task tools its core grants through task-tracking, and no web tool because its core has no web class, and says so about the web in its Boundaries', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-plg-strategist')!;
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(core.capabilities).toContain('task-tracking');
    expect(core.capabilities).not.toContain('web');
    expect(tools).toEqual(expect.arrayContaining(['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']));
    expect(tools).not.toContain('WebFetch');
    expect(tools).not.toContain('WebSearch');
    expect(section('Boundaries of this host')).toContain('- You hold no web tools and no access to a live product or its analytics.');
  });
});

describe('native plg-strategist: the five directives of the core, in the order of the work', () => {
  it('reads the data it is given and looks an analytics platform up with the library server instead of memory', () => {
    expect(step(1)).toMatch(/^1\. \*\*Take in the brief and the data\.\*\*/);
    expect(step(1)).toContain('analytics exports, funnel figures and event lists you are given');
    expect(step(1)).toContain('with `mcp__context7` instead of relying on memory');
  });

  it('shortens the path to the activation moment and draws the journey as a text flowchart', () => {
    expect(step(3)).toContain('Shorten the path to the activation moment.');
    expect(step(3)).toContain('Map the journey from signup to the "Aha!" moment as a flowchart (a text diagram, such as a Mermaid block)');
  });

  it('designs the referral loop with double-sided incentives, sharing mechanics and invite loops, and states the K-factor assumptions', () => {
    expect(step(4)).toContain('double-sided referral incentives, social sharing mechanics and collaboration invite loops');
    expect(step(4)).toContain('State the K-factor you expect and every assumption behind it.');
  });

  it('places contextual upgrade prompts on usage thresholds and premium gates, and wires none into the product', () => {
    expect(step(5)).toContain('contextual in-app upgrade prompts that fire on high-intent usage thresholds or premium feature gates');
    expect(step(5)).toContain('You specify prompts; you do not wire them into the product.');
  });

  it('defines the event telemetry schema and audits the drop-off between signup, activation and conversion', () => {
    expect(step(6)).toContain('Write the event telemetry schema (event names, properties and the funnel steps they mark)');
    expect(step(6)).toContain('audit the drop-off between signup, activation and conversion with the figures you were given');
  });

  it('compares feature-limit and usage-limit packaging and states the assumption behind every figure', () => {
    expect(step(7)).toContain('Compare feature-limit and usage-limit packaging for the tiers');
    expect(step(7)).toContain('Every conversion, activation or viral figure carries its assumption; an estimate is never presented as an observed result.');
  });
});

describe('native plg-strategist: inputs for whoever builds go back to the lead', () => {
  it('hands the telemetry schemas and the in-app specifications back to orchestrator-marketing as a fixed input, naming no engineering role', () => {
    expect(step(8)).toContain('Hand the telemetry schemas and the in-app specifications back to `orchestrator-marketing` as a fixed input for whoever builds them (the user\'s product team); you specify the experience and the events, you do not change application code.');
    expect(text().split('<!-- agents-united:floor:end -->')[1]).not.toMatch(/engineering (role|team)|frontend|backend/i);
  });

  it('sends channel priorities, conversion copy and visual design to their owners through the lead, and builds nothing in the product', () => {
    const boundaries = section('Boundaries of this host');
    expect(boundaries).toContain('the blueprint is a plan: building it in the product belongs to whoever builds the product, through the lead.');
    expect(boundaries).toContain('- Channel priorities and funnel metrics are `marketing-growth-strategist`\'s, landing-page conversion copy and its tests are `marketing-conversion-specialist`\'s and visual design is `marketing-creative-designer`\'s: hand them over through the lead.');
  });
});

describe('native plg-strategist: the skill table is the four product-led-growth skills of the add-on', () => {
  it('names exactly the skills its contract lists, all of them in product-led-growth', () => {
    const skills = [...text().matchAll(/^\| [^|]+ \| `([a-z0-9-]+)` \|/gm)].map(match => match[1]!).sort();
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-plg-strategist.contract.json'), 'utf8')) as { skills: string[] };
    expect(skills).toEqual([...contract.skills].sort());
    expect(skills).toEqual(['churn-prevention-playbook', 'onboarding-cro', 'signup-flow-cro', 'viral-referral-loops']);
  });
});

describe('native plg-strategist: the two invariants beyond the shared comms ones', () => {
  it('binds a finished peer to the lead and a missing peer input to a stated assumption, through the shared evidence rules', () => {
    const finished = EVIDENCE['Do not message a peer that has already finished; ask the coordinator to relay instead.']!;
    const missing = EVIDENCE['If an expected peer input never arrives, proceed on a stated assumption and list the gap under open items.']!;
    expect(finished.test(text())).toBe(true);
    expect(missing.test(text())).toBe(true);
    expect(section('Working with peers')).toContain('when a peer has finished, ask the lead.');
    expect(section('Working with peers')).toContain('- **Never hang on a missing peer.** Proceed on a stated assumption and list the gap under `Open items`.');
  });
});
