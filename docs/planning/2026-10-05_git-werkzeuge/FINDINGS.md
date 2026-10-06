# Findings — Git-Werkzeuge

Erkenntnisse während der Umsetzung, je eine Zeile, getaggt mit der Phase, die sie aufgreift: `- [ ] → Phase N: <Erkenntnis>`. Erledigt → `[x]`.

- [x] → Phase 3: Die eigenen uncommitteten Dateien für die Häkchen kommen aus `FileChange.uncommitted` von `changes_load`, nicht aus `git_status` — der Core liefert dort nur den fremden Teil (`changes::foreign_uncommitted`).
- [x] → Phase 2: Fehlersätze eines Eintrags laufen über `changes::entry_error` (eigene Sätze in `CommandError::Io` ohne Präfix); schreibende Befehle bekommen die Basis über `changes::source_base`.
- [x] → Phase 3: Nach jedem schreibenden Git-Befehl `git_status` und `changes_load` neu laden — der Core schickt kein Ereignis. Fehler kommen als `CommandError` `{ kind: "git", message }`; „Commit & Push“ meldet einen gescheiterten Push als „Commit angelegt, Push gescheitert: …“ (der Commit ist dann schon da). `git_create_branch` ist im Core gesperrt wie `git_switch`.
- [x] → Phase 4: Die Oberfläche aus Phase 3 lässt gezielt Platz: `GitBranchMenu` ohne „Neuer Branch als Ticket-Worktree …“ (nur am Haupt-Checkout anbieten, `entryKindLabel` in `gitTexts.ts` kennt die Art), `GitOperationRow` ohne „In VS Code öffnen“, `GitMoreMenu` nur mit Fetch und Abbrechen. Menüs hängen über `GitMenuHost` + `useMenuAnchor` am Dokument; neue Einträge nutzen die Klassen `git-menu__*`. Die Datei-Zeile hat noch keinen Verwerfen-Knopf (Entwurf: Hover, ersetzt die Zahlen).
- [ ] → Phase 5: In Phase 1 ungeprüft und in die Smoke-Checkliste aufnehmen, falls nicht schon gedeckt: `pushed: false` eines ungepushten eigenen Commits, `operation: merge` mit `conflicted`, `worktree` in der Branch-Liste, `busy` mit laufender Session.
- [ ] → Phase 5: Smoke-Checkliste um Phase-4-Lücken ergänzen: Verwerfen einer vom Agenten vorgemerkten neuen Datei (`git rm -f`-Weg), Stash zurückholen mit Konflikt (Stash bleibt liegen), Ticket-Worktree-Name mit `/` (Ordner `…-wt-a-b`), „In VS Code öffnen“ ohne `code` im PATH.
