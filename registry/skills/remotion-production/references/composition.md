# Parameterized composition, frame math and readiness

Read this while authoring or replacing the starter. Preserve approved content and the
canonical timeline; do not alter helper-owned data to make a render pass.

## Reusable source and props

`index.jsx` registers `RemotionRoot`. `Root.jsx` declares composition `AgencyMotion`
and derives duration, fps and dimensions through `calculateMetadata` from the supplied
timeline. `Composition.jsx` maps stable scene IDs to `Sequence` elements and scene copy;
`frame-state.mjs` derives entrance opacity and translation from the local frame.
Keep source/modules and approved public assets editable. Theme, `sceneText` and other
custom props are authored content; timeline, fingerprint and owned `audioSrc` belong to
the generated handoff. Refresh retains theme/custom props and copy for surviving IDs.
New IDs receive editorial placeholders and need review.

Use `useCurrentFrame()` inside a `Sequence` for its local frame and `useVideoConfig()`
for composition settings. Reconstruct each pose directly from frame and props. Repeated
evaluation of frame 15 should produce the same pixels; compare a different frame to ensure
the test is not merely proving a static card. Do not use timers, random values, accumulated
transforms, autoplay progress or CSS animation as the animation clock.

## Arithmetic without a shell

For integer fps F and N total frames, duration is N/F seconds. Export indices are
0 through N-1; last sample time is (N-1)/F. A scene `[startFrame,endFrame)` lasts
`endFrame-startFrame` frames and excludes its end frame. At global frame G its local frame
is `G-startFrame`. Preserve scene/cue IDs across edits so Sound and copy can reconcile them.

| Example at 60 fps | Result |
| --- | --- |
| N=120 | 2 seconds, export frames 0..119 |
| Last exported time | 119/60 seconds |
| Scene `[60,120)` | 60 frames, local indices 0..59 |
| Two-second loop boundary | Pose at time 2 seconds compared to time 0; not an extra exported frame |

Loop intent belongs in the approved brief or custom scene props, not as an unknown field
in the strict timeline. The helper does not automatically verify loop closure. A repeated
still is a determinism check; a smooth seam requires boundary inspection and playback.

## Composition for marketing-grade output

Apply the same quality floor as the native lane: three depth layers minimum, explicit `materialPasses` (`grain`, `gradientMesh`, `depthBlur`, `lightWrap`), one light
effect, one secondary motion, one camera move, and text treated as a designed element.

- Build the field from layered `div`/SVG groups (gradient sky, mid silhouette, foreground
  vignette). Drive a root group's `transform` for the camera with `interpolate` and an
  explicit easing; per-layer parallax uses `factor * (cameraX - 0.5) * amplitude`.
- Use `useCurrentFrame()` everywhere; a `Sequence` reports a local frame, so map cues back
  to the absolute frame before evaluating them. Particles come from a small seeded PRNG in
  `frame-state.mjs`, never `Math.random()`, and never obscure the copy.
- Light comes from a radial-gradient glow, a bloom on the sun, an animated ray or a graded
  tint overlay, each with a frame span and an intensity curve.
- Text gets a mask reveal via `clipPath`, animated `letterSpacing`, per-word stagger and an
  optional depth shadow or extrusion; a static centered headline alone does not pass.
- Keep one palette and grade across scenes; check contrast and margins at the final size.

These techniques do not replace direction. Validate `media/specs/motion-prompt.json` with
`motion-design-direction/scripts/check-prompt-spec.mjs --require-craft-gate --timeline media/timeline.json` before authoring so `referenceFrames`, `materialPasses` and beat-to-cue timing are locked before React components are written. Implement its signature
shot, causal transitions and one named camera move per shot. Do not use default flat materials or
hard-edged/blurred placeholder copy rectangles. Capture every proof-plan frame, assemble the side-by-side
`proofComparison` board (`media/specs/proof-comparison.json`), and validate with `--proof-comparison`
before the full render; revise and reproof clipping, collisions, flat materials,
illegible type or unclear cause/effect within the approved budget.

The Remotion helper passes `imageFormat: 'png'` and `pixelFormat: 'yuv420p'` to `renderMedia` so `@remotion/renderer` does not default to JPEG frames (`yuvj420p` full-range `pc`). After rendering, verify the final MP4 with `audiovisual-review/scripts/review.mjs mux-sync` to confirm `yuv420p` limited range (`tv`) and measured discrete cue offsets within 1 frame.

`media/remotion/public/` still holds only approved local assets, and `staticFile` is the
only approved way to reference them. When Jamileh supplies licensed images, use `Img` with
an explicit crop and grade; readiness gates apply as before.

## Assets, fonts and preview

Place only approved public media/fonts under `media/remotion/public/` and reference
local assets via `staticFile`. Use Remotion's readiness-aware `Img` for images, and an
explicit loading gate for asynchronous fonts/media. Settle success or reject failures
before capture; do not add sleeps or accept fallback-font screenshots as final. Avoid
unapproved remote dependencies and keep credentials/private source outside the public tree.
The starter contains no remote image/font loading; newly added asynchronous resources
require new runtime checks and are unverified by the existing smoke proof.

For an optional interactive preview after authorized setup, resolve the installed
project-local CLI in `media/remotion/` and use its `studio index.jsx` command with the
same approved props. Do not use a package runner that silently downloads another version.
Studio can help inspect layout, timing and the loop seam, but does not apply the helper's
current handoff/licence/stale-snapshot gates. Run the helper for final export and inspect
its encoded output. Interactive Studio behavior has not been verified by the scoped technical
offline render proof.

The current audio template uses one `Html5Audio` at frame zero for the full master. Do
not replay already mixed cue files independently or shift it to fix an unapproved timing
change. Send required cue/mix changes back through the Lead to Sound.
