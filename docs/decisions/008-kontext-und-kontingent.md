# 008 — Kontext und Kontingent anzeigen: Steueranfragen der Kommandozeile, Hilfsprozess fürs Kontingent

**Status:** angenommen · **Datum:** 2026-09-30

## Kontext

Die Session-Kopfzeile zeigt bisher nur einen Kontext-Balken (belegt / Fenster). Gebraucht werden eine Aufschlüsselung, was den Kontext belegt, und das Kontingent des Claude-Abos (5-Stunden- und Wochenfenster samt Verbrauchs-Treibern) — wie in den Fenstern „Context usage“ und „Account & Usage“ der VS-Code-Erweiterung. Die Protokoll-Fakten stehen in [claude-stream-json.md](../knowledge/claude-stream-json.md), Abschnitt „Kontext und Kontingent abfragen“. Randbedingung: Die UI zeigt, was die Kommandozeile meldet, nie eigene Schätzungen (AGENTS.md, Regel 2).

## Optionen

- **Kontext:** (a) eigene Rechnung aus den `usage`-Zeilen; (b) Steueranfrage `get_context_usage` an den Agenten der Session.
- **Speicher der Aufschlüsselung:** (a) SQLite; (b) nur im Speicher des Core.
- **Kontingent:** (a) kurz gestarteter Hilfsprozess mit `get_usage`; (b) Anfrage an den Agenten einer laufenden Session; (c) die `rate_limit_event`-Zeilen mitlesen.

## Entscheidung

- **Kontext: (b).** Die Kommandozeile kennt die Kategorien (Systemprompt, Werkzeuge, Memory-Dateien, Skills, Nachrichten); eine eigene Rechnung könnte sie nicht nachbilden. Der Core fragt am Ende jeder Antwort (`TurnEnded`, außer nach Abbrechen) und auf Wunsch der Oberfläche, solange der Agent zuhört.
- **Speicher: (b).** Die Aufschlüsselung ist ein Zwischenstand; nach einem App-Neustart zeigt das Fenster bis zur nächsten Antwort nur die Zahlen des Balkens. Ein beendeter Agent (Ruhe-Timer) lässt die letzte Aufschlüsselung stehen.
- **Kontingent: (a).** Ein `claude.exe` mit `--strict-mcp-config --no-session-persistence` im Arbeitsverzeichnis `<Benutzerordner>\.verwalter` beantwortet eine einzige Anfrage `get_usage` (rund 1,4 s) und wird beendet. Zeitlimit 20 s, nie zwei Abrufe gleichzeitig, ohne `force` höchstens ein Abruf je 30 s. (b) scheidet aus, weil es ohne laufenden Agenten nichts liefert und einen zweiten Weg für dieselbe Zahl bräuchte; (c) scheidet aus, weil der Inhalt der Zeilen nicht belegt ist.
- **Nachsichtiges Lesen:** `get_usage` ist im SDK als experimentell markiert; jedes Feld ist optional, ein unlesbares Feld ist leer, nie ein Fehler der ganzen Antwort.
- **Namen:** Feature `context` (Kontext-Aufschlüsselung je Session) und Feature `usage` (Kontingent des Abos); in der Oberfläche heißt Usage „Kontingent“.

## Konsequenzen

- Das Format beider Antworten kann sich mit jeder Claude-Version ändern; das Lesen ist darauf ausgelegt, eine Änderung als fehlende Anzeige statt als Absturz zu zeigen.
- Der Hilfsprozess kostet rund 1,4 s und einen kurzlebigen Prozess je Abruf; die Oberfläche fragt deshalb nur beim Einblenden der Kopfzeile, beim Öffnen des Fensters und alle 5 Minuten bei sichtbarem App-Fenster.
- Die Aufschlüsselung überlebt keinen Neustart.
- In einer lokalen Betriebsart keine Kontingent-Abfrage ([ADR 016](016-betriebsarten-und-lokales-modell.md)).
