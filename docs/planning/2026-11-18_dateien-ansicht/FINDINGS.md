# FINDINGS

Erkenntnisse aus der Umsetzung, die eine spätere Phase betreffen. Format: `- [ ] → Phase N: <Erkenntnis>`; erledigt abhaken.

- [ ] → Phase 4: `FileContent::Text.lineCount` zählt die ganze Datei, auch bei `truncated: true` — die Ansicht kann „gekürzt, Datei hat N Zeilen“ nennen; `text` endet dann nach `MAX_DIFF_LINES` Zeilen mit `\n`.
- [ ] → Phase 7: Der Vergleichsschlüssel geschriebener Dateien unterscheidet unter Linux und macOS jetzt Groß- und Kleinschreibung und trägt `/` (`attribution::NORMALIZED_SEPARATOR`). Unter Linux früher gespeicherte Pfade in `session_files` (klein, mit `\`) passen dort nicht mehr; unter Windows unverändert. Unix-Zweig nur im Kompilier-Check der CI belegt (AK 8).
