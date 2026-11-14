# Plan 033 P2 candidate — 2026-10-28

Baseline/planned-at **`72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`**, branch **`codex/plan-033-claude-delivery-oct28`**, Node **24.19.0**. Explicit-repository PR recheck still returns #199–211 merged, latest #211; the open-PR query returned none and the remote dev query returned the same SHA. P1's independent 17-file packet passed its complete offline gates before P2 edits. P2's bounded offline implementation is complete and ready for review; the Claude stage and full Plan 033 remain incomplete. No commit/push, PR publication, merge or live/paid run occurred.

The [PR assessment](plan-033-pr-refresh-2026-10-28.md) records current reader/lifecycle/media changes and exact evidence inspected. The [P2 design](../plans/033-slice-4-p2-record-design.md) records executable contracts and compatibility/grant amendments before those repairs. The original [slice design](../plans/033-slice-4-claude-realize-design.md) and [ADR 0057](adr/0067-claude-factory-realization-delivery.md) remain the design baseline.

## Concrete delivery

| Edge | Exact source and installed/public seam |
| --- | --- |
| Shared pair | `registry/core/subagent-realize-for-host.core.md` and `.contract.json`; exactly definition/workflows/skills/hooks; no legacy carrier. |
| Worker | `registry/hosts/claude/agents/factory-realizer.md` → `.claude/agents/factory-realizer.md`; inherited model, medium effort, foreground. |
| Runbook | `registry/hosts/claude/skills/realize-artifact/SKILL.md` → `.claude/skills/realize-artifact/SKILL.md`; required preload, user-invocable false, no fork. Shared support origin `registry/skills/realize-artifact/`. |
| Registration | `registry/hosts/claude/agent-factory-realize.binding.json`; installed receipt `.claude/skills/realize-artifact/assets/claude-binding.json`. Required support, seven on-demand rule references, preload, guard/source and combined-plan edges fail before writes. |
| Guard | Existing `registry/hosts/claude/hooks/agents-united-guard.js` → `.claude/hooks/agents-united-guard.js`, with actual registration; no new guard kind. |
| Records | Installed `scripts/check-job.mjs --job <absolute.json>` and `scripts/check-handback.mjs --job <absolute.json> --result <absolute.json>`; strict `assets/job.schema.json` and `assets/handback.schema.json`, report guide, four references and worked example. |
| Validator | Selected checkout's `dist/cli.js factory-check --registry <absolute> --definition <stem> --host claude`, optional `--artifact`, loading and task-required preloads; `src/core/factory-check.ts`, shared types in `types.ts`, terminal I/O in `cli.ts`. |
| Public tests | `tests/factory-check.test.ts`, `tests/agent-factory-realization{,-job,-handback,-package}.test.ts`, existing native/factory lifecycle suites and full addon matrix. |

Caller invocation supplies complete fixed job/path and caller-held digest to `Agent` with `subagent_type: factory-realizer`, `run_in_background: false`, no teammate name. Inspect the actual launch result. Use `SubagentHandback` conditionally, otherwise ordinary final response; no team shutdown protocol. Actual invocation remains unverified.

Core classes are read/search/edit/shell/skill/report/handback, with class-derived tools. No delegation/messaging/provider/web/lifecycle class is added. Roots, publication and spending limits are guidance plus offline checks; the existing destructive guard is not source-path isolation and retains its documented trust/fail-open limits. The bounded validator rejects memory's implicit write grant and unreviewed deny overlays. Worker binding rejects a deny overlay too.

Jobs distinguish authoring/target Host, local/upstream intent, checkout HEAD and every actual input pin, guide citations/locked snapshots, complete immutable baseline, separate output/evidence/managed/protected roots, exact changes/checks, acceptance and constraints. Initial runnable target is one **Claude agent**; other host/artifact adapters are explicitly unavailable. Task-required preloads are distinct from permitted contract Skills.

Postflight checks actual complete inventory/hashes/lengths, complete baseline diff, untouched repair files, fixed values, preserved inputs, coverage, commands, raw log pins, classifications and budgets. A valid report still returns `acceptedDraft: false`: caller-held job comparison, independent execution and quality review remain required. Worker quality findings remain visible separately from deterministic findings; live stays unverified. The worked-case ceiling is six named offline checks/ten minutes, bounded logs, zero host/model/provider calls, zero USD/prompts. Upstream intent only prepares the entire pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base dev/sent false.

## Verification checkpoint

Read complete successful narrow outputs: **50** grant/installer cases, **23** job/hand-back cases, **43** compatibility/production cases, **298** existing native cases and the production tarball case. The package test uses the real packed registry without an overlay, installs the production worker/support, validates an original supplied pair/candidate with actual exits, checks the record, then independently revalidates final bytes. This proves offline delivery/validation, not model authoring.

