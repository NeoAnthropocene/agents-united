---
host: cline
artifact: agent
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: agents (built-in subagents)

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [subagents](../pages/agent/subagents.md). Supporting sources: [multi-agent-teams](../pages/orchestration/multi-agent-teams.md), [config](../pages/settings/config.md), [cli-reference](../pages/settings/cli-reference.md).

The library documents Cline's **built-in** subagents only. It documents no format for defining a subagent of our own, so Phase 8 does not emit an agent file for Cline until a page does (see the authoring notes and ADR 0026).

## Rules

### What a subagent is

- **A subagent is a focused, read-only research agent the model spawns with the `use_subagents` tool.** Each has its own prompt, context window and token budget, and returns a report focused on the file paths the main agent should read next. The feature is marked experimental. [How it works](../pages/agent/subagents.md#how-it-works), [subagents](../pages/agent/subagents.md#subagents)
- **Subagents can read files, list files, search by regex, list code definitions, run read-only commands and load skills.** The tools are `read_file`, `list_files`, `search_files`, `list_code_definition_names`, `execute_command` (read-only, in the background) and `use_skill`. [What subagents can do](../pages/agent/subagents.md#what-subagents-can-do)
- **Subagents cannot write files, apply patches, use the browser, reach MCP servers, search the web, or spawn subagents.** The read-only guarantee comes from the host, not from a prompt, so research work that must not edit anything can be delegated to one without a guard. [What subagents can do](../pages/agent/subagents.md#what-subagents-can-do)
- **Cline decides when to use them, and the user can nudge it in the prompt.** They are enabled by default and turned off by disabling the `use_subagents` tool in Settings, Features, Agent, which applies across VS Code, JetBrains and the CLI. [Enabling subagents](../pages/agent/subagents.md#enabling-subagents), [Using subagents](../pages/agent/subagents.md#using-subagents)

### Approval, cost and when to use them

- **Subagent launches follow the "Read project files" auto-approve permission.** With it on they are auto-approved; with it off Cline asks first, showing the prompts it plans to send. [Auto-approve behavior](../pages/agent/subagents.md#auto-approve-behavior)
- **Cost is tracked per subagent and rolled into the task total.** Per-subagent tool calls, tokens and cost show in the chat UI. [How it works](../pages/agent/subagents.md#how-it-works)
- **Use them for broad context across several areas: onboarding, cross-cutting concerns, pre-edit research and large codebases.** For a small task where the files are known, they add overhead and the main agent should just do it. [When to use subagents](../pages/agent/subagents.md#when-to-use-subagents)
- **Each subagent prompt should be one focused research question,** and one subagent is fine when the task is small. [Using subagents](../pages/agent/subagents.md#using-subagents)
- **In the SDK, subagents are enabled with `enableSpawnAgent: true` and last only within a session;** teams are a separate, persistent mechanism. [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams)

## Authoring notes (agents-united, not host behaviour)

- **Configured agents are real, and this guide's cited rules do not cover them.** ADR 0013 (verified against CLI 3.0.61 and the source) and the legacy Cline lane (`src/core/cline-projector.ts`) already use `.cline/agents/<role>.yml`: fenced YAML frontmatter (`name`, `description`, `maxIterations`, optional `tools`, `skills`, `providerId`, `modelId`) and a markdown body that is the system prompt. Each file becomes a tool `subagent_<name>` that the lead calls. Verified again on 3.0.68 ([observations](../observations/2026-10-02-cli-3.0.68.md)). The docs library describes only the built-in subagents above, so the facts about configured agents come from ADR 0013 and the observations, not from a cited page.
- **`tools:` is a host-enforced restriction** ([observations](../observations/2026-10-02-cli-3.0.68.md)): an agent with no `tools:` could write a file, and with `tools: [read_files]` it could not. A read-only role is therefore expressed with the host's own list of read and search tools and needs no hook. Use the canonical names from the tools guide.
- The five engineering roles ship as configured agents (ADR 0028), with the Contract Floor text in the body and `tools:` derived from their capability classes; the built-in subagents stay available for generic read-only research.
- In the CLI the built-in sub-agent tool is `spawn_agent`, taking `{systemPrompt, task}` written by the model in the call, not the docs' `use_subagents` ([observations](../observations/2026-10-02-cli-3.0.68.md)). `team_run_task` delegates to a teammate by id and is a different mechanism from configured agents.
- **Correction (2026-10-02):** earlier versions of this note called the agent files undocumented with an unknown effect, after a malformed probe (a plain YAML file with no body) and without reading ADR 0013. Both were wrong.
