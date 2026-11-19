# Sheet format

The sheet is built from an allowlist: nothing outside this list is emitted. Produced by `scripts/specs.mjs`; schema version 3.

## Files
- `.agents-united/system-specs.md`: the short, human-readable sheet (target under 2,500 characters).
- `.agents-united/system-specs.json`: the same facts as data, written beside the Markdown file.
- `--out <file.md>` names the Markdown file; the JSON file takes the same name with `.json`. The file must end in `.md`, stay inside the working folder (no absolute path outside it, no `..` escape), and may overwrite only an earlier sheet (first line `# System specs`) or an empty file; the `.json` beside it may overwrite only an earlier sheet. Each refusal exits 2.
- Writes go through a temporary file in the same folder and a rename, the JSON last.
- When the sheet is created in the default folder `.agents-united/`, the script writes a `.gitignore` containing `*` there, so the sheet is never committed by accident. An existing `.gitignore` in that folder with other content is left alone and the output line says so. No project-level `.gitignore` is edited.

## Fields (JSON)
| Field | Meaning |
|---|---|
| `schemaVersion` | The format version, `3`. A sheet with another version is never reused. |
| `collectedAt` | UTC time of collection, `YYYY-MM-DDTHH:MM:SSZ`. |
| `os.family` | `windows`, `linux`, `macos` or `other`. |
| `os.environment` | The same, or `wsl` when Linux runs inside Windows Subsystem for Linux. |
| `os.name` | Edition or distribution name (for example "Windows 11 Pro", "Ubuntu 24.04 LTS", "macOS 15.1"). |
| `os.distribution` | Linux distribution name, else `null`. |
| `os.release` | Release or build number. On macOS the product version (from the system's own version tool); when that cannot be read, "Darwin kernel" and the kernel release. |
| `os.architecture` | CPU architecture (`x64`, `arm64`). |
| `os.wsl` | On Windows: `present` when the WSL launcher lists at least one distribution, `installed, no distribution` when it answers with an empty list, `absent` when it is missing or fails, or `not determined`. Elsewhere `not applicable`. |
| `cpu.model`, `cpu.logicalCores` | Processor model text and the number of logical cores the process may use (`availableParallelism`); `null` when unreadable. |
| `memoryGiB` | Total memory, rounded to whole GiB; `null` when unreadable or zero. |
| `gpus[]` | `{ name, vramGiB }`. VRAM is read only where no elevated rights are needed (nvidia-smi, macOS system profiler); otherwise `null`. Only the tool's standard output is read. When no GPU can be read: one entry named `not determined`. |
| `freeDiskGiB` | Free space of the volume that holds the working folder, rounded; `null` when unreadable or zero. |
| `shells[]` | `{ name, status, version }` for pwsh, powershell (Windows), bash, zsh, cmd (Windows). On Windows a `bash` found under System32 is the WSL launcher: it is not run and is listed as `bash (WSL launcher)`; a `bash` under a Git or MSYS folder is listed as `bash (Git Bash/MSYS)`. No path is printed. |
| `tools[]` | `{ name, status, version }` for the fixed tool table in `scripts/specs.mjs` (`PROBES`). |
| `fingerprint` | `{ hash, parts }`: one 8-character hash per probed tool, per shell (`shell pwsh`, ...), for the ordered absolute PATH entries (`PATH`), `os release`, `architecture` and `memory`, and one SHA-256 over all parts (it must equal the hash of `parts`, else the sheet is not valid). Hashes only, never a path (see `check` below). |

`status` is one of, with one meaning each:
- `present`: the version call ran and exited 0. `version` holds the first version number it printed, digits only, or `null` when the output has none (ffmpeg prints a build id).
- `absent`: the tool was not found on the path. A Windows Store python stub that only opens the Store counts as absent. On macOS, a `/usr/bin` stub for git, python, pip or java that would open an install dialog is absent and is never run (see below).
- `not determined`: the tool was found but the call timed out, failed (non-zero exit), the whole collect ran out of its time bound, or the runner broke. Instruction for every reader: report it and treat it as unknown, never as missing and never as available; a new collection, which only the coordinating agent (or an agent working alone) may run with `--refresh`, can resolve it, and if the tool is still not determined afterwards it stays unknown.

## Tool table
node, npm, pnpm, yarn, bun, deno, python, pip, uv, git, gh, docker, docker compose, podman, kubectl, helm, terraform, az, aws, gcloud, vercel, supabase, java, dotnet, go, rustc, cargo, ruby, php, ffmpeg, and the agent command lines claude, codex, cline, agy. Each is asked for its version once with a fixed argument list and a timeout of about 5 seconds (12 for the slow cloud CLIs). To add a tool, add one line to `PROBES` and its name to the list in the test.

How a probe runs: no shell string, only a fixed argument array; the command is found only through the absolute entries of PATH (never the working folder); output is capped at 64 KB; at the timeout the whole process tree is ended, and the script exits explicitly when it is done.
- Host command lines (`agy`, `cline`, `claude`, `codex`) are run with a version flag only. A host command that opens a window would be a defect of that host; they were seen to behave on one Windows machine and were not tried on others.
- pnpm and yarn may be Corepack shims. The probes run with `COREPACK_ENABLE_NETWORK=0`, which the Corepack documentation (github.com/nodejs/corepack, configuration) says blocks every network fetch, so a shim that is not cached fails and the tool reads `not determined` instead of downloading anything. `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` would only hide the download URL, so it is not used. Not verified live: no Corepack shim was present on the machine where this was written.
- macOS, not verified on a Mac (fake-runner tests only): the script asks `xcode-select -p` once; when it fails, a git, python or pip found under `/usr/bin` is absent and not run. For java it asks `/usr/libexec/java_home` first (its output is discarded).

## Privacy rule
Never in the sheet: the user name, the machine name, the home folder or any absolute path (the sheet may say `~` or a workspace-relative path), environment variable values, git remotes, account or login state, or whether any credential exists. The collector asks no tool about accounts. Tool names, statuses and versions are never scrubbed: versions hold digits only.

The free-text fields (CPU model, OS name, distribution and release, GPU names) are scrubbed as follows, and only as follows:
- The home folder (any separator, any case), UNC paths, drive paths and other absolute paths are replaced everywhere.
- An account-derived token (the user name, the home folder's name, the machine name and its first label, and the values of USERNAME, USER, LOGNAME, COMPUTERNAME and USERDOMAIN, which are matched and never emitted) of five or more characters is replaced anywhere in the text as a whole word, case-insensitively ("jane" inside "janeway" is not touched), unless it is one of these ordinary words: ubuntu, debian, fedora, centos, rocky, alma, alpine, arch, kali, windows, server, linux, intel, nvidia, apple, microsoft, admin, user, root, runner.
- A token of three or four characters is replaced only when it touches a path separator or an @, or when it is the whole field.
- NOT removed: a short (under three characters), three- or four-character, or stoplisted account name inside plain text. A user named "ubuntu" leaves "Ubuntu 24.04" intact, and that is the price of keeping real OS names readable.
A test plants a fake user name, machine name and home path, in plain words and in path-like forms, and checks that none reaches either file.

## Collect once, trust, and check
`collect` recomputes the fingerprint (no process is started) and reuses the sheet when it is valid, from this machine, and the fingerprint is identical, whatever the sheet's age. "From this machine" means the same OS family and architecture. A fingerprint that differs only in the PATH entries is also a reuse, with no tool run: the output line says "(PATH differs from the collection)" and the stored PATH part is kept, so two agents with different PATHs never overwrite each other's sheet. Any other difference (a tool, a shell, OS release, architecture or memory), or an invalid or foreign sheet, collects again; when an earlier valid sheet existed, the output line names the parts that differed (names only). A sheet copied from elsewhere cannot match without this machine's tool file sizes and times, so it is not reused. `--refresh` always collects again and is run only by the coordinating agent, or by an agent working alone. There is no age limit and no `--max-age`.

A sheet is valid when the JSON has exactly the keys above, statuses from the enum, versions that are numbers, free text on one line from a small character set, a `collectedAt` of the exact shape, and a well-formed fingerprint whose hash equals the hash of its parts and whose memory and architecture parts agree with the sheet's own fields. A cached sheet is untrusted input: the Markdown is always rewritten from the validated JSON, never trusted from disk. An empty Markdown file or one without the header counts as no sheet.

Schema numbers: the fingerprint's key list is tied to the schema number (a test fails when the keys change without a bump). A sheet with another schema number is not reused. An older script never overwrites a sheet with a higher schema number: it exits 2 with a plain message. A newer script replaces an older sheet.

### check
`check` tests whether the environment changed since collection, read-only and without running any tool or making any version call. It re-resolves each probed tool and shell on the PATH (absolute entries only) and hashes, per part, found or not and, for a found tool, the size and modification time of the resolved file; the PATH entries; OS release, architecture and memory. It compares that with the fingerprint in the JSON and prints one line:
- `unchanged` (exit 0): nothing differs, or only the PATH entries differ and no tool or shell part does; in the second case the line ends "(PATH differs from the collection)".
- `changed: <names>` (exit 3): the names of the tools, shells, `os release`, `architecture` or `memory` that differ, never a path, at most eight and then "... and N more". When the PATH entries differ too, the line starts `changed: PATH differs from the collection, so the names may be a PATH effect:`.
- exit 1: `no usable sheet` (missing, damaged, edited, or from another machine), or `another format, run collect` when the sheet has another schema number.
It writes nothing and takes well under a second.

What `check` and the fingerprint do not cover, plainly:
- A tool updated in place with the same file size and modification time.
- A shim manager (pyenv, volta, asdf, rustup, corepack) that switches versions behind one unchanged shim: `check` says "unchanged" although the version differs. (A manager such as nvm that changes the resolved file is seen.)
- WSL state, the GPU, the macOS developer-tools state, and anything that is not a probed tool. A plugin such as `docker compose` is covered only through docker's own part.
- The CPU, GPU and OS text: they are outside the fingerprint.
The answer to all of these is a new collection, run with `--refresh` by the coordinating agent (or by an agent working alone). A specialist reports and asks, at most once per task; after the update it relies on the sheet and does not check again in that task. Where it cannot message the coordinating agent during its run, it puts the request in its hand-over report and continues with the fact marked unknown.

## Exit codes
`collect`: 0 written, reused or printed; 1 the sheet could not be written. `check`: 0 unchanged, 3 changed, 1 no usable sheet or another format. Both: 2 usage error or a refused `--out` (including a sheet with a higher schema number, for `collect`).
