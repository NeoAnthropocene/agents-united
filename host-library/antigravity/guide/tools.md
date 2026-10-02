---
host: antigravity
artifact: tools
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: tools (the catalog a role's grants are drawn from)

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [hooks: supported tools](../pages/hook/hooks.md#supported-tools), [SDK tools](../pages/tools/sdk-tools.md). Supporting sources: [subagents](../pages/agent/subagents.md), [permissions](../pages/permissions/permissions.md).

**Two vocabularies appear, as on Cline.** The hooks page names the tools an agent and a hook matcher see (`view_file`, `write_to_file`, `run_command`, `invoke_subagent`); the SDK page names its built-in identifiers differently (`list_directory`, `create_file`, `edit_file`, `start_subagent`). Agent frontmatter examples use the first set.

## Rules

### Tools by category (the hook / agent-frontmatter names)

- **File and directory: `view_file`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `list_dir` and `find_by_name`.** [File and Directory Operations](../pages/hook/hooks.md#file-and-directory-operations)
- **Search and research: `grep_search`, `search_web` and `read_url_content`.** [Search and Research](../pages/hook/hooks.md#search-and-research)
- **System and execution: `run_command`, `manage_task`, `schedule`, `list_permissions` and `ask_permission`.** [System and Execution](../pages/hook/hooks.md#system-and-execution)
- **Agent collaboration: `invoke_subagent`, `define_subagent`, `send_message` and `manage_subagents`.** [Agent Collaboration](../pages/hook/hooks.md#agent-collaboration)
- **Interaction and media: `ask_question` and `generate_image`.** [Interaction and Media](../pages/hook/hooks.md#interaction-and-media)
- **Any of these names can be matched by a hook `matcher`, as a regular expression.** [Matcher](../pages/hook/hooks.md#matcher), [Supported Tools](../pages/hook/hooks.md#supported-tools)

### Granting tools to an agent

- **An agent's `tools` frontmatter lists the tools it may use (default none); a wrong name can hang the subagent.** [Frontmatter Configuration (YAML)](../pages/agent/subagents.md#frontmatter-configuration-yaml)
- **`define_subagent` creates a transient subagent with `enable_mcp_tools`, `enable_write_tools` and `enable_subagent_tools` switches instead of a tool list.** [Agent Collaboration](../pages/hook/hooks.md#agent-collaboration)
- **MCP tools are permissioned as `mcp(server/tool)`, and an agent's `mcpServers` brings the servers.** [MCP Permissions and Access Control](../pages/mcp/mcp.md#mcp-permissions-and-access-control)

### SDK catalog

- **The SDK's `BuiltinTools` are `list_directory`, `search_directory`, `find_file`, `view_file`, `create_file`, `edit_file`, `run_command`, `ask_question`, `start_subagent`, `generate_image`, `search_web`, `read_url_content` and `finish`; `enabled_tools` and `disabled_tools` (for example `BuiltinTools.read_only()`) filter them.** [Built-in tools reference](../pages/tools/sdk-tools.md#built-in-tools-reference), [Tool group helpers and filtering](../pages/tools/sdk-tools.md#tool-group-helpers-and-filtering)
- **Web search and URL fetching are on by default, and custom Python functions register in `LocalAgentConfig(tools=[...])`.** [Built-in web tools](../pages/tools/sdk-tools.md#built-in-web-tools), [Custom Python functions](../pages/tools/sdk-tools.md#custom-python-functions)

## Authoring notes (agents-united, not host behaviour)

- **The native tool catalog is the hooks-page set.** Per ADR 0025 decision 2 a role's tools are derived from capability classes through `registry/hosts/antigravity/tool-policy.json`, whose keys are those names; the SDK names are recorded only as aliases, and a test checks each granted name against the catalog, because a wrong one can hang the agent.
- **There is no documented per-agent read-only restriction beyond the `tools` list,** and what that list enforces on Antigravity is unverified: the docs call `tools` "permitted tools", plan 031 listed agents with `tools: [view_file]` but did not try a write. A read-only role (reviewer, indexer) holds no writing tool in its list; until a probe shows the host refuses the rest, treat that as a promise and keep a `PreToolUse` guard in `hooks.json` as the backstop.
- **Observed ([plan 031](../../../plans/031-antigravity-agent-discovery-spike.md)):** agents listed with `grep_search`, `find_by_name`, `list_dir` and `send_message` beside `view_file` were discovered; whether those names are accepted at run time was not tested.
- **The `read_file`, `write_file`, `read_url`, `execute_url`, `command` and `mcp` names of the permission engine are resources, not tools:** `read_file(...)` is not a tool name to put in `tools`.
