# FINDINGS

Format: `- [ ] → Phase N: <Erkenntnis>`

- [x] → Phase 3: `output == ""` heißt entweder „läuft noch“ oder „fertig ohne Ausgabe“ — ein Ergebnis mit leerem Text erzeugt kein `ToolOutput`. Die Oberfläche unterscheidet über `state` des `ChatEntry::Tool` (Running vs. fertig), nicht über `ToolDetail`. Ein offener Aufruf lädt beim Aufklappen einen Zwischenstand; ob er beim Ende neu lädt, entscheidet Phase 3.
- [ ] → Phase 3: Selbst-Verifikation von Phase 2 in der echten App steht noch aus (Prüfprogramm hat Übersetzer und Datenbank belegt, nicht den Weg über `persist` und den Command) — mit dem Aufklappen nachholen.
