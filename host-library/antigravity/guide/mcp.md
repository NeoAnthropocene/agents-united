---
host: antigravity
artifact: mcp
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: MCP servers

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary source: [mcp](../pages/mcp/mcp.md). Supporting sources: [plugins](../pages/plugin/plugins.md), [subagents](../pages/agent/subagents.md), [permissions](../pages/permissions/permissions.md).

Native output (Plan 032, Phase 8, ADR 0032) is a reviewed catalog of server entries (`registry/hosts/antigravity/mcp/servers.json`) that the native lane merges into the workspace `.agents/mcp_config.json` for the servers a bundle's agents declare.

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

- **A config file can hold secrets (`env`, `headers`, `oauth`).** The package never writes a token or a client secret, and its entries carry none of those three blocks. A server that needs a credential (`github`, `firecrawl`, `stitch`, `figma`) is written with `disabled: true`, and the install names the variable it needs; the user sets it in the environment agy starts from and runs `agy mcp enable <name>`. No `${VAR}` placeholder is written either, because whether the host expands one is unverified. The `.agents/mcp_config.json` workspace file is meant to be committed, so a secret never goes in it.
- **The packaged server entries come from what the bundles already declare for their agents** (a `- name: <server>` entry in the registry agents' `mcpServers:`): one catalog entry per declared name, with the launch command of the existing server definitions (`src/core/prerequisites.ts`), as `command` / `args` with no Claude or Cline field names. The native agents carry no `mcpServers:` frontmatter, so the servers are workspace-wide. `src/core/mcp-locations.ts` only finds where a host keeps its file.
- **The file is the user's.** The lane merges under strict JSON, keeps the user's servers, order, indent and line endings, treats a name the user already has as theirs, removes only the keys the lockfile records, and treats `disabled` as the user's switch (flipping it is never drift).
- **Not verified:** that agy reads the workspace file in a session (`agy mcp list` printed only the global servers in a scratch workspace that had one), whether a stdio server gets agy's own environment, whether `${VAR}` is expanded in `env`, how a server that cannot start affects a headless run (a global server that could not start made every headless session hang, see the Linux observation), whether an agent's `mcpServers:` frontmatter resolves (plan 031 left it untested), and how `agy mcp add` writes the same file. `agy mcp list` prints header and argument values in plain text, so its output must not be pasted anywhere.
- The Cline MCP file is still unresolved (ADR 0028).
