# Phase 1 — Erkennung: innere Repositories, ihre Ticket-Worktrees, Prüfprogramm, ADR 020

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ und „Kontrakt“ (Abschnitt `worktrees`) — verbindlich.
- `src-tauri/src/worktrees/mod.rs` ganz: `TicketRoot`, `ticket_roots`, `mentioned_ticket_worktrees`, `ticket_worktrees`, `main_checkout_since`, `read_base`, `normalized_dir`.
- `src-tauri/src/sessions/registry.rs`: Feld `ticket_roots` in `SessionState` (Doc-Kommentar „Fest ab Anlegen“), die Aufrufe von `worktrees::ticket_roots` in `restore`, `create_project`, `create_in_project`, `add_repository` (dort im `update`-Closure) und `start_process` (dort läuft `worktrees::ensure` unter der Session-Sperre).
- `src-tauri/src/changes/history.rs` (Muster für einen Zwischenspeicher: `OnceLock<Mutex<HashMap<…>>>`, Leeren über einer Obergrenze).
- `src-tauri/src/db/mod.rs` (`Database::open`), `src-tauri/src/db/session_repositories.rs` (`load`), `src-tauri/src/db/session_ticket_worktrees.rs` (`load`), `src-tauri/src/db/session_files.rs` (`load_for`), `src-tauri/examples/gen-bindings.rs` (Aufbau eines Beispielprogramms, Import über `verwalter_lib::…`).
- [ADR 014](../../decisions/014-changes-je-session.md) und [ADR 018](../../decisions/018-ordner-ohne-git.md) als Formvorlage für ADR 020.
- [docs/conventions/rust.md](../../conventions/rust.md), [linting.md](../../conventions/linting.md), [commits.md](../../conventions/commits.md).
- Fehlerklassen geprüft: Vault `werkzeuge/git` — „Standard-Branch nicht aus dem ausgecheckten Branch lesen“ ist durch `git::default_branch` (`symbolic-ref`) schon abgedeckt; keine Rust-/Tauri-Entity im Vault. Sonst keine einschlägig.

**Chesterton:** `TicketRoot` ist das Präfix, an dem `mentioned_ticket_worktrees` im Text eines Werkzeug-Aufrufs einen Ticket-Worktree erkennt — reine Textprüfung, weil sie unter der Session-Sperre läuft. Das bleibt so: die neue Erkennung der inneren Repositories (Dateisystem) passiert in `ticket_roots`, nie in `mentioned_ticket_worktrees`. `ticket_worktrees` prüft über `git worktree list`, dass ein gemerkter Ordner wirklich ein Worktree genau dieses Repositorys ist — diese Prüfung ist die Sicherheitsgrenze und bleibt in `ticket_worktrees_in` unverändert.

## Abnahmekriterien

- `inner_repositories(C:\Users\smick\develop\easyfitness\facepass)` liefert genau die Unterordner, deren `.git` ein Ordner ist — Gegenprobe in Git Bash: `cd /c/Users/smick/develop/easyfitness/facepass && for d in */; do [ -d "$d.git" ] && echo "${d%/}"; done`. Die Worktree-Ordner (`app-wt-*`, `app-build-*` mit `.git`-Datei) sind nicht dabei.
- `ticket_roots` für eine Session mit facepass als `Main` enthält die Wurzel `facepass-wt-` (`inner: None`) und je inneres Repository `<name>-wt-` mit `inner: Some(<name>)`.
- `ticket_root_of` ordnet `admin-app-wt-gymid-2111` der Wurzel `admin-app` zu, nicht `app`; `app-wt-gymid-2288` der Wurzel `app`; `facepass-wt-x` der Wurzel ohne `inner`; `irgendwas` keiner.
- Ein Vorhaben mit einem Repository ohne innere Repositories: `ticket_roots` liefert genau die eine Wurzel wie vorher.
- `changes-probe` gegen eine **Kopie** der Datenbank gibt für Session `a6357b9c-e08c-411a-9fcc-62a88321300a` die Wurzeln aus und ordnet ihre geschriebenen Dateien den Ticket-Worktrees `(0, app-wt-gymid-2288)` und `(0, android-wt-gymid-2288)` zu; gegen die echte Datenbank (`%USERPROFILE%\.verwalter\verwalter.db`) verweigert es den Start.
- `pnpm check` grün, `pnpm bindings` ändert nichts.

