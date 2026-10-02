---
host: antigravity
artifact: orchestration
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: orchestration (subagents, teamwork, plan, sidecars)

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary sources: [subagents](../pages/agent/subagents.md), [teamwork](../pages/orchestration/teamwork.md), [plan](../pages/orchestration/plan.md), [sidecars](../pages/orchestration/sidecars.md). Supporting sources: [slash commands](../pages/command/slash-commands.md), [SDK subagents](../pages/agent/sdk-subagents.md).

Antigravity's orchestration is built in and runs as slash commands and subagents. The library describes no saved, scripted workflow (nothing like Claude's `.claude/workflows/*.js`); the Markdown workflows that existed are being retired (see the command guide).

## Rules

### Subagents

- **The main agent delegates with `invoke_subagent`: several subagents can run at once, each with its own context window, in the same workspace, an isolated Git worktree or a shared directory.** Delegating long work keeps the terminal free. [Invoking Subagents](../pages/agent/subagents.md#invoking-subagents), [Asynchronous execution model](../pages/agent/subagents.md#asynchronous-execution-model)
- **Agents talk by messaging each other's conversation IDs; messaging an idle subagent wakes it, and nesting is capped at 10 levels.** [Inter-Agent Communication & Nesting Limits](../pages/agent/subagents.md#inter-agent-communication--nesting-limits)
- **In the SDK, `enable_subagents` creates self-cloning subagents on demand, and a `SubagentConfig` defines static ones.** [Dynamic self-cloning subagents](../pages/agent/sdk-subagents.md#dynamic-self-cloning-subagents), [Static custom subagents](../pages/agent/sdk-subagents.md#static-custom-subagents)
- **`/agents` lists active, done, killed and failed agents and lets the user inspect, kill or approve for them; `Alt+J` jumps to the next subagent awaiting approval.** [Panel overview](../pages/agent/subagents.md#panel-overview), [Keyboard ergonomics](../pages/agent/subagents.md#keyboard-ergonomics), [Subagent Monitoring & Control](../pages/command/cli-agents-command.md#subagent-monitoring--control)

### Built-in orchestrators

- **`/boost` runs a three-tier reasoning hierarchy for hard bugs and algorithms (paid plans), and `/teamwork-preview` runs a multi-agent team for repository-scale work (paid plans).** [Multi-agent orchestrators](../pages/agent/subagents.md#multi-agent-orchestrators), [Command catalog](../pages/command/slash-commands.md#command-catalog)
- **Teamwork has a Sentinel, a Project Orchestrator, read-only Explorers and Workers, and verification gates (Critic, Challenger, Auditor, Success Auditor).** It runs in two phases: a scoping interview that produces a prompt artifact, then autonomous execution through request, plan and progress artifacts. [Core orchestration and execution roles](../pages/orchestration/teamwork.md#core-orchestration-and-execution-roles), [Adversarial verification gates](../pages/orchestration/teamwork.md#adversarial-verification-gates), [Two-phase workflow](../pages/orchestration/teamwork.md#two-phase-workflow)
- **Teamwork assigns files to individual Workers so two never edit the same file, and each subagent has its own scratch directory.** [Safety, workspaces, and isolation](../pages/orchestration/teamwork.md#safety-workspaces-and-isolation)

### Planning

- **`/plan` explores without side effects, interviews the user where the requirements are open, and drafts an Implementation Plan artifact to review before execution.** [How `/plan` works](../pages/orchestration/plan.md#how-plan-works), [Overview](../pages/orchestration/plan.md#overview)
- **Use `/plan` for complex refactors, ambiguous requirements and high-risk changes, `/grill-me` for design interviews, and a review policy decides whether the agent waits for approval.** [When to use `/plan`](../pages/orchestration/plan.md#when-to-use-plan), [Interacting with plan artifacts](../pages/orchestration/plan.md#interacting-with-plan-artifacts)

### Background work

- **A sidecar is a background process managed by the host (`sidecar.json` in `~/.gemini/config/sidecars/<id>/` or a plugin), with a `schedule` builtin for cron jobs and an `agentapi` CLI to create conversations and send messages.** Sidecars are off until the user enables them in `~/.gemini/config/config.json`. [Configuration](../pages/orchestration/sidecars.md#configuration), [User Configuration (config.json)](../pages/orchestration/sidecars.md#user-configuration-configjson), [`schedule` builtin](../pages/orchestration/sidecars.md#schedule-builtin), [`agentapi`](../pages/orchestration/sidecars.md#agentapi)

## Authoring notes (agents-united, not host behaviour)

- **The orchestrator is a main agent.** A native orchestrator is an agent file with `mainAgent: true`, `subagent: true`-capable specialists, and `invoke_subagent` in its `tools`; observed ([plan 031](../../../plans/031-antigravity-agent-discovery-spike.md)): a main agent invoked a workspace specialist by name, a specialist with `subagent: false` was refused, and a specialist whose frontmatter carried `hooks:` was "not found", so none of them may carry that key.
- **Name the tool in the orchestrator's text** (`invoke_subagent`, with the exact specialist names), because the Cline lesson (a lead told only a role name reached for a different tool) is a general one; the matrix notes the runtime-registration (`define_subagent`) path must pass the role body verbatim, never a summary.
- **Do not make the plan depend on `/boost` or `/teamwork-preview`:** they are paid-plan features with their own agents, not something a package installs or configures, and teamwork's role names (Sentinel, Critic, ...) are the host's. The package's own orchestrator and specialists are separate and work on every plan.
- **Several specs in one `invoke_subagent` call are documented (the page says a parent can invoke several concurrently); observed on agy 1.2.15: one call with two specs created both subagents in the same second and both answered, but the tasks were too short to show that the runs overlap, so concurrent execution is not proven.** Plan 031's probes ran one delegation at a time.
- Scheduling (`/schedule`, sidecars) is host-side and the user opts in; a package ships none.
