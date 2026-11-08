# Host and media completion audit — 2026-11-07

This audit distinguishes delivered work and observed pilot behavior from the
remaining verification boundaries. Dated entries supersede earlier planning
statements; a static test or installed file is not evidence of live adherence.

## Tracked Host libraries and Claude-first adaptation

| Requirement | Evidence | Status and boundary |
| --- | --- | --- |
| Refresh the three tracked libraries | [Claude delta](2026-11-06-claude-host-library-delta.md), [Cline and active Hosts delta](2026-11-06-active-hosts-delta.md), [Antigravity delta](2026-11-06-antigravity-host-library-delta.md), and [Plan 048](../../plans/048-host-refresh-and-claude-session-tracking.md) document accepted sources and guide changes. | Accepted-source refresh implemented. Full refresh remains **unverified**: Claude MCP `mcp.md` and `vs-code.md`, and the Antigravity full web changelog remain held; existing snapshots and baselines remain unchanged. Do not bypass the audits. |
| Claude grants, task policy and launcher | [ADR 0064](../adr/0064-claude-session-task-tracking.md) and Plan 048 record class-derived grants, structured task ownership and fallback, and subprocess-only launcher opt-in respecting explicit opt-out. The later 3D role brings the native roster to 18. | Implemented and statically covered; read-only ceilings remain. Tool availability depends on the actual Host surface. |
| Maintainer production observations | [Eval1](2026-11-07-3d-eval1-web-r4.md) records Claude 2.1.319 foreground Skill calls and task IDs; [eval2b](2026-11-07-3d-eval2b-session-audit.md) records ordinary worker production, task updates and an Arda-to-Motion handoff. | Observed for those sessions and surfaces, not all worker/team modes. Motion omitted its mandatory `motion-design-direction` invocation in eval2b. Later instruction hardening preserves that requirement; adherence to the amended instructions is **unverified live**. |
| Other Host implementation notes | Plan 048 distinguishes Cline configured agents from built-in subagents, and Antigravity delegation, messaging and background-process tracking. | Guidance recorded; no invented cross-Host task-tool mapping. Antigravity CLI behavior remains unverified where the executable was unavailable. Codex, Cursor and OpenCode have no equivalent reviewed snapshot baseline; generic agents/Gemini are projection targets, not additional tracked libraries. |

The four pilot-driven follow-ups in Plan 048 are implemented: actor-specific
stage-Skill evidence, truthful revision tracking and review attribution,
separate reporting of observed guards and settings, and source-specific rights
claims. Six affected suites passed 518 tests. Static coverage does not erase
the observed deviations or prove amended live behavior.

The `host-update-sync` Skill's documentation hold step records these findings
in the PR Security holds; its human-clear wording applies to upstream Skills,
not documentation. A technical `auditAllow` configuration entry is not permission to
ingest or publish content. If separately undertaken, the next bounded step is
a scanner-precision proposal with benign and adversarial fixtures, preserving
the holds until resolved through the recorded process. This is not an automatic
approval flow.

## Plan 044: Motion library and hands-on handoff

| Original deliverable | Evidence | Status |
| --- | --- | --- |
| Eight original technique cards and offline list/search/select | [Plan 044](../../plans/044-motion-technique-library-and-hands-on.md), `registry/skills/motion-design-direction/assets/techniques.json` and its helper. | Delivered; no new artistic-quality claim follows from static tests. |
| Discovery in both Motion roles and renderer guides | Plan 044 and the Native/Remotion production references record routing and proof gates. | Delivered; later revised orchestration adherence remains **unverified live**. |
| PCM WAV onset diagnostic | `registry/skills/audiovisual-review/scripts/measure-onset.mjs` and Plan 044's measured-stem ledger. | Delivered; threshold crossing is distinct from placement, mux alignment and perceived sync. |
| Isolated installs, previews and maintainer handoff | [Hands-on report](2026-11-03-motion-hands-on.md) and Plan 044 record installations, preview interaction, readback and scoped demo acceptance. | Delivered for the reviewed projects. Historical pixel discrepancies and creative limitations retain their recorded dispositions; acceptance is not a general quality ranking. |

The later prototype listening acceptance is scoped to that prototype. The
vendored official Remotion Skills were removed in favor of upstream use; this
does not establish terms or entitlement for every upstream use.

## Plan 045: Agency 3D Designer

