<#
Builds fresh folders for the closing set of the Gemini part (Sitting N in docs/live-test-protocol.md): H10d3 again, H10d4, H10d6, H10d7 and H10d5.
It runs scripts\new-run.ps1 for each one. It never touches a key and never starts a model. An earlier folder of the same scenario, and its results,
are moved to earlier\ (not deleted).

usage:  pwsh -File scripts\prepare-batch.ps1                       # the five
        pwsh -File scripts\prepare-batch.ps1 -Scenarios h10d4,h10d5   # some

H10d5 and H10d7 stage the picture that H10d2 made, so H10d2's folder has to exist (it does, from the first runs).
#>
param([string[]]$Scenarios = @('h10d3', 'h10d4', 'h10d6', 'h10d7', 'h10d5'))
$ErrorActionPreference = 'Stop'
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
'Next:  pwsh -File scripts\add-server.ps1      (asks for your key once, hidden, and adds the server to every folder)'
'Then:  pwsh -File scripts\run-batch.ps1       (the runs, in order, one after another)'
