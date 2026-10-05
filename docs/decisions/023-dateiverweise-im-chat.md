# 023 — Dateiverweise im Chat

**Status:** angenommen · **Datum:** 2026-10-05

## Kontext

Agenten nennen in ihren Antworten Dateien, die der Benutzer ansehen soll — in facepass etwa die Change-Übersichten unter `reports/`, die ungetrackt liegen und in den Changes nicht auftauchen. Bisher musste der Benutzer sie im Explorer suchen. Ein Klick auf den Pfad soll die Datei mit dem Standardprogramm von Windows öffnen. Der Pfad stammt aus einer Agenten-Antwort, also aus fremdem Text: Das Standardprogramm von `.cmd`, `.exe` oder `.lnk` führt die Datei aus.

## Optionen

- (a) Öffnen im Core per Befehl `file_link_open`, der Endung und Sicherheitsgrenze selbst prüft;
- (b) `openPath` aus dem Opener-Plugin im Frontend mit einer Capability mit Pfad-Scope;
- (c) beim Rendern je Pfad im Core nachfragen, ob er existiert, und nur dann einen Link zeigen.

## Entscheidung

- **(a).** Die Capability von (b) kennt die Ordner des Vorhabens nicht, und die Prüfung säße in der Oberfläche statt im Core (AGENTS.md Regel 2 und 5). (c) kostet bei langen Verläufen hunderte Aufrufe; die Oberfläche erkennt Kandidaten nur am Muster, der Klick prüft.
- **Nur Anzeige-Formate:** `html`, `htm`, `pdf`, `svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `md`, `txt`. Maßgeblich ist `file_links::OPENABLE_EXTENSIONS` im Core; `src/lib/fileLinks.ts` spiegelt die Liste nur für die Darstellung. Geprüft wird die Endung des genannten und des kanonischen Pfads (ein Link `x.html` auf eine exe öffnet nicht); ein Doppelpunkt hinter dem Laufwerk (Datenstrom `x.exe:y.html`) wird abgelehnt.
- **Sicherheitsgrenze:** Workspace des Vorhabens, Arbeitsordner und Haupt-Checkout jedes Repositorys und alle Einträge der Changes des Vorhabens (Ticket-Worktrees, innere Repositories und deren Ticket-Worktrees). Geprüft nach `fs::canonicalize` mit `starts_with`, damit weder `..` noch ein symbolischer Link hinausführt.
- **Relative Pfade** gegen die Arbeitsordner der Repositories in Positions-Reihenfolge, zuletzt gegen den Workspace; die erste existierende Datei gewinnt. Ticket-Worktrees brauchen einen absoluten Pfad.
- **Erkannt** wird Inline-Code, dessen ganzer Inhalt ein Pfad mit erlaubter Endung ist, und ein Markdown-Link mit Pfad als Ziel; eine angehängte Zeilennummer `:12` bzw. `:12:5` wird ignoriert. Nicht erkannt: Fließtext, Codeblöcke, Werkzeug-Aufrufe, Denkblöcke.

## Konsequenzen

- Fehler (nicht gefunden, Dateityp, außerhalb des Vorhabens) stehen in der Fehlerleiste der Session; die Oberfläche zeigt einen Link auch für Pfade, die beim Klick scheitern.
- Eine HTML-Datei führt im Browser ihr eigenes JavaScript aus — wie ein Doppelklick im Explorer; sie liegt im Vorhaben. Akzeptiert.
- Weicht die Endungsliste in TS von der in Rust ab, fehlt ein Link oder ein Link scheitert; die Sicherheit hängt allein an Rust.
