# Plan 043: Reference-led visual craft and final-mux sync review

Status: **JOBS V0–V4 IMPLEMENTED AND VERIFIED LOCALLY (2026-10-29); JOB V5 (MAINTAINER-STARTED LIVE EVALUATION) PREPARED, UNVERIFIED.**
Requested by the maintainer on 2026-10-29 after viewing/listening to both chicken-life-cycle exports.
Jobs V0–V4 (schema/validators, four material-pass gates, side-by-side proof comparison, final-mux sync/colour-range review, Remotion `imageFormat: 'png'` + `yuv420p` fix, 10 blueprints, and canonical/native role wiring) are implemented and covered by unit/integration tests ([ADR 0060](../docs/adr/0060-reference-led-visual-craft-and-final-mux-sync-gate.md)). No paid Host session has been started; Job V5 remains **unverified** pending a maintainer-started live evaluation run.

## Goal

Improve motion quality on lower-cost models through reference analysis, concrete material treatment
and review that rejects technically correct but visually basic work. Passing JSON, codec and
loudness checks is not creative acceptance. Keep the Sonnet-class baseline for the first eval;
a model-cost difference as the cause of the X-reference gap is an unverified hypothesis, not the
solution. Measure craft improvement and total iteration cost before proposing a model comparison.

## Baseline and maintainer review

- Plans [040](040-signature-shot-motion-prompts.md), [041](041-remotion-official-skills-addon.md)
  and [042](042-spec-driven-sound-routing-and-pilot-041.md) provide pipeline foundations.
- r3 improved and proved the workflow, not reference-quality motion.
- Pilot 041 passed recorded 21/21 mechanical checks in each lane. The maintainer performed playback
  and listening: **sound FX and background sound are very basic; Native sync is better; Remotion
  is a bit unsynchronised; creative quality is low against the X examples and is not accepted.**
- **Measured root cause of Pilot 041 sync and colour range (verified 2026-10-29)**:
  - Decoding `audio/master.wav` vs `final-16x9.mp4` in both Pilot 041 deliverables proved `0.00 ms` (`0.00` frames) of AAC mux/container lag in both lanes.
  - Native visual transitions landed within `-0.50` to `+0.02` frames of the audio cues (`37, 62, 128, 178, 225, 268`).
  - Remotion `Composition.jsx` and `motion-prompt.json` authored a divergent beat grid (`33, 66, 99, 132, 165, 225, 270`) that drifted from `timeline.json` cues by `-4.50f` (`-75.0 ms`) at crack, `+3.50f` (`+58.4 ms`) at hatch, `-29.00f` (`-483.3 ms`) at chick, `+20.02f` (`+333.7 ms`) at grow, and `-42.98f` (`-716.3 ms`) at return.
  - Remotion `final-16x9.mp4` encoded as `yuvj420p(pc, bt709)` full-range because `@remotion/renderer` defaults `imageFormat` in `renderMedia` to `'jpeg'`. Passing `imageFormat: 'png', pixelFormat: 'yuv420p'` in `remotion-production/scripts/project.mjs` fixes the root cause, and `review.mjs mux-sync` enforces `yuv420p` limited range (`tv`) and `|offsetFrames| <= 1.0` frame.
- Correction: Pilot 041 installed `digital-agency` only, not the official add-on. Pilot 040 received
  the 12 skills. Installed, discovered, invoked and used are separate evidence. Pilot 041 does not
  prove official-pack efficacy. Resolve the add-on's publication/licence hold before using it in a
  redistributed evaluation fixture.

## Prior art and source boundary

Extend `motion-design-direction/references/prompt-blueprint.md`, `quick-facts.md` and its ten
blueprints. The existing validator checks structure, not pixels/taste. Do not invent another
canonical timeline, Sound manifest or production Skill.

The original X leads/authors are in [Plan 037](037-agency-motion-sound.md). Recover **1–2 actual
reference frames** from the maintainer's collection for the chosen treatment. Record URL, author,
source timestamp/frame, capture date, local path, SHA-256, permission/use scope and the principle
being studied. If access/permission is missing, Chris asks for a supplied frame or approved
alternative and marks reference review blocked/unverified. A link or like count is not view evidence.

Keep captures private unless redistribution is explicitly permitted; never commit protected media
into the public Skill/package. Use original analysis, not copied art/code/prompts/music. Compare
transferable craft rather than duplicating a character or layout.

## Implemented contract (ADR 0060)

Keep craft direction/review beside `media/specs/motion-prompt.json`. `validatePromptSpec(spec, options)` in `registry/skills/motion-design-direction/scripts/check-prompt-spec.mjs` remains backward-compatible with v1 specs while enforcing `referenceFrames`, `materialPasses`, and optional `--timeline` beat-to-cue alignment when `--require-craft-gate` is passed. Canonical timebase, revision and fingerprint contracts remain unchanged.

For each reference frame, `referenceFrames[]` records `id`, project-relative `path`, `sha256`, `viewed: true`, `permissionScope` (`inspiration-only`, `owned-brand-asset`, `licensed-reference`, or `user-supplied`), 8-dimension `analysis` (`silhouette`, `negativeSpace`, `lightDirection`, `surfaceMaterial`, `depthSeparation`, `typographyContrast`, `focalHierarchy`, `paletteAnchors`), and `mapping` (`targetShots`, `borrowedGrammar`, `rejectedImitation`).

