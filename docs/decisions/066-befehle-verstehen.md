# 066 — Befehle verstehen: Beschreibung des Agenten, Laufzeit-Gedächtnis, Fortschritt aus der Ausgabedatei

**Status:** angenommen · **Datum:** 2026-11-17

## Kontext

Die Statuszeile und die Werkzeug-Zeilen zeigen bei Shell-Aufrufen den rohen Befehl; bei langen Läufen (in 14 Tagen 2684 Vordergrund-Befehle ab 10 s, 833 ab 60 s) ist weder erkennbar, was läuft, noch wie lange es dauert. Gemessen an Claude Code 2.1.322: jeder Bash- und PowerShell-Aufruf trägt ein `description`; die Ausgabe eines Vordergrund-Befehls erscheint während des Laufs nicht im Protokoll-Strom, wird aber ab etwa 2 s Laufzeit laufend in `<Elternordner von scratchpad_path>\tasks\<task_id>.output` geschrieben. Dieselbe Meldung (`task_started` mit `is_backgrounded: false`) ließ den Verwalter jeden solchen Befehl zusätzlich als Hintergrundprozess führen.

## Optionen

- **Beschreibung:** (a) das `description` des Agenten anzeigen — gewählt; (b) je Befehl ein eigener Modell-Aufruf — verworfen: Kontingent und Verzögerung für etwas, das schon geliefert wird; (c) Regel-Katalog je Befehl — verworfen: veraltet mit jedem Werkzeug.
- **Fortschritt:** (a) die Ausgabedatei der Kommandozeile lesen — gewählt; (b) Befehle umschreiben und die Ausgabe selbst mitschneiden — verworfen: ändert, was der Agent ausführt, und trifft Exit-Codes und PowerShell unterschiedlich; (c) lange Läufe in den Hintergrund zwingen — verworfen: ändert den Ablauf des Agenten.
- **Restdauer:** (a) Median der letzten erfolgreichen Läufe desselben Befehls, Hochrechnung bei erkanntem Fortschritt — gewählt; (b) Durchschnitt über alle Läufe — verworfen: Ausreißer wirken lange nach.

## Entscheidung

- Die Beschreibung reist als eigenes Feld neben dem Befehl (`ChatEntry::Tool.description`, `BackgroundItem.description`); der Befehl bleibt gespeichert und bleibt Grundlage für eigene Fächer der Figurenpakete. Ein Absatz im gemeinsamen Systemprompt verlangt die Beschreibung auf Deutsch und in selbst geschriebenen Skripten eine Zeile `[erledigt/gesamt] …` je Schritt.
- Ein Vorgang der Kommandozeile zu einem Vordergrund-Befehl gehört zum vorhandenen Eintrag (`BackgroundItem.task_id`); wandert der Befehl in den Hintergrund, wechselt derselbe Eintrag die Art.
- Fortschritt und letzte Zeile liest ein Wächter je laufendem Eintrag einmal je Sekunde aus den letzten 4 KB der Ausgabedatei; erkannt werden Zählungen `n/m` und Prozentwerte. Der Stand lebt nur im Speicher und im Session-Stand (`running_command`, `awaited_script`), nicht in der Datenbank.
- Laufzeiten stehen in `command_runs` (Migration 021) unter dem SHA-256 des vereinheitlichten Befehls und dem Vorhaben; gemerkt werden erfolgreiche Läufe ab 3 s, je Schlüssel und Vorhaben die letzten 10; geschätzt wird der Median der letzten 5, erst im Vorhaben, sonst über alle.
- Anzeige: gemessener Fortschritt als voller Balken mit Zahl, Schätzung schraffiert mit „üblich ~m:ss“, Überziehen schraffiert in Warnfarbe mit den Worten „länger als üblich“.
- Figurenpakete: vorgegebenes Fach `longrun` und die Bewegungen `trek`, `charge`, `reveal`; Platzhalter `{befehl}`, `{fortschritt}`, `{rest}`, `{zeit}` auch bei Befehlen; `{ziel}` ist bei Shell-Befehlen die Beschreibung.
- Verlauf: Ein Absatz im Systemprompt bittet den Agenten vor jeder Folge von Werkzeug-Aufrufen um eine kurze Zeile zum Zweck (höchstens sechs Wörter). Die Oberfläche macht einen Text von höchstens 80 Zeichen direkt vor einem Werkzeug-Block zu dessen Kopf und ersetzt „n Aufrufe“ durch eine Zeile, die je Art zählt, was getan wurde. Beides entsteht beim Anzeigen und wird nicht gespeichert. Verworfen: je Block ein eigener Modell-Aufruf (kostet Kontingent und deutet, statt die Absicht zu zeigen); der Gedankengang als Quelle (fast immer leer gespeichert).

## Konsequenzen

- Ort und Verhalten der Ausgabedatei sind nicht dokumentiert. Ändert die Kommandozeile sie, entfällt der Live-Fortschritt ohne Fehler; Beschreibung und Schätzung bleiben. Gemessen nur unter Windows.
- Live-Fortschritt gibt es nur in der Betriebsart Claude; Autark und Codex zeigen Beschreibung (soweit geliefert) und Schätzung.
- Programme, die ihre Ausgabe puffern, zeigen bis zum Ende „noch keine Ausgabe“.
- Die Erkennung kann eine Zählung in der Ausgabe für Fortschritt halten, die keiner ist; der Balken kann springen.
- Ein anderer Ordner im Befehl (`cd …`) ist ein anderer Schlüssel; in Ticket-Worktrees beginnt das Gedächtnis je Ordner neu.
- Das Wozu eines Schritts steht nur da, wenn der Agent die Zeile schreibt; alte Sessions zeigen es nur, wo zufällig eine so kurze Zeile davorsteht. Die Figur im Verlauf ist die des heute aktiven Pakets.
- Pakete mit dem neuen Fach oder den neuen Bewegungen lassen sich in älteren Versionen nicht importieren.
