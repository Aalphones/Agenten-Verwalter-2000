# Worktrees entscheidet der Agent

Die App legt beim Anlegen einer Session keine Worktrees und keine Branches mehr an. Der Agent bekommt die Haupt-Checkouts der gewählten Repositories und entscheidet nach seinen eigenen Anweisungen (`CLAUDE.md`, Skills), ob er direkt im Haupt-Checkout arbeitet oder einen Ticket-Worktree anlegt. Die App folgt der Namensregel dieser Anweisungen: Ein Ticket-Worktree liegt **neben** dem Haupt-Checkout und heißt `<Ordner des Repositorys>-wt-<Name>`. Die App gibt dem Agenten Schreib- und Lesezugriff auf genau diese Ordner. Ein Ticket-Worktree gehört zu jeder Session, deren Agent darin gearbeitet hat. Die Changes zeigen ihn gegen den Standard-Branch des Repositorys, also alles, was auf dem Branch liegt, egal wie viele Sessions daran gearbeitet haben. Das ist die Ansicht fürs Merge-Gate. Sessions, die vor dieser Änderung angelegt wurden, behalten ihre App-Worktrees und verhalten sich wie bisher.

Entscheidung und Begründung: ADR 010 (entsteht in Phase 1, `docs/decisions/010-worktrees-durch-den-agenten.md`). ADR 008 und 009 sind von geparkten Plänen reserviert.

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Core: Haupt-Checkout statt App-Worktree, Freigabe der Ticket-Worktree-Ordner | [phase-1-core-haupt-checkout.md](phase-1-core-haupt-checkout.md) | heikel | complete |
| 2 | Zuordnung: welche Ticket-Worktrees der Agent einer Session benutzt hat | [phase-2-zuordnung.md](phase-2-zuordnung.md) | heikel | pending |
| 3 | Changes: Ticket-Worktrees gegen den Standard-Branch | [phase-3-changes.md](phase-3-changes.md) | heikel | pending |
| 4 | Texte in der Oberfläche und Doku | [phase-4-texte-und-doku.md](phase-4-texte-und-doku.md) | mechanisch | pending |

Nach Phase 1 läuft das direkte Arbeiten im Haupt-Checkout vollständig. Nach Phase 3 läuft auch das Arbeiten im Ticket-Worktree vollständig.

## Kontrakt

**Datenmodell (Core, `src-tauri/src/worktrees/mod.rs`):**

```rust
pub enum RepositoryCheckout {
    /// Von der App angelegter Worktree (Sessions vor ADR 010).
    AppWorktree { folder: String, branch: String },
    /// Der Agent arbeitet im Haupt-Checkout (`repository_path`).
    Main,
}
pub struct SessionRepository {
    pub name: String,
    pub repository_path: PathBuf,
    pub base_ref: String,
    pub base_commit: String,
    pub checkout: RepositoryCheckout,
}
/// Namensregel eines Ticket-Worktrees: Nachbarordner `<Ordner des Repositorys>-wt-<Name>`.
pub const TICKET_WORKTREE_INFIX: &str = "-wt-";
```

**Datenbank:** Migration `004_main_checkout.sql`:

- `session_repositories.checkout TEXT NOT NULL DEFAULT 'app_worktree'`, Werte `app_worktree` | `main`. Zeilen mit `main` tragen `folder = ''`, `branch = ''`.
- Neue Tabelle `session_ticket_worktrees (session_id, position, folder)`: welche Ticket-Worktrees der Agent der Session benutzt hat. `position` ist die Position des Repositorys in der Session, `folder` der Ordnername, etwa `verwalter-wt-faceid-306`.

**Agent-Start:** Je `Main`-Repository gehen `--add-dir <Haupt-Checkout>` und die Freigaben `Edit(<Muster>)` und `Read(<Muster>)` mit. Das Muster ist `//<Laufwerk klein>/<Pfad des Elternordners mit />/<Ordner des Repositorys>-wt-*/**`. Belegt am 2026-09-30 mit Claude Code 2.1.284: Ohne die Regel verweigert Claude das Schreiben in den Nachbarordner. Mit der Regel schreibt er ohne Rückfrage. Ein anderer Nachbarordner bleibt gesperrt.

