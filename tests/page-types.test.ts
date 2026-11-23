import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_ROLES } from './helpers/native-roles.js';
import {
  connectorToolsOf,
  delegateNamesOf,
  loadPageTypes,
  loadPageTypesIfPresent,
  parsePageTypes,
  roleStemResolver,
  stemOfRoleName,
  storeNeedsOf,
  typesOfLead,
  typesOfRole,
  typesOfSpecialist,
  unknownRosterNames,
} from '../src/core/page-types.js';

/**
 * ADR 0078 - the page types of a Claude account and the roles that hold them: a fixed data file of the repository, read through a typed loader.
 * This suite checks the loader on synthetic tables (each error has its own message) and the committed table on its facts.
 */

const raw = (): Record<string, unknown> => ({
  host: 'claude',
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
    expect(() => parsePageTypes(null)).toThrow(/Page types:.*object/i);
    expect(() => parsePageTypes([])).toThrow(/Page types:.*object/i);
    const noTypes = raw();
    delete noTypes.types;
    expect(() => parsePageTypes(noTypes)).toThrow(/Page types:.*types/i);
    expect(() => parsePageTypes({ ...raw(), types: [] })).toThrow(/Page types:.*types/i);
  });

  it('refuses an unknown kind', () => {
    const table = raw();
    (table.types as Array<Record<string, unknown>>)[0]!.filledBy = 'magic';
    expect(() => parsePageTypes(table)).toThrow(/Page types: type "design" .*filledBy.*files, connector or store/);
  });

  it('refuses a duplicate type id and a malformed field', () => {
    const duplicated = raw();
    (duplicated.types as unknown[]).push({ id: 'docs', title: 'Docs 2', for: 'x', filledBy: 'files', needs: [], takesLook: false });
    expect(() => parsePageTypes(duplicated)).toThrow(/Page types: type id "docs" appears twice/);
    const badTitle = raw();
    (badTitle.types as Array<Record<string, unknown>>)[1]!.title = '';
    expect(() => parsePageTypes(badTitle)).toThrow(/Page types: type "docs" .*title/);
    const badNeeds = raw();
    (badNeeds.types as Array<Record<string, unknown>>)[1]!.needs = 'ToolSearch';
    expect(() => parsePageTypes(badNeeds)).toThrow(/Page types: type "docs" .*needs/);
    const badLook = raw();
    (badLook.types as Array<Record<string, unknown>>)[0]!.takesLook = 'yes';
    expect(() => parsePageTypes(badLook)).toThrow(/Page types: type "design" .*takesLook/);
  });

  it('refuses a holder that names an unknown type id', () => {
    const table = raw();
    (table.holders as Record<string, string[]>)['subagent-a'] = ['design', 'video'];
    expect(() => parsePageTypes(table)).toThrow(/Page types: holder "subagent-a" names the unknown type "video"/);
  });

  it('refuses a holder list that is not in catalogue order', () => {
    const table = raw();
    (table.holders as Record<string, string[]>)['subagent-a'] = ['docs', 'design'];
    expect(() => parsePageTypes(table)).toThrow(/Page types: holder "subagent-a" lists "docs" before "design"; keep the catalogue order/);
  });

  it('refuses a duplicate in a holder list, an empty holder list and a holder that is not a specialist', () => {
    const duplicated = raw();
    (duplicated.holders as Record<string, string[]>)['subagent-a'] = ['design', 'design'];
    expect(() => parsePageTypes(duplicated)).toThrow(/Page types: holder "subagent-a" lists "design" twice/);
    const empty = raw();
    (empty.holders as Record<string, string[]>)['subagent-a'] = [];
    expect(() => parsePageTypes(empty)).toThrow(/Page types: holder "subagent-a" has an empty list/);
    const lead = raw();
    (lead.holders as Record<string, string[]>)['orchestrator-x'] = ['design'];
    expect(() => parsePageTypes(lead)).toThrow(/Page types: holder "orchestrator-x" is not a specialist stem/);
  });
});

