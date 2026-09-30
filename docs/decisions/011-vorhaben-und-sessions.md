# 011 — Vorhaben und Sessions: eine äußere Einheit, darin Claude-Sessions mit frischem Kontext

**Status:** angenommen · **Datum:** 2026-09-30

## Kontext

Bisher war die Session die zentrale Einheit: eine Aufgabe, ein Agent, ein Chat, eine Claude-Session. Ein Plan mit sechs Phasen lief damit in einer einzigen Claude-Session und wurde zwischen den Phasen mit `/clear` geleert. Danach war der alte Verlauf im Chat noch zu sehen, aber nicht mehr fortsetzbar, und der Chat einer Phase ließ sich nicht von dem der nächsten trennen. Gewollt ist: eine Aufgabe über mehrere Phasen, je Phase ein frischer Kontext, alte Phasen bleiben lesbar und fortsetzbar, Workspace, Repositories und Changes bleiben gemeinsam.

## Optionen

- **(a) Session bleibt die Einheit, der Agent wechselt innerhalb:** eine Session hält mehrere Claude-Session-IDs nacheinander. Chat, Status und Kontext müssten je Agent-Abschnitt getrennt werden; das Datenmodell bekommt eine versteckte zweite Ebene.
- **(b) Neue äußere Ebene „Vorhaben“, die Session bleibt die Claude-Session:** Vorhaben tragen Name, Workspace, Repositories und Changes; jede Session ist genau eine Claude-Session mit eigenem Chat.
- **(c) Die äußere Ebene heißt weiter „Session“, die innere bekommt einen neuen Namen:** jeder bestehende Begriff im Code und in der Doku verschöbe seine Bedeutung.

## Entscheidung

**(b).** Gegen (a) spricht die versteckte Ebene; gegen (c), dass „Session“ dann nicht mehr die Session der Claude-Kommandozeile wäre.

- **Namen:** „Vorhaben“ in der Oberfläche, `project` im Code (`src-tauri/src/projects/`, `commands/projects.rs`, `db/projects.rs`, `src/lib/projects.ts`, Tabelle `projects`). Das Wort „Projekt“ erscheint nie in der Oberfläche. Die Session bleibt `session`; ihre ID ist die `--session-id`/`--resume`-ID. Status, Chat, Prozess, Hintergrund, Kontext, Modell, Modus und Denkaufwand gehören weiter der Session. Sessions sind im Vorhaben durchnummeriert (`number`, ab 1, angezeigt als `#N`).
- **Datenmodell:** Tabelle `projects`; `sessions` bekommt `project_id` und `number`. Die Migration macht jede bestehende Session zu einem Vorhaben mit derselben ID, demselben Namen, derselben Anlagezeit und demselben Archiv-Stand; die Session bekommt `number = 1`.
- **Gemeinsam im Vorhaben:** derselbe Workspace-Ordner (benannt nach der Vorhaben-ID) und dieselben Repositories samt Basis. Die Changes gehören dem Vorhaben: Ticket-Worktrees aller seiner Sessions erscheinen in den Changes jeder seiner Sessions.
- **Archivieren** nur für das ganze Vorhaben; **Umbenennen** für Vorhaben und Sessions getrennt.
- **Neue Session im Vorhaben:** neuer Status „Neu“ (angelegt, Agent nie gestartet); höchstens eine solche Session je Vorhaben; die erste Nachricht startet den Agenten mit frischem Kontext. Alte Sessions bleiben frei fortsetzbar, auch während eine neuere läuft.
- **Sperren im Core:** Die Sperre der Vorhaben (`SessionRegistry.projects`) und die Sperre einer Session werden nie gleichzeitig gehalten (einzige Ausnahme: eine neue, noch unveröffentlichte Session, siehe „Repository nachträglich anhängen“).

## Konsequenzen

- Alle Sessions eines Vorhabens teilen Workspace und Haupt-Checkouts. Die App verhindert nicht, dass zwei Agenten desselben Vorhabens gleichzeitig im selben Haupt-Checkout arbeiten.
- Die Oberfläche fragt die Changes weiter über eine Session-ID; der Core löst sie zum Vorhaben auf.
- Einzelne Sessions lassen sich nicht archivieren; ein Vorhaben verschwindet nur als Ganzes.
- Im Code heißt die Einheit `project`, in der Oberfläche „Vorhaben“ — wer zwischen beiden übersetzt, benutzt das Glossar.

## Repository nachträglich anhängen

**Kontext:** Changes und Diff gibt es nur für Repositories, die beim Anlegen gewählt wurden. Wer ohne Repository startet und den Agenten trotzdem in einem Repository arbeiten lässt, sieht nie einen Diff.

**Betrachtete Optionen:** (a) Repositories nur beim Anlegen wählen, wie bisher; (b) pro Session anhängen; (c) pro Vorhaben anhängen.

