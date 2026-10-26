# Artefakte zum Plan „Automatisch weiter“

| Datei | Inhalt | Phasen |
|---|---|---|
| [entwurf-automatisch-weiter.html](entwurf-automatisch-weiter.html) | Fünf Zustände: (1) mehrere Einstiegszeilen als Knopf-Reihen mit Schalter; (2) Countdown; (3) angehalten mit Grund; (4) Schalter in der Übersicht des Vorhabens; (5) vorbelegter Dialog „Neues Vorhaben“. | 1 (Zustände 1, 5), 2 (1, 4), 3 (2, 3) |
| [entwuerfe/app.css](entwuerfe/app.css) | Gemeinsame App-Attrappe, Kopie aus den Entwürfen vom 2026-10-22. | — |

**Ansehen:** die HTML-Datei im Browser öffnen (offline); hell und dunkel folgen dem System. Eine Kopie liegt im Artefakte-Reiter des Vorhabens, in dem der Plan entstand.

**Design-System:** semantische Tokens aus `src/styles/theme.css` (Stand 2026-10-22). Pfeil-Symbol = `StatusIcon` Fall `handoff` (ADR 027); Knopf wie `HandoffButton`; Schalter = `src/components/Switch.tsx`.

**Platzhalter:** Vorhaben-, Session- und Repository-Namen, Pfade, Gesprächsinhalt, die Sekundenzahl. Gestrichelt umrandet = neu, wird nicht gebaut.

**Neu erzeugen:** nicht nötig — die HTML-Datei ist die Quelle.
