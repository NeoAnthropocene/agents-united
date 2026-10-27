# Export, diagnosis and delivery evidence

Read this after a render attempt or before handoff. Keep commands, actual exit codes, artifact paths and versions. A readable log is not a substitute for the process exit; a successful process is not a substitute for inspecting its output.

## Technical acceptance

The helper writes a new `media/renders/native-<revision>-<id>/` directory with ordered frame PNGs, `video.mp4`, three stills, a contact sheet and `render-evidence.json`. It uses a loopback server and blocks page requests to other origins. Capture failure prevents encoding. A declared loop is probed at duration and compared to frame zero before encoding; that extra pose is not exported as an additional frame.

Inspect the actual MP4, for example with a locally available ffprobe:

```text
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=codec_name,pix_fmt,width,height,avg_frame_rate,nb_frames,nb_read_frames,duration -of json "<render>/video.mp4"
```

Require the approved dimensions, rational fps matching the integer timebase, N decoded frames and duration N/fps, with H.264/yuv420p for this contract. If audio was supplied, inspect the delivered AAC stream and alignment independently. Fractional fps, another codec or an unsupported delivery format needs an explicit contract decision; do not approximate it silently.

Re-seek several times in a real browser, including a repeated earlier time. Compare repeated frame hashes, verify different poses change pixels, and inspect first/last/boundary poses. Loop endpoint equality does not prove a smooth seam. Frame names/order and FFmpeg arguments have unit tests; only an actual browser/export proves runtime compatibility.

## Review levels

1. **Numerical proof:** source frame count, encoded codec/dimensions/fps/count/duration, repeated-pose hashes and any requested boundary comparison.
2. **Decoded-sample inspection:** inspect decoded video frames, not only source PNGs. Record which frames and observations about clipping, legibility, branding and asset resolution. Three samples cannot establish the whole film.
3. **Full playback and accessibility:** review pacing, transitions, loops, destination crop/safe areas, captions and any reduced-motion alternative. Route copy/brand changes through the Lead.
4. **Audio measurement and listening:** inspect actual master/output measurements, sync, VO intelligibility, music balance, SFX/transients and loop/seam behavior. A silent fixture or reported metadata is unverified for this level.

Keep unperformed levels marked unverified. Do not overwrite the renderer's automatically unverified visual/listening fields merely because static gates passed; add a separate dated review record with scope and reviewer.

## Diagnose before changing the contract

| Symptom | Repair and evidence |
| --- | --- |
| Recorded Remotion choice or fps/dimension conflict | Send the conflict to the Lead; reconcile approved timeline/preferences explicitly, then validate again. |
| Malformed preferences or stale audio fingerprint | Preserve the file; request correction/re-handoff. Do not fall back or rewrite revisions to pass. |
| Missing Playwright/browser/FFmpeg | Inspect the resolved local package/binary and version; perform only authorized scoped setup. |
| Readiness timeout or rejected Promise | Inspect page errors and startup code. Provide a real ready Promise; fix failed fonts/images/setup instead of adding sleeps. |
| HTTP 400/403/404 for an asset | Check raw path, intended public root, supported extension and symlink target; copy an approved public asset into media/assets rather than weakening confinement. |
| Repeated seeks differ or frames appear shifted | Remove clocks, random state, incremental transforms and unfinished async drawing; replay the same requested time. |
| Loop boundary mismatch | Use content/meta loop intent and periodic poses; inspect the actual seam. The timeline schema has no loop field. |
| Encoder/probe failure | Retain source and diagnostics; inspect codec/filter support and approved settings. Do not deliver a partial output as final. |

## Deliver an editable package

Give the Lead the MP4, selected stills/contact sheet, captions/transcript when required, and editable source: timeline, nonsecret preferences, content, HTML/SVG/canvas/modules, approved public assets and required asset/licence records. Include the project package manifest/lockfile when used, runtime versions and a route to the compatible native/companion Skill resources. Retain render evidence and enough frame artifacts to reproduce a defect.

Exclude credentials, `.env`, Git internals, caches, browser profiles and node_modules/runtime binaries from the source archive. Runtime licence obligations are distinct from original Skill source licensing. List missing companion/host bindings as prerequisites; verify actual installed resources before claiming runnable delivery.
