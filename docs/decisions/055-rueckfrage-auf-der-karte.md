# 055 — Rückfragen auf der Karte der Station beantworten

**Status:** angenommen · **Datum:** 2026-11-05

## Kontext

Stellt eine Station einer Umsetzung eine Rückfrage (AskUserQuestion) oder eine Rechte-Abfrage, zeigte ihre große Karte nur den Text der ersten Frage und schickte in den Chat: der Kern reichte nur diesen Text durch, und das Antworten blieb beim Bau der Umsetzung bewusst im Chat (Abweichung vom Entwurf, Phase 2 des Plans Umsetzung, [ADR 048](048-umsetzung.md)). Der Rückfrage-Kasten des Chats kann seitdem mehr ([ADR 045](045-rueckfrage-kasten.md)): Ziehharmonika, Ziffern, Notiz je Option, eigene Antwort je Frage.

## Optionen

- **(a) Die Ansicht der Station trägt die Anfrage** — gewählt: der Kern hält die älteste offene Anfrage der Session ohnehin im Speicher, und die Ansicht wird schon bei jeder Änderung einer Station-Session neu geladen.
- **(b) Die Karte lädt die Frage aus dem Verlauf der Session wie der Chat** — verworfen: braucht je Station im Fokus eine Seite Verlauf, ein eigenes Abo auf `chat://entry` und eine zweite Wahrheit darüber, was „offen“ ist.
- **(c) Eine eigene einfache Knopfreihe wie im älteren Entwurf** — verworfen: eine dritte Antwort-Oberfläche neben Chat-Kasten und Rechte-Abfrage wäre Dopplung.

## Entscheidung

- **Datenweg:** `StationView` trägt statt des Fragetexts die ganze älteste offene Anfrage ihrer Session (`OpenQuestion`: `seq`, Anfrage-ID, Art, alle Fragen samt Optionen), nur im Zustand `asking`. Dieselbe Ansicht steht im Datenteil der Werkzeug-Antworten (`implementation_get` u. a.); der Text des Lageberichts bleibt unverändert.
- **Nachzug bei mehreren offenen Anfragen:** `apply_answer` markiert die Zusammenfassung der Session nach jeder Antwort als geändert. Vorher blieb der Status `waiting` und es ging keine Zusammenfassung raus — die Karte zeigte weiter die schon beantwortete.
- **Ein Antwortweg, zwei Orte:** Entwürfe, Senden, Fehlerzeile und Tasten liegen in `useQuestionAnswer` und `useQuestionKeys`; Chat und Karte benutzen sie. Der Kasten selbst bleibt `QuestionBlock` (ADR 045).
- **Entwürfe im Chat-Store** je Session und Anfrage-ID (`questionDrafts`), nicht im Zustand von `ChatTimeline`: eine angefangene Notiz überlebt den Wechsel zwischen Karte und Chat.
- **Nach dem Senden bleibt der Kasten gesperrt**, bis die Ansicht die Anfrage nicht mehr meldet. Dazwischen liegt eine Runde zum Kern; ein zweiter Klick meldete sonst „Rückfrage nicht offen“.
- **Fehler** beim Antworten gehen wie im Chat an die Fehlerzeile der Session (`sessionErrors`); die Karte zeigt sie unter dem Kasten (`SessionActionError`).
- **Tasten:** Ziffern 1–9 und Enter wirken auf der Karte wie im Chat, solange die Karte mit offener Anfrage sichtbar ist. Chat und Umsetzung sind nie gleichzeitig gemountet; Tasten in Textfeldern und Enter auf Knöpfen bleiben unberührt (`keyTargets`).
- **Der Satz „Oder schreib unten eine eigene Antwort.“** steht nur im Chat (`showsComposerHint`) — darunter liegt die Eingabeleiste.

## Konsequenzen

- Eine Rückfrage lässt sich beantworten, ohne den Chat der Station zu öffnen; die Karte wächst mit dem Kasten in die Höhe, die Kartei rollt.
- `implementation_get` liefert dem Agenten im Datenteil im Zustand `asking` die ganze Anfrage statt nur ihres Texts.
- Nach jeder Antwort geht eine Zusammenfassung der Session raus, auch wenn der Status gleich bleibt.
- Keine Migration: die Ansicht der Umsetzung wird nicht gespeichert.
