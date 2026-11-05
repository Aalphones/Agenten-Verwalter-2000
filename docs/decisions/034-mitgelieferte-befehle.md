# 034 — Mitgelieferte Befehle im `/`-Menü

**Status:** angenommen · **Datum:** 2026-11-05

## Kontext

Das `/`-Menü zeigte nur Skills und Befehle aus Dateien. Eingebaute Befehle wie `/context` oder `/usage` und Plugin-Skills fehlten, ebenso `/compact` und `/codex-review` in „Autark“ und „Codex“. Im Druckmodus fehlen außerdem `/permissions`, `/hooks`, `/resume`, `/memory`, `/status` und `/login`.

## Optionen

- **Quelle für Claude:** (a) feste Liste im Verwalter; (b) Hilfsprozess beim App-Start, der die Liste abfragt; (c) die zuletzt gesehene `slash_commands`-Liste aus `system/init`, gespeichert.

## Entscheidung

- **(c).** Die Liste steht in `settings` unter `claude_slash_commands` und überlebt den Neustart. (a) veraltet mit jeder Version und kennt die Plugin-Skills nicht, (b) kostet bei jedem Start einen Prozess.
- „Autark“ zeigt fest `compact`, „Codex“ `codex-review` und `compact`; die Betriebsart ist die aus den Einstellungen.
- Ausgeblendet: `model`, `effort`, `mcp`, `rename`, `chrome`, `clear`, `agents`, `heapdump`, `color`, `focus`, `workflow-launch-exec`, jeder Name mit `__` und jeder Name, den schon ein Datei-Eintrag trägt (in „Autark“ und „Codex“ fällt stattdessen der Datei-Eintrag weg, weil der Verwalter den Befehl vorher abfängt).
- Beschreibungen kommen aus einer festen deutschen Tabelle im Core; unbekannte Namen bleiben ohne.
- `SkillOrigin::Builtin`; die Einträge kommen als `SkillInfo { kind: Command }` aus den bestehenden Commands, hinter den Datei-Einträgen. Kein Skill-Abzeichen an der Nachricht.

## Konsequenzen

- Vor dem ersten Claude-Start fehlt der Abschnitt „Mitgeliefert“.
- Neue Befehle künftiger Versionen erscheinen ohne Beschreibung, bis sie in die Tabelle kommen.
- Löst „Plugin- und eingebaute Skills stehen nicht im Menü“ aus ADR 007 ab.
