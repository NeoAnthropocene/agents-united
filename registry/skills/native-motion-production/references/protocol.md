# Deterministic scene protocol

Use this when authoring or debugging HTML, SVG or canvas. The scene chooses its artistic treatment. The native helper owns frame sampling, readiness enforcement and encoding; do not implement a second timeline validator in the scene toolchain.

## Canonical time

The canonical `media/timeline.json` supplies schemaVersion, revision, integer fps, totalFrames, even width/height, contiguous scene intervals and aligned cues. Its fingerprint includes timing and speech text. Do not add a `loop` field to that strict schema.

For fps F and N frames, export integer indices i=0..N-1 at t=i/F. Duration is N/F, last sampled time is (N-1)/F, and t=N/F is an extra boundary probe only. For F=60 and N=120, those values are 2 seconds and 119/60 seconds. This math is also the planning fallback when a role has no shell; it does not verify a browser or encoded file.

Avoid Date.now, random poses, incremental integration, unbound CSS animation, audio/video autoplay and external network fonts. Calling seek(0), seek(0.5), then seek(0) must reconstruct the same pixels for the repeated time. Drive SVG attributes, CSS transforms or canvas redraws from the requested time and approved scene data.

## Browser interface

Expose `window.motion` during startup, with a real `ready` Promise. It may initialize `meta` and `seek`; reject it when composition setup fails. After readiness, metadata must match `timelineRevision`, `fps`, `totalFrames`, `width` and `height`. `seek(seconds)` must return only after the requested pose and any asynchronous work are complete; a returned Promise is awaited before screenshot.

```js
window.motion = { meta: null, seek: null, ready: null };
window.motion.ready = initializeApprovedScene().then(({ timeline, draw, loop }) => {
  window.motion.meta = {
    timelineRevision: timeline.revision, fps: timeline.fps,
    totalFrames: timeline.totalFrames, width: timeline.width,
    height: timeline.height, loop
  };
  window.motion.seek = async seconds => { await draw(seconds); };
  return window.motion.seek(0);
});
```

This is a protocol sketch; implement initialization and drawing from approved local content. The packaged HTML starter is runnable after scaffolding. Keep a real `document.fonts.ready` Promise and decodable images with nonzero natural dimensions. The helper waits for composition, fonts and image decoding, then checks every asynchronous seek before capture. Rejected readiness, metadata mismatch, decode/seek/screenshot errors abort before encoding; never mask them with a sleep.

## Composition techniques for marketing-grade output

Write these into the authored scene rather than a flat plate; every value comes from the
frame index, never from accumulated state or wall clocks.

| Element | Deterministic recipe |
| --- | --- |
| Depth layers | Sky gradient with 3+ stops, mid-ground silhouette, foreground accent or vignette; each layer has its own opacity and blur |
| Parallax | Per-layer factor (far 0.1, mid 0.35, near 0.7, subject 1.0); `offset = (cameraX - 0.5) * factor * amplitude`; the camera factor changes over the film, never a static frame |
| Material passes | Explicit implementation of `grain` (seeded SVG/canvas noise with bounded opacity/blendMode), `gradientMesh` (3+ stop atmospheric radial/conic mesh), `depthBlur` (focal layer separation with near/far blur), and `lightWrap` (backlight wrap on subject silhouette edge) |
| Light | Radial-gradient glow, sun disc with bloom, an animated light ray, or a graded tint overlay; one effect with a frame span and intensity curve |
| Secondary motion | Tail, sway, blink, particle float: `A * sin(2 * PI * f * t + phase)` with small A and f in the spec, not a random value |
| Particles | Seeded positions from a fixed PRNG whose seed is in `content.json`, 12–40 low-opacity motes drifting slowly, never crossing the copy |
| Text treatment | Mask reveal with a clip rect, animated `letter-spacing`, per-word stagger, depth shadow or extrusion |
| Camera | One transform on the root group (dolly, push-in, pan) with a recorded start/end and easing |
| Grade | One palette across scenes; optional warm/cool tint transition; contrast checked at the final display size |

`seek(t)` derives `i = t * F` and rebuilds every layer, particle and camera from those
parameters. Keep them in `content.json` so the composition is reviewable. Two flat plates
with centered text fail the [quality floor](../../motion-design-direction/references/direction.md)
unless the storyboard records why the brief forbids depth.

This table is implementation vocabulary, not a complete prompt. First validate
`media/specs/motion-prompt.json` with `motion-design-direction/scripts/check-prompt-spec.mjs --require-craft-gate --timeline media/timeline.json`.
Implement its signature shot, causal shot transitions, `referenceFrames` grammar, four `materialPasses`, and one named camera move per shot. Give
surfaces deliberate material/edge/contact-shadow behaviour; default primitives and hard-edged or
blurred placeholder copy rectangles are failed proofs. Capture every proof-plan frame, build the
side-by-side `proofComparison` board (`media/specs/proof-comparison.json`), and validate with
`--proof-comparison` before the full render, then revise and reproof visible defects within the
approved budget. After muxing the final MP4, verify colour range (`yuv420p` limited range `tv`)
and discrete cue offsets within 1 frame via `audiovisual-review/scripts/review.mjs mux-sync`.

## Loops and public assets

The starter records boolean loop intent in `media/native/content.json`. It publishes `window.motion.meta.loop`; custom scenes must do the same when a loop was requested. Native render compares the screenshot at seek(duration) to captured frame zero for a declared loop. A byte-identical endpoint is a technical check, not proof that velocity, copy transitions or the last-to-first motion looks smooth. Review those separately. The starter's one-scene looping treatment keeps text visible and uses periodic motif/progress poses.

Only `/`, `/index.html`, `/content.json`, `/timeline.json` and supported `/assets/...` files are served. Put public fonts/images/media/JS/CSS in `media/assets/`; keep source/package/config/private files elsewhere. Requests are loopback-only. Dot paths, traversal, private aliases and symlink/junction escapes from each public root are refused, including links to another directory inside the project. Supported in-root asset aliases remain usable. Do not defeat the boundary to make an asset load; move an approved public copy into the intended root.
