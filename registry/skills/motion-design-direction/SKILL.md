---
name: motion-design-direction
description: "Use when shaping an approved motion brief, storyboard or animation treatment; trigger phrases: motion direction, UI morph loop, product launch film, narrated explainer, kinetic type, logo sting. Skip static-only work, automatic media generation and claims that a recipe is an exported video."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Motion Design Direction

## Overview & Purpose
Turn an included Media Request into an original, parameterized storyboard that Motion can build and Sound can score. This [MIT source](LICENSE) provides ten treatments; each has a filled example and its own evaluation limit. Authored direction does not emit an MP4.

## Execution Triggers
Use for approved ads, demos, explainers, campaign films, showreels and stings, or to diagnose unclear motion intent. Chris owns human questions, include/defer/decline, renderer and budget decisions. Static work alone does not start media production.

## Input/Output Requirements
Require placement/audience/purpose, duration/ratio/fps, loop intent, approved copy/brand/assets and rights, accessibility, sound needs and revision budget. Relay missing inputs through Chris; do not invent approval.
Return the selected treatment, filled parameters, storyboard/frame and cue table, asset/provenance list, renderer choice, acceptance checks and Motion/Sound handoffs. Default planning is 1920x1080 at 60 fps unless the destination overrides it.

## Step-by-Step Runbook
1. Load [direction and shared contracts](references/direction.md). Reuse approved assets and saved preferences. Chris offers Native (recommended starting choice) or Remotion, confirms the choice and persists it in `media/project.json`; never silently switch lanes.
2. Ask Jamileh for brand tokens/asset specs and Kaan for approved copy. Jamileh remains shell-less. Motion owns timing/storyboard/video integration; Sound owns the final measured master, stems, cues and provenance.
3. Choose only the relevant recipe group: [1-3 UI/launch/beat-drop](references/blueprints-01-03.md), [4-6 conversation/SaaS/mascot](references/blueprints-04-06.md), [7-8 campaign/showreel](references/blueprints-07-08.md), or [9-10 kinetic type/sting](references/blueprints-09-10.md). Fill every input; adapt the duration by the stated frame math.
4. Read [source dispositions](references/sources.md) before using a reference. The 2026-10-22 supplied metrics are dated research snapshots, not a current ranking, independently viewed playback or rights clearance. These recipes are original writing, not copied prompts or source code.
5. Present the storyboard, sound intention and reading holds through Chris. Freeze one canonical timeline/revision before animation and final sound; timing or speech edits require a new fingerprint and dependent handoffs.
6. Apply the recipe to the chosen [Native Skill](../native-motion-production/SKILL.md) or [Remotion Skill](../remotion-production/SKILL.md). Both applications describe deterministic poses; neither authorizes dependency setup, runtime licence eligibility or paid generation.
7. Hand Sound stable cue IDs/frame spans and approved narration. Integrate only the matching measured master and current captions. Review motion intent, actual encoded properties, playback/listening and rights separately; record unperformed checks as unverified.
8. Give Chris the editable direction/source, exports when separately produced, evidence and named open items. Verify installed Bundle/host bindings and resources before claiming invocation; source and resource packing alone do not prove it.

## Code & Config Exemplars
At F fps and duration D, approve integer N frames; export i=0..N-1 at t=i/F. Each scene uses `[startFrame,endFrame)`. For a 15 s, 60 fps treatment, N=900; an opening `[0,120)` lasts 2 s. Local progress is `clamp((i-a)/(b-a),0,1)`; the end pose can be probed separately.
Use stable scene/cue IDs in the canonical timeline, and keep recipe parameters in a separate direction document. The filled worked examples in each recipe are fictional briefs with explicit frame spans, never source-post reconstructions or client approvals.

## Edge Cases & Error Recovery
For missing rights, copy, duration or unclear claims, pause the dependent production step and route the exact gap through Chris. Recut after approval; never shorten approved words merely to fit a beat. A short placement may need fewer claims rather than faster text.
Anti-patterns: decorative cursor clicks without cause; discontinuous loop identity; fake product screens or data presented as real; lifting a reference's assets/music; unlimited agents/iterations; unseeded randomness or wall-clock animation; attaching audio from a stock-visual workflow.
External generated footage is a separate opt-in. Reuse `commercial-stock-sourcer` for visuals when needed; it supplies no audio. Without a renderer or shell, deliver the storyboard and handoff; render quality stays unverified.

## Verification Checklist
- Every parameter, scene/beat, build decision and reading hold is filled, with approved inputs and provenance or an explicit gap.
- Selected renderer and budget are recorded through Chris; Native/Remotion share one revision, fingerprint, fps and half-open timeline.
- Sound receives cue timing, narration, sync tolerance and final master/stem/caption requirements; downstream timing changes invalidate the handoff.
- Source metrics retain their supplied date/limits; reference media is separately rights-cleared before reuse.
- Technical export, full playback, listening and creative acceptance have separate evidence or say unverified; none of these ten recipes is independently quality-proven.
- Maintainer `evals/` holds prepared paired briefs/control only, excluded from installed resources. Preserve bounded team/revision policy and spending limits.
