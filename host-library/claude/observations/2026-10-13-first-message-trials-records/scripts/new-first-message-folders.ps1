<#
Builds the trial folders of the first-message experiment (2026-10-13): fm\base (the lead as the clone has it) and fm\a, fm\b, fm\c (the same lead with the welcome removed and the Operation Mode
information first; see scripts\patch-first-message.mjs for what each variant changes). It installs the digital-agency native team from the clone's build exactly as new-run.ps1 does
(git init, `add digital-agency -t claude --native --session-guard local -y`, doctor), adds the two fixture files of the pilot kit, and registers the gate script as a settings-level hook
(scripts\add-settings-gate.mjs: `claude -p` skips the frontmatter hooks of a project agent, so without this a headless run would never meet the gate). It starts no model.
No image server is added to these folders and no key is read: they are for the first message of the lead only.

usage:  pwsh -File scripts\new-first-message-folders.ps1 [-Only base,a,b,c] [-Repo C:\path\to\clone]
Without -Only it builds all four and moves an old fm\ folder to earlier\ first (never deleted). With -Only it builds just those folders and leaves the others alone.
#>
param(
  [string[]]$Only,
  [string]$Repo = $(if ($env:H10D_REPO) { $env:H10D_REPO } else { 'C:\github\scratch-pilot\wt-s19c' })
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Cli = Join-Path $Repo 'dist\cli.js'
$F = Join-Path $Repo 'tests\fixtures\designer'
if (-not (Test-Path -LiteralPath $Cli)) { throw "No build at $Cli. In $Repo run: npm run build" }
$Fm = Join-Path $Root 'fm'
$names = if ($Only) { $Only } else { @('base', 'a', 'b', 'c') }
if (-not $Only -and (Test-Path -LiteralPath $Fm)) {
  $Aside = Join-Path $Root ('earlier\fm-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path (Split-Path $Aside) -Force | Out-Null
  [IO.Directory]::Move($Fm, $Aside)
  "Moved the old fm folder to $Aside"
}
foreach ($name in $names) {
  $S = Join-Path $Fm $name
  if (Test-Path -LiteralPath $S) { throw "$S exists: build it again only through a full run without -Only (it moves the old folders aside)" }
  New-Item -ItemType Directory -Path (Join-Path $S 'docs\pilot') -Force | Out-Null
  Set-Location -LiteralPath $S
  git init -q
  if ($LASTEXITCODE -ne 0) { throw 'git init failed' }
  node $Cli add digital-agency -t claude --native --session-guard local -y | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "the install failed in $S" }
  node $Cli doctor --host claude | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "doctor is not healthy in $S" }
  Copy-Item -LiteralPath (Join-Path $F 'design-tokens.json'), (Join-Path $F 'hero.ts') -Destination (Join-Path $S 'docs\pilot')
  if ($name -ne 'base') {
    node (Join-Path $PSScriptRoot 'patch-first-message.mjs') $S $name
    if ($LASTEXITCODE -ne 0) { throw "the patch failed in $S" }
  }
  node (Join-Path $PSScriptRoot 'add-settings-gate.mjs') $S
  if ($LASTEXITCODE -ne 0) { throw "the settings-level gate failed in $S" }
  "Built $S"
}
Set-Location -LiteralPath $Root
if ($names -contains 'base') {
  node (Join-Path $PSScriptRoot 'verify-installed.mjs') (Join-Path $Fm 'base') --repo $Repo
  if ($LASTEXITCODE -ne 0) { throw 'fm\base does not hold the clone''s text' }
  'fm\base equals the clone; the other folders differ from it in the lead''s first-message section only (checked by patch-first-message.mjs).'
}
