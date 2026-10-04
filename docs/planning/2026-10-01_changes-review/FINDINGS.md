# Findings — Changes-Review

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [x] → Phase 2: Der Plan „Changes je Session“ (`docs/archive/2026-10/2026-10-01_session-changes/`, läuft vorher) gibt `changes_file_diff` einen Parameter `reach: ChangesReach` hinter `session_id` und liest Workspace und Repositories über `registry.changes_input(&session_id, reach)` statt `repositories_of`. `changes::file_diff` bekommt zusätzlich `&input.own`. Beim Verschieben nach `changes/entry.rs`: `resolve` braucht keine Reichweite (es löst nur Ordner auf) und darf `repositories_of` behalten; `changes_file_diff` holt nach `resolve` noch `registry.changes_input(&session_id, reach)?` für `own` und reicht `&input.own` an `changes::file_diff`.
- [x] → Phase 2: Der Plan „Innere Repositories“ (ADR 020) hat die Auflösung Schlüssel → Ordner schon nach `changes/sources.rs` gezogen (`sources::find(&input, key) -> Source`, `Source.dir` ist der Ordner, `changes::file_diff(&source, path, scope, &input.own)`). Kein eigenes `changes/entry.rs` anlegen; `resolve` = `registry.changes_input(…)` + `sources::find`. Schlüssel haben eine dritte Form `"<Position>:<Ordner>"` (inneres Repository oder dessen Ticket-Worktree).
- [x] → Phase 3: `loadFileDiff(sessionId, reach, key, path, scope)` und `useFileDiff(sessionId, reach, file, scope, stamp)` haben die Reichweite als zweiten Parameter; `ChangesView` und `DiffView` tragen die Prop `reach` (`'session'` in der Session, `'project'` in der Vorhaben-Übersicht). „Kein ‚+‘ in der Übersicht des Vorhabens“ lässt sich direkt an `reach === 'project'` festmachen statt an einem eigenen Schalter.
- [x] → Phase 4: Store `src/stores/review.ts` steht: Liste lesen mit `useReviewStore((state) => state.collected[sessionId] ?? NO_COMMENTS)` (stabiler Leerwert, sonst rendert der Selektor endlos), Karten-Bearbeiten → `updateText`, Entfernen → `remove`, „Alle entfernen“ → `clear`, nach erfolgreichem Senden `clearIds` mit den IDs, die mitgingen (wie `useAttachmentsStore.clearIds`). Ortsangabe der Karte: `whereLabel` aus `src/features/review/reviewLabels.ts`.
