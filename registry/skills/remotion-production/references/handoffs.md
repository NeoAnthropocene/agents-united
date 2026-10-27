# Lead decisions and cross-role handoffs

Chris is the agency pilot Lead and owns consolidated human questions, include/defer/decline,
route, budget and approval decisions. Motion owns storyboard, canonical timing, animation
and integration; Sound owns approved masters, stems, cues and sonic review. Brand/Copy
retain visual direction and exact approved words. Relay missing inputs through the Lead.

## Choose once, then preserve the decision

Present native HTML/SVG/canvas versus Remotion React production before setup. Reuse the
recorded `media/project.json` choice. Do not install both to postpone the decision or
silently convert an existing project. Defaults of 1920x1080 at 60 fps may be changed only
for the approved destination, consistently in preferences and timeline. The Remotion
helper requires complete preferences; it does not infer approval from missing records.

Collect placement, audience, ratio, duration, loop intent, brand/type/logo assets, exact
copy, safe areas, caption/transcript/reduced-motion needs, rights/provenance, output
expectations, setup scope and spending ceiling. Do not shorten claims to fit a card or
change brand/timing without the normal approval route. A static job does not automatically
create media deliverables or authorize runtime/provider installation.

External generated footage is a separate explicit opt-in for either renderer. Recorded
provider preferences are not authorization to call an account. Reuse approved assets;
visual stock can go through commercial-stock-sourcer. Optional footage generation and
provider wiring use [video-generation](../../video-generation/SKILL.md) and
[MCP setup](../../mcp-setup/SKILL.md) only with installed resources and separate authorization. Rendering never creates that permission.

## Canonical timeline, Sound and captions

Use the sibling [media contract](../../audiovisual-review/references/media-contract.md)
and [project contract](../../workflow-agency-motion-production/references/project-contract.md).
Do not invent a Remotion-specific weaker schema. Send Sound the exact revision,
fingerprint, fps, total frames, stable scene/cue IDs, approved speech and cue bounds.
Freeze timing before final Sound handoff. The manifest must match revision, fingerprint,
timebase and frame count; changing only a label does not make stale audio current.

Sound returns a project-relative WAV `master` path string, aligned stems/cues, provenance
and actual master-scope measurements. The shared format is stereo 48 kHz; validate the
report against the selected project loudness preset, preserving that preset. Paths are
relative to the project root and resolve inside it, including through junctions.
Reported measurements meeting a schema do not prove physical audio format or quality.
Do not fabricate measurements, owner facts or a human approval to make acceptance pass.

Speech requires matching validated SRT text/timing and destination-appropriate delivery.
The Remotion helper neither embeds nor burns captions automatically. For burned captions,
author frame-driven scene elements and verify legibility/sync separately; otherwise deliver
the approved sidecar and verify destination support. Retain a transcript/reduced-motion
alternative when required by the brief.

For an approved silent timeline with no cues, omit `--audio-manifest`. The helper requests
an audio track during encoding; do not infer narration or listening approval from silence.
An audio/timing edit needs the [explicit refresh workflow](revisions.md), a matching Sound
handoff and affected caption checks, then a new export directory.

## Delivery to the next reviewer

Give the Lead the MP4, selected stills/contact sheet when produced, required captions,
React/modules/assets, timeline/preferences, props/provenance/history, package/lockfile and
runtime/asset licence records. Include exact commands/exits, hashes and review scope.
Exclude credentials, `.env`, Git internals, caches, browser profiles, runtime binaries and
`node_modules` from the editable source archive. Name the next reviewer and concrete open
items. Separate numerical proof, decoded-sample inspection, full playback, listening,
creative approval and production entitlement; mark unperformed checks unverified.
