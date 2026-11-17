# Plan 033 P4 reader delivery — 2026-10-29

Baseline/planned-at `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`, branch `codex/plan-033-claude-delivery-oct28`, Node 24.19.0. The maintainer confirmed the dedicated report/trim executable and actual CLI/package test seams in [the prior design](../plans/033-slice-4-p4-session-reader-design.md). P3b's separately verified 84-file packet remains preserved; it does not establish this later candidate's gate.

## Final offline acceptance — 2026-10-29

The frozen P4 candidate is **offline complete and ready for review**. Final build/typecheck and host-library verification exit **0/0**. The complete serial suite passes **243 files / 5071 tests / 209 unchanged skips**, actual exit **0**, in **794.37 seconds**. Complete raw output and actual exits were read. All **76** frozen runtime/test/config files remain byte-identical. The two existing non-failing Vite file-URL warnings remain visible in the raw log.

The source scope is the 95-file cumulative packet at `scratch/plan-033-implementation/p4-final-review-2026-10-29/`, with P3b-to-P4 delta and raw-evidence hashes. The preceding 84-file P3b packet and its complete 317-case matrix remain separate. The current installer/projector/remover/catalog lifecycle bytes match that packet exactly; P4 adds no managed projection/ownership path, so that matrix was not rerun for this utility.

Authoritative current records are `logs/plan-033-p4-2026-10-29/{focused-final,typecheck-final,hostlib-final,full}.{raw.txt,exit}`. The combined focused run passes **122** cases including the final real installed-package test. Documentation checks cover **32** UTF-8 files, balanced fences and **253** relative links at the candidate checkpoint. No published-PR CI result is claimed.

Fresh origin/dev remains `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`; the latest explicit repository and open-PR checks returned no open PR. No repository commit/push, publication, merge or live/private/paid record invocation occurred. Subsequent evaluator/template reconnaissance is design-only and outside this packet. The following sections preserve earlier candidate status and are superseded by this acceptance where they say gates are pending.

**Earlier candidate checkpoint: complete gate pending.** The existing Claude reader is packaged as `dist/session-report.js`, with `agents-session-report` registered alongside the unchanged main aliases. One build cleans once and emits declarations only for the main CLI. Parser data models moved unchanged to central types with their old script aliases reexported; direct maintainer use and the existing 69 parser regressions remain intact.

## Concrete delivery and evidence

The public entry `scripts/hostlib/session-entry.ts` uses the scoped preflight/staging module `session-input.ts` and the single current `session-report.ts`. No new Agent, shared contract, Skill, Workflow, rule, hook or native projection is added. The utility has no network/model/provider/maintenance operation. [The user guide](session-report.md) names exact selection, budgets, output roots, pins, exits, partial records and sharing limits.

Actual TDD evidence is retained under ignored `logs/plan-033-p4-2026-10-29/`. The first CLI case failed for the absent built executable, then passed current human/injected/peer provenance and accepted-handback behavior. Subsequent public reds reproduced implicit transcript-controlled manifest reads, linked lead acceptance, absent input inventory, silently dropped interior JSONL, missing byte budgets and missing/unmatched sibling disclosure. Each was corrected through the same executable, with actual exits read.

An independent code review identified three additional input defects. Public cases reproduced the dot-stem escape into a parent sibling directory, preflight normalization accepting BOM/NBSP/vertical-tab records the parser discarded, and non-finite cost conversion becoming JSON null. Narrow scope, exact-byte and finite-number fixes close them. The first stem fix still accepted Node's special hidden `.jsonl` basename; its actual failure and final suffix-slicing correction remain recorded. This is a Codex code review, not a delivered factory evaluator or live Host test.

Trim has actual refusal and successful-delivery checks. Whole-workspace inventories prove preservation on existing/nested/ancestor/missing/managed/linked/traversing destinations and corrupt sources. A genuine post-staging transformation failure proves removal of only the owned stage. Input and derived path/length/hash inventories, unmatched metadata and independent prompt/handback rereads are checked against actual files.

Review also exposed two existing lossy transformations: ordinary assistant headings beyond the text bound disappeared, and long prefixes displaced peer wrappers and changed human-prompt counts. Public reds preceded shared heading-preserving trimming and use of the same complete-wrapper matcher. A separate postflight compares the existing reader's supported source/derived classifications, model/cost facts and finding verdicts before delivery. A reproduced consultation-finding change now refuses the trim and preserves the complete workspace. Parser/analysis defaults remain unchanged; no second protocol parser or quality evaluator was added.

The final combined focused suite passes **122 cases: 52 new CLI + 69 existing parser + 1 actual offline package**, actual exit **0**. The actual offline npm-package test resolves the installed manifest's real executable, runs report/trim from an unrelated consumer directory, uses no source overlay, retains late handback headings and checks complete returned output inventories, hashes and original bytes. Unsupported Host/maintenance flags are refused; no JSONL record is included in the tarball. The complete candidate typecheck/build and full suite remain the acceptance gate; do not substitute focused results for them. Host-library verification exits 0.

## Gate and remaining boundaries

Read all final raw outputs and actual exits, freeze the final source inventory and preserve a separate P3b-to-P4 review packet. Installer/resolution/ownership source is unchanged after P3b; its complete 317-case matrix is preserved rather than unnecessarily rerun for this utility. Any later shared lifecycle change requires a new full matrix.

Synthetic/committed sanitized fixtures are the only records used. No private record, real Host/model/provider session, paid evaluation, new R3/R4 run, repository commit/push, PR publication or merge occurred. Masking is limited; derived copies require human inspection before sharing. Physical process exit, current quota/invoice, actual factory loading/behavior and independent evaluator quality remain **unverified**. Historical ledgers and protected Plan 034/035/036 work remain separate.

The [full completion matrix](plan-033-completion-matrix.md) stays incomplete. Templates, evaluator, main-thread orchestration, remaining adapters, sync and later Host stages retain their own concrete delivery reviews; P4 does not supply those capabilities.
