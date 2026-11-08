# Eval2 — bounded follow-up in the existing session

Use this after checking the session's current `/usage` against the already
supplied limits. The assistant has not started a Host session. This follow-up
diagnoses the [provisional gaps](2026-11-07-3d-eval2-provisional-audit.md); it
cannot establish that the original production loaded Skills before working.
Original/current preview evidence has been copied into the ignored
`scratch/3d-post-eval1-gate-2026-11-07/eval2-pre-followup-snapshot`, with a
ten-file SHA-256 manifest. The snapshot records its capture time, not an
inferred earlier revision.

## Copy the prompt from PowerShell

```powershell
Set-Clipboard -Value (Get-Content -LiteralPath 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\3d-hands-on-2026-11-06\eval2-followup-prompt.txt' -Raw)
```

Return to the existing eval2 Claude TUI and paste the clipboard contents.
Keep one session editing this project. If the original session is closed,
resume it from your own PowerShell terminal:

```powershell
$eval2Project = 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\3d-hands-on-2026-11-06\evaluation-kit-r4\eval2-motion'
$eval2SavedPath = $env:Path
$eval2SavedTaskTools = $env:CLAUDE_CODE_ENABLE_TODO_TOOLS
try {
    Set-Location -LiteralPath $eval2Project -ErrorAction Stop
    $env:Path = 'C:\Users\altay\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
    $env:CLAUDE_CODE_ENABLE_TODO_TOOLS = '1'
    claude --resume 'd4b901d8-ec77-4c52-908e-8a169e0dc813'
}
finally {
    $env:CLAUDE_CODE_ENABLE_TODO_TOOLS = $eval2SavedTaskTools
    $env:Path = $eval2SavedPath
}
```

The prompt asks Chris to resume the existing Motion owner, establish real Skill
loading and review the existing artifact, then repeat the control with an
actual material change, immediately captured exits and exact restoration.
New evidence belongs in a separate numbered follow-up directory. It does not
authorize installs, providers, uploads, audio or replacement source renders.

## What to send back

Keep original and follow-up results distinct. Send the session ID and reported
usage/cost, whether the signature frame and real-time preview were acceptable,
which preview version you viewed, and any remaining problems. The executor
will inspect the actual new Host events and artifact evidence. If the existing
limits prevent the follow-up, report the gaps as unverified rather than
starting another paid session automatically.
