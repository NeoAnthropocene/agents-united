# Plan 042: Spec-driven sound routing and the Pilot 041 idea-to-deliverable test

Status: **Implementation and recorded technical pilots complete; publication in progress.**
Both Pilot 041 exports passed the recorded mechanical checks. The maintainer's later playback and
listening review did **not** accept their creative quality and reported slight Remotion sync drift.
The dated entries below preserve earlier observations; the final review amendment supersedes
pending/not-run language. No further paid Host run is part of this publication task.

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

## Pilot 041 outcome (2026-10-29)

| Cell | Result | Verifier |
|---|---|---|
| native | **complete deliverable**; one sentence became a concept ("Full Circle"), a named signature shot, a causal five-beat shot list, a geometry-level visual handoff, a claim-checked copy set and a measured 15.0 s export | **21/21 PASS**; USD 4.8455483 |
| remotion | **complete deliverable** on the second attempt (first attempt was quota-blocked, second refused the un-provisioned renderer); "Egg to Hen" with proof stills, two fix rounds and a measured export | **21/21 PASS**; USD 1.0657866 (+0.2938542 blocked attempt) |

Both exports verified: 15.0 s / 15.02 s, 1920x1080, 30 fps, H.264, AAC 48 kHz stereo, -16.0 / -16.14
LUFS, -2.19 / -1.5 dBTP. Visual comparison of both signature frames is in the pilot's `findings.md`:
native wins on concept and type, Remotion on palette and glow, and **neither reaches the reference
bar** — a creative ceiling, not a pipeline gap.

Two harness defects were found by the runs and fixed: the brief forbade the renderer's own pinned
install (so the Remotion agent correctly stopped and documented it), and the system probe reported
`ffmpeg: false` from a PATH-only check on a machine whose project ships `ffmpeg-static`.

Native proves the new behaviour end to end: the probe was written at 10:50:15 with this machine's
measured facts, the chosen sound route was the bundled local one *because* the probe says a music
model is `not-recommended` (12 GiB dedicated VRAM required, 0 available), the motion prompt validated
at exit 0, 18 proof frames were reviewed before the render, and QC names the project-local
`ffmpeg-static 6.1.1` while marking playback, listening, sync and creative quality **unverified**.

The Remotion comparison is still owed. It is a quota failure, not a code failure: re-run
`.\run-cell.ps1 -Cell remotion -Budget 12` in `scratch/pilot-041` after the reset and then
`node verify.mjs both`. Nothing in this repository blocks it; the harness, the pinned 4.0.539 licence
record and the installed skills are already in place.

## Why the Remotion cell hit `429 usage_limit_reached` (and why client-side rendering is not the fix)

The two limits that got confused are unrelated:

| | Remotion licence | The `429` |
|---|---|---|
| What limits it | **Who** may use Remotion for free: individuals, non-profits, for-profit organisations with up to three employees, noncommercial evaluation | The **Claude Code account's session quota**, i.e. tokens spent by the agent running the cell |
| Does it count renders? | No. Neither CLI/SSR nor client-side rendering has a render quota | n/a |
| Visible symptom | Company License needed above the free-eligibility line | `api_error="usage_limit_reached"`, `"You've hit your session limit · resets 1pm (Europe/Berlin)"`, `modelUsage: claude-sonnet-5-5` |
| Fix | Buy a Company License if ineligible | Wait for the reset; nothing in Remotion or the harness is wrong |

The Remotion cell never rendered. It spent USD 0.2938542 on two agent turns and was refused by the
model account while planning, after the 70-minute native cell had consumed the window. Client-side
rendering would not have helped: the tokens are spent before any render starts, and both modes are
equally free of render quotas.

Client-side rendering is nevertheless a genuine option, now documented in
`remotion-production/references/rendering-modes.md`, and deliberately **not** the default:

- It renders in the browser (`@remotion/web-renderer`, stable from 4.0.491), encodes with WebCodecs via
  Mediabunny and needs no Node renderer, no FFmpeg and no bundling step — attractive for the hands-on
  Studio route and for browser-only hosts.
