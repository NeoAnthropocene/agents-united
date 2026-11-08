# Eval2 Motion — maintainer launch and review

This is the next Phase E exercise after [eval1](2026-11-07-3d-eval1-web-r4.md).
The kit is already prepared. The assistant checked the installed Shot Handoff
validator (exit 0); no new Claude session was started. The previously supplied
local funding limits apply. Check subscription headroom before starting and
keep account-identifying information out of shared reports.

## 1. Launch from your own PowerShell

Copy and paste:

```powershell
& 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\3d-hands-on-2026-11-06\launch-eval2.ps1'
```

The script selects the prepared eval2 project, copies its unchanged `BRIEF.md`
to the clipboard and opens `orchestrator-digital-agency` as the main agent.
It enables the task-tool opt-in for that child session and restores the prior
environment/location afterward. It preserves existing team and task-selector
settings. It does not rebuild the kit or install packages.

## 2. In Claude

Run these commands separately, then close the usage dialog:

```text
/rename eval2-motion-r4
```

```text
/usage
```

Paste the clipboard contents and submit. Let Chris choose and coordinate the
relevant specialists and Skills. Record which delegation mechanism actually
occurs; an installed role or a claimed handoff is not proof of worker use.
The existing brief authorizes this bounded private exercise, with no installs,
paid providers, uploads or audio production.

When Chris requests the signature-frame decision, view the actual referenced
PNG. State your decision and any defects explicitly. Let him finish the
integrated preview and negative controls, then open the URL he supplies.

## 3. Review the actual result

- The local HTML preview should show the supplied six frames over **[0,6)** at
  **30 fps**, then hold source frame 5 over **[6,30)**. The whole scene is one
  second: 0.2 seconds of changing source frames plus a 0.8-second hold. It is
  not thirty newly rendered frames and needs neither MP4 nor sound.
- This r4 reference preserves the old cap material defect identified in eval1.
  The corrected generator/proof is separate. Do not regenerate the locked
  input merely to remove this known appearance issue during the handoff test.
- Chris should coordinate actual Arda/Motion use. Motion must receive and
  validate the current handoff, then integrate the sequence. Task IDs, tool
  availability and fallback behavior must be read from the resulting records.
- The same-revision cue negative control must reject the stale fingerprint.
  Its exact baseline timeline bytes must be restored before final playback.
  The separate material-source change must invalidate the visual proof and be
  restored afterward. Both failures and restorations need actual evidence.
- Record signature-frame and integrated-playback acceptance separately. Note
  jumps, missing frames, timing defects or preview-loading problems. Acceptance
  is scoped to this exercise; it does not establish final sound sync or rights.

## 4. Record the session

Before exiting, run `/status` and `/usage` separately. Copy the session ID and
reported usage/cost, then `/exit`. Send this template:

```text
Eval: eval2-motion-r4
Claude session ID:
Usage/cost reported:
Signature frame reviewed/accepted:
Integrated preview loaded:
Six source frames and final-frame hold behaved correctly:
Same-revision timeline change rejected:
Material-source change invalidated proof:
Original timeline/source restored:
Playback accepted or remaining defects:
Other observations:
```

The project folder is already known:
`scratch/3d-hands-on-2026-11-06/evaluation-kit-r4/eval2-motion`.
The executor will inspect the Host's own records and artifacts after you send
the ID; agent assertions alone do not establish these results.

If you are continuing the existing test to address its observed loading and
control gaps, use the [bounded follow-up instructions](2026-11-07-3d-eval2-followup.md)
instead of starting a new eval2 session.