Jamileh owns reference analysis and a signature styleframe/paintover or equivalent concrete handoff.
Motion owns implementation/choreography; Sound owns audible performance/cues; Chris rejects weak
work and consolidates user questions. Shell-less Creative receives frames through the existing relay,
not a new tool grant. Specialists never invent human approval.

## Work packages

| Job | Owner / targets | Status & Acceptance |
|---|---|---|
| V0 | Chris + Jamileh; private intake | **DONE** — `referenceFrames` schema & validator in `check-prompt-spec.mjs` requires 1–2 local viewed frames with SHA-256, permissionScope, 8-dimension analysis and shot mapping; URLs and unviewed files rejected |
| V1 | Direction overlay + ten blueprints | **DONE** — `prompt-blueprint.md`, `quick-facts.md`, `direction.md`, and all 4 blueprint files (`blueprints-01-03.md`..`09-10.md`) updated with `referenceFrames`, `materialPasses` (`grain`, `gradientMesh`, `depthBlur`, `lightWrap`), `--timeline` beat-to-cue check, and `proofComparison` |
| V2 | Motion/Creative proof review | **DONE** — `validateProofComparison` (`--proof-comparison`) enforces side-by-side signature board at delivery size, 5 detail crops, transition `motionProofs`, concrete defect notes, zero unresolved severe defects, and fingerprint freshness |
| V3 | Chris + Sound + Motion final mux | **DONE** — `review.mjs mux-sync` (`validateMuxSyncReview`) enforces `yuv420p` limited colour range (`tv`), rejects `timeline-arithmetic` sync claims and discrete cue offsets > 1 frame, and keeps human listening `unverified`; `remotion-production/scripts/project.mjs` passes `imageFormat: 'png', pixelFormat: 'yuv420p'` |
| V4 | Tests, fixtures, native/canonical roles | **DONE** — RED-then-GREEN tests in `tests/skill-scripts/media-motion.cases.mjs`, `tests/skill-scripts/media-handoff.cases.mjs`, `tests/media-remotion.runtime.mjs`, and `tests/agency-media-roles.test.ts`; canonical and Claude native roles updated; ADR 0060 recorded |
| V5 | Maintainer-started evaluation | **PREPARED, UNVERIFIED** — Same model/settings/brief/assets/cue plan and equal budgets; requires maintainer-started Host session per `AGENTS.md` |

## Material-pass decisions in every blueprint

Each pass records parameters, affected layers, shot/frame ranges, expected visible contribution
and a proof crop. Every blueprint makes all four decisions; N/A needs a reviewed reason. Applying
all effects everywhere is not craft (`material.blanket` rejected when 3+ depth layers exist).

| Pass | Acceptance evidence | Reject |
|---|---|---|
| Grain / surface | Seed, scale, opacity, surface placement; tactile detail without crawling or lost contrast | Global noise masking crude drawing; unstable randomness |
| Gradient mesh / tonal field | Authored colour anchors/falloff support volume and attention; palette and output crop | Generic wash or global glow claimed as material craft |
| Depth blur | Fore/mid/background focus, radius/range, occlusion; legible subject/type | Blur hiding weak edges or creating placeholder copy panels |
| Light wrap / edge integration | Named source, rim width/colour/intensity, contact shadows and spill consistent with geometry | Uniform glow, detached shadows, inconsistent lighting |

Flat illustration needs deliberate approved direction, authored silhouette/proportions and motion.
Primitives plus grain are not finished characters. Approve asset/styleframe quality first.

## A proof review that can fail

1. Show the 1–2 references and candidate signature frame side by side at delivery size, with
   5 required crops (`typographyEdge`, `materialGrain`, `shadowContact`, `lightFalloff`, `silhouetteSeparation`). Record frame IDs/hashes and actual view evidence in `media/specs/proof-comparison.json`.
2. Describe specific gaps, not "looks good": crude bird proportions, ambiguous shell overlap,
   inconsistent edges, grass intruding on the subject, weak hierarchy or stock-looking characters.
   Record severity, owner, target frame, correction and outcome.
3. Review short transition and secondary-motion clips (`motionProofs`): `startFrame`, `midFrame`, `endFrame`, continuity notes and `readingHoldVerified: true`. A still cannot approve choreography or sync.
4. Reproof corrections before full render. Bound rounds and cost. If craft still fails, stop or
   escalate/simplify with an explicit decision; do not relabel technical success as visual approval.
5. Keep structural, encoded technical, reference-relative craft and human creative results separate.

## Sound and sync on the final encoded file

Address basic audio separately from surface effects. Set sonic intent per cue; audition model-free
synthesis, approved supplied/recorded or licensed sources. Only propose a model/provider if justified
and separately authorized. Hardware feasibility is not audible performance quality.

Compare the actual final MP4 to the chosen Sound master with `review.mjs mux-sync --timeline media/timeline.json --manifest media/audio-manifest.json --sync media/specs/mux-sync.json`. Define cue IDs, visual target frames and
sample/time onsets; measure signed offsets with a named method (`decoded-waveform-and-frame`, `cross-correlation-and-frame`, or `continuous-bed-envelope`). Tolerance: within one
frame (`|offsetFrames| <= 1.0`) for a discrete intended hit. Maintainer playback/listening closes perceived sync separately (`listening: "unverified"`).
