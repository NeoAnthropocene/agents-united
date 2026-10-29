# Runtime, installation and support boundary

Read this for setup or a missing executable. The Skill entry and scene protocol cover creative work; this file does not authorize package installation, account connections or provider spending.

## Resolve roots and preserve the project

Use absolute paths for the installed native Skill root and the user's project. The renderer is `scripts/render-native.mjs`; it imports `../../audiovisual-review/scripts/review.mjs`. Both Skill resource trees must retain that sibling relationship. A source checkout already has it. An installed native folder alone is incomplete: report the missing companion rather than downloading an arbitrary replacement.

Catalog/bundle wiring and host loading are separate integration work. Verify that the actual installed set contains the companion before calling it runnable. Do not install a Codex bundle over this repository's managed-root instructions.

Node 24 or later is required. `scaffold` reads and validates an existing `media/timeline.json`, creates `media/native/`, and copies the original starter plus content/package files. It refuses an existing source directory. Back up and edit that directory explicitly instead of deleting it or forcing scaffold.

## Project-local setup

The generated package pins Playwright **1.62.1**. After setup is authorized, install within `media/native/` using the project's package manager and retain its lockfile. Use `npm ci` when an appropriate lockfile already exists. Browser installation through the scoped Playwright CLI is an optional setup action; an approved compatible local Chromium/Chrome/Edge binary can instead be supplied with `--browser`.

Do not install globally, upgrade an unrelated project, change browser profiles or connect a provider. The helper does not install packages. Keep FFmpeg outside public scene assets and pass its absolute executable path with `--ffmpeg` when it is not on PATH. Resolve and verify it first with the shared `audiovisual-review/scripts/ffmpeg.mjs` `resolve` + `verify` pair ([FFmpeg provisioning](../audiovisual-review/references/ffmpeg.md)); the project's own `node_modules/ffmpeg-static` is the preferred source, and a missing or incapable build is a project-local install request through Chris, never a silent global change. Require PNG input, libx264/H.264, yuv420p, AAC and the contact-sheet filters used by the helper. Inspect the chosen build's version and capabilities.

The B1 fixture reused bundled Playwright 1.62.1 and installed Chrome 155.0.8059.85. Its isolated tools were `@ffmpeg-installer/win32-x64@4.1.0` and `@ffprobe-installer/win32-x64@5.1.0`. These are recorded proof dependencies, not universal platform recommendations. Other OS/browser/build combinations remain unverified until tested. Do not copy Windows executables into a cross-platform source handoff.

## CLI

Run with Node from any working directory, replacing every placeholder with the resolved absolute path:

```text
node "<skill-root>/scripts/render-native.mjs" scaffold --project "<project>"
node "<skill-root>/scripts/render-native.mjs" plan --project "<project>"
node "<skill-root>/scripts/render-native.mjs" render --project "<project>" --ffmpeg "<ffmpeg>" --browser "<browser>"
```

For an approved Sound mix, append `--audio-manifest "media/audio/manifest.json"`. This argument is a project-relative JSON path; its canonical `master` is a relative WAV path. Paths containing spaces are ordinary quoted arguments. No shell pipeline is required by the helper. `plan` checks the timeline and reports N frames, last frame/time, duration and a boundary probe time; it does not render or replace project-preference validation.

## Preferences and standalone use

For a coordinated project, record native-versus-Remotion once with the workflow's project helper. Existing `media/project.json` is authoritative. Render reuses the shared `validatePreferences` and its `validatePreset`; renderer must be native and output fps/width/height must equal the approved timeline. The selected loudness preset validates the reported master measurements. Invalid schema, malformed JSON, another renderer or a stale output specification fails before runtime work. No preferences are overwritten.

An absent file supports standalone native use: timeline dimensions/fps remain authoritative and audio uses the shared default (-16 LUFS +/-1, true peak <= -1 dBTP, stereo 48 kHz WAV). Absence does not persist approval or invent a choice. A present but invalid/unreadable record is not equivalent to absence. The default coordinated destination is 1920x1080 at 60 fps; explicit destination overrides must be reflected in both preferences and timeline.

## Licences and measured scope

This original Skill, starter and renderer are agents-united source under the accompanying MIT licence (repository copyright 2026 NeoAnthropocene). No upstream Skill or motion template was copied. Playwright is separately Apache-2.0; the recorded FFmpeg/ffprobe package metadata declares GPLv3/GPL-3.0, and browser/vendor terms are separate. Keep the selected runtime and asset licence records; the source MIT licence does not relicense them. No runtime binaries are bundled with this Skill.

Actual Windows proof is a silent 640x360, 60 fps, 60-frame, one-second H.264/yuv420p loop. Repeated browser samples and the endpoint matched; ffprobe measured the output. Three decoded frames received a limited clipping/legibility inspection. This is not a 1080p render, full playback review, subjective quality approval, real-audio/listening check, Claude end-to-end session or proof of other host behavior.
