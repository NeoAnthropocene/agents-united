# Plan 034: Claude Code 2.1.289 Host Sync: Adaptation Plan

> **Executor instructions**: this is the adaptation plan of a `host-update-sync` run (ADR 0025). The run refreshed the Claude docs snapshots and wrote this plan; it changed no role, guide, profile or code. Each task below is for the owner's daily routine to pick up.

## Status

- **State**: SNAPSHOTS REFRESHED 2026-10-04 (branch `chore/host-sync-claude-2026-10-04`); the **changelog baseline stays at `2.1.285` on purpose** (below); adaptation tasks open. One page is on a **security hold**.
- **Scope**: Claude Code only, library reviewed against `2.1.285` before this run, `2.1.289` after. Cline and Antigravity were not checked.
- **Priority**: P3 · **Effort**: S (the tasks below) · **Risk**: Low (docs and snapshots; nothing the install lane ships changed).

## What changed upstream

`npm run hostlib:check` (read-only) found four releases and two index changes; `hostlib:refresh --types agent,command,hook,mcp,orchestration,permissions,plugin,rule,settings,skill,tools` (without `--advance-changelog`, see "The baseline") refreshed 16 of the 18 affected pages (`settings.md` was unchanged, `mcp.md` is held, see below), `llms.txt`, `llms-platform.txt` and the changelog snapshot. `npm run hostlib:verify` passes: the lock matches the files and every guide citation resolves.

## The baseline stays at 2.1.285, on purpose

The first run used `--advance-changelog`, which moves `lastSeen` to `2.1.289`. The repository's own gates then failed (three tests: the Claude profile is pinned to the changelog baseline, every guide's `reviewedAgainst` must equal it, and the profile's plugin manifest keys must match the snapshot). Satisfying them by bumping the pin and the eight `reviewedAgainst` markers would have said "reviewed against 2.1.289" for guides nobody re-read, and for an MCP guide whose page is on hold. So the lock was restored and the refresh re-run **without** `--advance-changelog`: `lastSeen` stays `2.1.285`, a later `hostlib:check` keeps listing the four releases until the owner has handled the hold and re-read the guides, and the baseline moves in the PR that does that (tasks 1 and 2). The one change the snapshot forced is below.

Changelog entries that touch what our native packages rest on (read from the snapshot `host-library/claude/changelog.md`, filtered by keyword; the other lines of each release were not read for impact):

| Release | Entry | Why it matters here |
| --- | --- | --- |
| 2.1.289 | Added `agent.spawn` for teammates, one agent id across plugin hook events, and idle and waiting states in `$.agent.list()` | A mods API; new, not adopted (see "New features") |
| 2.1.288 | Fixed PreToolUse and PermissionRequest hooks being skipped when matching them failed or the tool's input could not be serialized to JSON; the call is now blocked | Guards: this is about the matcher failing, not a script that cannot start (observed fail-open on 2.1.288, ADR 0035); re-test the missing-script case on 2.1.289 |
| 2.1.288 | Fixed agent teams: a plugin-defined agent spawned by name now runs with its own prompt, tools, disallowedTools and effort instead of the defaults | Our roles are project agents, observed correct on 2.1.288 and 2.1.289; no action |
| 2.1.288 | Fixed a stall when launching an agent whose `tools:` lists very many `Agent(...)` entries | None of our roles lists `Agent(...)` entries |
| 2.1.286 | Fixed foreground subagents sometimes missing the task-tracking tools (TaskCreate/Get/Update/List, TodoWrite) in sessions that have them enabled | Relevant to the Task-tools finding of ADR 0038 |
| 2.1.286 | Fixed `/compact`, `/clear` and `/rewind` typed while viewing a teammate's transcript acting on the main conversation | None |

Pages that changed in ways our artifacts depend on (from the snapshot diff):

