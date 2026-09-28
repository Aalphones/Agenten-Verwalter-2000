# Phase 4 — Fehlerfälle und Aufräumen

**Status:** pending · **Rating:** heikel (Git-Aufrufe im Startpfad unter der Session-Sperre, Aufräumen nach dem Prozessende, Windows hält Dateien fest)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (Repository fehlt, Aufräumen beim Archivieren) und Kontrakt `worktrees::ensure`, `worktrees::remove_clean`, `WorktreeCheck`
- [ADR 005](../../decisions/005-repositories-und-worktrees.md)
- Bestand:
  - `src-tauri/src/sessions/registry.rs` — `start_process` (Aufrufer: `create`, `send`, `restart`), `archive`, `cancel`, `retire_process` (`KILL_GRACE` = 5 s), `push_entry` und die vorhandenen `ChatEntry::Error`-Aufrufe (~Zeile 895 und 920) als Muster
  - `src-tauri/src/worktrees/mod.rs`, `src-tauri/src/git/mod.rs` (Phase 1/2)
  - `src/app/SidebarItem.tsx` — `title` des Menüpunkts „Archivieren“
  - `src/features/chat/ErrorBlock.tsx` — wie ein Fehler-Eintrag erscheint
- Fehlerklassen: Vault-Entities nicht vorhanden. Einschlägig:
  - **Windows hält Dateien offener Prozesse fest:** `git worktree remove` scheitert, solange `claude.exe` oder ein von ihm gestarteter Dev-Server Dateien im Worktree offen hat. Darum räumt das Archivieren erst nach `KILL_GRACE` + 1 s auf, und ein Fehlschlag lässt den Worktree einfach liegen (kein `--force`). Prüfen per Smoke „Archivieren mit laufendem Dev-Server“.
  - **Git unter der Session-Sperre:** `ensure` läuft in `start_process` und damit unter der Sperre. Im Normalfall prüft es nur `Path::exists` (kein Git-Aufruf); Git läuft nur im Reparaturfall. Das hält die Sidebar im Normalfall flüssig — prüfen per Code-Lesen: kein `git::`-Aufruf vor der `exists`-Prüfung.
  - **Zeitabhängiger Wächter:** Die Aufräum-Funktion darf nicht prüfen, ob die Session „noch läuft“ — sie ist zu dem Zeitpunkt schon aus der Registry entfernt. Sie arbeitet nur mit den kopierten Pfaden.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. Worktree-Ordner einer Session löschen (Explorer), Nachricht senden (der Agent muss dafür neu starten: vorher App neu starten oder die Frist der ruhenden Agenten abwarten) → der Ordner ist wieder da, auf dem Session-Branch, mit den committeten Änderungen der Session; kein Fehler-Eintrag im Chat.
3. Haupt-Checkout eines Repositorys umbenennen, App neu starten, Nachricht senden → der Agent antwortet; im Chat steht davor ein Fehler-Eintrag „Repository nicht gefunden“ mit Name und Pfad; das `claude.exe` hat für dieses Repository kein `--add-dir`.
4. Session ohne Änderungen archivieren → nach etwa 6 s ist der Worktree-Ordner weg, `git -C <repo> worktree list` kennt ihn nicht mehr, der Branch `verwalter/<slug>` existiert; ist der Workspace-Ordner danach leer, ist er ebenfalls weg.
5. Session mit einer geänderten Datei im Worktree archivieren → Worktree samt Änderung bleibt liegen, Branch bleibt.
6. Der Menüpunkt „Archivieren“ erklärt per `title` das neue Verhalten (Text unten).

## Checkliste

- [ ] `worktrees/mod.rs`:
  - `pub enum WorktreeCheck { Ready(PathBuf), Missing { name: String, reason: String } }`.
  - `pub fn ensure(workspace: &Path, repositories: &[SessionRepository]) -> Vec<WorktreeCheck>`: je Eintrag `path = workspace.join(&folder)`; `path.exists()` → `Ready(path)` (ein vorhandener Ordner wird nie angefasst). Sonst: `repository_path.join(".git").exists()` nein → `Missing { reason: format!("{} gibt es nicht mehr.", repository_path.display()) }`. Ja → `let _ = git::worktree_prune(repo)`; `branch_exists` → `worktree_add_existing(repo, &path, &branch)`, sonst `worktree_add_new(repo, &path, &branch, &base_commit)`; Erfolg → `Ready(path)`, Fehler → `Missing { reason: format!("Worktree konnte nicht neu angelegt werden ({error}).") }`.
  - `pub fn remove_clean(workspace: &Path, repositories: &[SessionRepository])`: je Eintrag, wenn `workspace.join(&folder)` existiert: `git::worktree_remove(repo, &path)` — Fehler ignorieren (Worktree bleibt liegen, das ist gewollt); danach `let _ = git::worktree_prune(repo)`. Am Ende `let _ = fs::remove_dir(workspace)` (gelingt nur, wenn leer). Doc-Kommentar: „Ohne `--force`: Git verweigert das Entfernen bei geänderten oder neuen, nicht ignorierten Dateien — solche Worktrees bleiben mit ihren Änderungen liegen. Branches bleiben immer.“
