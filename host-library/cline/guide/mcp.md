---
host: cline
artifact: mcp
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: MCP servers

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [mcp-overview](../pages/mcp/mcp-overview.md). Supporting sources: [all-cline-tools](../pages/tools/all-cline-tools.md), [subagents](../pages/agent/subagents.md), [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md).

Native output for MCP wiring lands in `registry/hosts/cline/` as server entries under `mcpServers` (Plan 032, Phase 8). See the authoring notes for historical observations and the remaining current-build boundary.

## Rules

### Server entries

- **A local (STDIO) server uses `command` and `args` (plus optional `env`, `disabled`, `autoApprove`); a remote server uses `url` (plus optional `headers`).** Entries sit under `mcpServers`. [Configuration examples](../pages/mcp/mcp-overview.md#configuration-examples), [Local server (STDIO)](../pages/mcp/mcp-overview.md#local-server-stdio)
- **A remote server's `type` selects the transport: set `"type": "streamableHttp"` explicitly.** Omitting `type` defaults to the legacy `sse` transport for backward compatibility, and `"type": "sse"` is only for legacy servers. [Remote server (Streamable HTTP)](../pages/mcp/mcp-overview.md#remote-server-streamable-http), [Transport types](../pages/mcp/mcp-overview.md#transport-types)
- **Use STDIO for local tools and a remote transport for shared hosted services.** [Transport types](../pages/mcp/mcp-overview.md#transport-types)
- **Keep secrets in environment variables, limit `autoApprove` to safe tools, and only install servers you trust.** Review tool calls before approval. [Security basics](../pages/mcp/mcp-overview.md#security-basics)

### Where it is configured

- **The docs give `~/.cline/data/settings/cline_mcp_settings.json` for the CLI, with `CLINE_MCP_SETTINGS_PATH` as an override; the IDE extensions open their own MCP settings JSON from the MCP Servers panel (Configure tab).** Hosted endpoints can instead be added on the Remote Servers tab with a name, URL and transport. [Manual config](../pages/mcp/mcp-overview.md#manual-config)
- **`cline mcp` is an interactive wizard; the refreshed page also documents scripted add and remove, and OAuth authorization; `cline config mcp` (with `--json`) lists them non-interactively.** [CLI MCP wizard](../pages/mcp/mcp-overview.md#cli-mcp-wizard), [CLI](../pages/mcp/mcp-overview.md#cli)
- **MCP tools load alongside the built-in tools.** [MCP tools](../pages/tools/all-cline-tools.md#mcp-tools)
- **Subagents cannot reach MCP servers.** Work that needs an MCP tool stays with the main agent. [What subagents can do](../pages/agent/subagents.md#how-it-works)

## Authoring notes (agents-united, not host behaviour)

- **Current documentation names the same global CLI settings path across the MCP, tools, config and CLI-reference snapshots.** Older docs and observations gave other paths; project-level precedence and actual current-build reads remain unverified. Before the package writes an MCP file, verify in a real session which file each surface reads, and do not write to more than one. [Configuration files](../pages/settings/cli-reference.md#configuration-files), [Configuration directory layout](../pages/settings/config.md#configuration-directory-layout)
- MCP wiring from the semantic core (for example the GitHub and Context7 servers the orchestrator uses) maps to one `mcpServers` entry each, with `"type": "streamableHttp"` for remote ones, and secrets never written into the file.
