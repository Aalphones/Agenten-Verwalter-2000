# 032 — Wartet auf Skript

**Status:** angenommen · **Datum:** 2026-10-20

## Kontext

Gibt der Agent seine Antwort ab, während ein Hintergrund-Befehl läuft, auf dessen Ende er wartet (Test-Suite, Build, Skript, `Monitor`), zeigt die Sidebar die Session mit grünem Haken als fertig. Der Agent setzt aber von selbst fort, sobald der Befehl endet — die Session ist nicht fertig. Für Subagenten löst `awaiting_subagent` dasselbe Problem schon.

## Optionen

- **Was zählt:** (a) jeder laufende Hintergrund-Eintrag der Art `Process`; (b) nur solche ohne erkannte lokale Adresse.
- **Fortschritt:** (a) Restzeit aus früheren Läufen desselben Befehls schätzen; (b) Ausgabe lesen und Fortschritt erraten; (c) nur die Laufzeit als Uhr.

## Entscheidung

- **Ohne Adresse (b).** Ein Dev-Server, der eine `localhost`-Adresse ausgibt, läuft absichtlich weiter; mit (a) stünde der Chat dauerhaft auf „wartet“. Wird die Adresse erst nach dem Abgeben erkannt, wechselt die Anzeige auf den Haken.
- **Nur Uhr (c).** Historie und Ausgabe sind je Befehl verschieden und raten falsch; die Uhr ist immer richtig.
- Der Core meldet `SessionSummary.awaited_script` (Befehl und Startzeit des ältesten passenden Eintrags, Anzahl) nur bei Status `Completed` und wenn kein Subagent wartet; `status` bleibt `Completed`. Jede Änderung eines `Process`-Eintrags setzt `summary_dirty`. „Wartet auf Skript“ ist ein Anzeige-Status der Oberfläche, kein Session-Status. `Monitor` und vom Agenten weggeschobene Vordergrund-Befehle kommen als `local_bash` und zählen damit mit.

## Konsequenzen

- Ein Dev-Server ohne Adressausgabe hält die Sanduhr, bis er endet oder angehalten wird.
- Jede Änderung eines Hintergrund-Prozesses schreibt die Session-Zeile neu und schickt eine neue Zusammenfassung an die Oberfläche.
