# Phase 1 — Kern: Baum, Lesen, Schreiben, Spiegeln

**Rating:** heikel (Schreibgrenze, Konfliktprüfung, atomares Schreiben) · **ADR:** 072 in dieser Phase schreiben

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans: Kontrakt-Tabelle und Typen — genau so umsetzen.
- `docs/decisions/069-bibliothek.md` (Erlaubnisliste, Gruppen), `docs/decisions/038-umgebung.md` (Abgleich).
- `docs/conventions/rust.md`, `docs/conventions/linting.md`.
- `src-tauri/src/vault/library.rs` — `is_included_top`, `is_included_below`, `place`, `KNOWLEDGE_DIR`; Muster der Konstanten.
- `src-tauri/src/vault/resolve.rs` — `locate`, `sentence`, `OUTSIDE`.
- `src-tauri/src/vault/scan.rs` — `MAX_READ_BYTES` (2 MiB), `IGNORE_FILE` (`.vaultignore`), Hash mit `sha2::Sha256` als Hex in `load`.
- `src-tauri/src/vault/index.rs` — Tabellen `files`, `artifacts`; `all_file_rows`, `artifact_summaries`, `layout`.
- `src-tauri/src/vault/mod.rs` — `status`, `index`, `spawn_scan`.
- `src-tauri/src/files/mod.rs` — `checked_path` (Grenze nach dem Auflösen von Verknüpfungen).
- `src-tauri/src/environment/mod.rs` — `run_mirror`; `src-tauri/src/environment/mirror.rs` — `entries`, `markdown_files`, Konstanten; `environment/model.rs` — `MirrorKind`, `MirrorState`, `MirrorDiff`.
- `src-tauri/src/commands/vault.rs`, `src-tauri/src/commands/environment.rs` (Muster für `State<Arc<Database>>` und `State<EnvironmentService>`), Registrierung in `src-tauri/src/lib.rs` (`commands::vault::vault_open` suchen).
- `src-tauri/examples/vault-probe.rs` und die Zeile `vault-probe` in `AGENTS.md`.

## AK der Phase

1. `edit::tree(root, index)` liefert je Artefakt des Index Pfad, Titel, Beschreibung, Art, Gruppe/Untergruppe aus `library::place`, `is_folder` und alle Dateien des Artefakts aus `files` (auch Zeilen mit `error`, dann `editable: false`), Dateien nach Pfad sortiert, Artefakte nach Gruppe, Untergruppe, Titel.
2. `edit::read_text(root, layout, rel)` liefert den Text mit `\n` als Zeilenende, `line_ending` (`Crlf`, wenn die Datei mindestens ein `\r\n` enthält, sonst `Lf`), `bom` (UTF-8-BOM vorhanden, aus dem Text entfernt), Hash (Sha256-Hex der Bytes auf der Platte) und Änderungszeit. Fehler als Satz: „Der Pfad liegt außerhalb der Bibliothek.“, „Diese Datei bearbeitet der Verwalter nicht.“ (Endung), „Größer als 2 MB.“, „Keine Textdatei (kein UTF-8).“.
3. `edit::write_text(root, layout, request)`:
   - Pfadregel `pub fn path_allowed(root, layout, rel) -> Result<PathBuf, String>` (gibt den absoluten Pfad zurück; Phase 2 nutzt sie für die Vorschau): kein leerer Pfad, keine Komponente `..`/Wurzel/Laufwerk, keine Komponente mit `.` am Anfang, erste Komponente nach `library::is_included_top` (bei einer Datei direkt in der Wurzel nur `CLAUDE.md`/`AGENTS.md`), `library::is_included_below` für jede Ordner-Komponente unter `memory`, nicht ausgeschlossen durch `.gitignore` oder `.vaultignore` der Wurzel (`ignore::gitignore::GitignoreBuilder`, beide Dateien hinzufügen, `matched_path_or_any_parents(rel, false).is_ignore()`), und `files::checked_path(root, rel)` gelingt. Plain-Layout: erste Komponente beliebig, Rest gleich. `write_text` und `read_text` prüfen zusätzlich `is_editable(rel)` (Endung in `EDITABLE_EXTENSIONS`).
   - Der Elternordner muss existieren (kein `create_dir_all`): sonst „Der Ordner existiert nicht.“.
   - `expected_hash: None`: existiert die Datei → `Exists`. `Some(h)`: Datei fehlt oder Hash der Platte ≠ `h` und `force == false` → `Changed { modified_ms }` (bei fehlender Datei `0`).
   - Inhalt: `text` mit `\n`; bei `Crlf` jedes `\n` → `\r\n` (vorher vorhandene `\r\n` im Text nicht verdoppeln: erst alle `\r\n` → `\n`, dann ersetzen); bei `bom` die drei Bytes `EF BB BF` voran. Größer als 2 MiB → Fehler „Größer als 2 MB.“.
   - Schreiben: Temp-Datei `.<dateiname>.verwalter-<uuid simple>.tmp` im Zielordner, `write_all`, `sync_all`, `fs::rename(temp, ziel)`; bei jedem Fehler Temp-Datei löschen und `io` zurückgeben.
   - Rückgabe `Saved` mit neuem Hash, Änderungszeit und Größe; `mirror` und `environment` füllt der Befehl (AK 5).
