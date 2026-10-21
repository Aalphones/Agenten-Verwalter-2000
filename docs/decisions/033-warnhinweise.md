# 033 — Warnhinweise

**Status:** angenommen · **Datum:** 2026-10-21

## Kontext

Die Claude-Kommandozeile liefert Zeilen, die der Verwalter bisher wegwarf: Cache-Angaben je Antwort, Kontingent-Ereignisse, Zusammenfassungen des Verlaufs, Hinweise, Modell-Ausweichen, abgelehnte Werkzeugaufrufe und Kosten. Dazu kommt, was er selbst ausrechnen kann, etwa ob der Prompt-Cache noch warm ist. Eine Nachricht an eine Session, deren Cache abgelaufen ist oder die das Modell gewechselt hat, schreibt den ganzen Verlauf neu und kostet entsprechend — davor warnt bisher nichts. Gemessen am 2026-10-21 mit Claude Code 2.1.293: jede Antwort trägt `cache_creation` mit Haltedauer, gemessen nur 1 Stunde; die Grundlast einer frischen Session liegt bei rund 64 000 Token.

## Optionen

- **Ort des Cache-Zustands:** (a) Core mit Zeitgeber je Session; (b) nur die Oberfläche; (c) der Core speichert die Messwerte, die Oberfläche rechnet mit der Uhrzeit.
- **Eintragsart im Verlauf:** (a) `ChatEntry::Error`; (b) eine eigene Art je Hinweis; (c) eine Art `Notice` mit Unterarten.
- **Betriebsarten:** (a) Cache-Anzeige überall; (b) nur dort, wo ein Claude-Abo läuft.

## Entscheidung

- **Nur Betriebsart „Claude“ (b).** Cache, Kosten, Kontingent live und Modell-Ausweichen gelten nur, wenn der laufende Prozess die Claude-Kommandozeile mit dem Claude-Abo ist (`SessionState::is_claude_process`). In „Claude Code + LM Studio“, „Autark“ und „Codex“ bleiben diese Werte leer. LM Studio ist ausgenommen, weil die Wiederverwendung des Prompt-Anfangs dort keine Haltedauer hat und nichts kostet.
- **Core speichert, Oberfläche rechnet (c).** Der Core hält je Session einen `PromptCache` (Anker, Haltedauer, Token, Modell, Zeitpunkt einer Zusammenfassung) und schickt ihn in `SessionSummary.prompt_cache`; „warm / kalt / neu“ rechnet die Oberfläche mit der aktuellen Uhrzeit. Ein Zeitgeber je Session (a) wäre Aufwand für eine reine Anzeige; nur in der Oberfläche (b) wäre die Warnung nach einem App-Neustart weg — genau dann, wenn sie bei einer Session vom Vortag am meisten zählt.
- **Gespeichert als JSON** in der Spalte `sessions.prompt_cache` (Migration 12). Unlesbares JSON gilt als nicht vorhanden, nicht als Fehler.
- **Anker = Eingang der ersten Zeile einer Antwort.** Eine Antwort (`message.id`) kommt in mehreren `assistant`-Zeilen; der Anker wird nur bei einer neuen `message.id` gesetzt, Token und Haltedauer bei jeder Zeile aktualisiert. Es zählen nur Zeilen des Hauptagenten mit Cache-Angaben. Haltedauer: 1-Stunden-Einträge geschrieben → 1 Stunde, sonst 5-Minuten-Einträge → 5 Minuten, sonst die bisherige, beim ersten Mal 5 Minuten (die kürzere ist die vorsichtige Annahme). Ein Prozessstart vergisst die `message.id`, damit die erste Zeile des neuen Prozesses den Anker neu setzt.
- **Kalt** heißt: Haltedauer seit dem Anker abgelaufen, oder das Modell der Session ist ein anderes als das des Caches. **Neu** heißt: seit der letzten Zusammenfassung kam keine Antwort mit Cache-Angaben; `compact_boundary` setzt dafür `compacted_at`, die nächste Antwort mit Cache-Angaben löscht es.
- **Eine Eintragsart `Notice` (c)** für alle Hinweise im Verlauf; Phase 4 legt sie an. Ein `Error`-Eintrag (a) hätte die falsche Farbe und die Logik „Agent neu starten“; eine Art je Hinweis (b) brächte sieben Zweige in jedes `match` über `ChatEntry` (Archiv-Suche, TL;DR-Text, Retro).

## Konsequenzen

- Die Cache-Pille zeigt nach einem App-Neustart den richtigen Zustand, ohne dass im Hintergrund etwas läuft.
- Die Anzeige nimmt an, dass ein beendeter und mit `--resume` neu gestarteter Agent den Cache innerhalb der Haltedauer weiter trifft. Stimmt das nicht, zeigt die Pille fälschlich „warm“ (Smoke 1 des Plans prüft es); Abhilfe wäre, das Prozessende den Cache auf kalt setzen zu lassen.
- Jede Antwort in „Claude“ schreibt die Session-Zeile neu, wenn sich Anker oder Token geändert haben.
- Die Haltedauer ist nur für 1 Stunde gemessen; 5 Minuten ist die vorsichtige Annahme, wenn die Zeile keine Angabe trägt, und nicht gemessen.
