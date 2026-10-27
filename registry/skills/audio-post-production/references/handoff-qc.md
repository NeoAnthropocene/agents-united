# One shared handoff, separate evidence claims

The sibling [media contract](../../audiovisual-review/references/media-contract.md) and [project preferences](../../workflow-agency-motion-production/references/project-contract.md) are authoritative. The mixer imports sibling `audiovisual-review/scripts/review.mjs`. An installed pack must supply that sibling; this folder's own-resource copy is not proof of a complete host installation or binding.

Canonical timeline v1 includes revision, integer fps/totalFrames, even width/height, contiguous ordered scenes and stable globally unique scene/cue IDs. Cues are `vo|music|sfx`, half-open and in range; VO includes exact approved text. Fingerprint with the shared helper. Motion owns coordinated film timing; Sound owns the Lead-approved standalone cue/timing record and uses this same complete schema when helpers need it. Schema-required scene/canvas/video fields do not require standalone visuals, a storyboard or renderer. Revision, canvas, copy or timing changes invalidate the manifest/captions and any dependent Native and Remotion renders. Do not manually stamp an old result with a new fingerprint.

## Deliver and validate

The emitted manifest declares `schemaVersion:1`, timeline revision/fingerprint, matching fps/totalFrames, `sampleRate:48000`, `channels:2`, a project-relative WAV `master` path string, aligned `stems:[{id?,kind,path}]`, cues with paths/ranges, `measurements:{scope:'master',integratedLufs,truePeakDbtp,...}`, and one `{cueId,source,evidence}` provenance record per cue. Keep paths local/nonprivate. The helper writes its manifest only after shared manifest/file checks pass. Additional production records belong in the cue sheet/QC report, not invented canonical JSON keys.

Validate the exact final manifest against the actual saved preset with the shared functions. The review CLI does not read project preferences: pass the saved values explicitly as `--target-lufs`, `--tolerance-lu` and `--max-true-peak`; omitted flags choose shared defaults. Use `--project <absolute-project>` for path existence/confinement and supply final speech captions with `--captions` when speech is included. For wordless cues, mark speech, transcript/captions, pronunciation and voice-consent records not applicable with a reason; no invented narration or Kaan approval. Included speech keeps Kaan-approved exact words and required voice consent, and every source retains rights review. The CLI's file/schema checks do not decode audio, recompute loudness or listen. Retain exact commands/exits and the corresponding artifact hashes.

| Evidence | What it can establish | What it cannot establish |
| --- | --- | --- |
| Valid schema/fingerprint/paths | Declared identity, cue coverage, reported preset fit and safe referenced paths | Actual WAV contents, real approval, decoded timing or rights |
| Probe plus sample decode/alignment analysis | Actual rate/channels/duration, cue silence boundaries and gain behavior | Meaning, word correctness or good balance |
| Raw final loudness/true-peak measurement | Actual numerical target/tolerance/ceiling acceptance for that measured file | Human intelligibility, source permission or musical quality |
| Named timecoded listening review | Observed words, masking, edits, phase, sync, tails and creative fit | Universal playback conditions or legal clearance |
| Source/consent/licence records | Traceable permission evidence and review disposition | A blanket conclusion from a hash or model prompt |

## Standalone delivery and film integration review

Deliver the master, full-duration aligned cue stems, pre-master when requested, manifest, cue sheet, applicable exact transcript/captions, provenance and QC record. State the pre-master stem policy and printed automation; include sources/edits needed for revision. Standalone WAV/sting goes directly to Chris after required applicable audio/provenance review, with no Motion, renderer, video or mux prerequisite. For film, Motion receives the package for integration. Chris owns unresolved rights, approval and delivery decisions.

For coordinated film, after either renderer integrates the master, inspect the actual final presentation timebase/start/duration and listen for sync and tails. Re-measure muxed audio; AAC/lossy encoding may change sample values/peaks and add decoded padding. Distinguish presentation duration from raw decoded sample frames, report any tail, and verify it does not break the intended end. A WAV pass does not prove an AAC pass. Do not claim exact lossy sample equality or trim an unexplained tail blindly.

The QC report records numerical status, listening reviewer/findings and rights/creative status separately. If no listener ran, write **listening unverified** even when every numerical check passes. Required missing checks block acceptance; mark irrelevant checks not applicable with a reason. Technical tones/noise tests establish the measured pipeline behavior for those signals; they do not demonstrate speech, music or listening quality.
