# Findings — Git-Werkzeuge

Erkenntnisse während der Umsetzung, je eine Zeile, getaggt mit der Phase, die sie aufgreift: `- [ ] → Phase N: <Erkenntnis>`. Erledigt → `[x]`.

- [ ] → Phase 3: Die eigenen uncommitteten Dateien für die Häkchen kommen aus `FileChange.uncommitted` von `changes_load`, nicht aus `git_status` — der Core liefert dort nur den fremden Teil (`changes::foreign_uncommitted`).
- [ ] → Phase 2: Fehlersätze eines Eintrags laufen über `changes::entry_error` (eigene Sätze in `CommandError::Io` ohne Präfix); schreibende Befehle bekommen die Basis über `changes::source_base`.
- [ ] → Phase 5: In Phase 1 ungeprüft und in die Smoke-Checkliste aufnehmen, falls nicht schon gedeckt: `pushed: false` eines ungepushten eigenen Commits, `operation: merge` mit `conflicted`, `worktree` in der Branch-Liste, `busy` mit laufender Session.
