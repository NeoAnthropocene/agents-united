---
name: sound-design-direction
description: 'Use when an included film, ad, explainer or standalone audio needs sonic direction before audio production. Trigger phrases: "sound direction", "sonic palette", "narration treatment", "music and SFX brief". Skip when the task is static copy or imagery, or only needs an already approved mix finished.'
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

## Overview & Purpose
Turn the approved goal into a sound treatment, applicable voice brief and cue proposal for Chris to approve. Motion owns coordinated film timing; Sound owns Lead-approved standalone cue/timing records. Direction is a production decision; an adjective list is insufficient.

## Execution Triggers
Consult after Chris includes sound in scope and before recording, generation or timing freeze. Resolve the role of silence, narration, music and effects. A consultation returns scope/feasibility advice; deliverable production starts only under the approved brief.

## Input/Output Requirements
Require Kaan-approved exact copy when copy/speech is included, brand constraints from Jamileh, placement/duration/accessibility needs, asset rights, the applicable approved timebase and Chris's route/budget decision. Route missing inputs through Chris. Return a sonic brief, cue proposal, applicable pronunciation/voice-consent record, source plan, review criteria and explicit approval state. Never change copy, claims, brand or timing silently.

## Step-by-Step Runbook
1. Define what the audience must hear and understand; rank speech intelligibility, emotional pace and brand recognition. Use [direction choices](references/direction.md), including a useful silence option.
2. Offer local, API or hybrid through Chris using [route selection](references/routes.md). Local includes supplied/recorded assets and editing; it does not require a model. External uploads, voice cloning, spend and model installation require their own approved scope.
3. For included narration, lock Kaan-approved exact words and delivery constraints with [narration and rights](references/narration-rights.md); voice consent/usage and pronunciation approval precede final performance. Mark absent speech artifacts not applicable with a reason; wordless cues need no invented narration or Kaan approval. All sources still need rights review.
4. Mark entrances, exits, accents and rests against Motion's coordinated film frames or Sound's Lead-approved standalone cue/timing record. Complete [the brief template](assets/sonic-brief.md); record provisional timings until the actual performance is approved. For film, prefer meaningful accents over decorating every cut.
5. Agree the freeze and revision rules using [handoff](references/handoff.md) and sibling [shared media contract](../audiovisual-review/references/media-contract.md). When helpers need a timeline, use the same complete canonical schema and revision/fingerprint for film or standalone sound. Changed text or timing invalidates dependent exports.
6. Present Chris with the treatment, route, rights gaps, limited alternatives and review plan. Send the approved brief to audio-generation and audio-post-production; Motion receives film dependencies; standalone WAV/sting goes through required applicable audio/provenance review directly to Chris.

## Code & Config Exemplars
Read [the worked example](examples/portal-explainer.md) for an original 12-second treatment with concrete frames, silence, VO and music choices. The template's cue table is a proposal; the canonical timeline contains only the shared schema fields and approved speech text.

## Edge Cases & Error Recovery
When a performance does not fit, give Chris the measured duration and choices: revise the script with Kaan, change film pacing with Motion, or approve new standalone timing with Sound. Do not accelerate speech beyond intelligibility or shave a protected claim. Missing source/voice rights block use of that source; propose owned recording or approved replacement. Anti-patterns include celebrity imitation by implication, generic "cinematic" prompts and treating an RMS/LUFS result as listening approval.

## Verification Checklist
- Brief names audible decisions, exclusions, review owner and exact copy/brand version.
- Every proposed source has a rights/consent task or evidence; upload and spending choices are explicit.
- Cue ranges, scratch/final status, applicable transcript/captions and timing dependencies are inspectable.
- Chris receives include/defer/decline or approval decisions; Motion receives the film handoff; Chris receives standalone sound after required applicable review.
- Direction, generated performance, numerical QC and human listening are reported separately; unperformed checks say **unverified**.
