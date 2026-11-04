# Discrete-cue onset diagnostic

A stem can be placed at the right frame while its internal envelope starts late. The Pilot 041 handoff identified 0.1–0.2 second lead-ins despite zero measured mux lag. Measure the stem before changing timing; do not move visuals or trim audio automatically.

Use the installed helper with a mono/stereo PCM16 or PCM24 WAV (Node 24, no dependencies):

```text
node "<audiovisual-review>/scripts/measure-onset.mjs" --wav audio/stems/peeps.wav --fps 30
node "<audiovisual-review>/scripts/measure-onset.mjs" --wav audio/aligned/peeps.wav --fps 30 --expected-frame 105
```

For a cue-local file, expected frame defaults to zero. For a full-duration aligned stem, supply the canonical cue start frame. Do not apply this whole-file detector to a mix with overlapping cues or a continuous ambient/music bed. The exit is 0 within tolerance, 2 for late/early onset, silence or invalid input. JSON records sample position, seconds, signed frame offset, threshold, peak and the measured file's SHA-256.

The detector uses the first sample in either channel whose absolute magnitude exceeds 5% of that file's peak. Opposite-polarity channels do not cancel. Default tolerance is one frame; `--threshold` accepts a fraction strictly between 0 and 1, and `--tolerance-frames` changes the reported test explicitly. This is a reproducible threshold crossing, **not** an audible or perceptual onset definition. Noise, pre-ringing, deliberate fades and distant later peaks can change the result. Inspect the waveform and listen before accepting a correction; do not tune thresholds merely to pass.

Only standard RIFF PCM16/PCM24 (format code 1) is accepted; float and WAVE_FORMAT_EXTENSIBLE are rejected. FFmpeg commonly writes 24-bit audio using the extensible header. Decode such inputs with the capability-verified project FFmpeg into a separate PCM16 diagnostic copy, preserving sample rate, channels and time origin:

```text
"<verified-ffmpeg>" -nostdin -n -i audio/aligned/peeps.wav -map 0:a:0 -c:a pcm_s16le -dither_method none scratch/peeps-pcm16.wav
```

Do not overwrite or normalize the source. Record the exact command and original/decoded hashes; 24-to-16-bit quantization can move the threshold slightly, so retain this limitation with the result. Files over 128 MiB are rejected; use a deliberately documented cue crop and account for its time origin. The helper makes no network call or file mutation.

This report is separate from `mux-sync.json`. Do not relabel its method as decoded-final-mux evidence. After an approved Sound correction, regenerate the affected stems/mix, re-render and measure the actual mux. `listeningReview` and `perceivedSyncReview` stay **unverified** until the maintainer watches and listens.
