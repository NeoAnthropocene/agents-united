<#
Builds ONE fresh scenario folder for the live test H10d (docs/live-test-protocol.md), as the protocol's setup does:
git init, the digital-agency native install for Claude from the build in -Repo, `doctor`, and the PetPal kit in docs\pilot.
It never touches a key and never starts a model. Run it again for a scenario to get a fresh folder (the old folder and the old results of that
scenario are moved to earlier\, not deleted).

usage:  pwsh -File scripts\new-run.ps1 -Scenario h10d1|h10d2|h10d3|h10d4|h10d5|h10d6|h10d7 [-Repo C:\path\to\clone]
        (h10d5 and h10d7 stage the picture that H10d2 made: run H10d2 first. h10d4 stages a brief that writes a path.)
  -Repo  the clone on the branch under test, already built (npm run build). Default: the worktree of PR 194.
         After PR 194 is merged use your own clone on dev: git pull; npm run build.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('h10d1', 'h10d2', 'h10d3', 'h10d4', 'h10d5', 'h10d6', 'h10d7')][string]$Scenario,
  [string]$Repo = 'C:\github\scratch-pilot\wt-s19'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Names = @{
  h10d1 = 'h10d1-no-go'; h10d2 = 'h10d2-go'; h10d3 = 'h10d3-outside'
  h10d4 = 'h10d4-brief-path'; h10d5 = 'h10d5-edit'; h10d6 = 'h10d6-no-key'; h10d7 = 'h10d7-likeness'
}
$S = Join-Path $Root $Names[$Scenario]
$F = Join-Path $Repo 'tests\fixtures\designer'
$Cli = Join-Path $Repo 'dist\cli.js'
if (-not (Test-Path -LiteralPath $Cli)) { throw "No build at $Cli. In $Repo run: npm run build" }
foreach ($fixture in 'design-tokens.json', 'hero.ts') {   # not $f: PowerShell names are case-insensitive and $F is the fixtures folder
  if (-not (Test-Path -LiteralPath (Join-Path $F $fixture))) { throw "Missing fixture $(Join-Path $F $fixture)" }
}

# A fresh directory every time. The old folder and the old results of this scenario are moved aside to earlier\, never deleted:
# the folder holds the pictures and the records of the earlier run, and run.sh refuses a scenario that already has a result.
$Aside = Join-Path $Root ("earlier\$Scenario-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$oldResults = @(Get-ChildItem -LiteralPath (Join-Path $Root 'results') -Filter "$Scenario.*" -File -ErrorAction SilentlyContinue)
if ((Test-Path -LiteralPath $S) -or $oldResults.Count -gt 0) { New-Item -ItemType Directory -Path $Aside -Force | Out-Null }
if (Test-Path -LiteralPath $S) {
  if (-not $S.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to move ${S}: it is not inside $Root" }
  Move-Item -LiteralPath $S -Destination (Join-Path $Aside 'folder')
  "Moved the old folder to $Aside\folder"
}
if ($oldResults.Count -gt 0) {
  $oldResults | Move-Item -Destination $Aside
  "Moved the earlier results of $Scenario to $Aside"
}
New-Item -ItemType Directory -Path (Join-Path $S 'docs\pilot') -Force | Out-Null
Set-Location -LiteralPath $S
git init -q
if ($LASTEXITCODE -ne 0) { throw 'git init failed' }

node $Cli add digital-agency -t claude --native --session-guard local -y
if ($LASTEXITCODE -ne 0) { throw 'the install failed' }
node $Cli doctor --host claude
if ($LASTEXITCODE -ne 0) { throw 'doctor is not healthy: do not run a prompt in this folder' }
Copy-Item -LiteralPath (Join-Path $F 'design-tokens.json'), (Join-Path $F 'hero.ts') -Destination (Join-Path $S 'docs\pilot')

# What each scenario needs besides the kit (docs/live-test-protocol.md, "H10d Prompt").
function New-OutsideFile {
  # The file the prompts point at: a small picture OUTSIDE the project, beside it (..\Downloads\shoot.jpg).
  $Dl = Join-Path $Root 'Downloads'
  New-Item -ItemType Directory -Path $Dl -Force | Out-Null
  $jpg = Join-Path $Dl 'shoot.jpg'
  Add-Type -AssemblyName System.Drawing
  $bmp = New-Object System.Drawing.Bitmap 64, 64
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(214, 190, 160))
  $g.Dispose()
  $bmp.Save($jpg, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $bmp.Dispose()
  $script:OutsideFile = $jpg
}
function Find-Portrait {
  # The picture H10d2 made (synthetic): the earlier output that H10d5 edits, and the stand-in for the CEO's photograph in H10d7.
  $picture = 'feed-hero-sitter-dog-sofa-4x5-v1'
  $places = @(Join-Path $Root 'h10d2-go\assets\generated')
  $places += @(Get-ChildItem -LiteralPath (Join-Path $Root 'earlier') -Directory -Filter 'h10d2-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'folder\assets\generated' })
  foreach ($dir in $places) {
    if ((Test-Path -LiteralPath (Join-Path $dir "$picture.jpg")) -and (Test-Path -LiteralPath (Join-Path $dir "$picture.provenance.json"))) { return $dir }
  }
  throw "The picture of H10d2 ($picture.jpg and its record) was not found. H10d5 and H10d7 use it: run H10d2 first, or put any synthetic 4:5 picture and a record under that name in h10d2-go\assets\generated."
}
switch ($Scenario) {
  'h10d3' {
    New-OutsideFile
    "Made the outside file $script:OutsideFile"
  }
  'h10d4' {
    New-OutsideFile
    $brief = (Get-Content -LiteralPath (Join-Path $F 'creative-brief-with-a-path.md') -Raw).Replace('<the absolute path of ..\Downloads\shoot.jpg>', $script:OutsideFile)
    Set-Content -LiteralPath (Join-Path $S 'docs\pilot\creative-brief.md') -Value $brief -Encoding utf8NoBOM -NoNewline
    "Made the outside file $script:OutsideFile and the brief docs\pilot\creative-brief.md, which writes its path"
  }
  'h10d5' {
    $dir = Find-Portrait
    New-Item -ItemType Directory -Path (Join-Path $S 'assets\generated') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $dir 'feed-hero-sitter-dog-sofa-4x5-v1.jpg'), (Join-Path $dir 'feed-hero-sitter-dog-sofa-4x5-v1.provenance.json') -Destination (Join-Path $S 'assets\generated')
    "Staged the earlier output and its record in assets\generated (from $dir)"
  }
  'h10d7' {
    $dir = Find-Portrait
    New-Item -ItemType Directory -Path (Join-Path $S 'assets\source') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $dir 'feed-hero-sitter-dog-sofa-4x5-v1.jpg') -Destination (Join-Path $S 'assets\source\dana.jpg')
    "Staged a synthetic portrait as assets\source\dana.jpg (from $dir)"
  }
}
"Built $S"
