# Pilot 041 Human-Review & Measured Sync/Range Report + Plan 043 Job V5 Evaluation Protocol

- **Date**: 2026-10-29
- **Related Plans & ADRs**: [Plan 040](../../plans/040-signature-shot-motion-prompts.md), [Plan 041](../../plans/041-remotion-official-skills-addon.md), [Plan 042](../../plans/042-spec-driven-sound-routing-and-pilot-041.md), [Plan 043](../../plans/043-reference-led-visual-craft-gate.md), [ADR 0059](../adr/0059-sound-model-catalogue-capability-probe-and-remotion-skills-addon.md), [ADR 0060](../adr/0060-reference-led-visual-craft-and-final-mux-sync-gate.md)
- **Status**: Pilot 041 human review & measured root-cause audit **VERIFIED**; Plan 043 Jobs V0–V4 **IMPLEMENTED & VERIFIED**; Plan 043 Job V5 live Host evaluation **PREPARED, UNVERIFIED** (requires maintainer-started Host session per [`AGENTS.md`](../../AGENTS.md)).

---

## 1. Dated Maintainer Human Review of Pilot 041 (2026-10-29)

Both Pilot 041 deliverables (`C:/github/agents-united/scratch/pilot-041/native/media/exports/final-16x9.mp4` and `C:/github/agents-united/scratch/pilot-041/remotion/media/exports/final-16x9.mp4`, 300 frames at 30 fps, `1920x1080`, `-16.0 LUFS`) passed 21/21 mechanical contract and loudness checks. On 2026-10-29, the maintainer watched and listened to both exports and recorded the following human review verdict:

| Dimension | Native Lane (`scratch/pilot-041/native`) | Remotion Lane (`scratch/pilot-041/remotion`) | Maintainer Verdict |
| --- | --- | --- | --- |
| **Mechanical / Contract QC** | `21/21` passed (`yuv420p(tv, bt709)`) | `21/21` passed (`yuvj420p(pc, bt709)` flagged) | Mechanical pass is **not** creative acceptance |
| **Sound FX & Background Bed** | Deterministic local PCM synthesis (`synthesize-chicken-audio.mjs`) | Deterministic local PCM synthesis (`make-audio.mjs`) | **Rejected**: sound FX and background sound are very basic |
| **Perceived A/V Synchronization** | Visual cuts/actions align closely with audio cues | Noticeably unsynchronized against audio hits | **Native accepted on sync; Remotion rejected on sync** |
| **Visual & Motion Craft vs. X Reference Leads** | Basic flat vector geometry, crude bird proportions, uniform surface treatment | Basic flat React/SVG shapes, ungrounded surface/lighting | **Rejected in both lanes**: creative quality is low against the X examples |
| **Official `remotion-agent-skills` Pack Efficacy** | N/A | Not installed in `scratch/pilot-041/remotion` (installed in `scratch/pilot-040` only) | **Unverified** in Pilot 041 |

---

## 2. Measured Post-Mortem Audit of Pilot 041 Deliverables (2026-10-29)

To replace speculation with deterministic measurements, both `audio/master.wav` and `exports/final-16x9.mp4` in `scratch/pilot-041/{native,remotion}` were decoded via `ffmpeg-static` at 48 kHz mono and cross-correlated (`10 ms` RMS windows):

### 2.1 Container & AAC Mux Lag
- **Native MP4 vs. `master.wav`**: `0.00 ms` (`0.00` frames) lag, normalized cross-correlation `0.999979`, `start_pts = 0`, `start_time = 0.000000`.
- **Remotion MP4 vs. `master.wav`**: `0.00 ms` (`0.00` frames) lag, normalized cross-correlation `0.999982`, `start_pts = 0`, `start_time = 0.000000`.
- **Conclusion**: AAC encoding and MP4 muxing caused **zero** synchronization drift in either lane.

### 2.2 Per-Cue Onset & Visual Action Offset Table (`30 fps`, `1 frame = 33.33 ms`)

