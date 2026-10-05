# Phase 4 — Weitere Befehle: Verwerfen, Stash, Rebase, Merge, Branch löschen, Ticket-Worktree, Öffnen

Ziel: Die Einträge des ⋯-Menüs und „Verwerfen“ beim Überfahren einer Datei aus dem Entwurf — Core und Oberfläche in einer Phase, weil jeder Befehl klein ist und demselben Muster aus Phase 2/3 folgt.

## Kontext

- **Entwurf:** [git-werkzeuge.html](../../design/2026-10-05_git-werkzeuge/git-werkzeuge.html) — ⋯-Menü (`openMoreMenu`), Branch-Menü (Eintrag „Neuer Branch als Ticket-Worktree …“), Verwerfen-Knopf an der Datei-Zeile und Dialog „Änderung verwerfen?“.
- [README.md](README.md): „Festgelegte Entscheidungen“ (Sperre, Neuer Branch als Ticket-Worktree), „Kontrakt“ (Commands Phase 4, `not-merged:`-Präfix).
- Phase 2: `git/mod.rs` `run_write`, `git/actions.rs`, `commands/git.rs` `entry_dir`, `registry.ensure_not_busy`. Phase 3: `src/lib/git.ts`, `src/features/git/` (`GitMoreMenu`, `GitBranchMenu`, `GitOperationRow`), `buildFileRows`/`FileTree`.
- `src-tauri/src/git/mod.rs` `worktree_add_new(repo, path, branch, start)`; `src-tauri/src/worktrees/` (Benennung `<repo>-wt-<Name>`, `ticket_roots`); in `sessions/registry.rs` der Weg, auf dem ein vom Agenten benutzter Ticket-Worktree der Session gemerkt wird (`outbox.ticket_worktrees` → `db::session_ticket_worktrees::insert_all`; Fundstelle der Befüllung per Grep auf `ticket_worktrees` in `registry.rs`).
- `src-tauri/src/commands/file_links.rs` — Öffnen über das Opener-Plugin (`app.opener().open_path(...)`); `src-tauri/src/processes/` `hide_console`.
- Fehlerklassen: Vault `werkzeuge/git.md` — keine weitere einschlägig.

## AK der Phase

- **Verwerfen:** beim Überfahren einer Datei in „Uncommitted“ (eigene und fremde) erscheint statt der Zahlen ein Knopf (20 × 20 px, Symbol „Zurück“), Tooltip „Änderung verwerfen …“; Dialog „Änderung verwerfen?“ / „<Datei> wird auf den letzten Commit zurückgesetzt. Das lässt sich nicht rückgängig machen.“ / „Abbrechen“ · „Verwerfen“ (primär). Geänderte Datei → Stand von `HEAD`; neue (untracked) Datei → gelöscht. Bei `busy` ausgegraut, Tooltip „Wartet, bis der Agent ruht“.
- **⋯-Menü** (280 px) in dieser Reihenfolge, Trennlinien wie im Entwurf: „Fetch“, „Pull mit Rebase“ · „Stash: Änderungen beiseitelegen“, „Stash zurückholen …“ · „Branch hierher mergen …“, „Branch löschen …“ · „Im Explorer öffnen“, „In VS Code öffnen“; bei laufendem Merge/Rebase oben zusätzlich „Merge abbrechen“/„Rebase abbrechen“. Ausgegraut bei `busy`: Pull mit Rebase, beide Stash-Einträge, Merge. (Abweichung vom Entwurf: dort „In main mergen …“; der Entwurf wird angepasst, siehe Doc-Updates.)
- **Stash zurückholen …** öffnet eine Liste der Stashes (Text aus `git stash list`, neueste oben); Klick holt diesen zurück (`pop`). Leere Liste → Eintrag ausgegraut „Kein Stash vorhanden“.
- **Branch hierher mergen …** öffnet die Branch-Liste (lokal und remote, ohne den aktuellen) mit Suchfeld; Klick → `git merge <branch>`. Konflikte → Zeile aus Phase 3.
- **Branch löschen …** öffnet die lokalen Branches ohne den aktuellen und ohne die in einem Worktree ausgecheckten; Klick → löschen; nicht gemergt → Dialog „<branch> ist nicht gemergt. Trotzdem löschen?“ / „Abbrechen“ · „Trotzdem löschen“.
- **Neuer Branch als Ticket-Worktree …** im Branch-Menü (nur an einem Haupt-Checkout-Eintrag): nimmt den Namen aus dem Suchfeld; legt `<Haupt-Checkout>-wt-<Name, / → ->` neben dem Haupt-Checkout an, Branch vom aktuellen `HEAD`; der neue Ordner erscheint nach dem Neuladen als eigener Eintrag in den Changes der Session. Ordner existiert schon → Fehler „Ordner <…> gibt es schon.“
- **Im Explorer öffnen** öffnet den Ordner des Eintrags; **In VS Code öffnen** startet `code <Ordner>`; ist `code` nicht im PATH → Fehler „VS Code nicht gefunden (Befehl „code“ fehlt im PATH).“ Die Konflikt-Zeile aus Phase 3 bekommt jetzt „In VS Code öffnen“.
- Entwurf-README und HTML: „In main mergen …“ → „Branch hierher mergen …“.
- `pnpm check` grün.

