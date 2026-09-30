# Plan 031: Antigravity Agent Discovery Spike (agy 1.2.13 workspace layout)

> **Executor instructions**: read-only spike, no implementation until the decision matrix resolves.
> Owner field evidence 2026-09-29 + maintainer machine probes the same day.
> Depends on: Plan 029 gate 6(c)/Step 0(d) questions.

## Status

- **State**: EXECUTED — probes run 2026-09-29 by the owner on agy 1.2.13 (Windows 11,
  real terminal). Verdict **Outcome B** (neither layout loads); see § Findings.
  **Addendum 2026-09-30** (agy 1.2.14, doc re-check + listing probes): the *listing* half of
  Outcome B is overturned — both layouts list when the workspace is registered and the
  frontmatter is spec-conformant; the *injection* half is still unverified and needs the owner
  re-probe in § Addendum. No projection work is authorized yet.
- **Priority**: P1 (blocks the Plan 029 gate-6(c) verdict) · **Effort**: S · **Risk**: Low.
- **Category**: host conformance / discovery.

## Why this exists

Plan 029's launch path assumed flat workspace agents:

- `agy --agent orchestrator-engineering` names `.agents/agents/orchestrator-engineering.md`.
- `runAntigravityStart` refused to spawn unless that flat file existed.
- Step 0(d) ("can an Antigravity orchestrator `invoke_subagent` a workspace agent by name?")
  was explicitly left unverified.

Owner evidence 2026-09-29 on **agy 1.2.13** changes both premises:

1. A plain launch **did not start with `orchestrator-engineering`**; the reporter points at the
   last five `agy changelog` entries and Antigravity docs.
2. The reporter observes custom agents now list under a **directory layout**:
   `{workspace}/.agents/agents/{agent_name}/agent.md`, not the flat
   `{workspace}/.agents/agents/{agent_name}.md` files this repo installs.
3. `agy agents` inside a folder-scope workspace does not surface the orchestrator agent.

Supporting maintainer evidence on the same box 1.2.13: a scratch workspace containing
*both* `probe-agent/agent.md` (directory form) and `flat-agent.md` (flat form) returned
**empty `agy agents` output**. Historical record: `advisor-plans/004-findings.md`
(agy 1.1.14/1.1.15) accepted `--agent` unvalidated with no persona injected
(marker `NOT_FOUND`) in headless/stream-json modes. Separately, the 1.2.11 changelog
reworked project custom agents "not being found or selectable ... under execution with
`--agent`", so a discovery-location change in 1.2.12/1.2.13 is plausible, not proven.

**Interim hardening already shipped on the feature branch** (not the answer, only tolerance):
`runAntigravityStart` accepts either the flat file or the directory entry before spawning.

## Findings (owner probes, agy 1.2.13, quoted verbatim)

- `agy agents` → **empty output** (neither fixture listed).
- `agy --agent flat-probe -i "<identity probe>"` → `(1) Name: Antigravity / (2) NOT_FOUND`
  (directory-layout fixture also answered `NOT_FOUND` + "no frontmatter present" — i.e. the
  stock agent ran, neither fixture prompt was injected).

**Interpretation.** The empty listing alone would be weak (a listing bug, not a load proof),
but the two identity sessions ran the *stock* Antigravity agent in place of the named
fixture — the same failure signature as the 1.1.14/1.1.15 headless verdicts, now reproduced
in interactive-equal (`-i`) sessions. `--agent` accepts the name but resolves no workspace
roster in either layout. The `NOT_FOUND` from the directory fixture additionally shows the
stock agent sees no fixture frontmatter at all.

## Objective — RESOLVED as Outcome B

- **Outcome B (neither loads):** Step 0(d) resolves **NO**; the host-matrix unverified note
  and the fail-closed verbatim rule stay the final answer; Plan 029 gate 6(c) is
  blocked-by-vendor with the desktop route as the supported path.
- Outcomes A/C are closed: neither layout injects, so there is no layout to prefer.

## Decisions (record)

- No agy-specific projection work is authorized by this spike. If a future agy release
  restores workspace discovery, re-run the three probes (listing + per-layout identity)
  before touching the installer.
- The interim flat-or-directory tolerance in `runAntigravityStart` stays (harmless,
  two-path `pathExists` check, covered by unit tests).

## Acceptance gates

1. Verdict B recorded with quoted command evidence — DONE (above).
2. Matrix wording already correct (explicitly unverified), no code — DONE.
3. No implementation lands inside this spike — DONE (tolerance predates the spike).

## Addendum 2026-09-30 — doc re-check and listing probes (agy 1.2.14)

Trigger: the Antigravity docs snapshots seeded in Plan 032 PR A document a workspace agent layout
that the 2026-09-29 spike did not test as written. Read-only; no model calls; no code changes.

### What the docs (host-library/antigravity/pages/agent/subagents.md, command/cli-agents-command.md) say

1. **Both layouts are valid workspace locations**: `.agents/agents/<name>.md` and
   `.agents/agents/<name>/agent.md` (global: `~/.gemini/config/agents/...`). The `/agents` panel
   itself shows the directory form as its "Create New Agents" template.
2. **`name` and `description` are required frontmatter.** The documented properties are `name`,
   `description`, `tools`, `mainAgent` (default `true`), `subagent` (default `true`), `model`,
   `commandExecutionPolicy`, `mcpServers`, `skills`/`plugins`. There is **no `hooks` property**:
   hooks are configured in `hooks.json` (workspace `.agents/hooks.json`, global, or plugin).
