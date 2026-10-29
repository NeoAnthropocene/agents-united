# Procedural music bed (deterministic)

`scripts/compose-bed.mjs` writes an original short bed: a four-chord progression, bass,
eighth-note arpeggio, kick and hat percussion and a simple motif. It samples nothing, reads
no recording and makes no network or model call. Use it for a quiet background bed under a
launch film or sting, not for composed music by a person, a licensed track, a copied melody
or a musical-quality claim. Listening decides.

## Spec fields

| Field | Meaning / accepted range |
| --- | --- |
| `fps`, `totalFrames` | Positive fps <=240 and positive integer frame count; duration <=600 seconds |
| `bpm` | 40..220; default 96 (one bar = 4 beats, so about 2.5 s at 96 bpm) |
| `rootHz` | 40..2000; chord root frequency, e.g. 220 for A3 |
| `style` | `uplift` (kick, snare-like hats, brighter motif) or `calm` (softer pad and motif) |
| `seed` | Integer noise seed; default 1. The same seed repeats the same bed, not a model's output |
| `gainDb` | -96..0; default -14. Start quiet and raise only if the mix needs it |

The helper allocates `round(totalFrames * 48000 / fps)` stereo sample frames, writes 16-bit
PCM WAV, and applies a short edge fade and soft limiting. It creates a new output exclusively
and refuses an existing file; choose a fresh revision and keep the old one.

## Example

For a 10 s bed at 30 fps: `{"fps":30,"totalFrames":300,"bpm":96,"rootHz":220,"style":"uplift","seed":7,"gainDb":-18}`.
Run it with the installed absolute Skill root:

```text
node "${CLAUDE_SKILL_DIR}/scripts/compose-bed.mjs" <absolute-spec.json> <new-absolute-output.wav>
```

Other Hosts resolve this installed Skill's absolute root and append `scripts/compose-bed.mjs`;
do not assume the working directory. Node >=24; no downloads. Use the bed as a `music` source
for its cue, keep the original, then finish through `audio-post-production` and the shared
manifest. Ducking under copy stays deliberate and auditioned; a generated bed is not a licensed
recording and is not cleared by its parameters alone. Roles without a shell use this table to
request the same bed from the production role; a reference table does not create a WAV.
