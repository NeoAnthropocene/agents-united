# Select, approve and pass source audio

Audition source candidates against one fixed brief. Keep a small comparison table: take ID/hash, exact source/process, duration, pronunciation, noise/artifacts, timing fit, rights state and selection reason. Compare at matched comfortable playback levels; louder should not win by default. For music/effects, check meaningful entrances, energy, repetition, tails and space for speech. For VO, check every approved word and human delivery, not just a transcript similarity score.

Before freeze, record measured phrase boundaries and unresolved breathing/hold needs. Motion owns coordinated film timing; Sound owns the Lead-approved standalone cue/timing record using the same canonical schema when helpers need it. A film scratch source can inform a storyboard but stays clearly scratch; standalone sound needs no storyboard. Once Chris approves the final performance and the applicable owner obtains timing approval, record the canonical timeline revision/fingerprint. A text/timing change makes dependent sources/edits, captions and any renderer exports stale; obtain the change decision and reissue dependent handoffs. Never relabel an old performance with a new revision as a shortcut.

## Finishing package

- Original source paths and SHA-256; selected take and any edited copy with its own hash.
- For included speech, Kaan-approved exact transcript, voice consent, pronunciation decisions, actual phrase marks and scratch/final approval status. For wordless cues, speech/transcript/captions/pronunciation/voice-consent records are not applicable with a reason; no invented narration or Kaan approval. All source rights still apply.
- Cue IDs/kinds and half-open frame boundaries from the shared timeline, including deliberate tails.
- Per-source origin, consent/licence evidence, generation model/version/parameters or recording details, relevant job identity and allowed use.
- Trim/edit/crossfade/ducking notes, intended gain relationships and whether automation is printed.
- Destination preset from saved preferences and any still-open decision for Chris.

The [shared media contract](../../audiovisual-review/references/media-contract.md) defines final manifest fields. Production notes do not add arbitrary properties to canonical JSON. The audio-post-production Skill creates/measures a master and aligned stems; the generation ledger does not replace that manifest. A path/hash establishes a source identity, while rights evidence and approval state remain separate. After finishing, standalone WAV/sting goes through required applicable audio/provenance review directly to Chris; no Motion, renderer, video or mux is required. Required missing checks stay **unverified** and block acceptance; an irrelevant check needs a not-applicable reason.

Anti-patterns: putting an API key into the source record; accepting a source with clipped word endings because the requested duration matches; regenerating a whole performance after a one-word pickup request without retaining identity; passing only `final.wav` with no transcript or process. A blocked source should have a precise owner/remedy, such as "Chris: obtain paid-social release or approve a new owned recording."
