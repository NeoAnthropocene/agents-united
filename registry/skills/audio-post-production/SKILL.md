---
name: audio-post-production
description: 'Use when approved supplied, recorded or generated audio needs editing, alignment, mixing, mastering and a versioned audio handoff. Trigger phrases: "finish audio", "mix narration and music", "aligned stems", "master soundtrack". Skip when the job only needs sound direction or new voice/music generation.'
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

## Overview & Purpose
Finish source audio into an inspectable stereo48k master, aligned pre-master cue stems and shared manifest. Preserve source identity and relative mixing decisions; technical acceptance and listening approval are separate deliverables.

## Execution Triggers
Use after sources, applicable copy, direction and the complete timeline are approved: Motion owns coordinated film timing; Sound owns Lead-approved standalone cue/timing records using the same canonical schema. Scratch mixes may expose timing problems before freeze; final handoffs require the exact approved revision/fingerprint. Route script changes through Chris/Kaan and timing changes through Chris to the applicable timing owner.

## Input/Output Requirements
Require originals/hashes, rights/consent/process records, selected edits, applicable approved transcript, canonical timeline and saved `media/project.json` when present. Return a new revision folder with stereo 48kHz WAV master, full-duration cue stems, pre-master, manifest, cue sheet, applicable transcript/captions and measured/listening QC evidence. Requires Node >=24, a suitable full FFmpeg and installed sibling `audiovisual-review/scripts/review.mjs`; no Remotion audio dependency.

## Step-by-Step Runbook
1. Capture source hashes and confirm rights/source selection and Kaan-approved exact words for included speech. Wordless cues need no Kaan approval or invented narration; mark absent speech artifacts not applicable with a reason. Use [finishing workflow](references/finishing.md) to audition and prepare new edited copies: trim, repair only when useful, resample, fade/crossfade and duck deliberately. The mixer does not supply general repair, looping or speech-aware duck automation.
2. Confirm shared timeline, paths and [handoff requirements](references/handoff-qc.md). Use complete [timeline](assets/timeline.example.json), strict [preferences](assets/project.example.json) and [mix](assets/mix.example.json) as schema examples, not approved assets. Saved fps/dimensions and loudness govern helpers; standalone schema-required video preferences stay unused defaults, requiring no renderer or video.
3. Run [tool capability preflight](references/tools.md) against the selected project tool before finishing. Inspect amix normalize, loudnorm and PCM encoders. Unsupported tools/presets require an approved processor or explicit preference change; a valid lower peak ceiling remains valid in the shared contract.
4. Fill cue tracks with approved IDs/kinds, exact half-open ranges, source trims, gains and nonempty provenance. Each approved cue appears exactly once. Use a fresh output folder and the helper below; preserve originals, preferences and existing revisions.
5. Inspect actual generated streams/sample counts and raw loudness logs, then validate the manifest/files against the saved preset. Stems retain alignment/gains without individual normalization; nonlinear mastering is a separate operation. Record [the QC report](assets/qc-report.md) and any partial failure.
6. Listen to the whole master for words, edit clicks, balance, masking, phase/mono, sync and tails. Send a measured change request through Chris if the approved duration/copy cannot fit. Numerical success cannot close listening review.
7. Deliver standalone WAV/sting directly to Chris after required applicable audio/provenance review. For film, hand Motion the approved revision/fingerprint and audio package; remeasure/listen to the actual mux, including tail/padding. Timing/copy changes invalidate dependent handoffs and either renderer export.

## Code & Config Exemplars
`node "${CLAUDE_SKILL_DIR}/scripts/mix.mjs" <absolute-project> media/timeline.json media/mix.json media/audio-final-r2 <absolute-ffmpeg>` runs the offline mixer. Other Hosts resolve this installed Skill's absolute root and append `scripts/mix.mjs`; never assume the working directory. Read [the worked example](examples/finish-local-film.md) before adapting inputs. All paths inside JSON are safe nonprivate project-relative paths.

## Edge Cases & Error Recovery
An existing output folder fails; choose a new revision. A failed run can leave partial files: preserve logs, do not call it a handoff, fix the cause and use another new folder. Missing cues, stale hashes, mismatched preferences, source escape links or nonfinite measurement stop dependent rendering. Silent/very short material may lack a finite integrated reading; ask for a suitable approved measurement/acceptance method rather than inventing numbers. Anti-patterns: normalizing stems independently, relabeling old audio with a new fingerprint and accepting metadata as decoded truth.

## Verification Checklist
- Originals, edits, preferences and approved revisions have preserved identities and provenance.
- Actual duration/channels/rate/alignment/gains and measured master target/tolerance/peak have evidence.
- Manifest uses the current shared schema; installed sibling and resource availability are checked separately.
- Master and applicable film mux review separate numerical and named listening findings. Required missing checks stay **unverified** and block acceptance; irrelevant checks need a reason.
- Chris receives standalone audio; Motion/Chris receive film audio, with exact revision/fingerprint, applicable transcript/captions, provenance and remaining decisions.
