# Local recording, technical synthesis and source preparation

## Record included speech

For included speech, confirm Kaan-approved exact words, pronunciation and voice consent through Chris. A wordless cue needs no speech recording, transcript/captions, pronunciation, voice consent or Kaan approval; mark them not applicable with a reason and retain all source-rights review. Capture an unprocessed original with a few seconds of room tone and enough headroom to avoid clipping; use a quiet stable position. Ask for a complete take plus pickups that include surrounding words, so edits retain natural breath and prosody. Record take IDs rather than overwriting a file called `final.wav`. Document actual sample rate/channels; retain the original when creating a stereo48k production copy. Resampling does not improve source fidelity.

Check every name, number, qualifier and negation against the approved transcript. Record phrase starts/ends from actual playback or waveform-assisted listening. Transcription assistance can propose words/timing but does not own approved copy. Return mismatches to the producer rather than altering the script to fit an erroneous recording.

## Bundled synthesizer contract

`scripts/synthesize.mjs` runs on Node >=24, offline and without dependencies. Input is JSON:

| Field | Meaning / accepted range |
| --- | --- |
| `fps`, `totalFrames` | Positive fps <=240 and positive integer frame count; duration <=600 seconds |
| `waveform` | `sine`, `triangle` or `noise`; default sine |
| `frequency`, `endFrequency` | 20..20000 Hz; sweep endpoints, same frequency means a fixed tone |
| `gainDb` | -96..0; default -18 |
| `seed` | Integer noise seed; default 1 |

The helper allocates `round(totalFrames * 48000 / fps)` stereo sample frames, writes 16-bit PCM WAV, duplicates the signal in both channels and applies a short edge envelope of up to 480 samples. It creates a new output exclusively. It does not loop assets, duck music, compose melody, generate speech, clone a voice or perform final mastering. Noise seed repeats the deterministic technical signal. For roles without a shell, use the formula and input table to request the same cue from the production role; do not pretend a reference table creates a WAV.

At 60fps, 12 frames = 0.2 seconds = 9,600 sample frames at 48kHz. The supplied example is a low-level triangle sweep intended as a technical effect candidate. The short envelope reduces hard-edge clicks, but listening still decides whether it works. Do not call a technical sweep an approved brand sting without creative and rights review.

## Prepare selected sources

Use a suitable project tool to inspect actual stream codec, sample rate, channels and duration, then decode/listen. Trim only new copies; retain word attacks and decays. Use small auditioned fades/crossfades where edits require continuity, and compare before/after at matched playback levels. Remove noise only when the improvement exceeds artifacts; reject clipped/missing speech for a pickup when repair cannot restore meaning.

The finishing mixer accepts source trim/gain and timeline placement; it does not perform general repair, music looping, crossfades or speech-aware ducking. Prepare those edits/automation in an approved local editor or processor, render a new source and preserve its edit log. Hand the finisher original and edited hashes, not just an unexplained bounced WAV.
