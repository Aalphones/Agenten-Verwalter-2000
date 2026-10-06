# Design-Entwurf: Artefakte

**Status:** umgesetzt in Plan Artefakte (Version beim Archivieren nachtragen); abgenommen am 2026-10-05 als Grundlage des Plans [Artefakte](../../planning/2026-10-05_artefakte/README.md). Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code. Er führt die Tafel `Artifacts.dc.html` aus dem Entwurf [Hauptansichten](../2026-09-28_hauptansichten/README.md) fort, die dort als „offen (GAPS: Artefakte)“ stand: Liste 300 px, Vorschau mit 20 px Rand, Kopf 44 px mit „Im Chat besprechen“ und „Im Browser öffnen“, Karte im Verlauf mit „In der Session ansehen“. Was dieser Entwurf ändert oder ergänzt, ist gestrichelt markiert.

## Ansehen

- [artefakte.html](artefakte.html) direkt im Browser öffnen; keine Design-Zeichenfläche nötig.
- Die Leiste ganz oben gehört nicht zur App: Theme, Ort (Session oder Vorhaben-Übersicht), Zustand der Liste, „Agent speichert das gezeigte Artefakt neu“ (zeigt die Aktualisierung) und „Neues markieren“.
- Die drei Artefakte in der Vorschau sind echte HTML-Seiten, so wie ein Agent sie schreiben würde: ein Bericht mit Kennzahlen und Diagramm, ein Vortrag mit Folien (Pfeiltasten oder ‹ ›) und ein klickbarer Entwurf einer Anmeldeseite.
- Farbwerte sind die Hex-Werte der semantischen Tokens aus `src/styles/theme.css` (Stand 2026-10-05).

## Grundidee

Ein Agent legt eine HTML-Seite im Ordner `.artefakte` des Vorhabens ab, und der Verwalter zeigt sie im Reiter „Artefakte“ an: als echte Seite mit Skripten, abgeschottet vom Verwalter selbst. Speichert der Agent die Seite neu, lädt die Vorschau von allein nach. So lassen sich Entwürfe, Berichte und Vorträge Runde für Runde im Chat verfeinern, ohne die App zu verlassen.

## Was die Tafel zeigt

| Bereich | Zeigt |
|---|---|
| Kopfzeile der Session | Reiter „Chat · Changes · Artefakte“; „Artefakte“ erscheint ab dem ersten Artefakt im Vorhaben, mit Zahl |
| Kopfzeile der Vorhaben-Übersicht | Reiter „Übersicht · Changes · Artefakte“, dieselbe Liste |
| Liste (300 px) | Überschrift „Artefakte des Vorhabens, neueste zuerst“ mit ?-Erklärung; je Eintrag Titel der Seite, darunter „diese Session“ bzw. „#N Name der Session“ und Uhrzeit der letzten Änderung |
| Kopf der Vorschau (44 px) | Titel, Dateiname · Uhrzeit (kurz „gerade aktualisiert“ nach einer Änderung), Neu laden, Vollbild, „Im Chat besprechen“, „Im Browser öffnen“ |
| Vorschau | die Seite selbst auf weißem Grund, 20 px Rand, bedienbar (Klicks, Tasten, Formulare) |
| Vollbild | die Seite füllt den ganzen Bildschirm; „Vollbild beenden“ erscheint oben rechts, sobald die Maus an den oberen Rand kommt; Esc beendet, solange der Fokus nicht in der Seite liegt |
| Chat | Karte unter dem Schreib-Aufruf: Titel, „Artefakt · Dateiname · Uhrzeit“, „In der Session ansehen“ |
| Leere Liste | kommt in der App nicht vor: ohne Artefakt fällt der Reiter weg und die Ansicht springt auf Chat bzw. Übersicht. Die Tafel zeigt den Text nur über die Entwurfs-Leiste. |

## Entscheidungen, die der Entwurf vorschlägt

- **Artefakte gehören dem Vorhaben**, nicht der Session (Abweichung vom Entwurf Hauptansichten, dort „Von Claude in dieser Session erstellt“): ein Entwurf aus Session 1 bleibt in Session 2 griffbereit.
- **Der Reiter erscheint erst mit dem ersten Artefakt** (Critical Rule 1, wie „Changes“ erst mit einem Repository).
- **Aktualisierung ohne Knopfdruck:** speichert der Agent die gezeigte Seite neu, lädt die Vorschau nach; „Neu laden“ bleibt für Seiten, die sich selbst verstellt haben.
- **„Im Chat besprechen“** setzt „Zu Artefakt „Titel“ (absoluter Pfad): “ in die Eingabeleiste (derselbe Weg wie „Im Chat besprechen“ im Hintergrund-Panel) der Session und wechselt in den Chat; in der Vorhaben-Übersicht entfällt der Knopf, weil es dort keine Eingabeleiste gibt.
- **Keine Verwaltung in der App** (Umbenennen, Löschen): das macht der Agent auf Zuruf.

## Platzhalter

- Pfade und Uhrzeiten sind erfunden. Die Vorschau im Entwurf nutzt `srcdoc`; die App lädt die Seite aus dem Ordner, damit Bilder und Skripte daneben gefunden werden.
