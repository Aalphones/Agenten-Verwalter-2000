# Phase 3 — Commit-Suche in inneren Repositories, Doku, Abnahme

## Kontext (vor dem Start lesen)

- [README dieses Plans](README.md) („Festgelegte Entscheidungen“, „Kontrakt“, Smoke-Checkliste), Report-Backs von Phase 1 und 2, [FINDINGS.md](FINDINGS.md).
- `src-tauri/src/changes/scan.rs` ganz (`session_dirs`, `own_commits`), `src-tauri/src/sessions/registry/commit_scan.rs`.
- `src-tauri/src/changes/sources.rs` und `ChangesInput` in `changes/mod.rs` aus Phase 2; `changes::attribution::Ownership` (`Default`).
- `src-tauri/src/sessions/registry.rs`: `SessionState` (`ticket_roots`, `ticket_worktrees`, `created_at`), `update` (ruft `commit_scan::schedule` nach der Sperre).
- Doku: [docs/code-map.md](../../../code-map.md) (Zeilen „Changes“ und „Repositories einer Session, Worktrees“), [docs/glossary.md](../../../glossary.md) („Ticket-Worktree“, „Ordner ohne Git“), [AGENTS.md](../../../../AGENTS.md) (Tabelle „Befehle“), [STATE.md](../../../../STATE.md), [docs/archive/2026-10/2026-10-01_changes-review/FINDINGS.md](../2026-10-01_changes-review/FINDINGS.md).
- [docs/conventions/rust.md](../../../conventions/rust.md), [linting.md](../../../conventions/linting.md), [commits.md](../../../conventions/commits.md), [releases.md](../../../conventions/releases.md).
- Fehlerklassen: wie Phase 1, keine weitere einschlägig.

**Chesterton:** `session_dirs` liefert die Ordner, in denen nach einem Git-Befehl des Agenten neue Commits gesucht werden, je mit der Basis, ab der sie zählen (ADR 014). Die Suche läuft in einem eigenen Thread, weil Git nicht unter die Session-Sperre gehört — das bleibt: unter der Sperre werden nur Werte geklont.

## Abnahmekriterien

- `session_dirs` liefert für eine FacePass-Session den Haupt-Checkout `facepass`, jedes innere Repository (`facepass\app`, `facepass\android`, …) und die gemerkten Ticket-Worktrees der inneren Repositories — Prüfung über `changes-probe` (neue Ausgabe „Suchordner“, siehe Checkliste).
- Für eine Session ohne innere Repositories liefert `session_dirs` dieselben Ordner und Basen wie vor der Phase (Probe vorher/nachher).
- Glossar, Code-Map, AGENTS.md beschreiben innere Repositories, die Schlüsselform und das Prüfprogramm.
- `pnpm check` grün, `pnpm bindings` ändert nichts.

## Checkliste

### Commit-Suche

- [x] `changes/scan.rs`: `session_dirs(input: &ChangesInput) -> Vec<ScanDir>` — aus `sources::sources(input)`: Einträge mit `error` überspringen; `dir` = `source.dir`; überspringen, wenn `!source.repository.repository_path.join(".git").exists() || !source.dir.is_dir()`; `base` = bei `source.ticket` `worktrees::ticket_base(&source.repository, ticket)` (Fehler → überspringen), sonst `source.repository.base_commit.clone()`. Doc-Kommentar: „je Eintrag der Changes ein Suchordner, auch innere Repositories und ihre Ticket-Worktrees (ADR 020)“. Nicht mehr benutzte Importe (`folders_of`, `is_plain_folder`, `worktrees`) entfernen; werden `folders_of`/`is_plain_folder` danach nirgends mehr gebraucht, entfallen sie.
- [x] `sessions/registry/commit_scan.rs`: im Thread `let repositories = session.repositories();` dann unter **einer** Sperre `(ticket_roots, ticket_worktrees, created_at)` klonen und `ChangesInput { workspace: session.workspace.clone(), repositories, ticket_roots, ticket_folders: ticket_worktrees, since_ms: created_at, own: Ownership::default() }` bauen; `scan::session_dirs(&input)`. Kommentar: Basis der inneren Repositories = vor dem Anlegen der Session; eigene Commits liegen immer danach.
- [x] `changes/scan.rs` `own_commits`: die Ordner parallel lesen — `thread::scope`, ein Thread je `ScanDir` liefert seine Treffer (`Vec<RevListEntry>` bzw. die IDs im Fenster), danach in der Reihenfolge von `dirs` zusammenführen und Doppelte wie bisher weglassen. Grund als Kommentar: acht innere Repositories nacheinander kosten gemessen gut 1 s je Git-Befehl des Agenten.
- [x] `changes-probe`: zusätzlich die Zeilen „Suchordner: <Ordner> ab <Basis>“ aus `scan::session_dirs` für die Reichweite `session` ausgeben (vor dem JSON, auf stderr, damit das JSON maschinenlesbar bleibt).

### Doku

