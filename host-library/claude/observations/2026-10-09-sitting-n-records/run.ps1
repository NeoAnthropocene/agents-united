<#
Runs one H10d prompt from PowerShell: it starts scripts/run.sh with GIT Bash.

Why a wrapper: inside PowerShell, plain `bash` is WSL's bash. That one cannot see your Windows `claude`, and /c/... paths do not
exist there (WSL calls the same drive /mnt/c/...). Git Bash is the shell run.sh was written and checked for.

usage:  pwsh -File scripts\run.ps1 h10d1      # h10d1 to h10d7; scripts\run-batch.ps1 runs the closing set in order
        $env:DRY = '1'; pwsh -File scripts\run.ps1 h10d2; Remove-Item Env:DRY     # prints the command and stops, runs nothing
Optional: -Bash 'D:\somewhere\Git\bin\bash.exe' if Git for Windows is installed in an unusual place.

It uses your Claude subscription (run.sh removes every API key variable first) and never reads or prints your image key.
#>
param(
  [Parameter(Mandatory)][ValidateSet('h10d1', 'h10d2', 'h10d3', 'h10d4', 'h10d5', 'h10d6', 'h10d7')][string]$Scenario,
  [string]$Bash
)
$ErrorActionPreference = 'Stop'

if (-not $Bash) {
  $candidates = @()
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) { $candidates += Join-Path (Split-Path (Split-Path $git.Source)) 'bin\bash.exe' }   # ...\Git\cmd\git.exe -> ...\Git\bin\bash.exe
  $candidates += Join-Path $env:ProgramFiles 'Git\bin\bash.exe'
  if (${env:ProgramFiles(x86)}) { $candidates += Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe' }
  if ($env:LOCALAPPDATA) { $candidates += Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\bash.exe' }
  $Bash = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $Bash -or -not (Test-Path -LiteralPath $Bash)) {
  throw "Git Bash was not found (it comes with Git for Windows). Install Git for Windows, or pass -Bash <path to its bash.exe>."
}

$script = (Join-Path $PSScriptRoot 'run.sh') -replace '\\', '/'
"Using Git Bash: $Bash"
& $Bash $script $Scenario
exit $LASTEXITCODE
