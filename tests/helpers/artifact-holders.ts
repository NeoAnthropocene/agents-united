import { splitTools } from '../../src/core/native-guard.js';
import { loadPageTypes, roleStemResolver, typesOfRole } from '../../src/core/page-types.js';
import type { PageType, PageTypeKind } from '../../src/core/types.js';
import { NATIVE_ROLES, nativeText } from './native-roles.js';

/**
 * ADR 0077 and ADR 0078 - the roles that make documents hold the `Artifact` tool, and the page types each of them may start. The specialists are the
 * holders of `registry/hosts/claude/page-types.json` (the Semantic Core stems that carry the capability class `artifacts`); the leads are the six
 * below, and a lead's list is the union of the lists of the roles in its roster. Every suite that needs the list reads it from here, so the native
 * files that stand on a core (a marketing core feeds a `marketing-` and an `agency-` file) follow without a second list.
 */

export const PAGE_TABLE = loadPageTypes('registry', 'claude');

/** The stem of the core of a native role name, from the native role names of the bundles (the agency copies stand on a core of another name). */
export const STEM_OF_ROLE = roleStemResolver('registry');

/** The one connector entry (the whole server, no route variants) that a role holds exactly when its page types include a connector type. */
export const CONNECTOR_ENTRY = 'mcp__claude_ai_Claude_Docs';

/** The leads whose rosters hold at least one specialist that publishes pages. */
export const HOLDER_LEAD_STEMS: readonly string[] = [
  'orchestrator-design',
  'orchestrator-marketing',
  'orchestrator-digital-agency',
  'orchestrator-business',
  'orchestrator-research',
  'orchestrator-system-architecture',
];

/** The holders ADR 0078 added to the ones of ADR 0077: five specialists and the system-architecture lead. */
export const NEW_HOLDER_STEMS: readonly string[] = [
  'subagent-paid-acquisition-specialist',
  'subagent-plg-strategist',
  'subagent-financial-analyst',
  'subagent-system-architect',
  'subagent-finops-cost-engineer',
  'orchestrator-system-architecture',
];

/** The Semantic Core stems that carry the class `artifacts`: the specialists of the table, then the leads. */
export const HOLDER_STEMS: readonly string[] = [...Object.keys(PAGE_TABLE.holders), ...HOLDER_LEAD_STEMS];

/** The native files (role names) that stand on a holder core, from the committed roster of native roles. */
export const HOLDER_ROLES: readonly string[] = NATIVE_ROLES.filter(entry => HOLDER_STEMS.includes(entry.stem)).map(entry => entry.role);

/** The holders that lead a team: their roster rows say which specialist publishes pages. */
export const HOLDER_LEADS: readonly string[] = NATIVE_ROLES.filter(entry => entry.coordinator && HOLDER_STEMS.includes(entry.stem)).map(entry => entry.role);

/** The tools line of a committed native file, as a list (an `Agent(a, b)` allowlist stays one entry). */
export const toolsLineOf = (role: string): string[] => splitTools(/^tools: (.*)$/m.exec(nativeText(role))![1]!);

/** The page types of a committed native holder: a specialist's own list, a lead's union over the `Agent(...)` allowlist of its tools line. */
export function pageTypesOfRole(role: string): PageType[] {
  const entry = NATIVE_ROLES.find(candidate => candidate.role === role)!;
  return typesOfRole(PAGE_TABLE, { stem: entry.stem, coordinator: entry.coordinator, tools: toolsLineOf(role) }, STEM_OF_ROLE);
}

/** The holder files whose page types include the type. */
export const holdersOfType = (id: string): string[] => HOLDER_ROLES.filter(role => pageTypesOfRole(role).some(type => type.id === id));

/** The holder files whose page types include a type that is filled this way. */
export const holdersOfKind = (kind: PageTypeKind): string[] => HOLDER_ROLES.filter(role => pageTypesOfRole(role).some(type => type.filledBy === kind));

/** A role text without its generated publishing block (ADR 0077): that block is checked by its own suite and names the bundled skills and the commands of the standalone site. */
export const withoutPublishingBlock = (value: string): string =>
  value.replace(/<!-- agents-united:publishing:start[^>]*-->[\s\S]*?<!-- agents-united:publishing:end -->\n?/, '');

/** The one safety line of every holder core: it says what leaves the project and under which condition (ADR 0077 decision 7). */
export const PUBLISH_FLOOR_LINE =
  "- **Publish Artifact**: Publish a page to a hosted site only with the user's go-ahead for that page; an update to a page the user already approved needs no new go-ahead. Keep it private, leave who can see it to the user, and say in your report that project material has left the project.";
