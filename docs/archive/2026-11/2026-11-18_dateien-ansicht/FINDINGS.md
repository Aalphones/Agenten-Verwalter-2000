# FINDINGS

Erkenntnisse aus der Umsetzung, die eine spätere Phase betreffen. Format: `- [ ] → Phase N: <Erkenntnis>`; erledigt abhaken.

- [x] → Phase 4: `FileContent::Text.lineCount` zählt die ganze Datei, auch bei `truncated: true` — die Ansicht kann „gekürzt, Datei hat N Zeilen“ nennen; `text` endet dann nach `MAX_DIFF_LINES` Zeilen mit `\n`.
- [x] → Phase 4: `FilesView.renderOpenFile` zeigt für unveränderte Dateien den Platzhalter „Ganze Datei folgt“ und für Dateien aus dem Verlauf (`step` = Commit-ID, `entryKey` = `commit.key`) noch den Diff des ganzen Blickwinkels; `OpenTarget.view` und `step` wertet bisher niemand aus. Die Leiste über der Datei („← Baum“ nur schmal, „← Übersicht“) steht in `renderBar`.
- [x] → Phase 4: Bäume und Diffs lesen über die Session der gezeigten Changes (`dataSessionId` = gefilterte Session, sonst die aktuelle), weil Eintragsschlüssel je Session gelten; `readFile` muss dieselbe Session bekommen.
- [x] → Phase 5: Platz für das Suchfeld ist rechts in `FilesToolbar` (Leiste bricht um); `FilesSelection.query` existiert im Zustand, ungenutzt.
- [x] → Phase 7: Der Zustand liegt je Ansicht (`session:<id>`, `project:<id>`, `implementation:<id>`), nicht je Session-ID; die Seite `{ git }` in `FilesPage` ist angelegt, aber ungenutzt. Die Tabelle „Codebasis“ ist noch nicht anklickbar (im Entwurf öffnet sie die Git-Seite). `PanelId` `filesTree` existiert; `changesTree` entfällt mit „Changes“.
- [x] → Phase 7: Der Vergleichsschlüssel geschriebener Dateien unterscheidet unter Linux und macOS jetzt Groß- und Kleinschreibung und trägt `/` (`attribution::NORMALIZED_SEPARATOR`). Unter Linux früher gespeicherte Pfade in `session_files` (klein, mit `\`) passen dort nicht mehr; unter Windows unverändert. Unix-Zweig nur im Kompilier-Check der CI belegt (AK 8).
