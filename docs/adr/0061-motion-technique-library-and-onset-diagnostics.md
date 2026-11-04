# ADR 0061: Shared original motion techniques and separate acoustic-onset diagnostics

Status: Accepted for the local implementation, 2026-11-03; amended after maintainer sessions on 2026-11-04. The report records scoped demo acceptance; revised workflow behavior remains unverified live.

## Context

The maintainer requested continuation of the Plan 041–043 handoff, a reusable Native/Remotion technique and prompt library informed by four named repositories, and a prepared local interactive test. Existing recipes and craft gates already own prompt structure, viewed reference evidence, proof comparison, the Shared Media Timeline and final-mux measurements. The handoff also identified internal SFX lead-ins despite zero reported mux lag. Replacing these contracts with a template pack would lose the evidence boundaries that previous pilots exposed.

Prior art: existing `motion-design-direction`, renderer protocols, audio helpers, ADRs 0056/0058–0060, Plans 040–043, native Claude guide and tests. Remote all-state motion/remotion/3D PR search on 2026-11-03 found #211/#212 merged and #213 open. This branch was cut from freshly fetched `origin/dev` at `d978fb2`, then fast-forwarded to #213's existing handoff commit `7df9869`; it explicitly builds on that pending work.

## Decision

1. Extend the existing direction Skill with eight original **Motion Technique Cards**, rather than vendor another template or runtime. An offline read-only helper lists, searches and selects a card for an explicit renderer. Each card includes composition, parameterized prompt, both lane mappings, sound intent, avoidance criteria and proof checks. Selected output is inspiration-only and creative acceptance remains unverified.
2. Record exact upstream commits and inspected paths in the catalogue and source audit. Repository code, demo media, third-party assets and curated links have distinct rights. No upstream code, prompts or media are copied. Loading a card cannot manufacture `referenceFrames`, approve materials or bypass `proofComparison`, licence/preflight, canonical timing, Sound handoff or final measured export.
3. Wire both Motion roles and both renderer guides to the shared library. Keep Native deterministic seeks and Remotion frame-driven rendering independent. Runtime packages and optional official Remotion skills remain project-scoped; Plan 041's redistribution hold is unchanged.
4. Add a standalone WAV onset diagnostic for discrete stems. First-sample relative-peak threshold measurements expose internal lead-in separately from container mux lag. Reject unsupported files and report silence honestly. Record the measured file hash, sample/frame values and explicit method; do not pass this output off as final-mux or perceptual evidence. No trimming or timing change follows automatically.
5. Prepare disposable local project-scope Claude installs and historical pilot copies, with Native preview and optional Remotion Studio. Preserve source pilot files, identify inherited evidence and licences as historical, and refuse replacement of an existing session. The maintainer starts live interactive Host work; automated setup never starts a model or generation job.

## Consequences

This is a small library within an existing installed Skill, with no new Bundle or dependency. Original prompts remain adaptable and renderer parity is tested structurally; rendered quality still needs actual proof. A threshold crossing depends on noise, fades and peak choice and is not an auditory model. The kit makes controlled hands-on comparison possible but does not upgrade prior human-review statuses. Plans and source research are reviewable without authorizing the separate 3D implementation.

## Amendment — 2026-11-04 maintainer evidence

The two supplied Claude 2.1.318 sessions produced user-accepted test demos. Native delegated to Motion and Sound, used the new library and installed six official Skills after the user's explicit request; Motion used helpers without Skill invocation. Remotion loaded two official Skills but performed production inline in Chris. Neither sitting demonstrated automatic current-version setup or implemented an Element. See the [completed evidence report](../skill-quality/2026-11-03-motion-hands-on.md), which distinguishes actual tool results, human feedback and remaining defects.

The selected Remotion production scope now carries ordinary project-local dependency/Skill setup through one owner. Explicit restrictions and separate licence, upload, paid-service or global-install decisions still apply; prior authorization is reused. Both role lanes require installed/discovered/invoked/used evidence and delegate nontrivial media revisions to the appropriate specialist. Chris directs a small Element shortlist; Motion inspects and adapts chosen source/dependencies, or records why no Element fits. This is an authored workflow improvement, not a new enforcement hook or proven host behavior.

Public registry metadata checked on November 4 returned 4.0.540 for all four runtime packages; versioned 539/540 licence files were identical. Support is now project-bound: a matching reviewed 4.0.539 record preserves existing projects, and new projects can choose reviewed 4.0.540 after a fresh check. Unknown releases and mixed/changed package declarations are rejected. Rendering remains offline with respect to version resolution and never upgrades implicitly. The 12 vendored Skills remain at their previous pin and under the existing redistribution hold; new runtime support does not clear that separate question. No new Element or official Skill source is vendored by this amendment.
