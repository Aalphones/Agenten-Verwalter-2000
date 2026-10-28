# 042 — Werkzeug-Details: Eingabe und Ausgabe je Aufruf

**Status:** angenommen · **Datum:** 2026-10-28

## Kontext

Der Chat zeigt einen Werkzeug-Aufruf nur als Kurzzeile (`Grep "x" in …`). Aufgeklappt soll er den vollständigen Befehl bzw. die Eingabe und die Ausgabe zeigen. Der Verlauf wird mit `chat_entries::load_all` komplett in den Speicher geladen; [ADR 036](036-ohne-fundstelle.md) hatte Werkzeug-Ausgaben bewusst nicht gespeichert, weil die Datenbank mit jeder gelesenen Datei wüchse.

## Optionen

- **(a) In `ChatEntry` speichern** — verworfen: jeder geladene Verlauf trüge alle Ausgaben im Speicher (Critical Rule 3).
- **(b) Eigene Tabelle `tool_details`, geladen erst beim Aufklappen** — gewählt.
- **(c) Aus Claudes eigenem Transkript nachladen** — verworfen: gilt nur für die Claude-Kommandozeile, nicht für Codex und Autark, und das Transkript gehört nicht dem Verwalter.

## Entscheidung

- Tabelle `tool_details` (Migration 15), eine Zeile je `(session_id, tool_use_id)`, gelöscht mit der Session. Eingabe und Ausgabe schreiben je nur ihre Spalten, die Reihenfolge ist egal.
- **Deckel:** Eingabe 32 KiB, Ausgabe 128 KiB je Aufruf. Bash/PowerShell behalten das Ende der Ausgabe, alle anderen Werkzeuge den Anfang; gekürzt wird an einer Zeichengrenze und als gekürzt gemeldet.
- **Eingabe-Text:** bei Bash/PowerShell der Befehl wie geschrieben, sonst die ganze Eingabe als eingerücktes JSON.
- Der Abgleich aus ADR 036 bekommt weiter die **ungekürzte** Ausgabe; nur die Details sind gekürzt.
- Nur Aufrufe des Hauptagenten; Schritte von Subagenten haben keine Details. Die Archiv-Suche durchsucht die Details nicht.

## Konsequenzen

- Die Datenbank wächst um höchstens 160 KiB je Aufruf; ADR 036 (c) gilt damit nur noch für den Abgleich, nicht mehr für die Anzeige.
- Aufrufe von vor dieser Änderung haben keine Zeile und liefern `missing`.