Complete typecheck/build and host-library verification exited **0/0**. Earlier typecheck exit **2** was test-fixture tuple inference, corrected without weakening assertions. Activation exposed the old direct author-skill partial-bundle regression; its narrow fix preserves the old binding/ownership and installs no realizer files. Direct realization and generic partial restricted requests remain refused. This resolution/ownership change requires a fresh full addon matrix.

The first full-suite and full-matrix commands collided in their existing fixed `scratch/domain-conformance` root. Both were interrupted (tool exits **1/1**); partial failures and raw logs remain. Neither is a verification pass. No assertion, timeout or skip changed. Replacement complete tests and matrix run sequentially; their final results are pending at this checkpoint.

Ignored raw outputs/exits are under `logs/plan-033-p2-2026-10-28/`; prior P1/refresh logs and frozen packets remain intact. New files are unstaged/unpublished. No private host transcript or provider credential was fetched.

## Gate amendment after integration review

The first complete serial run exited **1**: six failed files, **4881 passed / five failed / 209 skipped**, plus one suite-import error. It exposed the stale one-Skill CLI assertion, missing original-work provenance/count updates, two test-helper assumptions about legacy carriers/model posture, and a discovery test assuming every native role held messaging. These were corrected with actual native binding/floor coverage, a model-drift counter-test, class-aware messaging checks and source metadata updates. No legacy carrier, discovery removal, assertion weakening, timeout or skip was added. All six affected files then passed **132 tests**, exit **0**.

The corrected complete suite passed **236 files / 4928 tests / 209 unchanged skips**, exit **0**, in **712.26 seconds**. Complete raw output was read. The separate full `AGENTS_CI_FULL=1` lifecycle matrix passed **317 tests / no skips**, exit **0**, in **405.53 seconds**; complete raw output was read. These records are `full-final.*` and `addon-final.*`.

Subsequent review demonstrated an actual extra-hook gap in the candidate validator: a required guard subset plus an unreviewed event was accepted. The new public test failed for that reason (exit **1**), then the adapter was tightened to exact reviewed guard registration. Custom hook registrations remain unavailable pending their own binding review. Complete typecheck/build passed (exit **0**); actual validator/package checks passed **15 tests**, exit **0**. This is an isolated validator/test change; lifecycle resolution/installation/ownership files stayed unchanged after the matrix. A final complete suite for this tightened candidate is running as `full-hardened.*`; it is not yet claimed passed.

The 60-file P2 packet is preserved in ignored `scratch/plan-033-implementation/p2-hardened-2026-10-28/`; P1's separate packet remains intact. A proposed P3 shared-contract-helper design is saved separately at `scratch/plan-033-implementation/p3-review/contract-helper-design.md`, excluded from P2 and with no implementation or ADR reservation.

## Final bounded offline result — 2026-10-28

The tightened candidate's final complete `npm test -- --maxWorkers=1` finished with actual exit **0**: **236 files / 4929 passed / 209 skipped / 5138 total**, **714.12 seconds**. Its complete raw output and exit were read from `full-hardened.raw.txt` and `full-hardened.exit`. The two Vite dynamic-import path warnings in the existing image-generation suite did not fail that suite. This supersedes the pending final-gate statement above without erasing the earlier failures or interrupted runs.

Final applicable gates are hostlib verification **0**, typecheck/build **0**, complete tests **0**, and the full addon lifecycle matrix **0** (**317 passed, no skips**). The later hook equality change touched only the candidate validator and its public test; shared resolution/installation/ownership bytes stayed unchanged after the matrix. The production extracted-package test is included in the final full suite and exercises actual offline validator exits and independently checked final hashes. No published-PR CI result is claimed for these local changes.

The final review snapshot and P1-to-P2 delta manifest live under ignored `scratch/plan-033-implementation/p2-final-review-2026-10-28/`. Runtime, registry, native prompt and test hashes are compared with the pre-gate hardened snapshot; only closeout documentation may differ. The separate P1 packet and all ignored draft/raw evidence remain preserved. Review P1 delivery machinery and P2 production content/records as separate units.

## Remaining work and unverified claims

The [full completion matrix](plan-033-completion-matrix.md) preserves the entire objective. Contract helper, Domain/Organization templates/provisioning, evaluator, main-thread orchestration/bounded repair, current #208 reader distribution, other realization adapters and host-update sync retain independent concrete delivery reviews. A worker does not supply an evaluator or coordinator.

Finish/review Claude before Codex → Antigravity → Cline. OpenCode, managed Option A installation, host-package versioning and legacy retirement remain separate. Root AGENTS.md, Plan 034 hold/baseline, unrelated Plans 035/036/037, assets/provider wiring/native grants/launchers/guards remain unchanged.

**Unverified:** actual factory/author-skill invocation, runtime preloading/worker guard execution, evaluator judgment, semantic quality/behavioral improvement, prepared with/without/control evaluation, Desktop/VS Code/global factory support, later-host factory behavior and real provider generation. Future live proof requires separately agreed maintainer account/prompt/cost limits and inspection of host records. R3's historical record and later R4/H12/media ledgers remain separate; no remainder renews spending permission.
