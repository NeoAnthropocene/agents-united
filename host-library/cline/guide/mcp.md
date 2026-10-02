---
host: cline
artifact: mcp
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: MCP servers

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [mcp-overview](../pages/mcp/mcp-overview.md). Supporting sources: [all-cline-tools](../pages/tools/all-cline-tools.md), [subagents](../pages/agent/subagents.md), [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md).

Native output for MCP wiring lands in `registry/hosts/cline/` as server entries under `mcpServers` (Plan 032, Phase 8). Where the config file lives is inconsistent across the pages, see the authoring notes.

## Rules

### Server entries

- **A local (STDIO) server uses `command` and `args` (plus optional `env`, `disabled`, `autoApprove`); a remote server uses `url` (plus optional `headers`).** Entries sit under `mcpServers`. [Configuration examples](../pages/mcp/mcp-overview.md#configuration-examples), [Local server (STDIO)](../pages/mcp/mcp-overview.md#local-server-stdio)
- **A remote server's `type` selects the transport: set `"type": "streamableHttp"` explicitly.** Omitting `type` defaults to the legacy `sse` transport for backward compatibility, and `"type": "sse"` is only for legacy servers. [Remote server (Streamable HTTP)](../pages/mcp/mcp-overview.md#remote-server-streamable-http), [Transport types](../pages/mcp/mcp-overview.md#transport-types)
- **Use STDIO for local tools and a remote transport for shared hosted services.** [Transport types](../pages/mcp/mcp-overview.md#transport-types)
- **Keep secrets in environment variables, limit `autoApprove` to safe tools, and only install servers you trust.** Review tool calls before approval. [Security basics](../pages/mcp/mcp-overview.md#security-basics)

### Where it is configured

- **The CLI reads `~/.cline/mcp.json`; the IDE extensions open their own MCP settings JSON from the MCP Servers panel (Configure tab).** Hosted endpoints can instead be added on the Remote Servers tab with a name, URL and transport. [Manual config](../pages/mcp/mcp-overview.md#manual-config)
- **`cline mcp` is an interactive wizard to list, add, edit, enable or disable and delete servers; `cline config mcp` (with `--json`) lists them non-interactively.** [CLI MCP wizard](../pages/mcp/mcp-overview.md#cli-mcp-wizard), [CLI](../pages/mcp/mcp-overview.md#cli)
- **MCP tools load alongside the built-in tools.** [MCP tools](../pages/tools/all-cline-tools.md#mcp-tools)
- **Subagents cannot reach MCP servers.** Work that needs an MCP tool stays with the main agent. [What subagents can do](../pages/agent/subagents.md#what-subagents-can-do)

## Authoring notes (agents-united, not host behaviour)

- **Inconsistent config location:** the MCP page says the CLI uses `~/.cline/mcp.json`, the tools page and the CLI reference's file tree say `.cline/mcp.json` (project root), and the config page lists `cline_mcp_settings.json` under `~/.cline/data/settings/`. The docs do not reconcile these. Before the package writes an MCP file, verify in a real session which file each surface reads, and do not write to more than one. [Configuration files](../pages/settings/cli-reference.md#configuration-files), [Configuration directory layout](../pages/settings/config.md#configuration-directory-layout)
- MCP wiring from the semantic core (for example the GitHub and Context7 servers the orchestrator uses) maps to one `mcpServers` entry each, with `"type": "streamableHttp"` for remote ones, and secrets never written into the file.
