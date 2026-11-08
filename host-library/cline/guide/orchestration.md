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

- **Use subagents for delegated work and agent teams for coordinated, multi-session work.** Subagents are parent-child, last within a session and hold no shared state; teams are peers with a task board, a mailbox and a mission log that are restored when their session resumes. [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams), [Sub-agents](../pages/orchestration/agent-teams.md#sub-agents)
- **Teams add overhead: use them when the work splits into independent subtasks, different subtasks benefit from different system prompts, the work resumes over time, or a persistent delegation record matters.** Otherwise a single agent with good tools is usually more efficient. [When to use teams](../pages/orchestration/multi-agent-teams.md#when-to-use-teams)
- **Subagents run in parallel and each returns a report, so several research questions fan out in one step and the main agent synthesises.** They may edit in Act mode, can nest, and Plan mode is not a write-proof sandbox. [How it works](../pages/agent/subagents.md#how-it-works), [What subagents can do](../pages/agent/subagents.md#how-it-works)

### Agent teams

- **Teams work in the CLI, the SDK and Kanban, not in the VS Code and JetBrains extensions.** Start a prompt with `/team`; the docs also say Cline can form a team itself. Disable the `teams` tool in settings for new sessions. [Agent teams](../pages/orchestration/agent-teams.md#agent-teams), [Starting a team](../pages/orchestration/agent-teams.md#starting-a-team), [Disabling teams](../pages/orchestration/agent-teams.md#turning-teams-off)
- **The SDK documents `team_spawn_teammate`, `team_task`, `team_run_task`, `team_status`, mailbox and outcome tools.** It decides how to split the work, which teammates to create (each with a role and a task) and how to merge results. [How teams work](../pages/orchestration/multi-agent-teams.md#how-teams-work)
- **The CLI team belongs to a session;** the docs give `~/.cline/data/db/teams.db` for its board, mailbox and mission log, and `cline --id <session-id>` to resume. [Team state](../pages/orchestration/agent-teams.md#team-state), [Team persistence](../pages/orchestration/multi-agent-teams.md#team-persistence), [Resuming team work](../pages/orchestration/agent-teams.md#resuming-team-work)
- **In the SDK, subagents need `enableSpawnAgent: true` and teams need `enableAgentTeams: true` with a `teamName`.** [Enabling teams](../pages/orchestration/multi-agent-teams.md#enabling-teams), [Sub-agents vs teams](../pages/orchestration/multi-agent-teams.md#sub-agents-vs-teams)

### Plan & Act

- **The Plan & Act page says Plan mode cannot modify files or execute commands, but the refreshed subagent and scheduling pages describe commands that can still write.** Do not treat Plan mode as a write-proof boundary. The conversation carries over when the mode switches, so planning builds the context Act mode needs. [Plan mode](../pages/orchestration/plan-and-act.md#plan-mode), [Subagent mode](../pages/agent/subagents.md#how-it-works), [Schedule mode](../pages/orchestration/scheduling.md#creating-schedules-with-flags)
- **Match the approach to the size: Act only for obvious small fixes, Plan then Act for most work, `/deep-planning` for large multi-file or multi-session work.** Return to Plan mode when unexpected complexity appears. [Choosing the right approach by task size](../pages/orchestration/plan-and-act.md#choosing-the-right-approach-by-task-size), [Typical workflow](../pages/orchestration/plan-and-act.md#typical-workflow)
- **Separate models can be set for Plan and Act,** for example a stronger reasoning model to plan and a faster one to implement. [Using different models for each mode](../pages/orchestration/plan-and-act.md#using-different-models-for-each-mode)
- **Enable Checkpoints before Act mode, and have Cline write the plan to a markdown file or a todo list for large tasks.** [Tips](../pages/orchestration/plan-and-act.md#tips)

### Scheduling

- **`cline schedule` runs agents on cron schedules through the hub, for the CLI, SDK and Kanban only.** Schedules persist across restarts: `cline schedule create <name> --cron "<expr>" --prompt "<task>" --workspace <path>`, then `list`, `trigger`, `pause`, `resume`, `delete` and `history`. The documented schedule default is `yolo`, and scheduled calls self-approve even in plan mode. [Scheduling](../pages/orchestration/scheduling.md#scheduling), [Creating schedules with flags](../pages/orchestration/scheduling.md#creating-schedules-with-flags), [Managing schedules](../pages/orchestration/scheduling.md#managing-schedules)

## Authoring notes (agents-united, not host behaviour)

- Map the orchestrator's roles as ADR 0026 decided: a rule and skill telling Cline to plan first (Plan & Act, `/deep-planning` for large work), to delegate only work appropriate to the subagent permissions and approval behavior. The team-prompt roster is a later CLI extra layer: the docs do not show a way to load a role definition by name, so the coordinator would have to carry our role text into each `team_spawn_teammate` call, and nothing makes it do so.
- Neither teammates nor built-in subagents are documented as inherently read-only. A "read-only reviewer" teammate is a prompt promise unless a plugin hook enforces it, and whether a hook can tell which teammate made a call is undocumented.
- The Kanban surface (parallel agents in isolated git worktrees) is listed in the docs index but not snapshotted here; add its pages to the library before any package relies on it.
- **Observed ([observations](../observations/2026-10-02-cli-3.0.68.md)) and prior art (ADR 0013):** the built-in sub-agent tool is `spawn_agent`; each configured agent (`.cline/agents/<role>.yml`) is its own tool, `subagent_<name>`, so an orchestrator delegates to named roles that way; and markdown workflows (`.cline/workflows/`, `.clinerules/workflows/`) are slash commands. So "no saved workflow" above means no scripted workflow is documented, not that Cline has no workflow files or named agents.
- **Flags ([observations](../observations/2026-10-02-cli-3.0.68.md)):** `cline --help` in 3.0.68 lists no `--team-name`, `--no-teams`, `-y` or `--yolo`, and CLI 3.0.69 release notes subsequently list `-y`/`--yolo`; current team docs use `/team` and session resume. Do not script team mode from these flags without checking the build.
