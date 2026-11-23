# Phase 2 — Index-Datei und Abgleich

**Stufe:** heikel (Schema, Hintergrund-Thread, Abgleich) · **Ziel:** Der Verwalter liest den Vault in die eigene Datei `index.db` ein — beim Start, auf Knopfdruck und nach einer Änderung der Einstellung —, liest dabei nur geänderte Dateien und blockiert nie. Die Abschnitte sind in dieser Phase noch grob (eine Datei = ein Abschnitt); Phase 3 ersetzt das.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans (Kontrakt: Index-Schema, `VaultStatus`) und [ADR 068](../../decisions/068-developer-vault.md).
- Ergebnis von Phase 1: `src-tauri/src/vault/`.
- Muster Verbindung hinter einem Mutex: `src-tauri/src/db/mod.rs` (`Database::open`, `with`, Pragmas). Die Index-Datei bekommt eine **eigene** Struktur, nicht `Database` (deren `open` fährt die Migrationen der Hauptdatenbank).
- Muster Thread mit Ereignis: `src-tauri/src/sessions/auto_handoff.rs` (eigener Thread, `app.emit`).
- Dateidurchlauf: Crate `ignore` (schon Abhängigkeit, z. B. in `src-tauri/src/standalone/tools/walk.rs`); Hash: `sha2` (schon Abhängigkeit, z. B. `src-tauri/src/voice/model_file.rs`).
- Fehlerklassen (Vault `systeme/sqlite` → „Fehlerklassen“): **Eine lange Leseverbindung lässt das WAL unbegrenzt wachsen** — daraus: kurze Transaktionen, je Datei eine; nie eine Transaktion über den ganzen Abgleich.
- Konventionen: `docs/conventions/rust.md`.

## Abnahmekriterien der Phase

1. `index.db` liegt unter `<Datenordner>\vault\index.db`; `meta` trägt `schema_version` = `1` und `vault_dir` (kanonischer Pfad). Stimmt eines davon nicht mit dem aktuellen Stand überein, oder lässt sich die Datei nicht öffnen, wird sie samt `-wal`/`-shm` gelöscht und neu angelegt.
2. Ein Abgleich läuft immer in einem eigenen Thread; höchstens einer gleichzeitig. Kommt eine Anforderung während eines Laufs, folgt genau ein weiterer Lauf danach.
3. Auslöser: App-Start (wenn eingeschaltet), `settings_update` mit `VaultDir`/`VaultEnabled` (wenn danach eingeschaltet), Command `vault_rescan`, und `vault::ensure_fresh` (wenn der letzte Abgleich mehr als 30 000 ms zurückliegt und keiner läuft). `Missing`/`Error`/`Off` → kein Lauf, der vorhandene Index bleibt liegen.
4. Durchlauf mit `ignore::WalkBuilder`: `hidden(true)`, `git_ignore(true)`, `git_exclude(true)`, `git_global(false)`, `parents(true)`, `require_git(false)`, `follow_links(false)`, `add_custom_ignore_filename(".vaultignore")`; nur Dateien.
5. Gleiche Größe und gleiche Änderungszeit (ms) wie gespeichert und kein gespeicherter Fehler → die Datei wird nicht geöffnet. Sonst: bis 2 MiB lesen, SHA-256 bilden; gleicher Hash → nur Größe/Zeit aktualisieren; anderer Hash → Abschnitte ersetzen. Über 2 MiB: nicht lesen, `hash` = `''`, ein Abschnitt mit dem Dateinamen.
6. Fehler beim Lesen einer Datei → Zeile in `files` mit `error`, keine Abschnitte; der Lauf geht weiter. Dateien, die im Durchlauf fehlen, verschwinden samt Abschnitten und FTS-Zeilen.
7. Je Datei eine eigene Transaktion. Ein Lauf sendet `vault://changed` zu Beginn (`Scanning`) und am Ende (`Ready` mit Zählern und `scanned_at`).
8. `cargo run --manifest-path src-tauri/Cargo.toml --example vault-probe -- scan <Vault-Ordner> <Index-Datei>` druckt `gesehen <n> · gelesen <n> · entfernt <n> · übersprungen <n> · <ms> ms`; ein zweiter Lauf ohne Änderung meldet `gelesen 0`.
9. Die Statuszeile hat den Knopf „Neu einlesen“ (ruft `vault_rescan`), gesperrt, solange `state === 'scanning'`.
10. `pnpm check` grün.

## Checkliste

### Core

