/**
 * Plan 035 N1 (slice 3) - the other names an integration's tools take on Claude Code when it does not come from `claude mcp add`.
 *
 * A server added with `claude mcp add --scope project <name>` keeps its name, and its tools are `mcp__<name>__<tool>`: the form a role's `tools:` line names.
 * A plugin's MCP server is another server. Seen on 2.1.291 with context7: after `claude plugin install context7@claude-plugins-official --scope project`,
 * `claude mcp list` and `/mcp` show `plugin:context7:context7`, and the running session loads it after `/reload-plugins`, with no restart. Its tools are named
 * `mcp__plugin_<plugin>_<server>__<tool>` (the host docs; context7 asks for authentication, so no tool name was seen). A claude.ai connector in the CLI is
 * `mcp__claude_ai_<Name>__<tool>` (seen for Firecrawl in earlier session records; the desktop app names a connector by its directory id instead, which a
 * static allowlist does not carry). A grant names one server, so a role that names only the first form cannot use the others: the table below adds the other
 * forms for the integrations that have them.
 *
 * The firecrawl plugin ships skills and commands and no MCP server (no `.mcp.json`, no `mcpServers` in its manifest at the pinned commit), and markitdown and
 * stitch have no plugin in the official marketplace, so they have no plugin entry. The chrome-devtools-mcp plugin declares its server as `chrome-devtools`.
 */

export interface McpRoute {
  /** The plugin that carries the server and the key of the server in its manifest. */
  plugin?: { name: string; server: string };
  /** The name of the claude.ai connector in the CLI. */
  connector?: string;
}

export const CLAUDE_MCP_ROUTES: Readonly<Record<string, McpRoute>> = {
  'chrome-devtools-mcp': { plugin: { name: 'chrome-devtools-mcp', server: 'chrome-devtools' } },
  context7: { plugin: { name: 'context7', server: 'context7' } },
  figma: { plugin: { name: 'figma', server: 'figma' } },
  firecrawl: { connector: 'Firecrawl' },
  github: { plugin: { name: 'github', server: 'github' } },
  playwright: { plugin: { name: 'playwright', server: 'playwright' } },
};

/** The host replaces any character outside `A-Z`, `a-z`, `0-9`, `_` and `-` with `_` in the segments of a tool name. */
const segment = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '_');

/** `mcp__plugin_<plugin>_<server>` for an integration that a plugin brings as an MCP server, else undefined. */
export function pluginServerGrant(integration: string): string | undefined {
  const plugin = CLAUDE_MCP_ROUTES[integration]?.plugin;
  return plugin ? `mcp__plugin_${segment(plugin.name)}_${segment(plugin.server)}` : undefined;
}

/** `mcp__claude_ai_<Name>` for an integration whose connector name was seen, else undefined. */
export function connectorServerGrant(integration: string): string | undefined {
  const connector = CLAUDE_MCP_ROUTES[integration]?.connector;
  return connector ? `mcp__claude_ai_${segment(connector)}` : undefined;
}

/** Splits `mcp__<server>` or `mcp__<server>__<tool>` into its server segment and its tool, if any. */
function parse(grant: string): { server: string; tool?: string } | undefined {
  if (!grant.startsWith('mcp__')) return undefined;
  const rest = grant.slice('mcp__'.length);
  const cut = rest.indexOf('__');
  return cut === -1 ? { server: rest } : { server: rest.slice(0, cut), tool: rest.slice(cut + 2) };
}

/** Each `mcp__<integration>` or `mcp__<integration>__<tool>` grant followed by the same grant under the plugin name and the connector name, where there are any. */
export function withRoutes(grants: readonly string[]): string[] {
  const out: string[] = [];
  const add = (grant: string): void => {
    if (!out.includes(grant)) out.push(grant);
  };
  for (const grant of grants) {
    add(grant);
    const parsed = parse(grant);
    if (!parsed) continue;
    for (const other of [pluginServerGrant(parsed.server), connectorServerGrant(parsed.server)]) {
      if (other) add(parsed.tool === undefined ? other : `${other}__${parsed.tool}`);
    }
  }
  return out;
}

/** The integration behind a grant, whichever route its name comes from; the server segment itself when the grant is a manual one. */
export function integrationOf(grant: string): string {
  const parsed = parse(grant);
  if (!parsed) return grant;
  for (const integration of Object.keys(CLAUDE_MCP_ROUTES)) {
    for (const prefix of [pluginServerGrant(integration), connectorServerGrant(integration)]) {
      if (prefix && (grant === prefix || grant.startsWith(`${prefix}__`))) return integration;
    }
  }
  return parsed.server;
}
