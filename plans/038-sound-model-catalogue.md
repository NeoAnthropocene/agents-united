# Plan 038: Local sound-model catalogue and sound/orchestrator skill improvements

Status: **COMPLETE (J0–J8), with one honest caveat.** `npm run typecheck` exit 0. The full parallel
`npm test` is **not green on this machine**: run #1 exit 1 (4,797 passed / 28 failed / 209 skipped,
42 timeouts in 13 install/lifecycle/e2e files), run #2 exit 1 (4,821 passed / 4 failed / 209 skipped,
4 timeouts in `cli-e2e`, `e2e-domain-conformance`, `e2e-sed-bundle-lifecycle`). Every one of those
files passes in the serial rerun with the unchanged 30 s timeout (13/13 files, 331 passed, exit 0),
so the failures are load-induced timeouts, not content regressions. Targeted gates are green
(layout 44/44, layout+ratchet 58/58, role/contract/floor 179/179). Evidence:
`scratch/media-038/final-report.md`. Push and PR are **not** performed; they wait for an explicit
maintainer signal and a green pre-push gate.
Date: 2026-10-27 (Europe/Berlin).
Machine-readable state and job ledger: [038-sound-model-catalogue.jobs.json](038-sound-model-catalogue.jobs.json).

## Execution contract