- `pages/orchestration/agent-teams.md`: for an in-process teammate the host removes the definition's `disallowedTools` and applies its `effort`; **"`SendMessage` and the Task tools it adds stay available even when the list names them"** (this matches what the PetPal live re-run showed: the Task tools reached teammates as deferred tools, ADR 0038); teammates "by default" inherit the lead's effort; a teammate can be spawned from a plugin-scope subagent definition too.
- `pages/permissions/permission-modes.md`: in auto mode, "any `permissionMode` in the subagent's frontmatter is ignored" (consistent with the team runs: the maintainer's `auto` applied to every teammate).
- `pages/hook/hooks.md`: a new `if` field on a hook handler (permission-rule syntax such as `Bash(git *)`), `updatedInput` replaces the whole input object, an Agent call that omits `run_in_background` reports `async_launched`.
- `pages/agent/sub-agents.md`: `SendMessage` refuses a send when its name now refers to a different agent than it reached earlier; a subagent that ends on an API error reports the failure back.
- `pages/tools/tools-reference.md`: background-command time limits (unattended sessions only). **No tool was added or removed:** the tools table has the same 48 rows before and after, and every name in it is in `registry/hosts/claude/tool-policy.json`.

## Security holds

- **`pages/mcp/mcp.md` was not refreshed.** The docs audit gate blocked it: `[high] injection/exfiltration line 340`, a sentence documenting that MCP OAuth credentials are sent only to a token endpoint served over HTTPS or at `localhost`, `127.0.0.1` or `::1`. By its text this is documentation of a safeguard, not an instruction aimed at an agent, so it reads as a false positive of the credential-and-endpoint rule; **it was not overridden** (the skill forbids it). The snapshot and its lock hash stay at the previous version, so the MCP guide still rests on the 2.1.285 page. The owner clears or handles the hold deliberately (review the rule, or ingest the page with `hostlib:ingest --via` after a human review).

## Impact on our artifacts

- `registry/hosts/claude/profile.json`: `minVersion` 2.1.271 unchanged, still correct. **One forced edit:** the refreshed `plugins-manifest-reference.md` lists six manifest keys the profile lacked (`icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`, `types`), and `tests/host-profile.test.ts` requires the profile's `artifacts.plugin.manifestKeys` to equal the snapshot, so they were added (a widening of an allowed-key list; nothing generates those keys). `tool-policy.json`: unchanged (no catalog diff).
- `host-library/claude/guide/*.md` still say `reviewedAgainst: "2.1.285"` and their citations resolve. They have **not** been re-read against 2.1.289 (the orchestration, hook, agent and permissions guides sit on the pages that changed above), which is why the baseline did not move.
- `docs/host-primitive-matrix.md` (ADR 0023) names the Claude column against `2.1.271`+ and carries no 2.1.28x date; nothing to re-verify from this run. `registry/translation-ledger.json`: no delta changes.
- Native roles under `registry/hosts/claude/`: nothing in the diff contradicts a committed body; the one live finding (teammates and the deferred Task tools) is already handled in ADR 0038.

## New features worth knowing (none adopted)

- **Mods**: ten new pages under `code.claude.com/docs/en/plugins/mods/` (overview, create, reference, interface, gallery, events, API, test, troubleshoot, admin). Judged from their titles only, since they were not read, they describe a new plugin component with a UI and an events API; `agent.spawn` for teammates arrived with 2.1.289. They are not in `sources.json` `pages`, so they are not snapshotted. Whether to track them is the owner's call.
- **Hook `if` field**: a permission-rule filter on a hook handler could narrow the destructive guard to, say, `Bash(git push *)` calls instead of running the script on every Bash call. Not adopted: the script already filters, and a second filter would need its own tests.

## Tasks

1. Owner: decide the `mcp.md` hold (clear it after review, or leave the snapshot stale on purpose and say so).
2. Owner: re-read the eight guides against the refreshed pages (the orchestration, hook, agent and permissions ones first), then in one PR bump every `reviewedAgainst` and the changelog baseline (`hostlib:refresh --advance-changelog`) together with the decision on task 1; run `npm run hostlib:verify` and the three baseline tests.
3. Next real Claude session: re-test that a missing guard script still fails open on 2.1.289 (ADR 0035), given the 2.1.288 hook-matching fix.
4. Owner: decide whether to snapshot the mods pages.
5. Upstream skills: none watched in this run (Claude host only; `host-library/_upstream/skills.json` untouched).

## Risks

Low. Snapshots, a plan, and one allowed-key list. The residual risk is the stale `mcp.md` and guides that rest on snapshots newer than their `reviewedAgainst` (tasks 1 and 2); the unmoved baseline keeps that visible.

## Verification checklist

- [x] `npm run hostlib:verify` passes.
- [ ] `npm run hostlib:check -- --host claude` on the branch still lists the four releases (the baseline did not move).
- [ ] `npm run typecheck && npm test` green (run alone before the PR).
