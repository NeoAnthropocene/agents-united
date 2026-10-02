---
host: antigravity
artifact: hook
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: hooks

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary source: [hooks](../pages/hook/hooks.md). Supporting source: [SDK lifecycle](../pages/hook/sdk-lifecycle.md).

Native output lands in `registry/hosts/antigravity/hooks/` (Plan 032, Phase 8) and installs into `.agents/hooks.json`. Guards are real command hooks, never prose.

## Rules

### Where hooks live

- **Hooks are configured in `hooks.json`: `.agents/hooks.json` in the workspace, `~/.gemini/config/hooks.json` globally, and in a plugin's own `hooks.json`.** The CLI also reads hooks from its `~/.gemini/antigravity-cli/settings.json`, and `/hooks` lists the loaded ones. [Managing hooks in Antigravity 2.0](../pages/hook/hooks.md#managing-hooks-in-antigravity-20), [Managing hooks in Antigravity CLI](../pages/hook/hooks.md#managing-hooks-in-antigravity-cli), [Managing hooks in Antigravity IDE](../pages/hook/hooks.md#managing-hooks-in-antigravity-ide)
- **`hooks.json` maps a hook name to its events; `enabled: false` switches a hook off without removing it.** [Schema and File Format](../pages/hook/hooks.md#schema-and-file-format), [Hook Definition Fields](../pages/hook/hooks.md#hook-definition-fields)

### Events and matching

- **The events are `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation` and `Stop`.** [Supported Events](../pages/hook/hooks.md#supported-events)
- **A `matcher` is a regular expression on the tool name for `PreToolUse` and `PostToolUse` (`""` or `"*"` matches all, `a|b` matches either); for the other three events the structure is a plain handler list and the matcher is ignored.** [Matcher](../pages/hook/hooks.md#matcher)
- **A handler has `type` (only `"command"`), `command` (required) and `timeout` in seconds (default 30).** [Hook Handler Configuration](../pages/hook/hooks.md#hook-handler-configuration)

### Input and output

- **A hook gets JSON on stdin and answers JSON on stdout, in camelCase; every payload carries `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath` and `modelName`.** [Input/Output Contract](../pages/hook/hooks.md#inputoutput-contract), [Common Input Fields](../pages/hook/hooks.md#common-input-fields)
- **`PreToolUse` receives `toolCall.name` and `toolCall.args` and must return `decision`: `allow`, `deny` (hard block), `ask`, `force_ask` or `deny_unless_prior_grant`, with an optional `reason` and `permissionOverrides`.** [PreToolUse](../pages/hook/hooks.md#pretooluse)
- **`PostToolUse` receives the call and an `error` string on failure and returns `{}`.** [PostToolUse](../pages/hook/hooks.md#posttooluse)
- **`PreInvocation` and `PostInvocation` can return `injectSteps` (a tool call, a user message or an ephemeral message); `PostInvocation` can also set `terminationBehavior` to `force_continue` or `terminate`.** [PreInvocation](../pages/hook/hooks.md#preinvocation), [PostInvocation](../pages/hook/hooks.md#postinvocation)
- **`Stop` receives `terminationReason` and `fullyIdle`; returning `decision: "continue"` re-enters the loop and injects `reason` as a system message.** [Stop](../pages/hook/hooks.md#stop)

### SDK

- **The SDK has its own hook decorators (`pre_turn`, `on_tool_error`) and triggers, separate from `hooks.json`.** [Lifecycle hooks and cost auditing](../pages/hook/sdk-lifecycle.md#lifecycle-hooks-and-cost-auditing), [Triggers](../pages/hook/sdk-lifecycle.md#triggers)

## Authoring notes (agents-united, not host behaviour)

- **A hook never goes in an agent's frontmatter.** Observed ([plan 031](../../../plans/031-antigravity-agent-discovery-spike.md)): any `hooks:` key hides the agent from discovery on agy 1.2.14. The enforcement the legacy lane tried to put there (the destructive-command guard) belongs in `.agents/hooks.json`, as a `PreToolUse` command on `run_command` (and the editing tools) that returns `deny`.
- **A hooks file is global to the workspace, not per agent.** The docs show no way to scope a hook to one agent, so a read-only role is not made read-only by a hook; its `tools` list does that, and the host enforces the list (observed on agy 1.2.15, see the tools guide), so a hook is the extra layer for roles that hold a shell or an editor.
- **The guard is a shell command on the user's machine,** so it ships as a reviewed script that passes the audit gate (ADR 0025 decision 7), with the same three patterns as the Claude and Cline guards (a drift test should tie them together), and no network access.
- **Observed on agy 1.2.15, not in the docs** (observations, 2026-10-02): the hook runs with the folder holding `hooks.json` as its working directory, so a relative script path is relative to `.agents/`; an answer with no `decision` (`{}`), non-JSON output and a non-zero exit each **block the call**, so a guard must always answer; `deny` delivers its `reason` to the agent verbatim; a hook sees a **subagent's** calls as well as the main agent's; and `ask` falls back to the user's own permission settings, which makes it the safe answer for a call the guard does not block (`allow` would override a prompt). The shipped guard answers only `deny` or `ask`.
- **The install lane merges, never overwrites** (ADR 0031 addendum). `.agents/hooks.json` is the user's own file, so `--native` adds only the key `agents-united-guard` (strict JSON; a file with comments is left untouched and the entry is printed), keeps every other hook and the file's formatting, and removes only that key; the script is copied to `.agents/hooks/`. The doctor judges the guard by that key alone.
- **Not verified:** the hook on macOS and Linux (the sandbox and permission engine differ there), the 2.0 and IDE surfaces, a hook that exceeds its timeout, and the global files: the docs give `~/.gemini/config/hooks.json`, but the CLI page also names `settings.json`; do not rely on both.
- Hooks apply to all three surfaces (2.0, CLI, IDE) per the page, but `<app_data_dir>` differs per surface, so a hook must not hard-code a transcript path.
