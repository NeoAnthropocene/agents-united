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

## Loops and public assets

The starter records boolean loop intent in `media/native/content.json`. It publishes `window.motion.meta.loop`; custom scenes must do the same when a loop was requested. Native render compares the screenshot at seek(duration) to captured frame zero for a declared loop. A byte-identical endpoint is a technical check, not proof that velocity, copy transitions or the last-to-first motion looks smooth. Review those separately. The starter's one-scene looping treatment keeps text visible and uses periodic motif/progress poses.

Only `/`, `/index.html`, `/content.json`, `/timeline.json` and supported `/assets/...` files are served. Put public fonts/images/media/JS/CSS in `media/assets/`; keep source/package/config/private files elsewhere. Requests are loopback-only. Dot paths, traversal, private aliases and symlink/junction escapes from each public root are refused, including links to another directory inside the project. Supported in-root asset aliases remain usable. Do not defeat the boundary to make an asset load; move an approved public copy into the intended root.
