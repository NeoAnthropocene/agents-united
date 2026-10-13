<#
Collects the evidence of the finished r4 session (the full-roster regression of Plan 035 N3: the H1 brief plus "Consult ava read-only first.", the lead and the
nine specialists) into results\r4-evidence-<first 8 characters of the session id>\. It starts no model and touches no key: it only READS the host's records of the
session (the lead's, and each teammate's), the folder's files and the hook's log.

usage:  pwsh -File scripts\collect-r4.ps1 [-SessionId <full uuid>] [-Repo C:\path\to\clone]
  -SessionId  default: the newest session record of the r4 folder that is newer than the folder. The record's own cwd is checked against the folder.
  -Repo       the clone that holds `npm run hostlib:session` and read-session.mjs; default $env:H10D_REPO, else C:\github\scratch-pilot\wt-s19c.

It writes:
  session-report.txt, session-report.json   hostlib:session (H1a, H1b, H1c and the per-agent lines); the JSON keeps npm's banner, as the R3 handoff says
  private-trace-*.txt                       read-session.mjs with 600, the lead and each teammate: RAW, keep them local
  sanitized\                                hostlib:session trim (the copy that may go into a record) and trace-*.txt, the same reader over that copy
  artifacts.txt, fixtures\                  the files under docs\pilot: lines and SHA-256, and a copy of each
  folder-status.txt                         git status of the folder (anything outside docs\pilot and the installed team)
  timeline.txt, first-message.txt           the lead's conversation and its opening (gate-timeline.mjs, first-message.mjs)
  gate-log.txt                              the hook's log of its decisions (names, times, counts; no text)
  cost-state.txt                            the session's own cost record, for the protocol's ledger only
#>
param(
  [string]$SessionId = '',
  [string]$Repo = $(if ($env:H10D_REPO) { $env:H10D_REPO } else { 'C:\github\scratch-pilot\wt-s19c' })
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$S = Join-Path $Root 'r4-fullteam'
$slug = $S -replace '[^a-zA-Z0-9]', '-'
$ClaudeConfig = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$Project = Join-Path $ClaudeConfig "projects\$slug"
if (-not (Test-Path -LiteralPath $Project -PathType Container)) { throw "No record folder for r4: $Project (the session has not been started in $S)" }
$built = (Get-Item -LiteralPath (Join-Path $S '.git') -Force).CreationTime
if (-not $SessionId) {
  $latest = Get-ChildItem -LiteralPath $Project -Filter '*.jsonl' -File | Where-Object { $_.LastWriteTime -gt $built } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { throw "No session record newer than the folder in $Project" }
  $SessionId = $latest.BaseName
}
if ($SessionId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { throw "Not a session UUID: $SessionId" }
$Lead = Join-Path $Project "$SessionId.jsonl"
if (-not (Test-Path -LiteralPath $Lead)) { throw "No record $Lead" }

# The record's own cwd must be the r4 folder.
$cwd = $null
foreach ($line in (Get-Content -LiteralPath $Lead -TotalCount 300)) {
  try { $entry = $line | ConvertFrom-Json } catch { continue }
  if ($entry.cwd) { $cwd = $entry.cwd; break }
}
if (-not $cwd -or ([IO.Path]::GetFullPath($cwd).TrimEnd('\') -ine [IO.Path]::GetFullPath($S).TrimEnd('\'))) { throw "The record's cwd ($cwd) is not $S" }

$O = Join-Path $Root ("results\r4-evidence-" + $SessionId.Substring(0, 8))
if (Test-Path -LiteralPath $O) { throw "Already collected: $O exists. Move it aside first (nothing was changed)." }
New-Item -ItemType Directory -Path $O | Out-Null
"Session $SessionId in $S"
"Evidence in $O"

$Reader = Join-Path $Repo 'host-library\claude\observations\2026-10-07-n3-records\read-session.mjs'
if (-not (Test-Path -LiteralPath $Reader)) { throw "No reader at $Reader" }
Push-Location -LiteralPath $Repo
try {
  npm run hostlib:session -- $SessionId --project $Project > "$O\session-report.txt" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'hostlib:session failed' }
  npm run hostlib:session -- $SessionId --project $Project --json > "$O\session-report.json" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'hostlib:session --json failed' }
  node $Reader $Lead 600 > "$O\private-trace-lead.txt" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'the reader failed on the lead' }
  $Sub = Join-Path $Project "$SessionId\subagents"
  if (Test-Path -LiteralPath $Sub) {
    Get-ChildItem -LiteralPath $Sub -File -Filter '*.jsonl' | ForEach-Object {
      node $Reader $_.FullName 600 > (Join-Path $O ('private-trace-' + $_.BaseName + '.txt')) 2>&1
      if ($LASTEXITCODE -ne 0) { throw "the reader failed on $($_.Name)" }
    }
  } else { 'No subagents folder: the lead started no teammate.' }
  npm run hostlib:session -- trim $Lead --out "$O\sanitized" > "$O\trim-output.txt" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'trim failed' }
  node $Reader "$O\sanitized\$SessionId.jsonl" 600 > "$O\trace-lead.txt" 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'the reader failed on the sanitized lead' }
  $SubS = Join-Path $O "sanitized\$SessionId\subagents"
  if (Test-Path -LiteralPath $SubS) {
    Get-ChildItem -LiteralPath $SubS -File -Filter '*.jsonl' | ForEach-Object {
      node $Reader $_.FullName 600 > (Join-Path $O ('trace-' + $_.BaseName + '.txt')) 2>&1
      if ($LASTEXITCODE -ne 0) { throw "the reader failed on sanitized $($_.Name)" }
    }
  }
} finally { Pop-Location }

$pilot = Join-Path $S 'docs\pilot'
New-Item -ItemType Directory -Path "$O\fixtures" | Out-Null
if (Test-Path -LiteralPath $pilot) {
  Get-ChildItem -LiteralPath $pilot -File | ForEach-Object {
    [PSCustomObject]@{ Name = $_.Name; Lines = @(Get-Content -LiteralPath $_.FullName).Count; SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    Copy-Item -LiteralPath $_.FullName -Destination "$O\fixtures"
  } | Format-Table -AutoSize | Out-File "$O\artifacts.txt"
} else { 'docs\pilot does not exist: no deliverable was written.' | Set-Content "$O\artifacts.txt" }
Push-Location -LiteralPath $S
try { git status --short > "$O\folder-status.txt" 2>&1 } finally { Pop-Location }

node (Join-Path $PSScriptRoot 'gate-timeline.mjs') $Lead > "$O\timeline.txt" 2>&1
node (Join-Path $PSScriptRoot 'first-message.mjs') $Lead > "$O\first-message.txt" 2>&1
node (Join-Path $PSScriptRoot 'cost-state.mjs') $Lead > "$O\cost-state.txt" 2>&1
$gateLog = Join-Path $env:TEMP "agents-united\mode-line-$SessionId.log"
if (Test-Path -LiteralPath $gateLog) { Copy-Item -LiteralPath $gateLog -Destination "$O\gate-log.txt" } else { 'no log file: the hook made no decision in this session' | Set-Content "$O\gate-log.txt" }

''
'=== artifacts ==='
Get-Content "$O\artifacts.txt"
''
"Collected in $O. Nothing was started, nothing was changed in the session's records (they were only read)."
