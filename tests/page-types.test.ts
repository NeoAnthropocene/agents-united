import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  connectorToolsOf,
  delegateNamesOf,
  loadPageTypes,
  parsePageTypes,
  stemOfRoleName,
  storeNeedsOf,
  typesOfLead,
  typesOfRole,
  typesOfSpecialist,
} from '../src/core/page-types.js';

/**
 * ADR 0078 - the page types of a Claude account and the roles that hold them: a fixed data file of the repository, read through a typed loader.
 * This suite checks the loader on synthetic tables (each error has its own message) and the committed table on its facts.
 */

const raw = (): Record<string, unknown> => ({
  semantics: 'Test table.',
  types: [
    { id: 'design', title: 'Design', for: 'a prototype', filledBy: 'files', needs: [], takesLook: true },
    { id: 'docs', title: 'Docs', for: 'a report', filledBy: 'connector', needs: ['mcp__claude_ai_Claude_Docs'], takesLook: false },
    { id: 'whiteboard', title: 'Whiteboard', for: 'a flow', filledBy: 'store', needs: ['ToolSearch'], takesLook: false },
  ],
  holders: { 'subagent-a': ['design', 'docs'], 'subagent-b': ['whiteboard'] },
});

describe('parsePageTypes', () => {
  it('reads a valid table: the catalogue in order and the holders by stem', () => {
    const table = parsePageTypes(raw());
    expect(table.types.map(type => type.id)).toEqual(['design', 'docs', 'whiteboard']);
    expect(table.types[1]).toMatchObject({ title: 'Docs', filledBy: 'connector', needs: ['mcp__claude_ai_Claude_Docs'], takesLook: false });
    expect(table.holders['subagent-a']).toEqual(['design', 'docs']);
  });

  it('refuses what is not an object, a table without types, and an empty catalogue', () => {
    expect(() => parsePageTypes(null)).toThrow(/page types: .*object/i);
    expect(() => parsePageTypes([])).toThrow(/page types: .*object/i);
    const noTypes = raw();
    delete noTypes.types;
    expect(() => parsePageTypes(noTypes)).toThrow(/page types: .*types/i);
    expect(() => parsePageTypes({ ...raw(), types: [] })).toThrow(/page types: .*types/i);
  });

  it('refuses an unknown kind', () => {
    const table = raw();
    (table.types as Array<Record<string, unknown>>)[0]!.filledBy = 'magic';
    expect(() => parsePageTypes(table)).toThrow(/page types: type "design" .*filledBy.*files, connector or store/);
  });

  it('refuses a duplicate type id and a malformed field', () => {
    const duplicated = raw();
    (duplicated.types as unknown[]).push({ id: 'docs', title: 'Docs 2', for: 'x', filledBy: 'files', needs: [], takesLook: false });
    expect(() => parsePageTypes(duplicated)).toThrow(/page types: type id "docs" appears twice/);
    const badTitle = raw();
    (badTitle.types as Array<Record<string, unknown>>)[1]!.title = '';
    expect(() => parsePageTypes(badTitle)).toThrow(/page types: type "docs" .*title/);
    const badNeeds = raw();
    (badNeeds.types as Array<Record<string, unknown>>)[1]!.needs = 'ToolSearch';
    expect(() => parsePageTypes(badNeeds)).toThrow(/page types: type "docs" .*needs/);
    const badLook = raw();
    (badLook.types as Array<Record<string, unknown>>)[0]!.takesLook = 'yes';
    expect(() => parsePageTypes(badLook)).toThrow(/page types: type "design" .*takesLook/);
  });

  it('refuses a holder that names an unknown type id', () => {
    const table = raw();
    (table.holders as Record<string, string[]>)['subagent-a'] = ['design', 'video'];
    expect(() => parsePageTypes(table)).toThrow(/page types: holder "subagent-a" names the unknown type "video"/);
  });

  it('refuses a holder list that is not in catalogue order', () => {
    const table = raw();
    (table.holders as Record<string, string[]>)['subagent-a'] = ['docs', 'design'];
    expect(() => parsePageTypes(table)).toThrow(/page types: holder "subagent-a" lists "docs" before "design"; keep the catalogue order/);
  });

  it('refuses a duplicate in a holder list, an empty holder list and a holder that is not a specialist', () => {
    const duplicated = raw();
    (duplicated.holders as Record<string, string[]>)['subagent-a'] = ['design', 'design'];
    expect(() => parsePageTypes(duplicated)).toThrow(/page types: holder "subagent-a" lists "design" twice/);
    const empty = raw();
    (empty.holders as Record<string, string[]>)['subagent-a'] = [];
    expect(() => parsePageTypes(empty)).toThrow(/page types: holder "subagent-a" has an empty list/);
    const lead = raw();
    (lead.holders as Record<string, string[]>)['orchestrator-x'] = ['design'];
    expect(() => parsePageTypes(lead)).toThrow(/page types: holder "orchestrator-x" is not a specialist stem/);
  });
});