- It **emulates CSS onto a canvas** instead of screenshotting: `z-index`, `backdrop-filter`,
  `background-blend-mode`, `object-position`, `perspective`, `transform-style` and non-linear-gradient
  backgrounds are unsupported. Those are exactly the effects these films use for depth, glow and
  layer order, so the CLI render stays the delivery gate.
- Optional HTML-in-canvas capture lifts the CSS limits but is a separate route with its own review.
- It always sends one telemetry event per render (CLI/SSR only when a licence key is set), runs single
  concurrency, and is throttled in a background tab.
- Adopting it means pinning `@remotion/web-renderer` with the other packages, extending the helper's
  dependency check, and adding its own evidence. Until that is run, it is **documented but unverified**
  here.

## Publication verification — 2026-10-29

The follow-up plan and five linked plan documents passed relative-link/fence checks. Publication
safety regressions passed **38/38 node:test cases** (PATH transport/read-back/undo, FFmpeg capability
failure cases, project-root detection). The focused Vitest run passed **24 tests across five files**.
The actual project-local FFmpeg 6.1.1 answered the stricter verifier with no missing capabilities;
`hostlib:verify` passed. Real user PATH mutation was not performed and remains **unverified**.

`npm run typecheck` and `npm test -- --no-file-parallelism` were launched for the pre-push gate.
The final typecheck after the safety corrections exited **0**. The serial run passed the
domain-conformance file (109 tests run, 208 conditional skips). The remaining worker continued
without another file verdict; the session-owned process tree was explicitly stopped after more
than 22 minutes. This is an **aborted run, no full-suite verdict**, not a demonstrated assertion
failure or a pass. Raw log: `scratch/pr-prepush-gates.log`; wrapper exits:
`scratch/pr-prepush-gates.json`. Complete-suite acceptance remains **unverified**.

Published as draft [PR #212](https://github.com/NeoAnthropocene/agents-united/pull/212), base `dev`.
The PR stays draft while complete-suite acceptance and Plan 041 redistribution scope are open.
No live Host session or model/provider spend was started for publication.

## Final maintainer review and publication amendment — 2026-10-29

The maintainer watched/listened to both Pilot 041 exports and reported: sound effects and
background sound are very basic; Native A/V sync is better; Remotion is a bit unsynchronised;
creativity is low against the X examples and is **not accepted**. This supersedes earlier
"unverified playback/listening" only to the extent of that human review. No measured sync offset,
root cause, rights clearance or colour-range compatibility approval is implied. The recorded
21/21 mechanical results remain historical and are not a creative/sync pass.

Earlier "Remotion comparison still owed" and "never rendered" statements refer to the quota-blocked
attempt; the later provisioned run delivered. Its preceding post-reset blocked run was terminated
before a final cost record was captured: its cost is **unverified**, so USD 4.8455483 + 0.2938542 +
1.0657866 is only the known recorded subtotal, not a complete spend total.

Installation audit correction: Pilot 041 installed `digital-agency` alone, not the 12 official
skills. Their Pilot 040 install proof does not establish Pilot 041 use. Do not attribute the film's
creativity to the official add-on or claim it was an efficacy trial of that pack.

The maintainer authorized pushing this work to a PR targeting `dev` and requested
[Plan 043](043-reference-led-visual-craft-gate.md): actual 1–2 reference-frame comparison, explicit
grain/gradient-mesh/depth-blur/light-wrap decisions, bounded reproof and final-mux sync review while
keeping a lower-cost-model baseline. No gate implementation or new paid run is included here.

Publication safety review added regression-tested fixes: Windows user PATH values and undo are
encoded rather than interpolated as PowerShell, I/O fails closed and read-back is checked; FFmpeg
verification rejects absent `amix normalize` and required PCM encoders; probe CLI roots itself in
cwd or explicit `--project`, not the output file's directory. Real PATH mutation remains unverified.

Not verified: any client-side render in this repository. The official add-on's redistribution
scope remains a draft-PR merge/release hold (Plan 041 amendment).
