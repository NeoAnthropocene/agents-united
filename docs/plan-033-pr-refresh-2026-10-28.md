# Plan 033 PR refresh — 2026-10-28

The maintainer requested a current PR/overlap check before resuming the authorized whole-plan goal. The design and P1 implementation remain local and unpublished; P2 has not registered a production worker.

**Subsequent P2 checkpoint, same date:** that paragraph describes the refresh point before implementation resumed. P1 offline gates completed, and [P2's bounded worker candidate](plan-033-p2-verification-2026-10-28.md) is now offline complete and ready for review. Its final suite passed 236 files/4929 tests with 209 skips; hostlib/typecheck and the 317-case full addon matrix also exited 0. The final explicit-repository recheck still found #211 latest, no open PR and remote dev `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`. This changes no historical host evidence or spending authorization.

## Ground and preservation

Fetched `origin/dev` to **`72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`** (merged #211), remote `https://github.com/NeoAnthropocene/agents-united.git`, Node **24.19.0**. Initial branch was `codex/plan-033-claude-delivery` at `cfa4682915c23e6c9eb3510468a1b262d6f2689a`, with 16 changed/new files and ignored logs/snapshots. All 16 files matched the prior frozen inventory. A second independent snapshot was saved to ignored `scratch/plan-033-implementation/pre-refresh-2026-10-28/`.

No upstream change touched those 16 paths. Created **`codex/plan-033-claude-delivery-oct28`** directly from fresh dev, carrying the working tree without stash, reset, commit or conflict. All 16 hashes still matched after the switch. This SHA is the continuation's actual planned-at baseline. Ignored evidence, earlier branches/worktrees and root AGENTS.md remain intact.

Explicit-repository `gh pr list --state all` found #207–211 merged to dev; `--state open` returned none. The all-state `0057` reservation query returned none. Merged #211 now owns ADR 0056, so the unpublished factory draft and links move to **[ADR 0057](adr/0067-claude-factory-realization-delivery.md)**. The earlier reservation check was correct at its historical date.

## Effects on the goal

| Merged PR | Inspected change and effect |
| --- | --- |
| [#207](https://github.com/NeoAnthropocene/agents-united/pull/207), `bf0b7cd2b1bd5ef7ceec98d11c35449d2c962e83` | Stock sourcing and designer integration. Preserve its resources, provenance and media ladder. Its PR reports four-host live results; those underlying records were not inspected here and do not establish factory support. No new factory dependency. |
| [#208](https://github.com/NeoAnthropocene/agents-united/pull/208), `a34a68ca2957dee96fd41c8cd23f67a6ac15074a` | Current session reader classifies human prompts from host provenance and records each hand-back attempt with matching acceptance state. The latest attempt decides; sections are not combined across attempts. Required baseline for the separately reviewed reader distribution. Reuse this implementation/tests; do not replace it with the older cross-session-only reader. Acceptance is distinct from caller receipt and process exit. |
| [#209](https://github.com/NeoAnthropocene/agents-united/pull/209), `e8123a2dd813ea7d1d170973fbcab3ea7210c9af` | Mechanism comes from actual host launch results, not the teams variable or a worker's brief. Ordinary subagents return their report and need no shutdown frame, notice wait or lifecycle wake-up. The factory worker already follows this branch. `SubagentHandback` is conditional; the native worker must fall back to its ordinary final response. One natural late-notice CLI-team case is now observed; process exit remains unverified. |
| [#210](https://github.com/NeoAnthropocene/agents-united/pull/210), `a063fc6293ae9acbe13798c5066479be4c6377c9` | Foreground Desktop launch form is named in the lead's mechanism check. Factory invocation now explicitly fixes `run_in_background: false`, alongside no teammate `name`, and inspects the actual result. The amended-wording re-run used async launches; it did not verify that foreground wording live. No Desktop support claim or messaging grant is added to the CLI-only factory. |
| [#211](https://github.com/NeoAnthropocene/agents-united/pull/211), `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021` | Motion/Sound roles, nine media Skills, passive four-field contracts, optional provider setup and bounded local/headless evidence. Preserve placement, rosters, native grants/floors, assets/helpers and separate Plan 037 ledger. Runtime/creative/provider/team limits remain separate from structural checks. This consumes ADR 0056 and changes catalog/lifecycle test inputs, requiring fresh gates. Its observed non-atomic legacy removal is not silently rewritten by the factory-only preflight. |

All five inspected PR heads have successful CI `test` metadata. That is historical CI evidence, not this continuation's verification. None implements or blocks the independent factory registration/realizer. No shared installer/projector/type/update/uninstall source file changed upstream; the one existing factory lifecycle test change only gives its whole-agency case a scoped 120-second timeout. Preserve that change and global defaults.

## Evidence inspected and verification

Read PR bodies/file inventories/check metadata, the complete changed session-reader implementation, updated orchestration guide, ADR 0055 amendments, ADR 0056 and the three newer lifecycle observations: `2026-10-16-claude-2.1.299-desktop-full-agency.md`, `2026-10-19-claude-2.1.301-worker-lifecycle-live.md` and `2026-10-19-claude-2.1.299-step0-foreground-rerun.md`. Inspected the corresponding compact evidence records and changed regression tests. These supplement R4/completion/diagnostic evidence; they do not rescore R3. Refreshed PROJECT/CONTEXT/catalog changes and standing rules were read; no live session was launched or replayed.

The previously running final gate completed on the old candidate: hostlib/typecheck/test exit files are **0/0/0**, with **222 files, 4619 passed, 209 skipped** in `logs/plan-033-implementation/p1-final-*`. These remain historical. Fresh focused checks, complete hostlib/typecheck/test and the full addon lifecycle matrix are required on the new baseline, with raw output and actual exits under ignored `logs/plan-033-refresh-2026-10-28/`.

Next: finish P1 verification/review, preserve its independent review packet, then implement the approved P2 worker/runbook and fixed-job/checked-result helpers. Evaluator, main-thread factory orchestration, contract helper, templates, current reader distribution and sync retain separate delivery reviews. Finish/review Claude before Codex, then Antigravity, then Cline. OpenCode, managed source installation/release policy and broad legacy retirement keep their separate boundaries.

**Unverified:** current-candidate gates until their recorded completion, factory live invocation, skill behavioral improvement/evals, actual evaluator and later-host factory behavior. No host/model/provider session, paid test, commit/push, PR publication or merge is authorized. R3's historical seven expectations, Defne unverified, five brief violations and historical allowance remain unchanged; later media/lifecycle ledgers authorize no new factory spending.

## P1 verification checkpoint — 2026-10-28

P1's refreshed offline implementation gates are complete. All **17 candidate hashes** matched `scratch/plan-033-implementation/refreshed-serial-2026-10-28/inventory.json` before and after verification. Complete raw final outputs and actual exits were read in `logs/plan-033-refresh-2026-10-28/`:

| Check | Actual result |
| --- | --- |
| Host library verification | Exit **0**, snapshots/locks/citations unchanged. |
| Focused factory/current reader/lifecycle | **248 tests / seven files**, exit **0**. |
| Typecheck/build, source and test TypeScript, hostlib and quality tool types | Exit **0**. Subsequent correction was documentation only. |
| Complete serial `npm test -- --maxWorkers=1` | **231 files; 4869 passed, 209 skipped; 0 failed**, actual exit **0**. Includes the extracted offline npm-package fixture and current media/reader/native regressions. |
| Full `AGENTS_CI_FULL=1` addon lifecycle matrix | **317 tests; no skips/failures**, actual exit **0**. Full raw output read. |
| Documentation and whitespace | Seven UTF-8 documents, balanced fences, 85 relative file links; actual exit **0**. `git diff --check` passed; index is unstaged. |

The earlier two-worker full run remains a failure record: **4867 passed / two failed / 209 skipped, exit 1**. One was Windows `EBUSY` in an existing Cline doctor cleanup; its cause is unverified. The other was this continuation's index edit dropping the existing foundation-status prefix; that prefix was restored with the current P1 status. The unchanged Cline suite plus documentation checks then passed **80 tests / four files**, exit **0**. No timeout, skip, callback, global test setting or assertion was changed. The complete successful serial run supersedes that failed verification, without erasing it.

This closes P1's offline delivery prerequisite, not P2 or the Claude factory stage. Its local review packet remains unpublished. P2 begins with the separate [record design](../plans/033-slice-4-p2-record-design.md) and expected-red production worker/helper tests. No factory invocation, evaluator judgment, behavioral improvement, provider support or later-host capability is established by these gates.
