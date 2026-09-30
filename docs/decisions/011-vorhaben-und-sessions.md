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
- **Sperren im Core:** Die Sperre der Vorhaben (`SessionRegistry.projects`) und die Sperre einer Session werden nie gleichzeitig gehalten.

## Konsequenzen

- Alle Sessions eines Vorhabens teilen Workspace und Haupt-Checkouts. Die App verhindert nicht, dass zwei Agenten desselben Vorhabens gleichzeitig im selben Haupt-Checkout arbeiten.
- Die Oberfläche fragt die Changes weiter über eine Session-ID; der Core löst sie zum Vorhaben auf.
- Einzelne Sessions lassen sich nicht archivieren; ein Vorhaben verschwindet nur als Ganzes.
- Im Code heißt die Einheit `project`, in der Oberfläche „Vorhaben“ — wer zwischen beiden übersetzt, benutzt das Glossar.

## TL;DR

Kommt mit Phase 5 dieses Plans.
