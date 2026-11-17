# Plan 033: Claude stage review (2026-11-17)

This record is the lead's review of the Claude stage of Plan 033 as it stands on the branch of draft pull request 219 at commit `91d1ce4` (2026-11-17). It lists the state of every Claude-stage row of the [completion matrix](plan-033-completion-matrix.md), the choices the lead made under the maintainer's delegation, the findings that are open, and what only the maintainer can do. It does not close the stage. Closing it is the maintainer's: it needs his word on the delegated choices, his decisions on the items the lead did not decide, and the merge of the pull request, which the lead never does.

## The rows

One row is CLOSED, ten rows are CLOSED WITH LIMIT, and two rows are OPEN (Factory hooks; Claude stage quality and proof). The state is the one in the matrix after this review; the third column gives the limit or open point that matters most, taken from the state line of the matrix cell.

| Row | State today | The limit or open point that matters most |
| --- | --- | --- |
| Foundation/basic contract/catalog | CLOSED | Merged earlier; later validator edits ride on draft pull request 219. |
| Approved first skill/attribution | CLOSED WITH LIMIT (decided by the lead under delegation) | The one headless comparison showed no quality gain of the Skill; the typed Skill route wrote its evals file and the draft passed `skill-check` (Sittings B and C, each shown once). |
| Claude P1 native-only delivery | CLOSED WITH LIMIT | Windows gates and Linux CI are green on draft pull request 219 (unmerged); worker closures are checked through the coordinator only. |
| Claude P2 realizer | CLOSED WITH LIMIT | One interactive journey (Sitting A, one machine, sat by the lead through a terminal bridge); other artifact kinds and a human-typed session are not observed. |
| Shared definition/contract authoring helper | CLOSED WITH LIMIT (since Sitting C) | Reuse, update and repair are not observed; the checkers' root comparison by path string is a recorded follow-up. |
| Domain/Organization templates | CLOSED WITH LIMIT (decided by the lead under delegation) | Live Organization provisioning, reload and authorization boundaries are not observed; the typed Bundle route was shown in three interactive sessions. |
| Factory evaluator | CLOSED WITH LIMIT | Six reviews passed the caller's check, but the usefulness of its findings was not judged. |
| Factory orchestrator/pipeline | CLOSED WITH LIMIT | A worker that never reports and the stop-waiting exit are not observed; the waiting rule is prose; findings C-1 to C-3 are open. |
| Current Claude session-helper distribution | CLOSED WITH LIMIT | Offline and Linux CI; unmerged on draft pull request 219. |
| Host-update sync after realize | CLOSED WITH LIMIT (since the headless sync run) | An interactive session under the waiting rule, and the realization that follows a plan, are not observed. |
| Factory hooks | OPEN | Waits for the maintainer's decisions on items 6, 7 and 8 of the list of open decisions (see below). |
| Contribution route | CLOSED WITH LIMIT (decided by the lead under delegation) | The contribution commands are prepared but not run by the factory; the pull-request body with base `dev` and `sent: false` was prepared once interactively and twice headless. |
| Claude stage quality and proof | OPEN | Findings C-1 to C-3, the follow-up slice of P25, the maintainer's word on the lead's choices, and the merge. |

The new state lines of the three delegated closings and of the last row are in the matrix:

- Approved first skill/attribution: "State 2026-11-17, stage review: CLOSED WITH LIMIT. The typed Skill route wrote its evals file, the fork wrote its return with the shipped script and the draft passed `skill-check` (Sittings B and C, each shown once); the one headless comparison showed no quality gain of the Skill, a limit the lead accepted under the maintainer's delegation of 2026-11-17 (his to overturn)."
- Domain/Organization templates: "State 2026-11-17, stage review: CLOSED WITH LIMIT. The typed Bundle route was shown in three interactive sessions, with a passed postflight and `bundle-check` in Sittings B and C (each shown once); live Organization provisioning, reload and authorization boundaries are not observed, a limit the lead accepted under the maintainer's delegation of 2026-11-17 (his to overturn)."
- Contribution route: "State 2026-11-17, stage review: CLOSED WITH LIMIT. A pull-request body with base `dev` and `sent: false` was prepared in one interactive journey (Sitting A) and in two headless journeys (each shown once); the contribution commands are prepared but not run by the factory, a limit the lead accepted under the maintainer's delegation of 2026-11-17 (his to overturn)."
- Claude stage quality and proof: "State 2026-11-17, stage review: OPEN. Eleven of the thirteen Claude-stage rows are closed or closed with a limit; open are the Factory hooks row (three decisions of the maintainer), findings C-1 to C-3, the follow-up slice of P25, the maintainer's word on the choices the lead made under his delegation, and the merge."

The Factory hooks row stays OPEN because of items 6, 7 and 8 of the list of open decisions (the P23 addendum of the [handoff](plan-033-handoff-2026-11-15.md)): whether the legacy inline guard and the settings-level session guard should block when they cannot run, whether the supported floor should be raised to 2.1.295, and whether the destructive guard should block a call whose input it cannot read. The lead gave no recommendation on them and did not decide them: they change behaviour for every bundle.

## What the lead decided under the maintainer's delegation

The delegation, in the maintainer's words of 2026-11-17: "I won't be monitoring until the morning 8 a.m. So decide yourself for the questions and other things as your recommended options and only wait for very critical questions."

Each choice below was made by the lead under that delegation and is the maintainer's to overturn.

