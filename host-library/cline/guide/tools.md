---
host: cline
artifact: tools
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: tools

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [all-cline-tools](../pages/tools/all-cline-tools.md). Supporting sources: [subagents](../pages/agent/subagents.md), [permission-handling](../pages/permissions/permission-handling.md), [plugins](../pages/plugin/plugins.md).

This guide feeds `registry/hosts/cline/tool-policy.json` (Plan 032, Phase 5 equivalent). The library names two different tool vocabularies, so a policy must say which surface it targets.

## Rules

### Built-in tools

- **The current built-in tools (ClineCore) are `bash`, `editor`, `read_files`, `apply_patch`, `search`, `fetch_web` and `ask_question`.** They fall into codebase operations (`editor`, `read_files`, `apply_patch`, `search`), execution (`bash`), external retrieval (`fetch_web`) and human-in-the-loop (`ask_question`). [Built-in tools (ClineCore)](../pages/tools/all-cline-tools.md#built-in-tools-clinecore), [Tool categories](../pages/tools/all-cline-tools.md#tool-categories)
- **Older docs use XML-style names such as `read_file`, `replace_in_file` and `execute_command`; the current runtime uses the names above.** [Legacy tool names vs current runtime tools](../pages/tools/all-cline-tools.md#legacy-tool-names-vs-current-runtime-tools)
- **An `Agent` from `@cline/agents` has no built-ins unless they are provided explicitly.** [Built-in tools (ClineCore)](../pages/tools/all-cline-tools.md#built-in-tools-clinecore)
- **Subagents have their own, narrower tool set:** `read_file`, `list_files`, `search_files`, `list_code_definition_names`, `execute_command` (read-only) and `use_skill`. [What subagents can do](../pages/agent/subagents.md#what-subagents-can-do)

### Approval and policy

- **Risky tools (`bash`, writes and edits) can require approval, low-risk tools (reads, search) can be auto-approved, and specific tools can be disabled entirely.** [Approval and policy controls](../pages/tools/all-cline-tools.md#approval-and-policy-controls)
- **A tool name without a policy defaults to enabled and auto-approved, so a read-only role must disable or gate the write tools explicitly.** [Tool policies](../pages/permissions/permission-handling.md#tool-policies)

### MCP and custom tools

- **MCP tools come from servers configured in `.cline/mcp.json` and are loaded alongside the built-ins.** [MCP tools](../pages/tools/all-cline-tools.md#mcp-tools)
- **Custom tools are defined in plugin code and registered in `setup()`.** They apply to the SDK, CLI and Kanban only, not to the VS Code and JetBrains extensions. [Custom tools](../pages/tools/all-cline-tools.md#custom-tools), [Plugins](../pages/plugin/plugins.md#plugins)

## Authoring notes (agents-united, not host behaviour)

- **Resolved for the CLI by observation ([observations](../observations/2026-10-02-cli-3.0.68.md)):** the canonical names are `read_files`, `search_codebase`, `run_commands`, `fetch_web_content`, `apply_patch`, `editor`, `skills`, `ask_question`, `submit_and_exit` and, for sub-agents, `spawn_agent`; legacy names (`read_file`, `search_files`, `execute_command`, `bash`, `use_skill` and others) are aliased onto them, which reconciles the two vocabularies above. The names `use_subagents` and `fetch_web` do not appear in the CLI build. `tool-policy.json` keys the canonical names and records the alias table; the IDE extension may differ and is unverified.
- Capability classes map as: `read` and `search` to `read_files` and `search_codebase`; `edit` to `editor` and `apply_patch`; `shell` to `run_commands`; `web` to `fetch_web_content`; `ask-user` to `ask_question`; `skill` to `skills`; `delegate` to `spawn_agent` (CLI; read-only research in the IDE is `use_subagents` per the docs). Classes with no documented or observed Cline tool (`workflow`, `scheduling` inside a session, `worktree`, `report`, `handback`, `artifacts`, `messaging`) are gaps in the delta table, except where a plugin could add one on the CLI.
