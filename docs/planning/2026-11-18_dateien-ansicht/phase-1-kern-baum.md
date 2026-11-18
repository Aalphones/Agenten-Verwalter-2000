# Phase 1 — Kern: Repositories zusammenlegen, Baum und Dateiinhalt lesen

Rating: heikel (Pfadprüfung an der Sicherheitsgrenze, neues Modul). Der Kern lernt, welche Einträge zum selben Repository gehören, liefert je Eintrag den vollständigen Dateibaum samt ignorierter Einträge und liest eine Datei zum Ansehen. Keine Oberfläche in dieser Phase.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Typen, Commands, Konstanten, Linux und macOS), Wackelstellen
- [ADR 067](../../decisions/067-dateien-ansicht.md), [ADR 020](../../decisions/020-innere-repositories.md) (Schlüsselformen), [ADR 014](../../decisions/014-changes-je-session.md)
- `src-tauri/src/changes/sources.rs` — `Source`, `sources` (drei Stellen bauen einen `Source` für ein angehängtes Repository und seine Ticket-Worktrees), `inner_sources` (drei Stellen für ein inneres Repository), `find`
- `src-tauri/src/changes/mod.rs` — `load`, `load_repository`, `load_ticket`, `read_changes`, `failed`, `failed_source`, `validate_path`, `native_path`, `is_binary`, `read_text`, `MAX_UNTRACKED_BYTES`, `BINARY_PROBE_BYTES`
- `src-tauri/src/changes/attribution.rs` — `OwnFile`, `own_files`, `normalize_path`, `Ownership.touched`
- `src-tauri/src/changes/history.rs` — `CommitInfo` (`time` in Sekunden)
- `src-tauri/src/changes/model.rs`, `src-tauri/src/changes/parse.rs` (`MAX_DIFF_LINES`)
- `src-tauri/src/git/mod.rs` — `run_raw`, `args`, `untracked_files` als Muster für neue Git-Aufrufe
- `src-tauri/src/commands/changes.rs` (Muster eines Commands mit `registry.changes_input` und `sources::find`), `src-tauri/src/lib.rs` (Registrierung in `invoke_handler`)
- `src-tauri/src/file_links/mod.rs` — `resolve` als Muster für die Prüfung nach `fs::canonicalize`
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `werkzeuge/git`, `sprachen/typescript`, `frameworks/react`): keine einschlägig. Für Rust und Tauri gibt es keinen Eintrag.

## AK

1. `changes_load` liefert je Eintrag `group`, `groupName`, `isMain`: Haupt-Checkout `"<P>"` / Name des Repositorys / `true`; Ticket-Worktree daneben `"<P>"` / Name des Repositorys ohne ` · <Ordner>` / `false`; inneres Repository `"<P>:<innerer Ordner>"` / `"<Repository>/<innerer Ordner>"` / `true`; dessen Ticket-Worktree dieselbe Gruppe und derselbe Name / `false`. `key`, `name` und `branch` sind unverändert.
2. Jede `FileChange` trägt `lastCommit` (volle ID des letzten eigenen Commits an der Datei, sonst `null`) und `changedAt` in ms (das Spätere aus der Committer-Zeit dieses Commits und dem letzten Schreiben des Agenten; ohne beides `0`).
3. `files_tree` liefert für einen Eintrag alle versionierten und alle neuen, nicht ignorierten Dateien, jede einmal, mit `/` als Trenner, sortiert nach Pfad (Byte-Reihenfolge); symbolische Links tragen `link: true`; Einträge mit Modus `160000` (Submodule) fehlen. `ignored` enthält die von Git ignorierten Einträge so, wie `git status` sie zusammenfasst (ein ignorierter Ordner als ein Eintrag mit `dir: true`), ohne Ordner, in denen `.git` als Datei oder Ordner liegt. Ab `MAX_TREE_FILES` Dateien endet die Liste und `truncated` ist `true`.
4. `files_ignored_children` liefert die direkten Kinder eines ignorierten Ordners, Ordner zuerst, je nach Name sortiert, höchstens `MAX_DIR_ENTRIES`; für einen Pfad, den `git check-ignore` nicht als ignoriert meldet, `CommandError::FileNotAllowed`.
5. `files_read` liefert `Text` für Textdateien (Zeilenenden `\r\n` zu `\n`, höchstens `MAX_DIFF_LINES` Zeilen, sonst `truncated: true`), `Image` mit `data:`-Adresse für Endungen aus `IMAGE_EXTENSIONS` bis `MAX_IMAGE_BYTES`, `Binary` bei einem Nullbyte in den ersten `BINARY_PROBE_BYTES`, `TooLarge` über `MAX_UNTRACKED_BYTES` (bei Bildern über `MAX_IMAGE_BYTES`), `Missing`, wenn es die Datei nicht gibt.
6. Ein Pfad mit `..`, ein absoluter Pfad und ein symbolischer Link, dessen Ziel außerhalb des Ordners des Eintrags liegt, enden für `files_read` und `files_ignored_children` in `CommandError::FileNotAllowed`; ein unbekannter Schlüssel scheitert wie bei `changes_file_diff`.
7. Unter Unix lässt `normalize_path` Groß- und Kleinschreibung und `/` stehen; unter Windows verhält sie sich wie bisher.
8. `pnpm bindings` ausgeführt (neue Dateien `RepoTree.ts`, `TreeFile.ts`, `IgnoredEntry.ts`, `DirEntry.ts`, `FileContent.ts`; geänderte `RepositoryChanges.ts`, `FileChange.ts`), `pnpm check` grün.