| Cue ID | Canonical `timeline.json` Frame (`t`) | Native Audio Peak Frame | Native Visual Beat Frame | Native Signed Offset (`Visual - Audio`) | Remotion Audio Peak Frame | Remotion Authored Visual Beat Frame (`Composition.jsx` / `motion-prompt.json`) | Remotion Signed Offset (`Visual - Audio`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cue-crack` | `37` (`1.233s`) | `37.50` (`1.250s`) | `37` (`1.233s`) | **`-0.50f` (`-16.7 ms`)** | `37.50` (`1.250s`) | `33` (`1.100s`) | **`-4.50f` (`-150.0 ms` vs peak / `-75.0 ms` vs onset)** |
| `cue-hatch` | `62` (`2.067s`) | `62.48` (`2.083s`) | `62` (`2.067s`) | **`-0.48f` (`-16.0 ms`)** | `62.50` (`2.083s`) | `66` (`2.200s`) | **`+3.50f` (`+116.7 ms` vs peak / `+58.4 ms` vs onset)** |
| `cue-chick` | `128` (`4.267s`) | `128.00` (`4.267s`) | `128` (`4.267s`) | **`0.00f` (`0.0 ms`)** | `128.00` (`4.267s`) | `99` (`3.300s`) | **`-29.00f` (`-966.7 ms` vs peak / `-483.3 ms` vs window)** |
| `cue-grow` | `178` (`5.933s`) | `177.98` (`5.933s`) | `178` (`5.933s`) | **`+0.02f` (`+0.7 ms`)** | `177.98` (`5.933s`) | `198` (`6.600s` peak) | **`+20.02f` (`+667.3 ms` vs peak / `+333.7 ms` vs window)** |
| `cue-hen` | `225` (`7.500s`) | `225.49` (`7.516s`) | `225` (`7.500s`) | **`-0.49f` (`-16.3 ms`)** | `225.50` (`7.517s`) | `225` (`7.500s`) | **`-0.50f` (`-16.7 ms`)** |
| `cue-return` | `268` (`8.933s`) | `267.98` (`8.933s`) | `268` (`8.933s`) | **`+0.02f` (`+0.7 ms`)** | `267.98` (`8.933s`) | `225` (`7.500s` morph start) | **`-42.98f` (`-1432.7 ms` vs peak / `-716.3 ms` vs window)** |

### 2.3 Root Cause of Remotion `yuvj420p(pc)` Full-Range Video Stream
- In `registry/skills/remotion-production/scripts/project.mjs`, `renderStill` passed `imageFormat: 'png'`, whereas `renderMedia` passed `codec: 'h264', pixelFormat: 'yuv420p'` without `imageFormat`.
- `@remotion/renderer` defaults `imageFormat` in `renderMedia` to `'jpeg'`, which captures full-range (`0..255`) JPEG frames from the headless browser so FFmpeg tags the H.264 output stream `yuvj420p(pc, bt709)`.
- **Fix landed in Plan 043 (`project.mjs` + `review.mjs mux-sync`)**: `renderMedia` now explicitly passes `imageFormat: 'png', pixelFormat: 'yuv420p'`, and `review.mjs mux-sync` rejects unapproved `yuvj420p` full-range streams.

---

## 3. Plan 043 Job V5 Blind Evaluation Protocol & Scorecard Template (Prepared, Unverified)

To run Job V5 when authorized by the maintainer in a live Host session:

1. **Fixed Controls**:
   - **Model & Settings**: Sonnet-class baseline (`model: sonnet`, `effort: medium`), identical across Gate-Off (Control) and Gate-On (Treatment) arms. No Opus escalation or paid provider switch.
   - **Brief & Timebase**: 10 s (`300` frames at `30 fps`, `1920x1080`), same approved copy and 7 timeline cues, capped at 2 proof revision rounds.
   - **Host Evidence Collection**: Read the host's own session transcript via `npm run hostlib:session -- <session-id> --project <workspace>` (`docs/live-test-protocol.md`) to verify skill discovery/invocation (`installed` vs `discovered` vs `invoked` vs `used`), actual token/cost totals, and revision rounds.

2. **Blind Human Scoring Rubric (1–5 per dimension; Severe defect if any dimension <= 2)**:

| Dimension | Arm A (Blind Label) | Arm B (Blind Label) | Evidence / Frame Notes |
| --- | --- | --- | --- |
| **1. Reference-Relative Distinctiveness** | `unverified` | `unverified` | Compare against `referenceFrames` (`sha256` recorded) |
| **2. Silhouette & Proportions** | `unverified` | `unverified` | Inspect `silhouetteSeparation` crop |
| **3. Material & Light Integration** | `unverified` | `unverified` | Inspect `materialGrain`, `shadowContact`, `lightFalloff` crops |
| **4. Camera & Transition Choreography** | `unverified` | `unverified` | Inspect `motionProofs` (`startFrame`, `midFrame`, `endFrame`) |
| **5. Typography Contrast & Hierarchy** | `unverified` | `unverified` | Inspect `typographyEdge` crop; zero placeholder panels |
| **6. Sonic Performance & Final-Mux Sync** | `unverified` | `unverified` | `review.mjs mux-sync` (`|offsetFrames| <= 1.0`, `yuv420p` `tv`) + human listening |
| **Total Tokens / Cost / Revision Rounds** | `unverified` | `unverified` | Extracted via `npm run hostlib:session` |
