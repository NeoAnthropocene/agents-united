---
host: antigravity
artifact: mcp
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: MCP servers

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary source: [mcp](../pages/mcp/mcp.md). Supporting sources: [plugins](../pages/plugin/plugins.md), [subagents](../pages/agent/subagents.md), [permissions](../pages/permissions/permissions.md).

Native output (Plan 032, Phase 8) is a reviewed `mcp_config.json` fragment for the servers a bundle declares; MCP wiring is a later slice after the agents, rules and hooks.

## Rules

### Configuration files

- **The config is a single `mcpServers` object in `mcp_config.json`: globally `~/.gemini/config/mcp_config.json`, per workspace `.agents/mcp_config.json`.** The SDK discovers the workspace file too. [Global and Workspace Server Configs](../pages/mcp/mcp.md#global-and-workspace-server-configs), [MCP Configuration Structure](../pages/mcp/mcp.md#mcp-configuration-structure), [Getting started by surface](../pages/mcp/mcp.md#getting-started-by-surface)
- **Each server needs one transport: `command` (stdio) or `serverUrl` (Streamable HTTP or SSE).** Optional keys are `args`, `env`, `cwd`, `headers`, `authProviderType`, `oauth`, `disabled` and `disabledTools`. [MCP Configuration Properties](../pages/mcp/mcp.md#mcp-configuration-properties)
- **A remote server must use `serverUrl`; the legacy `url` and `httpUrl` fields are not supported.** [Global and Workspace Server Configs](../pages/mcp/mcp.md#global-and-workspace-server-configs)
- **`disabled` switches a server off without removing it, and `disabledTools` withholds named tools from the model.** [MCP Configuration Properties](../pages/mcp/mcp.md#mcp-configuration-properties)

### Authentication

- **`authProviderType: "google_credentials"` uses Application Default Credentials (set up with `gcloud auth application-default login`).** [Google Credentials](../pages/mcp/mcp.md#google-credentials)
- **OAuth works automatically for servers that support dynamic client registration; otherwise give `oauth.clientId` and `clientSecret`, and register `https://antigravity.google/oauth-callback` as the redirect URI.** Tokens are stored in `~/.gemini/antigravity/mcp_oauth_tokens.json`. [OAuth](../pages/mcp/mcp.md#oauth)
- **Custom HTTP headers (API keys, bearer tokens) go in `headers`.** [Custom Headers](../pages/mcp/mcp.md#custom-headers)

### Permissions and scoping

- **Unconfigured MCP tools run in Ask mode; allow them with `mcp(server/tool)`, `mcp(server/*)` or `mcp(*)`.** [MCP Permissions and Access Control](../pages/mcp/mcp.md#mcp-permissions-and-access-control)
- **A custom agent can carry its own `mcpServers` in frontmatter, and a plugin can bundle an `mcp_config.json`.** [Frontmatter Configuration (YAML)](../pages/agent/subagents.md#frontmatter-configuration-yaml), [Supported components](../pages/plugin/plugins.md#supported-components)
- **In the CLI, `/mcp` opens the manager (status, reload, connection logs); in 2.0 and the IDE the servers are managed in settings and the MCP Store.** [Interactive MCP Manager](../pages/mcp/mcp.md#interactive-mcp-manager), [Getting started by surface](../pages/mcp/mcp.md#getting-started-by-surface)

## Authoring notes (agents-united, not host behaviour)

- **A config file can hold secrets (`env`, `headers`, `oauth`).** The package never writes a token or a client secret: it writes the server entry with the value read from the user's environment, or leaves a named placeholder, and says which. The `.agents/mcp_config.json` workspace file is meant to be committed, so a secret never goes in it.
- **The packaged server entries come from what the bundles already declare for their agents** (a `- name: <server>` entry, wired through the MCP location registry in `src/core/mcp-locations.ts`), translated to `command` / `serverUrl` with no Claude or Cline field names; an agent's `mcpServers:` reference stays by name.
- **Not verified:** whether an agent's `mcpServers:` frontmatter resolves (plan 031 left it untested), and how `agy mcp add` writes the same file (`agy mcp` has add, remove, list, enable and disable subcommands; they are documented only in `agy --help`, which this guide did not exercise).
- The Cline MCP file is still unresolved (ADR 0028); this host is the one whose file and schema are documented, so the MCP slice can start here.