4. `EDITABLE_EXTENSIONS` (klein, ohne Punkt): `md, txt, html, htm, css, js, mjs, cjs, ts, tsx, jsx, json, yaml, yml, xml, svg, py, cmd, bat, ps1, sh, toml, csv, ini, cfg`. `editable` im Baum = Endung in der Liste und Größe ≤ 2 MiB.
5. Befehl `vault_write_text` (in `commands/vault.rs`): nach `Saved` `vault::spawn_scan(&app)`; wenn `mirror::entry_of(rel)` `Some((kind, name))` liefert und das Layout `Library` ist, `environment::run_mirror(&app, &database, &environment)` → bei `Err` `VaultMirror::Failed { message }`; sonst steht `(kind, name)` danach noch in `status.diffs` mit `MasterNewer` oder `OnlyMaster` → `Pending { reason: "Abgleich hat die Datei nicht kopiert." }`, mit `LocalNewer` → `Pending { reason: "In ~\\.claude liegt eine neuere Fassung." }`, sonst `Mirrored`; `environment = Some(status)`. Kein Eintrag → `NotMirrored`, `environment = None`.
6. `mirror::entry_of(rel: &str) -> Option<(MirrorKind, String)>` in `environment/mirror.rs` mit denselben Konstanten wie `entries`: `skills/<name>/…` → `(Skill, name)`; `commands/<x>.md` direkt → `(Command, x)`; `output-styles/<x>.md` direkt → `(OutputStyle, x)`; `CLAUDE.md` → `(Rules, "CLAUDE.md")`; alles andere `None`.
7. Befehle `vault_tree`, `vault_read_text`, `vault_write_text`, `vault_delete_file`, `vault_restore_file` registriert; Bindings erzeugt; Wrapper in `src/lib/vault.ts` (`loadVaultTree`, `readVaultText`, `writeVaultText`, `deleteVaultFile`, `restoreVaultFile`) mit `@throws`-Kommentar wie die vorhandenen.
8. **Löschen:** `edit::delete_file(root, layout, rel, trash_root, claude_dir) -> VaultDeleted`: `path_allowed` (jede Endung) und Datei existiert; Eintrag `trash_root/<ms>-<uuid 8 Zeichen>/` mit der Datei unter ihrem relativen Pfad und `eintrag.json` (`path`, `hash`, `deleted_ms`); erst kopieren und Größe vergleichen, dann das Original entfernen (Bibliothek und Papierkorb liegen auf verschiedenen Laufwerken, `rename` geht nicht). Gilt `mirror::entry_of(rel)`: liegt `claude_dir/<rel>` vor und hat denselben Sha256 → entfernen (`Removed`), anders → `Kept { reason: "In ~\\.claude weicht die Kopie ab; sie bleibt." }`, fehlt → `Removed`; sonst `NotMirrored`. `trash_root` = `<data_dir>/bibliothek-papierkorb` (`filesystem::workspace::data_dir`).
9. **Zurückholen:** `edit::restore_file(root, trash_root, trash_id) -> VaultRestoreOutcome`: liest `eintrag.json`; liegt am Ziel eine Datei → `Exists`; fehlt der Elternordner → anlegen (`create_dir_all`, nur innerhalb von `path_allowed`); kopieren, danach den Eintrag löschen. Der Befehl spiegelt danach wie beim Speichern (AK 5).
10. **Aufräumen:** `edit::purge_trash(trash_root, max_age)` löscht Einträge mit `deleted_ms` älter als 30 Tage; Aufruf einmal beim Start in einem eigenen Thread (`lib.rs`, nach dem Start des Vault-Dienstes).
11. `vault-probe` kann `tree <Ordner> <Index-Datei>`, `read <Ordner> <Pfad>` (druckt Zeilenende, BOM, Hash, Zeilenzahl), `write <Ordner> <Pfad> <Textdatei> [<hash>|neu] [--force]` (druckt das Ergebnis als eine Zeile, ohne Spiegeln) `allowed <Ordner> <Pfad>` (druckt `ja` oder den Satz aus `path_allowed` bzw. „Diese Datei bearbeitet der Verwalter nicht.“), `delete <Ordner> <Pfad> <Papierkorb> [<claude-Ordner>]` und `restore <Ordner> <Papierkorb> <Eintrag>` (je eine Ergebniszeile).