## Checkliste

- [x] `changes/sources.rs`: `Source` um `group`, `group_name`, `is_main` erweitern und an allen sechs Baustellen setzen — in `sources`: Haupt-Checkout (`position.to_string()`, `repository.name.clone()`, `true`), Ticket-Worktree (dieselbe Gruppe und derselbe Name, `false`); in `inner_sources`: Fehlerfall und inneres Repository (`key.clone()`, `name.clone()`, `true`), dessen Ticket-Worktrees (`format!("{position}:{inner}")`, `name.clone()`, `false`).
- [x] `changes/model.rs`: `RepositoryChanges` um `group`, `group_name`, `is_main`, `FileChange` um `last_commit`, `changed_at` erweitern, alle `#[serde(default)]`.
- [x] `changes/mod.rs`: `load_repository`, `load_ticket`, `failed_source` und `failed` füllen die drei Felder aus dem `Source` (`failed` bekommt dafür den `Source` oder die drei Werte als Parameter; der Aufruf in `load` für einen panischen Thread ebenso).
- [x] `changes/mod.rs` → `read_changes`: je Datei `last_commit` = `own_files.get(path).map(|file| file.to.clone())`; `changed_at` = Maximum aus der Committer-Zeit dieses Commits (`CommitInfo.time` × 1000, über eine `HashMap<&str, i64>` aus `commits`) und dem Wert aus `own.touched` für den normalisierten absoluten Pfad der Datei (`attribution::normalize_path` auf `worktree.join(native_path(path))`), ohne beides `0.0`.
- [x] `changes/attribution.rs` → `normalize_path`: unter `cfg(windows)` wie bisher; unter `cfg(not(windows))` nur `VERBATIM_PREFIX` entfernen und Schrägstriche am Ende abschneiden. Danach die Aufrufer prüfen (Wackelstelle in der README).
- [x] `git/mod.rs`: drei neue Funktionen mit `run_raw`, je mit Doc-Kommentar des Befehls — `ls_files_staged(dir)` (`git ls-files -z -s`), `ls_files_others(dir)` (`git ls-files -z --others --exclude-standard`), `status_ignored(dir)` (`git status --porcelain=v1 -z --ignored --untracked-files=normal`), dazu `is_ignored(dir, path) -> Result<bool, CommandError>` (`git check-ignore -q -- <path>`, Exit-Code 0 = ignoriert, 1 = nicht, alles andere Fehler).
- [x] Neues Modul `src-tauri/src/files/` mit `mod.rs` (Modul-Doc, `pub mod model; pub mod tree; pub mod read;`), in `lib.rs` als `mod files;` eintragen.
- [x] `files/model.rs`: `TreeFile`, `IgnoredEntry`, `RepoTree`, `DirEntry`, `FileContent` nach Kontrakt, alle mit `TS`-Ableitung wie in `changes/model.rs`.
- [x] `files/tree.rs` → `pub fn tree(dir: &Path) -> Result<RepoTree, CommandError>`: Ausgabe von `ls_files_staged` an `\0` trennen, je Eintrag `<Modus> <Objekt> <Stufe>\t<Pfad>`; Modus `160000` auslassen, `120000` → `link: true`; Pfade aus `ls_files_others` dazu (`link` aus `fs::symlink_metadata`); doppelte Pfade (mehrere Stufen bei Konflikt) einmal; sortieren; bei `MAX_TREE_FILES` abschneiden. `ignored` aus `status_ignored`: Einträge mit Präfix `!! `, Pfad ohne Schrägstrich am Ende, `dir` = endete auf `/`; auslassen, wenn `dir.join(<Pfad>).join(".git")` existiert.
- [x] `files/tree.rs` → `pub fn ignored_children(dir: &Path, path: &str) -> Result<Vec<DirEntry>, CommandError>`: `changes::validate_path`, Pfad prüfen (nächster Punkt), `git::is_ignored` verlangen, `fs::read_dir` eine Ebene, Namen als UTF-8 (`to_string_lossy`), `dir`/`link` aus `fs::symlink_metadata`, Ordner zuerst, dann nach Name; bei `MAX_DIR_ENTRIES` abschneiden.
- [x] `files/mod.rs` → `pub(crate) fn checked_path(dir: &Path, path: &str) -> Result<PathBuf, CommandError>`: `changes::validate_path(path)?`, `dir.join(native_path(path))` (dafür `native_path` in `changes/mod.rs` auf `pub(crate)` setzen), beide Seiten `fs::canonicalize`, Ziel muss mit dem Ordner beginnen, sonst `FileNotAllowed("Liegt außerhalb des Repositorys")`; existiert der Pfad nicht, `Ok` mit dem unkanonischen Pfad, damit `read` `Missing` melden kann. Rückgabe ist der unkanonische Pfad (Präfix `\\?\` vermeiden, wie in `file_links::resolve`).
- [x] `files/read.rs` → `pub fn read(dir: &Path, path: &str) -> Result<FileContent, CommandError>`: `checked_path`; fehlt die Datei oder ist es ein Ordner → `Missing`; Größe aus `fs::metadata`; Endung in `IMAGE_EXTENSIONS` → bis `MAX_IMAGE_BYTES` `Image` mit `data:<MIME>;base64,…` (MIME: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `image/x-icon`; Base64 mit dem Crate, das das Projekt schon führt — in `Cargo.toml` nach `base64` suchen, sonst als Abhängigkeit aufnehmen), darüber `TooLarge`; sonst über `MAX_UNTRACKED_BYTES` → `TooLarge`; Nullbyte in den ersten `BINARY_PROBE_BYTES` → `Binary`; sonst `Text` (verlustbehaftet nach UTF-8, `\r\n` → `\n`, an `MAX_DIFF_LINES` Zeilen gekürzt).
- [x] `commands/files.rs`: `files_tree`, `files_ignored_children`, `files_read` nach dem Muster von `changes_file_diff` (`registry.changes_input(&session_id, ChangesReach::Project)`, `sources::find`, dann `source.dir`); trägt der `Source` einen `error`, diesen als `CommandError::Git` zurückgeben. In `commands/mod.rs` und im `invoke_handler` von `lib.rs` eintragen.
- [x] `src/lib/files.ts`: `loadRepoTree(sessionId, key)`, `loadIgnoredChildren(sessionId, key, path)`, `readFile(sessionId, key, path)` mit `@throws`-Kommentar wie in `src/lib/changes.ts`.
- [x] `pnpm bindings`, `pnpm check`.
- [x] Doku: in `docs/code-map.md` die Zeile „Dateien (Baum, Inhalt)“ mit `src-tauri/src/files/`, `src-tauri/src/commands/files.rs`, `src/lib/files.ts` anlegen; in `docs/glossary.md` „Repository-Knoten (Gruppe)“ und „Anker“ nach den Begriffen der README.

## Report-Back

Status: complete (2026-11-18). `pnpm bindings` und `pnpm check` grün; nicht in der echten App gelaufen.

- Wackelstelle `normalize_path`: drei Aufrufer setzten `\` als Trenner des Ergebnisses voraus (`changes::has_touched_under`, `sessions/registry/overlaps.rs` `is_inside`, `artifacts` `artifact_file_of`/`touches_of`/`normalize_separators`). Neu `attribution::NORMALIZED_SEPARATOR` (`\` unter Windows, sonst `/`), alle drei darauf umgestellt; unter Windows unverändert. Der Unix-Zweig ist lokal nicht kompiliert (kein Linux-Target installiert) — Beleg erst im Kompilier-Check der CI.
- Wackelstelle `ts-rs`: `FileContent.ts` ist die erwartete Vereinigung mit `kind: "text" | "image" | "binary" | "tooLarge" | "missing"`.
- `git status` widerspricht der Regel „nur Plumbing“ (ADR 006); lesende Aufrufe laufen mit `GIT_OPTIONAL_LOCKS=0` und nehmen keine Sperre. Ausnahme in `docs/conventions/rust.md` vermerkt.
- `native_path` lag schon öffentlich in `filesystem/`; die Checklisten-Zeile „in `changes/mod.rs` auf `pub(crate)`“ entfiel. `MAX_UNTRACKED_BYTES`, `BINARY_PROBE_BYTES`, `is_binary` sind jetzt `pub(crate)`.
- `RepositoryChanges` entsteht in `changes/mod.rs` nur noch über `empty_entry`/`failed` aus dem `Source`; die Gruppenfelder können so nicht vergessen werden.
- `FileContent::Text.lineCount` zählt die Zeilen der ganzen Datei, auch wenn `text` gekürzt ist.
