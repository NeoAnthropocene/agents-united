import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFloor } from '../src/core/native-floor.js';
import { publishingBlockProblems } from '../src/core/native-repository-rules.js';
import { ROSTER_END, ROSTER_START } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { loadPageTypes, roleStemResolver, typesOfRole } from '../src/core/page-types.js';
import {
  CONNECTOR_ENTRY,
  HOLDER_LEADS,
  HOLDER_ROLES,
  HOLDER_STEMS,
  NEW_HOLDER_STEMS,
  PAGE_TABLE,
  PUBLISH_FLOOR_LINE,
  holdersOfKind,
  holdersOfType,
  pageTypesOfRole,
  toolsLineOf,
  withoutPublishingBlock,
} from './helpers/artifact-holders.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

/**
 * ADR 0077 (which replaces decisions 1 and 2 of ADR 0047 and Plan 036 S12): the roles that make documents hold the `Artifact` tool. The tool is the
 * capability class `artifacts` of a Semantic Core, so a role's `tools:` line follows from the class (regenerated with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`); one safety line of the floor says under which condition a page may be
 * published; one generated block per holder says how (its own suite is tests/native-claude-publishing.test.ts); the five leads' rosters say which
 * specialist publishes pages; and the creative designer keeps her own table row for the skill that teaches the Design type.
 * The holders are the table in tests/helpers/artifact-holders.ts.
 */

const toolsOf = toolsLineOf;
/** The role's own text after the floor: the generated publishing block is left out, because it is checked by its own suite. */
const authored = (role: string): string => withoutPublishingBlock(nativeText(role).split('<!-- agents-united:floor:end -->')[1] ?? '');
const HER = 'agency-creative-designer';
const HER_TWIN = 'marketing-creative-designer';
const HER_STEM = 'subagent-marketing-creative-designer';
const LEAD = 'orchestrator-digital-agency';
const allStems = [...new Set(NATIVE_ROLES.map(entry => entry.stem))];
/** The roster rows of a lead: the type name and the whole row, between the roster markers. */
const rosterRows = (role: string): Array<{ type: string; row: string }> => {
  const text = nativeText(role);
  const block = text.slice(text.indexOf(ROSTER_START), text.indexOf(ROSTER_END));
  return block
    .split('\n')
    .map(row => ({ type: /^\| `([a-z0-9-]+)` \|/.exec(row)?.[1] ?? '', row }))
    .filter(entry => entry.type !== '');
};

describe('the grant: the roles that make documents hold Artifact', () => {
  it('has every holder stem as a core of a committed native role', () => {
    for (const stem of HOLDER_STEMS) expect(allStems, stem).toContain(stem);
  });

  it('has the artifacts class in the core of exactly the holders, among all native roles\' cores', async () => {
    const cores = await loadSemanticCore('registry');
    for (const stem of allStems) {
      const has = (cores.get(stem)!.capabilities ?? []).includes('artifacts');
      expect(has, stem).toBe(HOLDER_STEMS.includes(stem));
    }
  });

  it('has Artifact in the tools line of exactly the native files that stand on a holder core', () => {
    for (const { role, stem } of NATIVE_ROLES) expect(toolsOf(role).includes('Artifact'), role).toBe(HOLDER_STEMS.includes(stem));
    // The creative designer has two native files on one core; a marketing core feeds a marketing- and an agency- file.
    for (const role of [HER, HER_TWIN]) expect(HOLDER_ROLES, role).toContain(role);
    expect(HOLDER_ROLES.filter(role => /^(agency|marketing)-(growth|content|campaign|conversion)-/.test(role))).toHaveLength(8);
  });

  it('keeps the creative designer\'s other tools as they were: no shell, no delegation, the editors and the connected servers', () => {
    const held = toolsOf(HER);
    for (const forbidden of ['Bash', 'PowerShell', 'Agent', 'Workflow', 'CronCreate']) expect(held, forbidden).not.toContain(forbidden);
    for (const needed of ['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Skill', 'SendMessage', 'mcp__figma', 'mcp__stitch']) expect(held, needed).toContain(needed);
  });

  it('gives the six leads the tool, because the class is in their cores and a lead reads back a page before it passes a link on', () => {
    expect([...HOLDER_LEADS].sort()).toEqual(['orchestrator-business', 'orchestrator-design', 'orchestrator-digital-agency', 'orchestrator-marketing', 'orchestrator-research', 'orchestrator-system-architecture']);
    for (const lead of HOLDER_LEADS) expect(toolsOf(lead), lead).toContain('Artifact');
  });
});

