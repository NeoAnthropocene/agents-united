# R3 morning interactive handoff (Plan 033 foundation / Plan 035 regression)

**Original preparation (2026-10-07).** R2 stopped at quota in Tier 2; it never established all nine roles. This is the remaining full-roster regression, using a candidate that contains merged PR #174 and ADR 0044. The maintainer types the session; the executor waits for records. No Cline/Antigravity session, deferred skill eval or other Plan 035 probe is part of R3.

**Records reviewed, 2026-10-08:** session `f69ab2b9-b375-484c-9d24-bf6008d3ab4f`, build `89a859767e4dc7cb68d1b78c3be2023ed52d4d93` confirmed, Claude Pro with extra usage off. **Seven expectations seen; nine-role shutdown completion unverified** (Defne lacks host confirmation); the separate every-brief fixed-value instruction is **violated in five briefs**. See [the evidence and verdicts](../host-library/claude/observations/2026-10-08-claude-2.1.292-r3-foundation-regression.md). Exact rollup **3.7228101 USD**, remaining **46.2771899 USD**; headless 0/16, interactive 2/16 conservatively. Collection recovery below remains a recipe for existing records, **not authorization to rerun R3**.

## Candidate and limits

- Tested code commit: **`89a859767e4dc7cb68d1b78c3be2023ed52d4d93`**, branch `codex/plan-033-foundation`, based on `aa7dbe38126471151ee6aad3558bbc354ce8b024` (merged #174). Later handoff/evidence-only commits do not change the installed native assets. Use this exact code commit for the recipe below.
- Account: existing Claude authentication on the maintainer's Windows machine (historical runs were Claude Pro; record the actual account). Lead: Sonnet, medium effort; record actual model IDs for lead and teammates, CLI version and session id. Do not transfer credentials to the cloud.
- Working ceilings: **50 USD aggregate**, **16 headless**, **16 interactive** prompts across this continuation; retries count. Preparation used **0 headless, 0 interactive**, no Claude runs incurred, 50 USD unspent. Record typed replies separately too; do not infer a fresh budget after reset. The maintainer offered a doubled test amount if needed after checking quota; no increase is currently used.
- Estimate: about **3 USD** for a full Sonnet roster (previous complete runs 2.9056–3.02 USD), not a measured R3 cost. Start only with Claude's current five-hour usage at or below approximately 85%, sufficient weekly headroom and extra usage off. Record before/after readings and reset times; the earlier reported 0% five-hour / 58% weekly (reset in 20 hr 47 min at receipt) is not a future reading.
- `/usage` and `/cost` are useful local readings where supported; save their actual output. A missing cost is pending and stops further spending until reconciled. Reconcile session cost-state/model usage including teammates; do not add an already aggregated teammate cost twice or treat a missing field as zero.
- Cloud Node checks and scratch installation verify static packaging only. No Claude CLI or authorized Windows executor is exposed here; Windows install/discovery, project-agent hooks, live team behavior and timing remain **unverified**.

## Exact scratch-install recipe (PowerShell)

This preserves the existing clone and refuses to reuse either scratch directory. If a path is occupied, choose a fresh non-synced location and record it. No branch switch in the user's clone is required. Node 24+ is required.

```powershell
$R = 'C:\github\agents-united'
$Candidate = '89a859767e4dc7cb68d1b78c3be2023ed52d4d93'
$Build = 'C:\github\scratch-pilot\plan033-r3-build'
$S = 'C:\github\scratch-pilot\n3-regress3'
if (!(Test-Path "$R\.git")) { throw "Verify the actual clone path: $R" }
if ((Test-Path $Build) -or (Test-Path $S)) { throw 'Choose fresh scratch paths; do not delete existing work.' }
if ([int]((node --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Node 24+ required' }
git -C $R fetch origin codex/plan-033-foundation
if ($LASTEXITCODE -ne 0) { throw 'fetch failed' }
git -C $R worktree add --detach $Build $Candidate
if ($LASTEXITCODE -ne 0) { throw 'worktree creation failed' }
Set-Location $Build
if ((git rev-parse HEAD) -ne $Candidate) { throw 'wrong commit' }
git merge-base --is-ancestor aa7dbe38126471151ee6aad3558bbc354ce8b024 HEAD
if ($LASTEXITCODE -ne 0) { throw 'candidate does not contain merged #174' }
npm ci
if ($LASTEXITCODE -ne 0) { throw 'dependency install failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'build failed' }
New-Item -ItemType Directory -Path $S | Out-Null
Set-Location $S
git init
if ($LASTEXITCODE -ne 0) { throw 'scratch git init failed' }
node "$Build\dist\cli.js" add digital-agency -t claude --native --session-guard local --allow-missing-prereqs -y
if ($LASTEXITCODE -ne 0) { throw 'scratch install failed' }
node "$Build\dist\cli.js" doctor --host claude
if ($LASTEXITCODE -ne 0) { throw 'doctor failed; inspect before launching' }
Get-ChildItem '.claude\agents\*.md' | Select-Object Name
Get-ChildItem '.claude\hooks\*.js' | Select-Object Name
Get-Content '.claude\settings.local.json'
claude --version
```

Expected: ten native agent files (lead plus nine specialists), `agents-united-guard.js` and `agents-united-mode-line-gate.js`, and the settings-level session guard (Bash and Write/Edit/NotebookEdit matcher groups); doctor reports no artifact/hash/guard defect. Missing MCP warnings are expected for this no-connected-tools fixture; the `--allow-missing-prereqs` flag bypasses that install prerequisite only. Decline any later TUI installation question. Do not change global settings or install servers/plugins for R3. Record any existing account-level connected tools; the prompt forbids their use.

After checking current quota, launch **yourself**, in `$S`:

```powershell
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
$env:CLAUDE_CODE_ENABLE_TODO_TOOLS = '1'
claude --agent orchestrator-digital-agency --model sonnet --effort medium
```

Check `/hooks` for the installed settings-level guard and record `/usage` before submitting the prompt. Never use a permissions-bypass flag. **ACCEPT** the delegation map. **DECLINE** every installation question. Do not replace the prompt with a headless run. If stopped at quota, preserve records and mark unfinished expectations unverified; do not silently resume or retry.

## Ready-to-paste TUI prompt

This is H1 from `docs/live-test-protocol.md` with the authorized extra sentence; no other task is added.

```text
Scratch exercise, no real client. Product: PetPal, a pet-sitting marketplace. Produce, under docs/pilot/, a tiny launch kit with a live team of all nine specialists, in Assembly Line order, each deliverable at most 40 lines. Tier 1: ava writes strategy.md (a 5-line growth brief with one ICE-scored hypothesis). Tier 2, in parallel: kaan writes hero.ts (typed HeroSectionProps with the copy), jamileh writes design-tokens.json (colours, type scale, spacing), yavuz writes content-plan.md (one pillar, five cluster titles, two ten-field briefs). Tier 3, in parallel: deniz writes HeroSection.tsx (a typed component that takes the props and uses the token names, with a data-testid on the CTA), selin writes seo-audit.md (a 5-point checklist for the PetPal landing page with severities, plus one FAQPage JSON-LD block), jale writes launch-kit.md (a 3-step email drip with UTM links, a compliance footer, one press release headline and dateline). Tier 4, in parallel: emre writes hero.spec.ts (one Playwright spec for the hero CTA, written but NOT run, no app is running) and defne writes compliance-review.md (review jale's emails and the CTA copy for CAN-SPAM and FTC issues, citing evidence). Contract first: the CTA colour token is color.cta.primary and the CTA testId is hero-primary-cta, fixed in every brief. Use the shared task list with dependencies. Team mode, listing in each brief the peers it may message. No web research, no connected tools, no package installs. Verify what you can yourself and report each teammate's Peer messages received and Open items. Ask each teammate to shut down once it has delivered.

Consult ava read-only first.
```

## Locate and read the actual host project records

After completion, save `/cost` and `/usage`, obtain the full session id (e.g. `/status`), then `/exit` so final cost-state can be saved. Give the executor that id, actual scratch path, CLI/account/model and quota readings. Built-in commands do not count as model prompts unless they actually invoke the model; count every submitted model prompt/reply/retry from records and the maintainer's log.

Run these from the code worktree. Enter the **full session UUID**, without quotes or angle brackets, when prompted; do not guess an encoded project directory from the scratch path. The search verifies the lead's recorded cwd before reading it. Set `$Build` and `$S` to the paths actually used if they differ from the recipe.

### Recovering the session lookup

`Get-ChildItem: Illegal characters in path` can arise from an invalid `-Filter`, including an unreplaced `<full session id>` placeholder; the error may display the directory rather than the invalid filter. The reported error alone does not establish the cause. The corrected collector validates the UUID before forming a filter, uses literal directory paths and honors `CLAUDE_CONFIG_DIR` when set. No Windows executor is available here, so the fix still needs local verification.

If the id was not saved, list recent lead records locally, then select the one from the completed scratch session. This does not start Claude or consume a prompt; the collector below checks the selected record's cwd.

```powershell
$ClaudeConfig = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$ClaudeProjects = Join-Path $ClaudeConfig 'projects'
if (!(Test-Path -LiteralPath $ClaudeProjects -PathType Container)) { throw "Claude projects directory not found: $ClaudeProjects" }
Get-ChildItem -LiteralPath $ClaudeProjects -Recurse -File -Filter '*.jsonl' -ErrorAction Stop |
  Where-Object { $_.Name -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 LastWriteTime, @{Name='SessionId'; Expression={$_.BaseName}}, FullName |
  Format-List
```

### Collect the existing session

```powershell
$Build = 'C:\github\scratch-pilot\plan033-r3-build'
$S = 'C:\github\scratch-pilot\n3-regress3'
$Id = (Read-Host 'Full session UUID, without quotes or angle brackets').Trim()
if ($Id -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { throw 'Enter the full UUID from the session record; do not use the placeholder or a partial id.' }
$O = 'C:\github\scratch-pilot\n3-regress3-evidence'
$ClaudeConfig = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$ClaudeProjects = Join-Path $ClaudeConfig 'projects'
if (!(Test-Path -LiteralPath $ClaudeProjects -PathType Container)) { throw "Claude projects directory not found: $ClaudeProjects" }
$SessionMatches = @(Get-ChildItem -LiteralPath $ClaudeProjects -Recurse -File -Filter "$Id.jsonl" -ErrorAction Stop)
if ($SessionMatches.Count -ne 1) { throw 'Expected exactly one lead record; inspect matches and verify cwd.' }
$Lead = $SessionMatches[0]
$Project = Split-Path $Lead.FullName
$Records = @(Get-Content -LiteralPath $Lead.FullName -ErrorAction Stop | ForEach-Object { try { $_ | ConvertFrom-Json } catch {} })
$Cwd = ($Records | Where-Object { $_.cwd } | Select-Object -First 1).cwd
if (!$Cwd -or ([IO.Path]::GetFullPath($Cwd).TrimEnd('\') -ine [IO.Path]::GetFullPath($S).TrimEnd('\'))) { throw "Record cwd does not match scratch: $Cwd" }
if (Test-Path -LiteralPath $O) { throw 'Choose a fresh evidence directory (change $O); preserve previous reports, including a directory left by the failed attempt.' }
New-Item -ItemType Directory -Path $O | Out-Null
Set-Location $Build
npm run hostlib:session -- $Id --project $Project > "$O\session-report-r3.txt" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'session report failed' }
npm run hostlib:session -- $Id --project $Project --json > "$O\session-report-r3.json" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'JSON report failed' }
$Reader = "$Build\host-library\claude\observations\2026-10-07-n3-records\read-session.mjs"
node $Reader $Lead.FullName 600 > "$O\private-trace-r3-lead.txt" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'reader failed' }
$Sub = Join-Path $Project "$Id\subagents"
Get-ChildItem -LiteralPath $Sub -File -Filter '*.jsonl' -ErrorAction Stop | ForEach-Object {
  node $Reader $_.FullName 600 > (Join-Path $O ('private-trace-' + $_.BaseName + '.txt')) 2>&1
  if ($LASTEXITCODE -ne 0) { throw "teammate reader failed: $($_.Name)" }
}
npm run hostlib:session -- trim $Lead.FullName --out "$O\sanitized"
if ($LASTEXITCODE -ne 0) { throw 'trim failed' }
node $Reader "$O\sanitized\$Id.jsonl" 600 > "$O\trace-r3-lead.txt" 2>&1
if ($LASTEXITCODE -ne 0) { throw 'sanitized lead reader failed' }
Get-ChildItem -LiteralPath "$O\sanitized\$Id\subagents" -File -Filter '*.jsonl' -ErrorAction Stop | ForEach-Object {
  node $Reader $_.FullName 600 > (Join-Path $O ('trace-' + $_.BaseName + '.txt')) 2>&1
  if ($LASTEXITCODE -ne 0) { throw "sanitized teammate reader failed: $($_.Name)" }
}
Get-Content "$O\session-report-r3.txt"
Get-ChildItem -LiteralPath "$S\docs\pilot" -File -ErrorAction Stop | ForEach-Object {
  [PSCustomObject]@{ Name=$_.Name; Lines=@(Get-Content -LiteralPath $_.FullName).Count; SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
} | Format-Table -AutoSize | Out-File "$O\r3-artifacts.txt"
Get-Content "$O\r3-artifacts.txt"
```

The text report header must name `$S`. The JSON command includes npm's script banner; preserve it as raw output, not as an assumed pure JSON document. Read the original session report and the raw reader output locally before accepting abbreviated traces: trim clips long strings and is not a general secret scrubber. Review reports, `.meta.json` and traces for credentials/private data before sharing or committing; retain only reviewed sanitized copies upstream. Keep raw host records/private traces local. Preserve fixture file contents or reviewed copies too, since line counts alone cannot prove the contract tokens or output quality.

## Eight assertions and reporting

The current verdicts below are from the uploaded R3 records, with timestamps/tool results and role counts in the linked observation. The helper's label is evidence to investigate, not an automatic final verdict.

| # | Assertion / control | Evidence and pass rule | Current verdict |
| --- | --- | --- | --- |
| 1 | Mode-line gate and teammate hook health | Under ADR 0044, a readable lead transcript without a saved assistant mode prefix stays held. Repeated holds during transcript lag are permitted; after the saved prefix, retry may proceed. ToolSearch and calls with `agent_id` are exceptions. Missing/unreadable transcript is the recorded fail-open limit, not evidence of a valid prefix. No teammate hook errors. No two-second release or guaranteed one-time hold. | **Seen** |
| 2 | H1a read-only consultation control | Ava is consulted before acceptance; no delivery owner or write before the map is accepted. After acceptance, delivery brief/assignment lifts consultation and she writes. Compare the R2 timestamp evidence and earlier H1 fixtures when interpreting the helper. | **Seen** |
| 3 | H1b full-roster shutdown | Nine structured `shutdown_request`s, nine structured `shutdown_response`s/approvals, zero refused/plain-text responses. Match lead and teammate records; silence is unverified, not accepted. | **Unverified**: nine approval calls; eight host terminations; Defne confirmation absent |
| 4 | H1c five shell-less re-reads | Ava, Kaan, Jamileh, Yavuz and Jale re-read after the last Write/Edit and before completion/report, in a later response. Quota-interrupted work without completion does not establish a violation. | **Seen** |
| 5 | Assembly Line order | All four tiers reached, zero task starts while blocked; inspect TaskCreate/TaskUpdate/TaskGet results and file timestamps, not only the lead's statement. | **Seen** |
| 6 | Nine final reports | All nine reports end with `Peer messages received` and `Open items`; confirm from each teammate's own record. | **Seen** |
| 7 | Nine fixture files and fixed contract | strategy.md, hero.ts, design-tokens.json, content-plan.md, HeroSection.tsx, seo-audit.md, launch-kit.md, hero.spec.ts, compliance-review.md under docs/pilot; each at most 40 lines. Check the requested content, `color.cta.primary`, `hero-primary-cta`, typed props/token use and downstream evidence. Spec is written, not run; no research/package/connected-tool use. | **Seen** |
| 8 | Measured full-run cost | Report actual cost-state total/per-model including teammates and prompt deltas against the aggregate ledger. About 3 USD is a comparison estimate, not a fixed pass threshold. Missing/incomplete cost stays unknown; partial-run cost is not full-run cost. | **Seen** session rollup; independent per-role allocation unverified |

**Additional H1 instruction violated:** only four briefs contain both fixed values; five omit one or both. This does not invalidate the verified final file contents, but R3 is not an unqualified pass. No headless result can replace these assertions. Record the tested commit, actual project directory, account, models/session, exact launch/prompt, counters, aggregate cost, quota/reset readings, command exits and artifact hashes in Plan 033. Add a dated R3 result to Plan 035 and a host observation only after records are read. Foundation review and these interactive records precede any later Plan 033 slice.