## Checkliste

### ADR

- [ ] `docs/decisions/020-innere-repositories.md` nach Vorlage ADR 014/018: Kontext (facepass-Aufbau, warum die Changes leer waren), betrachtete Optionen (die verworfenen aus „Festgelegte Entscheidungen“ plus „Workaround: innere Repos einzeln ans Vorhaben hängen“ — verworfen, weil jede Session es von Hand tun müsste und die Worktree-Zuordnung dann vom Zeitpunkt des Anhängens abhinge), Entscheidung (alle Punkte aus „Festgelegte Entscheidungen“), Konsequenzen (je inneres Repository ein `rev-list` je Nachladen und je Git-Befehl des Agenten, bei facepass acht — gemessen 2026-10-02 zusammen gut 1 s nacheinander, deshalb parallel; frühere Commits bleiben unbekannt; „Löst ab: in ADR 018 die Folge ‚`git` läuft für ihn nie‘ …“). Status „angenommen“, Datum 2026-10-02.

### `src-tauri/src/worktrees/mod.rs`

- [ ] `TicketRoot` bekommt das Feld `inner: Option<String>` mit dem Doc-Kommentar aus dem Kontrakt.
- [ ] `pub fn inner_repositories(folder: &Path) -> Vec<String>`: `fs::read_dir(folder)`; Fehler → leere Liste. Je Eintrag: Name als `String` (`to_string_lossy`), überspringen, wenn er mit `.` beginnt; behalten, wenn `entry.path().join(".git").is_dir()`. Sortieren mit `sort_by_key(|name| name.to_ascii_lowercase())`. Doc-Kommentar: Definition „inneres Repository“ aus dem README in einem Satz.
- [ ] `ticket_roots` umbauen: je Repository mit Index
  - `RepositoryCheckout::AppWorktree` → nichts;
  - `RepositoryCheckout::Main` → zuerst die bisherige Wurzel mit `inner: None`, dann die inneren;
  - `RepositoryCheckout::Folder` → nur die inneren.
  - Innere: für jeden Namen aus `inner_repositories(&repository.repository_path)` eine Wurzel `prefix = format!("{name}{TICKET_WORKTREE_INFIX}").to_ascii_lowercase()`, `inner: Some(name)`.
  - Doc-Kommentar anpassen (Inhalt laut Kontrakt, „liest je Repository einmal das Verzeichnis“).
- [ ] `pub fn ticket_root_of<'a>(roots: &'a [TicketRoot], position: u32, folder: &str) -> Option<&'a TicketRoot>`: `let lower = folder.to_ascii_lowercase();` Kandidaten `root.position == position && lower.starts_with(&root.prefix)`, davon `max_by_key(|root| root.prefix.len())`.
- [ ] Basis eines inneren Repositorys:
  - Den Closure `base` in `main_checkout_since` in eine private Funktion `fn base_since(repository_path: &Path, since_ms: f64) -> Result<(String, String), CommandError>` ziehen (Rückgabe `(base_ref, base_commit)`, Logik unverändert); `main_checkout_since` ruft sie auf.
  - Zwischenspeicher `static INNER_BASES: OnceLock<Mutex<HashMap<String, (String, String)>>>`, Schlüssel `format!("{}|{}", normalized_dir(path), since_seconds)` mit `since_seconds = (since_ms / 1000.0) as i64`; Obergrenze `const MAX_CACHED_BASES: usize = 1_000` — darüber `clear()` vor dem Einfügen (wie `history.rs`). Nur Erfolge werden gespeichert. Sperre mit `unwrap_or_else(PoisonError::into_inner)`.
  - `pub fn inner_checkout(outer: &SessionRepository, folder: &str, since_ms: f64) -> Result<SessionRepository, CommandError>`: `repository_path = outer.repository_path.join(folder)`; Basis aus dem Zwischenspeicher bzw. `base_since` (Fehler mit `prefixed(folder, error)`); Ergebnis `SessionRepository { name: folder.to_owned(), repository_path, base_ref, base_commit, checkout: RepositoryCheckout::Main }`.
- [ ] `ticket_worktrees` in `pub fn ticket_worktrees_in(repository, position, folders, parent: &Path)` umbenennen; im Körper `let Some(parent) = repository.repository_path.parent()` entfällt, `parent` kommt als Parameter. Neue `pub fn ticket_worktrees(repository, position, folders)` mit unverändertem Doc-Kommentar ruft `ticket_worktrees_in` mit `repository.repository_path.parent()` auf (ohne Elternordner → leere Liste). Alle bisherigen Aufrufer bleiben unverändert.