describe('parsePageTypes: the fields that a loose table would let through', () => {
  const typeOf = (table: Record<string, unknown>, at: number): Record<string, unknown> => (table.types as Array<Record<string, unknown>>)[at]!;

  it('needs a host that is a string', () => {
    const missing = raw();
    delete missing.host;
    expect(() => parsePageTypes(missing)).toThrow(/Page types: the table needs a host/);
    expect(() => parsePageTypes({ ...raw(), host: 7 })).toThrow(/Page types: the table needs a host/);
    expect(parsePageTypes(raw()).types).toHaveLength(3);
  });

  it('needs semantics that are a non-empty string', () => {
    const missing = raw();
    delete missing.semantics;
    expect(() => parsePageTypes(missing)).toThrow(/Page types: the table needs semantics as a non-empty string/);
    expect(() => parsePageTypes({ ...raw(), semantics: '  ' })).toThrow(/Page types: the table needs semantics as a non-empty string/);
    expect(() => parsePageTypes({ ...raw(), semantics: 3 })).toThrow(/Page types: the table needs semantics as a non-empty string/);
  });

  it('needs a holder key in the form subagent- plus a kebab-case name', () => {
    for (const stem of ['subagent-', 'subagent-Bad Name!', 'subagent-x.core.md', 'subagent--x']) {
      const table = raw();
      (table.holders as Record<string, string[]>)[stem] = ['design'];
      expect(() => parsePageTypes(table), stem).toThrow(/Page types: holder ".*" is not a specialist stem/);
    }
  });

  it('refuses a title, a for phrase or a tool name with spaces around it', () => {
    const title = raw();
    typeOf(title, 0).title = ' Design';
    expect(() => parsePageTypes(title)).toThrow(/Page types: type "design" needs a title without spaces around it/);
    const phrase = raw();
    typeOf(phrase, 0).for = 'a prototype ';
    expect(() => parsePageTypes(phrase)).toThrow(/Page types: type "design" needs a for without spaces around it/);
    const tool = raw();
    typeOf(tool, 2).needs = [' ToolSearch '];
    expect(() => parsePageTypes(tool)).toThrow(/Page types: type "whiteboard" needs tool names without spaces around them/);
  });

  it('refuses a title that two types share, and a tool that one type names twice', () => {
    const titles = raw();
    typeOf(titles, 1).title = 'Design';
    expect(() => parsePageTypes(titles)).toThrow(/Page types: the title "Design" appears twice/);
    const needs = raw();
    typeOf(needs, 1).needs = ['mcp__claude_ai_Claude_Docs', 'mcp__claude_ai_Claude_Docs'];
    expect(() => parsePageTypes(needs)).toThrow(/Page types: type "docs" names the tool "mcp__claude_ai_Claude_Docs" twice/);
  });

  it('needs a tool for a connector or a store type, and none for a type filled by files', () => {
    const connector = raw();
    typeOf(connector, 1).needs = [];
    expect(() => parsePageTypes(connector)).toThrow(/Page types: type "docs" is filled through a connector and needs at least one tool/);
    const store = raw();
    typeOf(store, 2).needs = [];
    expect(() => parsePageTypes(store)).toThrow(/Page types: type "whiteboard" is filled through a store and needs at least one tool/);
    const files = raw();
    typeOf(files, 0).needs = ['ToolSearch'];
    expect(() => parsePageTypes(files)).toThrow(/Page types: type "design" is filled by files and needs no tool/);
  });
});

