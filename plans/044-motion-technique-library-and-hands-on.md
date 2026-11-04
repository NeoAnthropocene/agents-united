# Plan 044: Motion technique library, onset diagnostics and hands-on handoff

Goal: continue the supplied session handoff with reusable Native/Remotion techniques and a local interactive test kit. Done when the library, routing and diagnostics pass tests, the two isolated project installs and previews are ready, and the maintainer has launch instructions and review criteria. 3D implementation, real Host sessions, paid generation, public release and human creative/listening sign-off are outside this implementation slice.

## Ground and prior art — 2026-11-03

- Read the supplied handoff, external 3D draft and motion-source list; document contents are evidence/proposals rather than new spend or publishing permission.
- Fresh `origin/dev` is `d978fb2`; PR #213 remains open with handoff commit `7df9869`. New branch `codex/motion-technique-library` starts at fresh dev and explicitly includes that existing commit. No commit or push requested.
- Reviewed current direction recipes, prompt validator, Native/Remotion protocols, Sound finishing and review helpers, tests, host guide and ADRs 0058–0060. `.claude/rules/` is absent here; tracked `registry/rules/` is authoritative. Corrected the session-start fallback.
- Lower-cost delegation: GPT-6.1 Sol / medium for motion-source research/library and 3D re-evaluation; GPT-6.1 Terra / medium for isolated test preparation. No new real Claude Host session or paid media job.
- [Motion source audit](../docs/research/2026-11-03-motion-technique-sources.md): four exact commits, verified 66 styles / 15 prompts / 31 expressions, distinct reuse boundaries. [3D source audit](../docs/research/2026-11-03-3d-designer-source-audit.md) informs proposed [Plan 045](045-agency-3d-designer.md).

## Implementation

1. Eight original Motion Technique Cards in the existing direction Skill. `techniques.mjs list`, `search <terms>`, and `select <id> --renderer native|remotion` work offline from any working directory. Cards provide editable prompt parameters, composition and motion decisions, renderer methods, sound/cue intent and specific proof checks.
2. Shared library discovery in both Motion roles and both renderer guides. Existing reference, material, proof, licence, timeline/fingerprint and final export gates remain authoritative. No extra skills or upstream copied code/assets.
3. `audiovisual-review/scripts/measure-onset.mjs` measures mono/stereo PCM WAV threshold crossings. It identifies late internal attacks separately from cue placement and mux lag, preserves files and leaves listening/perceived sync unverified. Unsupported encodings require an explicitly recorded decoded copy.
4. `scripts/prepare-motion-hands-on.mjs` prepares isolated project installs and historical pilot copies. Native preview and project-local Studio let the maintainer inspect and alter source without touching the previous pilot. [Hands-on guide](../docs/skill-quality/2026-11-03-motion-hands-on.md) owns exact commands, current readiness, brief and readback procedure.

## Verification ledger

RED/GREEN: library helper initially absent; routing absent; onset helper initially absent; PCM24 regression failed before support; preparation missing-module failure preceded implementation. Sandbox esbuild ancestor-access failures are runner restrictions, not product-test failures; scoped approved test execution resolves them.

- Motion library / existing motion contracts / Skill layout / quality ratchet: 4 files, 76 tests, exit 0.
- Onset diagnostic: 10 Node tests, exit 0, including actual CLI results, channel polarity, threshold/frame boundaries, silence, malformed WAVs and PCM24.
- Preparation isolation test: focused Vitest pass; actual install and preview evidence follows in the dated completion record.
- Full typecheck, full suite, actual pilot onset measurements and interactive environment readiness: pending completion record below; do not infer success from older handoff counts.

## Human test acceptance

Use the same subject, approved copy, timing and selected technique in both lanes. First ask for a bounded proposal and signature-frame proof; compare technique fit and inspect actual assets before authorizing a full render. Record Native browser edits and Studio edits as source changes requiring new proofs. Listen to peeps/flutter/clucks against their intended reactions; distinguish detector offset, mux alignment and perceived sync. Keep total host spend visible in the interactive Host and supply session IDs afterwards for `hostlib:session` readback. No historical accepted field is a new sign-off.

