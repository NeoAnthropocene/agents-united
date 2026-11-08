# Plan 046: Post-pilot Motion follow-up in bounded slices

Goal: execute [Plan 044's next actions](044-motion-technique-library-and-hands-on.md#next-action-plan-ordered-by-evidence) after PR #214, preserving the accepted demos and separating local technical proof from maintainer-run Host proof. Done when the implementation slices have actual test/artifact evidence and the two revised live scenarios have been inspected from maintainer-supplied records. No agent starts a Claude session or paid provider job.

## Starting point and budget

On 2026-11-04 the maintainer confirmed #214 merged and authorized a fresh branch plus sliced execution. Fetched `origin/dev` at `0b9a3829d6315fc54efdd76cce2de2ddd47f6361`; #213 and #214 are merged and there are no open PRs. Created `codex/motion-follow-up-slices` from that clean commit. This request authorizes implementation; commit/push is a separate maintainer action under the session-start rules.

Three bounded investigations use GPT-6.1 Terra, medium effort: Native seek/contrast, audio handoff/seam, and 3D placement. Root owns integration, upstream-only distribution and the live-test handoff. Machine-local account headroom and credit readings are kept in the ignored spending checkpoint. Read the usage tool between slices; stop with headroom before included allowance exhaustion, without reset credits or workspace-credit continuation. No spending ceiling for Host/provider jobs is implied.

## Slices and evidence gates

| Slice | Deliverable | Gate / remaining owner |
|---|---|---|
| S1 — revised workflow pilot | Disposable cold Remotion setup and locked-539/no-install revision handoff for `remotion-production` evals 5/6; explicit initial inventories and hashes. | Local preparation can be checked here. Maintainer starts each Claude sitting and supplies IDs; actual installation, Skill invocation, delegation and Element decisions remain **unverified** until record inspection. |
| S2 — Native determinism | Isolated reproduction of title seeks/frame337 and applicable frame404 text contrast; source fix and before/after evidence if reproduced. | Identical-frame comparisons across forward/shuffled/repeated seeks. Preserve accepted demo; actual viewed proof and font-size threshold distinguish measurement from acceptance. |
| S3 — Sound handoff | Reproduce canonical binding gaps; fix with regression tests; fixed-window loop seam diagnostic. | Changed canonical timeline cannot silently produce a newly stamped handoff. Threshold crossing, waveform seam and perceived playback remain separate; listening needs a reviewer. |
| S4 — upstream-only official Skills | Remove unresolved vendored snapshot and its catalog/recommendation; keep original Remotion production and direct upstream/plugin guidance. | Catalog/install boundary and actual npm-pack inspection show no redistributed official Skills. Existing managed installations need a safe manual migration; no automatic overwrite or legal entitlement claim. |
| S5 — 3D Phase A | Fixture-based Bundle/native-role/shared-dependency lifecycle decision and supported GLB/viewer/PNG boundary. | Actual install/update/conflict/removal evidence and named prerequisite limitations. [Plan 045](045-agency-3d-designer.md) remains the source for later phases; Arda/production Skills/runtime/provider/AR implementation is separate. |

S2/S3/S5 proceed independently while S1 awaits the maintainer. S4 resolves the distribution risk by removing the copied material rather than inferring permission from the runtime licence. Keep one reviewed PR per implementation slice when publishing is requested; do not mix a future 3D production rollout into a Motion fix.

## Verification and completion boundaries

Observe RED before GREEN for behavior fixes. Retain exact commands/exits and focused logs in ignored `scratch/verification/`; write concise durable evidence here and in the linked reports. Before a requested push: `npm run typecheck` then `npm test`, inspect actual exits, all-state branch PR status, staged diff and secrets. Passing tests do not prove Host compliance, entitlement or human playback acceptance.

## Dated log

### 2026-11-04 — opened fresh post-merge work

Read current rules, plans, ADRs and catalog/test prior art. Verified merged remote state before branching. Delegated three bounded Terra/medium tasks. S1 and maintainer playback remain pending; no Host/provider session started. Initial distribution regression specifies removal before changing the catalog. Results will be appended only after actual execution.


### 2026-11-04 — local slice results before the full gate

- S1: both disposable projects exist; the locked copy's 98 inventoried source files match source/copy baselines. Both original/copy project-local CLI version checks exit 0 at 4.0.539, and the absolute-path evaluation preflight exits 0 without rendering or entitlement claims. See [the maintainer handoff](../docs/skill-quality/2026-11-04-remotion-readiness-handoff.md). Final managed-file refresh is checked separately; live evals 5/6 have not run.
- S2: [Native review](../docs/skill-quality/2026-11-04-native-seek-review.md) reproduces identical repeated/shuffled captures in Chrome 156.0.8078.80 after readiness. The older discrepancy remains unexplained; differences against retained exports cannot establish seek-order dependence. The title qualifies for 3:1 large-text contrast, and a clipped line's rectangle is not visible-glyph proof. No scene change is justified by this bounded evidence.
- S3: [Sound review](../docs/skill-quality/2026-11-04-audio-handoff-review.md) closes a general mixer input-binding gap with required canonical fingerprint and 19/19 focused Node cases. It does not prove the historical Native deviation's cause. The Remotion bed has a 14.96/14.20 dB first-versus-last 100 ms RMS difference but zero endpoint sample step; musical continuity, listening and perceived sync remain unverified.
- S4: the two removal-boundary cases failed before removing the snapshot; the changed catalog then passed four files/56 tests, followed by the combined affected run (10 files/485 tests). The retired-Bundle path initially could not remove exact recorded ownership and could substring-match unrelated paths; new regressions cover safe retired removal, sharing, dry run and edited files/projections. Review additionally caught a managed marker masking body edits; the recorded hash now protects that retired path. Final combined retired/placement run passed 12/12.
- S5: [ADR 0062](../docs/adr/0062-agency-3d-designer.md) accepts a self-contained optional Bundle without parent inheritance or an implicit agency prerequisite. Synthetic placement proves resource shipping and coexistence with an explicitly updated Chris; direct Host/alias invocation and real 3D output remain unverified. [Plan 045](045-agency-3d-designer.md) records the smallest Phase B package next.

The actual local npm archive contains 1026 entries, zero removed official-Skill paths and the original production Skill. SHA256: d10d838e7a3e530691f5724cfb2f382c2de80b09cee472d1d1efb6aab3222aab. Local evidence: scratch/verification/followup-pack-proof.json. The pack command itself exited 0; its first PowerShell metadata parser was invalidated by npm's update notice appended to the combined log. The corrected check read the actual archive entries and wrote the proof JSON; the parser's misleading zero count is not used as evidence. No package was published.

Fresh integrated typecheck/build exited 0. The full npm test process is running on the frozen implementation; aggregate and skipped checks remain pending until its actual exit. The 21 changed Markdown documents checked so far have no broken local links. No commit/push or paid Host/provider session was made.


Both disposable managed agency installations were refreshed from the frozen source (actual CLI exits 0). Their installed audio finishing metadata is 1.1.0, Remotion production metadata is 1.2.0, and both official-Skills guides exactly match source. Rechecking all 98 locked-project baseline hashes after refresh found no changed source/audio/package/lock files.


### 2026-11-05 — provenance correction and fresh gate

The first full run exposed a missed integration inventory: host-library/_upstream/skills.json still held the twelve retired official Skills. Removed exactly those records, retaining 205 current catalog records; the existing one-record-per-Skill assertion was unchanged. Its focused 19-test suite passed (exit 0). Before stopping the already-failed run, two further timeout failures appeared in audio-system-probe and the catalog-wide eval-folder check. Direct reruns at the original 30-second limits passed (audio: 1 test in 3.12 seconds; eval-folder/provenance: 29 tests, including the catalog case in 7.03 seconds). This does not prove the timeout causes.

Stopped only verified Vitest root PID33864 (matching command and creation time) and its four descendants; the interrupted full command exited -1 and has no completed aggregate. Its log is scratch/verification/followup-final-full-test.log. The new gate uses one worker to reduce concurrent filesystem load, without changing assertions or timeouts. Fresh typecheck/full-suite results will be recorded from the new command's actual exits. No user preview or Host process was stopped.


### 2026-11-05 — measured 3D fixture budget and recoverable final gate

The second full run reported a new-test timeout, not a lifecycle assertion failure: the real agency install/addon install/removal case exceeded its explicit 30-second budget (31.14 seconds), followed by ENOTEMPTY when cleanup raced the unfinished operation. The separate full-install case already used 60 seconds. Set the same bounded 60-second budget for this case, retaining every assertion. The final focused placement/retired suite passed 12/12 (exit 0), including the removal case in 36.55 seconds and independent-role case in 33.13 seconds. This is a Windows fixture time budget, not a product performance guarantee.

Stopped only verified single-worker Vitest PID18336 and its two descendants after confirming command and creation time. That interrupted command exited -1 with no completed aggregate; retain followup-final-full-test-2.log. No full-suite pass is claimed for either interrupted run.

The final gate runs via ignored scratch/verification/followup-run-final-gate.ps1 and writes actual typecheck/test exits plus process ID/timestamps to scratch/verification/followup-gate-status.json. Logs: followup-final-typecheck-3.log and followup-final-full-test-3.log. Its execution uses local CPU and starts no model, Host or provider. If model work stops at the included-allowance boundary, let this existing local run finish; on resume inspect this exact status and process before deciding whether a restart is needed. A running record alone is not proof of liveness. Final full-suite completion remains unverified until the terminal status and aggregate are inspected.


### Current checkpoint — 2026-11-05

Branch remains codex/motion-follow-up-slices at base 0b9a382 with local uncommitted changes; no commit, push, PR, real Host session or paid media-provider job was started. Whitespace check exited 0. Final gate: unified exec session 60810, PowerShell PID 15576, started 2026-11-05T00:10:15.9709667Z; inspect followup-gate-status.json and the actual process rather than infer completion from a stale running field. At checkpoint the recorded state was running, typecheckExit 0, testExit null. Overall full-suite completion remains unverified.

Machine-local account telemetry is retained only in the ignored spending checkpoint, separately from session costs. Continue only within included allowance and stop before workspace-credit continuation. All three Terra/medium workers are finished. The two maintainer-run session IDs remain requested and no revised live compliance claim is made. On continuation, inspect this existing gate before launching anything; do not restart a live run solely because an observation expired.


### Included-allowance cutoff — 2026-11-05

The included allowance approached its limit at this checkpoint. Stop model monitoring with a small safety reserve under the maintainer's explicit no-workspace-credits instruction; request the goal pause rather than claim completion. Exact account readings and reset times are retained privately. No reset credit was used.

Existing local gate session 60810 remains live, with durable runner PID 15576 and state running, typecheckExit 0, testExit null. Its local CPU work may finish without model calls. On resume read scratch/verification/followup-gate-status.json and the aggregate of followup-final-full-test-3.log, compare current source before accepting that result, and never restart merely because this checkpoint says running. No full-suite pass has yet been verified.

Preserve the local branch and both prepared test projects; no commit, push or PR was made. Complete the gate audit, then inspect maintainer-supplied eval 5/eval 6 Host records when available. Revised live orchestration and human listening/creative acceptance remain unverified. The pending user question requests both session IDs through the readiness handoff. Phase B 3D production is a later slice, not delivered here.


### 2026-11-05 — completed prior gate and maintainer eval 5/eval 6 audit

The durable gate finished: typecheckExit 0 and testExit 0, ending 2026-11-05T01:10:59.7101434Z. Actual aggregate: 239 files passed, 4,886 tests passed, 209 skipped (5,095 total), 3548.16 seconds. This is the final pre-audit tree, not coverage of the new FFmpeg/policy corrections below. Compared with the previous log with 4,888 passes, the removed official addon eliminates six addon-specific tests and twelve per-Skill Antigravity catalog cases; sixteen new tests account for the net minus two. No assertion was dropped to make this gate green.

The maintainer supplied actual eval 5/eval 6 IDs; the [handoff amendment](../docs/skill-quality/2026-11-04-remotion-readiness-handoff.md#maintainer-readiness-sittings--2026-11-05-audit) links both saved-record reports. Two Terra/medium auditors inspected records/artifacts and a third handled the concrete FFmpeg defect with RED/GREEN and actual offline npm. No executor-started Host or media-provider job was used.

S1 now has real evidence of delegated production and upstream Skill loading in the cold case, plus version/lock/source preservation in the locked case; complete readiness still fails its catalog/containment criteria. The FFmpeg fix supports an empty project safely instead of merely refusing it, preserves malformed/linked manifests, prevents ancestor npm selection with explicit prefix/global/workspace controls, invokes npm via Node without a shell and checks binary confinement. The permanent offline regression includes an ancestor workspace, existing child file, path metacharacters and a global-config override. Linked Skill CLI and npm executable symlink regressions also passed. Actual FFmpeg download and revised live orchestration remain unverified.

Readiness policy adds traceable catalog consultation, handback reading, router-reference follow-through and safe handling of unexpected out-of-project writes. Code review caught replacement of the original fourteen readiness guards in an intermediate agent edit; they were restored verbatim and the two new guards appended. The full focused policy run passes all 16, with 21 across related readiness/guidance files.

Eval6 did not introduce the reported decoded-audio difference: both compared exports and the measurement JSON are byte-identical. Preserve the current master and cue timing; Sound must validate targets and perceived events before any owner-approved change. Human listening/creative acceptance and a complete craft-gate record remain unverified. The two new recorded session costs total $11.9319 USD notional, not a bill.

The earlier budget pause remains a historical checkpoint; the account window reset before this new user reply. Current implementation changes require a fresh gate, recorded below after execution. No commit or push is authorized by these audit results.


The current FFmpeg focused runtime suite passes 34 Node tests (0 skips), including the permanent offline npm fixture and installed Skill junction/PATH npm-symlink cases. The helper is now audiovisual-review 1.1.0; readiness guidance is remotion-production 1.3.0. The eval 6 stereo decode also matches exactly (SHA256 cd2d10716461b09ed354990baaf190fe6714e30fcfd634a7905315c8e90511e8), while perceptual sync and encoded AAC packet identity remain unverified. Source was frozen before the integrated checks; only evidence documents are being amended.


### Post-audit verification in progress — 2026-11-05

The corrected implementation passed fresh typecheck/build (actual exit 0), then the affected seven-file run passed 509 tests (exit 0), including all 16 readiness guards, native role/floor/anatomy checks, and the FFmpeg wrapper. Its nested runtime suite separately passed 34 tests with 0 skips. All original fourteen readiness guards were retained; the new policy adds two. No actual FFmpeg download or new live Host behavior is claimed.

Full-suite session 23336 now runs npm test with two workers, writing eval56-gate-status.json plus eval56-full-test.log under scratch/verification. It snapshots the watched changed/new source paths before and after; acceptance requires testExit 0 and watchedSourceUnchanged true. The earlier 239-file green gate remains historical pre-audit evidence. Do not infer a new full pass until this terminal record and aggregate have been inspected.


The first post-audit full run completed with actual exit 1: 238 files passed and one failed; 4,887 tests passed, one failed and 209 skipped (5097 total), in 1280.00 seconds. Watched source remained unchanged. The sole failure was the FFmpeg Vitest wrapper exceeding its 30-second budget (51.35 seconds) while running the expanded 34-case child suite. This is not a new full-suite pass, and the child timing/cause is being checked before changing its integration budget. The preceding typecheck and 509-test focused run remain valid scoped evidence.


The wrapper timeout did not reproduce directly: all 34 then 35 child cases passed, the earlier direct suite taking 2.74 seconds with offline npm 1.75 seconds. Cause remains unverified. The permanent offline npm case now explicitly disables update notifications and bounds npm to 90 seconds; the asynchronous wrapper bounds its child to 120 seconds and the enclosing test to 150 seconds. Every assertion remains; no new case is skipped in the focused run. Automatically discovered npm entrypoints are validated as real regular npm-cli.js files, including a regression against another package manager in npm_execpath.

Final gate 2 records actual typecheck/test exits and watched source stability in scratch/verification/eval56-gate-status-2.json. Logs are eval56-typecheck-2.log and eval56-full-test-2.log; the existing failed run is retained separately. Source is frozen for this run.


### Final post-audit validation — 2026-11-05

Fresh typecheck/build exited 0, followed by the complete npm test run with actual exit 0: 239 files passed; 4,888 tests passed, 209 skipped, 5,097 total; 1452.66 seconds. The final gate records watchedSourceUnchanged true across the run. Skipped cases remain unverified. The focused affected run separately passed 509 tests across seven files; FFmpeg runtime tests passed 35 with 0 skips. No assertion was removed; the expanded subprocess integration has explicit bounded deadlines. The earlier one-failure full run remains recorded separately and is not presented as passing.

Authoritative local evidence: scratch/verification/eval56-gate-status-2.json, eval56-typecheck-2.log, eval56-full-test-2.log, eval56-source-before-2.json and eval56-source-after-2.json. This proves the checked source/test state, not a real FFmpeg download, patched Host compliance, listening or creative acceptance. The supplied completed projects were left intact. Tracked root package files have no current diff; preexisting ignored dependency residue is not guessed at or deleted.

Next bounded work: a readiness-only maintainer observation can verify catalog/tool receipts and safe setup without another film/audio generation. Sound QC should review the five baseline cue targets and listen before proposing a timing/master change. The source and reports remain local on codex/motion-follow-up-slices; no commit, push or PR was made.


Account telemetry for this audit turn is retained privately. No executor-started Host session or paid media-provider job was run. Tracked package manifests/lockfile and whitespace checks both have actual exit 0; unknown ignored residue remains untouched.

### Prepared follow-up and allowance cutoff — 2026-11-05

The final offline local pack command exited 0. Inspection of the actual archive found 1,026 entries, zero retired official-Skill files, and an FFmpeg helper matching current source. Archive SHA256: f9075121f5b605df4f979aa5217f9bfedf5e3757eb147772a9945e9d5e9db274. Evidence: scratch/verification/eval56-pack-proof.json. No package was published.

The [post-fix handoff](../docs/skill-quality/2026-11-05-postfix-review-handoff.md) records a new readiness-only project with the patched Skills and a five-cue listening packet for the existing exports. Preparation started no Host or provider session. The corrected install command's terminal exit was not captured; installed metadata and the healthy doctor log are observed, while that command exit and live workflow remain unverified. Prior completed eval projects were preserved.

Model work paused with a reserve under the maintainer's explicit no-workspace-credits instruction; exact account readings and reset times are retained privately. No reset credit was used. Final full validation remains the recorded gate-2 pass above; no source code changed afterward. Changes remain local and uncommitted. On continuation, audit any maintainer-supplied post-fix session and listening results; do not restart a Host or rerun the green suite merely to monitor. Actual FFmpeg download, patched live readiness, listening/creative acceptance and later 3D production remain unverified.


### Maintainer post-fix results and next proposal — 2026-11-05

The maintainer supplied session `1134a73c-72ee-45e1-9ba7-d373c55b3b7e` and the orchestrator's lessons guide. Three Terra/medium agents audited records and investigated workflow/helper prior art. [The saved-record audit](../docs/skill-quality/2026-11-05-postfix-session-audit.md) records successful project-local FFmpeg setup and render/mux receipts, scoped proof approval, an absent full-map acceptance record, and a corrected false listening claim. Final mux-sync exit 0 is limited to supplied measurements; craft exit 2, listening and unresolved terms remain separate. Current sentinel hashes match the ancestor package baseline.

[Plan 047](047-motion-production-efficiency.md) proposes the next improvements, starting with proactive treatment and traceable user acceptance, then proportionate rights/asset documentation, and bounded technical slices. No production source was changed for this review; the completed project and its local helper patches were preserved. This documentation-only follow-up does not rerun or broaden the earlier gate-2 full-suite pass. No commit, push, Host session or paid media-provider job was made.


### Completion audit of local next-plan work — 2026-11-05

| Requirement | Authoritative evidence and scope |
| --- | --- |
| Fresh dev branch | Git reflog records codex/motion-follow-up-slices created from origin/dev at 0b9a382; HEAD and the recorded origin/dev ref remain that commit. Changes are local and uncommitted. |
| S1 maintainer workflow pilot | Eval 5, eval 6 and post-fix saved-record audits identify actual setup, Skill, delegation, version and Elements evidence, plus observed failures. The completed projects were preserved. Newly revised prompt compliance remains unverified live. |
| S2 Native determinism | Native seek report records repeated/shuffled comparisons and applicable contrast scope; the historical discrepancy did not reproduce. No unjustified scene edit was made. |
| S3 Sound binding and seam review | Canonical mixer binding and regression cases, decoded-audio comparisons and fixed-window seam diagnostics are recorded. They do not establish perceived sync or listening; no unsupported automatic retiming was made. |
| S4 upstream-only official Skills | Twelve snapshots/catalog recommendations removed, safe recorded-owner retirement implemented; final actual archive has zero retired paths. Original MIT production/technique material is retained. |
| S5 3D Phase A | ADR 0062, placement fixtures and Plan 045 record the optional self-contained Bundle decision and lifecycle evidence. Arda and 3D production remain later phases. |
| Lessons-driven implementation | Plan 047 records seven bounded workflow/helper slices, three Terra/medium workers, current 541 default retaining 539/540, actual SDK previews, installed helper checks and corrected Cline projection support. |
| Required local gate | Fresh typecheck 0; full suite 0, 243 files / 4,905 passes / 209 skips, unchanged watched source. Evidence is plan047-verified-* in scratch/verification. |
| Distribution | Final local archive: 1,036 entries, no retired official Skill files; twelve checked resources match source, including corrected workflow entrypoint. No publication. |

All required local implementation and evidence-audit work for these slices is
delivered. The human-review and future Host observations above remain plainly
unverified; this is not full-film creative acceptance or a 3D production claim.
The listening follow-up is optional feedback, not a new paid sitting. No commit
or push was authorized for this follow-up branch, and none was made.

Subsequent human feedback on 2026-11-05 explicitly accepts the post-fix
prototype's voice-over, music/SFX balance and perceived sync for prototype use.
See the [listening amendment](../docs/skill-quality/2026-11-05-postfix-session-audit.md#subsequent-human-listening-feedback--2026-11-05).
It does not extend to the separate baseline/eval films, commercial rights or
broader visual acceptance. Prior unverified entries describe their earlier
evidence boundary; no media or implementation source changed.


### 2026-11-07 — account-detail privacy amendment

Removed the exact account headroom and credit balance from this public planning note; the original checkpoint is retained privately under ignored scratch. Technical gates, spending restrictions and recorded session evidence are unchanged.