## Checkliste

### Core `src-tauri/src/git/mod.rs` (über `run_write`, Pfade hinter `--`)

- [ ] `restore(dir, path)`: `restore --source=HEAD --staged --worktree -- <path>`.
- [ ] `stash_list(dir) -> Vec<String>`: `stash list --format=%gd%x00%s` → Anzeigetext „<Betreff>“, Index aus `stash@{n}`.
- [ ] `stash_pop(dir, index)`: `stash pop stash@{<index>}`.
- [ ] `pull_rebase(dir)`: `pull --rebase`.
- [ ] `merge(dir, branch)`: `merge --no-edit <branch>`.
- [ ] `delete_branch(dir, branch, force)`: `branch -d` bzw. `-D`; Git-Fehlertext enthält „not fully merged“ → `CommandError::Git(format!("not-merged:{branch}"))`.

### Core `src-tauri/src/git/actions.rs`

- [ ] `discard(dir, path)`: `changes::validate_path(path)`; `git::is_untracked(dir, path)` → Datei unter `dir.join(path)` löschen (`std::fs::remove_file`; vorher kanonisch prüfen, dass der Pfad innerhalb von `dir` liegt), sonst `git::restore`.
- [ ] `pull_rebase(dir)`: wie `pull` aus Phase 2 (ohne Upstream Fehler; Konflikt → kein Fehler, wenn danach `rebase-merge`/`rebase-apply` existiert).
- [ ] `merge(dir, branch)`: Konflikt → kein Fehler, wenn danach `MERGE_HEAD` existiert.
- [ ] `create_ticket_worktree(main_dir, name) -> Result<String /* Ordnername */>`: `check_branch_name`; Ordnername = `<Name des Haupt-Checkout-Ordners>-wt-<name mit / → ->`; Pfad = Geschwister von `main_dir`; existiert → Fehler aus den AK; `git::worktree_add_new(main_dir, &pfad, name, "HEAD")`.

### Commands `src-tauri/src/commands/git.rs` und Registry

- [ ] `git_discard`, `git_stash_push` (Nachricht `verwalter: <YYYY-MM-DD HH:MM>`), `git_stash_pop`, `git_pull_rebase`, `git_merge`: zuerst `registry.ensure_not_busy`. `git_stash_list`, `git_delete_branch`: ohne Sperre.
- [ ] `git_create_ticket_worktree(session_id, key, name)`: Eintrag muss ein Haupt-Checkout sein (`source.ticket.is_none()` und keine innere Repository-Kennung `:` im Schlüssel) — sonst Fehler „Nur am Haupt-Checkout möglich.“; `actions::create_ticket_worktree`; danach den Ordner der Session merken über eine neue Registry-Methode `remember_ticket_worktree(session_id, position, folder)`, die denselben Weg geht wie ein vom Agenten benutzter Ticket-Worktree (Zustand der Session ergänzen + `session_ticket_worktrees::insert_all`). Danach liefert `changes_input` ihn als Eintrag.
- [ ] `git_open(session_id, key, target)`: `Explorer` → `app.opener().open_path(dir)`; `VsCode` → `Command::new("cmd").args(["/C", "code", <dir>])` mit `hide_console`, Exit ≠ 0 oder „nicht erkannt“ im stderr → Fehler aus den AK. Kein Sperr-Check.
- [ ] Alle registrieren; Wrapper in `src/lib/git.ts`.

### Oberfläche `src/features/git/`

- [ ] `GitMoreMenu.tsx` vollständig nach den AK; Untermenüs als zweiter Popover-Inhalt im selben Popover (Zurück-Pfeil oben links), nicht als zweites Fenster.
- [ ] `GitDiscardDialog.tsx`, `GitDeleteBranchDialog.tsx` (Rückfrage „Trotzdem löschen“ bei Fehler mit Präfix `not-merged:`).
- [ ] Verwerfen-Knopf in der Datei-Zeile (`FileTree.renderFile`, nur `checkable !== null`), Zahlen beim Überfahren ausgeblendet.
- [ ] `GitBranchMenu.tsx`: Eintrag „+ Neuer Branch als Ticket-Worktree …“ unter „+ Neuer Branch aus …“, nur wenn der Eintrag ein Haupt-Checkout ist (Schlüssel ohne `/` und ohne `:`).
- [ ] `GitOperationRow.tsx`: „In VS Code öffnen“ ergänzen.
- [ ] `gitTexts.ts` um alle Sätze dieser Phase.

### Doc-Updates

- [ ] `docs/code-map.md`: Zeile „Git-Werkzeuge“ um die neuen Commands und `remember_ticket_worktree`.
- [ ] `docs/design/2026-10-05_git-werkzeuge/`: HTML-Menütext und README-Tabelle „In main mergen …“ → „Branch hierher mergen …“.
- [ ] ADR 025: Konsequenz „Ticket-Worktrees kann jetzt auch die App anlegen; sie gehören dann der Session, die sie angelegt hat“ (Ergänzung zu ADR 010).

## Report-Back
