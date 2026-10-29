---
name: audiovisual-review
description: 'Use when a motion or audio deliverable needs timeline, soundtrack, caption, creative and provenance acceptance before handoff. Trigger phrases: "review the film", "check audio sync", "validate the audio manifest", "delivery QC". Skip for a static-only brief or for producing animation, narration or a mix.'
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

## Overview & Purpose
Review the actual delivery against approved copy, timing, assets and destination choices. Keep structural checks, decoded-media measurements, visual inspection, listening and rights evidence separate so a valid JSON report never masquerades as a finished film.

## Execution Triggers
Use before Motion or Sound hands an export to Chris, after a changed timing/copy/audio handoff, or for QA delivery failures. Review included assets only; Sound-only needs no video, storyboard or fabricated speech, and silent work needs no audio measurements.

## Input/Output Requirements
Require the accepted Media Request, applicable storyboard/copy, timeline or Sound cue record, saved preferences, actual exports, Sound manifest/master/stems, captions/transcript and source/rights records. Return severity, frame/time, evidence, owner and acceptance state in [the review record](assets/review-record.md). Node >=24 runs structural checks; decoding/listening require local tools and a reviewer.

## Step-by-Step Runbook
1. Read [the media contract](references/media-contract.md). Confirm the exact revision, computed fingerprint, fps/frame bounds, dimensions and saved destination loudness. Reject stale audio or altered copy; ask Motion/Sound to reconcile and reissue rather than relabel old evidence.
2. Run the existing helper below on explicit inputs. With `--project`, referenced media must be present and resolve inside the selected root. Without it only path syntax is checked. Save stdout and the actual exit: 0 accepts structure, 2 reports validation/input failure.
3. Read [the acceptance procedure](references/acceptance.md). Inspect applicable decoded video/audio duration, rate, channels, cues, codec (`yuv420p` limited range `tv`) and compressed tail; measure the master and any mux, and validate final-mux cue offsets with `mux-sync` (`|offsetFrames| <= 1.0`). Defaults are -16 LUFS +/-1, true peak <=-1 dBTP; apply saved overrides consistently.
4. For included video, inspect the side-by-side `proofComparison` board, watch the complete export and inspect cuts, cue arrivals, text holds and endpoints. Check crop/safe areas, fonts/assets, legibility, continuity, claims, brand fit, captions and reduced-motion alternatives. Record what was viewed.
5. Listen to the complete master and applicable mux for words/pronunciation, masking, edit clicks, balance, silence, mono/phase, sync and tails. A waveform, reported number or successful encode cannot close listening review.
6. Inspect provenance and actual consent/licence documents for every source, voice/reference and generated asset. Route claims/rights to Compliance and Copy, sound defects to Sound, animation/integration defects to Motion. Chris consolidates scope or approval questions.
7. Recheck affected outputs after correction and hand Chris the export/source paths, current revision/fingerprint, findings and evidence. Mark unperformed checks **unverified**; no publication, provider call or creative approval follows from a helper pass.

## Code & Config Exemplars
`node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" contract --project <absolute-project> --timeline media/timeline.json --manifest media/audio-manifest.json --captions media/captions.srt` checks structure and file presence. `node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" mux-sync --timeline media/timeline.json --manifest media/audio-manifest.json --sync media/specs/mux-sync.json` validates measured final-mux cue offsets (`<= 1.0` frame) and `yuv420p` limited colour range (`tv`), rejecting `timeline-arithmetic` sync claims and unapproved `yuvj420p` full-range output. For a saved custom target append `--target-lufs <value> --tolerance-lu <value> --max-true-peak <value>`; this CLI has no `--preferences` flag. Other Hosts resolve this installed Skill's absolute root before appending `scripts/review.mjs`.
Before any decoded inspection, resolve and capability-verify the tool that will do it: `node "${CLAUDE_SKILL_DIR}/scripts/ffmpeg.mjs" resolve --project <absolute-project>` then `verify --project <absolute-project>`. Use the absolute path it reports for `--ffmpeg` and for the finisher's binary argument. A missing or incapable build is a project-local `ffmpeg-static` request through Chris; a machine-wide install or PATH edit needs the user's explicit consent. See [FFmpeg provisioning](references/ffmpeg.md).
Read [the worked example](examples/review-handoff.md) before adapting [timeline](assets/timeline.example.json), [manifest](assets/audio-manifest.example.json) and [captions](assets/captions.example.srt). Their numbers are illustrative and no WAV is shipped; omit `--project` for this metadata-only example. `timeline --timeline <file>` returns the canonical fingerprint; `request --request <file>` validates a Media Request.

## Edge Cases & Error Recovery
Preserve failed exports, source identities and raw logs. `audio.revision`/`audio.fingerprint` need a new Sound handoff; `captions.*` needs approved copy/timing reconciliation; `file.*`/`path.*` needs safe actual files. Do not suppress errors or guess missing measurements. Anti-patterns: accepting a filename extension as codec evidence, declaring rights from provenance prose, approving sync without playback and stamping a changed timeline onto an old mix.

## Verification Checklist
- Exact approved revision/fingerprint, copy, canvas and saved destination preset match the delivery.
- Structural result and file presence are reported separately from decoded properties, `mux-sync` cue offsets/colour range, and measured master/mux levels.
- Full visual/listening review, captions, accessibility and rights have named evidence or **unverified** status.
- Findings have owners; Chris receives current artifacts, remaining decisions and the recheck scope.