- [x] `src-tauri/src/vault/index.rs`: `pub struct VaultIndex { connection: Mutex<Connection> }`; `pub fn open(file: &Path, vault_dir: &Path) -> Result<VaultIndex, CommandError>` mit Pragmas `journal_mode = WAL`, `synchronous = NORMAL`, Schema aus dem Kontrakt (`CREATE … IF NOT EXISTS`), Prüfung und Neuanlage nach AK 1; `pub fn with<R>(…)` wie `Database::with`. Zugriffe als freie Funktionen auf `&Connection`: `file_row(path) -> Option<FileRow { size, modified_ms, hash, artifact, error }>`, `all_paths() -> HashSet<String>`, `put_file(row)`, `touch_file(path, size, modified_ms)`, `replace_sections(file, &[SectionInput], artifact: &ArtifactFts)` (löscht alte FTS-Zeilen per `DELETE FROM sections_fts WHERE rowid IN (SELECT id FROM sections WHERE file = ?1)`, dann alte `sections`, schreibt neue `sections` und je Abschnitt eine FTS-Zeile mit `rowid` = `sections.id`, Spalten `path` = Dateipfad, `title`/`tags` aus `ArtifactFts`, `heading`, `text`), `delete_file(path)` (FTS, Abschnitte, Zeile), `put_artifact(row)`, `delete_orphan_artifacts()` (Artefakte ohne Datei), `counts() -> (files, artifacts, skipped)`.
- [x] `src-tauri/src/vault/scan.rs`: `pub struct ScanReport { seen, read, removed, skipped, duration_ms }`; `pub fn run(root: &Path, index: &VaultIndex) -> Result<ScanReport, CommandError>` ohne `AppHandle` (damit das Prüfprogramm es nutzen kann). Ablauf: (1) Durchlauf nach AK 4 in eine Liste `(rel, size, modified_ms)`, `rel` mit `/`; (2) je Eintrag Vergleich nach AK 5; (3) gelesene Datei → vorläufige Abschnitte: Textdatei (UTF-8 ohne NUL-Byte in den ersten 8 KiB) = ein Abschnitt mit dem ganzen Text bis 4000 Zeichen, sonst ein Abschnitt mit dem Dateinamen; `kind` vorläufig `text` bzw. `binary`; Artefakt = die Datei selbst, `artifacts`-Zeile mit Titel = Dateiname ohne Endung, Rest leer, `status` = `inbox` unter `inbox/`; (4) `all_paths()` minus gesehene → `delete_file`; (5) `delete_orphan_artifacts`.
- [x] `src-tauri/src/vault/mod.rs`: `VaultService` bekommt `index: Mutex<Option<(PathBuf, Arc<VaultIndex>)>>` (Vault-Ordner, zu dem der Index geöffnet ist), `scanning: AtomicBool`, `again: AtomicBool`, `last_scan_ms: AtomicI64`. `pub fn index(app) -> Result<Arc<VaultIndex>, CommandError>` öffnet bei Bedarf bzw. bei anderem Ordner neu. `pub fn spawn_scan(app: &AppHandle)` nach AK 2/3; der Thread setzt am Ende `last_scan_ms`, `scanning = false`, sendet `announce` und startet bei `again` genau einen weiteren Lauf. `pub fn ensure_fresh(app: &AppHandle)` nach AK 3. `status` liest jetzt Zähler aus `counts()` und `scanned_at` aus `last_scan_ms` (0 → `None`), `Scanning`, solange `scanning` gesetzt ist. Fehler von `scan::run` (z. B. Index nicht zu öffnen) → `Error` mit Satz „Index nicht lesbar: <Fehler>“ bis zum nächsten erfolgreichen Lauf.
- [x] Auslöser verdrahten: Ende von `setup` in `lib.rs` → `vault::spawn_scan(app.handle())`; `settings_update` → nach `announce` auch `spawn_scan`; neues Command `vault_rescan` in `commands/vault.rs`.
- [x] `src-tauri/examples/vault-probe.rs` mit Unterbefehl `scan` nach AK 8; Zeile in der Befehlstabelle von `AGENTS.md` (Muster der übrigen Prüfprogramme, „nie gegen den Datenordner der App“).

### Oberfläche

- [x] `src/lib/vault.ts`: `rescanVault()`.
- [x] `VaultStatusRow.tsx`: Knopf „Neu einlesen“ nach AK 9, Fehler als Satz.

### Doku

- [x] `docs/code-map.md`: Zeile „Developer Vault“ um `index.rs`, `scan.rs`, Prüfprogramm ergänzen.
- [x] `docs/glossary.md`: „Abgleich (Vault)“ — Einlesen geänderter Dateien in den Suchindex.

## Report-Back

Phase 2 umgesetzt: `index.rs`, `scan.rs`, `VaultService` mit Hintergrund-Abgleich, `vault_rescan`, Knopf „Neu einlesen“, `vault-probe`. `pnpm check` grün; `vault-probe scan` gegen Probe-Ordner: Lauf 1 liest alles, Lauf 2 `gelesen 0`, Änderung/Löschung/Ordnerwechsel stimmen, `.vaultignore` und Punkt-Ordner bleiben draußen. 🟡 Nicht in der echten App gelaufen (Statuszeile Scanning→Ready, Zusammenspiel von Start-Abgleich und Einstellung); nicht lesbare Datei (AK 6) nicht per Probe erzwungen, nur im Code. Abweichung: `ensure_fresh` ist fertig, aber noch von keiner Suche gerufen (Phase 4).
