# Motion event sidecar v1

For coordinated picture and sound, Motion identifies events after the picture action exists and verifies frames against actual animation math or viewed movement. This author-declared record is not automatic motion analysis or proof of frame accuracy. Sound validates the actual sidecar before final SFX that depend on picture. Independent sound design can proceed in parallel; sound-only work does not require a Motion event sidecar.

Create a project-relative JSON draft (all paths below are relative to the selected project):

```json
{
  "events": [
    {"id":"foot-left-1","frame":42,"kind":"footplant","cueId":"step-1"},
    {"id":"impact-1","frame":61,"kind":"impact"}
  ],
  "motionSources": ["src/Scene.tsx", "src/timing.ts"]
}
```

Use stable unique event IDs, integer zero-based frames in `[0,totalFrames)`, a short identifier for `kind`, and optional `cueId` that exists in the canonical timeline. List every picture source whose changes could affect these events; include relevant timing, animation and assets when they affect picture. Do not list audio sources merely because they are in the project. Both arrays are required and nonempty; events and sources have no additional fields. The draft is at most 1 MiB and sources must be existing, project-contained regular files.

```sh
node /absolute/path/to/audiovisual-review/scripts/motion-events.mjs capture --project /absolute/project --timeline media/timeline.json --input media/event-draft.json --out media/events-r1.json
node /absolute/path/to/audiovisual-review/scripts/motion-events.mjs validate --project /absolute/project --timeline media/timeline.json --events media/events-r1.json
```

The output parent must already exist; capture exclusively creates a new JSON file and never overwrites one. It records schema version, canonical timeline revision/fingerprint, fps and totalFrames, event entries, and each picture source path and SHA-256. `frameAccuracy` is always `unverified`; successful capture or validation checks structure, current timeline and current source bytes, not event correctness, human approval, listening, perceived sync or final media. The helper does not render, install, contact a service or modify source/audio files. It works for Native and Remotion picture sources and uses the existing canonical timeline fingerprint, not a second picture fingerprint.

Sound must use the actual validated artifact, not an unverified prose summary. A changed timeline (including cue changes) or any listed picture source invalidates the sidecar: Motion rechecks the event frames and captures a new artifact, and Sound reissues affected final SFX handoffs. An unchanged source list cannot detect an omitted dependency; Motion must choose complete sources. Validation does not establish that all events were included. Carry event ID and visual target frame separately from timeline window start, intentional audio lead-in and detected onset. Record actual detector/method, threshold, sample rate, target convention and measured asset in applicable sync evidence. Numerical measurements remain separate from human viewing/listening and gate acceptance.

CLI returns JSON with `ok` and errors; exit 0 means structural/freshness validation succeeded, exit 2 means it failed. Inputs and paths are never echoed on failure. A user waiver or delegation must be recorded separately; this helper grants neither.

The JSON is author-declared, not an authenticated receipt. A validator cannot
detect deliberate rewriting of event data and all claimed bindings to match a
new timeline/source. Such editing is not Motion rechecking and reissuing events;
retain the actual capture/review receipts and scoped approval evidence. A pass
does not establish authorship, immutable history or semantic frame accuracy.