3. The documented way to list and select custom agents in the CLI is the `/agents` panel.
4. `agy changelog` 1.2.11: "Fixed project custom agents in .agents/agents/ not being found or
   selectable in workspaces created in the Desktop App, in already-trusted workspaces, under
   execution with --agent, in headless runs, and in the /agents panel." Workspace trust and
   workspace registration are therefore in play. 1.2.10: directory entries in `agents.json`
   (and `skills.json`, `rules.json`, `plugins.json`) now load only items directly inside the
   directory; nested items need `include_only`.

The docs changelog snapshot lags the CLI: it shows 1.2.11 as latest while `agy changelog` shows
1.2.12, 1.2.13 and 1.2.14 (none of which mention custom-agent discovery). Use `agy changelog` as
an additional source when refreshing the Antigravity library.

### Corrections to the 2026-09-29 premises

- `agy agents` **is a real subcommand** ("List available agents", alias `agent`); it is just absent
  from our docs snapshot. `--agent` is a real flag ("Agent for the current CLI session").
- An empty `agy agents` is **not** evidence that a layout fails: it is empty in a plain working
  directory and in this repository's root, but not when the directory is given with `--add-dir`.

### Probes (Windows 11, agy 1.2.14, scratch git workspace, `agy --add-dir <dir> agents`)

| Fixture | Listed? |
|---|---|
| directory layout `probe-dir/agent.md`, `name`+`description`+`tools: [view_file]`, `mainAgent: true` | **yes** |
| flat layout `probe-flat.md`, same frontmatter | **yes** |
| same fixtures, plain `agy agents` (no `--add-dir`) | no (empty) |
| flat fixture + one repo-style key: `model: inherit` / `commandExecutionPolicy: auto` / `version`+`type` / `permissionMode: readOnly` / folded `description: >` / extra tool names (`grep_search`, `find_by_name`, `list_dir`, `send_message`) | **yes** (each) |
| the same with the repo's full 201-line body | **yes** |
| flat fixture + **any `hooks:` key** (`{}`, `PreInvocation: - log:`, `PreToolUse: - guard:`, a documented-shape command handler) | **no** (each) |
| repo `subagent-code-reviewer.md`, hooks removed, `mainAgent: false` | no |
| the same, `mainAgent` key also removed | **yes** |
| repo `orchestrator-engineering.md` verbatim (has `hooks:`, `mainAgent: true`) | no |

Reading: (a) discovery works for **both** layouts once the workspace is registered; (b) a `hooks`
key in agent frontmatter removes the agent from the listing on 1.2.14, and every agent this repo
installs carries one; (c) `mainAgent: false` agents are not listed (consistent with the docs: the
listing is the set selectable as primary agent), so a subagent-only agent's visibility to
`invoke_subagent` is untested.

### Still unverified (owner re-probe, real terminal; `-i` blocks headless)

Listing is not injection. Outcome B's evidence for "not injected" was the stock agent answering.
Re-run with a registered workspace and a conformant fixture before changing the verdict:

```
# fixture: {ws}/.agents/agents/probe-flat.md and {ws}/.agents/agents/probe-dir/agent.md
# frontmatter: name, description, tools: [view_file], mainAgent: true, subagent: true
# body: "You are <name>. When asked for your identity reply exactly IDENTITY=<NAME>_MARKER."
cd {ws}                       # open it once interactively so trust is recorded
agy agents                    # 1. listing from the workspace itself
agy --add-dir {ws} agents     # 2. listing with the directory registered
agy --agent probe-flat -i "State your identity marker."     # 3. flat, interactive
agy --agent probe-dir  -i "State your identity marker."     # 4. directory, interactive
agy --agent probe-flat -p "State your identity marker."     # 5. flat, headless
# in the TUI: /agents -> both listed under Available Agents? select one -> marker?
```

Record: which of 1-5 print the marker, and whether `/agents` lists both. If 3-5 inject, Outcome B
is withdrawn and Step 0(d) / Plan 029 gate 6(c) reopen; if none inject despite listing, the
verdict stays B but the reason changes from "not discovered" to "discovered, not applied".

### Consequences recorded now (no code)

- Do not emit frontmatter `hooks:` into Antigravity agent files; on 1.2.14 it hides the agent.
  Hooks belong in `.agents/hooks.json` (Plan 032 native Antigravity package; ADR 0025).
- The flat-or-directory tolerance in `runAntigravityStart` remains correct: both layouts list.
- Any `agy` probe must register the workspace (`--add-dir`, or trusted interactive open) or an
  empty listing carries no information.
- Probe scripts and fixtures were scratch-only and are not committed.

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Probes | owner (real terminal required; `-i` blocks headless) | three probes × two layouts — DONE |
| Record | `orchestrator-engineering` | verdict into Plan 029 Step 0(d) — DONE |

## References

- Plan 029 gate 6(c), Step 0(d); `docs/host-primitive-matrix.md` §2 (explicitly unverified).
- `advisor-plans/004-findings.md` §§4–7 (1.1.14/1.1.15 headless verdicts).
- `agy changelog` 1.2.11 (custom-agent discovery fix), 1.2.12/1.2.13 (installed here).