Worktree: `C:\github\agents-united`.
Branch: `codex/sound-model-catalogue`, cut from freshly fetched `origin/dev` at
`72e2cf4ddc92a6120313c5039f1bc39bc4b4f021` (PR #211 / plan 037 merged).
Repository: <https://github.com/NeoAnthropocene/agents-united.git>.

**Wait for the maintainer's signal before starting J1.** Until then this plan and its
ledger are the only changes on the branch. Execute jobs sequentially with one writer,
checkpointing the JSON ledger after each meaningful patch or test; mark a job done only
against its done criteria with recorded evidence. Push and PR creation need a separate
human request; PRs target `dev`, never `main`; never force-push; run `git diff --cached`
before every commit. TDD: a failing assertion first for any testable change. The final
offline gate is `npm run typecheck && npm test`, reading the run's own exit code. Never
weaken a validator. No model is installed, run or bundled; no provider call, upload or
credential read; zero external spend.

## Maintainer decisions (2026-10-27)

- **D1 Scope:** the full plan — catalogue work (A) through role/orchestrator wording
  (F), including ADR 0057.
- **D2 ASR section:** included, with the binding usage contract below defining exactly
  where this agent may and may not use sound→text models.
- **D3 Non-commercial candidates:** kept in the catalogue with accurate licence facts.
  The user decides per project whether to use them; the catalogue reports facts, never a
  recommendation.

## Approved outcome

`registry/skills/audio-generation/references/local-models.md` becomes a five-section
dated capability catalogue (speech/TTS; sound effects and soundscapes; instrumental
music; music with vocals and lyric-to-song; transcription assistance) keeping the
three-column evidence contract and the six-step preflight, plus a commercial-use triage
note. `audio-generation/SKILL.md`, `sound-design-direction/references/narration-rights.md`,
`audio-post-production/references/finishing.md`, the Sound Designer role (canonical +
Claude native) and the orchestrator (canonical + Claude native) gain the small clauses
below. ADR 0057 records the singing-copy, licence-triage and transcription-boundary
decisions.

### Candidates and leads verified 2026-10-27 (official pages; licences unread where marked)

| Section | Candidate | Lead confirmed today | Licence status |
| --- | --- | --- | --- |
| Speech | `cloud0day3/antalia-mini` | Turkish TTS, 7.62M params (DiT + Vocos-style vocoder), 48 kHz, CPU / ONNX Runtime Web / MPS, built-in Turkish text normaliser (vendored `turkish-tts` NOTICE); weights trained on synthetic data | unread → J1 |
| Speech | `hexgrad/Kokoro-82M` | existing row, unchanged | Apache weights (existing row) |
| SFX | `stabilityai/stable-audio-open-1.0` | 1.2B, ~47 s stereo 44.1 kHz; **gated** (HF info-share agreement) | Stability AI Community License; commercial terms separate — stated |
| SFX | `declare-lab/TangoFlux`, `declare-lab/tango2` | flow matching + FLAN-T5 conditioning; tango2 outputs 16 kHz | **checkpoints non-commercial research only**, also subject to Stable Audio Open + WavCap + dataset licences — stated |
| Music | `facebook/musicgen-medium`, `musicgen-melody` | autoregressive EnCodec codes; melody conditioning; native transformers support | code MIT, **weights CC-BY-NC 4.0** — stated |
| Music+vocals | `m-a-p/YuE2-3B` | lyrics + style → full song with vocals, editable ABC score, cover mode (repo `multimodal-art-projection/YuE`) | **weights CC BY-NC 4.0** + third-party code licences — stated |
| Music+vocals | `MiniMaxAI/MiniMax-Music3` | hidden-state flow matching (2.4B FM + 123M Flow-VAE), 32 kHz stereo, `[Verse]/[Chorus]/[Bridge]` tags, diffusers pipeline docs | custom LICENSE unread → J1 |
| Music+vocals | `ACE-Step/Ace-Step1.5` family (`acestep-v15-xl-turbo-diffusers`, GGUF `acestep.cpp`, ONNX) | 5B flow-matching DiT, 48 kHz stereo, lyrics + section tags; the attachment's "<4 GB VRAM" is a quantized-variant lead only | unread → J1 |
| Music+vocals | `ASLP-lab/DiffRhythm2` | block flow matching, lyric-to-song, arXiv 2510.22950; code/weights also at `github.com/xiaomi-research/diffrhythm2`; `espeak-ng` dependency | unread → J1 |
| Transcription | `openai/whisper-large-v3-turbo`, `distil-whisper/distil-large-v3`, `nvidia/parakeet-tdt-0.6b-v2/v3`, `nvidia/canary-1b` (+`canary-1b-flash`), `facebook/w2v-bert-2.0`, `Systran/faster-whisper-large-v3` | ASR families; Canary is EN/DE/FR/ES; w2v-bert is a fine-tuning base, not a finished transcriber | each unread → J1 |

The attachment's Duyu-small note is preserved as the classification caution below: a
listing that files an ASR model under "speech models" is a classification error.

## ASR usage contract (binding from J2; transcribed verbatim into the catalogue)

**Classification first.** A generation model answers "make audio"; an ASR model answers
"what does this audio say". Neither substitutes for the other. A sound→text model never
satisfies a generation request, and a generation model never owns transcript text. The
Duyu-small caution is the standing example: task type follows the model's actual
capability, not the heading someone filed it under.

**Where this agent uses ASR (sound→text) models** — transcription assistance only:

1. **Take verification aid (audio-generation step 6):** transcribe a recorded or
   generated speech take to *propose* word/segment marks against Kaan's approved exact
   copy; suspected mismatches (names, numbers, negations, dropped words) are flagged for
   the human listening review. The transcript never replaces listening and never edits
   approved copy.
2. **Phrase-mark assistance (selection-handoff):** ASR word timings may *propose* phrase
   starts/ends for the cue map; marks are confirmed by actual playback or
   waveform-assisted listening before hand-off, and ASR-proposed marks are labelled as
   proposals in the source ledger.
3. **Caption/transcript drafting (audio-post-production, audiovisual-review):** where
   captions or transcript timing are applicable deliverables, ASR may draft timecoded
   text from the approved final mix; captions derive from the final approved words and
   actual timing (including meaningful non-speech cues); a competent speaker of the
   language reviews before delivery.
4. **Post-mux spot check (audiovisual-review):** ASR may flag suspected intelligibility
   regressions in the muxed film audio as listening-review *input*; an ASR pass is not a
   listening pass, and a transcript match is not pronunciation or rights quality.
5. **Language feasibility input (consultation):** an ASR model's documented language
   coverage is evidence about *transcription* support only — never about TTS/singing
   coverage, accent acceptability or name pronunciation.

**Where it is never used:**

- Never to own or alter approved copy. Translations (including Whisper-style "translate"
  output) are draft copy and route through Chris/Kaan for approval like any copy.
- Never as a substitute for voice consent, rights review or the required listening pass.
- Never to "repair" a mismatch by changing the words: the script is fixed; the take or
  the timing changes through their owners.
- Never on user audio through a hosted ASR service without the approved external route:
  local ASR fits the local route; any hosted transcription is an API/hybrid decision
  with upload consent and a per-job ceiling through Chris.
- Never as proof that a language or pronunciation is acceptable (ASR can mis-hear
  confidently); never to transcribe private consent documents into any record.
- Transcribing third-party audio is processing, not a right: unclear transcription
  rights route through Chris.

Commercial-use triage (J2 writes the final wording): the catalogue reports the facts —
each candidate's code licence, weight licence and commercial terms as its official page
states them, dated. Non-commercial weight licences (e.g. MusicGen, TangoFlux, YuE2-3B as
verified today) restrict commercial client deliverables but remain usable where the user
chooses them for internal scratch/prototyping with knowledge of the terms. The user
decides per project; the agent states accurate licence facts and routes unresolved
questions through Chris. A code licence never settles weight or output eligibility.

## Role and orchestrator clauses (J6; exact edits, test-pinned strings preserved)

- **Sound Designer** (`registry/agents/subagent-sound-designer.md` and the authored body
  of `registry/hosts/claude/agents/agency-sound-designer.md`, "Media consultation and
  fixed inputs"): "narration languages, voice consent" → "narration and lyric languages,
  voice consent for spoken and synthetic singing voices"; add: "Lyrics sung by a
  synthetic voice remain Kaan's approved copy; style prompts must not imitate a named
  living performer; generated-song lyrics carry the same script-revision and
  pronunciation discipline as narration."
- **Orchestrator** (`registry/agents/orchestrator-digital-agency.md` and
  `registry/hosts/claude/agents/orchestrator-digital-agency.md`, "Media scope and
  approved production"): after "local model installation a separate project-scoped
  decision." add: "Local model candidates for speech, singing, music, effects and
  transcription carry dated licence facts; a non-commercial weight licence is flagged
  and the user decides per project. Lyrics remain Kaan's approved copy even when sung."
- Semantic cores stay unchanged by default (copy ownership already sits in scope
  boundary 1); if execution finds a real contract gap, fix the core and regenerate the
  floors with `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`, with
  `checkFloor` at `[]` and `tests/subagent-contract.test.ts` /
  `tests/core-safety-floor.test.ts` green. Extend `tests/agency-media-roles.test.ts`
  first, watch it fail, then edit the files.

## Jobs

| Job | Scope | Done criteria |
| --- | --- | --- |
| J0 | Plan + ledger checkpoint on the branch (this commit) | Files exist on `codex/sound-model-catalogue`; decisions D1–D3 recorded; status AWAITING SIGNAL |
| J1 | Dated source verification of every candidate row: official card/repo, code vs weight licence, language coverage, output rates/lengths, gated status, two-home provenance (DiffRhythm2), dependency notes (espeak-ng) | Every "unread → J1" cell resolved or explicitly marked unresolved with an owner; evidence dated and cited; attachment-only claims (VRAM, benchmark ranks, parameter splits) confirmed or marked as unconfirmed claims; no downloads or installs |
| J2 | `local-models.md` restructure: five sections, commercial triage note, ASR usage contract verbatim, classification boundary, six-step preflight kept, new inspection date | Three-column contract intact; every claim dated and sourced; link/layout checks pass |
| J3 | `audio-generation/SKILL.md` touch-ups (steps 4/6 name the categories, language/lyric coverage, sung-copy rule, ASR boundary) + one new eval in `evals/evals.json` (commercial lyric-song request → NC-licence flag + Chris route) | ≤90 lines / ≤6000 chars; description ≤1024 chars, style unchanged; evals 2–5 valid schema; `skill-layout` green |
| J4 | `sound-design-direction/references/narration-rights.md`: "Generated singing and music-with-vocals" subsection | Lyrics = approved copy; no named-performer imitation; synthetic vocalist ≠ rights pass; wordless instrumental marks N/A; narration-rights pins intact |
| J5 | `audio-post-production/references/finishing.md`: song-model outputs enter as sources | Resample-as-edit with retained original; dual-track/split outputs = aligned-stem candidates measured like any source; mixer contract unchanged |
| J6 | Role + orchestrator clauses (above), 6 files | New assertions in `tests/agency-media-roles.test.ts` red first then green; all pinned strings preserved (`Media Request`, `local, API or hybrid`, `media/project.json`, `Static jobs do not`, `external-footage opt-in`, `eleven types are a menu`, `canonical timeline fingerprint`, `A revision label alone is insufficient`, `transcript or caption timing when applicable`, Sound-only regexes); core/floor/contract suites green if cores touched |
| J7 | ADR 0057 (singing-copy ownership, commercial-licence triage, transcription boundary) + `docs/skill-quality/digital-agency-audit.md` row metrics refresh for touched skills | ADR dated with decisions and rationale; audit counts measured, not estimated |
| J8 | Full offline gates and hand-off | Serial `npm run typecheck && npm test`, exit codes read from the runs themselves; targeted suites green during dev (skill-layout, skill-quality-ratchet, agency-media-roles, subagent-contract, core-safety-floor, media-audio, e2e-skills-depth); `git diff --cached` before each commit; report states what is verified and what stays unverified; push + PR to `dev` **only on maintainer request** |

## Verification and boundaries

Static gates prove structure and contracts, not audio quality: no candidate is
installed, run, benchmarked or listened to in this plan; licence rows are dated readings
of official pages, re-checked in J1, never a legal conclusion. Zero spend; no provider
account, upload or credential access. Uploads of user audio, model installs and any paid
generation remain separate project-scoped decisions outside this plan. Other hosts than
Claude stay unverified. Pinned test strings and validator thresholds are never weakened
to pass.



