# Audio handoff and loop-seam review — 2026-11-04

This local review follows Plan 044 action 3. The accepted Native and Remotion projects were read only. No Host session, model, provider, installation or paid generation was started. The historical report records an earlier Native in-memory timeline deviation followed by a rebuild against canonical r3a; this review does not reconstruct that specific intermediate timeline or claim its precise cause.

## Canonical binding

The mixer previously accepted a mix with no `timelineFingerprint`, requiring only the revision and exact cue IDs, kinds and ranges. A same-revision change to a scene or canvas could therefore pass input validation, after which the output manifest was stamped with the new timeline fingerprint. This is a general input-binding gap, not proof that it caused the historical Native deviation. The retained Remotion mix-d already has a matching fingerprint.

`validateMix` now requires the fingerprint and compares it to the complete supplied timeline before processing or creating outputs. Existing unbound mixes must be reviewed against the approved timeline and explicitly updated; a matching fingerprint detects drift but does not prove approval or authorship. The shipped example now binds to its example timeline. The new regression changes width while leaving revision and cues unchanged, checks missing and stale fingerprints are rejected, and checks an explicitly rebound mix passes. On Node 24 the pre-fix run exited 1 with the intended missing-fingerprint assertion failing; an additional fixture required rebinding after its intentional cue-ID edit. After the fix and fixture correction, `node --test tests/skill-scripts/media-audio.cases.mjs` exited 0, 19/19 tests. Example validation exited 0. These checks do not establish real media playback or Host behavior.

## Remotion bed seam

The retained `remotion/audio/mix-r4/cue-1-cue-bed.wav` SHA-256 is `b48b5c6c2dab296db95e3982ccfc6ce0e9ced2e6ab6f3db7f3a097f2dc19b686`. The local diagnostic `scratch/audio-handoff-review-2026-11-04/seam.mjs` decodes that stem using the existing project-local FFmpeg to stereo float32 48 kHz without writing into the project. It exited 0 and verified 720,000 sample frames (15 seconds). It compares the first `[0,4800)` and last `[715200,720000)` frames, exactly 100 ms each:

| Channel | First RMS | Last RMS | First minus last | Absolute wrap sample step | Maximum ordinary adjacent step in first 100 ms |
|---|---:|---:|---:|---:|---:|
| L | 0.00371567 | 0.000663985 | 14.96 dB | 0 | 0.000488281 |
| R | 0.00358110 | 0.000698207 | 14.20 dB | 0 | 0.000396729 |

The two window levels differ substantially, consistent in direction with the handoff's approximate 16 dB note, but the exact result depends on channel, signal and window. Both first and last samples are zero, so this particular wrap has no single-sample amplitude discontinuity; that does not establish a seamless envelope, musical continuity, or audible quality. The measurement is of the aligned pre-master bed stem, not the combined mastered WAV or encoded AAC playback. It cannot establish a click or its absence by listening. A separate playback/listening and perceived-sync review remains **unverified**; the maintainer's scoped demo feedback remains recorded in the original report.

The earlier onset helper's first-above-5%-peak measurement is a threshold crossing, not audible onset, visual alignment or final-mux sync. The original report records the Remotion peeps diagnostic at +3.0125 frames and a separate 19-cue stem-to-mux correlation result. Neither is a substitute for human perceived-sync review. No seam modification or new render was made; if a revision is requested, Sound should audition the whole mix at the loop and choose an appropriately reviewed musical transition before re-exporting.

Reproduce the measurement from the repository root (use the bundled Node 24 path where `node` is older):

```powershell
node scratch/audio-handoff-review-2026-11-04/seam.mjs scratch/motion-hands-on-2026-11-04/remotion/node_modules/ffmpeg-static/ffmpeg.exe scratch/motion-hands-on-2026-11-04/remotion/audio/mix-r4/cue-1-cue-bed.wav
```
