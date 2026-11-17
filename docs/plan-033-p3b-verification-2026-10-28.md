# Plan 033 P3b implementation checkpoint — 2026-10-28

Baseline/planned-at `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`, branch `codex/plan-033-claude-delivery-oct28`, Node 24.19.0. The maintainer confirmed the new shared-only CLI seam, then the author-contract Skill. [P3's delivery design](../plans/033-slice-4-p3-contract-design.md) and [executable record/loading design](../plans/033-slice-4-p3b-record-design.md) precede this implementation. P3a's separate frozen [offline acceptance](plan-033-p3a-verification-2026-10-28.md) remains evidence for that earlier candidate, not a current full P3b gate.

## Final offline acceptance — inspected 2026-10-29

The frozen P3b candidate is **offline complete and ready for review**. Complete build/typecheck and host-library verification exit **0/0**. The full serial suite passed **241 files / 5018 tests / 209 unchanged skips**, actual exit **0**, in **788.80 seconds**. The separate full addon lifecycle matrix passed **317 tests / no skips**, exit **0**, in **400.54 seconds**. Every raw output and actual exit was read; the 68 frozen runtime/test/catalog files stayed byte-identical through both gates. Two existing non-failing Vite file-URL warnings remain in the full log.

Authoritative raw records are `logs/plan-033-p3b-2026-10-28/{typecheck-final,hostlib-final,full,addon-full}.{raw.txt,exit}`. All earlier red/green and incorrect test-diagnostic expectations remain preserved. A new lost-notice test initially omitted a fixed value too; correcting its fixture exposed the intended notice refusal without changing implementation. The final focused four-file suite passes 65 cases. No current published-PR CI result is claimed.

Fresh origin/dev and explicit-repository PR states were rechecked on 2026-10-29: dev remains `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`, #199–211 are merged and no open PR was returned. Root AGENTS.md, existing native/provider/media/launcher assets and unrelated plans remain outside this slice.

The separate 84-file cumulative P3b review packet is `scratch/plan-033-implementation/p3b-final-review-2026-10-29/`, with source inventory, P3a-to-P3b delta and raw-evidence hashes. P1/P2/P3a snapshots remain intact. The subsequent P4 reader design and confirmed public seam have a separate design packet; no P4 implementation is included in P3b acceptance.

Live Claude loading/invocation, the prepared same-prompt pair/control, evaluator judgment and behavioral improvement remain **unverified**. This offline acceptance does not complete the Claude stage or authorize another Host, paid run, repository commit/push, PR publication or merge. The following sections retain earlier checkpoints and are superseded by this dated acceptance where they say gates remain pending.

**Earlier checkpoint, 2026-10-28: local implementation candidate; complete gates pending.** The shared/native entries, standalone helper and executable schema, exact loading/support/rule binding, contributor registration and provenance now exist. Source-only Skill authoring is separate from the target native realization. Public seams are `tests/author-contract.test.ts`, `tests/agent-factory-contract-loading.test.ts`, `tests/agent-factory-contract-lifecycle.test.ts` and `tests/agent-factory-contract-package.test.ts`. A new real offline tarball/install test executes the shipped helper and independent packaged validator outside the checkout. No current full-tree acceptance is claimed yet.

## Current delivery checkpoint

The closed binding retains the built-in foreground `general-purpose` fork and all nine support files, seven on-demand rules and owned receipt. Missing declarations/resources, linked or shadowed inputs, loader drift, unexpected planned support, non-owning requests and plugin lanes fail before writes. All **23** loading cases pass, actual exit **0**. The old author-skill binding and direct route remain intact.

Production lifecycle evidence exposed two preservation gaps: a late unmanaged support collision wrote earlier files before refusal, and a missing realizer receipt let removal delete earlier files before refusing an edited contract reference. Whole-workspace inventories made both failures visible. Complete preflight of the task closure and activation through either factory receipt correct those failures without a second installer/removal engine. **21** focused current/previous factory lifecycle cases pass, exit **0**. Update restores a missing bound reference and refuses edited support until explicit force; implicit-store symlink requests copy this task and exclude maintainer evals.

The production package test has no source-registry or fixture-loader overlay. It installs the actual registered Bundle, pins its full native closure, executes the installed helper for create and bounded update, reconstructs actual returned paths/lengths/hashes/diffs, preserves companion/unrelated-note bytes and runs the packaged `contract-check` on both final pairs with actual exits **0**. This is offline deterministic evidence; no Claude invocation occurs.

Catalog source now holds **207 Skills: 137 domain, 70 workflow**. The additional original MIT Skill belongs only to `agent-factory`; `full` remains 204 end-user Skills and excludes all three contributor Skills. Source layout/licence/portability/frozen-corpus checks passed in the focused source gate. Prepared with/without-skill prompts and an unrelated control remain **not run**.

The evidence below preserves earlier checkpoints. Their counts are historical increments, not substitutes for the pending complete gate.

## Evidence inspected

Complete raw outputs/actual exits are preserved under ignored `logs/plan-033-p3b-2026-10-28/`:

- Missing copied helper: actual red **1**, then create green **1 test / exit 0**. Caller runs the real selected `contract-check` on the written pair; the writer reports validation unverified.
- Exact reuse: mode red **1**, then **2 tests / exit 0**; CRLF core notes and noncanonical JSON bytes preserved exactly.
- Scoped update: mode red **1**, then **3 tests / exit 0**; complete immutable baseline, unchanged companion/unrelated note and protected fragments checked, followed by actual caller validation.
- Upstream preparation: intent red **1**, then **4 tests / exit 0**; entire existing artifact-contribution template, base dev/sent false, actual checkout HEAD unchanged and no output Git repository.
- Protected evidence root: actual red exposed preparation with an unusable protected destination; minimal guard fixes both mutable roots, **18 tests / exit 0**.
- Optional binding findings: actual missing-result red **1**, then **19 tests / exit 0**. Explicit required/optional choices stay outside the four-field contract. Checked source pins do not claim loading or execution.
- Expanded helper conformance: **29 tests / exit 0**. Unknown keys, background/spending/budget, changed/missing validator/HEAD, copied-schema counter-mutation, safe scalar serialization and stale/incomplete/altered/linked/out-of-scope repair refusal preserve actual draft bytes.
- Missing adaptation record: actual red accepted adapted provenance without required upstream evidence; guard then **30 tests / exit 0**. Supported source/licence/comparison and retained-notice handling is the next test-first increment; legal/originality review remains pending.

The helper reads pinned files and uses only a fixed read-only Git HEAD command. It executes no job/result command, validator, Host, model, provider, install or publication operation. Caller validation is an independent actual process in the tests. Digest/inventory/diff/protected-note and binding findings remain separate from quality/live proof; `acceptedDraft` remains false.

## Remaining P3b gates at this checkpoint

Read the expanded complete focused result, then freeze and run complete hostlib/typecheck/full tests and the full addon matrix for changed projection/ownership paths, sequentially. Read full raw outputs and actual exits. Update the final review packet only after the candidate's evidence is complete. No P3b full-gate or current published-PR CI pass is claimed at this checkpoint.

The [full completion matrix](plan-033-completion-matrix.md) remains incomplete. No live/paid Host/model/provider session, private transcript read, repository commit/push, PR publication or merge occurred. Factory loading/invocation, evaluator judgment, behavior/evals and later Host support remain **unverified**; historical R3/R4/H12 and media ledgers stay separate.
