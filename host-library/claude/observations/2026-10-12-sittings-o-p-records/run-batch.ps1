<#
Runs Sitting O of docs/live-test-protocol.md in order, one headless prompt each, by calling scripts\run.ps1: H10d3 (the typed path), H10d4 (a path written
in a brief), H10d6 (a provider whose key is not set) and H10d8 (an image from online). It stops at the first run that cannot start (a server that is not
connected, a folder that was already used): nothing after it is run.

Each run uses your Claude subscription and is capped at 0.8 USD (four caps in all: 3.2 USD; about 0.8 USD expected). Google may bill an image for H10d3
(about 0.05 USD, one image at 2K) and for H10d4 if she makes a text-only call. H10d6 and H10d8 should cost no image. Never paste the output of
`claude mcp get image-gen` anywhere.

usage:  pwsh -File scripts\run-batch.ps1                          # the four, in that order
        pwsh -File scripts\run-batch.ps1 -Scenarios h10d4,h10d6      # some
        $env:DRY = '1'; pwsh -File scripts\run-batch.ps1; $env:DRY = $null    # prints each command and stops, runs nothing
#>
param([string[]]$Scenarios = @('h10d3', 'h10d4', 'h10d6', 'h10d8'))
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
'Send results\<id>.evidence.txt for each run (they contain no key), or tell me the runs are complete and I will read the records myself.'
