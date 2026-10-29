# Plan 042: Spec-driven sound routing and the Pilot 041 idea-to-deliverable test

Status: **P1–P3 implemented and verified; the two Pilot 041 live cells are prepared but not run**
(a host session spends the maintainer's account, so the maintainer starts them). No commit is part
of this slice.

Date: 2026-10-29. Branch: `codex/sound-model-catalogue`.

## Context

Two maintenance findings after the r3 review, where the maintainer accepted both MP4s as working
pipeline evidence while noting that content quality is a separate bar from the X-sourced
blueprints:

1. The sound skills told the agent to "resolve hardware" before an install, but nothing measured
   the machine, so a local-vs-external sound suggestion was an assumption rather than a decision.
2. The r3 pilot pre-authored its composition. That tested the pipeline, not whether the lead can
   turn a one-line idea into a motion-design deliverable.

## Jobs

| Job | Scope | Result |
|---|---|---|
| S1 | Deterministic capability probe | `audio-generation/scripts/probe-system.mjs` — read-only, no dependencies, CPU/RAM/disk/GPU/runtime facts plus route verdicts; 9 node:test cases |
| S2 | Route policy and floors | `audio-generation/references/system-capability.md` — planning floors, verdict semantics, decision procedure; a test pins the table to the script |
| S3 | Wiring | `audio-generation` step 1 and exemplars, `sound-design-direction/routes.md`, both orchestrators, both Sound Designer roles and the core floor |
| S4 | Pilot 041 kit | `scratch/pilot-041/` brief, prompts, harness (450 frames, 1920x1080, 30 fps), verifier with a positive self-test and a negative preflight |
| S5 | FFmpeg capability | `audiovisual-review/scripts/ffmpeg.mjs` (resolve/verify/plan/install/path), `references/ffmpeg.md`, Motion roles and both orchestrators; 9 node:test cases |
| S6 | Gates | focused suites, `npm run typecheck`, `hostlib:verify`; record what remains unverified |

## Decisions

1. **The probe measures; it does not promise.** Verdicts compare measured facts with documented
   planning floors, and every route carries `confirmedByProbe: false` plus
   `verified.modelRuns: false`. A probe never substitutes for a model card, a licence review or a
   real run.
2. **Three routes, always offered together.** The bundled local synthesiser/music bed (no model),
   a local model where the probe says at least `viable-with-caveats`, and an external provider that
   requires opt-in for uploads and spend. The lead presents the measured numbers and asks.
3. **Integrated graphics are not VRAM.** Windows `AdapterRAM` is unreliable and integrated GPUs
   share system memory, so an integrated adapter never counts toward a GPU floor.
4. **A firmware-reservation tolerance, stated openly.** A 16 GiB machine reports 15.7 GiB, so floors
   are compared with `0.5 GiB` added; the measured figure is reported unchanged and the tolerance is
   visible in the record.
5. **Pilot 041 hands over one sentence.** The brief fixes only the delivery contract and the
   no-provider rule; concept, signature shot, shot list, palette, type and sound route are the
   agency's work being observed.
6. **FFmpeg is a pipeline tool, not an optional extra — and it is capability-checked.** Presence is
   not enough: a build without `amix normalize` or `loudnorm` plays MP4 and fails the mix. The
   shared resolver prefers the project's own `ffmpeg-static`, so the common fix needs no admin
   rights and no PATH change. A machine-wide install and any PATH edit require explicit consent
   (`--consent`, plus `--allow-system-install` for system-wide), are idempotent, and print the undo
   command. The resolved path, version and `missing[]` are recorded in the QC evidence.

## Boundaries

No model download, install, provider call or upload in any of this. No host session started by the
agent. The verifier reads artifacts and the newest export only, and excludes installed skill trees
and shipped example assets so an example can never satisfy a gate.

## Verification log (2026-10-29)

| Check | Result |
|---|---|
| `node --test tests/audio-system-probe.runtime.mjs` | 9 passed (laptop, workstation, small machine, integrated GPU, memory tolerance, no fabricated run, CLI overwrite refusal, doc/floor parity, standalone run) |
| Probe on the maintainer's machine | 16 cores, 15.7 GiB, Intel Iris Xe (integrated, VRAM unreliable), 461.6 GiB free, python+uv present, no ffmpeg on PATH → bundled `recommended`, small TTS `recommended`, large TTS `viable-with-caveats`, music `not-recommended` (needs 12 GiB dedicated VRAM) |
| `tests/agency-media-roles.test.ts` after native regeneration | 10 passed |
| Pilot 041 setup, both cells | `add`/`init`/`timeline`/`status` exit 0; 450 frames, 15.0 s, 1920x1080, 30 fps; identical timeline fingerprint in both cells |
| Pilot 041 verifier, negative preflight | 3/13 pass before the session (only pre-installed contract files); every deliverable check fails |
| Pilot 041 verifier, positive self-test | 21/21 checks pass on a synthetic complete cell: real probe record, shipped example spec validating at exit 0, real 15.0 s 1920x1080 30 fps H.264 + AAC 48 kHz stereo export |
| Focused repositories suites | 11 files, **359 tests passed** (probe, agency roles, motion helpers, skill layout, quality ratchet, licence tiers, registry, prerequisites, native Claude agents, hostlib licences, Remotion add-on) |
| FFmpeg capability | `tests/ffmpeg-capability.runtime.mjs` 9 passed (resolution order, complete build accepted, MP4-only build rejected, missing binary reported, `amix` without `normalize` flagged, plan recommends project-local, install consent gate, idempotent PATH edit with undo, CLI side-effect-free plan) |
| FFmpeg on this machine | project `ffmpeg-static` resolved at 6.1.1 essentials build; `verify` ok with `amix`, `loudnorm`, `libx264`, `aac`; bare `ffmpeg` is absent from PATH, which is exactly the case the resolver exists for |
| `npm run typecheck` | exit 0 |

Not verified: any local model actually running on this hardware, listening, provider routes, the two
live Pilot 041 cells (not started), and the creative quality of any output.
