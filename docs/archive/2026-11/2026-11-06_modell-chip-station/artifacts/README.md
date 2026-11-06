# Artefakte — Modell-Chip auf der Stationskarte

| Datei | Zeigt | Phase |
|---|---|---|
| [station-modell-chip.html](station-modell-chip.html) | Vier Karten zum Anklicken: bereit (Plan ändern), läuft wie geplant, läuft abweichend, fertig; Menü mit Denkaufwand-Punkten und Modellliste | 2 |

- **Ansehen:** Datei im Browser öffnen, eine einzelne HTML-Seite ohne Abhängigkeiten. Hell und Dunkel folgen dem System.
- **Design-System:** Farben, Abstände und Radien stammen aus `src/styles/theme.css`; Menü und Punkte spiegeln `Popover.css`, `ModelMenu.css`, `EffortDots.css`.
- **Platzhalter:** Texte und Namen der Beispielkarten sind erfunden; der Warntext des Cache-Kastens ist vereinfacht (echt: `CacheAwareModelMenu`). Das Ausweichmodell des Sicherheitsfilters fehlt bewusst.