**Entscheidung:** (c). „+ Repository“ in der Übersicht hängt ein bekanntes Repository an jede Session des Vorhabens (`project_add_repository`), mit Haupt-Checkout (ADR 010) und derselben Position in allen Sessions; neue Sessions erben es. Die Basis ist der letzte Commit auf dem ersten-Eltern-Pfad von HEAD vor dem Anlegen des Vorhabens (`git rev-list -1 --first-parent --before=<Sekunden> HEAD`, ohne Treffer der ausgecheckte Stand), damit die Changes alles seit Beginn des Vorhabens zeigen. Ein arbeitender Agent wird nie unterbrochen: er kennt das Repository erst nach seinem nächsten Start. Ein ruhender Agent wird beendet; die nächste Nachricht startet ihn mit `--resume` und dem neuen `--add-dir`. Ruht ein Agent, der beim Anhängen noch arbeitete, erst später, startet ihn die nächste Nachricht ebenfalls neu. Kein Entfernen: die Positionen der Ticket-Worktrees hängen an der Reihenfolge der Repositories; wer sich vertan hat, archiviert das Vorhaben.

**Konsequenzen:**

- `Session.repositories` ist veränderlich, hinter einer eigenen `RwLock`, die nur kurz und nie über einen Aufruf hinweg gehalten wird.
- `add_repository` hält die Vorhaben-Sperre, bis das Repository in Datenbank und Speicher steht; `create_in_project` hält sie vom Lesen der Repositories bis zum Eintrag der neuen Session. So verpasst keine gleichzeitig angelegte Session das Repository. Unter der Vorhaben-Sperre wird dabei nur die Sperre der neuen, noch unveröffentlichten Session genommen — die kennt niemand sonst.
- Uncommittete Änderungen, die schon vor dem Start des Vorhabens im Ordner lagen, erscheinen als Änderungen des Vorhabens; der Tooltip des Knopfs sagt das.

## TL;DR

**Kontext:** Wer zwischen Sessions und Vorhaben wechselt, muss sofort sehen, woran dort gearbeitet wird — ohne den Verlauf zu lesen.

**Betrachtete Optionen:** (a) die Session selbst fortsetzen und nach einer Zusammenfassung fragen; (b) ein abgespeckter Einmal-Aufruf der Kommandozeile mit dem Gesprächstext als Eingabe; (c) automatisch nach jeder Antwort zusammenfassen.

**Entscheidung:** (b), nur per Knopf.

- **Nur per Knopf**, nie automatisch: jedes TL;DR kostet einen Aufruf, und ein automatisches würde bei jeder Antwort veralten. Die Karte zeigt, wie viele Einträge seither dazugekommen sind.
- **Haiku, Einmal-Aufruf statt Fortsetzen:** Fortsetzen lädt 110 k bis 650 k Tokens Kontext und passt ab 200 k nicht in Haiku. Der Einmal-Aufruf läuft ohne Werkzeuge, MCP-Server und Transkript im Druckmodus und liefert eine Antwort nach festem Schema (Kommando und Messung: [claude-stream-json.md](../knowledge/claude-stream-json.md), „Einmal-Aufruf im Druckmodus“). Zeitlimit 90 s.
- **Eingabe für eine Session:** nur der Gesprächstext — Nachrichten, Antworten, Rückfragen samt Antwort, Fehler, letzte Aufgabenliste; keine Werkzeug-Aufrufe, kein Gedankengang. Obergrenze 300 000 Zeichen; darüber bleiben die erste Nachricht (bis 20 000 Zeichen) und das Ende, die Mitte fällt weg und wird markiert.
- **Vorhaben aus Session-TL;DRs:** das TL;DR des Vorhabens entsteht nur aus den TL;DRs seiner Sessions. Fehlende erstellt derselbe Klick vorher mit, veraltete nimmt er, wie sie sind.
- **Gespeichert** als JSON in `sessions.tldr*` bzw. `projects.tldr*`; ein laufender Lauf und sein Fehler liegen nur im Speicher.
- **Stand des Vorhabens für die neue Session:** die erste Nachricht einer Session im Status „Neu“ nimmt das TL;DR des Vorhabens mit, solange der Haken der Einstiegsansicht gesetzt ist. Der Stand steht vor der Nachricht; beginnt sie mit einem `/`-Befehl, steht er dahinter, weil die Kommandozeile einen Befehl nur am Anfang erkennt. Der Name der Session entsteht aus dem getippten Text.

**Konsequenzen:**

- Kosten je Session-TL;DR (API-Preise; beim Abo aus dem Kontingent): gemessen 1,2 Cent für den Verlauf mit den meisten Einträgen, bis 33 Cent für ein Transkript an der Obergrenze — Haiku denkt mit, und die Kommandozeile schreibt die Eingabe in den teureren 1-Stunden-Cache.
- Ein Lauf blockiert weder den Chat noch den Agenten der Session; Beginn und Ende meldet `tldr://changed`. Kein Lauf hinterlässt einen Prozess: der Einmal-Aufruf wird nach Antwort, Fehler oder Zeitlimit immer beendet.
- Zustand und Läufe liegen in `sessions/registry/tldr.rs` (Kindmodul der Registry, damit es an die Zustände kommt, ohne `registry.rs` weiter zu vergrößern).
