import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFloor } from '../src/core/native-floor.js';
import { publishingBlockProblems } from '../src/core/native-repository-rules.js';
import { ROSTER_END, ROSTER_START } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { HOLDER_LEADS, HOLDER_ROLES, HOLDER_STEMS, PUBLISH_FLOOR_LINE, withoutPublishingBlock } from './helpers/artifact-holders.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

/**
 * ADR 0077 (which replaces decisions 1 and 2 of ADR 0047 and Plan 036 S12): the roles that make documents hold the `Artifact` tool. The tool is the
 * capability class `artifacts` of a Semantic Core, so a role's `tools:` line follows from the class (regenerated with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`); one safety line of the floor says under which condition a page may be
 * published; one generated block per holder says how (its own suite is tests/native-claude-publishing.test.ts); the five leads' rosters say which
 * specialist publishes pages; and the creative designer keeps her own table row for the skill that teaches the Design type.
 * The holders are the table in tests/helpers/artifact-holders.ts.
 */

const toolsOf = (role: string): string[] => /^tools: (.*)$/m.exec(nativeText(role))![1]!.split(',').map(t => t.trim());
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

  it('gives the five leads the tool, because the class is in their cores and a lead reads back a page before it passes a link on', () => {
    expect([...HOLDER_LEADS].sort()).toEqual(['orchestrator-business', 'orchestrator-design', 'orchestrator-digital-agency', 'orchestrator-marketing', 'orchestrator-research']);
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
    for (const { role, coordinator } of NATIVE_ROLES) {
      const text = nativeText(role);
      expect(publishingBlockProblems(text, { kind: coordinator ? 'coordinator' : 'specialist', name: role, tools: toolsOf(role) }), role).toEqual([]);
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
  it('no longer has the agency lead call publishing an optional extra, "never by default", or the creative designer "the one role that can publish"', () => {
    const body = authored(LEAD);
    expect(body).not.toMatch(/Publishing to Claude Design is an optional extra/);
    expect(body).not.toMatch(/never by default[^.]*canvas|canvas[^.]*never by default/);
    expect(body).not.toMatch(/the one role that can publish/);
    expect(body).toMatch(/Photographs\./);
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
