<#
.SYNOPSIS
  Formatiert und fährt die Prüfkette; schreibt das volle Log in eine Datei und zeigt nur Exit-Code und Log-Ende.
.EXAMPLE
  powershell -File scripts/check.ps1
  powershell -File scripts/check.ps1 -SkipFormat -Tail 30
#>
param(
  [switch]$SkipFormat,
  [int]$Tail = 15,
  [string]$LogPath = (Join-Path ([System.IO.Path]::GetTempPath()) 'verwalter-check.log')
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

# Agenten-Shells erben einen PATH ohne Cargo; rustfmt und Clippy in der Prüfkette brauchen ihn.
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  $env:Path = "$cargoBin;$env:Path"
}

Push-Location $repoRoot
try {
  if (-not $SkipFormat) {
    pnpm format *> $null
    cargo fmt --manifest-path src-tauri/Cargo.toml *> $null
  }
  # Ausgabe in die Datei statt in eine Pipe: so bleibt der Exit-Code der Prüfkette erhalten.
  cmd /c "pnpm check > `"$LogPath`" 2>&1"
  $exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

Write-Output "exit $exitCode - Log: $LogPath"
Get-Content -LiteralPath $LogPath -Tail $Tail
exit $exitCode
