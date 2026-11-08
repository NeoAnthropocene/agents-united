# Eval2b — completed visible handoff audit

Session `9bff6c61-5fd8-41e5-8fc9-a2954f1aefb2`, Claude Code **2.1.319**,
Windows. The maintainer reported **3.99 USD**, 13m 21s API and 35m 35s wall
duration. The Host record reports 3.9919377 USD. These are session usage
figures, not a verified invoice or a measure of remaining subscription quota.
The executor read the actual Host records offline; no Host CLI was started.

**Verdict: the bounded visible-production/handoff exercise succeeded, with
the role-instruction and review limitations below retained.** The maintainer
accepted the new signature frame, visible rotation, integration, controls and
playback and reported no remaining visible problems. This does not retroactively
change the earlier r4 sitting or establish blanket role compliance.

## Actual native activity

Chris/Opus 5.5 consulted Arda and Motion read-only, obtained the accepted map,
authorized Arda's still, obtained signature approval, then authorized the full
sequence and serialized controls. He validated the restored handoff and relayed
it to Motion, which validated it before integration. These were ordinary
subagents in relay mode, not direct peer collaboration or an Agent Team.

The nine successful native `Skill` calls are present in the Host records:

| Actor | Observed Skills |
| --- | --- |
| Chris | `workflow-agency-3d-production` |
| Arda / Sonnet 5.5 | `3d-design-direction`, `threejs-scene-production` twice, `3d-asset-review`, `workflow-agency-3d-production` |
| Motion / Sonnet 5.5 | `native-motion-production`, `audiovisual-review` |
| Emre / Sonnet 5.5 | `playwright-best-practices` |

Shared helper imports are dependency use, not recursive Skill invocation.
No inspected manifest requires another Skill call for every repeated helper
function. Motion's 3D handoff validation is recorded separately as helper use;
the conditional handoff instruction does not require Motion to invoke Arda's
authoring Skill merely to run that validator.

**Explicit omission:** Motion did not invoke `motion-design-direction`, although
its native production runbook literally says to load it before producing.
This approved sequence-integration task did not require inventing a new
storyboard, but that contextual distinction does not erase the unconditional
instruction. Preserve this omission for workflow hardening; do not declare all
role instructions followed or silently weaken the requirement to fit the run.

Chris created five tasks with dependencies and advanced them using real IDs;
the ordinary workers returned handbacks instead of updating tasks themselves.
This observes the selected fallback path, not a complete tool-absence probe.
Task 4 stayed completed during its later favicon revision; comprehensive
revision-state tracking is not established by this sitting.

## Technical evidence

| Check | Actual evidence and scope |
| --- | --- |
| New production | Arda produced editable source, a new GLB and 30 rendered frames over [0,30) at 30 fps. The measured turn is about 138.46 degrees. The executor independently rehashed all 30 files: zero mismatches and 30 distinct hashes. |
| Current handoff | The executor reran the installed read-only validator against `media/eval2-shot-handoff.json`: native exit **0**. Sources, renderer bindings and exact frames are accepted by that helper; this is not arbitrary-scene or device parity. |
| Timeline control | Recorded baseline **0**, same-revision valid audit-cue change **2** (`shot.stale`), restored validation **0**. |
| Real material control | The consumed default-scene material's PBR baseColorFactor changes from [0.035,0.25,0.17,1] to [0.035,0.45,0.17,1]. The temporary GLB passes format validation with zero issues. Handoff validation rejects it with **2** (`file.stale`), then passes after restoration with **0**. This is an actual material change, not unused metadata. |
| Restoration | Terra's independent mechanical audit rehashed all **48** baseline/restore/final files against the current artifacts: all match. The control script captures native `spawnSync` statuses, not a later shell command's status. These remain historical recorded executions; the executor did not rerun mutating controls. |
| Playback | Recorded pixel-based tests demonstrate advancing frames, pause, seek and reduced-motion behavior. The maintainer separately accepted visible playback. Source rights/public-commercial clearance, other browsers and measured frame-drop performance remain unverified. |

## Independent review and correction

Chris actually launched native QA reviewer Emre with `model: sonnet`. Emre
loaded his Skill, validated the handoff, checked hashes and exercised playback.
His first result passed the four functional checks but failed overall on a
favicon 404. Motion fixed that issue and reran both its proof and Emre's
unchanged script successfully, with no final console errors. **The post-fix
execution was Motion's, not a second independent Emre review.** The original
independent finding, producer fix/rerun and human acceptance are separate facts.

Sol/medium reviewed the actual call chronology and Skill requirements;
Terra/medium independently checked the artifact/control evidence. Both were
read-only. No source code was changed during this audit; the existing full
code gate is unaffected.

Eval3 routing/rights behavior, the explicit Motion direction-Skill omission,
the three held upstream sources and broader Host/runtime parity remain open.
Sound sync remains unverified because this was an explicitly silent exercise.
