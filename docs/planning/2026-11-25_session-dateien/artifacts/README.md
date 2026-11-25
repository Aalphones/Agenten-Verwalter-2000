# Entwurf Session-Dateien

Der Entwurf ist verbindlich für Aufbau, Beschriftungen, Abstände und Zustände. Farben, Schrift und Radien stammen aus `src/styles/theme.css` (übernommen aus dem Entwurf der Dateien-Ansicht, `docs/archive/2026-11/2026-11-18_dateien-ansicht/artifacts/`); im Entwurf stehen sie als feste Werte, in der Umsetzung gelten die Tokens.

## Dateien

| Datei | Inhalt | Phase |
|---|---|---|
| `entwurf-session-dateien.html` | Klickdummy: Reiter „Dateien“ mit Knoten „Session-Dateien“ und Datei-Ansicht je Typ, Chat mit Dateilinks, Ausschnitt des Reiters „Artefakte“ mit Sperre | 4, 5 |
| `_entwurf-session-dateien/beispielbild.png` | Beispielbild für die Bild-Ansicht (Kopie von `01-uebersicht.png` aus dem Entwurf der Dateien-Ansicht) | 5 |

## Ansehen

`entwurf-session-dateien.html` im Browser öffnen, ohne Netz und ohne Datendatei. Die Leiste oben schaltet Bildschirm (Chat, Dateien, Artefakte), Zustand (Normal, Lädt, Fehler, Leer) und Thema; „Wofür“ nennt Aufgabe und Regeln. Jeder Zustand hat eine Adresse hinter `#`: `v=files|chat|arts`, `f=<Datei-ID>` (z. B. `f4` Skript, `f1` Bild, `f5` Video, `f10` PDF, `f7` Markdown, `f6` gelöscht, `f16` HTML, `f14` ohne Ansicht, `r2` Video im Repository), `md=preview`, `z=loading|error|empty`, `a=cmd` (Artefakt `pruefen.cmd`), `th=light|dark`.

## Was Beispiel ist

- Echt: Ordnerstruktur, Dateinamen und Anzahlen der Scratchpads eines Vorhabens (1.401 und 450 Dateien), Inhalt von `nachweis-labor01.sh` (Rechner-, Namensraum- und Ticketnamen ersetzt).
- Beispiel: Session-Nummern und -Namen, Benutzername in Pfaden, Video, PDF, Dateien unter Downloads/Dokumente, Uhrzeiten, Inhalt von Markdown, Logs und `pruefen.cmd`.
- Video und PDF sind gezeichnete Platzhalter; in der App zeigt sie der Betrachter der Artefakte.

## Nicht gezeichnet

Tastaturbedienung im Baum (wie bei den Repositories), sehr viele Sessions im Session-Filter, Ton (wie Video mit Audio-Betrachter), die Fehlerzeile nach einem gescheiterten Knopf (wie heute in der Dateien-Ansicht), „gekürzt“ bei mehr als 2.000 Einträgen (Wortlaut in Phase 4).
