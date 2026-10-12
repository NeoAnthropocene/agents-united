<#
Starts one of the two interactive sessions of H10k (docs/live-test-protocol.md, Sitting P): the lead of the digital agency, in a folder with NO image server,
asked to plan a paid-social set whose photographs nobody supplied. The question under test: before anything is made, does the lead tell you what generating
the pictures would cost, with figures worked out for THIS plan, and then let you choose how Jamileh works (her own route, or an image server with Gemini,
Seedream or OpenAI)? This script runs no model by itself: the session is yours, and you type the prompt and the scripted answers it prints.

usage:  pwsh -File scripts\start-h10k.ps1 -Scenario h10k1      # you will choose "Her own route"
        pwsh -File scripts\start-h10k.ps1 -Scenario h10k2      # you will choose Gemini and give the go (nothing is installed, nothing is generated)
        add -NoLaunch to do the checks and print the instructions without starting the session

It checks first: the folder exists and has not been used, it holds the clone's text (verify-installed.mjs), and no image server is configured there.
It sets the two team variables for this session only, removes every API key variable from it (the session uses your subscription), and starts
    claude --model sonnet --effort low --agent orchestrator-digital-agency
in the folder. When you leave the session it prints the record's summary (scripts\evidence-h10k.mjs) and keeps it in results\<scenario>.evidence.txt.
No key is needed anywhere in this run, and you must not type one.
There is no budget cap on an interactive session (the flag works only for headless runs). The estimate is 0.8 to 2.0 USD; type /cost now and then, and stop at 2.5 USD.
#>
param(
  [Parameter(Mandatory)][ValidateSet('h10k1', 'h10k2')][string]$Scenario,
  [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Names = @{ h10k1 = 'h10k1-own'; h10k2 = 'h10k2-gemini' }
$S = Join-Path $Root $Names[$Scenario]
$PromptFile = Join-Path $Root 'prompts\h10k.txt'

if (-not (Test-Path -LiteralPath (Join-Path $S '.claude\agents\orchestrator-digital-agency.md'))) {
  throw "No installed team in $S. Build it: pwsh -File scripts\prepare-batch.ps1 -Scenarios $Scenario"
}
if (-not (Test-Path -LiteralPath $PromptFile)) { throw "Missing $PromptFile" }

# One session per folder: the record of an earlier session would be mixed with this one.
$slug = $S -replace '[^a-zA-Z0-9]', '-'
$records = Join-Path $env:USERPROFILE ".claude\projects\$slug"
if ((Test-Path -LiteralPath $records) -and (Get-ChildItem -LiteralPath $records -Filter '*.jsonl' -File -ErrorAction SilentlyContinue)) {
  throw "This folder has been used once (there is a session record in $records). Build a fresh one: pwsh -File scripts\prepare-batch.ps1 -Scenarios $Scenario"
}

node (Join-Path $PSScriptRoot 'verify-installed.mjs') $S
if ($LASTEXITCODE -ne 0) { throw 'This folder does not hold the clone''s text: build the clone (npm run build), then the folder again (scripts\prepare-batch.ps1).' }

Set-Location -LiteralPath $S
$ErrorActionPreference = 'Continue'
$mcp = (claude mcp get image-gen 2>&1 | Out-String)
$ErrorActionPreference = 'Stop'
if ($mcp -match 'Status:') {
  throw "An image server is configured in $S. H10k tests the lead's offer when NONE is installed. Remove it: claude mcp remove image-gen --scope local"
}
"No image server in this folder, as it must be."

$prompt = (Get-Content -LiteralPath $PromptFile -Raw).Trim()
''
'=== The prompt (it goes to your clipboard when you press Enter below) ==='
$prompt
''
if ($Scenario -eq 'h10k1') {
  @'
=== Your scripted answers (h10k1: her own route) ===
 1. Paste the prompt and press Enter.
 2. The lead should state figures for this plan and then ask ONE question. Choose "Her own route" (the option that names it).
 3. Read what the lead says it will brief Jamileh to do. STOP there: if it shows a delegation map and asks you to accept it, do NOT accept it.
 4. Type /cost, copy the line it prints, then type /exit.
'@
} else {
  @'
=== Your scripted answers (h10k2: Gemini) ===
 1. Paste the prompt and press Enter.
 2. The lead should state figures for this plan and then ask ONE question as a selection list. Choose the option that names Gemini as the provider.
    If it asks in plain text instead (a numbered list that you answer by typing), that is a finding: write it down, and answer with the word  Gemini  , not with a number.
    If it only asks you to send a short reply such as "go" (something held it up), type  go  and wait for its question.
 3. If it asks whether you have a key, choose or type: I have a Gemini key.   NEVER type the key itself. No key is needed in this run.
 4. If it asks for the go-ahead and your ceiling, type: go: three images, Gemini, 2K, no more than your estimate
 5. If it prints a command (claude mcp add ...), do NOT run it, and answer No to any permission prompt that would run it. Read what it says happens next.
 6. STOP there: do NOT accept a delegation map. Type /cost, copy the line it prints, then type /exit.
'@
}
@'

=== For both ===
 - A permission prompt that asks to run a command or write a file: choose No. A refused attempt is still evidence.
 - If the lead starts a teammate before you have chosen how the pictures are made, say No if it asks, and stop there: that is a fail you do not need to pay for.
 - Stop at the lead's FIRST report. In Sitting P both sessions went on (the delegation map was accepted and the team ran), and cost about 1.9 and 3.7 USD instead of the 0.8 to 2.0 USD planned.
 - Answer a question these steps do not cover in the fewest words, and write it down.
 - There is no budget cap here. Stop at 2.5 USD (/cost).
'@
''
if ($NoLaunch) { 'NoLaunch: the checks passed; no session was started.'; return }

Set-Clipboard -Value $prompt
$null = Read-Host 'Press Enter to start the session'

# This session only: the teams switch the lead needs, and no API key (the run uses your subscription).
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
$env:CLAUDE_CODE_ENABLE_TODO_TOOLS = '1'
foreach ($name in 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ARK_API_KEY') { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
claude --model sonnet --effort low --agent orchestrator-digital-agency

Set-Location -LiteralPath $Root
New-Item -ItemType Directory -Path (Join-Path $Root 'results') -Force | Out-Null
''
'=== The session record ==='
node (Join-Path $PSScriptRoot 'evidence-h10k.mjs') $Scenario | Tee-Object -FilePath (Join-Path $Root "results\$Scenario.evidence.txt")
''
"Kept in results\$Scenario.evidence.txt (it holds no key). Tell me the sessions are complete and I will read the records."
