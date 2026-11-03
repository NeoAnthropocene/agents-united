# Pilot 041 Human-Review & Measured Sync/Range Report + Plan 043 Job V5 Evaluation Protocol

- **Date**: 2026-10-29
- **Related Plans & ADRs**: [Plan 040](../../plans/040-signature-shot-motion-prompts.md), [Plan 041](../../plans/041-remotion-official-skills-addon.md), [Plan 042](../../plans/042-spec-driven-sound-routing-and-pilot-041.md), [Plan 043](../../plans/043-reference-led-visual-craft-gate.md), [ADR 0059](../adr/0059-sound-model-catalogue-capability-probe-and-remotion-skills-addon.md), [ADR 0060](../adr/0060-reference-led-visual-craft-and-final-mux-sync-gate.md)
- **Status**: Pilot 041 human review & measured root-cause audit **VERIFIED**; Plan 043 Jobs V0–V5 **IMPLEMENTED & HEADLESS-EVALUATED ON CLAUDE CLI** (`105e5468-1bf2-4310-89b8-219555facfe9` at `0.2362 USD` + `e7962c8a-5484-45fb-a09c-796dcf212f86` at `0.7434 USD`, total `0.9796 USD`); human listening/viewing sign-off on `chicken-lifecycle-r4.mp4` remains `unverified`.

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

## 3. Plan 043 Job V5 Blind Evaluation Protocol & Headless Claude CLI Evaluation Record (2026-10-29)

Following the maintainer's merge of PR #212 into `dev` (`d978fb2`) and authorization to run headless Claude CLI verification (`claude -p --agent agency-motion-designer --model sonnet --effort medium --permission-mode auto`), `digital-agency` and `remotion-agent-skills` were installed into `C:/github/agents-united/scratch/pilot-041/remotion` (`81` skills, `12` agents, `7` workflow skills healthy via `agents doctor --host claude`). Two bounded headless sessions were executed and inspected via `npm run hostlib:session`:

### 3.1 Session Ledger & Skill Invocation Matrix (`installed` vs `discovered` vs `invoked` vs `used`)

| Session ID | Scope | Model & Turns | Host-Recorded `Skill` Invocations | Host-Recorded `Read` View Evidence | Recorded Cost (USD) |
| --- | --- | --- | --- | --- | --- |
| `105e5468-1bf2-4310-89b8-219555facfe9` | **Probe A**: Official `remotion-*` skill routing, subordination & `remotion-production` eval ID 4 (optional Studio) | `claude-sonnet-5-5` (2 prompts, 8 in / 2,325 out / 127,091 cache-read) | `remotion-production`, `remotion-best-practices`, `remotion-markup`, `remotion-studio` | `.claude/skills/remotion-production/references/{studio.md,official-agent-skills.md}` | **`0.2362 USD`** (`0.1935` + `0.0428`) |
| `e7962c8a-5484-45fb-a09c-796dcf212f86` | **Probe B**: Plan 043 Craft/Sync/Range Gate + Remotion r4/r4b render (`chicken-lifecycle-r4.mp4`) | `claude-sonnet-5-5` (1 prompt, 34 turns, 44 in / 19,619 out / 1,796,016 cache-read) | `remotion-best-practices`, `remotion-markup`, `remotion-production`, `motion-design-direction`, `audiovisual-review` | `media/references/ref-full-circle-420.png`, `media/proofs/candidate-400.png`, `media/proofs/signature-board-400.png`, `media/proofs/motion-hen-turn-sheet.png` | **`0.7434 USD`** |
| **Total** | — | — | All 5 target skills invoked & applied | 4 image artifacts viewed via `Read` | **`0.9796 USD`** |

### 3.2 Control (r3, Gate-Off) vs. Treatment (r4b, Gate-On) Comparison on `scratch/pilot-041/remotion`

| Dimension | Control: Pilot 041 r3 (`media/remotion/out-r3/video.mp4`) | Treatment: Plan 041+043 r4b (`media/out/chicken-lifecycle-r4.mp4`) | Verification Evidence |
| --- | --- | --- | --- |
| **1. Official `remotion-agent-skills` Status** | Not installed (`0` `Skill` calls) | Installed, discovered, invoked (`remotion-best-practices`, `remotion-markup`, `remotion-studio`) and used | `npm run hostlib:session -- e7962c8a-5484-45fb-a09c-796dcf212f86` |
| **2. Viewed Reference Frame & Craft Spec** | None (`referenceFrames` absent) | `media/references/ref-full-circle-420.png` (`sha256:a8a0dbff...`) viewed via `Read`; 8-key analysis + `shotMapping` (`hen`) | `check-prompt-spec.mjs --require-craft-gate --timeline` → `ok: true` (exit `0`) |
| **3. Material Passes (`grain`, `gradientMesh`, `depthBlur`, `lightWrap`)** | Unspecified flat SVG fills | Scoped per layer/frame range: `feTurbulence` grain (`seed=4041`, `0.05` opacity), dawn/solar gradient mesh, `feGaussianBlur(2)` foreground grass, orange solar rim glow (`#F28C28`) | `Composition.jsx` lines `22-24, 91, 190-193, 215` + 4 crop PNGs in `media/proofs/crops/` |
| **4. Side-by-Side Proof Review & Reproof Defect Catch** | Text-only `proof-review.md`; missed lone grass blade at `x≈490` and `0.90` pull-back scale | Side-by-side `signature-board-400.png` (`sha256:2cd3433d...`) viewed in round 1 (`out-r4`), **caught lone inherited grass blade at `x≈510`**, fixed in `Composition.jsx` (`f < 300`), and re-rendered in round 2 (`out-r4b`) | `media/specs/proof-comparison.json` (`round: 2, maxRounds: 3`, defects `d1-lonely-blade`, `d2-end-line-late`, `d3-pullback-scale` resolved) |
| **5. Encoded Pixel Format & Colour Range** | `yuvj420p(pc, bt470bg)` full-range JPEG frames | **`h264 (High), yuv420p(progressive), 1920x1080, 30 fps`** (`imageFormat: 'png'`) + `aac 48000 Hz stereo` | `ffmpeg -i media/out/chicken-lifecycle-r4.mp4` + `verify.mjs both` (`21/21` PASS) |
| **6. Beat-to-Cue Alignment & Final-Mux Sync** | Authored beat drift up to `-42.98f` (`-1432.7 ms`); `"Free to roam."` started at frame `378` vs cue `357` | All 7 discrete cues aligned in `beatGrid.events` and `Composition.jsx`/`motion.mjs` (`0, 60, 105, 195, 285, 357, 405`); `muxLagMs: 0`; stem-to-mux offsets `0.0` to `-0.001` frames; surfaced internal stem envelope lead-ins in `audio/specs/*.shape.json` (`+3f` at `105`, `+6.8f` at `195`, `+6f` at `285`) | `review.mjs mux-sync --timeline media/timeline.json --manifest audio/manifest.json --sync media/specs/mux-sync.json` → `ok: true` (`listeningReview: "unverified"`, `perceivedSyncReview: "unverified"`) |
| **7. Human Creative & Listening Sign-Off** | Rejected by maintainer (2026-10-29) | `unverified` (awaiting maintainer playback of `media/out/chicken-lifecycle-r4.mp4` and `media/proofs/signature-board-400.png`) | Honest boundary preserved in `media/specs/mux-sync.json` |
