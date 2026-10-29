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
1. Load [direction and contracts](references/direction.md). Reuse approved assets/preferences. Chris confirms Native (recommended start) or Remotion in `media/project.json`; never switch lanes silently.
2. Require Jamileh's `media/specs/visual-handoff.md` (concept, signature frame, negative space, material and light), tokens/assets and Kaan's exact copy. Jamileh stays shell-less; Motion owns timing/storyboard/video; Sound owns the measured master/stems/cues/provenance.
3. Choose one recipe group: [1-3 UI/launch](references/blueprints-01-03.md), [4-6 conversation/SaaS/mascot](references/blueprints-04-06.md), [7-8 campaign/showreel](references/blueprints-07-08.md), or [9-10 type/sting](references/blueprints-09-10.md). Read its [quick facts](references/quick-facts.md), then apply the mandatory [signature-shot prompt blueprint](references/prompt-blueprint.md).
4. Fill [the worked spec](assets/motion-prompt.example.json) as `media/specs/motion-prompt.json`. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-prompt-spec.mjs --spec media/specs/motion-prompt.json`; **no storyboard or animation code until exit 0**. The spec needs a signature shot, contiguous causal shots, one named camera move per shot, 3+ depth layers, material/light, negative space, beat grid and proof plan.
5. Present the storyboard, sound intention and reading holds through Chris. Freeze one canonical timeline/revision before animation/final sound; timing or speech changes need a new fingerprint and dependent handoffs.
6. Apply the spec through the chosen [Native](../native-motion-production/SKILL.md) or [Remotion](../remotion-production/SKILL.md) Skill. Neither authorizes setup, runtime entitlement or paid generation.
7. Capture and inspect the proof frames **before the full render**; reject flat/default materials, placeholder rectangles, clipping, collisions and illegible type, then revise/reproof within budget. Integrate only Sound's matching measured master/captions. Keep technical, playback, listening and creative checks separate; say unverified when not performed.
8. Return editable direction/source, exports when produced, proof images/review, validation output and open items. Installed files alone do not prove invocation or quality.

## Code & Config Exemplars
At F fps and duration D, approve integer N frames; export i=0..N-1 at t=i/F. Each scene uses `[startFrame,endFrame)`. For a 15 s, 60 fps treatment, N=900; an opening `[0,120)` lasts 2 s. Local progress is `clamp((i-a)/(b-a),0,1)`; the end pose can be probed separately.
Use stable scene/cue IDs in the canonical timeline, and keep recipe parameters in a separate direction document. The filled worked examples in each recipe are fictional briefs with explicit frame spans, never source-post reconstructions or client approvals.

## Edge Cases & Error Recovery
For missing rights, copy, duration or unclear claims, pause the dependent production step and route the exact gap through Chris. Recut after approval; never shorten approved words merely to fit a beat. A short placement may need fewer claims rather than faster text.
Anti-patterns: decorative cursor clicks without cause; discontinuous loop identity; fake product screens or data presented as real; lifting a reference's assets/music; unlimited agents/iterations; unseeded randomness or wall-clock animation; attaching audio from a stock-visual workflow.
External generated footage is a separate opt-in. Reuse `commercial-stock-sourcer` for visuals when needed; it supplies no audio. Without a renderer or shell, deliver the storyboard and handoff; render quality stays unverified.

## Verification Checklist
- `motion-prompt.json` validates; storyboard, beats, holds and assets match approved inputs or name gaps.
- Signature shot, causal transitions, named cameras, depth/material/light and treated type are present; no placeholder panels.
- Renderer/budget are approved; both lanes share revision, fingerprint, fps and half-open timing.
- Sound has cue timing, narration, sync tolerance and master/stem/caption requirements; timing changes invalidate handoffs.
- Source metrics keep their dates/limits; reference media is rights-cleared separately.
- Proof review, export, playback, listening and creative acceptance have separate evidence or say unverified. Prepared recipes are not quality proof.
- Maintainer `evals/` stays outside installed resources; preserve team/revision/spend limits.
