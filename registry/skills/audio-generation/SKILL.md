---
name: audio-generation
description: 'Use when an approved sound brief needs narration, music, effects or deterministic local audio sources. Trigger phrases: "generate audio", "record narration", "local sound effects", "source music". Skip when only sonic direction is needed, sound is outside scope, or approved audio only needs finishing.'
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

## Overview & Purpose
Produce traceable source audio for an approved brief. Choose supplied/recorded assets, simple local synthesis, an approved local model or an opted-in provider; a created file is not performance or rights quality.

## Execution Triggers
Use after Chris includes audio production and approves the route. Sound direction and, for included speech, Kaan's exact approved words precede final production; authorized scratch narration may inform Motion's film timing or Sound's Lead-approved standalone timing. Confirm whether the request is a timing prototype or a final performance.

## Input/Output Requirements
Require the sonic brief, exact approved copy/pronunciation when speech is included, cue/timebase proposal or frozen timeline, route/preferences, source/voice permissions and budget. Route gaps through Chris. Return originals with hashes, take/model/parameter records, rights evidence, applicable transcript/phrase marks and selected edits for finishing. The sibling [media contract](../audiovisual-review/references/media-contract.md) governs final timing, master, stems and manifest; no generation result bypasses it.

## Step-by-Step Runbook
1. Read saved `media/project.json` and [source/route decisions](references/sources-and-routes.md). Before proposing a sound route, [probe the machine](references/system-capability.md): run `scripts/probe-system.mjs --out media/specs/system-capability.json` and report the measured CPU, memory, disk and GPU facts, then offer the bundled local route, a local model only where it is at least `viable-with-caveats`, and the external provider as an opt-in alternative. Offer local/API/hybrid through Chris when unresolved. Supplied or newly recorded audio is a valid local route. Never upload, connect accounts, spend or substitute cloud processing silently.
2. Confirm usage rights for every source. For speech, require voice consent, pronunciation and Kaan-approved exact words using [narration guidance](../sound-design-direction/references/narration-rights.md). For a wordless cue, mark speech/transcript/captions/pronunciation/voice consent not applicable with a reason; no invented narration or Kaan approval. Complete [the source ledger](assets/source-ledger.md); preserve originals.
3. For local production, follow [recording and synthesis](references/local-production.md). The bundled `scripts/synthesize.mjs` generates only sine/triangle/noise and pitch sweeps, never speech, composed music or voice cloning; for an original background bed use `compose-bed.mjs` per [the bed spec](references/music-bed.md). Use [the synthesis spec](assets/synthesis-spec.example.json) for a prototype or effect.
4. For an optional local model, read [the dated model preflight](references/local-models.md); pick the section for the deliverable (speech, effects, instrumental, vocals/lyrics, transcription) and resolve hardware, storage, runtime, licences, language and lyrics before any approved project-scoped install; flag a non-commercial weight licence via Chris. Documentation does not prove installation or inference.
5. For API/hybrid, follow sibling [mcp-setup media setup](../mcp-setup/references/media-setup.md) and [provider cards](../mcp-setup/references/media-providers.md); confirm the installed helper/tools, model, permissions and acknowledged job ceiling. Use the [Kie narration example](examples/kie-api-narration.md) for create/status and local output. Reconcile a timeout before a new paid job. Apply the same source ledger to returned assets.
6. Listen to selected takes against applicable exact copy and the sonic brief; mark pronunciation, artifacts, noise, pacing and edit boundaries. Keep rejected takes and source identity. A transcriber may propose marks or captions but never owns copy or replaces listening. Use [selection and timing records](references/selection-handoff.md); unresolved timing returns through Chris to Motion for film or Sound for standalone cue/timing approval before freeze.
7. Hand off originals plus selected source edits, hashes, provenance and cue map to audio-post-production. Motion receives film phrase/beat marks. Standalone WAV/sting goes through required applicable audio/provenance review directly to Chris; master review and any film mux review remain separate finishing steps.

## Code & Config Exemplars
For an approved technical cue: `node "${CLAUDE_SKILL_DIR}/scripts/synthesize.mjs" <spec.json> <new.wav>`; for an original background bed: `node "${CLAUDE_SKILL_DIR}/scripts/compose-bed.mjs" <spec.json> <new.wav>` ([bed spec](references/music-bed.md)). Probe the machine first: `node "${CLAUDE_SKILL_DIR}/scripts/probe-system.mjs" --out media/specs/system-capability.json` ([capability and route floors](references/system-capability.md)). Other Hosts resolve the installed Skill root; Node >=24; no downloads. Read [the worked example](examples/local-hybrid-selection.md).

## Edge Cases & Error Recovery
The synth refuses an existing output; choose a fresh revision and retain the old file. A seed repeats this helper's signal, not model/provider output. Unsupported language, missing consent, clipped source, unavailable hardware or failed provider output needs a source/route decision through Chris. Do not replace approved words or claim a generated track is cleared from its prompt alone. Sung lyrics stay Kaan's approved copy; never imitate a named performer. Anti-patterns: labeling tone noise as narration, evaluating only a waveform, and retrying a paid timeout as a new job.

## Verification Checklist
- Selected source/take hashes, applicable exact script, parameters, rights/consent and approval state are recorded.
- Actual duration, phrase/cue fit and listening findings are separate from declared file metadata.
- Model install/inference, provider setup and host loading say **unverified** unless evidenced.
- No credential or private consent document enters prompts, argv, logs or public exports.
- Finishing receives the timeline dependency, originals, edits and provenance; final WAV/stems/manifest and captions are not inferred from a source file.
