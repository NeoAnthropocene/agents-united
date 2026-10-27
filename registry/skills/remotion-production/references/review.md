# Export inspection, failure recovery and evidence limits

Read after an export attempt or before delivery. Save exact commands, raw logs, actual
process exits, artifact paths/hashes and dependency/browser versions. A process exit is
not an encoded-media inspection or creative approval.

## Inspect the actual output

The helper writes `video.mp4`, stills at distinct indices from 0, floor(N/2) and N-1,
and `render-evidence.json` into its exclusive output folder. It leaves encoded inspection,
visual review, listening and added async-media readiness unverified. A failure retains
partial output and `render-failure.json` with the stage; do not deliver partial files as final.

Use an available local probe, for example:

```text
ffprobe -v error -count_frames -show_entries stream=codec_name,pix_fmt,color_range,color_space,width,height,avg_frame_rate,nb_frames,nb_read_frames,sample_rate,channels,start_time,duration -of json "<output>/video.mp4"
```

Require approved H.264 dimensions, integer timebase fps, N video frames and N/fps duration;
record actual pixel format/color range/color space rather than copying requested settings.
If the destination requires limited range or another format, make that an explicit export
decision and verify actual output. This helper's requested `yuv420p` alone does not prove
limited-range output. Inspect the actual AAC track, stereo/48 kHz, start time, duration,
decoded tail, measurements and sync; do not describe compressed audio as sample-exact PCM.
Keep source and muxed measurements separate and evaluate actual destination tolerances.

## Review levels

1. Numerical proof: actual codec/fps/dimensions/count/duration/range, repeat-frame hashes,
   audio format/measurement/alignment and any loop-boundary comparison.
2. Decoded-sample inspection: name the decoded video frames and observations on clipping,
   text/brand legibility, asset resolution and safe areas. Source PNGs alone are insufficient.
3. Full playback: pacing, transitions, seam, crop, captions, accessibility and destination
   behavior. Record reviewer and scope; stills cannot establish it.
4. Listening: approved narration intelligibility, music balance, SFX/transients, sync and
   seam. Metadata and synthetic tones do not establish subjective audio quality.

Keep a separate dated review record. Do not overwrite automatically unverified fields
because static gates passed, and never invent a human reviewer or creative acceptance.

## Diagnose without weakening the gates

| Symptom | Next action |
| --- | --- |
| Route/fps/dimensions conflict | Reconcile approved preferences/timeline through the Lead. |
| Missing licence facts or evaluation used for production | Obtain actual owner/representative production facts; preserve source. |
| Missing exact local packages/browser | Inspect the declared scoped setup/version; do only authorized setup. |
| Stale timeline/audio snapshot or copied-master hash | Obtain the matching handoff and refresh explicitly; do not forge provenance. |
| Actual composition metadata differs | Repair `AgencyMotion`/metadata or obtain an approved timeline change; never bypass validation. |
| Font/image failure or inconsistent repeated frame | Fix readiness/clock/random state and inspect affected output. |
| Interrupted refresh | Inspect lock/history/staged files and active process before retrying. |
| Existing/failed output directory | Retain artifacts and use a new safe directory whose parent exists. |

## Limits of scoped technical evidence

A Windows synthetic-signal proof used Remotion 4.0.538 and Chrome 155.0.8059.86 at 640x360/60fps. It confirmed a one-second H264 render, repeated-frame determinism, stereo48k AAC and measured source/mux levels. Requested limited-range yuv420p was not achieved: the probe reported full-range yuvj420p/pc/bt470bg. Decoded AAC carried a 128-sample tail. A separate 60-to-90-frame revision preserved source/dependency/prior-artifact hashes and rendered without reinstalling. Only selected decoded frames were visually inspected.

Those observations demonstrate bounded technical mechanics, not current-project acceptance. Full playback, listening, creative approval, production entitlement, newly added async fonts/media and other-host behavior remain **unverified**. Do not infer 1080p production quality or behavioral-evaluation results. For each delivery collect the actual tool versions, output hashes, raw probe/measurement logs and human review evidence described above.
