---
host: cline
artifact: orchestration
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: orchestration (subagents, teams, Plan & Act, scheduling)

Distilled from the snapshots in `host-library/cline/pages/`. Primary sources: [subagents](../pages/agent/subagents.md), [agent-teams](../pages/orchestration/agent-teams.md), [multi-agent-teams](../pages/orchestration/multi-agent-teams.md), [plan-and-act](../pages/orchestration/plan-and-act.md), [scheduling](../pages/orchestration/scheduling.md).

Cline's documented orchestration is built in. The library describes no saved, scripted workflow (nothing like Claude's `.claude/workflows/*.js`), so multi-agent `workflow-*` skills stay skills on Cline (ADR 0026, decision 3). The core invariants "parallel slices fan out in one turn, with one synthesis point" bind to the mechanisms below.

## Rules

### Choosing the mechanism

- **Use subagents for parallel read-only research and agent teams for coordinated, multi-session work.** Subagents are parent-child, last within a session and hold no shared state; teams are peers with a task board, a mailbox and a mission log that persist across sessions. [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams), [Sub-agents](../pages/orchestration/agent-teams.md#sub-agents)
- **Teams add overhead: use them when the work splits into independent subtasks, different subtasks benefit from different system prompts, the work spans sessions, or a persistent delegation record matters.** Otherwise a single agent with good tools is usually more efficient. [When to use teams](../pages/orchestration/multi-agent-teams.md#when-to-use-teams)
- **Subagents run in parallel and each returns a report, so several research questions fan out in one step and the main agent synthesises.** They are read-only and cannot nest. [How it works](../pages/agent/subagents.md#how-it-works), [What subagents can do](../pages/agent/subagents.md#what-subagents-can-do)

### Agent teams

- **Teams work in the CLI, the SDK and Kanban, not in the VS Code and JetBrains extensions.** `cline --team-name <name> "<task>"` enables team mode, `/team <task>` does so in interactive mode, and `--no-teams` disables it. [Agent teams](../pages/orchestration/agent-teams.md#agent-teams), [Starting a team](../pages/orchestration/agent-teams.md#starting-a-team), [Disabling teams](../pages/orchestration/agent-teams.md#disabling-teams)
- **The coordinator gets `team_spawn_teammate`, `team_delegate_task`, `team_check_status` and `team_get_result`.** It decides how to split the work, which teammates to create (each with a role and a task) and how to merge results. [How teams work](../pages/orchestration/multi-agent-teams.md#how-teams-work)
- **Team state persists under `~/.cline/data/teams/<team-name>/` (`task-board.json`, `mailbox.json`, `mission-log.json`),** and `cline --team-name <name> "Continue…"` resumes it. [Team state](../pages/orchestration/agent-teams.md#team-state), [Team persistence](../pages/orchestration/multi-agent-teams.md#team-persistence), [Resuming team work](../pages/orchestration/agent-teams.md#resuming-team-work)
- **In the SDK, subagents need `enableSpawnAgent: true` and teams need `enableAgentTeams: true` with a `teamName`.** [Enabling teams](../pages/orchestration/multi-agent-teams.md#enabling-teams), [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams)

### Plan & Act

- **Plan mode can read and search but cannot modify files or execute commands; Act mode can.** The conversation carries over when the mode switches, so planning builds the context Act mode needs. [Plan mode](../pages/orchestration/plan-and-act.md#plan-mode), [Act mode](../pages/orchestration/plan-and-act.md#act-mode)
- **Match the approach to the size: Act only for obvious small fixes, Plan then Act for most work, `/deep-planning` for large multi-file or multi-session work.** Return to Plan mode when unexpected complexity appears. [Choosing the right approach by task size](../pages/orchestration/plan-and-act.md#choosing-the-right-approach-by-task-size), [Typical workflow](../pages/orchestration/plan-and-act.md#typical-workflow)
- **Separate models can be set for Plan and Act,** for example a stronger reasoning model to plan and a faster one to implement. [Using different models for each mode](../pages/orchestration/plan-and-act.md#using-different-models-for-each-mode)
- **Enable Checkpoints before Act mode, and have Cline write the plan to a markdown file or a todo list for large tasks.** [Tips](../pages/orchestration/plan-and-act.md#tips)

### Scheduling

- **`cline schedule` runs agents on cron schedules through the hub, for the CLI, SDK and Kanban only.** Schedules persist across restarts: `cline schedule create <name> --cron "<expr>" --prompt "<task>" --workspace <path>`, then `list`, `trigger`, `pause`, `resume`, `delete` and `executions`. [Scheduling](../pages/orchestration/scheduling.md#scheduling), [Creating schedules with flags](../pages/orchestration/scheduling.md#creating-schedules-with-flags), [Managing schedules](../pages/orchestration/scheduling.md#managing-schedules)

## Authoring notes (agents-united, not host behaviour)

- Map the orchestrator's roles as ADR 0026 decided: a rule and skill telling Cline to plan first (Plan & Act, `/deep-planning` for large work), to delegate broad research to the built-in subagents in one step, and to do edits itself. The team-prompt roster for `--team-name` is a later CLI extra layer: the docs do not show a way to load a role definition by name, so the coordinator would have to carry our role text into each `team_spawn_teammate` call, and nothing makes it do so.
- Teammates are not documented as read-only, unlike subagents. A "read-only reviewer" teammate is a prompt promise unless a plugin hook enforces it, and whether a hook can tell which teammate made a call is undocumented.
- The Kanban surface (parallel agents in isolated git worktrees) is listed in the docs index but not snapshotted here; add its pages to the library before any package relies on it.
- **Observed ([observations](../observations/2026-10-02-cli-3.0.68.md)):** the CLI's sub-agent tool is `spawn_agent` and `cline config workflows` lists markdown workflows (`.clinerules/workflows/`, `.cline/workflows/`), so "no saved workflow" above means no scripted workflow is documented, not that Cline has no workflow files.