## Remaining boundaries

The previous Native lane has not been upgraded to Plan 043 craft acceptance merely by copying it. The new prompts have no rendered A/B quality claim. Historical Remotion entitlement/redistribution review remains unresolved for public distribution. No automated test can complete maintainer playback, listening or creative acceptance. Those checks remain **unverified**.

## 2026-11-04 resumed verification

The previous full-suite launch was not executed: automatic approval review could not run because workspace credits were exhausted. The maintainer resumed on November 4; scoped approval now succeeds and the full serial suite is running. `npm run typecheck` completed with actual exit 0 before interruption. Neither fact substitutes for the fresh full-suite result.

The new onset helper measured 14 real pilot files (seven cue-local sources and seven aligned stems), with all original hashes unchanged. Timeline and manifest fingerprints matched. Delivered stems used extensible PCM24, so the diagnostic used separate PCM16 no-dither decodes with original/decoded hashes and exact FFmpeg arguments in `scratch/onset-diagnostics/report.json`. Aligned results at 30 fps:

| Cue | Signed threshold offset (frames) | Within 1 frame |
|---|---:|---|
| Egg tick | +10.507 | No |
| Shell crack | +0.023 | Yes |
| Chick peeps | +3.013 | No |
| Wing flutter | +6.769 | No |
| Clucks | +6.022 | No |
| Signature hit | +0.036 | Yes |
| Resolve tick | +0.036 | Yes |

These are first-above-5%-peak positions, not mux lag or auditory judgments. Egg tick is a new diagnostic finding for intent/waveform review, not a proven defect. Source versus decoded/aligned flutter differed by 0.023 frame, illustrating threshold/gain/quantization sensitivity. No stem was retimed; listening, perceived sync and approval remain **unverified**.

The prepared active kit is `scratch/motion-hands-on-2026-11-04/{native,remotion}`. Both project-scope Claude Native Lane installs contain the current library and onset helper; only Remotion contains the official add-on. Private local runtime copies provide FFmpeg 6.1.1 in both lanes, Native Playwright and Remotion 4.0.539. Historical media/audio hashes match the original pilot for 551 Native and 142 Remotion files. Source pilot files were preserved. Native browser seek/play/pause and full-frame fitting were verified; Studio loaded `AgencyMotion` and scrubbed to frame 241. Screenshots and restart instructions are in the hands-on guide.

Studio's pinned server only binds wildcard interfaces. Automatic approval review initially rejected its LAN exposure; after the maintainer explicitly answered “Allow Remotion Studio on my local network”, the scoped launch was approved and verified. No proxy, dependency patch or firewall bypass was used. The JSX root cannot save default-prop edits in Studio; persistent editing remains source-based. Historical evaluation preflight returns `allowed: true`, `entitlementVerified: false`, `productionAuthorized: false`; no new production render or real Claude session was started.

Final typecheck completed with process exit 0. Focused preparation tests cover refusal to overwrite, source/destination overlap, selected-lane installation, private runtime exclusions and copied source hashes. Independent checks cover junction overlap, malformed HTTP recovery, source fitting and real browser interaction. The fresh full serial suite has passed both large lifecycle files; final aggregate result follows when complete.

### Full-run result and correction — 2026-11-04

`npm test -- --maxWorkers=1 --no-file-parallelism` completed in 3362.40 seconds with actual exit **1**: **233 files passed, 1 failed; 4870 tests passed, 1 failed, 209 skipped**. The sole failure was `native-claude-inputs-first`: the new technique-library paragraph incorrectly preceded the required opening inputs-first rule in `agency-motion-designer.md`. This was an implementation ordering error, not an environment failure. Moved that paragraph below the inputs-first rule, after the media-consultation heading; no rule or test was weakened.

