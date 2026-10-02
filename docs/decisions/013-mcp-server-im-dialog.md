# 013 — MCP-Server im Dialog: Steueranfragen an den Agenten der Session

**Status:** angenommen · **Datum:** 2026-10-02

## Kontext

Der Agent einer Session lädt MCP-Server aus Benutzer-, Projekt- und claude.ai-Konfiguration. Ob ein Server verbunden ist, fehlgeschlagen ist oder eine Anmeldung braucht, sieht man im Verwalter bisher nicht; neu verbinden oder ausschalten ging nur in der Kommandozeile. Gebraucht wird ein Dialog „MCP-Server“ wie `/mcp` in der VS-Code-Erweiterung. Die Protokoll-Fakten stehen in [claude-stream-json.md](../knowledge/claude-stream-json.md), Abschnitt „MCP-Server steuern“. Gemessen am 2026-10-01 mit der Kommandozeile im Druckmodus und `--input-format stream-json`: `mcp_status` liefert je Server `name`, `status`, `scope`, `config`, ab `connected` `serverInfo` und `tools`, bei `failed` `error`; `mcp_reconnect` und `mcp_toggle` antworten bei Erfolg ohne Inhalt; claude.ai-Server stehen nach dem Start ~10 s auf `pending`, ohne dass ein Ereignis den Wechsel meldet; Ausschalten bleibt je Arbeitsordner gespeichert.

## Optionen

- **Quelle der Liste und der Aktionen:** (a) eigener MCP-Client im Core; (b) Hilfsprozess im Workspace wie beim Kontingent ([ADR 008](008-kontext-und-kontingent.md)); (c) Steueranfragen an den Agenten der Session.
- **Wo „Aus“ gespeichert wird:** (a) eigene Tabelle im Verwalter; (b) bei der Kommandozeile.
- **Lebensdauer der Liste:** (a) SQLite; (b) nur im Speicher, solange der Agent-Prozess lebt.

## Entscheidung

- **Steueranfragen an den Agenten der Session: (c).** (a) scheidet aus: zweite Verbindung zu jedem Server, zweite Konfiguration, und der Agent sähe die Wirkung nicht. (b) scheidet aus: er zeigt auch bei ruhendem Agenten etwas an, aber nicht die Verbindungen, die der Agent tatsächlich hat, und kostet je Abfrage einen Prozessstart plus ~10 s Verbindungsaufbau. Folge: ohne laufenden Agenten gibt es keine Liste.
- **Ausschalten speichert die Kommandozeile: (b).** Es gilt damit für alle Sessions des Vorhabens und übersteht Neustarts; der Dialog sagt das in der Fußzeile und im Tooltip des Schalters. Keine eigene Tabelle, keine Migration.
- **Liste nur im Speicher: (b).** Endet oder wechselt der Prozess, wird sie verworfen — eine alte Liste würde Verbindungen zeigen, die es nicht mehr gibt.
- **Wann gefragt wird:** am Ende jeder Antwort des Agenten (neben `get_context_usage`), beim Öffnen des Dialogs, nach jeder beantworteten Aktion, und solange der Dialog offen ist und ein Server `pending` ist oder eine Aktion läuft, alle 2 s.
- **Antworten zuordnen über die Request-ID:** `mcp_reconnect`/`mcp_toggle` antworten ohne Inhalt; nur über die ID weiß der Core, welche Aktion fertig ist oder scheiterte. Die Übersetzung meldet deshalb jede Antwort ohne Inhalt bzw. jeden Fehler mit ihrer ID; die Registry wertet nur IDs aus, die sie selbst für eine MCP-Aktion vergeben hat — alles andere (z. B. die Bestätigung von `stop_task`) bleibt ohne Folge.
- **Problem = `failed` oder `needs-auth`.** Ihre Anzahl trägt die `SessionSummary` (`mcpProblems`), damit Eingabeleiste und `/`-Menü sie ohne eigenes Laden kennen.
- **Nachsichtiges Lesen:** das Format von `mcp_status` ist nicht als stabil dokumentiert; jedes Feld ist optional, ein unbekannter Status wird `Unknown`, ein Eintrag ohne Namen fällt weg.
- **Name:** Feature `mcp` in allen Schichten nach dem Namensschema der Code-Map; in der Oberfläche „MCP-Server“.

## Konsequenzen

- Ohne laufenden Agenten (neue Session, nach Ruhe-Timer, nach App-Neustart) zeigt der Dialog keine Liste, sondern erklärt, wie sie erscheint.
- Der Zustand `needs-auth` ist nur aus der SDK-Dokumentation bekannt, nicht gemessen; tritt ein anderer Status auf, zeigt die Zeile „Unbekannt“.
- Die Liste altert zwischen zwei Antworten des Agenten; Wechsel von `pending` auf `connected` sieht man nur durch erneutes Fragen, deshalb das 2-Sekunden-Nachfragen bei offenem Dialog.
