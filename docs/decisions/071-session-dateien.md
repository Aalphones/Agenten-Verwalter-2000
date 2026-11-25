# 071 — Session-Dateien: jede Datei einer Session im Reiter „Dateien“, Ansehen ohne Grenze, Ausführen gesperrt

**Status:** angenommen · **Datum:** 2026-11-25

## Kontext

Agenten verlinken im Chat Dateien, die in keinem Repository liegen: im Scratchpad der Session, im eigenen Scratchpad der Kommandozeile unter `%TEMP%`, unter Downloads oder in den Projektordnern der Kommandozeile. Ein Klick darauf scheiterte mit „Liegt in keinem Repository des Vorhabens“ oder „Liegt außerhalb des Vorhabens“ (ADR 023, ADR 067); Skripte (`.sh`) wurden absichtlich nicht ans Standardprogramm gegeben. Der Reiter „Dateien“ kennt nur Git-Repositories. Video, Ton, PDF und Bilder über 2 MB zeigte die App gar nicht. Gemessen am 2026-11-25: Scratchpads eines Vorhabens mit 0 bis 1.401 Dateien; `session_files` erfasst geschriebene Dateien schon ohne Ortsfilter.

## Optionen

- **Was sichtbar wird:** (a) nur der Ordner des Vorhabens — verworfen: verfehlt `%TEMP%` und Downloads; (b) geschriebene Dateien und beide Scratchpads, nur genannte Pfade bleiben gesperrt — empfohlen, nicht gewählt; (c) zusätzlich jede im Chat verlinkte Datei — **gewählt** vom Benutzer.
- **Erfassung der Verweise:** (a) beim Klick — zu spät für die Liste; (b) beim Eintreffen jeder Antwort im Kern, ältere Sessions einmal nachgelesen — gewählt; (c) die Oberfläche meldet gerenderte Links — verworfen: hinge an dem, was gerade sichtbar ist.
- **Ansehen:** (a) Bild und Video direkt im Fenster der App — verworfen: Inhalt des Agenten im Fenster mit App-Rechten (ADR 047); (b) Betrachter der Artefakte im abgeschotteten Rahmen über eine eigene Adresse des Artefakt-Servers — gewählt, auch für Dateien in Repositories.
- **Standardprogramm:** (a) Erlaubnisliste wie ADR 023 — verworfen: der Knopf soll an jeder Datei stehen; (b) Ausschlussliste ausführbarer Typen, im Reiter „Dateien“ und „Artefakte“ — gewählt; (c) keine Sperre — verworfen.

## Entscheidung

- Im Reiter „Dateien“ steht unter den Repositories der Knoten **„Session-Dateien“**: je Session des Vorhabens die Orte Scratchpad, Scratchpad Kommandozeile und Weitere Orte. Dateien in Repositories und in `.artefakte` stehen dort nicht noch einmal.
- **Verweise** (absolute Pfade aus Inline-Code und Markdown-Link-Zielen, Erkennung wie `filePathOf`) landen beim Eintreffen der Antwort in `session_links` (Migration 22); Sessions von vorher werden beim ersten Laden der Liste nachgelesen. Der Scratchpad der Kommandozeile steht in `sessions.cli_scratchpad_dir`.
- **Ansehen hat keine Ortsgrenze mehr** für Dateien, die eine Session des Vorhabens geschrieben, im Scratchpad liegen hat oder verlinkt hat; ein Dateilink trägt die Datei beim Klick als verlinkt ein. Was nur irgendwo existiert, aber nie genannt wurde, bleibt unerreichbar.
- Dateilinks: `.artefakte` → Reiter „Artefakte“; HTML im Vorhaben → Standardprogramm; Repository → `View`; sonst → `SessionFile`. PDF öffnet in der App.
- **Betrachter-Adresse** `/<token>/~datei/<handle>/<name>`: zufälliger Handle je geprüfter Datei, eigener CSP-Bereich, für Artefakt-Seiten nicht erreichbar. Rohdateien beantworten `Range`.
- **„Mit Standardprogramm öffnen“** ist für Typen aus `file_links::EXECUTABLE_EXTENSIONS` (und unter Unix für Dateien mit Ausführungsbit) gesperrt, in Oberfläche und Kern, auch für Artefakte.

Löst ab: in ADR 023 die Sicherheitsgrenze „nur im Vorhaben“ für das Ansehen (für `file_link_open` bleibt sie); in ADR 067 „Dateilinks … HTML und PDF weiter ins Standardprogramm“ für PDF und die Bildvorschau per `data:`-Adresse mit 2-MB-Grenze.

## Konsequenzen

- Jede im Chat genannte Datei ist per Klick lesbar, auch eine mit Zugangsdaten; der Agent konnte sie zuvor schon lesen und ausgeben.
- Dateien, die ein Agent per Shell außerhalb der Scratchpads erzeugt und nie verlinkt, bleiben unsichtbar.
- Große Scratchpads werden bei jedem Laden der Liste gelesen, gedeckelt bei 2.000 Einträgen und 6 Ebenen.
- Die Ausschlussliste kann einen exotischen ausführbaren Typ übersehen; sie wird ergänzt, sobald einer auffällt.
- Der Scratchpad der Kommandozeile liegt unter `%TEMP%` und kann von Windows geleert werden; die Liste zeigt seine Dateien dann nicht mehr.