The affected post-fix run (`native-claude-inputs-first`, `native-claude-agents`, `motion-technique-library`, `motion-hands-on`, `audio-onset`, `skill-layout`, `skill-quality-ratchet`) passed **7 files / 279 tests**, actual exit **0**. All failures observed in the full run are resolved. A second entire 234-file run after the paragraph-only correction is **unverified**; do not describe the earlier full-run exit as zero. Logs are `scratch/verification/full-test.log`, `final-focused.log` and `typecheck-final.log`. Before a future requested push, run the repository's full pre-push gate again.

Final-tree `npm run typecheck` then completed with actual exit **0**, and `git diff --check` passed. Refreshed both active project roles through supported `add digital-agency -t claude --native --copy -y` without `--force`, after checking all managed projection hashes for user edits. Installed roles match the corrected source apart from the management marker, and lockfile hashes match. Both preview URLs still return HTTP 200. No commit or push was made.

## 2026-11-04 — maintainer sessions and requested PR

The maintainer supplied Native `eb812ab3-b481-4ad4-86d1-da88063b97c5` and Remotion `6f49fb90-e3ee-45aa-af9d-4c93fd059f07`, and explicitly requested completion of the report plus a PR to `dev`, including Plan 045. This supersedes the earlier no-push scope. Refetched `origin/dev` remains `d978fb2`; #213 remains open and this branch explicitly includes its `7df9869` handoff commit. The PR must state that dependency; no merge or npm release is requested.

Three GPT-6.1 Sol / medium agents audited Native, audited Remotion and researched current primary sources, then handled bounded role/runtime updates. GPT-6.1 Terra / medium handles a fresh local 4.0.540 runtime smoke. No new Claude Host session or paid media generation was launched.

The [hands-on report](../docs/skill-quality/2026-11-03-motion-hands-on.md) now contains session versions, notional cost-state totals, actor-specific Skill evidence, feedback, final artifact paths/hashes, commands and remaining defects. `hostlib:session --project` takes the encoded host record directory, not the user's working folder; corrected the reproduction command. Native used two specialists; Remotion used none. Both demos received explicit scoped acceptance after revisions. The explicit Skills-install/Elements research challenge occurred in Native and did not switch its renderer.

Implemented from those findings: one named setup owner, carried setup authorization, actual Skill invocation evidence, director-selected Element include/adapt/skip decisions, specialist-owned nontrivial revisions, fresh release lookup with exact project pins and existing-lock preservation. Added two prepared-not-run evaluation scenarios. Remotion 4.0.540 is current in all four public package records; original 4.0.539 projects remain supported. Optional Remotion dependency versions align; changed licence/package declarations during setup invalidate the run. The vendored 12-Skill snapshot and its redistribution hold are unchanged.

RED/GREEN evidence: 14 role-policy assertions failed before the new body clauses, then passed; these are static policy checks, not live compliance proof. New runtime/version/dependency/concurrent-change tests failed before implementation; the final Node suites pass 26 cases. Full pre-push validation and smoke results are recorded below once complete. Existing media projects are preserved; no automatic reinstall or upgrade was applied to the maintainer's accepted demos.

## Next action plan, ordered by evidence

| Order / owner | Concrete next slice | Acceptance and boundary |
|---|---|---|
| 1 / maintainer + Chris/Motion | Run one fresh-project Remotion sitting with ordinary local setup authorized, then one locked-539 no-install revision. Use evals 5 and 6 in `remotion-production`. | Read actual host records: setup owner completes installation, router/selected Skills invoke successfully, director records Element decisions, Motion executes production, 539 stays unchanged. Revised live behavior remains unverified until this sitting; no agent starts it. |
| 2 / Motion + QA | Reproduce Native title seek-order differences, unexplained frame337 pixels and frame404 contrast in an isolated copy; test shuffled/forward/repeated frame seeks. | Deterministic identical-frame evidence and applicable text contrast threshold, with viewed before/after proof. Preserve accepted demo files; this is a separate implementation slice. |
| 3 / Sound + QA | Review the Native canonical-timeline deviation and Remotion audio loop seam; compare diagnostic threshold, cue placement and actual playback separately. | Canonical handoff cannot drift silently; fixed sample-window measurements and explicit listening/perceived-sync review. User demo feedback stays recorded but is not a universal QC pass. |
| 4 / maintainer + attribution reviewer | Resolve standalone official-Skill redistribution scope at a pinned upstream source, or remove vendored distribution in favor of direct upstream installation. | Written licence/source disposition and packaging review before release; runtime eligibility or an optional bundle flag does not resolve distribution rights. |
| 5 / architecture + agency | Execute only Plan 045 Phase A next: prove addon/role dependency feasibility and decide the narrow GLB/viewer/PNG contract. | Reviewed placement and fixture matrix, followed by independent implementation slices. No Blender/provider/AR expansion or 3D production claim from this plan. |

