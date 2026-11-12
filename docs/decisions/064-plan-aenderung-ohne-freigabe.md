# 064 — Plan-Änderung ohne Freigabe

**Status:** angenommen · **Datum:** 2026-11-12 · ersetzt den Teil „Vorschlag, Übernehmen, Verwerfen, Anhalten“ aus [ADR 059](059-begonnene-phase-umplanen.md)

## Kontext

Schlug eine Station nach dem ersten Start eine neue Phase oder Fix-Runde vor (`implementation_set_phases`), legte der Verwalter das nur als Vorschlag ab. Der Benutzer musste ihn auf der Karte „Plan ändern?“ übernehmen, bevor die Stationen erschienen. Gleichzeitig hielt der Vorschlag die Stationen an, die er ersetzt hätte; die Entwicklung lief aber an anderer Stelle weiter. Die Karte nannte nur Phasen-Schlüssel und Stationszahlen, nicht den Grund. Sie half dem Benutzer nicht zu entscheiden und kostete einen Klick, ohne etwas zu schützen.

## Entscheidung

- **Jede Plan-Änderung gilt sofort.** `changes::propose` schreibt sie wie bisher vor dem ersten Start, jetzt auch danach. Der Agent erhält „Übernommen: neu 5/6, entfallen 7.“.
- **Kein Vorschlagszustand mehr.** Es entfallen die Karte „Plan ändern?“ samt „Übernehmen“/„Verwerfen“, der Befehl `implementation_apply_change`, der Typ `PendingChange`, das Anhalten von Stationen und die Zeile „wartet auf Übernehmen“ im Lagebericht.
- **Sichtbar bleibt die Änderung als Karte „Plan geändert“** (Marke auf der Linie, Phasen-Marken „neu“/„vorgezogen“) mit Sitzung, Zeitpunkt und Stationszahl vorher/nachher.
- **Unverändert** bleibt, was ADR 059 für die Gültigkeit festlegt: begonnene Stationen sind unantastbar, genannte begonnene Phasen ersetzen nur ihre noch nicht gestarteten Stationen, fertige Phasen dürfen nicht genannt werden.
- **Die Spalte `implementations.pending_change` bleibt** (keine Migration). Sie wird nie gelesen und bei jeder Plan-Änderung und beim Abbrechen geleert.

## Folgen

- Eine Fix-Runde nach einem Review erscheint ohne Zutun und läuft, sobald ihre Vorgänger fertig sind.
- Der Benutzer sieht Änderungen erst im Nachhinein. Wer eine Änderung nicht will, bricht die Umsetzung ab oder plant per Chat um; ein Zurück-Knopf fehlt.
- Wird eine Station gestartet, während der Agent die Änderung setzt, scheitert das Setzen mit „Eine Station hat inzwischen begonnen; bitte den Plan neu setzen.“; der Agent setzt dann neu.
- Prüfen ohne App: `implementation-probe … set-phases <Umsetzungs-ID> <JSON-Datei>` spielt eine Änderung gegen eine Datenbank-Kopie ein und druckt Unterschiede sowie den Stand vorher und nachher.