- [ ] `sessions/registry.rs`:
  - `start_process(app, session, state, outbox: &mut Outbox)`: vor dem Spawn `let checks = worktrees::ensure(&session.workspace, &session.repositories);` `add_dirs` = alle `Ready`-Pfade; für jedes `Missing { name, reason }` einen Eintrag `state.push_entry(outbox, |seq| ChatEntry::Error { seq, title: "Repository nicht gefunden".to_owned(), text: format!("{name}: {reason} Der Agent arbeitet ohne dieses Repository weiter.") })` — ohne Statuswechsel. Die drei Aufrufer reichen ihr `outbox` durch.
  - `archive`: nach dem bisherigen Ablauf (Abbrechen, Datenbank, aus der Map) die Session-Daten kopieren (`workspace.clone()`, `repositories.clone()`) und, wenn `repositories` nicht leer ist, einen Thread `worktree-cleanup` starten (`thread::Builder::new().name(...)`), der `KILL_GRACE + Duration::from_secs(1)` schläft und dann `worktrees::remove_clean` aufruft. Lässt sich der Thread nicht starten → nichts tun (Worktrees bleiben liegen, kein Fehler). Doc-Kommentar von `archive` anpassen: „… Verlauf bleibt; Worktrees ohne offene Änderungen werden nach dem Ende des Agenten entfernt, Branches bleiben.“
- [ ] `src/app/SidebarItem.tsx`: `title` von „Archivieren“ → „Blendet die Session aus der Liste aus. Der Verlauf bleibt erhalten. Worktrees ohne offene Änderungen werden entfernt, die Branches bleiben in den Repositories.“
- [ ] Doku (im selben Commit):
  - `docs/glossary.md`: „Archivieren“ → „Blendet eine Session aus der Liste aus (`archived_at` in der Datenbank gesetzt). Der Verlauf bleibt erhalten; Worktrees ohne offene Änderungen entfernt die App, Branches bleiben. Keine eigene Archiv-Ansicht.“
  - `docs/decisions/004-persistenz-und-wiederherstellung.md`, „Konsequenzen“, letzter Punkt „Wer eine Session archiviert, blendet sie aus; Daten und Arbeitsordner bleiben.“ → „Wer eine Session archiviert, blendet sie aus; die Daten bleiben, Worktrees ohne offene Änderungen räumt seit [ADR 005](005-repositories-und-worktrees.md) das Archivieren auf.“
  - `docs/PROJECT.md`: unter „Offene Fragen“ den Punkt „Windows-Pfadlänge“ ersetzen durch: „**Windows-Pfadlänge:** Worktrees liegen unter `~\.verwalter\workspaces\<8 Zeichen>\<Repository>` ([ADR 005](decisions/005-repositories-und-worktrees.md)). Die App setzt `core.longpaths` nicht; tiefe Pfade in einem Repository können beim Anlegen scheitern — dann bleibt nichts zurück, und die Meldung nennt das Repository.“
  - `AGENTS.md`: Critical Rule 5 → „**Der Session-Workspace ist die Sicherheitsgrenze** — Agenten bekommen nur ihre Worktrees (Arbeitsverzeichnis = Workspace, je Worktree ein `--add-dir`), nicht das Benutzerverzeichnis.“
  - `docs/code-map.md`: Zeile „Worktrees anlegen/aufräumen“ um „Prüfen und Neuanlegen vor jedem Agent-Start (`ensure`), Aufräumen nach dem Archivieren (`remove_clean`)“ ergänzen.
  - `docs/design/2026-09-28_hauptansichten/README.md`, Abweichung „Menü einer Session“: Satz „Archivieren blendet aus, es gibt in Meilenstein 4 keine Archiv-Ansicht.“ → „Archivieren blendet aus und räumt Worktrees ohne offene Änderungen weg; es gibt keine Archiv-Ansicht.“

## Report-Back