Prioritize one proven installed workflow before adding more tools. The two demo sessions are exploratory, with different timing and revisions; they do not establish a controlled Native-versus-Remotion quality ranking.

### Fresh runtime validation

The isolated 4.0.540 smoke completed through the actual helper with Chrome 156.0.8078.74, Node24.22.1 and project-local exact dependencies. Scaffold/render and ffprobe exited 0; 60 decoded frames at 320×180/30fps, H.264/yuv420p, 2.000-second video (AAC/container 2.005 seconds). The [report](../docs/skill-quality/2026-11-03-motion-hands-on.md#fresh-40540-runtime-proof) records output hash, warnings and scope. No Host session or paid media job was started. This resolves the runtime-only smoke boundary, not revised live orchestration or human creative review.

### Final review corrections

Fresh preparation now installs `digital-agency` only, avoiding automatic installation of the held vendored add-on; the generated brief delegates compatible official Skills setup to the documented route. The active maintainer projects remain untouched. The Claude Motion resource pointer now resolves through the invoked installed Skill root, avoiding a source-tree-relative link that broke after installation. Both new CLIs resolve their entry path through directory junctions/symlinks and safely tolerate non-file argv when imported. Observed RED cases returned empty output through linked paths and threw on a non-file `node -e` argument; all corrections passed **35 focused tests**, including real Windows junction execution from another working directory. Source files froze at `2026-11-04T16:48:01Z`, before the full suite reached these files. The static policy checks do not establish live compliance.

The first requested pre-push run then exposed three failures in `cline-workflow-supporting-files`: the new workflow linked directly across Skill folders, which the Cline workflow projection cannot rewrite. This was a product-documentation error. Changed it to resolve the guide through the loaded `remotion-production` Skill root, without weakening tests. Stopped the incomplete failing run and retained `scratch/verification/publish-full-test-interrupted.log`; its termination exit was -1, not a completed aggregate. The corrected **12-file / 338-test** affected run passed, actual exit 0, including all 18 Cline workflow tests. A fresh typecheck/full-suite run follows on the corrected tree; its actual aggregate is the publication gate below.

### Completed publication gate — 2026-11-04

`npm run typecheck` completed with actual exit **0**, followed by `npm test -- --maxWorkers=2` with actual exit **0**: **235 files passed; 4,888 tests passed, 209 skipped, 5,097 total**, duration 1360.37 seconds. This is the fresh full run on the corrected implementation, including the Cline workflow fix and linked-CLI regressions. Local logs: `scratch/verification/publish-typecheck.log`, `publish-full-test.log`, `publish-focused.log`; staged diff/secret-pattern review and whitespace checks passed. Skipped checks and revised live orchestration remain unverified.

The updated helper's read-only preflight also passed against the maintainer's real Remotion r4 project, retaining 4.0.539 and its canonical fingerprint without writes. Plan 045 now includes a bounded resolver/native-roster audit and the exact parent-role mapping/lifecycle question to resolve before implementing Arda. The maintainer projects, exports, raw transcripts and installed runtime trees are excluded from the commit; the report preserves artifact identities and scoped acceptance.