describe('loading the table of a registry', () => {
  it('reads the committed table', () => {
    expect(loadPageTypes('registry', 'claude').types).toHaveLength(7);
    expect(() => loadPageTypes('registry', 'cline')).toThrow(/Page types: cannot read/);
  });

  it('refuses a missing file, a file that is not JSON and a table of another host, naming the file or the host', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-types-'));
    try {
      expect(() => loadPageTypes(dir, 'claude')).toThrow(/Page types: cannot read .*page-types\.json/);
      fs.mkdirSync(path.join(dir, 'hosts', 'claude'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'hosts', 'claude', 'page-types.json'), '{not json');
      expect(() => loadPageTypes(dir, 'claude')).toThrow(/Page types: cannot read .*page-types\.json/);
      fs.writeFileSync(path.join(dir, 'hosts', 'claude', 'page-types.json'), JSON.stringify({ ...raw(), host: 'cline' }));
      expect(() => loadPageTypes(dir, 'claude')).toThrow(/Page types: the table is for the host "cline", not "claude"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gives an empty table for a registry that has none, and the real table when there is one', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-types-'));
    try {
      expect(loadPageTypesIfPresent(dir, 'claude')).toEqual({ semantics: '', types: [], holders: {} });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(loadPageTypesIfPresent('registry', 'claude').types).toHaveLength(7);
  });
});

