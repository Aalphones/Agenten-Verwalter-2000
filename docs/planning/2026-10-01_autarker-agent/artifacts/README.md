# Artefakte

| Datei | Zweck | Phase |
|---|---|---|
| [beispielzeilen.jsonl](beispielzeilen.jsonl) | Eingehende Zeilen zum Ausprobieren: zwei Nachrichten und ein `interrupt`. | 1 |

## Den Agenten von Hand starten

Im PowerShell-Werkzeug aus dem Repo-Ordner, nach `cargo build --manifest-path src-tauri/Cargo.toml`. In LM Studio muss das Modell geladen und der Server an sein.

```powershell
$env:VERWALTER_AGENT_BASE_URL = 'http://localhost:1234'
$env:VERWALTER_AGENT_CONTEXT_WINDOW = '64000'
$id = [guid]::NewGuid().ToString()
$agent = 'src-tauri\target\debug\verwalter.exe'
$common = @('agent', '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', 'google/gemma-4-12b-qat', '--permission-mode', 'default')
```

Eine Nachricht, dann Ende der Eingabe (der Agent bricht beim Dateiende eine laufende Antwort ab — deshalb nur die erste Zeile, und die Antwort abwarten, indem die Eingabe offen bleibt, bis sie da ist):

```powershell
Get-Content docs\planning\2026-10-01_autarker-agent\artifacts\beispielzeilen.jsonl -TotalCount 1 | & $agent @common --session-id $id
```

`Get-Content` schließt die Eingabe sofort, also bricht der Agent die Antwort ab. Für einen ganzen Turn die Zeile über einen Prozess mit offener Eingabe schicken, z. B. mit `System.Diagnostics.Process` (`RedirectStandardInput`): Zeile schreiben, auf die `result`-Zeile in der Ausgabe warten, dann die nächste Zeile oder `StandardInput.Close()`.

Fortsetzen: derselbe Aufruf mit `--resume $id` statt `--session-id $id`. Unterbrechen: die `control_request`-Zeile schreiben, während die Antwort läuft. Das Transkript liegt unter `%USERPROFILE%\.verwalter\agent\<id>.jsonl`.
