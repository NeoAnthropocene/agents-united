# Read-only environment diagnostic

Run with Node 24 or later from an installed Skill root:

```sh
node scripts/diagnose.mjs --project /absolute/existing/project
```

JSON goes to stdout; redirect it only if you want to save it. The diagnostic does not write, install, change PATH, download, or contact a network by default. Optional `--ffmpeg /absolute/existing/file` selects a binary; `--browser /absolute/file` checks only whether it is a regular file (following symlinks), not whether it launches. Missing browser files are reported, not installed. `--check-release` explicitly opts into registry network requests and compares results with the reviewed pin; it never upgrades anything.

Exit 0 means a report was produced, including when checks are missing or failed. Exit 2 means invalid arguments or an unexpected fatal error. Each check reports `passed`, `missing`, `failed`, or `unverified`; a subcheck failure does not erase other findings. The FFmpeg check resolves and verifies required capabilities. The system probe reports CPU, RAM, project disk, GPU and Python facts; absent or unreliable GPU data is not proof of absence or performance. System probe completion does not establish that a model runs. Release freshness is unverified when skipped or lookup fails. Browser launch and Host Skill invocation remain unverified. No installed-file inventory establishes Skill discovery or invocation. `productionReady: false` is intentional: this report does not establish production readiness, entitlement, rendering, playback or listening.

The `audiovisual-review` Skill is a required companion for FFmpeg resolution and verification. The optional `audio-generation` Skill supplies the full system facts; if it is absent or cannot load, system facts are unverified and the other checks still run. `recordedAt` is the UTC report creation time, not proof that any unverified check occurred.