- [x] `docs/glossary.md`: neuer Begriff **Inneres Repository** hinter „Haupt-Checkout“: „Ein Git-Repository direkt in einem angehängten Repository oder Ordner ohne Git (Unterordner mit `.git`-Ordner, eine Ebene tief). Seine Ticket-Worktrees `<Name>-wt-*` liegen daneben im angehängten Ordner. Die Changes zeigen es als `<Repository>/<Name>`, sobald die Reichweite darin etwas committet oder geschrieben hat ([ADR 020](decisions/020-innere-repositories.md)).“ Beim Begriff „Ticket-Worktree“ einen Halbsatz ergänzen: „… bei einem inneren Repository im angehängten Ordner (→ Inneres Repository)“. Bei „Ordner ohne Git“: „zeigt keine Changes“ → „zeigt für den Ordner selbst keine Changes, wohl aber für seine inneren Repositories“.
- [x] `docs/code-map.md`: Zeile „Changes“ um `sources.rs` (`Source`, `sources`, `find`, `scope_ticket_folders`; Schlüssel `"<Position>"`, `"<Position>/<Ordner>"`, `"<Position>:<Ordner>"`) ergänzen und `changes_file_diff` „mit Prüfung des Eintrags-Schlüssels über `sources::find`“; Zeile „Repositories einer Session, Worktrees“ um `inner_repositories`, `ticket_root_of`, `inner_checkout`, `ticket_worktrees_in`; Zeile „Generierte Typen“ bzw. eine neue Zeile „Prüfprogramm Changes“: `src-tauri/examples/changes-probe.rs`. Stand-Satz am Kopf nicht umschreiben, nur ergänzen, falls er Features aufzählt.
- [x] `AGENTS.md`, Tabelle „Befehle“: Zeile `cargo run --manifest-path src-tauri/Cargo.toml --example changes-probe -- <Datenbank-Kopie> <Session-ID> [session\|project] [<Schlüssel> <Pfad>]` — „zeigt, was die Changes einer Session aus einer Kopie der Datenbank ermitteln; nie gegen `%USERPROFILE%\.verwalter\verwalter.db`“.
- [x] `docs/planning/2026-10-01_changes-review/FINDINGS.md`: Eintrag `- [x] → Phase 2: Der Plan „Innere Repositories“ (ADR 020) hat die Auflösung Schlüssel → Ordner schon nach `changes/sources.rs` gezogen (`sources::find(&input, key) -> Source`, `Source.dir` ist der Ordner, `changes::file_diff(&source, path, scope, &input.own)`). Kein eigenes `changes/entry.rs` anlegen; `resolve` = `registry.changes_input(…)` + `sources::find`. Schlüssel haben eine dritte Form `"<Position>:<Ordner>"` (inneres Repository oder dessen Ticket-Worktree).`
- [x] `STATE.md`: diesen Plan in die Reihenfolge eintragen (Status nach Abschluss), Abschnitt „Offen“: Smoke-Checkliste „Innere Repositories“ ohne Abnahme.

### Abschluss

- [x] `pnpm check` grün; `pnpm bindings` ändert nichts.
- [x] Commit `feat(changes): eigene Commits auch in inneren Repositories finden` (Body: Commit-Suche, Doku, Prüfprogramm in AGENTS.md).
- [ ] Archivieren und Release nach `mode-implementing` und [releases.md](../../../conventions/releases.md): neues Verhalten → Minor-Nummer (`0.10.2` → `0.11.0`), erst nach Saschas Smoke-Abnahme taggen.

## Definition of Done

- Alle Abnahmekriterien erfüllt, belegt durch Probe-Ausgaben im Report-Back.
- Sichtbar für Sascha: ein neuer Commit eines Agenten in einem inneren Ticket-Worktree erscheint wenige Sekunden später in den Changes der Session (Smoke 1).
- Artefakt: Probe-Ausgabe „Suchordner“ für eine FacePass-Session und für eine Session ohne innere Repositories (vorher/nachher gleich).
- Sieben Ziele kurz geprüft.

## Report-Back

Erledigt: `session_dirs(&ChangesInput)` leitet die Suchordner aus `sources::sources` ab (Haupt-Checkout, Ticket-Worktrees daneben, innere Repositories, deren Ticket-Worktrees); `own_commits` liest die Ordner in einem Thread je Ordner und führt in Reihenfolge von `dirs` zusammen; `commit_scan` baut dafür ein `ChangesInput` (eine Sperre, `since_ms` = Anlegen der Session); `folders_of` entfällt. `changes-probe` schreibt für Reichweite `session` „Suchordner: <Ordner> ab <Basis>“ nach stderr, aus einem Eingang wie in `commit_scan` (nur gemerkte Ticket-Worktrees). Doku: Glossar, Code-Map, AGENTS.md, FINDINGS Changes-Review, STATE.md.

Belege (Privatmaschine, Nachbildung unter `%TEMP%\verwalter-probe\`): `pnpm check` grün, `pnpm bindings` ohne Änderung in `src/lib/bindings/`. Probe Session `b1b4ca67…` (Dach-Repo mit inneren Repositories): Suchordner `dach` (Basis leer, Dach ohne früheren Commit), `dach\admin-app`, `dach\Android`, `dach\app`, `dach\app-wt-gymid-2288` (alle mit Basis), `ordner\notes`. Sessions ohne innere Repositories (`d8c9276b…`, `1f95c3b5…`, `e824d4cc…`): je genau ein Suchordner, der Haupt-Checkout mit seiner Basis.

Nicht belegt: ein Vorher/Nachher-Vergleich der Suchordner für Sessions ohne innere Repositories per Programmlauf (die alte `session_dirs` gibt es nicht mehr; die Gleichheit folgt aus dem Code: gleiche Basis `base_commit`, gleiche Bedingung `.git` vorhanden und Ordner da). Die facepass-Läufe (FINDINGS Phase 3) und die Smoke-Checkliste laufen auf dem Arbeitslaptop.