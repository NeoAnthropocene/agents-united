<#
Builds fresh folders for Sitting O (docs/live-test-protocol.md): H10d3, H10d4 and H10d6 again on the text added after Sitting N, and H10d8 (an image from online).
It runs scripts\new-run.ps1 for each one, which also checks the folder against the clone (scripts\verify-installed.mjs): a folder that does not hold the
clone's text is not used. It never touches a key and never starts a model. An earlier folder of the same scenario, and its results, are moved to earlier\
(not deleted).

Claude Code keeps an added server by the folder's path, so a rebuilt folder at an old path is still connected (h10d3, h10d4, h10d6 from Sitting N). Only a new
path (h10d8-url) needs scripts\add-server.ps1. At the end this script says which folders are connected and which are not.

usage:  pwsh -File scripts\prepare-batch.ps1                        # Sitting O: h10d3, h10d4, h10d6, h10d8
        pwsh -File scripts\prepare-batch.ps1 -Scenarios h10d4,h10d8   # some
        pwsh -File scripts\prepare-batch.ps1 -Scenarios h10k1,h10k2   # the two folders of Sitting P (H10k): no image server, by design

The clone must be built from the branch under test first (npm run build in C:\github\scratch-pilot\wt-s19b, the worktree of the follow-up branch; or set $env:H10D_REPO to your own clone).
#>
param([string[]]$Scenarios = @('h10d3', 'h10d4', 'h10d6', 'h10d8'))
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Names = @{
  h10d1 = 'h10d1-no-go'; h10d2 = 'h10d2-go'; h10d3 = 'h10d3-outside'; h10d4 = 'h10d4-brief-path'; h10d5 = 'h10d5-edit'
  h10d6 = 'h10d6-no-key'; h10d7 = 'h10d7-likeness'; h10d8 = 'h10d8-url'; h10k1 = 'h10k1-own'; h10k2 = 'h10k2-gemini'
}
# pwsh -File passes a comma list as ONE string: split it.
$Scenarios = @($Scenarios | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

foreach ($id in $Scenarios) {
  ''
  "=== building $id"
  pwsh -File (Join-Path $PSScriptRoot 'new-run.ps1') -Scenario $id
  if ($LASTEXITCODE -ne 0) { throw "new-run.ps1 $id failed (exit $LASTEXITCODE): not going on" }
}
''
'Built: ' + ($Scenarios -join ', ')
''
$withServer = @($Scenarios | Where-Object { $_ -like 'h10d*' })
$withoutServer = @($Scenarios | Where-Object { $_ -like 'h10k*' })
$needServer = @()
foreach ($id in $withServer) {
  Push-Location -LiteralPath (Join-Path $Root $Names[$id])
  try {
    $ErrorActionPreference = 'Continue'
    $line = @(claude mcp get image-gen 2>&1 | Where-Object { $_ -match 'Status:' }) | Select-Object -First 1
    $ErrorActionPreference = 'Stop'
  } finally { Pop-Location }
  if ($line -and "$line" -match 'Connected' -and "$line" -notmatch 'Failed|not connected') { "  ${id}: image-gen is connected already" }
  else { $needServer += $id; "  ${id}: image-gen is NOT connected yet" }
}
foreach ($id in $withoutServer) {
  Push-Location -LiteralPath (Join-Path $Root $Names[$id])
  try {
    $ErrorActionPreference = 'Continue'
    $text = (claude mcp get image-gen 2>&1 | Out-String)
    $ErrorActionPreference = 'Stop'
  } finally { Pop-Location }
  if ($text -match 'Status:') { "  ${id}: an image server is configured here, and must not be: claude mcp remove image-gen --scope local" } else { "  ${id}: no image server, as it must be" }
}
''
if ($needServer.Count) { 'Next:  pwsh -File scripts\add-server.ps1 -Scenario ' + ($needServer -join ',') + '      (asks for your key once, hidden)' }
if ($withServer.Count) { 'Run:   pwsh -File scripts\run-batch.ps1 -Scenarios ' + ($withServer -join ',') + '      (the runs, in order, one after another)' }
foreach ($id in $withoutServer) { "Run:   pwsh -File scripts\start-h10k.ps1 -Scenario $id      (interactive; no server, no key)" }
