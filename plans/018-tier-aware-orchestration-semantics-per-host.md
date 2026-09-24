# Plan 018: Tier-Aware Orchestration Semantics per Host — Subagent Mesh (Tier-1) vs Agent Teams (Tier-2)

> **Executor instructions**: this plan is self-contained. Follow the steps in order, run every
> verification command, and STOP on any listed condition instead of improvising. Update the
> plan's row in `plans/README.md` when done. Every fact in "Verified host facts" was fetched
> from live vendor docs on 2026-09-24; anything marked UNVERIFIED must be probed in Step 0 and
> never assumed (ADR 0018 R2/R3 discipline).

## Status

- **State**: READY — approved by product owner 2026-09-24 (decisions: **hard rename** `--host
  antigravity` with NO `agents` alias; Steps 0–5 run **in parallel with Plan 017**, Step 6 still
  requires 017's overlay mechanism)
- **Priority**: P1 · **Effort**: M–L · **Risk**: MEDIUM (3 hosts × 2 tiers; bounded by probes + report-only fallbacks)
- **Depends on**: plans/017 (overlay mechanism — required only for Step 6; Steps 0–5 may run first), plans/016 (DONE)
- **Category**: runtime integration / catalog
- **Decision record**: ADR number assigned at execution — 0019 is taken by the Universal Coverage Rule; do NOT create `docs/adr/0019-*`
- **Branch**: fresh branch cut from `dev` (e.g. `feat/tier-aware-orchestration`)

## Why this exists

Tier-1 (domain, e.g. `domain:engineering`) and Tier-2 (organization, e.g. `digital-agency`)
orchestrators must behave differently, and the current projections say so only in prose:

- **Tier-1**: the orchestrator is a project manager that delegates to **subagents**; peer
  specialists may exchange messages **without** a team (Claude: cross-session messaging).
- **Tier-2**: the orchestrator runs an **Agent-Teams**-style mode (env/flags activated before
  the session) with shared task boards and direct teammate messaging.

Today `resolveClaudeTeamsPosture()` (exported from `src/cli.ts`) models this for Claude only,
the Cline/Antigravity lanes merely print "not available on this host", and `agents start --host
agents` falls back to Cline. This plan makes the two semantics explicit and host-aware.

## Verified host facts (fetched 2026-09-24 — re-verify before coding)

**Claude Code** — `code.claude.com/docs/en/{sub-agents,agent-teams,cross-session-messaging}.md`
- Subagents: in one session; report back (handoff). `tools` allowlist / `disallowedTools`
  denylist (denylist first); `Agent(agent_type)` bounds spawnable types; zero-resolvable-tools
  ⇒ refuses to launch. Frontmatter incl. `name, description, tools, disallowedTools, model,
  effort, omitClaudeMd`.
- **A foreground subagent inherits cross-session messaging when the session has it; a
  background subagent does not.** This is the Tier-1 mesh mechanism: independent sessions
  (e.g. `claude --agent <type>` in separate terminals) find each other with `ListAgents` and
  message with `SendMessage` (plain text; ~1M char same-machine cap; burst/loop throttling).
  Requires **v2.1.224+** (macOS/Linux/WSL2) or **v2.1.234+ native Windows**.
- Agent teams: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (env or settings.json). Lead + teammates;
  shared task list (`TaskCreate, TaskGet, TaskList, TaskUpdate` + cron tools on teammates);
  `SendMessage` between teammates directly. Limits: one team per session, no nested teams, no
  `/resume` of in-process teammates, lead fixed, slow shutdown.

**Antigravity** — `antigravity.google/docs/{subagents,teamwork,slash-commands}.md`
- Subagents (Tier-1): `invoke_subagent` spawns concurrent sessions (workspace `inherit|branch|
  share`, clean-slate context). Custom agents at `.agents/agents/<name>.md` with frontmatter
  `name, description, tools[]` (e.g. `view_file, replace_file_content, grep_search,
  run_command`), `mainAgent, subagent, model (inherit|flash|pro), commandExecutionPolicy
  (off|auto|eager|sandbox), mcpServers, skills/plugins`. **Known vendor issue: an unmapped or
  misspelled tool name may HANG the subagent** — exact names only. `define_subagent` makes
  transient agents. Monitor via `/agents` panel (Alt+J teleport, Ctrl+K fast-path). Built-ins:
  `research`, `browser`, `self`.
- Teamwork (Tier-2): `/teamwork-preview` — **paid plans only** (Antigravity 2.0 + CLI). Roles:
  Sentinel (coordinator) → Project Orchestrator (milestones + successor handoffs) → Explorers
  (read-only) / Workers (implement) + Critic / Challenger / Auditor / Success Auditor
  (adversarial gates). Phase-1 scoping interview → approved prompt artifact → autonomous
  milestones in `~/teamwork_projects/{PROJECT_NAME}` with exclusive file ownership.

**Cline** — `docs.cline.bot/{features/subagents,cli/agent-teams,core-workflows/using-commands}`
- Subagents (Tier-1): `use_subagents` — parallel **read-only research** agents (own prompt +
  context; `read_file, list_files, search_files, list_code_definition_names, execute_command`
  read-only, `use_skill`). **Cannot edit, write, browser, MCP, web, or nest.** Enabled by
  default. ⇒ Cline subagents cannot implement; implementation delegation on Cline is team-mode
  or coordinator-side. Our configured `.cline/agents/*.yml` agent lane is a separate surface
  (Plan 008/011) — do not conflate the two (Step 0 must confirm).
- Agent teams (Tier-2): **CLI/SDK/Kanban only** (not VS Code/JetBrains). `cline --team-name
  <name> "prompt"` enables team mode (coordinator gains spawn/delegate tools, shared task
  board); `/team` in interactive mode; state at `~/.cline/data/teams/[team-name]/` (task board,
  inter-agent mailbox, mission log) — read-only for agents-united; resumable by re-running
  `--team-name`. **Teams are ON by default; `cline --no-teams` disables** — the posture is the
  inverse of Claude's.

## Objective

1. `agents start --host antigravity` becomes first-class via a **hard rename** (owner decision
   2026-09-24: **no alias** — `--host agents` is refused with a rename notice); an
   `AntigravityLauncher` mirrors `ClaudeLauncher` (argv arrays, `shell: false`, probe-gated).
2. Tier-1 semantics: orchestration via subagents + handoff, with the **cross-session mesh**
   documented and named (Claude `ListAgents`/`SendMessage`); per-host delegation routes:
   Claude `Agent(...)`, Antigravity `invoke_subagent`, Cline `use_subagents` (research-only —
   say so in the projected instructions instead of promising implementation).
3. Tier-2 semantics per host: Claude `--teams` (env, existing), Cline `--team-name <bundle>` /
   `--no-teams`, Antigravity `/teamwork-preview` (prompt path; paid-only ⇒ probe + notice, never
   a hard dependency).
4. Tier × host section overlays (via Plan 017's overlay mechanism) so projected orchestrators
   describe the RIGHT semantics for the host they were projected for.

## Scope

In: `src/core/hosts.ts`, `src/cli.ts` (posture + flags), `src/core/claude-launcher.ts`,
new `src/core/antigravity-launcher.ts`, `src/core/cline-launcher.ts` (team-name wiring),
`src/core/claude-capabilities.ts` (cross-session floor), `tests/*`, overlay data, docs.
Out: anything under `~/.claude/**`, `~/.gemini/**`, `~/.cline/**`; the Cline/cursor/opencode/
codex renderer internals (byte-identical unless a step explicitly says otherwise); Kimi.

## Implementation steps (TDD — Red before Green)

**Step 0 — Premise probes (delegate: `subagent-repo-index`, read-only).**
Confirm: (a) whether `AskUserQuestion` is available to Claude subagents by default (Plan 017
decision 5 leans on the opposite claim — reconcile with the live tools reference and record the
result in the ledger); (b) that Cline's configured-agent lane and `use_subagents` are distinct
surfaces; (c) `cline --help` / `antigravity --help` flag spellings. **STOP if any premise
fails**: report instead of designing around it.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** New
`tests/tier-orchestration-posture.test.ts` + launcher argv cases (follow
`tests/claude-launcher.test.ts` and `tests/cline-launcher.test.ts` patterns): per-host per-tier
posture matrix; `--host antigravity` resolution + **hard-refusal of the old `agents` id** (exit 1
with a rename notice, same fail-fast shape as the under-development `--fanout` refusal);
Cline `--team-name
software-engineering` in argv for Tier-2 and `--no-teams` opt-out; Antigravity Tier-2 prompt
carrying `/teamwork-preview` only when the probe allows it; nothing writes outside the workspace.

**Step 2 — GREEN: hosts + CLI (delegate: `subagent-backend-architect`).** **Hard-rename** host
id `agents` → `antigravity` in `hosts.ts` and the `AgentHost` union (the registry entry is
currently keyed `agents` with `profile: antigravity` — rename the key and every reference);
`resolveStartHost` refuses `agents` with a rename notice; posture lifted from `resolveClaudeTeamsPosture` to a
host-keyed table (keep the export for back-compat).

**Step 3 — Launchers (same).** `AntigravityLauncher` (mirror `cline-launcher.ts` argv style);
Cline Tier-2 argv gains `--team-name <bundle-id>`; `--teams`/`--no-teams` semantics per host
documented in `--help` (Claude opt-in, Cline opt-out, Antigravity prompt-level + paid).

**Step 4 — Probes (same).** `claude-capabilities.ts` gains `crossSessionMessaging` (version
floor above); minimal `cline`/`antigravity` probes reuse the `--version`/`--help` parsing
discipline of Plan 016 (never headless prompts, never JSON endpoints).

**Step 5 — Projected instruction updates (same + Coordinator).** Tier-1 orchestrator overlays
teach: handoff default, mesh via `ListAgents`/`SendMessage` when peer sessions exist, Cline
research-only subagents (explicit). Tier-2 overlays teach the host's teams mode. Land as
overlay data if Plan 017 shipped; otherwise as canonical-neutral section text and migrate later.

**Step 6 — Tier × host overlays (requires Plan 017).** Wire overlay precedence
(overlay > dialect default > canonical) per Plan 017 decision 3, now per-tier (`domain` /
`organization`) × per-host.

**Step 7 — Review, gates, docs.** `subagent-code-reviewer` audit; full suite; `CONTEXT.md` terms
(`Subagent Mesh`, `Cross-Session Messaging`, `Agent Teams`); plans/README status.

## Done criteria

1. `npm run typecheck` 0 · `npm test` fully green.
2. `agents start digital-agency --host cline --dry-run` shows `--team-name` + teams-on-by-default
   posture; `--no-teams` removes it. `--host claude` behaviour unchanged from Plan 016.
3. `agents start software-engineering --host antigravity --dry-run` shows an `invoke_subagent`
   Tier-1 plan and no teams flags; `--host agents` is **refused with a rename notice** to
   `--host antigravity` (no alias, owner decision 2026-09-24).
4. Projected Tier-1 Claude orchestrator documents handoff + mesh; Tier-2 documents teams; no
   cross-tier bleed in the overlays.

## Escape hatches (STOP and report)

- `/teamwork-preview` is **paid-only** — if the probe cannot confirm it, the launcher must say
  so and fall back to plain sessions; never gate delivery on it.
- If Cline's agent lane and `use_subagents` turn out to be the same surface (Step 0b), STOP —
  the Cline Tier-1 design changes fundamentally.
- If overlay work would force renderer byte-changes before Plan 017's golden snapshots exist,
  STOP and sequence 017 first.

## Maintenance notes

Cline inverts Claude's teams default (on vs opt-in); Antigravity tool names hang on typos
(vendor issue — exact names only); cross-session floors differ on native Windows (v2.1.234+).
Keep the posture table keyed by `tier × host` next to `HOST_REGISTRY` so future hosts (Kimi)
add data, not branches.

## References

- Internal: `src/core/hosts.ts`, `src/cli.ts` (`resolveClaudeTeamsPosture`),
  `src/core/claude-launcher.ts`, `src/core/cline-launcher.ts`, `tests/claude-agent-teams-posture.test.ts`.
- External (all fetched 2026-09-24): the Claude, Antigravity and Cline pages listed under
  "Verified host facts" (all PRIMARY vendor docs).