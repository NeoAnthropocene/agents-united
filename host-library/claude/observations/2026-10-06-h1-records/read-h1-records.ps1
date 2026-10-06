# Reads the host's own records of one team session: each teammate's final report, what it did before its first
# write, its shutdown replies, the order of Write, Read and TaskUpdate for the shell-less roles, and what the lead
# recorded about the consultation and the departures. Plan 035 M3, Sitting C (H1). Read-only; prints text.
#
# Usage: pwsh -NoProfile -File read-h1-records.ps1 -Session <path to the lead's <session-id>.jsonl>
# The teammates' records are in the folder of the same name, under subagents/.
param([Parameter(Mandatory)][string]$Session)

$Dir = Join-Path ($Session -replace '\.jsonl$', '') 'subagents'

function Blocks($o) { $c = $o.message.content; if ($c -is [string]) { return @([pscustomobject]@{ type = 'text'; text = $c }) } else { return @($c) } }
function Clip([string]$s, [int]$n) { if ($null -eq $s) { return '' }; $s = ($s -replace '\s+', ' ').Trim(); if ($s.Length -gt $n) { return $s.Substring(0, $n) + '...' } else { return $s } }
function T($x) { if ($x -is [datetime]) { return $x.ToUniversalTime().ToString('HH:mm:ss.fff') } else { return [string]$x } }
function Records($path) { foreach ($line in [System.IO.File]::ReadLines($path)) { try { $line | ConvertFrom-Json } catch { continue } } }
function Name($file) { return ($file.Name -replace '^agent-a', '' -replace '-[0-9a-f]+\.jsonl$', '') }

'## Teammates: before the first write, final report, shutdown replies'
foreach ($f in Get-ChildItem $Dir -Filter 'agent-*.jsonl' | Sort-Object Name) {
  $texts = @(); $tools = @(); $results = @{}
  foreach ($o in Records $f.FullName) {
    if ($o.type -eq 'assistant') {
      foreach ($b in Blocks $o) {
        if ($b.type -eq 'text' -and $b.text) { $texts += [pscustomobject]@{ ts = $o.timestamp; text = $b.text } }
        if ($b.type -eq 'tool_use') { $tools += [pscustomobject]@{ ts = $o.timestamp; name = $b.name; id = $b.id; input = ($b.input | ConvertTo-Json -Compress -Depth 6) } }
      }
    } elseif ($o.type -eq 'user') {
      foreach ($b in Blocks $o) { if ($b.type -eq 'tool_result') { $t = if ($b.content -is [string]) { $b.content } else { ($b.content | ForEach-Object { $_.text }) -join ' ' }; $results[$b.tool_use_id] = [pscustomobject]@{ err = [bool]$b.is_error; text = $t } } }
    }
  }
  $firstWrite = $tools | Where-Object { $_.name -in 'Write', 'Edit' } | Select-Object -First 1
  $before = if ($firstWrite) { @($texts | Where-Object { $_.ts -lt $firstWrite.ts }) } else { $texts }
  $flag = @($texts | Where-Object { $_.text -match '(?i)provisional|what i need|missing input|before i (start|proceed)|could you (provide|confirm)' })
  "=== $(Name $f): assistant texts $($texts.Count), tool calls $($tools.Count), first Write/Edit at $(if ($firstWrite) { T $firstWrite.ts } else { 'none' })"
  "  texts before the first write: $($before.Count); with a question mark: $(@($before | Where-Object { $_.text -match '\?' }).Count); texts matching provisional / what I need / missing input: $($flag.Count)"
  $last = $texts | Select-Object -Last 1
  '  FINAL: ' + (Clip $last.text 330)
  $oi = $last.text.IndexOf('Open items'); if ($oi -ge 0) { '  OPEN ITEMS: ' + (Clip $last.text.Substring($oi) 260) }
  foreach ($t in ($tools | Where-Object { $_.name -eq 'SendMessage' })) { $r = $results[$t.id]; "  SendMessage $(T $t.ts): " + (Clip $t.input 150) + $(if ($r) { '  => ' + $(if ($r.err) { 'ERROR ' } else { 'ok ' }) + (Clip $r.text 110) } else { '  => (no result)' }) }
}

''
'## The shell-less roles: Write, Read and TaskUpdate, with the message each call belongs to'
foreach ($n in 'ava', 'jale', 'jamileh', 'kaan', 'yavuz') {
  $f = Get-ChildItem $Dir -Filter "agent-a$n-*.jsonl" | Select-Object -First 1
  $events = @(); $readMsg = $null; $doneMsg = $null
  foreach ($o in Records $f.FullName) {
    if ($o.type -ne 'assistant') { continue }
    foreach ($b in Blocks $o) {
      if ($b.type -ne 'tool_use') { continue }
      $i = $b.input
      if ($b.name -eq 'Write') { $events += "$(T $o.timestamp) Write $(Split-Path $i.file_path -Leaf)" }
      elseif ($b.name -eq 'Read' -and $events.Count -gt 0 -and ($events -join ' ') -match 'Write') { $events += "$(T $o.timestamp) Read $(Split-Path $i.file_path -Leaf)"; $readMsg = $o.message.id }
      elseif ($b.name -eq 'TaskUpdate' -and $i.status -eq 'completed') { $events += "$(T $o.timestamp) TaskUpdate completed"; $doneMsg = $o.message.id }
    }
  }
  "$n :: " + ($events -join '  |  ') + "  ||  re-read and completion in the same response: " + $(if ($readMsg -and $readMsg -eq $doneMsg) { 'yes' } else { 'no' })
}

''
'## The lead: what it says about the consultation, and the departure notices it recorded'
$texts = @()
foreach ($o in Records $Session) {
  if ($o.type -ne 'assistant') { continue }
  foreach ($b in Blocks $o) { if ($b.type -eq 'text' -and $b.text) { $texts += [pscustomobject]@{ ts = (T $o.timestamp); text = $b.text } } }
}
"lead assistant texts: $($texts.Count)"
foreach ($t in ($texts | Where-Object { $_.text -match '(?i)consult|read-only|waive' } | Select-Object -First 2)) { $m = [regex]::Match($t.text, '(?i)consult|read-only|waive'); $s = [Math]::Max(0, $m.Index - 160); "[$($t.ts)] ..." + (Clip $t.text.Substring($s, [Math]::Min(420, $t.text.Length - $s)) 420) }
"FIRST: [$($texts[0].ts)] " + (Clip $texts[0].text 300)
"LAST : [$($texts[-1].ts)] " + (Clip $texts[-1].text 500)
foreach ($line in [System.IO.File]::ReadLines($Session)) {
  if ($line -match 'teammate_terminated|shutdown_approved') {
    try { $o = $line | ConvertFrom-Json } catch { continue }
    $who = ([regex]::Matches($line, '(?i)(?:from|teammate_id|teammateId|agent)\\?"?[:=]\s*\\?"?(ava|kaan|jamileh|yavuz|deniz|selin|jale|emre|defne)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique) -join ','
    'departure notice {0} {1} -> {2}' -f (T $o.timestamp), [regex]::Match($line, 'teammate_terminated|shutdown_approved').Value, $who
  }
}
