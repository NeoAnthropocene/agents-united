<#
Runs the closing set of the Gemini part in order (Sitting N in docs/live-test-protocol.md), one headless prompt each, by calling scripts\run.ps1:
H10d3 again, H10d4, H10d6, H10d7, and last H10d5 (the only one that makes an image). It stops at the first run that cannot start (a server that is not
connected, a folder that was already used): nothing after it is run.

Each run uses your Claude subscription and is capped at 0.8 USD (five caps in all: 4.0 USD; about 1.0 USD expected). Only H10d5 may cost an image on your
Google bill (about 0.05 USD), and H10d4 if she makes a text-only call. Never paste the output of `claude mcp get image-gen` anywhere.

usage:  pwsh -File scripts\run-batch.ps1                          # the five, in that order
        pwsh -File scripts\run-batch.ps1 -Scenarios h10d4,h10d6      # some
        $env:DRY = '1'; pwsh -File scripts\run-batch.ps1; Remove-Item Env:DRY    # prints each command and stops, runs nothing
#>
param([string[]]$Scenarios = @('h10d3', 'h10d4', 'h10d6', 'h10d7', 'h10d5'))
$ErrorActionPreference = 'Stop'
# pwsh -File passes a comma list as ONE string: split it.
$Scenarios = @($Scenarios | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

foreach ($id in $Scenarios) {
  ''
  "=================== $id ==================="
  pwsh -File (Join-Path $PSScriptRoot 'run.ps1') $id
  if ($LASTEXITCODE -ne 0) { throw "run.ps1 $id stopped with exit ${LASTEXITCODE}: the batch stops here, nothing after it was run" }
}
''
'All done: ' + ($Scenarios -join ', ')
'Send results\<id>.evidence.txt for each run (they contain no key).'
