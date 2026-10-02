# ADR 0026: Cline Native Package Shape, the Per-Host `--native` Lane, and Honest Gaps

- **Status**: Accepted — 2026-10-02 (product owner, in a `grill-with-docs` session). Builds on ADR 0025
  (native host packages, decision 1 names Claude Code, Cline and Antigravity first) and does not amend it.
  Implemented in slices by `plans/032-native-host-packages.md`, Phase 8.
- **Context**: Phase 8 of plan 032 brings Cline, then Antigravity, to the native-package model that
  Claude Code now has (agents, skills, hooks, three dynamic workflows, the `--native` lane, real-session
  verification). `registry/hosts/` holds only `claude`; `host-library/cline` and `host-library/antigravity`
  hold seeded snapshots but no `guide/` folders or profiles. Reading Cline's snapshots shows that Cline's
  primitives are not Claude's, so copying Claude's package shape would fake things the host does not have:
  - **Subagents are built in and read-only.** The model decides when to spawn them with `use_subagents`;
    they can read, search, list and run read-only commands, cannot edit, use the browser or MCP servers, or
    nest, and there is no custom agent definition (no per-agent tools, model or prompt file).
    ([subagents](../../host-library/cline/pages/agent/subagents.md))
  - **Agent teams** (a coordinator that spawns teammates with a role and a task through tools) work in the
    CLI, the SDK and Kanban, **not in the VS Code or JetBrains extensions**.
    ([agent-teams](../../host-library/cline/pages/orchestration/agent-teams.md),
    [multi-agent-teams](../../host-library/cline/pages/orchestration/multi-agent-teams.md))
  - **Hooks exist as SDK plugins**, which are code; a hook handler can block dangerous tool calls.
    ([hooks](../../host-library/cline/pages/hook/hooks.md), [plugins](../../host-library/cline/pages/plugin/sdk-plugins.md))
  - **Skills, rules and slash commands are files.**
    ([skills](../../host-library/cline/pages/skill/skills.md), [commands](../../host-library/cline/pages/command/using-commands.md))
- **Decision**:
  1. **Sequence and slicing.** Cline first, Antigravity as a peer afterwards, one PR per slice and per host,
     in the order Claude followed: host guides, then profile and tool policy, then the native package, then
     the install lane. The **first Cline PR is the guides only** (`host-library/cline/guide/*.md`, every rule
     citing a `pages/` snapshot, with the citation test). The Antigravity guides are a separate PR after it,
     so what is learned on Cline shapes how they are written.
  2. **Full bundle, honest rows.** The Cline pilot covers the whole `software-engineering` bundle (the five
     agents, the sixteen skills, the guards and the three workflows) in the sense that **every piece has a
     row** in the `doctor --host` delta table: native, partial, or an explicit gap. No piece is reshaped into a
     Claude-looking artifact the host cannot honour.
  3. **Native where it exists, honest gap.** Role knowledge ships as **skills and rules**; read-only research
     runs on Cline's **built-in subagents** (read-only by construction, so the guarantee needs no hook); the
     orchestrator is a **rule and skill** that tell Cline how to plan (Plan/Act) and delegate; scripted
     workflows stay **skills** because Cline has no saved script. What Cline lacks (a named role with its own
     model and effort, structured findings, a scripted fan-out with a verdict computed in code, a dedicated
     main-thread coordinator) is listed as a gap, never faked.
  4. **Surface.** The base package works in both the IDE extensions and the CLI. Anything only the CLI can
     run is a separate **CLI extra layer**. The first such layer, **emulating the roster as team prompts**
     (`team_spawn_teammate` with our role text), is accepted as a direction but **deferred to its own PR**,
     after teammate scoping is verified: Cline does not load a role file by name, teammates can edit, and a
     read-only role would otherwise be a promise in prompt text.
  5. **Guards are a small SDK plugin.** The destructive-command guard (and, where Cline lets a plugin scope
     it, the read-only guard) ships as a reviewed JavaScript SDK plugin that blocks dangerous tool calls. It is
     executable code, so it passes the security audit gate (ADR 0025 decision 7) and is installed by copying
     like every other artifact. **Open, to be settled from the docs in the guides PR:** whether SDK plugins
     load in the IDE extensions. If they do not, enforcement is CLI-only and the delta table says so for the
     extensions; it is never described as enforced where it is not.
  6. **One `--native`, per host.** The flag applies to every host that has a committed native package; the
     choice is recorded **per host** in the lockfile, a host without a native package keeps its legacy
     projection, and `--no-native` turns the recorded choice off. Today's CLI text ("Claude lane only") changes
     with the PR that adds the Cline lane, not with this ADR.
  7. **Verification and budget.** Each host's package is verified in a real session of **that host's own CLI**,
     and the PR reports what was and was not exercised. Before the first real-session run on a host, the
     maintainer is told which account it spends and the rough cost, and answers: the standing permission given
     for runs on the Claude subscription does **not** transfer to Cline or Antigravity, which may bill a
     different account. A quota check is made only where the host exposes quota.
- **Consequences**:
  - Positive: the Cline package states exactly what Cline can do; the read-only guarantee comes from the host
    itself; the lane flag stays one flag as hosts are added; the guides PR is small and reviewable, and the
    plugin question is settled from evidence before any plugin is written.
  - Negative: Cline users get a thinner team model than Claude users until the CLI extra layer lands; the
    guard plugin adds a trust surface and a dependency on the SDK; the delta table will show many gaps on
    day one, by design.
  - Open: where SDK plugins load (decision 5); how a plugin can scope rules to one teammate role (decision 4);
    how Antigravity's frontmatter `hooks:` quirk (plan 031 addendum) shapes its own version of this ADR.
