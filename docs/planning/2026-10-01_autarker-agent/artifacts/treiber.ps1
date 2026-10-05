# Startet den eigenen Agenten, schickt Nachrichten nacheinander und wartet je auf die result-Zeile.
# Mit -InterruptAfterMs wird eine Nachricht (-InterruptIndex, Standard die letzte) nach so vielen
# Millisekunden unterbrochen.
# Nur ASCII: PowerShell 5.1 liest Skripte ohne BOM als Windows-1252.
param(
    [Parameter(Mandatory = $true)][string]$SessionId,
    [switch]$Resume,
    [Parameter(Mandatory = $true)][string[]]$Messages,
    [int]$InterruptAfterMs = 0,
    [int]$InterruptIndex = -1,
    [string]$Model = 'google/gemma-4-12b-qat',
    [string]$Exe = 'src-tauri\target\debug\verwalter.exe',
    [int]$TimeoutSeconds = 300
)

$startOption = '--session-id'
if ($Resume) { $startOption = '--resume' }

$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = (Resolve-Path $Exe).Path
$info.Arguments = "agent -p --input-format stream-json --output-format stream-json --verbose --model $Model --permission-mode default $startOption $SessionId"
$info.UseShellExecute = $false
$info.RedirectStandardInput = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
$process = [System.Diagnostics.Process]::Start($info)
$stdin = New-Object System.IO.StreamWriter($process.StandardInput.BaseStream, (New-Object System.Text.UTF8Encoding $false))
$stdin.AutoFlush = $true
$stderrTask = $process.StandardError.ReadToEndAsync()
$pending = $null
if ($InterruptIndex -lt 0) { $InterruptIndex = $Messages.Count - 1 }

function Read-UntilResult([System.Diagnostics.Stopwatch]$clock) {
    $deadline = [DateTime]::Now.AddSeconds($TimeoutSeconds)
    while ([DateTime]::Now -lt $deadline) {
        if ($null -eq $script:pending) { $script:pending = $process.StandardOutput.ReadLineAsync() }
        if (-not $script:pending.Wait(100)) { continue }
        $line = $script:pending.Result
        $script:pending = $null
        if ($null -eq $line) { return }
        Write-Output $line
        if (($line | ConvertFrom-Json).type -eq 'result') {
            if ($null -ne $clock) { Write-Output ("[result nach {0} ms ab interrupt]" -f $clock.ElapsedMilliseconds) }
            return
        }
    }
    Write-Output '[Zeitlimit ohne result]'
}

for ($index = 0; $index -lt $Messages.Count; $index++) {
    $text = $Messages[$index] | ConvertTo-Json -Compress
    $stdin.WriteLine('{"type":"user","message":{"role":"user","content":' + $text + '}}')
    if (($index -eq $InterruptIndex) -and $InterruptAfterMs -gt 0) {
        Start-Sleep -Milliseconds $InterruptAfterMs
        $stdin.WriteLine('{"type":"control_request","request_id":"req-interrupt","request":{"subtype":"interrupt"}}')
        $clock = [System.Diagnostics.Stopwatch]::StartNew()
        Read-UntilResult $clock
    } else {
        Read-UntilResult $null
    }
}

$stdin.Close()
if (-not $process.WaitForExit(10000)) { $process.Kill(); Write-Output '[Prozess nach 10 s abgeschossen]' }
Write-Output ("[Exit-Code {0}]" -f $process.ExitCode)
$stderr = $stderrTask.Result
if ($stderr) { Write-Output "[stderr] $stderr" }
