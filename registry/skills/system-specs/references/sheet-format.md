# Sheet format

The sheet is built from an allowlist: nothing outside this list is emitted. Produced by `scripts/specs.mjs`; schema version 1.

## Files
- `.agents-united/system-specs.md`: the short, human-readable sheet (target under 2,500 characters).
- `.agents-united/system-specs.json`: the same facts as data, written beside the Markdown file.
- `--out <path>` names the Markdown file; the JSON file takes the same name with `.json`.
- `.agents-united/` is not ignored by git in this repository. A project that does not want the sheet committed adds it to its ignore file.

## Fields (JSON)
| Field | Meaning |
|---|---|
| `schemaVersion` | The format version, `1`. A sheet with another version is never reused. |
| `collectedAt` | UTC time of collection, `YYYY-MM-DDTHH:MM:SSZ`. |
| `os.family` | `windows`, `linux`, `macos` or `other`. |
| `os.environment` | The same, or `wsl` when Linux runs inside Windows Subsystem for Linux. |
| `os.name` | Edition or distribution name (for example "Windows 11 Pro", "Ubuntu 24.04 LTS"). |
| `os.distribution` | Linux distribution name, else `null`. |
| `os.release` | Release or build number. |
| `os.architecture` | CPU architecture (`x64`, `arm64`). |
| `os.wsl` | On Windows: `present` when the WSL launcher lists its distributions, `absent`, or `not determined`. Elsewhere `not applicable`. |
| `cpu.model`, `cpu.logicalCores` | Processor model text and logical core count. |
| `memoryGiB` | Total memory, rounded to whole GiB. |
| `gpus[]` | `{ name, vramGiB }`. VRAM is read only where no elevated rights are needed (nvidia-smi, macOS system profiler); otherwise `null`. When no GPU can be read: one entry named `not determined`. |
| `freeDiskGiB` | Free space of the volume that holds the working folder, rounded; `null` when unreadable. |
| `shells[]` | `{ name, status, version }` for pwsh, powershell (Windows), bash, zsh, cmd (Windows). |
| `tools[]` | `{ name, status, version }` for the fixed tool table in `scripts/specs.mjs` (`PROBES`). |

`status` is one of:
- `present`: the version call ran and exited 0. `version` holds the first version number it printed, digits only.
- `absent`: not found on the path, or it ran and failed. A Windows Store stub that only opens the Store counts as absent.
- `not determined`: the call timed out, or the whole collect ran out of its time bound, or the runner broke.

## Tool table
node, npm, pnpm, yarn, bun, deno, python, pip, uv, git, gh, docker, docker compose, podman, kubectl, helm, terraform, az, aws, gcloud, vercel, supabase, java, dotnet, go, rustc, cargo, ruby, php, ffmpeg, and the agent command lines claude, codex, cline, agy. Each is asked for its version once with a fixed argument list and a timeout of about 5 seconds (12 for the slow cloud CLIs). To add a tool, add one line to `PROBES` and its name to the list in the test.

## Privacy rule
Never in the sheet: the user name, the machine name, the home folder or any absolute path (the sheet may say `~` or a workspace-relative path), environment variable values, git remotes, account or login state, or whether any credential exists. The collector asks no tool about accounts. Every string is scrubbed before it is written; a test plants a fake user name, machine name and home path and checks that none reaches either file.

## Freshness
A sheet is reused when it is younger than `--max-age` hours (default 24), has the current schema version, and both files exist. `--refresh` collects again. A reuse prints "reused" and the collected-at time. A machine change (a tool installed, a disk filled) is not noticed until the sheet is older than the window or `--refresh` is given.

## Exit codes
0 written, reused or printed; 1 the sheet could not be written; 2 usage error.
