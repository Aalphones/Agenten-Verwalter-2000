# Findings — Changes-Review

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 2: Der Plan „Changes je Session“ (`docs/planning/2026-10-01_session-changes/`, läuft vorher) gibt `changes_file_diff` einen Parameter `reach: ChangesReach` hinter `session_id` und liest Workspace und Repositories über `registry.changes_input(&session_id, reach)` statt `repositories_of`. `changes::file_diff` bekommt zusätzlich `&input.own`. Beim Verschieben nach `changes/entry.rs`: `resolve` braucht keine Reichweite (es löst nur Ordner auf) und darf `repositories_of` behalten; `changes_file_diff` holt nach `resolve` noch `registry.changes_input(&session_id, reach)?` für `own` und reicht `&input.own` an `changes::file_diff`.
- [ ] → Phase 3: `loadFileDiff(sessionId, reach, key, path, scope)` und `useFileDiff(sessionId, reach, file, scope, stamp)` haben die Reichweite als zweiten Parameter; `ChangesView` und `DiffView` tragen die Prop `reach` (`'session'` in der Session, `'project'` in der Vorhaben-Übersicht). „Kein ‚+‘ in der Übersicht des Vorhabens“ lässt sich direkt an `reach === 'project'` festmachen statt an einem eigenen Schalter.
