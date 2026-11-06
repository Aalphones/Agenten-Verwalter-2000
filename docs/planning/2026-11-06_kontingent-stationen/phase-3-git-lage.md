# Phase 3 — Git-Lage in der ersten Stationsnachricht

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Abschnitt „Entscheidungen“ — [README.md](README.md)
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/linting.md`
- Code:
  - `src-tauri/src/implementation/start.rs`: `FIRST_MESSAGE_FOOTER` Zeile 15–17, `first_message` Zeile 21–77, `start_claimed` mit `bind_station` (Zeile 202) und dem Aufruf von `first_message` (Zeile 222).
  - `src-tauri/src/commands/git.rs` Zeile 22–30: Muster für den Aufruf von `registry.changes_input(…)`, `registry.busy_in_project(…)` und `status::session_status(&input, busy)`.
  - `src-tauri/src/git/model.rs`: `GitOperation` mit den Varianten `None`, `Merge`, `Rebase` (Zeile 10–14), `GitOwnCommit` Zeile 37–49, `GitEntryStatus` Zeile 51–76, `GitSessionStatus` Zeile 78–85.
  - `src-tauri/src/changes/model.rs` Zeile 26–34: `ChangesReach::Project` umfasst alle Sessions des Vorhabens.
- Warum: In den gemessenen Stationen gingen 136 von rund 1 000 Aufrufen an git (log, status, diff, fetch, branch), viele davon zur Orientierung am Anfang. Die Lage steht im Verwalter schon fertig berechnet bereit.
- Vault-Fehlerklassen: keine Entity für Rust im Vault vorhanden.

## AK dieser Phase

1. Neue Funktion `git_lines(status: &GitSessionStatus) -> Vec<String>` in `start.rs`, mit einer Zeile je Eintrag:
   - Normalfall: `- <key>: Branch <branch>[ → <upstream>], ↑<ahead> ↓<behind>, <n> fremde Änderungen[, Konflikte: <n>][, Merge läuft | Rebase läuft][; zuletzt: <short_id> <subject>; …]`.
   - Höchstens 3 Commits, neueste zuerst. Ohne Branch steht `losgelöster HEAD`.
   - Mit `error`: `- <key>: Git-Zustand nicht lesbar (<error>)`.
2. `first_message` bekommt den Parameter `git_lines: &[String]`. Ist er nicht leer, stehen `Git-Lage:` und die Zeilen nach dem Block „Vorgänger:“ und vor der Leerzeile mit dem Footer.
3. `start_claimed` ermittelt die Lage nach `bind_station` mit `ChangesReach::Project` für die neue Session. Scheitert das, steht eine Zeile im Session-Log („Git-Lage nicht ermittelt: …“) und die Nachricht geht ohne Block raus.
4. Rust-Tests für `git_lines` (Normalfall, Fehler, losgelöster HEAD, Kürzung auf 3 Commits) und für `first_message` mit und ohne Git-Zeilen sind grün; `pnpm check` ist grün.

## Checkliste

- [ ] `start.rs`: `git_lines` nach AK 1. Imports: `crate::git::model::{GitEntryStatus, GitOperation, GitSessionStatus}`. Eine private Hilfsfunktion `entry_line(entry: &GitEntryStatus) -> String` hält `git_lines` kurz.
- [ ] `first_message(view, phase, station, git_lines: &[String])`: Block nach `Vorgänger:` einfügen:
  ```rust
  if !git_lines.is_empty() {
      lines.push("Git-Lage:".to_owned());
      lines.extend(git_lines.iter().cloned());
  }
  ```
- [ ] `start_claimed`, nach `registry.bind_station(…)?` und vor `first_message`:
  ```rust
  let git: Vec<String> = match registry
      .changes_input(&created.id, ChangesReach::Project)
      .and_then(|input| Ok(status::session_status(&input, registry.busy_in_project(&created.id)?)))
  {
      Ok(found) => git_lines(&found),
      Err(error) => {
          registry.log_session_line(&created.id, format!("Git-Lage nicht ermittelt: {error}"));
          Vec::new()
      }
  };
  let message: String = first_message(&view, phase, station, &git);
  ```
  Imports: `crate::changes::model::ChangesReach`, `crate::git::status`.
- [ ] Alle weiteren Aufrufer von `first_message` (Grep über `src-tauri/`, auch Tests und `examples/`) bekommen `&[]`.
- [ ] Tests in `src-tauri/src/implementation/tests.rs` (dort liegen die Tests des Moduls):
  - `GitSessionStatus { entries: vec![…], busy: vec![] }` von Hand bauen, mit `GitOperation::None`, `foreign: vec![]` und `conflicted: vec![]`.
  - Fälle aus AK 4.
  - `first_message` mit einem View aus den vorhandenen Helfern der Datei (z. B. `station(stage, model, skill)` aus Zeile 6) prüfen: „Git-Lage:“ steht vor der Leerzeile, ohne Zeilen fehlt der Block.
- [ ] `pnpm check`.
- [ ] `docs/glossary.md`: Eintrag „Erste Nachricht (Station)“ ergänzen, falls vorhanden (Grep „erste Nachricht“); sonst nichts.

## Definition of Done

- AK 1–4 erfüllt, belegt durch Tests.
- Für den Benutzer sichtbar: Die erste Nachricht einer neuen Station zeigt im Chat den Block „Git-Lage:“ mit Branch, Vorsprung und letzten Commits je Repo.
- Ausgeführt und mit Summary-Zeile im Report-Back festgehalten: `cargo test --manifest-path src-tauri/Cargo.toml implementation` und `pnpm check`.
- Seven-Goals-Check im Report-Back.

## Report-Back

Umgesetzt in `start.rs`: `git_lines`, `entry_line`, Parameter `git_lines` an `first_message`, Ermittlung in `start_claimed`. Keine Tests (privates Profil); `pnpm check` grün.
