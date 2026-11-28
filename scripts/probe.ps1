<#
.SYNOPSIS
  Kopiert die Datenbank, baut report-probe, führt den Probe-Lauf aus und zeigt die gefilterte Ausgabe.
.DESCRIPTION
  Alles nach den benannten Parametern geht hinter dem Pfad der Datenbank-Kopie an report-probe.
  Die volle Ausgabe steht in <Folder>\probe.txt (UTF-8), die Datenbank-Kopie in <Folder>\probe.db.
  Fehlerausgabe und Dauer von report-probe erscheinen direkt in der Konsole.
.EXAMPLE
  powershell -File scripts/probe.ps1 -Folder "C:\...\.scratchpad\<id>" <Umsetzungs-ID> view
.EXAMPLE
  powershell -File scripts/probe.ps1 -Folder "C:\...\.scratchpad\<id>" -Filter '^## ' <Umsetzungs-ID> tidy <Phasen-Key> --haiku
#>
# Ohne PositionalBinding=$false landet das zweite Probe-Argument in -Head.
[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [string]$Filter,
  [int]$Head = 40,
  [switch]$KeepDatabase,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ProbeArguments
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  $env:Path = "$cargoBin;$env:Path"
}

$folderPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Folder)
New-Item -ItemType Directory -Force -Path $folderPath | Out-Null
$databasePath = Join-Path $folderPath 'probe.db'
$outputPath = Join-Path $folderPath 'probe.txt'

# -KeepDatabase: mehrere Läufe gegen denselben Stand, etwa zum Vergleich zweier Ausgaben.
if (-not ($KeepDatabase -and (Test-Path -LiteralPath $databasePath))) {
  Write-Output '[1/3] Datenbank kopieren'
  & (Join-Path $PSScriptRoot 'db-copy.ps1') -Target $databasePath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Push-Location $repoRoot
try {
  Write-Output '[2/3] report-probe bauen'
  cargo build -q --manifest-path src-tauri/Cargo.toml --example report-probe
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Output '[3/3] Probe ausführen'
  $probe = Join-Path $repoRoot 'src-tauri\target\debug\examples\report-probe.exe'
  $quotedArguments = (@($databasePath) + $ProbeArguments | ForEach-Object { "`"$_`"" }) -join ' '
  # Umleitung über cmd: PowerShell 5.1 würde die UTF-8-Ausgabe sonst als UTF-16 neu schreiben.
  cmd /s /c "`"`"$probe`" $quotedArguments > `"$outputPath`"`""
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

$lines = @(Get-Content -LiteralPath $outputPath -Encoding UTF8)
Write-Output "exit $exitCode - $($lines.Count) Zeilen in $outputPath"
if ($Filter) {
  $lines = @($lines | Where-Object { $_ -match $Filter })
}
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$lines | Select-Object -First $Head
exit $exitCode