describe('typesOfSpecialist and typesOfLead', () => {
  const table = parsePageTypes(raw());

  it('gives a specialist its own list in catalogue order, and nothing to a stem without an entry', () => {
    expect(typesOfSpecialist(table, 'subagent-a').map(type => type.id)).toEqual(['design', 'docs']);
    expect(typesOfSpecialist(table, 'subagent-nobody')).toEqual([]);
  });

  it('gives a lead the union of the lists of the roles in its roster, in catalogue order', () => {
    const stemOf = (name: string): string | undefined => `subagent-${name}`;
    expect(typesOfLead(table, ['b', 'a'], stemOf).map(type => type.id)).toEqual(['design', 'docs', 'whiteboard']);
    expect(typesOfLead(table, ['b'], stemOf).map(type => type.id)).toEqual(['whiteboard']);
    expect(typesOfLead(table, ['nobody'], stemOf)).toEqual([]);
    expect(typesOfLead(table, [], stemOf)).toEqual([]);
  });

  it('takes the roster of a lead from the Agent allowlist of its tools line', () => {
    expect(delegateNamesOf(['Read', 'Agent(ui-designer, ux-strategist)', 'Artifact'])).toEqual(['ui-designer', 'ux-strategist']);
    expect(delegateNamesOf(['Read', 'Agent'])).toEqual([]);
    expect(delegateNamesOf(['Read'])).toEqual([]);
  });

  it('picks the specialist rule or the lead rule by the role kind', () => {
    expect(typesOfRole(table, { stem: 'subagent-a', coordinator: false, tools: ['Read'] }).map(type => type.id)).toEqual(['design', 'docs']);
    expect(typesOfRole(table, { stem: 'orchestrator-x', coordinator: true, tools: ['Agent(a, b)'] }, name => `subagent-${name}`).map(type => type.id)).toEqual(['design', 'docs', 'whiteboard']);
  });
});

describe('the needs of a list', () => {
  const table = parsePageTypes(raw());
  const all = table.types;

  it('names the connector tools of the connector types and the tools of the store types, each once', () => {
    expect(connectorToolsOf(all)).toEqual(['mcp__claude_ai_Claude_Docs']);
    expect(storeNeedsOf(all)).toEqual(['ToolSearch']);
    expect(connectorToolsOf([all[0]!])).toEqual([]);
    expect(storeNeedsOf([all[0]!, all[1]!])).toEqual([]);
  });
});

describe('stemOfRoleName', () => {
  it('maps a role name to the stem of its core, and an agency copy to the marketing core it stands on', () => {
    expect(stemOfRoleName('ui-designer')).toBe('subagent-ui-designer');
    expect(stemOfRoleName('agency-growth-strategist')).toBe('subagent-marketing-growth-strategist');
    expect(stemOfRoleName('agency-seo-specialist')).toBe('subagent-seo-specialist');
  });
});

describe('the committed table', () => {
  const table = loadPageTypes('registry', 'claude');
  it('has the seven types in this order, with their kinds', () => {
    expect(table.types.map(type => [type.id, type.filledBy])).toEqual([
      ['design', 'files'],
      ['slides', 'files'],
      ['design-system', 'files'],
      ['docs', 'connector'],
      ['sheets', 'connector'],
      ['whiteboard', 'store'],
      ['data', 'store'],
    ]);
  });

  it('has 22 specialist holders, none of them a lead', () => {
    expect(Object.keys(table.holders)).toHaveLength(22);
    for (const stem of Object.keys(table.holders)) expect(stem.startsWith('subagent-'), stem).toBe(true);
  });

  it('names ADR 0078 in its semantics and is fixed text, never probed', () => {
    const text = fs.readFileSync(path.resolve('registry/hosts/claude/page-types.json'), 'utf8');
    expect(JSON.parse(text).semantics).toMatch(/ADR 0078/);
  });

  it('needs the Claude Docs connector for Docs and Sheets and a tool search for Whiteboard and Data', () => {
    for (const id of ['docs', 'sheets']) expect(table.types.find(type => type.id === id)!.needs).toEqual(['mcp__claude_ai_Claude_Docs']);
    for (const id of ['whiteboard', 'data']) expect(table.types.find(type => type.id === id)!.needs).toEqual(['ToolSearch']);
    for (const id of ['design', 'slides', 'design-system']) expect(table.types.find(type => type.id === id)!.needs).toEqual([]);
  });
});
