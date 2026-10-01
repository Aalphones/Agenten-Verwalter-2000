# Messung fuer Phase 1: startet claude.exe einmal mit der Umgebung fuer LM Studio und notiert
# jede TCP-Verbindung des Prozessbaums. Nur ASCII in dieser Datei (PowerShell 5.1 liest .ps1 als Windows-1252).
#
# Beispiel:
#   .\messung.ps1 -Out C:\temp\m1-mit -Model google/gemma-4-12b-qat -ContextTokens 64000 -DisableTraffic `
#     -Arguments '-p "Antworte nur mit dem Wort OK." --max-turns 1 --output-format json'
param(
  [Parameter(Mandatory = $true)] [string]$Out,
  [Parameter(Mandatory = $true)] [string]$Arguments,
  [string]$Model = 'google/gemma-4-12b-qat',
  [int]$ContextTokens = 0,
  [switch]$Claude,          # ohne LM-Studio-Umgebung (fuer M5, erster Schritt)
  [switch]$DisableTraffic,  # CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC und Marketplace-Schalter
  [string]$InputFile = '',
  [string]$WorkingDirectory = (Get-Location).Path
)

$names = 'ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_ATTRIBUTION_HEADER',
  'ANTHROPIC_DEFAULT_FABLE_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL','CLAUDE_CODE_SUBAGENT_MODEL','CLAUDE_CODE_MAX_CONTEXT_TOKENS',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC','CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL'
foreach ($n in $names) { Remove-Item "Env:$n" -ErrorAction SilentlyContinue }

if (-not $Claude) {
  $env:ANTHROPIC_BASE_URL = 'http://localhost:1234'
  $env:ANTHROPIC_AUTH_TOKEN = 'lmstudio'
  $env:CLAUDE_CODE_ATTRIBUTION_HEADER = '0'
  foreach ($n in 'ANTHROPIC_DEFAULT_FABLE_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL','CLAUDE_CODE_SUBAGENT_MODEL') {
    Set-Item "Env:$n" $Model
  }
  if ($ContextTokens -gt 0) { $env:CLAUDE_CODE_MAX_CONTEXT_TOKENS = "$ContextTokens" }
  if ($DisableTraffic) {
    $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
    $env:CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL = '1'
  }
  $Arguments = "$Arguments --model $Model"
}

$exe = (Get-Command claude).Source
$startArgs = @{
  FilePath = $exe; ArgumentList = $Arguments; WorkingDirectory = $WorkingDirectory
  RedirectStandardOutput = "$Out.json"; RedirectStandardError = "$Out.stderr.txt"
  PassThru = $true; NoNewWindow = $true
}
if ($InputFile -ne '') { $startArgs.RedirectStandardInput = $InputFile }
$started = Get-Date
$p = Start-Process @startArgs

function Get-TreeIds([int]$rootId) {
  $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name
  $ids = @($rootId); $queue = @($rootId)
  while ($queue.Count -gt 0) {
    $cur = $queue[0]; $queue = @($queue | Select-Object -Skip 1)
    foreach ($c in ($all | Where-Object { $_.ParentProcessId -eq $cur })) { $ids += [int]$c.ProcessId; $queue += [int]$c.ProcessId }
  }
  $byId = @{}; foreach ($a in $all) { $byId[[int]$a.ProcessId] = $a.Name }
  return @{ Ids = $ids; Names = $byId }
}

$seen = @{}
$tick = 0
$tree = Get-TreeIds $p.Id
while (-not $p.HasExited) {
  if ($tick % 10 -eq 0) { $tree = Get-TreeIds $p.Id }
  foreach ($c in (Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $tree.Ids -contains $_.OwningProcess })) {
    $key = "$($tree.Names[[int]$c.OwningProcess]) -> $($c.RemoteAddress):$($c.RemotePort)"
    if (-not $seen.ContainsKey($key)) { $seen[$key] = (Get-Date).ToString('HH:mm:ss') }
  }
  Start-Sleep -Milliseconds 200
  $tick++
}

$lines = @("exit=$($p.ExitCode)", "dauer_s=$([int]((Get-Date) - $started).TotalSeconds)", "verbindungen:")
$lines += ($seen.GetEnumerator() | Sort-Object Value | ForEach-Object { "  $($_.Value)  $($_.Key)" })
$lines | Set-Content -Path "$Out.verbindungen.txt" -Encoding ASCII
$lines