## Checkliste

- [ ] `src-tauri/src/vault/edit.rs` anlegen: `EDITABLE_EXTENSIONS`, `is_editable(rel)`, `path_allowed`, `tree`, `read_text`, `write_text`, Hilfsfunktionen `split_bom`, `detect_line_ending`, `to_disk_bytes`, `hash_hex` (gemeinsam mit `scan.rs` nutzen: `scan::hash_hex` herauslösen oder `pub(crate)` machen, nicht doppeln). Alle Funktionen ohne `AppHandle` (Wurzel, Layout und Index als Parameter), damit das Prüfprogramm sie fahren kann.
- [ ] `src-tauri/src/vault/mod.rs`: `pub mod edit;`. `scan::MAX_READ_BYTES` auf `pub(crate)`.
- [ ] Typen aus dem Kontrakt in `src-tauri/src/vault/model.rs` mit `#[derive(Serialize, Deserialize, TS)]` wie die vorhandenen (`rename_all = "camelCase"`, Enums wie im Kontrakt getaggt).
- [ ] `environment/mirror.rs`: `pub fn entry_of`.
- [ ] `commands/vault.rs`: fünf Befehle (`vault_delete_file` und `vault_restore_file` nach `Saved`-Muster mit `spawn_scan`, `restore` zusätzlich mit Spiegeln); `vault_tree` und `vault_read_text` holen Wurzel, Layout und Index über `vault::resolve::locate(&app, "")` bzw. `vault::status` + `vault::index`; Fehler über `resolve::sentence` als `CommandError::Internal`.
- [ ] `lib.rs`: Befehle registrieren. `pnpm bindings`.
- [ ] `src/lib/vault.ts`: fünf Wrapper.
- [ ] `lib.rs`: `purge_trash` beim Start im eigenen Thread.
- [ ] `examples/vault-probe.rs`: Unterbefehle aus AK 8; Zeile in `AGENTS.md` (Tabelle „Befehle“) erweitern.
- [ ] Probe gegen eine Kopie der Bibliothek im Scratchpad: `read` einer CRLF-Datei und einer LF-Datei, `write` ohne Änderung → Bytes identisch (`fc /b` bzw. `cmp`), `write` mit falschem Hash → `Changed`, `delete` + `restore` einer Datei (Bytes danach identisch), `delete` einer Skill-Datei mit gleicher und mit abweichender Kopie in einem Test-`claude`-Ordner, `allowed` für `hooks/x.md`, `memory/_archiv/x.md`, `skills/a/.x.md`, `skills/a/../../x.md`, `skills/a/b.exe` → jeweils Satz. Einmal `write` direkt in `G:\…\_vault\inbox\` (Konfidenz-Check der README) und Ergebnis im Report-Back.
- [ ] `docs/decisions/072-bibliothek-bearbeiten.md` (Kontext, Optionen: Editor CodeMirror 6 vs. Monaco; Spiegeln automatisch vs. Hinweis; Umfang Ändern + Anlegen + Löschen mit Papierkorb vs. Dateimanager; Suchdialog entfernen vs. behalten; Schreibgrenze Regeln vs. Index; Entscheidung; Konsequenzen).
- [ ] `docs/code-map.md`: Zeile „Bibliothek“ um `vault/edit.rs` (Baum, Lesen, Schreiben) und `mirror::entry_of` ergänzen.
- [ ] `pnpm check` grün.

## Report-Back