### `src-tauri/src/sessions/registry.rs`

- [ ] Doc-Kommentar des Felds `ticket_roots`: „Woran die Ticket-Worktrees der Repositories und ihrer inneren Repositories zu erkennen sind; beim Anlegen, Laden und jedem Agent-Start neu bestimmt (liest die Verzeichnisse der Repositories).“
- [ ] `start_process`: direkt nach `let repositories = session.repositories();` die Zeile `state.ticket_roots = worktrees::ticket_roots(&repositories);` mit Kommentar „Ein inneres Repository, das seit dem letzten Start dazukam, wird so erkannt.“
- [ ] `add_repository`: vor der Schleife `for session in &members` keine Änderung an der Reihenfolge, aber in der Schleife die Wurzeln **vor** `update(...)` berechnen (`let roots = worktrees::ticket_roots(&session.repositories());`) und im Closure nur zuweisen (`state.ticket_roots = roots;` — Closure wird dafür `move` bzw. `roots` per `clone()` hineingegeben). Grund als Kommentar: Verzeichnis lesen nicht unter der Session-Sperre.
- [ ] `restore`, `create_project`, `create_in_project`: unverändert (rufen dieselbe Funktion; dort hält keine Session-Sperre).

### Prüfprogramm `src-tauri/examples/changes-probe.rs`

- [ ] Kopfkommentar: „Zeigt, was die Changes für eine Session aus einer **Kopie** der Datenbank ermitteln. Aufruf: `cargo run --manifest-path src-tauri/Cargo.toml --example changes-probe -- <Datenbank-Kopie> <Session-ID> [session|project]`.“
- [ ] `fn main() -> Result<(), Box<dyn std::error::Error>>`; Argumente aus `std::env::args()`; fehlen sie → Aufruf-Zeile auf stderr, Exit-Code 2.
- [ ] Schutz: ist der kanonische Pfad (`fs::canonicalize`) gleich dem von `%USERPROFILE%\.verwalter\verwalter.db` (Umgebungsvariable `USERPROFILE`) → Abbruch mit „Nur gegen eine Kopie: <Pfad> ist die Datenbank der App.“, Exit-Code 2. Grund als Kommentar: `Database::open` führt Migrationen aus.
- [ ] `Database::open(path)`, dann in `database.with(|connection| …)`: `session_repositories::load`, `session_ticket_worktrees::load`, `session_files::load_for(connection, &[id])`.
- [ ] Ausgabe (Textzeilen, keine JSON in dieser Phase): je Repository `Position, Name, Pfad, Art`; je Wurzel aus `worktrees::ticket_roots(&repositories)` `Position, Präfix, inner`; gemerkte Ticket-Worktrees; je geschriebene Datei die Treffer von `worktrees::mentioned_ticket_worktrees(&roots, path)` und für jeden Treffer `ticket_root_of(...).and_then(|root| root.inner.clone())`.
- [ ] Datenbank-Kopie fürs Prüfen: `verwalter.db`, `verwalter.db-wal`, `verwalter.db-shm` aus `%USERPROFILE%\.verwalter\` gemeinsam in einen Ordner außerhalb des Repos kopieren (Scratchpad).

### Abschluss

- [ ] `pnpm check` grün; `pnpm bindings` und `git status src/lib/bindings` zeigt nichts.
- [ ] Commit `feat(changes): innere Repositories und ihre Ticket-Worktrees erkennen` (Body: ADR 020, Prüfprogramm).

## Definition of Done

- Alle Abnahmekriterien erfüllt, belegt durch die Ausgabe von `changes-probe` und der Gegenprobe-Zeile im Report-Back.
- Sichtbar für Sascha: noch nichts in der App (die Changes ändern sich erst in Phase 2); das Prüfprogramm zeigt die Zuordnung.
- Artefakt: Ausgabe von `changes-probe` für Session `a6357b9c-…` (Repositories, Wurzeln, Zuordnung der geschriebenen Dateien) im Report-Back.
- Sieben Ziele kurz geprüft (Rubrik `knowledge/topics/goals-rubric.md`).

## Report-Back
