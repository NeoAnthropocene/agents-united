---
host: antigravity
artifact: agent
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: custom agents (subagents)

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [subagents](../pages/agent/subagents.md), [the `/agents` command](../pages/command/cli-agents-command.md). Supporting sources: [SDK subagents](../pages/agent/sdk-subagents.md), [agent settings](../pages/agent/agent-settings.md).

Native output lands in `registry/hosts/antigravity/agents/` (Plan 032, Phase 8) and installs to `.agents/agents/`. The Contract Floor in `registry/core/` is the source for each role's identity, mission, scope, output contract and safety.

## Rules

### Definition and discovery

- **A custom agent is a markdown file with YAML frontmatter; the body is its system prompt.** Headings such as `# System Prompt` organise the instructions. [Defining Custom Subagents (.md)](../pages/agent/subagents.md#defining-custom-subagents-md), [System Prompt & Markdown Body](../pages/agent/subagents.md#system-prompt--markdown-body)
- **Workspace agents live in `.agents/agents/<name>.md` or `.agents/agents/<name>/agent.md`; global agents in `~/.gemini/config/agents/`; plugin agents in `plugins/<plugin_name>/agents/`.** [Agent Location and Discovery](../pages/agent/subagents.md#agent-location-and-discovery)
- **The scanner looks only inside `agents/` directories, so a file placed in the config root is not found.** The `/agents` panel prints the two creation templates, `{workspace}/.agents/agents/{agent_name}/agent.md` and `~/.gemini/config/agents/{agent_name}/agent.md`. [2. Creating custom agents](../pages/command/cli-agents-command.md#2-creating-custom-agents), [Common mistakes](../pages/command/cli-agents-command.md#common-mistakes)

### Frontmatter

- **`name` and `description` are required; `description` is what the planner reads to decide when to delegate.** [Frontmatter Configuration (YAML)](../pages/agent/subagents.md#frontmatter-configuration-yaml)
- **The other keys are `tools` (string list, default none), `mainAgent` (default `true`), `subagent` (default `true`), `model` (`inherit`, `flash` or `pro`), `commandExecutionPolicy` (`off`, `auto`, `eager` or `sandbox`, default `sandbox`), `mcpServers`, and `skills` / `plugins`.** [Frontmatter Configuration (YAML)](../pages/agent/subagents.md#frontmatter-configuration-yaml)
- **A misspelled or unmapped name in `tools` can make the subagent hang; use the exact tool names (`view_file`, `run_command`).** The docs call this a known issue pending better validation. [Frontmatter Configuration (YAML)](../pages/agent/subagents.md#frontmatter-configuration-yaml)
- **`mainAgent: true` lets the agent be chosen as the primary agent, `subagent: true` lets the primary agent call it through `invoke_subagent`.** [Custom Agents (Markdown Format)](../pages/agent/subagents.md#custom-agents-markdown-format)

### Running a subagent

- **The parent calls `invoke_subagent` with a role and an initial prompt; the subagent starts with a clean context, may run concurrently with others, and uses `inherit` (same workspace), `branch` (an isolated Git worktree) or `share` (shared directory storage).** [Invoking Subagents](../pages/agent/subagents.md#invoking-subagents)
- **Three built-in subagents exist: `research`, `browser` (only through `/browser`) and `self`, a clone of the caller.** [Built-In Subagents](../pages/agent/subagents.md#built-in-subagents)
- **A subagent is running, idle or killed.** An idle one re-awakens with its context when another agent messages it; a killed one is gone for good and its temporary worktrees are cleaned up. [1. Running](../pages/agent/subagents.md#1-running), [2. Idle](../pages/agent/subagents.md#2-idle), [3. Killed](../pages/agent/subagents.md#3-killed)
- **Agents message each other by conversation ID and can read each other's transcripts; nesting is capped at 10 levels.** [Inter-Agent Communication & Nesting Limits](../pages/agent/subagents.md#inter-agent-communication--nesting-limits)
- **A subagent inherits the parent's allowed command prefixes, file read and write scopes and sandbox settings, and a permission request it raises bubbles up to the main UI.** [Permissions and Configuration Inheritance](../pages/agent/subagents.md#permissions-and-configuration-inheritance)
- **Selecting a custom agent in the `/agents` panel forks the current conversation (or creates a new one from a fresh session).** [1. Switching between agents](../pages/command/cli-agents-command.md#1-switching-between-agents)

### SDK

- **In the SDK a static subagent is a `SubagentConfig` (name, description, system instructions, tools), and any custom tool given to it must also be in the parent agent's `tools`.** [Static custom subagents](../pages/agent/sdk-subagents.md#static-custom-subagents)

## Authoring notes (agents-united, not host behaviour)

- **Antigravity is this repository's origin dialect:** `registry/agents/*.md` already follows this schema, and `docs/host-primitive-matrix.md` records `invoke_subagent` as the mapped delegation tool. The native package still starts from the Semantic Core, never from those files' tool tokens.
- **Observed ([plan 031](../../../plans/031-antigravity-agent-discovery-spike.md), agy 1.2.14, not in the docs):** a frontmatter `hooks:` key of any shape removes the agent from discovery, `--agent` and `invoke_subagent` ("not found"), and every agent the legacy lane installs carries one, so **a native Antigravity agent must have no frontmatter `hooks:`; guards go in `.agents/hooks.json`**. Both the flat and the directory layout work once the workspace is registered. `mainAgent: false` agents are not listed by `agy agents` but can be invoked by name, and `subagent: false` refuses invocation. Plain `agy agents` is empty even where `--agent` resolves; use `--add-dir` or the `/agents` panel to check discovery.
- **Not verified:** whether an agent's `skills:` and `mcpServers:` entries resolve, `define_subagent`, nesting depth, and `manage_subagents` (plan 031 lists them as untested).
- `agy changelog` (a source the docs snapshots lag behind: it shows 1.2.12 to 1.2.15 while the snapshot baseline is 1.2.11) says directory entries in `agents.json` load only the items directly inside the directory and nested ones need `include_only` (1.2.10), and fixes finding project agents in `.agents/agents/` (1.2.11). The docs describe no `agents.json`; treat it as observed and check it before relying on it.
- The `tools` list names hook-vocabulary tools (`view_file`, `grep_search`); the SDK page uses a different set (see the tools guide), so the role's tool list must be derived from one catalog and checked against the build, because a wrong name can hang the agent.
