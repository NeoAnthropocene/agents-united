---
host: claude
artifact: tools
reviewedAgainst: "2.1.285"
---

# Claude Code — authoring guide: the native tool catalog

Distilled from the snapshots in `host-library/claude/pages/`. Primary source: [tools-reference](../pages/tools/tools-reference.md). Supporting sources: [sub-agents](../pages/agent/sub-agents.md), [permissions](../pages/permissions/permissions.md), [mcp](../pages/mcp/mcp.md).

This guide is the input for `registry/hosts/claude/tool-policy.json` (Plan 032 Phase 5): the **complete** native catalog, the capability class each tool serves, and the conditions under which it exists. A role grants classes; the policy resolves a class to the tools that are present. Never assume a tool exists: availability depends on provider, platform, model, plan, version and settings. [Check which tools are available](../pages/tools/tools-reference.md#check-which-tools-are-available)

## Catalog by capability class

Classes are the ones in ADR 0025 decision 8. Tools that fit none are listed as `unclassified` with a proposed class for the policy PR.

| Class | Tools | Availability and conditions | Source |
| :- | :- | :- | :- |
| read | `Read`, `ListMcpResourcesTool`, `ReadMcpResourceTool` | Read handles text, images, PDFs (over 10 pages need `pdftoppm`) and notebooks; MCP resource tools need connected servers. No permission prompt inside the working directories | [Read tool behavior](../pages/tools/tools-reference.md#read-tool-behavior) |
| search | `Grep`, `Glob` | **Absent by default on macOS, Linux, and WSL** (present on Windows); searching then goes through `find`/`grep` in Bash | [Glob tool behavior](../pages/tools/tools-reference.md#glob-tool-behavior), [Grep tool behavior](../pages/tools/tools-reference.md#grep-tool-behavior) |
| code-intel | `LSP` | Inactive until a code-intelligence plugin for the language is installed; inactive in cloud sessions | [LSP tool behavior](../pages/tools/tools-reference.md#lsp-tool-behavior) |
| edit | `Edit`, `Write`, `NotebookEdit` | Permission required; read-before-edit rules depend on the model | [Edit tool behavior](../pages/tools/tools-reference.md#edit-tool-behavior), [Write tool behavior](../pages/tools/tools-reference.md#write-tool-behavior) |
| shell | `Bash`, `PowerShell` | PowerShell is automatic on Windows without Git Bash, default-on with Git Bash for claude.ai and Console accounts, opt-in on Linux, macOS and WSL (PowerShell 7+) | [PowerShell tool](../pages/tools/tools-reference.md#powershell-tool), [Bash tool behavior](../pages/tools/tools-reference.md#bash-tool-behavior) |
| background-monitor | `Monitor`, `TaskStop` | Monitor needs telemetry and non-essential traffic enabled and is unavailable on Bedrock, Vertex and Foundry | [Monitor tool](../pages/tools/tools-reference.md#monitor-tool) |
| web | `WebFetch`, `WebSearch` | WebSearch depends on the provider (not on Bedrock); 200 searches per session | [WebFetch tool behavior](../pages/tools/tools-reference.md#webfetch-tool-behavior), [WebSearch tool behavior](../pages/tools/tools-reference.md#websearch-tool-behavior) |
| delegate | `Agent`, `SendMessage`, `ListAgents` | `ListAgents` needs v2.1.224+ and cross-session messaging; `Agent` is withheld from subagents at the depth limit | [Agent tool behavior](../pages/tools/tools-reference.md#agent-tool-behavior), [Available tools](../pages/agent/sub-agents.md#available-tools) |
| workflow | `Workflow` | Never available to subagents; dynamic workflows must be enabled | [Available tools](../pages/agent/sub-agents.md#available-tools), [Turn workflows off](../pages/orchestration/workflows.md#turn-workflows-off) |
| schedule | `CronCreate`, `CronDelete`, `CronList`, `ScheduleWakeup`, `RemoteTrigger` | `ScheduleWakeup` is never available to subagents; `RemoteTrigger` needs a claude.ai plan and is unavailable on Bedrock, Vertex and Foundry | [Tools reference](../pages/tools/tools-reference.md#tools-reference), [Available tools](../pages/agent/sub-agents.md#available-tools) |
| ask-user | `AskUserQuestion` | Never available to subagents | [AskUserQuestion tool behavior](../pages/tools/tools-reference.md#askuserquestion-tool-behavior), [Available tools](../pages/agent/sub-agents.md#available-tools) |
| notify | `PushNotification`, `SendUserFile` | Anthropic-hosted delivery: unavailable on Bedrock, Vertex and Foundry; `SendUserFile` needs Remote Control or a cloud session | [Tools reference](../pages/tools/tools-reference.md#tools-reference) |
| worktree | `EnterWorktree`, `ExitWorktree` | `ExitWorktree` is unavailable to subagents that already run in their own directory | [Tools reference](../pages/tools/tools-reference.md#tools-reference) |
| report | `ReportFindings`, `SubagentHandback` | `ReportFindings` v2.1.196+; `SubagentHandback` only in auto mode, v2.1.271+ | [Tools reference](../pages/tools/tools-reference.md#tools-reference) |
| artifacts | `Artifact` | Needs a Pro, Max, Team or Enterprise plan and `/login` | [Tools reference](../pages/tools/tools-reference.md#tools-reference) |
| unclassified (proposed: `skill`, `plan`, `task-tracking`, `mcp-discovery`, `meta`) | `Skill`, `EnterPlanMode`, `ExitPlanMode`, `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `TaskOutput` (deprecated), `TodoWrite`, `ToolSearch`, `WaitForMcpServers`, `EndConversation`, `SendFeedback`, `ShareOnboardingGuide` | Task tools depend on the model; `WaitForMcpServers` appears only when tool search is off; `EndConversation` is model, surface and provider gated | [Task tool availability](../pages/tools/tools-reference.md#task-tool-availability), [EndConversation tool behavior](../pages/tools/tools-reference.md#endconversation-tool-behavior), [Tools reference](../pages/tools/tools-reference.md#tools-reference) |

## Rules

### Names and rule syntax

- **Tool names are exact strings**, used in permission rules, subagent `tools` lists and hook matchers. The label shown in the transcript can differ from the canonical name (`Stop Task` is `TaskStop`), and rules and matchers match only the canonical name. [Tools reference](../pages/tools/tools-reference.md#tools-reference), [Tool name wildcards](../pages/permissions/permissions.md#tool-name-wildcards)
- **All rule surfaces share `ToolName(specifier)`**: `permissions.allow`/`deny`, `--allowedTools`/`--disallowedTools`, SDK options, a skill's `allowed-tools`, a hook's `if`. Bash rules also cover Monitor; Read rules cover Read, Grep, Glob and LSP; Edit rules cover Edit, Write and NotebookEdit. Hook `matcher` fields take bare tool names, not the parenthesised form. [Configure tools with permission rules and hooks](../pages/tools/tools-reference.md#configure-tools-with-permission-rules-and-hooks)
- **An `Edit(...)` allow also grants read on that path; a `Read(...)` deny also blocks Edit and Write there, including creating a file.** The Read-deny check needs v2.1.208+ for edits and v2.1.228+ for writes. [Configure tools with permission rules and hooks](../pages/tools/tools-reference.md#configure-tools-with-permission-rules-and-hooks)
- **A bare-name deny removes the tool from Claude's context; a scoped deny leaves the tool and blocks matching calls.** `EndConversation` is the one exception a deny cannot remove. [Manage permissions](../pages/permissions/permissions.md#manage-permissions)

### Search, read and code intelligence

- **On macOS, Linux and WSL, Glob and Grep come back when**: `Glob` or `Grep` is named in `--tools` or `--allowedTools` at launch (a settings-file allow rule does not count); `Bash` is removed from the session; or a subagent lists them in `tools` without `Bash`. A tool policy must therefore resolve the `search` class to `Grep`/`Glob` where present and otherwise to Bash. [Glob tool behavior](../pages/tools/tools-reference.md#glob-tool-behavior)
- **Grep is ripgrep** (escape regex metacharacters, `interface\{\}`), respects `.gitignore`, and has `files_with_matches` (default), `content` and `count` modes. **Glob** does not respect `.gitignore` by default, sorts by modification time and caps results at 100 files. [Grep tool behavior](../pages/tools/tools-reference.md#grep-tool-behavior), [Glob tool behavior](../pages/tools/tools-reference.md#glob-tool-behavior)
- **`LSP` gives definitions, references, type info, symbols, implementations and call hierarchies, and reports diagnostics after each edit**, but stays inactive until a language plugin is installed (and never starts in cloud sessions). Background subagents could not use it before v2.1.280. [LSP tool behavior](../pages/tools/tools-reference.md#lsp-tool-behavior), [Available tools](../pages/agent/sub-agents.md#available-tools)
- **Read returns line-numbered text; a whole-file read over the token limit returns the first page with a `PARTIAL view` notice**, and a partial read does not satisfy read-before-edit. Directories are listed with a shell command, not Read. [Read tool behavior](../pages/tools/tools-reference.md#read-tool-behavior), [Edit tool behavior](../pages/tools/tools-reference.md#edit-tool-behavior)

### Edit and shell

- **Edit is exact string replacement**: `old_string` must match exactly once (or set `replace_all`), and Claude must have read the file in this conversation unless the model is newer and the read would not prompt. Viewing a file with a simple Bash `cat`, `head`, `tail`, `sed -n`, `grep` or `rg` also satisfies the requirement. [Edit tool behavior](../pages/tools/tools-reference.md#edit-tool-behavior)
- **Write overwrites the whole file; use Edit for partial changes.** Notebooks and partially read files always require a prior read. [Write tool behavior](../pages/tools/tools-reference.md#write-tool-behavior)
- **Bash runs each command in its own process**: environment variables do not persist, `cd` persists only in the main session (never in a subagent) and only inside the project or added directories, and aliases from the shell startup file are available. [Bash tool behavior](../pages/tools/tools-reference.md#bash-tool-behavior)
- **Bash timeouts and output**: default 2 minutes, ceiling 10 minutes (`BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`); a timed-out command moves to the background unless it starts with `sleep`; results over about 30,000 characters arrive as a file path plus preview. Exit 1 is benign only for `grep`, `rg`, `egrep`, `fgrep`, `find`, `diff`, `test`, `[`, `git diff` and `git grep`. [Timeout and output limits](../pages/tools/tools-reference.md#timeout-and-output-limits), [Background commands](../pages/tools/tools-reference.md#background-commands)
- **PowerShell runs with `-ExecutionPolicy Bypass` at process scope, does not load profiles, and has no sandbox on Windows.** Hooks that inspect shell commands must match `Bash|PowerShell`. [PowerShell tool](../pages/tools/tools-reference.md#powershell-tool), [Enable the PowerShell tool](../pages/tools/tools-reference.md#enable-the-powershell-tool), [Preview limitations](../pages/tools/tools-reference.md#preview-limitations)

### Monitoring, web and delegation

- **`Monitor` streams each output line of a background command (or WebSocket message) back to Claude instead of polling.** Every watch has a deadline (5 minutes by default, at most 30, at most 10 in a `-p` run); Monitor commands use the Bash permission rules; plugins can declare monitors that start automatically. This is the native form of "never busy-poll". [Monitor tool](../pages/tools/tools-reference.md#monitor-tool), [Monitors](../pages/plugin/plugins-components.md#monitors)
- **`WebFetch` is lossy by design**: it converts the page to Markdown and answers an extraction prompt with a small model, refuses `localhost` and dotless hostnames, caches for 15 minutes, and does not follow cross-host redirects. Use `curl` through Bash for an unprocessed page. [WebFetch tool behavior](../pages/tools/tools-reference.md#webfetch-tool-behavior)
- **`WebSearch` returns titles and URLs only** (follow up with WebFetch), takes no permission specifier, and is capped at 200 calls per session counted across all subagents (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`). [WebSearch tool behavior](../pages/tools/tools-reference.md#websearch-tool-behavior), [Session search limit](../pages/tools/tools-reference.md#session-search-limit)
- **`Agent` spawns a subagent whose intermediate calls stay out of the parent's context**; the tools it gets come from `tools`/`disallowedTools` narrowed to the tools available to subagents. With agent teams enabled, a call that carries a `name` launches a teammate instead. `Task(...)` is an alias of `Agent(...)` since v2.1.63. [Agent tool behavior](../pages/tools/tools-reference.md#agent-tool-behavior), [Restrict which subagents can be spawned](../pages/agent/sub-agents.md#restrict-which-subagents-can-be-spawned)
- **`ReportFindings` renders code-review findings as a structured list** (file, summary, failure scenario, optional `category` slug since v2.1.199) when active review instructions tell Claude to call it; `SubagentHandback` delivers a subagent's report only in auto mode. A reviewer role should name `ReportFindings` in its class grant. [Tools reference](../pages/tools/tools-reference.md#tools-reference), [PreToolUse input](../pages/hook/hooks.md#pretooluse-input)

### Availability traps

- **Task-tracking tools (`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, or `TodoWrite`) are on by default only for Claude 3.x, Opus 4 to 4.7, Sonnet 4 to 4.6 and Haiku 4.5**, and are left out on newer or unrecognised models unless opted in (`CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, `--allowedTools`, `--tools`). A subagent gets them only when the session has them. Do not build an agent that depends on them. [Task tool availability](../pages/tools/tools-reference.md#task-tool-availability)
- **`EndConversation` is never given to subagents and cannot be denied while another tool remains**; it appears only on interactive terminal sessions with a qualifying model and provider. Nothing in an agent definition should mention it. [EndConversation tool behavior](../pages/tools/tools-reference.md#endconversation-tool-behavior)
- **MCP tools are deferred behind `ToolSearch` by default**, so only names load at session start; `alwaysLoad: true` on a server exempts its tools. Roles that need an MCP tool on every turn must say so in the tool policy. [Scale with MCP tool search](../pages/mcp/mcp.md#scale-with-mcp-tool-search), [Exempt a server from deferral](../pages/mcp/mcp.md#exempt-a-server-from-deferral)
- **A subagent's catalog is a filtered view**: the always-removed list and the background-only filter change which tools a role actually holds. Verify class resolution twice, once as a subagent (foreground and background) and once as a main-thread `--agent`. [Available tools](../pages/agent/sub-agents.md#available-tools)

## Authoring notes (agents-united, not host behaviour)

- The read-only reviewer class set is read, search, code-intel, web, report. On macOS, Linux and WSL that means naming `Read`, `Grep`, `Glob`, `LSP`, `WebFetch`, `WebSearch`, `ReportFindings` in `tools` and leaving `Bash` out, so Glob and Grep return for that agent; if the reviewer must also run read-only commands, keep `Bash` and enforce read-only with a hook (see [guide/hook.md](hook.md)).
- The efficiency lint (Plan 032 Phase 5) should read the table above: report catalog tools that no role's classes reach, and fail on a granted name that is not in the catalog.
- Not snapshotted: the settings reference and environment-variable pages, which is where most availability switches (`CLAUDE_CODE_*`) are documented in full. The conditions above are only those stated on the tools page.