describe('the floor: what leaves the project', () => {
  it('has the same safety line, word for word, in every holder core, and no other Publish Artifact line anywhere', async () => {
    const cores = await loadSemanticCore('registry');
    for (const stem of allStems) {
      const lines = cores.get(stem)!.safety.split('\n').filter(l => /Publish Artifact/.test(l));
      expect(lines.map(l => l.trim()), stem).toEqual(HOLDER_STEMS.includes(stem) ? [PUBLISH_FLOOR_LINE] : []);
    }
  });

  it('says it in one line that names the option the user sees, the go-ahead for the page, privacy and the user\'s own sharing, and names no tool', () => {
    expect(PUBLISH_FLOOR_LINE).toMatch(/^- \*\*Publish Artifact\*\*: /);
    expect(PUBLISH_FLOOR_LINE).toMatch(/only with the user's go-ahead for that page/);
    expect(PUBLISH_FLOOR_LINE).toMatch(/needs no new go-ahead/);
    expect(PUBLISH_FLOOR_LINE).toMatch(/Keep it private/);
    expect(PUBLISH_FLOOR_LINE).toMatch(/leave who can see it to the user/);
    expect(PUBLISH_FLOOR_LINE).toMatch(/project material has left the project/);
    expect(PUBLISH_FLOOR_LINE).not.toMatch(/`Artifact`|Claude Design/);
  });

  it('keeps the creative designer\'s three earlier safety lines, and ends her safety text with the new line', async () => {
    const core = (await loadSemanticCore('registry')).get(HER_STEM)!;
    for (const earlier of ['Zero Deceptive Advertising', 'Accessibility & Contrast', 'Safe Zone Adherence']) expect(core.safety, earlier).toContain(earlier);
    expect(core.safety).not.toMatch(/Opt-In Publishing/);
    expect(core.safety).not.toMatch(/only when the user asked for it/);
    expect(core.safety.trim().endsWith(PUBLISH_FLOOR_LINE)).toBe(true);
  });

  it('has the generated floor of every holder role exactly the core\'s', async () => {
    const cores = await loadSemanticCore('registry');
    for (const { role, stem } of NATIVE_ROLES) if (HOLDER_STEMS.includes(stem)) expect(checkFloor(nativeText(role), cores.get(stem)!), role).toEqual([]);
  });
});

describe('the publishing block: generated, in every holder and in no other role', () => {
  it('is carried exactly by the roles whose tools line holds Artifact, as the block of their kind', () => {
    const table = loadPageTypes('registry', 'claude');
    for (const { role, coordinator, stem } of NATIVE_ROLES) {
      const text = nativeText(role);
      const types = typesOfRole(table, { stem, coordinator, tools: toolsOf(role) }, roleStemResolver('registry'));
      expect(publishingBlockProblems(text, { kind: coordinator ? 'coordinator' : 'specialist', name: role, tools: toolsOf(role), types, catalogue: table.types }), role).toEqual([]);
      expect(text.includes('agents-united:publishing:start'), role).toBe(HOLDER_STEMS.includes(NATIVE_ROLES.find(entry => entry.role === role)!.stem));
    }
  });
});

describe('the leads\' rosters', () => {
  it.each(HOLDER_LEADS)('%s: every holder row says "publishes pages" and no other row does', lead => {
    const rows = rosterRows(lead);
    expect(rows.length).toBeGreaterThan(3);
    for (const { type, row } of rows) {
      if (HOLDER_ROLES.includes(type)) expect(row, type).toMatch(/publishes pages/);
      else expect(row, type).not.toMatch(/publishes pages/);
    }
  });

  it('has the agency lead\'s roster say which roles can publish, with the creative designer among them', () => {
    const row = rosterRows(LEAD).find(entry => entry.type === HER)?.row ?? '';
    expect(row).toMatch(/publishes pages/);
    expect(rosterRows(LEAD).filter(entry => /publishes pages/.test(entry.row)).length).toBeGreaterThan(1);
  });
});

describe('the authored text that used to say one role publishes, only when asked', () => {
  it('no longer has the agency lead\'s paragraph about publishing to Claude Design, sentence by sentence, as it read before ADR 0077', () => {
    const body = authored(LEAD);
    for (const removed of [
      '**Publishing to Claude Design.**',
      'Publishing to Claude Design is an optional extra: offer it only when the brief calls for a canvas, a design system or a brand book there, never by default.',
      'Ask for a go-ahead for each publish.',
      'When the user picks it, brief Jamileh (`agency-creative-designer`, the one role that can publish) to publish it privately and to leave sharing to the user, and say in your report that client material has left the project.',
      'the one role that can publish',
    ]) {
      expect(body, removed).not.toContain(removed);
    }
    expect(body).toContain('**Photographs.** Generating a photograph is an optional extra: raise it only when the plan holds a photograph-like asset that nobody supplied, never by default;');
  });

  it('has every lead say what the agency lead\'s removed paragraph said, now in the generated block: the question, its two options and their explanation', () => {
    for (const lead of HOLDER_LEADS) {
      const text = nativeText(lead);
      expect(text, lead).toMatch(/`AskUserQuestion`/);
      expect(text, lead).toMatch(/\*\*Publish Artifact\*\*/);
      expect(text, lead).toMatch(/\*\*Keep it in the project\*\*/);
      expect(text, lead).toMatch(/private page on your claude\.ai account/);
      expect(text, lead).toMatch(/Pro or higher plan/);
      expect(text, lead).toMatch(/signed-in Claude Code/);
      expect(text, lead).toMatch(/unless you share it/);
      expect(text, lead).toMatch(/Anthropic-hosted page/);
      expect(text, lead).toMatch(/go-ahead for each new page/);
    }
  });

  it('keeps the agency creative designer\'s table row for the skill design-artifact-publishing', () => {
    expect(authored(HER).split('\n').some(l => l.startsWith('|') && l.includes('`design-artifact-publishing`')), 'the table row').toBe(true);
  });

  it.each([HER, HER_TWIN])('%s no longer says it publishes only when the user asks', role => {
    const body = authored(role);
    expect(body).not.toMatch(/only when the user asks/);
    expect(body).toMatch(/only with the user's go-ahead for that page/);
    expect(body).toMatch(/private/);
    expect(body).toMatch(/Pro or higher plan/);
    expect(body).toMatch(/write the files/);
  });
});

describe('the state of the record', () => {
  it('has ADR 0047 keep that the grant is built and name ADR 0077 for decisions 1 and 2, and the plan mark S12 as done', () => {
    const adr = fs.readdirSync(path.resolve('docs/adr')).find(f => /^0047-.*\.md$/.test(f))!;
    const text = fs.readFileSync(path.resolve('docs/adr', adr), 'utf8').replace(/\r\n/g, '\n');
    expect(text).toMatch(/The grant is built \(Plan 036 S12\)/);
    expect(text).toMatch(/ADR 0077/);
    expect(text).toMatch(/decisions 1 and 2/);
    const plan = fs.readFileSync(path.resolve('plans/036-claude-creative-designer-improvement.md'), 'utf8').replace(/\r\n/g, '\n');
    const s12 = plan.split('\n').find(l => /^\| S12 \|/.test(l)) ?? '';
    expect(s12).toMatch(/in review|done/);
  });
});

/** The holder stems of ADR 0077: the roles that held Artifact before the page types of ADR 0078. */
const ADR_0077_STEMS = [
  'subagent-ui-designer',
  'subagent-ux-strategist',
  'subagent-interaction-designer',
  'subagent-design-systems-architect',
  'subagent-design-ops-lead',
  'subagent-design-researcher',
  'subagent-designer-toolkit-expert',
  'subagent-prototype-tester',
  'subagent-marketing-creative-designer',
  'subagent-marketing-growth-strategist',
  'subagent-marketing-content-strategist',
  'subagent-marketing-campaign-specialist',
  'subagent-marketing-conversion-specialist',
  'subagent-business-panel-experts',
  'subagent-deep-research',
  'subagent-market-intelligence-analyst',
  'subagent-operations-strategist',
  'orchestrator-design',
  'orchestrator-marketing',
  'orchestrator-digital-agency',
  'orchestrator-business',
  'orchestrator-research',
];
const ids = (roles: readonly string[]): string[] => [...roles].sort();

describe('the page types (ADR 0078): who holds which, and what each kind needs', () => {
  it('has 33 holder files on 28 cores, and the new holders are exactly the six named', () => {
    expect(HOLDER_ROLES).toHaveLength(33);
    expect(new Set(HOLDER_STEMS).size).toBe(28);
    expect(HOLDER_STEMS.filter(stem => !ADR_0077_STEMS.includes(stem)).sort()).toEqual([...NEW_HOLDER_STEMS].sort());
    expect(NEW_HOLDER_STEMS).toEqual([
      'subagent-paid-acquisition-specialist',
      'subagent-plg-strategist',
      'subagent-financial-analyst',
      'subagent-system-architect',
      'subagent-finops-cost-engineer',
      'orchestrator-system-architecture',
    ]);
    for (const stem of ADR_0077_STEMS) expect(HOLDER_STEMS, stem).toContain(stem);
  });

  it('counts the native files that hold each type, leads included', () => {
    expect(holdersOfType('design')).toHaveLength(27);
    expect(holdersOfType('slides')).toHaveLength(27);
    expect(holdersOfType('design-system')).toHaveLength(9);
    expect(holdersOfType('docs')).toHaveLength(20);
    expect(holdersOfType('sheets')).toHaveLength(17);
    expect(holdersOfType('whiteboard')).toHaveLength(6);
    expect(holdersOfType('data')).toHaveLength(8);
    expect(holdersOfKind('connector')).toHaveLength(24);
    expect(holdersOfKind('store')).toHaveLength(12);
  });

  it('splits the connector and the store holders into specialists and leads: 18 and 6, 7 and 5', () => {
    const leads = (roles: readonly string[]): string[] => roles.filter(role => HOLDER_LEADS.includes(role));
    const specialists = (roles: readonly string[]): string[] => roles.filter(role => !HOLDER_LEADS.includes(role));
    expect(specialists(holdersOfKind('connector'))).toHaveLength(18);
    expect(leads(holdersOfKind('connector'))).toHaveLength(6);
    expect(specialists(holdersOfKind('store'))).toHaveLength(7);
    expect(leads(holdersOfKind('store'))).toHaveLength(5);
  });

  it('gives each of the five specialists of ADR 0078 its own list', () => {
    const listOf = (role: string): string[] => pageTypesOfRole(role).map(type => type.id);
    expect(listOf('paid-acquisition-specialist')).toEqual(['sheets']);
    expect(listOf('plg-strategist')).toEqual(['whiteboard']);
    expect(listOf('financial-analyst')).toEqual(['sheets']);
    expect(listOf('system-architect')).toEqual(['whiteboard']);
    expect(listOf('finops-cost-engineer')).toEqual(['sheets', 'data']);
  });

  it('gives every native file that holds Artifact a non-empty list of types and a publishing block, and no other native file either', () => {
    for (const { role } of NATIVE_ROLES) {
      const holds = toolsLineOf(role).includes('Artifact');
      expect(pageTypesOfRole(role).length > 0, role).toBe(holds);
      expect(nativeText(role).includes('agents-united:publishing:start'), role).toBe(holds);
    }
  });

  it('gives a lead the union of the lists of the roles it may spawn, in catalogue order', () => {
    for (const lead of HOLDER_LEADS) {
      const roster = toolsLineOf(lead).find(tool => tool.startsWith('Agent('))!.slice('Agent('.length, -1).split(',').map(name => name.trim());
      const union = new Set(roster.filter(name => HOLDER_ROLES.includes(name)).flatMap(name => pageTypesOfRole(name).map(type => type.id)));
      expect(pageTypesOfRole(lead).map(type => type.id), lead).toEqual(PAGE_TABLE.types.map(type => type.id).filter(id => union.has(id)));
    }
  });

  it('has the Claude Docs connector, as the whole server and one plain entry, on exactly the roles that hold Docs or Sheets', () => {
    const wanted = holdersOfKind('connector');
    expect(ids(NATIVE_ROLES.map(entry => entry.role).filter(role => toolsLineOf(role).includes(CONNECTOR_ENTRY)))).toEqual(ids(wanted));
    for (const { role } of NATIVE_ROLES) {
      const variants = toolsLineOf(role).filter(tool => /claude_ai_Claude_Docs|claude-docs|Claude_Docs/i.test(tool));
      expect(variants, role).toEqual(wanted.includes(role) ? [CONNECTOR_ENTRY] : []);
    }
  });

  it('has ToolSearch on every role that holds a store type', () => {
    for (const role of holdersOfKind('store')) expect(toolsLineOf(role), role).toContain('ToolSearch');
  });

  it('puts no store tool and no comment tool, in any form, on any tools line, and none in the tool policy', () => {
    for (const { role } of NATIVE_ROLES) expect(toolsLineOf(role).join(', '), role).not.toMatch(/ArtifactData|ArtifactComments/);
    const policy = fs.readFileSync(path.resolve('registry/hosts/claude/tool-policy.json'), 'utf8');
    expect(policy).not.toMatch(/ArtifactData|ArtifactComments/);
  });

  it('has no block that says a role may comment, delete or share a page', () => {
    for (const role of HOLDER_ROLES) {
      const text = nativeText(role);
      const block = text.slice(text.indexOf('agents-united:publishing:start'), text.indexOf('agents-united:publishing:end'));
      expect(block, role).not.toContain('ArtifactData');
      expect(block, role).not.toMatch(/\b(?:you may|may|can) (?:comment|delete|share)\b/i);
      expect(block, role).toContain('never delete or pin an artifact');
    }
  });

  it('has a block that names the types of the role, and the connector and store bullets of the types the role holds, inside the block', () => {
    const heading = (ids: readonly string[], first: string, second: string): string | undefined =>
      ids.includes(first) && ids.includes(second) ? `${first[0]!.toUpperCase()}${first.slice(1)} and ${second[0]!.toUpperCase()}${second.slice(1)}` : ids.includes(first) ? `${first[0]!.toUpperCase()}${first.slice(1)}` : ids.includes(second) ? `${second[0]!.toUpperCase()}${second.slice(1)}` : undefined;
    for (const role of HOLDER_ROLES) {
      const text = nativeText(role);
      const block = text.slice(text.indexOf('agents-united:publishing:start'), text.indexOf('agents-united:publishing:end'));
      const held = pageTypesOfRole(role).map(type => type.id);
      for (const type of pageTypesOfRole(role)) expect(block, `${role} ${type.id}`).toContain(`${type.title} (${type.for})`);
      expect(block.includes('because the connector is missing'), role).toBe(holdersOfKind('connector').includes(role));
      expect(block.includes('- **No connector.**'), role).toBe(false);
      const connector = heading(held, 'docs', 'sheets');
      const store = heading(held, 'whiteboard', 'data');
      for (const candidate of ['Docs and Sheets', 'Docs', 'Sheets']) expect(block.includes(`- **${candidate}.**`), `${role} ${candidate}`).toBe(candidate === connector);
      for (const candidate of ['Whiteboard and Data', 'Whiteboard', 'Data']) expect(block.includes(`- **${candidate}.**`), `${role} ${candidate}`).toBe(candidate === store);
    }
  });

  it('reads the HTML page sentence in the block of exactly the files that hold the Design type', () => {
    for (const role of HOLDER_ROLES) {
      const text = nativeText(role);
      const block = text.slice(text.indexOf('agents-united:publishing:start'), text.indexOf('agents-united:publishing:end'));
      expect(block.includes('working HTML page'), role).toBe(holdersOfType('design').includes(role));
    }
  });
});

describe('the system-architecture lead', () => {
  it('holds Artifact and the connector entry, because its roster holds a role that publishes pages and a role that fills a sheet through the connector', () => {
    const tools = toolsLineOf('orchestrator-system-architecture');
    expect(tools).toContain('Artifact');
    expect(tools).toContain(CONNECTOR_ENTRY);
    expect(pageTypesOfRole('orchestrator-system-architecture').map(type => type.id)).toEqual(['sheets', 'whiteboard', 'data']);
  });
});
