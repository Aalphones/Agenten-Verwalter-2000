# Dateien ohne Repository · Seitenleiste nur noch Nebenfragen

Zwei Wünsche aus dem Alltag: (1) Sessions ohne Repository haben keinen Reiter „Dateien“, obwohl die „Session-Dateien“ (Scratchpads, geschriebene und verlinkte Dateien, ADR 071) kein Repository brauchen — dadurch laufen auch Dateilinks im Chat solcher Sessions ins Leere. (2) Die Seitenleiste „Hintergrund“ (Reiter Prozesse, Subagenten, Scratchpad, Nebenfragen) wird nicht genutzt; es bleibt nur „Nebenfragen“, Symbol wird ein Fragezeichen. Beenden und Ausgabe von Prozessen und Subagenten wandern in die aufklappbare Verlaufszeile im Chat. Entscheidungen: Nachtrag in ADR 071 (Phase 1), ADR 076 (reserviert, Phase 3 schreibt es).

## Overview

| Phase | Titel | Rating | Modell | Status |
|---|---|---|---|---|
| 1 | Reiter „Dateien“ ohne Repository | standard | sonnet | complete |
| 2 | Verlaufszeile im Chat: aufklappbar mit Ausgabe, Subagent-Text, Beenden, Kopieren | standard | sonnet | complete |
| 3 | Seitenleiste nur Nebenfragen, Fragezeichen, Aufräumen | standard | sonnet | pending |

Reihenfolge ist zwingend: Phase 2 übernimmt Bausteine (`useItemOutput`, `OutputPane`, `stopBackgroundItem`), die Phase 3 sonst mit den Reitern löschen würde.

Entwurf der Verlaufszeile (verbindlich für Phase 2): [artifacts/entwurf-verlaufszeile.html](artifacts/entwurf-verlaufszeile.html) — im Browser öffnen, Entwurfsleiste oben schaltet Zustände, Breite und Thema; Werte aus `src/styles/theme.css`, Texte und Ausgaben erfunden.

## Entscheidungen des Users

- Ohne Repository erscheint „Dateien“ nur, wenn es mindestens eine Session-Datei gibt (wie „Artefakte“).
- Ohne Repository ist die Ansicht schlank: keine Git-Teile, nur Session-Dateien und Betrachter.
- Die Übersicht eines Vorhabens ohne Repository bekommt dieselbe Regel.
- Seitenleiste nur noch Nebenfragen, Kopfzeilen-Symbol Fragezeichen.
- Die Verlaufszeile im Chat für Subagenten und Prozesse wird aufklappbar: Ausgabe sehen, beenden.
- Der Kern schneidet den Text von Subagenten in Reihenfolge mit den Werkzeugaufrufen mit (heute bleibt nur der letzte).

## Von mir gesetzt

| Entscheidung | Grund |
|---|---|
| Ohne Repository lädt die Session-Datei-Liste neu, wenn sich der Status der Session ändert | Bisher hängt das Nachladen am Stempel der Changes, der ohne Repository nie wechselt |
| Strg P und `/files` bleiben repo-gebunden | Ohne Repository nichts zu durchsuchen; das Menü kennt die Dateizahl nicht |
| Ansicht der Umsetzung bleibt unverändert | Umsetzungen laufen auf Repositories |
| Kopfzeilen-Knopf heißt „Nebenfragen“ mit deren Zahl; Lauf-Punkt und Prozess-Zähler entfallen | Die Leiste zeigt keine Prozesse mehr |
| Kern-Befehle `scratchpad_list`/`scratchpad_read` werden entfernt; `background_output`/`background_stop` bleiben | Kein toter Code; der Chat nutzt die beiden anderen |
| „Im Chat besprechen“ entfällt für Prozesse und Subagenten | Die Zeile steht schon im Chat |
| Weiter genutzte Bausteine bleiben in `src/features/background/` | Umzug ohne Nutzen |

## Finale AK

- Eine Session ohne Repository mit mindestens einer Session-Datei zeigt den Reiter „Dateien“ in schlanker Form; Dateien lassen sich öffnen; Dateilinks im Chat öffnen sie.
- Sessions und Übersichten mit Repository sehen aus wie vorher.
- Die Verlaufszeile eines Prozesses/Subagenten im Chat klappt auf, zeigt Ausgabe bzw. Schritte und Ergebnis und kann einen laufenden Eintrag beenden.
- Die Seitenleiste zeigt nur Nebenfragen; der Knopf trägt ein Fragezeichen und „Nebenfragen“.
- `pnpm check` grün; keine Verweise mehr auf gelöschte Dateien; Code-Map, Glossar, ADR 071 (Nachtrag) und ADR 076 nachgezogen.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
