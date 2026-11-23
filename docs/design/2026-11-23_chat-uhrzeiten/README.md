# Design-Entwurf: Uhrzeiten im Chat

**Status:** abgenommen am 2026-11-23 als Grundlage des Plans [Uhrzeiten im Chat](../../planning/2026-11-23_chat-uhrzeiten/README.md). Abweichung bei der Umsetzung: keine Einstellung, nur der Modus „Immer“ mit festen Pausenlinien (siehe Plan).

## Ansehen

- [chat-uhrzeiten.html](chat-uhrzeiten.html) direkt im Browser öffnen.
- Die Leiste ganz oben gehört nicht zur App: Ansicht, Uhrzeiten-Modus, Verlauf (Neu, Bestand, Leer), Breite (390, 860, 1366, Voll), Thema, ⓘ Aufgabe.
- Farbwerte sind die Hex-Werte der Tokens aus `src/styles/theme.css` (Stand 2026-11-23).

## Was der Entwurf zeigt

| Bereich | Zeigt |
|---|---|
| Zeit am Block | HH:MM rechts; unter 560 px Containerbreite über dem Block |
| Gleiche Minute | nur der erste Block trägt die Zeit |
| Tageslinie | „Heute“, „Gestern“, „Fr., 20.11.2026“ |
| Pausenlinie | gestrichelt, ab 30 Minuten, nur zwischen benachbarten Einträgen mit Zeit |
| Tooltip | Wochentag, Datum, Sekunden |
| Verlauf „Bestand“ | Einträge des Agenten ohne Zeit, ohne Platzhalter; Nachrichten des Nutzers mit Zeit |
| Einstellungen | nur im Dummy; entfällt in der App |

## Platzhalter

- Datum (23.11.2026), Texte und Zeiten sind erfunden. Statt der Figuren des Skins stehen schlichte Symbole.
