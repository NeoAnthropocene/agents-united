# Plan 033 P3a shared-only validator — 2026-10-28

Baseline/planned-at `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`, branch `codex/plan-033-claude-delivery-oct28`, Node 24.19.0. The current remote dev query returned that SHA and no open PR. The maintainer confirmed `agents contract-check --registry <absolute-path> --definition <stem>`, tested through `tests/contract-check.test.ts`, then the separate author-contract Skill. [The concrete P3 design](../plans/033-slice-4-p3-contract-design.md) precedes implementation. P1/P2 and the earlier P3 design review snapshots remain preserved.

## Delivery and limits

`src/core/shared-pair.ts` reuses `loadSemanticCore` and strict `validateSubagentContract`, with central `SharedPairCheckInput/Result` types in `src/core/types.ts` and command/output/exit handling in `src/cli.ts`. The selected registry needs only `core/<stem>.core.md` and `<stem>.contract.json`; no native profile/tool policy is manufactured. The existing registry-wide core parser remains fail-fast. It does not silently tighten historical core extensions or turn permitted affordance identifiers into required preloads.

The command returns actual pair paths/SHA-256 hashes, `valid`, deterministic findings, `delivery: unverified`, `quality: pending`, `live: unverified`. It is a shared-schema check, not a loading, installation, semantic-quality or live proof. Unknown but syntactically valid permitted affordances remain valid shared declarations; their source/required native bindings are the subsequent authoring task's responsibility. A valid pair therefore retains unverified delivery.

Preflight requires an absolute root, semantic stem, no traversal aliases and ordinary source files/directories without linked ancestors. It also checks every other core path that the whole-registry loader will read. Inputs are read, never written. This is helper preflight, not general filesystem isolation or protection against concurrent user changes; the caller retains fixed input pins and independently validates the final bytes.

P3a adds no Skill, role, workflow, hook, catalog registration or installation/resolution/ownership change. P2's native adapter is not refactored. A new full lifecycle matrix is not required by this change's scope; P2's separately recorded 317-case result stays dated evidence for its unchanged delivery machinery.

## Actual red/green evidence

Ignored complete raw outputs and actual exits are preserved under `logs/plan-033-p3a-2026-10-28/`:

| Check | Actual result |
| --- | --- |
| Missing public command | `cli-red`: exit **1**; absent JSON result. Minimal shared-only implementation then `cli-green`: **1 passed**, exit **0**. |
| Companion names another valid core | `mismatch-red`: exit **1**, exposed false validity. Exact match check then `mismatch-green`: **2 passed**, exit **0**. |
| Absolute selector/semantic identifier | Initial `selector-red` was a test-harness duplicate-option error, retained but not counted as the intended red. Corrected harness `selector-red-2`: exit **1**, actual relative source accepted. Input checks then `selector-green`: **3 passed**, exit **0**. |
| Linked selected registry | `link-red`: exit **1**, followed a real junction. Path preflight then `link-green`: **4 passed**, exit **0**. |
| Linked unrelated core read by loader | `scope-link-red`: exit **1**, followed a real file link. Full loader-input preflight then `scope-link-green`: **5 passed**, exit **0**. |
| Registry traversal alias | `alias-red`: exit **1**, accepted the alias. Lexical refusal then `alias-green`: **6 passed**, exit **0**. |
| Existing validator and path conformance | **22 passed**, exit **0**: malformed/missing inputs, strict four-field keys/arrays/identifiers, actual YAML/safety/purity/capability validation, linked pair/core directory/ancestor, registry-wide source failure, honest optional affordances and historical core compatibility. |
| Real offline-installed npm distribution | `package-conformance`: **23 passed**, exit **0**. No registry overlay: installed compiled CLI validates supplied two-file bytes outside the checkout and preserves them, without native inputs. |
| Host-library verification | Actual exit **0**; complete raw output read. No lock/snapshot changes. |
| Complete typecheck/build | Initial exit **2** was the test helper's filename overload (`string` versus `Buffer`); explicit UTF-8 encoding corrected it. Final exit **0**, complete raw output read. |

The focused tests exercise the public CLI with actual filesystem bytes and process exits, rather than mocking the validators. Read-only cases compare the complete temporary input inventory and hashes. Production package checks use `npm pack/install --offline --ignore-scripts`, declared runtime dependencies and a two-file selected registry absent from the package's own registry. This proves distribution of the deterministic command, not model authoring or Host behavior.

## Complete gate checkpoint

The current candidate is frozen before the full test run under ignored `scratch/plan-033-implementation/p3a-frozen-2026-10-28/`. Full-suite completion is pending until the actual process finishes and complete raw output/exit are read. No passing P2 count is substituted for the new candidate's gate.

**Final gate amendment:** the frozen candidate's complete suite finished with actual exit **0**: **237 files / 4952 passed / 209 skipped / 5161 total**, **750.77 seconds**. All **757 raw lines** and `full.exit` were read. The two existing Vite dynamic-import path warnings did not fail their image-generation suite. No assertion, timeout, skip or test discovery rule changed. Complete typecheck/build and hostlib verification also exited **0** as recorded above. The pending statement remains the earlier checkpoint.

The final P3a review packet is preserved at `scratch/plan-033-implementation/p3a-final-review-2026-10-28/`, with a delta against P2 and raw-evidence hashes/actual exits. All tested runtime/registry/native prompt/test files match the pre-gate freeze. P3b's subsequently prepared record/loading design is kept outside that implementation packet; no P3b source code was present in this gate. Its [design](../plans/033-slice-4-p3b-record-design.md) is the next independent implementation unit under the confirmed sequence.

The [completion matrix](plan-033-completion-matrix.md) retains the entire Plan 033 objective. P3b's contributor Skill/loading/helper is next under the confirmed sequence; evaluator/templates/current reader distribution/orchestration/sync and other realization adapters remain separate requirements. Claude stage and full Plan 033 are incomplete. Factory/author-Skill invocation, runtime loading/guard behavior, evaluator judgment, semantic improvement/evals and later Host support remain **unverified**. No live host/model/provider call, private transcript access, paid evaluation, commit/push, PR publication or merge occurred.
