# Worked example: an approved two-second native loop

This is an illustrative production recipe, not an additional measured render. The existing B1 proof is the smaller silent one-second fixture described in runtime.md.

## Brief and decisions

The Lead confirms a 16:9 landing-page motion panel, native HTML/SVG/canvas, a two-second loop, approved brand tokens/logo and exact copy. Send missing destination, rights or copy decisions to the Lead (Chris in the pilot). No generated footage or audio synthesis is authorized. Sound may later supply an approved local mix; that branch does not change renderer choice.

Use the workflow project helper to create a complete nonsecret record with renderer=native, local audio, external footage disabled and an explicit spend ceiling. Its 1920x1080/60fps default matches this example. Do not replace a full existing preference record with a fragment. The canonical timeline is:

```json
{
  "schemaVersion": 1, "revision": "panel-r1", "fps": 60,
  "totalFrames": 120, "width": 1920, "height": 1080,
  "scenes": [{"id": "panel", "startFrame": 0, "endFrame": 120}],
  "cues": []
}
```

Validate it with the shared helper, then scaffold only if `media/native/` is absent. Replace generated placeholder content using approved copy and palette. Set boolean `loop: true` in content.json; do not add it to timeline.json. Place approved public assets under media/assets and address them via `/assets/...`.

## Author and check

Use ready to initialize metadata and resources. Draw every pose directly from t: a periodic motif may use phase=t/2, while text remains legible across the seam. For a custom scene, publish meta.loop=true. Verify seek(0), seek(.5), seek(1.5), seek(.5), seek(0): repeated times should reproduce the same pixels, and selected different times should visibly differ.

N=120 means exactly frames 0..119; last sampled time is 119/60 seconds. seek(2) is the boundary probe only. Run the native helper with resolved absolute project/Skill/browser/FFmpeg paths, then inspect the encoded file for H.264/yuv420p, 1920x1080, 60fps, 120 frames and two seconds. These are expected values for this recipe, not claimed observed values.

## Sound, captions and handoff

If this brief stays silent, omit the audio-manifest option and mark listening unverified/not applicable to the silent deliverable. If speech is approved, update the timeline with its actual text and cue bounds, compute the new fingerprint, and send it through the Lead to Sound. Validate the returned stereo48k WAV master/stems/cues, provenance and measured report against the saved loudness preset before rendering with `--audio-manifest`.

Supply matching validated SRT captions for speech. Do not imply the CLI embeds them; verify the destination's sidecar or burned-caption requirement. Changing speech or timing invalidates the prior audio/caption handoff even if the revision label was accidentally retained.

Deliver source/assets and encoded output together with stills/contact sheet, runtime pins, exact commands/exits, numerical inspection and separate playback/listening status. The Lead receives unresolved approval or integration questions. Anti-pattern: sending only an MP4 and calling it complete when the recipient cannot edit the source or distinguish numerical proof from creative review.
