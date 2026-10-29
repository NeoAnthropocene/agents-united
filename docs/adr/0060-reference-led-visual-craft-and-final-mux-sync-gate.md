# ADR 0060: Reference-led visual craft gate, material passes, side-by-side proof comparison, and final-mux sync/range review

- **Status**: Accepted
- **Date**: 2026-10-29
- **Context**: Plans [040](../../plans/040-signature-shot-motion-prompts.md), [041](../../plans/041-remotion-official-skills-addon.md), [042](../../plans/042-spec-driven-sound-routing-and-pilot-041.md), and [043](../../plans/043-reference-led-visual-craft-gate.md).

## Context

In Pilot 041 (`scratch/pilot-041/native` and `scratch/pilot-041/remotion`), both the Native and Remotion lanes passed all 21/21 mechanical contract and loudness checks, yet maintainer playback and listening review on 2026-10-29 rejected both exports on creative quality and Remotion on A/V synchronization:
1. **Visual craft gap**: Passing structural JSON checks (`check-prompt-spec.mjs` v1) allowed flat/basic vector primitives and ungrounded surface treatments to pass proof review without any side-by-side comparison against actual viewed reference frames or explicit material-pass decisions.
2. **Authored beat-to-cue drift in Remotion**: Post-hoc waveform/frame measurement of Pilot 041 proved that AAC muxing introduced `0.00 ms` (`0.00` frames) of container lag in both lanes, whereas the Remotion lane had authored a divergent beat grid in `motion-prompt.json` and `Composition.jsx` (`33, 66, 99, 132, 165, 225, 270`) that drifted by `-4.50` to `+20.02` to `-42.98` frames (`-716.3 ms`) from the canonical `timeline.json` cues (`37, 62, 128, 178, 225, 268`).
3. **Full-range `yuvj420p(pc)` output in Remotion**: `@remotion/renderer` defaults `imageFormat` in `renderMedia` to `'jpeg'`, capturing full-range JPEG frames from the headless browser so FFmpeg tags the H.264 stream `yuvj420p(pc, bt709)` even when `pixelFormat: 'yuv420p'` is passed.

## Decision

1. **Backward-compatible `referenceFrames` and `materialPasses` in `motion-prompt.json` (`check-prompt-spec.mjs`)**:
   - Existing v1 specs without `referenceFrames` or `materialPasses` continue to validate when `--require-craft-gate` is omitted, preserving migration safety for existing projects.
   - When `--require-craft-gate` is passed (or when either field is present), `validatePromptSpec(spec, options)` enforces:
     - `referenceFrames`: 1–2 locally stored, directly viewed (`viewed: true`) reference frames with relative `path` (rejecting `http://`/`https://` URLs and path traversal), `sha256:...` digest, `permissionScope` (`inspiration-only`, `owned-brand-asset`, `licensed-reference`, or `user-supplied`), 8-dimension craft `analysis` (`silhouette`, `negativeSpace`, `lightDirection`, `surfaceMaterial`, `depthSeparation`, `typographyContrast`, `focalHierarchy`, `paletteAnchors`), and `mapping` (`targetShots`, `borrowedGrammar`, `rejectedImitation`).
     - `materialPasses`: Explicit decisions for all four passes (`grain`, `gradientMesh`, `depthBlur`, `lightWrap`). Enabled passes must specify concrete `parameters` (`seed` for `grain`, 3+ `stops` for `gradientMesh`, `focalLayer`/`nearBlurPx`/`farBlurPx` for `depthBlur`, `sourceLayer`/`targetLayer`/`wrapPx`/`intensity` for `lightWrap`), `layers`, half-open `frameRange`, `visibleContribution`, and `proofCrop`. Disabled passes must record a substantive `naReason`. Applying all four passes across every depth layer for the full film duration (`0..totalFrames`) is rejected as `material.blanket` when 3+ depth layers exist.
2. **Pre-render `--timeline` beat-to-cue cross-check (`check-prompt-spec.mjs --timeline`)**:
   - When `--timeline media/timeline.json` is supplied, every non-zero `beatGrid.events` frame in `motion-prompt.json` must align within `1` frame (`|event.frame - cue.startFrame| <= 1`) of a discrete `timeline.json` cue (`startFrame > 0`), catching authored visual-to-audio drift before any frame is rendered.
3. **Side-by-side `proofComparison` gate (`check-prompt-spec.mjs --proof-comparison`)**:
   - `validateProofComparison(proof, { spec, timeline })` validates `media/specs/proof-comparison.json` before full render, requiring:
     - `timelineRevision` and `timelineFingerprint` matching the canonical `timeline.json` fingerprint (`proof.stale` on mismatch);
     - `signatureBoard` at delivery dimensions (`width`, `height`, `viewed: true`, `referenceFrameIds`) with all 5 detail crops (`typographyEdge`, `materialGrain`, `shadowContact`, `lightFalloff`, `silhouetteSeparation`);
     - `motionProofs` covering every shot transition (`fromShotId -> toShotId`) with ordered `frames: [startFrame, midFrame, endFrame]`, `viewed: true`, `continuityNotes`, and `readingHoldVerified: true`;
     - `defects` with concrete descriptions (rejecting vague "looks good" / "fine" / "ok" notes) and zero unresolved `blocker`/`high`/`major`/`critical` items (`proof.unresolvedDefect`).
4. **Remotion PNG frame capture (`remotion-production/scripts/project.mjs`) and final-mux sync/range gate (`audiovisual-review/scripts/review.mjs mux-sync`)**:
   - `remotion-production/scripts/project.mjs` passes `imageFormat: 'png'` alongside `pixelFormat: 'yuv420p'` to `renderMedia` and records both in `requestedEncoding`, eliminating default JPEG `yuvj420p(pc)` full-range capture at the source.
   - `review.mjs mux-sync --timeline ... --manifest ... --sync ...` (`validateMuxSyncReview`) validates the decoded final MP4 stream (`pixelFormat === 'yuv420p'`, `colorRange` in `['tv', 'limited']` unless an explicit `colorRangeApproval` is recorded) and every manifest cue's measured onset offset (`|offsetFrames| <= 1.0` frame for discrete cues, rejecting `timeline-arithmetic` claims) while keeping human `listening` explicitly `unverified`.

## Consequences

- Creative (`Jamileh`), Motion Designer, Sound Designer, and Campaign Director (`Chris`) share one deterministic, test-enforced contract for reference-led visual craft, side-by-side proof review, and final-mux sync/range verification across both Native and Remotion lanes.
- Existing v1 projects remain valid without forced migration until `--require-craft-gate` is enabled.
- Automated validators enforce structure, measured stream metadata, and measured onset offsets, while human playback, listening, and creative taste acceptance remain explicitly separate (`unverified` until performed by a human reviewer).
