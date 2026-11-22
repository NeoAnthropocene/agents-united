import { NATIVE_ROLES } from './native-roles.js';

/**
 * ADR 0077 - the roles that make documents hold the `Artifact` tool, as the table of the Semantic Core stems that carry the capability class
 * `artifacts`. Adding a holder is one line here (and the class and the floor line in its core); every suite that needs the list reads it from
 * here, so the native files that stand on a core (a marketing core feeds a `marketing-` and an `agency-` file) follow without a second list.
 */
export const HOLDER_STEMS: readonly string[] = [
  // design
  'subagent-ui-designer',
  'subagent-ux-strategist',
  'subagent-interaction-designer',
  'subagent-design-systems-architect',
  'subagent-design-ops-lead',
  'subagent-design-researcher',
  'subagent-designer-toolkit-expert',
  'subagent-prototype-tester',
  // creative (two native files)
  'subagent-marketing-creative-designer',
  // marketing (each feeds a `marketing-` and an `agency-` native file)
  'subagent-marketing-growth-strategist',
  'subagent-marketing-content-strategist',
  'subagent-marketing-campaign-specialist',
  'subagent-marketing-conversion-specialist',
  // business and research
  'subagent-business-panel-experts',
  'subagent-deep-research',
  // leads
  'orchestrator-design',
  'orchestrator-marketing',
  'orchestrator-digital-agency',
  'orchestrator-business',
  'orchestrator-research',
];

/** The native files (role names) that stand on a holder core, from the committed roster of native roles. */
export const HOLDER_ROLES: readonly string[] = NATIVE_ROLES.filter(entry => HOLDER_STEMS.includes(entry.stem)).map(entry => entry.role);

/** The holders that lead a team: their roster rows say which specialist publishes pages. */
export const HOLDER_LEADS: readonly string[] = NATIVE_ROLES.filter(entry => entry.coordinator && HOLDER_STEMS.includes(entry.stem)).map(entry => entry.role);

/** A role text without its generated publishing block (ADR 0077): that block is checked by its own suite and names the bundled skills and the commands of the standalone site. */
export const withoutPublishingBlock = (value: string): string =>
  value.replace(/<!-- agents-united:publishing:start[^>]*-->[\s\S]*?<!-- agents-united:publishing:end -->\n?/, '');

/** The one safety line of every holder core: it says what leaves the project and under which condition (ADR 0077 decision 7). */
export const PUBLISH_FLOOR_LINE =
  "- **Publish Artifact**: Publish a page to a hosted site only with the user's go-ahead for that page; an update to a page the user already approved needs no new go-ahead. Keep it private, leave who can see it to the user, and say in your report that project material has left the project.";
