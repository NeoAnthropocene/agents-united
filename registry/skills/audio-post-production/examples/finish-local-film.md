# Worked example: finish a local 12-second film

The three JSON files in `assets/` form a fictional schema example. No source files, permission, client approval, processing result or listening finding is provided. Copy them into the selected project only after adapting the brief; preserve any existing `media/project.json` rather than replacing it with the example. The timeline has full dimensions/scenes, 720 frames at 60fps and three cues. The VO source is a deliberately prepared continuous 10.6-second edit containing all approved phrases and intended gaps; it is placed at frame 24. The mix does not invent phrase-level edit behavior.

1. Inspect supplied originals, actual text, rights and hashes. Prepare new music/VO edits in an approved tool; print the intended duck/fade edits and keep the edit log. Confirm that the VO and all tails fit the approved cue rather than relying on automatic truncation/padding.
2. Ask Motion/Chris to approve the exact timeline. Calculate its canonical fingerprint with the installed sibling reviewer; optionally include that value in the mix as `timelineFingerprint`. Do not use a sample hash from another job. Saved preferences in the example specify Native/local, 60fps 1920x1080, no providers and -16 LUFS +/-1, <=-1 dBTP.
3. Preflight the actual full project FFmpeg for amix normalize, loudnorm ranges and both PCM encoders. Then run the installed mixer:

```text
node "${CLAUDE_SKILL_DIR}/scripts/mix.mjs" <absolute-project> media/timeline.json media/mix.json media/audio-final-r1 <absolute-ffmpeg>
```

4. Capture the native exit and raw logs. Existing output paths fail; a corrected run uses a new revision. For this timebase, each full-duration source stem/pre-master/master should decode to `720*48000/60 = 576000` sample frames, stereo48k. The music is active [0,720), VO [24,660), effect [450,474); boundary sample frames are 0/576000, 19200/528000 and 360000/379200 respectively. Compare decoded silence boundaries and retained -10/-3/-12 dB gains; these are example mix choices, not approved balance or a claimed achieved measurement.
5. Check the generated manifest against the exact timeline/preferences and existing media files. Inspect the final master measurement: abs(LUFS - target) <= tolerance and true peak <= ceiling. Do not copy desired -16/-1 values into reported measurements. The helper remeasures the master; this still needs listening for words, masking, noise, clicks, sync and tails.
6. Complete the QC template, source/rights ledger and exact transcript/caption marks. Send Motion the approved revision/fingerprint, master, full-duration pre-master cue stems, manifest and evidence. Motion integrates into either renderer and returns the actual mux for remeasurement and listening. Record compressed padding separately from presentation duration.

The stems preserve relative gains and sum to the pre-master under the declared policy. Separate loudnorm processing means their sum need not reproduce the finished master. A valid manifest proves declared schema/path consistency, not decoded duration, legal permission or listening quality. Anti-patterns: turning down all stems via automatic normalization, overwriting a failed revision, or calling technical test tones a good narration/music performance. All production/measurement/listening results for this fictional example remain **unverified**.
