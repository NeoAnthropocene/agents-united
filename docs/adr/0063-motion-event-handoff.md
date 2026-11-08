# ADR 0063: Bind picture events to the canonical timeline and motion source

Date: 2026-11-05
Status: accepted for the versioned sidecar implementation in Plan 047

## Context

The [post-fix chicken-loop audit](../skill-quality/2026-11-05-postfix-session-audit.md)
found that Sound initially inferred SFX frames from a storyboard. Later checks
against the actual movement required another audio revision. The canonical
timeline fingerprint deliberately covers scenes, cues, speech and revision;
splitting it now would weaken the established stale-handoff boundary without
a migration design. A cue window start is also not necessarily the intended
foot plant, impact or audible onset.

## Decision

Motion exports a separate version-1 **Motion event handoff** before final sound
work that depends on picture events. It binds named event frames to the current
canonical timeline revision, full fingerprint, fps and frame count, plus the
content hashes of the motion source files used to derive those events. The same
artifact works for Native and Remotion. Sound validates that binding before
using it and requests a new Motion handoff when picture source or timing drifts.
Standalone audio does not require a Motion handoff.

Capture validates and records Motion-authored event data; it does not discover
events from a film or certify that an event frame is visually correct. Motion
must check the actual motion math and applicable viewed proof. Keep that claim
separate from structural validity, waveform onset measurements and human sync
acceptance. A stale source, altered artifact binding, invalid frame or duplicate
event ID requires Motion to recheck and reissue the handoff; merely copying a
newer fingerprint onto old data is not that process. The editable JSON is
author-declared, not an authenticated receipt: validation detects mismatched
current bindings but cannot detect deliberate rewriting of both the data and
its claimed binding. It does not certify event authorship or approval.

Use the existing audiovisual-review Skill for the shared helper and guidance.
Preserve the strict canonical timeline and audio manifest schemas, full
fingerprint, final-mux validation and named review boundaries. The sidecar adds
no automatic approval or permission for audio generation, rendering or uploads.
Write a new contained artifact exclusively; keep prior revisions and evidence.

## Consequences

Independent sound direction and source preparation can proceed in parallel;
dependent final SFX waits for the relevant picture-event handoff. A conservative
source hash can invalidate events after a non-timing source change, requiring
Motion to check and reissue them. This is preferable to silently accepting stale
events. Source hashes cannot prove semantic frame accuracy, completeness of an
author's source list, or performed listening. A future separate picture
fingerprint needs an explicit versioned migration and equivalent stale-handoff
tests before replacing this design.

Implementation and verification results are recorded in
[Plan 047](../../plans/047-motion-production-efficiency.md); this decision alone
is not execution evidence or live Host verification.
