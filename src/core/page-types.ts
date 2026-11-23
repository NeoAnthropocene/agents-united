/**
 * ADR 0078 - the page types of a Claude account and the roles that hold them. The table is fixed text in `registry/hosts/<host>/page-types.json`;
 * it is read, checked and never probed at run time. A specialist's list is its holder entry; a lead's list is the union of the lists of the roles in
 * its `Agent(...)` allowlist. Pure functions apart from the one file read: no terminal I/O, no clock.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FACTORY_WORKERS } from './claude-factory-declaration.js';
import type { PageType, PageTypeId, PageTypeKind, PageTypeTable } from './types.js';

const KINDS: readonly PageTypeKind[] = ['files', 'connector', 'store'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPECIALIST_STEM = /^subagent-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = (message: string): never => {
  throw new Error(`Page types: ${message}`);
};
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseType(entry: unknown, index: number): PageType {
  if (!isRecord(entry)) return fail(`type ${index + 1} is not an object.`);
  const id = entry.id;
  if (typeof id !== 'string' || !ID.test(id)) return fail(`type ${index + 1} needs an id in kebab case.`);
  for (const key of ['title', 'for'] as const) {
    const value = entry[key];
    if (typeof value !== 'string' || value.trim() === '') return fail(`type "${id}" needs a non-empty ${key}.`);
    if (value !== value.trim()) return fail(`type "${id}" needs a ${key} without spaces around it.`);
  }
  if (typeof entry.filledBy !== 'string' || !KINDS.includes(entry.filledBy as PageTypeKind)) return fail(`type "${id}" needs filledBy to be files, connector or store.`);
  if (!Array.isArray(entry.needs) || entry.needs.some(tool => typeof tool !== 'string' || tool.trim() === '')) return fail(`type "${id}" needs a needs list of tool names.`);
  const needs = entry.needs as string[];
  if (needs.some(tool => tool !== tool.trim())) return fail(`type "${id}" needs tool names without spaces around them.`);
  const twice = needs.find((tool, at) => needs.indexOf(tool) !== at);
  if (twice !== undefined) return fail(`type "${id}" names the tool "${twice}" twice.`);
  if (entry.filledBy === 'connector' && needs.length === 0) return fail(`type "${id}" is filled through a connector and needs at least one tool.`);
  if (entry.filledBy === 'store' && needs.length === 0) return fail(`type "${id}" is filled through a store and needs at least one tool.`);
  if (entry.filledBy === 'files' && needs.length > 0) return fail(`type "${id}" is filled by files and needs no tool.`);
  if (typeof entry.takesLook !== 'boolean') return fail(`type "${id}" needs takesLook to be true or false.`);
  return {
    id,
    title: entry.title as string,
    for: entry.for as string,
    filledBy: entry.filledBy as PageTypeKind,
    needs: [...(entry.needs as string[])],
    takesLook: entry.takesLook,
  };
}

/** Checks a parsed table and returns it typed. Throws a clear error for each fault. */
export function parsePageTypes(value: unknown): PageTypeTable {
  if (!isRecord(value)) return fail('the table is not an object.');
  if (typeof value.host !== 'string' || value.host.trim() === '') return fail('the table needs a host.');
  if (typeof value.semantics !== 'string' || value.semantics.trim() === '') return fail('the table needs semantics as a non-empty string.');
  if (!Array.isArray(value.types) || value.types.length === 0) return fail('the table needs a non-empty list of types.');
  const types = value.types.map(parseType);
  const order = new Map<PageTypeId, number>();
  const titles = new Set<string>();
  for (const type of types) {
    if (order.has(type.id)) return fail(`type id "${type.id}" appears twice.`);
    order.set(type.id, order.size);
    if (titles.has(type.title)) return fail(`the title "${type.title}" appears twice.`);
    titles.add(type.title);
  }
  if (!isRecord(value.holders)) return fail('the table needs a holders object.');
  const holders: Record<string, PageTypeId[]> = {};
  for (const [stem, list] of Object.entries(value.holders)) {
    if (!SPECIALIST_STEM.test(stem)) return fail(`holder "${stem}" is not a specialist stem; a lead's list is computed from its roster.`);
    if (!Array.isArray(list) || list.some(id => typeof id !== 'string')) return fail(`holder "${stem}" needs a list of type ids.`);
    if (list.length === 0) return fail(`holder "${stem}" has an empty list.`);
    let last = -1;
    let lastId = '';
    const seen = new Set<string>();
    for (const id of list as string[]) {
      if (!order.has(id)) return fail(`holder "${stem}" names the unknown type "${id}".`);
      if (seen.has(id)) return fail(`holder "${stem}" lists "${id}" twice.`);
      seen.add(id);
      if (order.get(id)! < last) return fail(`holder "${stem}" lists "${lastId}" before "${id}"; keep the catalogue order.`);
      last = order.get(id)!;
      lastId = id;
    }
    holders[stem] = [...(list as string[])];
  }
  return { semantics: value.semantics, types, holders };
}