**Changes über die Tauri-Grenze (`src-tauri/src/changes/model.rs`):** `RepositoryChanges.position: u32` wird durch `key: String` ersetzt, `"<Position>"` für ein Session-Repository, `"<Position>/<Ordner>"` für einen Ticket-Worktree. `changes_file_diff(session_id, key, path, scope)` nimmt `key` statt `position`. Die UI benutzt überall `key`.

## Finale Abnahmekriterien

- Eine neue Session legt in keinem Repository einen Worktree oder Branch an.
- Der Agent einer neuen Session kann im Haupt-Checkout arbeiten. Seine Änderungen erscheinen in den Changes unter dem Repository.
- Legt der Agent nach seinen Anweisungen einen Ticket-Worktree `<repo>-wt-<Name>` neben dem Haupt-Checkout an, kann er dort im Modus „Automatisch bearbeiten" ohne Rückfrage Dateien ändern.
- Sobald der Agent oder ein Subagent einer Session einen Ticket-Worktree benutzt (Datei lesen oder schreiben, suchen, Befehl mit dem Ordnernamen), erscheint er in den Changes dieser Session als Eintrag „<Repository> · <Ordner>". Das gilt auch nach einem Neustart der App.
- Dieser Eintrag zeigt alle Änderungen des Worktrees gegenüber dem Standard-Branch: alles seit der Abzweigung, committet und nicht committet. Das gilt unabhängig davon, welche Session die Änderungen gemacht hat.
- Ein Ticket-Worktree, den es nicht mehr gibt (nach dem Merge entfernt), verschwindet ohne Fehlermeldung aus den Changes.
- Archivieren fasst Haupt-Checkouts und Ticket-Worktrees nicht an.
- Sessions von vor dieser Änderung starten, zeigen Changes und archivieren genau wie vorher.
- `pnpm check` ist grün.

## Smoke-Checkliste (Sascha, am Plan-Ende)

Zuerst die Wackelstellen:

1. **Merge-Gate über mehrere Sessions.** Session A: Den Agenten einen Ticket-Worktree anlegen lassen, eine Datei ändern und committen. Session B (neu, gleiches Repository): „Arbeite im Worktree `<repo>-wt-<Name>` weiter" und eine zweite Datei ändern, ohne zu committen. Session C (neu): „Zeig mir den Diff von `<repo>-wt-<Name>` gegen master". In C erscheint der Eintrag „<Repository> · <Ordner>" in den Changes. Die Ansicht „Alle" zeigt **beide** Dateien.
2. **Lesen im Ticket-Worktree ohne Rückfrage.** In Session C fragt Claude beim Lesen von Dateien im Worktree nicht nach.
3. **Standard-Branch statt ausgechecktem Branch.** Im Haupt-Checkout vorübergehend einen anderen Branch auschecken. Der Ticket-Worktree-Eintrag zeigt weiter „gegen main" (bzw. `master`) und dieselben Dateien.

Danach:

4. Neue Session: `git -C <Repository> worktree list` und `git -C <Repository> branch --list "verwalter/*"` sind vor und nach dem Anlegen gleich.
5. Den Agenten direkt im Haupt-Checkout eine Datei ändern lassen. Sie erscheint unter dem Repository-Eintrag in den Changes.
6. `/` in der Eingabeleiste einer neuen Session zeigt die Skills des Repositorys.
7. App schließen und neu öffnen. Session A zeigt den Ticket-Worktree weiter in den Changes.
8. Den Ticket-Worktree mergen und entfernen (per Agent). Der Eintrag verschwindet ohne Fehlermeldung.
9. Eine alte Session (von vor dieser Änderung) öffnen: Chat, Changes und Senden funktionieren wie bisher.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
