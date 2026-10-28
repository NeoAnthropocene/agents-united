# ADR 0057: Local sound models are a dated catalogue, and transcription is not generation

## Status

Accepted, 2026-10-27, for the maintainer-approved Plan 038 scope. This records catalogue
placement, licence-reporting and transcription-boundary decisions. It does not declare any
model installed, run, benchmarked, listened to or licence-cleared, and it is not legal advice.

## Context

Plan 037 shipped `audio-generation` with a two-row local-model preflight (Stable Audio 3 and
Kokoro-82M). The maintainer supplied a broader candidate list — open speech/TTS, sound
effects, instrumental and vocal music, lyric-to-song and sound-to-text models — and asked
for a plan across the Sound Designer's skills and the lead with three decisions: the full
scope including this ADR; transcription included with a defined usage contract; and
non-commercial candidates kept with accurate facts while the user decides per project.

Official pages re-inspected on 2026-10-27 changed the picture a two-row table hid. Several
candidates carry non-commercial weight licences (MusicGen and YuE2-3B `CC-BY-NC-4.0`,
tango2 `CC-BY-NC-SA-4.0`, TangoFlux "non-commercial research use only", Canary-1b
`CC-BY-NC-4.0`); Stable Audio Open 1.0 is gated under the Stability AI Community License;
MiniMax-Music3 declares no licence field but ships a community licence with UI-attribution
and USD 20M revenue-threshold terms; ACE-Step 1.5 and DiffRhythm2 are MIT and Apache-2.0.
The same list mixed transcription models into a generation catalogue, and the maintainer's
own attachment flagged an ASR model filed under speech. The Sound Designer's role files and
the lead's media-scope paragraph had no singing, lyric-language or licence-triage wording,
so a sung-jingle brief had no defined route through Kaan's copy ownership.

Local prior art inspected: `registry/skills/audio-generation/**` (Plan 037), the
`sound-design-direction` narration-rights contract, the `audio-post-production` finishing
contract, `registry/agents/subagent-sound-designer.md`, both orchestrator files, ADRs 0040,
0052 and 0056, and the Plan 038 source-verification record. Existing code and tests win over
stale documentation.

## Decision

1. **One dated catalogue, five capability sections.** `audio-generation/references/local-models.md`
   keeps a single preflight file with sections for speech/TTS, sound effects and soundscapes,
   instrumental music, music with vocals and lyric-to-song, and transcription assistance. It
   keeps the three-column contract (candidate | what the inspected source supports | what
   still needs project evidence), the six-step install preflight, no vendored model or
   third-party Skill asset and no installation instructions. Figures seen only in secondary
   material are labelled **unconfirmed claims**; the inspection date is recorded and re-read
   at selection time.
2. **Licence facts, not licence adjudication.** Code licences, declared weight licences,
   commercial terms (gating, UI attribution, revenue thresholds) and dataset licences are
   four separate statements and are reported as such. Non-commercial candidates stay listed;
   the agent surfaces the facts in the Media Request and the user decides per project through
   Chris. The agent issues no legal conclusion, never hides a restriction and never presents
   a dated reading as a current entitlement.
3. **Transcription is assistance, not generation.** ASR models are usable only under a
   binding five-use contract: take verification against Kaan's approved copy (proposals,
   never edits), phrase-mark proposals confirmed by listening, caption/transcript drafting
   from the approved final mix with a competent-speaker review, a post-mux intelligibility
   spot check that is not a listening pass, and language feasibility evidence about
   transcription support only. Prohibited: owning or altering approved copy (translations,
   including Whisper-style "translate" output, are draft copy routed through Chris/Kaan);
   substituting for consent, rights review or listening; "repairing" a mismatch by changing
   words; hosted ASR on user audio without the approved external route, upload consent and
   per-job ceiling; treating ASR output as pronunciation proof; transcribing private consent
   documents. ASR-proposed marks are labelled as proposals in the source ledger.
4. **Singing follows copy ownership.** Lyrics are Kaan's approved exact words, including when
   a synthetic voice sings them; delivery markup never replaces sung words. A synthetic
   singing voice does not lift the no-imitation rule: a style prompt must not name or imitate
   a named living performer without specific authorization. A weight licence grants no lyric
   rights and no rights in a reference recording, and a generated vocal take is a source
   needing a competent speaker's listening review. Finishing treats song-model outputs as
   sources: resample-as-edit with the original retained, split tracks as aligned-stem
   candidates only under the existing padded-stem policy, and a single mixed song as one
   source rather than invented stems.
5. **Symmetric role and lead wording; no structural change.** The Sound Designer's canonical
   and native consult wording and the lead's media-scope paragraph gain the lyric-language,
   synthetic-singing copy and non-commercial-licence clauses. Semantic cores, subagent
   contracts, Bundle inventories, Skill names and validator thresholds stay unchanged;
   `audio-generation/SKILL.md` grows within its 90-line and 6000-character caps.
6. **Measured audit note.** The audit table's body metrics for the touched Skills are
   re-measured rather than assumed; they are unchanged and recorded with a dated note.

## Consequences

The agency can now offer speech, effects, instrumental, sung and transcription routes with
honest, dated licence facts instead of a two-model guess. Non-commercial weights remain
available for internal scratch and prototyping while a commercial client deliverable can be
redirected to supplied, recorded or licensed sources — the trade-off is stated to the user
rather than decided by the agent. ASR assistance speeds review and caption drafts without
becoming a copy authority, so listening and approval remain the acceptance evidence. The
catalogue is a maintenance surface: it must be re-inspected as models and licences change,
and it stays a capability lead rather than an entitlement. No installation, inference,
listening or provider behaviour is claimed by this decision, and other Hosts than Claude
remain unverified.

