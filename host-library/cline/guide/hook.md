---
host: cline
artifact: hook
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: hooks

Distilled from the snapshots in `host-library/cline/pages/`. Primary sources: [sdk-plugins](../pages/plugin/sdk-plugins.md), [writing-plugins](../pages/hook/writing-plugins.md). Supporting sources: [hooks](../pages/hook/hooks.md), [plugins](../pages/plugin/plugins.md), [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md).

Cline documents hooks as part of SDK plugins, and plugins apply to the SDK, CLI and Kanban, **not** to the VS Code and JetBrains extensions. Native hook output lands in the guard plugin of the Cline package, not in a hooks folder (ADR 0026, decision 5).

## Rules

### Where hooks come from

- **The Hooks page defers entirely to the SDK Plugins page.** Hooks are defined inside a plugin's `hooks` object. [hooks](../pages/hook/hooks.md#hooks), [What is a plugin](../pages/plugin/sdk-plugins.md#what-is-a-plugin)
- **Plugins, and so plugin hooks, apply to the Cline SDK, CLI and Kanban only.** The docs say the feature is not applicable to the VS Code and JetBrains extensions, so enforcement written as a hook does not exist there. [Plugins](../pages/plugin/plugins.md#plugins)
- **The lifecycle hooks are `beforeRun`, `afterRun`, `beforeModel`, `afterModel`, `beforeTool`, `afterTool` and `onEvent`.** [What is a plugin](../pages/plugin/sdk-plugins.md#what-is-a-plugin)

### Stages and policies

- **Hook stages include `session_start`, `run_start`, `before_agent_start`, `tool_call_before`, `tool_call_after`, `run_end`, `error` and `session_shutdown`.** Use `tool_call_before` to audit or block a tool call, `before_agent_start` to inject context or change the prompt or messages, and `run_end` for metrics and cleanup. [Hook stages](../pages/plugin/sdk-plugins.md#hook-stages)
- **A hook policy sets `mode` (`"blocking"` or `"async"`), `timeoutMs`, `retries`, `retryDelayMs`, `failureMode` (`"fail_open"` or `"fail_closed"`), `maxConcurrency` and `queueLimit`.** [Hook policies](../pages/plugin/sdk-plugins.md#hook-policies)
- **Use `fail_closed` for any policy-enforcement hook.** The docs give the reason: bypassing the hook is unsafe. [Hook policies](../pages/plugin/sdk-plugins.md#hook-policies)
- **To block dangerous tool calls, use a hook or an approval policy.** [Extension glossary](../pages/plugin/sdk-plugins.md#extension-glossary)

### Writing hook code

- **Keep hooks for observation and policy checks; a thrown error in `beforeTool` counts as a tool failure.** A purely observational hook should catch its own errors. To change behaviour, adjust the system prompt or context in `beforeRun` or `beforeModel`. [Plugin design guidelines](../pages/hook/writing-plugins.md#plugin-design-guidelines)
- **A hook receives the tool call and its input** (for example `context.toolCall.name` and `context.input` in `beforeTool`). [Step 1: define the plugin structure](../pages/hook/writing-plugins.md#step-1-define-the-plugin-structure)
- **Hooks and plugins execute code: review them like any executable artifact before adding them globally or to a project.** [Security notes](../pages/settings/config.md#security-notes)

## Authoring notes (agents-united, not host behaviour)

- **Undocumented, not absent:** the config layout lists a `hooks/` directory (global and project), the environment table lists `CLINE_HOOKS_DIR`, the CLI has `--hooks-dir` ("runtime hook injection") and a `cline hook` command that handles a hook payload from stdin. No page in the library gives the file format, events or exit-code protocol. Do not author file hooks until such a page is in the library. [Configuration directory layout](../pages/settings/config.md#configuration-directory-layout), [Environment variables](../pages/settings/config.md#environment-variables), [Global options](../pages/settings/cli-reference.md#global-options), [hook](../pages/settings/cli-reference.md#hook)
- Our guard behaviours map to one hook at stage `tool_call_before` with `failureMode: "fail_closed"`: the destructive-command guard, and the read-only guard only if a hook can tell which agent made the call (not documented, so unverified).
- A no-code complement exists on the CLI: `CLINE_COMMAND_PERMISSIONS` can deny shell command patterns. See the permissions guide. It is an environment variable, not a file a package can install.
- **Observed ([observations](../observations/2026-10-02-cli-3.0.68.md)):** a single-file plugin in `.cline/plugins/` with `hooks.beforeTool(context)` that throws blocked the matching `run_commands` call (it never executed), and the throw ended the whole run with `finishReason: "error"`. `context.input` carried the command list. So the destructive-command guard is feasible as a hook on the CLI, with the caveat that a block ends the run rather than letting the model try again; whether a hook can return a refusal the model can recover from, or can tell which agent made the call, is unverified.
- **A read-only role needs no hook** ([observations](../observations/2026-10-02-cli-3.0.68.md)): a configured agent's `tools:` list is enforced by the host, so a reviewer given only read and search tools cannot write. Keep the guard plugin for what the list cannot express, the destructive shell command of any agent that holds `run_commands`. A plugin hook does see a subagent's tool calls, and a block ends only that subagent's run while the lead continues (observed, same file).
- **Hook context** ([observations](../observations/2026-10-02-cli-3.0.68.md)): `beforeTool` receives `{ snapshot, tool, toolCall, input }`; the tool name is `toolCall.toolName`, and `snapshot.agentId` differs between the lead and a subagent (opaque, no role name), so a hook can tell them apart but cannot name the role.
