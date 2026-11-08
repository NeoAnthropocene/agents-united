# Eval2 Motion — provisional record inspection

**Later completion/feedback record:** see the
[completed sitting audit](2026-11-07-3d-eval2-motion-r4.md). It records revised
playback acceptance and confirmed restoration while retaining the Skill and
real-material-control gaps. The snapshot findings below remain historical.

**Not a completed pilot verdict.** A record was found in the prepared eval2
Host project: `d4b901d8-ec77-4c52-908e-8a169e0dc813`. The executor read it offline
with `hostlib:session` while asking the maintainer for completion, usage and
viewing feedback. No new Host session was started. The latest record's presence
or timestamp does not prove that its process is live or that the session ended.
No cost total was present in this inspected snapshot.

## Recorded behavior

- Claude Code **2.1.319**, Chris as main agent on Opus 5.5, permission mode
  `auto`; one ordinary asynchronous `agency-motion-designer` on Sonnet 5.5.
  The actual `Agent` call names that installed type. No Arda worker exchange
  is observed in this snapshot; the input is the already supplied handoff.
- Chris first requested a read-only consultation, obtained acceptance of the
  one-owner map through `AskUserQuestion`, created task **1**, assigned it to
  Motion and moved it to in-progress. A `SendMessage` continuation authorized
  production. Motion's two `SubagentHandback` calls have successful Host
  results. Chris subsequently marked the production task complete.
- Only Chris called the Task tools: one TaskCreate and two TaskUpdates with
  canonical `taskId`. Motion reported that Task tools were unavailable and
  left status updates to Chris. That is an observed handback/fallback report,
  not independent proof of the worker's entire tool catalog.
- **Zero `Skill` calls** appear on either actor. Both installed role files
  declare `Skill`, so missing static grants are not established as the cause.
  Neither actor attempted Skill discovery/loading in the captured calls.
  Helper execution is observed; native Skill invocation and production use
  through loaded Skill guidance are **unverified**.

## Artifact and control evidence

| Item | Independent inspection and limit |
| --- | --- |
| Input restoration | All **27** current reference-file hashes match the prepared inventory. The executor's read-only installed handoff validation exited **0** after the recorded work. |
| Preview and captures | Local HTML and a Playwright capture script exist. The script calls the existing system Chrome and takes element screenshots. Captured frames 0, 3 and 5 match source PNGs 0, 3 and 5 byte-for-byte; frames 6, 15 and 29 match source 5. The executor independently rehashed all six pairs; it did not rerun the browser in this inspection. |
| Timeline negative control | The evidence records the audit cue under unchanged revision, `shot.stale`, and a captured exit 2. The baseline bytes are currently restored. Some subsequent restore validations did not separately capture their exit codes. |
| Material control | The worker added an unused `materialControl` property to `scene.json`, obtained `file.stale`, and restored it. This proves detection of a hashed-source edit. It is not an actual shader/material modification, so the stronger material-change requirement remains unverified. The worker explicitly admits its printed exit 0 was captured after `echo` and is invalid evidence. |
| Viewing | Motion read one signature still and explicitly says it never watched real-time playback. Maintainer signature-frame and playback acceptance remain **unverified** pending feedback. |

The six-frame source plus hold remains a one-second technical preview, not
thirty newly generated frames, a final film or proof of sound sync. Source
rights warnings and the known old cap appearance remain scoped as described
in the [launch walkthrough](2026-11-07-3d-eval2-launch.md).

## Evidence still needed

1. Maintainer confirms the session's status, reports usage/cost and supplies
   separate signature-frame and real-time playback feedback.
2. Actual applicable Skill loading attempts and Host results, recorded by
   actor. If unavailable, establish the actual limitation and eligible loading
   route. A guided follow-up would be new evidence; it cannot retroactively
   establish that the original production loaded Skills first.
3. A real material-source negative control, with exact byte backup/restoration
   and immediately captured native exit codes for baseline, changed and
   restored validation. All 27 reference hashes must match afterward.

No role, grant, guard or helper code was changed based on this provisional
inspection. The passed post-eval1 full gate remains the current code gate;
the unresolved items above are live-workflow/acceptance evidence, not a reason
to repeat the unchanged full regression suite.

## Later snapshot and follow-up preparation

The record subsequently gained playback investigation and preview changes;
its latest inspected event is timestamped 2026-11-07T10:15:24Z. Both actors
still have zero Skill calls in that newer snapshot, and no cost total is
present. This timestamp is not process-liveness or session-completion proof.
Current preview files were archived separately with a ten-file hash manifest
before preparing the [bounded follow-up](2026-11-07-3d-eval2-followup.md).
No role/guard code was changed and no new Host session was started. The
follow-up preserves the original evidence and does not authorize new frames
merely to make the short, nearly symmetric source turn more noticeable.