1. The one headless re-run that had been waiting for his go-ahead was made (a full realize-and-review journey), and a second headless run re-observed the host-update sync route. His to overturn.
2. One short interactive sitting (Sitting C) re-observed the fixes of P24 and P25. His to overturn.
3. Slice P25: the factory's own Skills were made to pass the factory's own Skill check (item 10 of the list: "fix or record"), and `author-skill` got a return-writing script. His to overturn.
4. The five stage limits of item 3 of the list were accepted as limits, without further work: no preload for an `--agent` main (the coordinator reads its entry itself); the three typed authoring commands stay typed by the human; no measured quality gain of `author-skill`; no live proof of Organization provisioning; the contribution commands are prepared but not run by the factory. His to overturn.
5. The figures dropped in P18 (item 4 of the list: 1,800 seconds and 8 MiB, dropped with the 24-process budget) stay dropped. His to overturn.
6. When the router refused a further run on Codex ("headroom 8% below minimum 10%"), the lead used read-only Claude subagents for one review round and for records instead of stopping. The maintainer had said on 2026-11-17: "Prioritize codex CLI for your subagent worker over Antigravity. Keep antigravity for Antigravitt specific tests only". His to overturn.

Not a delegated choice: the fix of the three findings of Sitting B (P24) was the maintainer's own word ("Yes, fix them").

## What awaits the maintainer

1. Confirm or overturn the six choices above. The three closings that rest on them (Approved first skill/attribution, Domain/Organization templates, Contribution route) stand as closed with a limit only while he leaves them.
2. Item 5 of the list of open decisions: whether postflight should refuse a draft without `evals/evals.json`.
3. Item 6: whether the legacy inline guard and the settings-level session guard should block when they cannot run.
4. Item 7: whether the supported floor should be raised to 2.1.295.
5. Item 8: whether the destructive guard should block a call whose input it cannot read.
6. Item 9: the launcher's `.cmd` shim fault (own pull request).
7. Merging draft pull request 219, or taking it out of draft. The lead never merges.
8. The router's draft pull request 220 (WSL node lookup and the budget option): open, draft, Linux CI green; merging is his.
9. The start of the Codex stage, the next stage of the plan. It was not started.

Items 2 to 6 of this list are items 5 to 9 of the list of open decisions; the lead did not decide them.

## Open findings and follow-ups

None of these is fixed.

- C-1: the prepared briefs of the proof kit carry a `roots.workspace` field that the task schemas refuse; the coordinator copied it into its task records in Sittings B and C and corrected itself after the first preflight.
- C-2: the notes file of the return scripts: the forks found the shape of a `claimedChecks` entry and its `raw` pin only by reading the script's source.
- C-3: the texts do not say plainly enough where the caller saves the evaluator's result (it must be `<review root>/result.json`); seen in Sitting C and in the headless journey.
- The follow-up slice of P25: the three checkers' preflight root checks and the draft helpers `draft.mjs` and `draft-pair.mjs` still compare path strings; the draft-parent check with a short name.
- The limits each row names in the matrix, in particular: a worker that never reports and the stop-waiting exit are not observed; the waiting rule is prose; nothing was observed on another machine, with another permission mode, on a later Host version, or in a session typed by a human on a screen. Sittings A, B and C were sat by the lead through a terminal bridge; the earlier sittings of 16 November were sat by the maintainer.

## Evidence index

- Verification records of the slices since the first stage review: [P23](plan-033-p23-verification-2026-11-16.md), [P24](plan-033-p24-verification-2026-11-17.md), [P25](plan-033-p25-verification-2026-11-17.md). The earlier slices P16 to P22 have their own records of 2026-11-16 in this folder.
- Observation records in `host-library/claude/observations/`:
  - [Headless stage proof, Claude Code 2.1.323](../host-library/claude/observations/2026-11-15-claude-2.1.323-factory-stage-proof-headless.md)
  - [Interactive stage proof](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)
  - [Fork-mode re-sitting](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-fork-mode-resit.md)
  - [Guard missing-script re-sitting](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-guard-missing-script-resit.md)
  - [Background-workers journey (Sitting A)](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-background-journey.md)
  - [Typed routes on a second model (Sitting B)](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-typed-routes-second-model.md)
  - [Fixes re-observed (Sitting C and two headless runs)](../host-library/claude/observations/2026-11-17-claude-2.1.325-factory-fixes-reobserved.md)
- The last full gate on Windows is the one of P25 (in its verification record): `hostlib-verify`, `typecheck`, `full-test-serial` (314 test files; 7,925 passed, 228 skipped) and `addon-matrix` (317 passed), all exit 0. The commits after it (`3688281`, `91d1ce4`) are documentation only.
- Linux CI check `test`: success on `3688281` (read once). For `91d1ce4` and for the commit of this record it runs after the push and is not read yet.
- Commits on the branch since the first stage review, oldest first: `d24de09` (P23 code), `55274f8` (P23 records), `000fc18` (Sitting A), `df8fca9` (Sitting B), `a4fc928` (P24 code), `6bbe03f` (P24 records), `a5948c3` (P25 code), `3688281` (P25 records), `91d1ce4` (Sitting C and two headless runs).

## Addendum, later on 2026-11-17: the four open points fixed offline (P26)

P26 fixes offline findings C-1, C-2 and C-3 and the follow-up of P25 listed in "Open findings and follow-ups" above. The fixes are not re-observed; nothing of P26 has been run on a live Host. See [the P26 verification record](plan-033-p26-verification-2026-11-17.md). The row states and what awaits the maintainer are unchanged; the stage is still not closed.
