# Plan 040: Signature-shot motion prompts and proof gate

Status: **P0–P4 complete; P5 partial; P6 PR awaits the maintainer's approval.** The r3 native and
Remotion pilots both rendered and passed 28/28 independent acceptance checks. The targeted gate,
typecheck and host-library verification are green. The full parallel suite was stopped after more
than 18 minutes in the documented install/projection timeout and `EEXIST`/`ENOTEMPTY` collision
class, with no verdict; a serial adjudication remains. No commit or push has been made.

Date: 2026-10-29 (Europe/Berlin). Branch: `codex/sound-model-catalogue`.

## Goal

Stop Motion from treating a recipe name and an effects checklist as direction. Require a creative
visual handoff, a validated signature-shot prompt, causal shot progression and reviewed proof
frames before a full render.

## Source material

Prompt Motion's realtime and showreel customizers were inspected on 2026-10-29 for structure only:
a signature shot, ordered shots with named camera moves, cause/reaction, inherited transitions,
beat timing and proof-frame inspection. No prompt text, code or assets were copied, and no source
quality claim transfers. The repository's numbered recipes remain original MIT work.

The official Remotion Agent Skills pack was inspected but is **not used** in this slice. Its
standalone repository reports `license: null`, package version 4.0.539, and it contains production
advice that would conflict with this repository's gates. It stays link-only until the licence and
runtime-version questions are resolved; no `npx skills add` refresh runs inside an agent session.

## Jobs and evidence

| Job | Scope | Result |
|---|---|---|
| P0 | Define film grammar and the machine-checkable prompt contract | `references/prompt-blueprint.md`, `assets/motion-prompt.example.json` |
| P1 | Red-green validator and cases | `scripts/check-prompt-spec.mjs`; `tests/skill-scripts/media-motion.cases.mjs` |
| P2 | Wire Creative/Motion/Chris and both renderer protocols | native plus canonical role wording; ADR 0058 |
| P3 | Static gates | 241 targeted tests pass; typecheck exit 0; hostlib verify pass |
| P4 | Reinstall and rerun supervised pilots | both r3 MP4s rendered; each 28/28 in `scratch/pilot-040/verify-r3.mjs` |
| P5 | Full `npm test` adjudication | aborted after >18 min of the known parallel filesystem/timeout collisions; targeted gate green, serial rerun still required |
| P6 | Commit, push and PR to `dev` | blocked on explicit maintainer approval |

## Pilot evidence

- Native: `scratch/pilot-040/native/media/out/northwind-kites-r3.mp4`, SHA-256
  `6c59108269349af98075b1e57e15225434ce1dc6735d5077caed60fcab6484ec`, $3.5476.
- Remotion: `scratch/pilot-040/remotion/media/out/northwind-kites-r3.mp4`, SHA-256
  `e9e961e3d4991cf2ebe01d4a4e8f4f7d0187185dd765c67dc267e16cf4b93f17`, $3.5433.
- Both use a downloaded CC0 stock plate with provenance, a full-length `cue-bed`, validated prompt,
  two correction rounds before render, fresh QC and complete proof coverage.
- Visual review remains human work. Full playback and listening were not performed.

## Boundaries

Scratch media and sessions are ignored. The plan does not add a provider, model, renderer
dependency or spending authority. A public prompt guide is not a validator, and a validator pass
is not creative acceptance.
