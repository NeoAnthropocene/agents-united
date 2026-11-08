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

- **`spawn_agent` starts subagents in Cline CLI and Desktop.** They have separate contexts, may run in parallel, and return replies to the main agent. The docs say the VS Code and JetBrains extensions do not use them. [How it works](../pages/agent/subagents.md#how-it-works)
- **Subagents are not inherently read-only.** Act mode can edit and run commands; Plan mode removes editing tools and rejects some changing commands, but other commands can still write. Subagents can nest and do not get MCP tools. [How it works](../pages/agent/subagents.md#how-it-works)
- **Approving `spawn_agent` approves subsequent subagent tool calls.** The docs say approval settings do not apply inside the subagent. [Approvals](../pages/agent/subagents.md#approvals)
- **Disable `spawn_agent` in the CLI or Desktop Tools settings for new sessions.** [Turning subagents off](../pages/agent/subagents.md#turning-subagents-off)
- **Cost is tracked per subagent and rolled into the task total.** The current page reports a session total. [How it works](../pages/agent/subagents.md#how-it-works)
- **Use them for broad context across several areas: onboarding, cross-cutting concerns, pre-edit research and large codebases.** For a small task where the files are known, they add overhead and the main agent should just do it. [When to use subagents](../pages/agent/subagents.md#when-to-use-subagents)
- **Each subagent prompt should be one focused research question,** and one subagent is fine when the task is small. [Using subagents](../pages/agent/subagents.md#using-subagents)
- **In the SDK, subagents are enabled with `enableSpawnAgent: true` and last only within a session;** teams are a separate, persistent mechanism. [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams)

## Authoring notes (agents-united, not host behaviour)

- **Configured agents are real, and this guide's cited rules do not cover them.** ADR 0013 (verified against CLI 3.0.61 and the source) and the legacy Cline lane (`src/core/cline-projector.ts`) already use `.cline/agents/<role>.yml`: fenced YAML frontmatter (`name`, `description`, `maxIterations`, optional `tools`, `skills`, `providerId`, `modelId`) and a markdown body that is the system prompt. Each file becomes a tool `subagent_<name>` that the lead calls. Verified again on 3.0.68 ([observations](../observations/2026-10-02-cli-3.0.68.md)). The docs library describes only the built-in subagents above, so the facts about configured agents come from ADR 0013 and the observations, not from a cited page.
- **CLI 3.0.68 enforced configured agents’ `tools:` restriction** ([observations](../observations/2026-10-02-cli-3.0.68.md)): an agent with no `tools:` could write a file, and with `tools: [read_files]` it could not. That observation covers configured agents on 3.0.68, not built-in `spawn_agent` on newer builds; current enforcement is unverified.
- The five engineering roles ship as configured agents (ADR 0028), with the Contract Floor text in the body and `tools:` derived from their capability classes; built-in subagents can be asked to research, but are not inherently read-only.
- In the CLI the built-in sub-agent tool is `spawn_agent`, taking `{systemPrompt, task}` written by the model in the call, the name now also used in the current docs ([observations](../observations/2026-10-02-cli-3.0.68.md)). `team_run_task` delegates to a teammate by id and is a different mechanism from configured agents.
- **Correction (2026-10-02):** earlier versions of this note called the agent files undocumented with an unknown effect, after a malformed probe (a plain YAML file with no body) and without reading ADR 0013. Both were wrong.
- **Delegation needs the tool name** ([observations](../observations/2026-10-02-cli-3.0.68.md)): a coordinator told only to delegate to a configured agent by role name can reach for `team_run_task` and report the agent missing; naming the `subagent_<name>` tool works. The shipped roles are `subagent_code_reviewer`, `subagent_repo_index`, `subagent_backend_architect` and `subagent_frontend_architect`.

- **Historical policy boundary (2026-11-06):** `tool-policy.json` retains its CLI 3.0.68 catalog and its then-documented `use_subagents` IDE entry. The current [subagents page](../pages/agent/subagents.md#subagents) instead describes `spawn_agent` on CLI/Desktop and excludes the IDE extensions. The old catalog and read-only description are not a current-runtime guarantee; adapting the profile requires a separately tested native change.
