# Artefakte

| Datei | Zweck | Phase |
|---|---|---|
| [messung.ps1](messung.ps1) | Startet `claude.exe` einmal mit der Umgebung für LM Studio und notiert jede TCP-Verbindung des Prozessbaums; Aufrufe stehen in [phase-1-messung.md](../phase-1-messung.md). | 1 |

Ausführen im PowerShell-Werkzeug aus dem Repo-Ordner. Die Datei enthält bewusst nur ASCII, weil PowerShell 5.1 Skripte ohne BOM als Windows-1252 liest.
