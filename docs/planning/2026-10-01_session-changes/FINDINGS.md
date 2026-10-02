# Findings — Changes je Session

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 3: `SessionChanges.untrackedBefore` steht in den Bindings hinter `plainFolders` (das Feld aus „Ordner ohne Git“ kam nach dem Kontrakt). Die Oberfläche fragt vorerst überall `'session'` (`useSessionChanges`, `useFileDiff`); die Vorhaben-Übersicht und ihre Änderungssumme brauchen `'project'`, und `useFileDiff` muss dieselbe Reichweite bekommen wie die Liste, aus der die Datei geöffnet wurde — sonst meldet „Committed“ für eine Datei aus einer anderen Session des Vorhabens „keine eigenen Commits“.
- [ ] → Smoke (Plan-Ende): Am 2026-10-02 stand in `session_commits` der App-Datenbank noch keine Zeile. Ob die Aufzeichnung aus Phase 1 im echten Lauf Commits findet, ist damit unbelegt; Smoke-Punkt 1 ist der erste Beweis. Die Zuordnung in Phase 2 ist nur mit im Speicher eingetragenen Commits geprüft (Report-Back Phase 2).
