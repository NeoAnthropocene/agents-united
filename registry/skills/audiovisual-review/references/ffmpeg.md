# FFmpeg: find it, verify it, install it only with consent

FFmpeg is not optional for this pipeline. The Native renderer encodes and tiles stills with it, the
audio finisher mixes, normalises and measures with it, and every QC probe reads streams through it.
A machine without a usable FFmpeg fails late, after the composition work is done.

`scripts/ffmpeg.mjs` (this Skill) is the shared resolver. It never installs or edits the machine by
itself.

## 1. Resolve, then verify — before authoring

```text
node "<audiovisual-review skill root>/scripts/ffmpeg.mjs" resolve --project "<project>"
node "<audiovisual-review skill root>/scripts/ffmpeg.mjs" verify  --project "<project>"
```

Resolution order: an explicit `--ffmpeg`, `FFMPEG_PATH`, the project's own
`node_modules/ffmpeg-static`, the native scaffold's static build, then `ffmpeg` on `PATH`. The
report names which source won and gives an absolute path for on-disk candidates; use that path
for `--ffmpeg` and for the finisher's binary argument instead of hoping PATH is right. The final
`path: "ffmpeg"` fallback is only a command to try, not evidence of an installed binary:
`resolved: false`, `exists: false`, and `resolve` exits 2. Run `verify` to check that PATH command.

`verify` runs `-version`, `-h filter=amix`, `-h filter=loudnorm` and `-encoders`, and reports
`ok`, `version` and `missing[]`. Required capabilities are `amix normalize`, `loudnorm`, `libx264`,
`aac`, `pcm_f32le` and `pcm_s24le`. A build that plays MP4 can still be unusable — a stripped
N-92722 build lacks `amix normalize`, and an n7.1 compositor build can omit `pcm_f32le`.
Exit 0 means the required capabilities are present; exit 1 names a missing capability, invalid
version response or failed process (including a missing PATH binary).

## 2. Choose the install, then ask

```text
node "<skill root>/scripts/ffmpeg.mjs" plan --project "<project>"
```

`plan` prints the options and changes nothing:

| Mode | Command | When |
| --- | --- | --- |
| `project-local` (**recommended**) | `npm install --save-dev ffmpeg-static` in the project | Always first: no admin rights, reproducible, keeps the tool inside the project |
| `user-wide-winget` (Windows) | `winget install --id Gyan.FFmpeg --exact --accept-package-agreements --accept-source-agreements` | The user wants FFmpeg available to every project |
| `user-wide-brew` (macOS) | `brew install ffmpeg` | Same, Homebrew |
| `user-wide-apt` (Linux) | `sudo apt-get install -y ffmpeg` | Same; distribution builds vary, verify afterwards |

Running an install requires **explicit consent**: `--consent` for the project-local install, and
`--consent --allow-system-install` for anything that changes the machine beyond the project. The
Motion Designer may run the project-local install after the lead approves the project setup scope;
a machine-wide install needs the user's explicit go-ahead, relayed by Chris.

```text
node "<skill root>/scripts/ffmpeg.mjs" install --mode project-local --project "<project>" --consent
```

## 3. PATH is a separate, explicit decision

A project-local `ffmpeg-static` needs no PATH change: pass its absolute path. Only if the user wants
a global `ffmpeg` command does the environment need editing:

```text
node "<skill root>/scripts/ffmpeg.mjs" path --add "<absolute ffmpeg bin folder>" --consent
```

On Windows it appends to the **user** `Path` variable idempotently (a second run reports
`changed: false`) and returns an `undo` field holding the exact PowerShell command that restores
the previous value without trimming or rebuilding its entries. The target must be a nonempty,
absolute, existing directory. PowerShell reads/writes fail closed and success requires an exact
read-back match; PATH values and the undo payload travel as base64 UTF8 data, never executable
interpolation. On macOS and Linux it prints a shell-quoted `export PATH=...` line for the user's own
shell profile instead of editing it. Never edit the machine `Path`, never prepend a directory ahead
of system tools, and never do this silently.

## 4. Record the result

In the QC report and the media evidence, write the resolved path, the `verify` version, `missing[]`
if any, and whether the binary is project-local or machine-wide. Re-verify after an install: an
installer exit code is not evidence that the build carries the required filters. Keep the tool
outside `public/` and out of the source archive.
