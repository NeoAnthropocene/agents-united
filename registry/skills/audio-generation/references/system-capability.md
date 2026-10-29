# System capability and the sound-route decision

The lead must not guess whether a machine can generate sound locally. Probe it, show the
measured facts, then propose the routes that actually fit. `scripts/probe-system.mjs` is
read-only: it installs nothing, downloads nothing, renders nothing, listens to nothing, reads
no credential and makes no network call. A verdict is a **fit estimate against the planning
floors below, not proof that any model runs** on this machine.

## Run it before proposing a sound route

From the installed Skill root, with the selected project as the working directory:

```text
node "<skill-root>/scripts/probe-system.mjs" --out media/specs/system-capability.json
```

The JSON report is also printed to stdout. `--out` creates the file exclusively and refuses to
replace an earlier probe unless `--force` is passed, so a route decision always points at one
dated record. Exit 0 is a measurement; exit 2 is a usage error.

## What it measures

| Field | Source | Meaning |
| --- | --- | --- |
| `cpu.model`, `cpu.logicalCores` | `os.cpus()` | Processor identity and thread count |
| `memory.totalGiB`, `memory.freeGiB` | `os.totalmem()`, `os.freemem()` | Usable memory now |
| `disk.freeGiB` | `fs.statfs` on the project volume | Room for weights, caches and renders |
| `gpu.devices[]` | `nvidia-smi`, else Windows WMI, else `system_profiler` | Name, driver, VRAM when reliably reported |
| `gpu.dedicatedVramGiB` | Derived | Largest **dedicated, reliable** VRAM figure |
| `tools` | PATH lookups, project check | `ffmpegOnPath`, `ffmpegProjectLocal`, `python`/`python3`, `uv`, `nvidia-smi` presence |

Two measurement traps are handled explicitly:

- **Integrated graphics are not dedicated VRAM.** Intel Iris/UHD, AMD `Radeon(TM) Graphics`,
  Apple silicon and similar entries are marked `integrated: true`; Windows `AdapterRAM` is not
  trusted because it is frequently capped, so `vramReliable` stays `false` and the figure never
  counts toward a GPU floor.
- **OS-reported memory excludes firmware reservations.** A machine sold as 16 GiB reports about
  15.7 GiB. Floors are compared with `RAM_TOLERANCE_GIB = 0.5` added to the measured value; the
  measured number is still reported unchanged and the tolerance is shown in
  `memory.toleranceGiB`.
- **A missing `ffmpegOnPath` is not a missing FFmpeg.** Projects in this repository normally ship
  their own `ffmpeg-static`; `ffmpegProjectLocal` reports that. Resolve the actual binary with
  `audiovisual-review/scripts/ffmpeg.mjs` before concluding anything is missing.

## Planning floors

These are this repository's planning floors for a laptop-class or workstation-class run. They
are deliberately rough: they decide what to **propose**, and the actual model card, runtime and
licence still govern an install.

| Route | RAM (GiB) | Free disk (GiB) | Cores | Dedicated VRAM (GiB) | GPU posture |
| --- | --- | --- | --- | --- | --- |
| `local-bundled` | 1 | 0.1 | 2 | 0 | optional |
| `local-tts-small` | 8 | 10 | 4 | 0 | optional |
| `local-tts-large` | 16 | 20 | 8 | 8 | preferred |
| `local-music` | 16 | 25 | 8 | 12 | required |
| `local-asr-large` | 16 | 10 | 4 | 8 | preferred |

`local-bundled` is the bundled `synthesize.mjs` and `compose-bed.mjs` path: deterministic
synthesis and a composed music bed with **no model at all**. It is the route a machine like the
maintainer's laptop actually supports, and it produced both pilot soundtracks without a download.

## Reading a verdict

| State | Meaning for the recommendation |
| --- | --- |
| `recommended` | Every floor is met. Still propose it with the licence and model-card check. |
| `viable-with-caveats` | Hard floors met, a preferred condition is missing (usually no GPU). Say the caveat out loud: slower, CPU-bound, or shared-memory path. |
| `not-recommended` | A hard floor fails; `missing[]` names it. Do not propose an install on this machine without the user accepting a specific, measured risk. |
| `available-with-consent` | `external-provider` needs user opt-in for uploads and spend, a configured provider and a job ceiling. Never a silent fallback. |

`confirmedByProbe` stays `false` on every route, and `verified.modelRuns`, `verified.listening`
and `verified.installedModels` stay `false`: measuring a machine is not running a model.

## Decision procedure

1. Probe, then record the report in the selected project.
2. Read the routes out to the user with the measured numbers, e.g. “16 threads, 15.7 GiB RAM,
   no dedicated GPU, 461 GiB free: bundled synthesis is recommended; a small local speech model
   is supported; a music diffusion model is not, it needs 12 GiB of dedicated VRAM.”
3. Offer two or three routes, not one: the bundled local route always, a local model only where
   it is at least `viable-with-caveats`, and the external provider as an opt-in alternative.
4. Record the chosen route, its probe file, the caveats and the user's decision in the Media
   Request before any production work. Re-probe when the machine, GPU driver or project volume
   changes, and never copy an old probe into a new project.

## Related

- [Dated local-model catalogue](local-models.md) — candidates, licences and the install preflight.
- [Local recording and synthesis](local-production.md) — the bundled helpers and their limits.
- [Source and route decisions](sources-and-routes.md) — how routes interact with rights and cost.
