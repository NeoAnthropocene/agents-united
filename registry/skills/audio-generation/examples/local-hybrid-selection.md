# Worked example: supplied narration and a simple local effect

Fictional source plan, not a production/quality result. Chris approved a local 12-second product film. The client supplies `media/sources/voice-take-03.wav` and a licensed music bed, with release/licence references supplied separately. The script, pronunciation and 60fps frame reservations are approved in the project's records. A source producer must inspect those records and actual files; the names in this example prove no rights or media content.

First record the original hashes and actual decoded durations. Listen to the approved words and mark phrase starts/ends. If the VO says "all requests" while approved copy says "each request", request a pickup through Chris/Kaan. Do not quietly change the transcript to make it match. Copy the chosen source to a new edit revision, retain the original, and record trimming/crossfades and the new hash.

The brief needs a short dry completion effect. Run the provided synthesis spec only under that approved technical task:

```text
node "${CLAUDE_SKILL_DIR}/scripts/synthesize.mjs" <project>/media/specs/tick-r1.json <project>/media/sources/tick-r1.wav
```

`<project>` denotes the selected absolute project path; resolve the installed Skill root in other Hosts. The supplied spec requests 12/60 = 0.2 seconds, 9,600 stereo sample frames at 48kHz. The helper emits a triangle sweep with a short envelope, not a narrator or a composed music track. A zero exit plus reported sample count still needs decoding/listening before selection. Keep the source spec, output hash and process evidence in the ledger. An existing output is preserved; choose `tick-r2.wav` for another candidate.

The producer proposed a local model for a longer music variation. Chris has not approved installation or reviewed weight terms, so that option remains unperformed. The client bed is still a valid local route. If Chris later approves hybrid generation, record the per-asset external route and upload/consent/budget decision before any call; a local failure does not switch routes automatically.

Pass the selected voice/music/effect originals and edits, hashes, permission references, exact script, phrase marks and canonical cue map to finishing. Music ducking and tail edits must be deliberately prepared or finished in an approved processor; the synth does neither. Sound's final stereo48k master, aligned stems, measured manifest and captions are later outputs. Speech quality, source suitability, rights acceptance, model inference and listening are **unverified** here.

Anti-pattern: calling the generated sweep `voice.wav`, labeling it `vo` in a test, and claiming narration works. A classification is not actual speech evidence.
