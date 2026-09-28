# 003 — Anbindung von Claude: Kommandozeile im Stream-Modus, direkt aus dem Core

**Status:** angenommen · **Datum:** 2026-09-28

## Kontext

Das Claude Agent SDK gibt es für TypeScript und Python, nicht für Rust ([PROJECT.md](../PROJECT.md) → offene Fragen). Zur Wahl standen (a) ein Node-Hilfsprozess pro Agent mit dem SDK, gesteuert vom Rust-Core, und (b) die `claude`-Kommandozeile im JSON-Stream-Modus, direkt vom Core gestartet. Eine Probe gegen Claude Code 2.1.220 hat die Kernfunktionen von (b) belegt: Starten, Ereignisse empfangen, Rückfragen beantworten, Unterbrechen, Modell- und Moduswechsel mitten in der Session, Fortsetzen mit vollem Verlauf ([knowledge/claude-stream-json.md](../knowledge/claude-stream-json.md)).

## Optionen

- **(a) Node-Hilfsprozess mit dem SDK** — typisierte Schnittstelle, aber das SDK startet intern dieselbe `claude.exe` mit denselben Stream-Argumenten. Pro Agent ein zusätzlicher Node-Prozess, eine zweite Laufzeit in der Auslieferung und eine zusätzliche Übersetzungsschicht.
- **(b) Kommandozeile direkt** — der Core startet `claude.exe` ohne Shell, schreibt JSON-Zeilen auf stdin, liest JSON-Zeilen von stdout. Das Protokoll ist nicht als stabile Schnittstelle dokumentiert und kann sich mit Claude-Code-Versionen ändern.

## Entscheidung

- **(b):** `claude.exe -p --input-format stream-json --output-format stream-json --verbose --permission-prompt-tool stdio`, Modell, Denkaufwand, Modus und Session-ID als Argumente. Die Session-ID der App ist zugleich die Session-ID von Claude (`--session-id` beim ersten Start, `--resume` bei jedem weiteren).
- **Denkaufwand-Wechsel** = Prozess beenden und mit `--resume` und neuem `--effort` neu starten, weil es dafür keine Steueranfrage gibt. Modell und Modus wechseln per Steueranfrage ohne Neustart.
- **Übersetzung im Core:** Das Modul `src-tauri/src/agents/claude/` liest das Protokoll und übersetzt es in anbieterneutrale Typen (`src-tauri/src/agents/event.rs`). Die Oberfläche kennt das Claude-Protokoll nicht.
- **Noch kein Provider-Trait.** Solange Claude der einzige Anbieter ist, ruft `sessions/` das Claude-Modul direkt. Der Trait entsteht mit dem zweiten Anbieter, aus dem, was beide dann wirklich gemeinsam haben.
- **Programm finden:** Umgebungsvariable `VERWALTER_CLAUDE_PATH`, sonst `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe`, sonst `%USERPROFILE%\.local\bin\claude.exe`, sonst `claude.exe` im `PATH`. Eine Einstellung dafür kommt mit den Einstellungen (Meilenstein 6).

## Konsequenzen

- Ein Update von Claude Code kann das Protokoll ändern. Unbekannte Zeilen werden deshalb ignoriert und ins Protokoll der Session geschrieben, nie als Fehler behandelt; die geprüfte Version steht in der Wissensdatei.
- Die Einstellungen des Benutzers (Rechte-Regeln, Hooks, Skills) gelten auch in der App — wie in der VS-Code-Erweiterung. Ob „Manuell“ vor einem Werkzeug nachfragt, hängt damit auch von seinen Freigabe-Regeln ab.
- Pro offener Session läuft ein `claude.exe` mit rund 390 MB. Prozesse ruhender Sessions zu beenden und bei Bedarf mit `--resume` neu zu starten: umgesetzt, siehe [ADR 004](004-persistenz-und-wiederherstellung.md).
- Die Anmeldung nutzt die der installierten Kommandozeile; die App verwaltet keinen eigenen API-Schlüssel.
