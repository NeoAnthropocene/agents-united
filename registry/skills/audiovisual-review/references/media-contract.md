# Shared media handoff v1

Original agents-united shared media contract. The validator is
`../scripts/review.mjs`; it runs on Node >=24 with no third-party dependencies. Native,
Remotion and local/API/hybrid sound must use this contract. A schema pass is not approval,
a successful render, a measurement, listening evidence or a rights determination.

## Timeline

`schemaVersion: 1`, a stable nonempty `revision`, integer `fps` (1..240),
`totalFrames` (1..2160000), even `width`/`height` (2..8192), `scenes` and `cues`.
Fractional frame rates are not supported by v1; do not round a destination spec silently.
Resolve that requirement with Chris before producing a timeline. Defaults are 1920x1080,
60 fps. Each scene has `id`, `startFrame`, `endFrame`; scenes are ordered and cover
`[0,totalFrames)` without gaps or overlap. Scene and cue IDs are globally unique,
ASCII letters/digits/dot/underscore/hyphen, beginning with a letter or digit, <=128 chars.
Cues have the same range fields plus `kind: vo|music|sfx`; each `vo` has approved `text`.
All frame ranges are nonempty, integer, half-open and within the film. Sound cues may
overlap. Separate styling and asset treatments belong in production content files.

`timeline --timeline file.json` returns `timelineFingerprint` and duration in seconds.
The fingerprint is `sha256:` plus the SHA-256 of UTF-8 `JSON.stringify` of these fields
in this exact order: schemaVersion, revision, fps, totalFrames, width, height, scenes, cues.
Scenes retain order and fields id/startFrame/endFrame. Cues sort by ID using ASCII string
comparison and fields id/kind/startFrame/endFrame/text (absent text becomes null).
Input JSON property order is irrelevant. Revision, timing, copy, IDs or canvas changes
invalidate the handoff. Use the exported `timelineFingerprint()`; do not manually stamp
an old audio handoff with a new hash. Sound must inspect changed inputs and reissue it.
The hash detects drift; it does not cryptographically establish approval or authorship.

## Audio Manifest

Required fields: `schemaVersion: 1`, `timelineRevision`, `timelineFingerprint`, `fps`,
`totalFrames`, `sampleRate: 48000`, `channels: 2`, `master` (a project-relative WAV path
**string**), `stems`, `cues`, `measurements`, `provenance`. Timing identity must match the
timeline exactly. Optional `stemPolicy` is text; optional `review` is descriptive only.

- Stems: `{id?,kind,path}`; kind is vo/music/sfx; each has its own WAV path, not the master.
  Stems are full-film-duration, aligned at frame zero. Do not normalize stems independently.
- Cues: `{id,path,startFrame,endFrame}`; exactly one per approved timeline cue. Each path
  identifies a stem of the same kind. These ranges describe the audible placement already
  embedded in the aligned stem; do not add the start delay again during integration.
- Provenance: one `{cueId,source,evidence}` per cue. `source` names a preserved local source
  file; `evidence` describes rights, consent and generation/editing process. A text assertion
  is not licence verification; retain actual documents and provider receipts separately.
- Measurements: `{scope:'master',integratedLufs,truePeakDbtp}` with finite numeric values.
  Optional numeric fields: loudnessRange/threshold/offset. Optional `evidence` is a local
  measurement-log path. Default acceptance: -16 LUFS +/-1, true peak <=-1 dBTP. Explicit
  destination overrides use `--target-lufs`, `--tolerance-lu`, `--max-true-peak`.
  Silence/nonfinite values cannot be declared a finished normalized mix.
- Optional review: `{numerical?:boolean,listening?:string,muxedAudio?:string}`. The helper
  never trusts these as evidence of a check it performed.

For sample alignment, use `round(frame * sampleRate / fps)` for each endpoint; the sample
length of a cue is endSample minus startSample. Do not round duration and start separately.
Audio finishing checks actual WAV sample counts/format and full-duration stems; final
review checks the muxed file. Metadata validation alone cannot establish any of those physical properties.

## Captions and paths

Speech requires SRT with sequential numeric block IDs, `HH:MM:SS,mmm --> HH:MM:SS,mmm`,
and nonempty text. Blocks may split a cue; their combined words must match approved text
after whitespace normalization, and the group must cover the cue within one frame.
Blocks are ordered, non-overlapping, in the film, and assigned once to speech cues.
Overlapping voices need a revised caption handoff, not guessed speaker timing.

Manifest paths are relative to the selected **project root**, not the manifest folder.
Windows separators and spaces are accepted. Absolute/drive/UNC/URL/ADS paths, traversal,
reserved Windows device names, env paths and encoded traversal are refused. Inputs are
explicit JSON/SRT files capped at 1 MiB. Unknown schema fields are rejected without echoing
their contents. No `.env` is read, no settings/provider files are discovered implicitly.
With `--project <absolute-root>`, inputs and referenced media must resolve inside that root,
including through links/junctions; referenced media must exist as regular files.
Without it, path syntax is checked and file existence remains unverified.

## Commands and evidence

```text
node /absolute/path/to/review.mjs timeline --timeline /project/media/timeline.json
node /absolute/path/to/review.mjs contract --project /project --timeline media/timeline.json --manifest media/audio-manifest.json --captions media/captions.srt
```

Exit 0 means structural acceptance; exit 2 means validation/input failure. Stdout is one
JSON object: schemaVersion, ok, errors (`code`, `path`, `message`), plus fingerprint and
verification fields when applicable. Save the exact result beside the handoff. Contract
reports always label measurements `reported-only`; audio decoding, muxed-audio checks,
visual review and listening remain `unverified`. Existing file checks say only
`present-within-project`. `audio.revision`/`audio.fingerprint` require a new Sound handoff;
`audio.cueAlignment` requires correcting cue placement; `captions.*` routes to approved
copy/timing owners; `path.*`/`file.*` require safe local assets. Do not suppress a code.

Worked example: `assets/timeline.example.json`, `assets/audio-manifest.example.json` and
`assets/captions.example.srt` describe a two-second synthetic handoff. Measurement numbers
are illustrative fixture data, not measured audio; no WAV is shipped with them. Omit
`--project` when validating this metadata-only example. Anti-pattern: treating that pass
as a finished master. Later production jobs must add real export/measurement evidence.

Both renderers and audio finishing consume these shared validators; do not fork a weaker
schema. Coordinated work also uses the [project contract](../../workflow-agency-motion-production/references/project-contract.md).
Install required sibling Skill resources in their source-relative layout before execution.
Read [acceptance](acceptance.md) for decoded-media, listening, visual and provenance review.
