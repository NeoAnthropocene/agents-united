# Worked example: an approved two-scene Remotion handoff

This is an illustrative recipe, not another actual render. The smaller measured B2/C1
fixtures and their limits are described in [review](../references/review.md).

## Approved brief and frame plan

The Lead confirms Remotion for a 16:9 two-second brand panel, 1080p60, supplied logo and
palette, exact approved copy, no external footage and initially no speech. Chris resolves
any missing rights, copy, destination, loop/accessibility or spending question and records
include/defer/decline. Use the complete project preferences schema with renderer=remotion,
local audio and generated footage disabled; a fragment is not a valid record.

The canonical timeline is:

```json
{
  "schemaVersion": 1, "revision": "panel-r1", "fps": 60,
  "totalFrames": 120, "width": 1920, "height": 1080,
  "scenes": [
    {"id": "promise", "startFrame": 0, "endFrame": 60},
    {"id": "proof", "startFrame": 60, "endFrame": 120}
  ],
  "cues": []
}
```

N=120 means two seconds, indices 0..119 and last sample 119/60 seconds. Each sequence
gets local frames 0..59. If looping is approved, express intent in brief/custom props
and compare boundary pose and playback; do not add a loop field to the strict timeline.

## License, source and setup

For an authorized internal suitability test only, record the actual automated evaluator
and test subject with status/purpose=evaluation, evaluationScope=internal-suitability-test
and commercialUse=false. For production, get real owner/representative facts for the
actual entity and use; never reuse a fictional test declaration. The unreviewed starter
fails until completed truthfully. Acceptance does not verify entitlement.

Run preflight and scaffold through the resolved Skill root. Only after authorized scoped
setup, install the exact generated dependencies in `media/remotion/` and retain its
lockfile. Replace placeholder scene copy with approved words, theme tokens and local
public assets. Keep `AgencyMotion`, current timeline/fingerprint and owned audio routing
intact. Frame animation is a function of props/frame; readiness gates settle before export.

Render using an explicit existing browser to a new output directory. Inspect actual
1920x1080, 60 fps, 120 frames and two-second video; these are expected recipe values,
not measured outcomes. Inspect range, repeat frames, decoded samples and full playback
separately. The helper's three stills do not establish a finished film.

## Speech and an approved timing revision

If speech is approved, Motion revises the timeline with actual VO text/bounds and sends
its revision/fingerprint to Sound. Sound supplies a matching stereo48k WAV master,
aligned stems/cues, provenance, actual master measurements and captions. Validate the
saved loudness preset and matching SRT; determine sidecar versus burned captions with
the Lead. The helper does not author or embed captions or measure audio.

Suppose an approved r2 extends the second scene to frame 150. Save earlier canonical
inputs, update complete preferences if required, save matching audio under new paths and
run `refresh --approved-revision panel-r2` with its manifest. The label must equal the
current canonical revision. This caller acknowledgment does not establish a human review.
Check archived previous props/provenance, retained scene copy/theme/custom source,
hash-named audio and unchanged package/lockfile/dependencies/old outputs. Review the
new scene timing and any captions, then render to `media/remotion/out-r2`.

Deliver editable source, public assets, timeline/preferences, package/lockfile, history,
MP4/stills/captions and actual commands/exits/probe/review records to the Lead. Name missing
companion/host bindings and unperformed playback/listening/entitlement checks explicitly.
Anti-pattern: editing snapshot fingerprints or renaming a stale manifest to avoid refresh,
or sending only the MP4 and calling a numerical check creative approval.
