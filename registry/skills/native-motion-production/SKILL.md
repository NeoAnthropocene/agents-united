---
name: native-motion-production
description: "Use when producing or repairing approved native HTML, SVG or canvas motion with deterministic browser capture; trigger phrases: native motion, seek-controlled animation, editable motion source. Confirm native versus Remotion before setup. Skip footage generation, audio synthesis and metadata-only quality claims."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Native Motion Production

## Overview & Purpose
Turn approved brand, copy and timing into editable browser motion and a measured MP4. The renderer samples integer frames, waits for readiness and validates the Sound handoff. Original source uses the [MIT licence](LICENSE).

## Execution Triggers
Use after native production is chosen, or to diagnose its source/readiness/export. Route an open native-versus-Remotion choice through the Lead (Chris in the agency pilot), who consolidates user decisions. Relay missing-input questions to the Lead. Reuse the recorded choice; hand off a Remotion project instead of converting it silently.

## Input/Output Requirements
Require the approved brief, destination, duration, loop intent, brand/assets, final copy, accessibility needs and budget. Keep timing and nonsecret choices in `media/timeline.json` and `media/project.json`; default to 1920x1080 at 60 fps unless the approved destination changes both.
Return editable source/assets, timeline/preferences, MP4, stills/contact sheet, captions when speech requires them, runtime pins and a review/evidence record. Separate technical verification, decoded-sample inspection, full playback and listening.

## Step-by-Step Runbook
1. Confirm the native choice and approved inputs with Motion, Brand/Copy and Sound. Resolve missing copy, rights or timing before final rendering; use [handoffs](references/handoffs.md) for contracts and the separately selected generation route.
2. Inspect existing files. Validate the shared timeline and recorded preferences; selected renderer, fps and dimensions must agree. A missing preference file permits standalone timeline/shared-audio defaults, but is not a persisted choice. Malformed files fail; never overwrite them to continue.
3. Load [runtime setup](references/runtime.md) for prerequisites or portability. Use Node 24+, project-local pinned Playwright and local browser/FFmpeg. Install only within authorized project scope; retain lockfiles/versions.
4. Scaffold only a new `media/native/` directory with [the helper](scripts/render-native.mjs). Preserve an existing composition. Start from [the original HTML asset](assets/index.html), replace placeholder copy and put public media/fonts in `media/assets/`.
5. Author HTML/SVG/canvas using [the scene protocol](references/protocol.md). `seek(t)` reconstructs a pose without accumulated state; `ready` settles after setup. Expose timeline metadata. Loop choice belongs in content/scene metadata, never the strict timeline.
6. Freeze timing before Sound finalizes the shared manifest. Validate revisions/fingerprint, cue positions, captions and reported master measurements against the saved loudness preset. Native rendering consumes an approved mix; it does not generate, repair or normalize audio.
7. Render through the helper, then follow [export and review](references/review.md). Inspect the actual encoded file, replay selected frames, review loop boundaries and keep failed exports out of delivery. Mark unperformed checks unverified.
8. Deliver source/export with open items, dependency/asset licences and the next reviewer. A command, static gate or three stills is not a full creative approval.

## Code & Config Exemplars
Use absolute roots and retain the sibling audiovisual-review resources. Claude Code supplies `${CLAUDE_SKILL_DIR}` in the first example; elsewhere replace it with the resolved Skill root.
```text
node "${CLAUDE_SKILL_DIR}/scripts/render-native.mjs" scaffold --project "<project>"
node "<skill-root>/scripts/render-native.mjs" render --project "<project>" --ffmpeg "<ffmpeg>" --browser "<browser>"
```
For a two-second 1080p60 loop, export frames 0..119. `seek(2)` checks the loop boundary; it is not frame 120 of the export. [The worked example](examples/one-loop.md) shows the choice, frame math, Sound/caption branch and handoff.

## Edge Cases & Error Recovery
Metadata mismatch, missing/rejected readiness, failed fonts/images or seeks abort capture. Repair source and rerun affected checks. A stale manifest needs a new Sound handoff, not a renamed revision or invented measurements.
Anti-patterns: using wall-clock timers or autoplay as the timeline; fetching unapproved external fonts; accepting a private-path/junction escape; hiding clipping with a lower-resolution export; forcing a recorded Remotion choice to native; claiming that resampling, reported LUFS or silent playback establishes audio quality.
For missing tools, sibling resources or host bindings, name the prerequisite and preserve source. Without a shell, use reference frame math for planning; runtime export remains unverified.

## Verification Checklist
- Approved renderer, destination, copy/brand/assets and source rights are recorded; external generation is a separate opt-in.
- Scene metadata, readiness, ordered seek times and N-frame export agree with the canonical timeline; repeated poses and requested loop closure were checked.
- Audio/captions match the current revision/fingerprint and speech; selected preset validation is distinct from measurement/listening.
- Codec/fps/dimensions/frame count/duration come from actual output inspection; source, stills, contact sheet and evidence are retained.
- Full playback, visual quality, listening and target-host execution are reported separately, with unverified items and named next actions.
- Maintainer-only `evals/` contains prepared comparisons, not measured model results, and is excluded from installation.
