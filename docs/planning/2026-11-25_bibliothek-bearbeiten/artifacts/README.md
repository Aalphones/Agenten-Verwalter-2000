# Entwurf: Bibliothek bearbeiten

Der Klickdummy ist verbindlich für Aufbau, Beschriftungen, Abstände und Zustände. Farben, Schrift und Radien stammen aus `src/styles/theme.css` (Werte wie im Entwurf Session-Dateien); im Entwurf stehen sie als feste Werte, in der Umsetzung gelten die Tokens.

## Dateien

| Datei | Inhalt | Phase |
|---|---|---|
| `entwurf-bibliothek-bearbeiten.html` | Klickdummy: Seitenleiste mit Knopf „Bibliothek“, Bereich mit Leiste, Baum, Übersicht, Datei mit Editor und Vorschau, Suchfeld für Name und Inhalt, Dialoge „Neue Datei“ und „Datei wurde inzwischen geändert“, Löschen mit Rückgängig | 3, 4, 5 |
| `_entwurf-bibliothek-bearbeiten/daten.js` | Pfade, Größen und Änderungszeiten der Bibliothek, gekürzte Skill-Beschreibungen | 3 |

## Ansehen

`entwurf-bibliothek-bearbeiten.html` im Browser öffnen. Der Editor ist echtes CodeMirror 6 und kommt aus dem Netz (`esm.sh`); ohne Netz steht dort ein einfaches Textfeld. Die Leiste oben schaltet Zustand (Normal, Lädt, Kein Ordner, Konflikt beim Speichern, Spiegeln scheitert) und Thema; „Wofür“ nennt Aufgabe und Regeln. Adresse hinter `#`: `f=<Pfad>` (z. B. `skills/mode-design/SKILL.md`, `_vault/design/baukasten/galerie.html`, `_vault/design/baukasten/preview.png`), `m=preview`, `d=1` (mit Entwurf), `z=loading|nofolder|conflict|mirrorfail`, `th=light|dark`.

## Welche Teile gelten für welche Phase

| Bildschirm | Phase |
|---|---|
| Seitenleiste: Knopf „Bibliothek“ aktiv, Punkt bei Ungespeichertem | 3 (Knopf), 4 (Punkt) |
| Leiste, Baum, Übersicht, Datei-Kopf, Meta-Zeile, Ansicht von Bild/PDF | 3 |
| Editor, Bearbeiten/Vorschau, Speichern, Verwerfen mit Rückgängig, Konflikt-Dialog, Spiegel-Leiste | 4 |
| Suchfeld (Name und Inhalt, „im Text“) | 3 |
| „+“ an Ordnern, Dialog „Neue Datei“, Mülleimer an Dateien, „Löschen“ im Kopf, Leiste „Gelöscht … Rückgängig“ | 5 |
| Ctrl K fokussiert das Suchfeld; kein Suchdialog mehr | 6 |

## Was Beispiel ist

- Echt: Ordnerstruktur, Dateinamen, Größen, Änderungszeiten von Skills, Befehlen, Ausgabestilen und Wissen (Stand 2026-11-25), Skill-Beschreibungen (gekürzt).
- Beispiel: alle Dateiinhalte, die Namen der Gedächtnis-Dateien, Vorhaben und Sessions der Seitenleiste, Uhrzeiten des Abgleichs, Zeitpunkt im Konflikt-Dialog.
- Inhaltstreffer im Entwurf suchen in den Beispielinhalten; in der App kommen sie aus dem Suchindex.
- Die HTML-Vorschau setzt im Entwurf die CSS-Dateien des Ordners selbst ein; in der App lädt der Artefakt-Server sie über die Adresse (Phase 2).

## Neu erzeugen

`daten.js` entsteht aus der Bibliothek mit zwei Hilfsskripten aus der Planungs-Session (Erlaubnisliste wie `vault/library.rs`, Gedächtnis-Namen ersetzt); sie liegen nicht im Repository. Neu erzeugen nur bei Bedarf — der Entwurf braucht keinen aktuellen Stand.

## Nicht gezeichnet

Tastaturbedienung im Baum (wie `RepoTree`), sehr lange Dateinamen (kürzen mit Auslassung wie im Baum der Dateien-Ansicht), Fehler beim Laden des Baums (Satz mit „Erneut laden“, Phase 3), Archiv und Einstellungen.