| Phase | Evidence | Status |
| --- | --- | --- |
| A — placement and contract | [ADR 0062](../adr/0062-agency-3d-designer.md) and Plan 045's placement fixture. | Accepted standalone optional Bundle and bounded Claude-native scope. |
| B — native package | Plan 045 records actual Arda role, four Skills, Bundle wiring, roster, policy and installation checks. | Implemented; other Host delivery and alias behavior are not inferred. |
| C — local production and review | Plan 045 records a validated original GLB, viewer, PNG and explicit runtime/privacy matrix. | Bounded local proof delivered; unsupported formats, sources and runtime conditions remain subject to their recorded limits. |
| D — installed lifecycle and Motion proof | Plan 045 records installed resources, lifecycle checks, frame sequence and fingerprint-bound handoff. | Bounded local proof delivered, including stale-input controls; not a claim of every platform or runtime. |
| E — maintainer native pilot | [Eval1](2026-11-07-3d-eval1-web-r4.md), [eval2b](2026-11-07-3d-eval2b-session-audit.md) and [eval3](2026-11-07-3d-eval3-session-audit.md) contain Host-record audits and separate feedback. | All three pilot families executed. The corrected cap was accepted for the eval1 prototype; eval2b's visible production, integration and playback were accepted; eval3's routing and no-production controls passed with scoped feedback. Preserve the Motion Skill omission, revision/review attribution and reporting limitations. No repeat generation is needed merely to repeat these cases. |
| F — expansion | Plan 045 reserves separate source adapters, Blender, AR or generators for demonstrated demand and independent evidence. | Deferred, not a prerequisite for A–E. AR, provider terms and untested routes remain **unverified**. |

## Current verification boundary

The post-eval1 full gate passed before the later instruction edits; it is
historical evidence for that earlier tree. The fresh hardening gate completed
with typecheck exit 0 and test exit 1, watched source unchanged: 251 suites
passed, three failed on 30-second timeouts, 4,973 tests passed and 210 skipped.
The three timed-out cases passed in isolated runs under the original timeout
in 8.756, 6.118 and 6.508 seconds. Their cause is **unverified**; neither the
isolated results nor the timeouts establish a product defect or a full pass.
Evidence is in `scratch/3d-hardening-gate-2026-11-07/`. The subsequent serial
confirmation passed **254 suites, 4,976 tests and 210 skips** before integration
with fresh `dev`; it does not verify the newer tree. Skipped checks remain
unverified.

Integrated gate 77135 ended with one focused factory failure and 119 passes;
the direct-entry fix subsequently passed 112 focused checks and ten selected
normalization/ownership/guard checks. Gate 2 was interrupted after three stale
factory expectations; their affected suites passed 201/201 after correction.
Gate 3 was interrupted at the Host-library command-source expectation. The
reviewed Antigravity CLI command stream was then ingested through the normal
process, advancing only that stream to 1.5.1; other baselines and profile pins
remain unchanged and the three source holds remain held. Gate 4 completed with
typecheck and package proof exit 0, but test exit 1: 5,372 passed, three failed
and two skipped; all 317 domain-matrix cases passed. The audit-row and reviewed
engineering golden corrections subsequently passed focused checks (129 tests;
see [Plan 050](../../plans/050-host-agent-router-in-every-bundle.md#2026-11-07--explicit-golden-review-after-terminal-gate-4)).
Gate 5's PID 28312 was confirmed absent; its final native exit and after-hash
record are missing, so it is interrupted and **unverified**, not a pass or
failure. Gate 6 subsequently passed with native root, typecheck, package,
archive-proof and test exits 0 and watched source unchanged: 257 suites, 5,167
passed and 210 skipped. The 317 matrix cases passed separately in Gate 4 on
unchanged matrix inputs. See the [final verification receipt](2026-11-08-final-verification.md)
for the skips and precise boundaries. Earlier typecheck and package/archive proof
exits were 0; the archive contained 1,082 entries, zero retired files and five
matching resources, SHA-256 `c0d27cad8f6c7dbd7f14e8f0e68b913ec3a814ea13d54d6150403b531d44a468`.

Plan 050's sampled installation and ownership proof passed 14/14, including
the optional footprint measurement; actual model non-invocation remains
unverified. The user chose a tested Plan 051 proposal while retaining all
three holds: its private 18 and public 19 old-policy cases passed, while the
scratch prototype passed 24/26 and is **NOT READY**. Production audit policy
is unchanged. Before any separately requested push, the repository's full
pre-push gate must pass on the then-current tree.