describe('typesOfSpecialist and typesOfLead', () => {
  const table = parsePageTypes(raw());

  it('gives a specialist its own list in catalogue order, and nothing to a stem without an entry', () => {
    expect(typesOfSpecialist(table, 'subagent-a').map(type => type.id)).toEqual(['design', 'docs']);
    expect(typesOfSpecialist(table, 'subagent-nobody')).toEqual([]);
  });

  it('does not take a name of Object.prototype for a stem', () => {
    for (const stem of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(typesOfSpecialist(table, stem), stem).toEqual([]);
      expect(typesOfLead(table, ['x'], () => stem), stem).toEqual([]);
    }
  });

  it('counts a type once when two roles of the roster hold it, and keeps the catalogue order', () => {
    const overlapping = parsePageTypes({ ...raw(), holders: { 'subagent-a': ['design', 'docs'], 'subagent-b': ['docs', 'whiteboard'], 'subagent-c': ['design', 'whiteboard'] } });
    expect(typesOfLead(overlapping, ['c', 'b', 'a'], name => `subagent-${name}`).map(type => type.id)).toEqual(['design', 'docs', 'whiteboard']);
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
    const stemOf = (name: string): string => `subagent-${name}`;
    expect(typesOfRole(table, { stem: 'subagent-a', coordinator: false, tools: ['Read'] }, stemOf).map(type => type.id)).toEqual(['design', 'docs']);
    expect(typesOfRole(table, { stem: 'orchestrator-x', coordinator: true, tools: ['Agent(a, b)'] }, stemOf).map(type => type.id)).toEqual(['design', 'docs', 'whiteboard']);
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

  it('names a tool once when two types of the list need it', () => {
    const twice = parsePageTypes({
      ...raw(),
      types: [
        ...(raw().types as unknown[]),
        { id: 'sheets', title: 'Sheets', for: 'a table', filledBy: 'connector', needs: ['mcp__claude_ai_Claude_Docs'], takesLook: false },
        { id: 'data', title: 'Data', for: 'a dashboard', filledBy: 'store', needs: ['ToolSearch'], takesLook: true },
      ],
    });
    expect(connectorToolsOf(twice.types)).toEqual(['mcp__claude_ai_Claude_Docs']);
    expect(storeNeedsOf(twice.types)).toEqual(['ToolSearch']);
  });
});

describe('the stem of a native role', () => {
  const aliases = { 'agency-growth-strategist': 'subagent-marketing-growth-strategist' };
  const leadTools = (role: string): string[] => {
    const line = /^tools: (.*)$/m.exec(fs.readFileSync(path.join('registry', 'hosts', 'claude', 'agents', `${role}.md`), 'utf8').replace(/\r\n/g, '\n'))![1]!;
    const match = /Agent\([^)]*\)/.exec(line);
    return match === null ? [] : [match[0]];
  };

  it('maps a role name through the native role names of the bundles, and any other name to subagent- plus the name', () => {
    expect(stemOfRoleName('ui-designer', aliases)).toBe('subagent-ui-designer');
    expect(stemOfRoleName('agency-growth-strategist', aliases)).toBe('subagent-marketing-growth-strategist');
    expect(stemOfRoleName('toString', aliases)).toBe('subagent-toString');
  });

  it('reads the native role names from registry/bundles.json, so that the agency copies stand on the core of their bundle', () => {
    const stemOf = roleStemResolver('registry');
    expect(stemOf('agency-growth-strategist')).toBe('subagent-marketing-growth-strategist');
    expect(stemOf('agency-seo-specialist')).toBe('subagent-seo-specialist');
    expect(stemOf('agency-3d-designer')).toBe('subagent-3d-designer');
    expect(stemOf('ui-designer')).toBe('subagent-ui-designer');
  });

  it('gives every agency role of the committed roster the stem that the roster of native roles gives', () => {
    const stemOf = roleStemResolver('registry');
    const agency = NATIVE_ROLES.filter(entry => entry.role.startsWith('agency-'));
    expect(agency.length).toBeGreaterThan(10);
    for (const entry of agency) expect(stemOf(entry.role), entry.role).toBe(entry.stem);
  });

  it('resolves every name in the Agent roster of every lead to a core file that exists', () => {
    const stemOf = roleStemResolver('registry');
    const exists = (stem: string): boolean => fs.existsSync(path.join('registry', 'agents', `${stem}.md`));
    const leads = NATIVE_ROLES.filter(entry => entry.coordinator);
    expect(leads.length).toBeGreaterThan(8);
    for (const lead of leads) {
      const names = delegateNamesOf(leadTools(lead.role));
      if (names.length > 0) expect(unknownRosterNames(names, stemOf, exists), lead.role).toEqual([]);
    }
    expect(leads.filter(lead => delegateNamesOf(leadTools(lead.role)).length > 0).length).toBeGreaterThan(8);
  });

  it('reports a roster name that stands on no core, and a name that is a prototype key', () => {
    const stemOf = roleStemResolver('registry');
    const exists = (stem: string): boolean => fs.existsSync(path.join('registry', 'agents', `${stem}.md`));
    expect(unknownRosterNames(['ui-designer', 'ui-desinger', 'toString'], stemOf, exists)).toEqual(['ui-desinger', 'toString']);
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

  it('pins the look of the seven types: a canvas, a deck, a design system and Data take one, no document type does', () => {
    expect(table.types.map(type => [type.id, type.takesLook])).toEqual([
      ['design', true],
      ['slides', true],
      ['design-system', true],
      ['docs', false],
      ['sheets', false],
      ['whiteboard', false],
      ['data', true],
    ]);
  });

  it('has 22 specialist holders, none of them a lead', () => {
    expect(Object.keys(table.holders)).toHaveLength(22);
    for (const stem of Object.keys(table.holders)) expect(stem.startsWith('subagent-'), stem).toBe(true);
  });

  it('names ADR 0078 in its semantics, is for the claude host and is fixed text, never probed', () => {
    const parsed = JSON.parse(fs.readFileSync(path.resolve('registry/hosts/claude/page-types.json'), 'utf8')) as { host: string; semantics: string };
    expect(parsed.semantics).toMatch(/ADR 0078/);
    expect(parsed.host).toBe('claude');
  });

  it('needs the Claude Docs connector for Docs and Sheets and a tool search for Whiteboard and Data', () => {
    for (const id of ['docs', 'sheets']) expect(table.types.find(type => type.id === id)!.needs).toEqual(['mcp__claude_ai_Claude_Docs']);
    for (const id of ['whiteboard', 'data']) expect(table.types.find(type => type.id === id)!.needs).toEqual(['ToolSearch']);
    for (const id of ['design', 'slides', 'design-system']) expect(table.types.find(type => type.id === id)!.needs).toEqual([]);
  });
});
