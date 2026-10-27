# Select a capable project FFmpeg

Use an already supplied approved full FFmpeg/ffprobe executable when possible. Keep any separately approved tool installation project-scoped; there is no product requirement to install Remotion. Binary version alone is insufficient: distributions can strip encoders or expose old filter options. Record the absolute tool path, version, binary hash and actual capability output. Do not download or install a substitute silently.

Run these directly with the selected executable as an argument array, or quote its absolute path appropriately for the current shell:

```text
<ffmpeg> -hide_banner -version
<ffmpeg> -hide_banner -h filter=amix
<ffmpeg> -hide_banner -h filter=loudnorm
<ffmpeg> -hide_banner -encoders
<ffprobe> -hide_banner -version
```

Require amix's `normalize` boolean option, loudnorm integrated target `I` -70..-5 and true-peak `TP` -9..0, and PCM24 (`pcm_s24le`) plus floating PCM (`pcm_f32le`) encoders. The source/alignment chain also needs aresample, aformat, atrim, asetpts, volume, adelay and apad; inspect `-h filter=<name>` for a tool with uncertain capability. The mixer internally checks amix/loudnorm, while the explicit encoder preflight avoids discovering a stripped build after partial output creation.

A stripped n7.1 compositor build can omit `pcm_f32le`; an older N-92722 build can lack amix normalize. Those are unsuitable for this workflow even if they can play or encode an MP4. A prior isolated technical proof used a full FFmpeg 6.0 tool supplied through a project-scoped ffmpeg-static 5.2.0 package; that is a tested tool instance, not a required product dependency or proof of every package build. Always inspect the actual selected binary.

## Preset capability is separate from shared validity

The shared contract permits integrated loudness -70..-5 LUFS, tolerance 0..10 LU and true peak -20..0 dBTP. This local loudnorm path supports TP only -9..0. A requested -12 dBTP ceiling is a valid shared preset but unsupported here. Stop before processing and ask Chris to select another approved processor or explicitly approve a changed project preset. Do not narrow the shared contract or quietly replace -12 with -9.

Very short or silent content may not yield a finite integrated reading; never manufacture a passing value. Ask for an appropriate approved measurement/acceptance method and record why the standard route cannot close. Processing/filter success still needs actual final measurement, target/tolerance and peak checks.

Preserve raw stdout/stderr and the exact native exit code before displaying a summarized log. A pipeline's last command exit can hide the failed media command. If processing fails after output creation, keep that partial revision and logs for diagnosis; choose a new revision for the corrected run. Do not let partial WAVs or an old manifest stand in for a valid finished handoff.