/** Reads and checks `registry/hosts/<host>/page-types.json`. */
export function loadPageTypes(registryDir: string, host: string = 'claude'): PageTypeTable {
  const file = path.join(registryDir, 'hosts', host, 'page-types.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    return fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const table = parsePageTypes(parsed);
  const declared = (parsed as Record<string, unknown>).host;
  if (declared !== host) return fail(`the table is for the host "${String(declared)}", not "${host}".`);
  return table;
}

/** The table of a registry, or an empty table when the registry carries none (a role then has no page type, and one that holds `Artifact` is refused). */
export function loadPageTypesIfPresent(registryDir: string, host: string = 'claude'): PageTypeTable {
  return fs.existsSync(path.join(registryDir, 'hosts', host, 'page-types.json')) ? loadPageTypes(registryDir, host) : { semantics: '', types: [], holders: {} };
}

const inCatalogueOrder = (table: PageTypeTable, ids: ReadonlySet<PageTypeId>): PageType[] => table.types.filter(type => ids.has(type.id));

/** The types a specialist holds, by the stem of its core, in catalogue order; nothing for a stem without an entry. */
export function typesOfSpecialist(table: PageTypeTable, stem: string): PageType[] {
  return inCatalogueOrder(table, new Set(Object.hasOwn(table.holders, stem) ? table.holders[stem] : []));
}

/**
 * The native role names that differ from their core: `registry/bundles.json` lists, per bundle, `nativeRoles` (agent file to the name of the
 * native copy, for example `subagent-marketing-growth-strategist.md` to `agency-growth-strategist`); the fixed workers of the agent factory carry their
 * role and core in `FACTORY_WORKERS`. Returns native role name to core stem.
 */
export function nativeRoleStems(registryDir: string): Record<string, string> {
  const file = path.join(registryDir, 'bundles.json');
  const parsed = (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}) as { bundles?: Record<string, { nativeRoles?: Record<string, string> }> };
  const stems: Record<string, string> = {};
  for (const worker of FACTORY_WORKERS) stems[worker.role] = worker.definition;
  for (const bundle of Object.values(parsed.bundles ?? {})) {
    for (const [agentFile, role] of Object.entries(bundle.nativeRoles ?? {})) stems[role] = agentFile.replace(/.md$/i, '');
  }
  return stems;
}

/** The stem of the core a native role stands on: the stem that the bundles give its name, else `subagent-<name>`. */
export function stemOfRoleName(name: string, aliases: Readonly<Record<string, string>>): string {
  return Object.hasOwn(aliases, name) ? aliases[name]! : `subagent-${name}`;
}

/** The resolver of a registry: native role name to core stem, from the native role names of its bundles. */
export function roleStemResolver(registryDir: string): (name: string) => string {
  const aliases = nativeRoleStems(registryDir);
  return name => stemOfRoleName(name, aliases);
}

/** The names of a roster that stand on no core (`exists` says whether a stem has a core file); a typo in an `Agent(...)` allowlist shows here. */
export function unknownRosterNames(roster: readonly string[], stemOf: (name: string) => string, exists: (stem: string) => boolean): string[] {
  return roster.filter(name => !exists(stemOf(name)));
}

/** The union of the lists of the roles in a lead's roster, in catalogue order. */
export function typesOfLead(table: PageTypeTable, roster: readonly string[], stemOf: (name: string) => string | undefined): PageType[] {
  const ids = new Set<PageTypeId>();
  for (const name of roster) {
    const stem = stemOf(name);
    if (stem !== undefined && Object.hasOwn(table.holders, stem)) for (const id of table.holders[stem]!) ids.add(id);
  }
  return inCatalogueOrder(table, ids);
}

/** The role names of the `Agent(a, b)` allowlist of a tools line; none when the line holds a bare `Agent` or no `Agent`. */
export function delegateNamesOf(tools: readonly string[]): string[] {
  const entry = tools.find(tool => tool.startsWith('Agent('));
  const match = entry === undefined ? null : /^Agent\((.*)\)$/.exec(entry);
  return match === null ? [] : match[1]!.split(',').map(name => name.trim()).filter(name => name !== '');
}

/** The page types of a role: a specialist's own list, or a lead's union over its roster. */
export function typesOfRole(
  table: PageTypeTable,
  role: { stem: string; coordinator: boolean; tools: readonly string[] },
  stemOf: (name: string) => string | undefined,
): PageType[] {
  return role.coordinator ? typesOfLead(table, delegateNamesOf(role.tools), stemOf) : typesOfSpecialist(table, role.stem);
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** The connector tools a list needs: the `needs` of its connector types, each once. */
export function connectorToolsOf(types: readonly PageType[]): string[] {
  return unique(types.filter(type => type.filledBy === 'connector').flatMap(type => type.needs));
}

/** The tools a list needs to reach a page's own store: the `needs` of its store types, each once. */
export function storeNeedsOf(types: readonly PageType[]): string[] {
  return unique(types.filter(type => type.filledBy === 'store').flatMap(type => type.needs));
}
