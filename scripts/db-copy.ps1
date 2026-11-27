<#
.SYNOPSIS
Legt eine konsistente Kopie der Verwalter-Datenbank für die Proben an.

.DESCRIPTION
Öffnet die Datenbank nur lesend und schreibt sie über die Backup-Funktion von SQLite in die
Zieldatei. Ein laufender Verwalter und ein noch nicht eingespieltes WAL stören dabei nicht;
ein reines Kopieren der .db-Datei verlöre die Einträge, die noch im WAL stehen.
Gibt den Pfad der Kopie und die Schema-Version (user_version) aus.

.EXAMPLE
powershell -File scripts/db-copy.ps1 -Target "C:\...\.scratchpad\<id>\probe.db"
#>
param(
    [Parameter(Mandatory = $true)][string]$Target,
    [string]$Source = (Join-Path $env:USERPROFILE '.verwalter\verwalter.db')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Datenbank nicht gefunden: $Source"
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'python fehlt im PATH; die Kopie braucht das sqlite3-Modul von Python.'
}

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$targetPath = [System.IO.Path]::GetFullPath($Target)
if ($sourcePath -ieq $targetPath) {
    throw 'Ziel ist die Originaldatenbank; die Proben laufen nur gegen eine Kopie.'
}
$targetFolder = Split-Path -Parent $targetPath
if (-not (Test-Path -LiteralPath $targetFolder)) {
    New-Item -ItemType Directory -Path $targetFolder | Out-Null
}

# mode=ro: das Original wird nie zum Schreiben geöffnet.
$backupScript = @'
import sqlite3, sys
source_path, target_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect('file:' + source_path.replace('\\', '/') + '?mode=ro', uri=True)
target = sqlite3.connect(target_path)
source.backup(target)
source.close()
version = target.execute('pragma user_version').fetchone()[0]
target.close()
print(target_path + ' - user_version ' + str(version))
'@

$backupScript | python -I - $sourcePath $targetPath
exit $LASTEXITCODE
