# Optional local models: source-based preflight

Official pages inspected 2026-10-24; the catalogue was expanded and every licence
re-checked 2026-10-27. These are capability leads, not installation instructions or
measured quality results. No model is bundled, installed or run by this Skill. Recheck
the exact selected release, model card and licence before use; retain the reviewed
revision, download hashes and decision in the project record.

**How to read the tables.** Each row states only what the inspected page supports and
names the evidence the project still owes. A licence field is the repository's
declaration, not a legal conclusion; a code licence never settles weight, output or
commercial-use terms. "Unconfirmed claim" marks a figure seen only in secondary material
and not verified on an official page. Dated readings stay dated: re-read the page at
selection time.

**Classification first.** A generation model answers "make audio"; a transcription (ASR)
model answers "what does this audio say". They never substitute for each other, and no
model is chosen by the heading it was listed under. Section 5 is transcription
assistance only.

## 1. Speech and text-to-speech

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0 declared; an 82M-parameter TTS model; the card's language field declares `en` while the repository also ships voice files for ja/zh/es/fr/hi/it/pt | Exact per-language quality, phonemizer/runtime dependencies, accent and name pronunciation, hardware/latency and a listening approval; a language list is not pronunciation evidence, and no general user-voice cloning is implied |
| [antalia-mini](https://huggingface.co/cloud0day3/antalia-mini) | Apache-2.0 declared; Turkish (`tr`) only; 7.62M-parameter flow-matching TTS with one voice; card states 48 kHz output, a CPU-first path with an MPS option, streaming and 8/16/24 kHz resampling; Turkish text normaliser vendored from `turkish-tts` (NOTICE); NOTICE states the weights were trained on synthetic data | Runtime/version pin, memory/storage, latency, long-form and name pronunciation, and a listening test in the client's register; the DiT/vocoder split and the browser ONNX claim are unconfirmed; the synthetic-data lineage is a rights question for Chris |

## 2. Sound effects and soundscapes

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [Stable Audio 3](https://github.com/Stability-AI/stable-audio-3), Small-Music / Small-SFX | The official repository describes separate CPU music and SFX variants and a portable CPU path documented for Windows/macOS/Linux; the repository code is MIT | Exact model/runtime version, available RAM/storage, compatible CPU/runtime, duration/latency and a listening test; the two variants are not speech models |
| [Stable Audio Open 1.0](https://huggingface.co/stabilityai/stable-audio-open-1.0) | Repository is **gated** (account plus licence agreement); declared licence is `other` with `license_name: stable-audio-community` and a LICENSE.md; library `stable-audio-tools`; card language `en` | Accept the gate and read LICENSE.md for this organisation and output; the 1.2B-parameter, 47-second and 44.1 kHz figures are unconfirmed claims because the card body is inaccessible without access; runtime, hardware and a listening test |
| [TangoFlux](https://huggingface.co/declare-lab/TangoFlux) | No licence field declared; the repository ships LICENSE.md and STABILITY_AI_COMMUNITY_LICENSE.md; the README states the checkpoints are **non-commercial research use only** and subject to Stable Audio Open's licence, WavCap's licence and each dataset's licence | Whether those terms cover the intended use — an absent licence field is not permission; dataset attribution obligations; duration, hardware and a listening test |
| [tango2](https://huggingface.co/declare-lab/tango2) | CC-BY-NC-SA-4.0 declared; English in card metadata; the official quickstart writes 16 kHz | Sampling rate for a final deliverable (16 kHz is the example), hardware and a listening test; NC and share-alike obligations apply |

## 3. Instrumental music

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [MusicGen medium / melody](https://huggingface.co/facebook/musicgen-medium) | Weights declared `CC-BY-NC-4.0` (the card states code MIT, weights CC-BY-NC 4.0); `MusicgenForConditionalGeneration` in transformers; the melody variant conditions on a hum or reference melody; instrumental only | Commercial-use eligibility (NC), attribution, duration/quality and hardware; there are no sung words to approve or caption |

## 4. Music with vocals and lyric-to-song

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [YuE2-3B](https://huggingface.co/m-a-p/YuE2-3B) | Weights `CC-BY-NC-4.0`; card languages `zh` and `en`; 3.63B parameters; lyrics plus a style prompt produce a full song with vocals; editable ABC score and a cover mode; third-party notices include SnakeBeta-NVIDIA-MIT and stable-audio-tools-MIT | GPU/memory and storage, language coverage beyond zh/en, lyric rights and approval (Kaan), no named-performer imitation, duration and a listening test |
| [MiniMax-Music3](https://huggingface.co/MiniMaxAI/MiniMax-Music3) | No licence field declared; the repository LICENSE is the **MiniMax-Music3 Community License**: use/copy/modify/distribute granted, commercial product UIs must prominently display "MiniMax-Music3", separate prior written authorisation above USD 20M aggregate annual revenue, a safeguards duty for hosted generation, Acceptable Use Policy; built from Qwen3-8B (Apache-2.0), Stable Audio code (MIT) and DAC (MIT); safetensors 2.43B F32; card describes hidden-state flow matching (2.4B) plus a Flow-VAE decoder (123M), 32 kHz stereo and section tags | Read the licence against the client's product, revenue and hosting model (Chris); no language metadata is declared, so per-language sung quality is unproven; duration, hardware and a listening test; the "8B global LLM" and "~22 GB / 8 GB VRAM" figures are unconfirmed claims |
| [ACE-Step 1.5](https://huggingface.co/ACE-Step/Ace-Step1.5) | MIT declared on the base repo (1.7B LM components) and on the [XL-turbo diffusers checkpoint](https://huggingface.co/ACE-Step/acestep-v15-xl-turbo-diffusers) (4.17B BF16, `AceStepPipeline`, 48 kHz stereo VAE); text2music family with lyrics-capable variants and community GGUF/ONNX builds | Exact checkpoint/runtime pin, RAM/VRAM, duration, lyric language coverage and a listening test; the "<4 GB VRAM" claim belongs to a quantized community build and is unconfirmed |
| [DiffRhythm2](https://huggingface.co/ASLP-lab/DiffRhythm2) | Apache-2.0 declared; block-flow-matching lyric-to-song (arXiv 2510.22950); the card's clone instructions name `github.com/ASLP-lab/DiffRhythm2`, while the paper names `github.com/xiaomi-research/diffrhythm2` — record both homes; `espeak-ng` is a required system dependency | Lyric language and phonemizer coverage, duration, hardware and a listening test; pin the exact code home and revision that produced a take |

**Licences are separate evidence from code.** A repository's MIT code notice, its weight
licence field, its commercial terms and any dataset licences are four different statements;
`CC-BY-NC` and "non-commercial research use only" restrict commercial client deliverables.
A code licence never grants rights to imitate a person or to reuse an unrelated source
recording, and no weight licence grants lyric rights.

## 5. Transcription assistance (sound→text) — not generation

| Candidate | What the inspected source supports | What still needs project evidence |
| --- | --- | --- |
| [Whisper large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo) | MIT; 808M parameters; 99 languages in the card metadata; a pruned large-v3 derivative for speech recognition | Per-language accuracy for the actual client material, word/segment timestamps, runtime and hardware; "8x faster / 4 decoder layers" are unconfirmed claims |
| [distil-large-v3](https://huggingface.co/distil-whisper/distil-large-v3) | MIT; card language `en`; a distilled Whisper variant for recognition | Language coverage (card declares English), accuracy against the client's names and numbers, runtime; the 756M-parameter and "6x faster" figures are unconfirmed |
| [Parakeet TDT 0.6B v2 / v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2) | CC-BY-4.0; v2 declares English only, v3 declares 25 European languages (en, es, fr, de, bg, hr, cs, da, nl, et, fi, el, hu, it, lv, lt, mt, pl, pt, ro, sk, sl, sv, ru, uk); v3 is 627M parameters and ships a GGUF | Which version/language pair the job needs, timestamp behaviour, runtime and hardware; "3x faster" is an unconfirmed claim |
| [Canary-1b](https://huggingface.co/nvidia/canary-1b) | `CC-BY-NC-4.0`; card languages en/de/es/fr; the card reports both recognition and speech-translation scores (FLEURS/COVOST) | NC eligibility for the intended use; translation output is draft copy and needs approval; runtime and hardware |
| [w2v-bert-2.0](https://huggingface.co/facebook/w2v-bert-2.0) | MIT; 580M parameters; 100+ languages; `pipeline_tag: feature-extraction` — a self-supervised acoustic base, **not a ready transcriber** | A fine-tuned recognition head and its training data are a separate project; do not present the base as an out-of-the-box transcript tool |
| [faster-whisper-large-v3](https://huggingface.co/Systran/faster-whisper-large-v3) | MIT; a CTranslate2 re-implementation of Whisper large-v3; 99 languages | Runtime/quantisation behaviour on the target machine and timestamp accuracy; it shares Whisper's recognition limits |

## Where this agent uses ASR (binding usage contract)

**Permitted — transcription assistance only, always proposing and never approving:**

1. **Take verification aid (audio-generation step 6):** transcribe a recorded or generated
   speech take to propose word/segment marks against Kaan's approved exact copy; flagged
   mismatches (names, numbers, negations, dropped words) go to the human listening review.
   The transcript never replaces listening and never edits approved copy.
2. **Phrase-mark assistance (selection handoff):** word timings may propose phrase
   starts/ends for the cue map; marks are confirmed by playback or waveform-assisted
   listening before hand-off, and ASR-proposed marks are labelled as proposals in the
   source ledger.
3. **Caption/transcript drafting (audio-post-production, audiovisual-review):** where
   captions or transcript timing are applicable, ASR may draft timecoded text from the
   approved final mix; captions derive from the final approved words and actual timing,
   including meaningful non-speech cues, and a competent speaker of the language reviews
   before delivery.
4. **Post-mux spot check (audiovisual-review):** ASR may flag suspected intelligibility
   regressions in the muxed film audio as listening-review *input*; an ASR pass is not a
   listening pass, and a transcript match is not pronunciation or rights quality.
5. **Language feasibility input (consultation):** an ASR model's documented language
   coverage is evidence about *transcription* support only — never about TTS/singing
   coverage, accent acceptability or name pronunciation.

**Never:** to own or alter approved copy (translations, including Whisper-style
"translate" output, are draft copy routed through Chris/Kaan); as a substitute for voice
consent, rights review or the required listening pass; to "repair" a mismatch by changing
the words; on user audio through a hosted ASR service without the approved external route
and its upload consent and per-job ceiling; as proof that a language or pronunciation is
acceptable; or to transcribe private consent documents into any record. Transcribing
third-party audio is processing, not a right.

## Commercial-use triage

The catalogue reports the facts; the user decides. The dated readings above keep four
statements apart: code licences, declared weight licences, commercial terms (gated
agreements, UI attribution, revenue thresholds) and dataset licences. Non-commercial weight
licences (MusicGen, TangoFlux, tango2, YuE2-3B, Canary) restrict commercial client
deliverables but remain usable where the user chooses them for internal scratch or
prototyping with knowledge of the terms. Surface the facts in the Media Request, record the
user's decision, and route unresolved terms through Chris; the agent never issues its own
legal conclusion and never hides a restriction to make a route look easier.

## Before an optional project-scoped install

1. Chris confirms the missing capability, route, expected iterations and download/install
   scope. Supplied or recorded audio remains a useful fallback to propose.
2. Inventory the target machine's OS/architecture, RAM and free storage, CPU or approved
   GPU/driver/runtime; compare against the selected release's actual requirements. Do not
   promise Windows GPU support from a CPU example.
3. Inspect code and weight licences separately, required notices, model/voice restrictions
   and client deployment/use constraints. Record the approver and evidence; avoid a blanket
   legal conclusion from a badge.
4. Confirm exact language/locale, phoneme/pronunciation support and desired voice behaviour.
   A list of languages does not establish acceptable local accent or name pronunciation.
   This applies equally to a transcriber used for review.
5. Specify a reversible project-local environment and version/download manifest, storage
   location and cleanup ownership. Review an installer before execution; do not turn a
   remote bootstrap command into an unreviewed pipe-to-shell action.
6. After an authorized install, record actual versions and inference exit/results. Run one
   short permitted text/effect test, inspect decoded duration/format, listen and obtain
   review. A successful install is not a successful model run, and a successful run is not
   a final performance.

No provider fallback follows a failed dependency, memory or language check. Return the
precise failure and a supplied/recorded/local-edit option to Chris. Keep accounts, secrets,
private recordings and consent documents out of model logs and public evidence. Pinning a
model improves traceability, not determinism across arbitrary runtimes/hardware.

These original notes summarize official capability documentation; no third-party Skill or
model asset is vendored. Source inspection is dated evidence and must not be presented as a
current benchmark, commercial entitlement or installed availability.
