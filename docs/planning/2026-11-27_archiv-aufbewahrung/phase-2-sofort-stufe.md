# Phase 2 — Sofort-Stufe: Scratchpad beim Archivieren ausdünnen

## Kontext

Lesen: [README.md](README.md) (Kontrakt, „Von mir gesetzt“), `src-tauri/src/sessions/registry.rs` → `archive_project` und `schedule_worktree_cleanup` (Muster: eigener Thread, wartet `KILL_GRACE + CLEANUP_MARGIN`, bis die Agenten beendet sind), `src-tauri/src/background/scratchpad.rs` (Konstante `WORKSPACE_FOLDER = ".scratchpad"`), `src-tauri/src/filesystem/workspace.rs` (`data_dir`, `WORKSPACES_DIR`), `src-tauri/src/lib.rs` (Start-Reihenfolge in `setup`), `docs/conventions/rust.md`. Fehlerklassen geprüft: keine einschlägig im Vault; die beiden Windows-Risiken dieser Phase stehen als Prüfpunkte unten.

Verstanden, was heute passiert: `archive_project` beendet die Agenten, markiert Vorhaben und Sessions als archiviert, entfernt sie aus dem Speicher und räumt nur alte App-Worktrees ohne offene Änderungen ab. Der Workspace-Ordner bleibt vollständig liegen.

## Regeln für `trim_scratchpad(workspace)`

Arbeitet ausschließlich in `<workspace>\.scratchpad`. Fehlt der Ordner, ist das Ergebnis `TrimStats { files: 0, bytes: 0 }`. Durchlauf von oben nach unten, je Eintrag in dieser Reihenfolge:

1. **Verknüpfung** (Symlink oder Junction; über `fs::symlink_metadata`, unter Windows zusätzlich das Attribut `FILE_ATTRIBUTE_REPARSE_POINT` = `0x400`): nie hineinsteigen, nie löschen, überspringen.
2. **Ordner mit einem dieser Namen** (genauer Vergleich, Groß/Klein egal): `node_modules`, `target`, `.git`, `dist`, `build`, `.venv`, `__pycache__`, `.next`, `.gradle`, `.pnpm-store` → ganzer Ordner weg (`fs::remove_dir_all`), Dateien und Bytes vorher zählen.
3. **Anderer Ordner** → hineinsteigen.
4. **Datei ab 50 MB** (`50 * 1024 * 1024` Bytes) → löschen.
5. **Datei mit einer dieser Endungen** (Groß/Klein egal): `db`, `sqlite`, `sqlite3`, `db-wal`, `db-shm`, `sqlite-wal`, `sqlite-shm`, `onnx`, `tflite`, `gguf`, `safetensors`, `apk`, `aab`, `so`, `node`, `dll`, `exe`, `pdb`, `lib`, `rlib`, `zip`, `7z`, `tar`, `gz`, `bin` → löschen.
6. Alles andere bleibt.

Ein Fehler an einem Eintrag (gesperrt, kein Zugriff) beendet den Durchlauf nicht: Eintrag überspringen, eine Zeile nach `eprintln!`, weiter. Die Namens- und Endungslisten stehen als `const`-Arrays oben in `trim.rs`.

## Akzeptanzkriterien

- Probe-Workspace mit `.scratchpad\s1\node_modules\a\b.js`, `.scratchpad\s1\kopie.db`, `.scratchpad\s1\gross.txt` (51 MB), `.scratchpad\s1\bild.png`, `.scratchpad\s1\skript.py`, `.artefakte\seite.html`: nach `trim_scratchpad` existieren nur noch `bild.png`, `skript.py` und `seite.html`; `TrimStats` nennt 3 Dateien und deren Byte-Summe.
- Ein Pfad über 300 Zeichen unter `node_modules` wird gelöscht.
- Eine Junction im Scratchpad auf einen Ordner außerhalb bleibt stehen, ihr Ziel ist unverändert.
- Schalter `archive_trim` an: nach `archive_project` ist der Workspace binnen `KILL_GRACE + CLEANUP_MARGIN` plus Laufzeit ausgedünnt und `projects.trimmed_at` gesetzt. Schalter aus: nichts ändert sich, `trimmed_at` bleibt `NULL`.
- `retention::run_once` dünnt bei `archive_trim` = an jedes archivierte Vorhaben mit `trimmed_at IS NULL` aus und setzt die Spalte; ein zweiter Aufruf fasst kein Vorhaben mehr an.
- Die drei Kriterien mit Probe-Ordner sind über ein Prüfprogramm `src-tauri/examples/retention-probe.rs` nachvollziehbar: `retention-probe trim <Ordner>` druckt `gelöscht <n> Dateien · <bytes> Bytes`. Zeile in der Befehlstabelle von `AGENTS.md`.

## Checkliste

- [ ] `src-tauri/src/retention/model.rs`: `TrimStats`.
- [ ] `src-tauri/src/retention/trim.rs`: `trim_scratchpad` nach den Regeln oben.
- [ ] `src-tauri/src/retention/mod.rs`: `trim_after_archive(app, project_id, workspace)` — Thread `retention-trim`, wartet wie `schedule_worktree_cleanup`, ruft `trim_scratchpad`, schreibt `project_rows::set_trimmed`. `run_once(app)`: lädt die Einstellungen; bei `archive_trim` je ID aus `project_rows::untrimmed_archived` den Workspace über die erste Session des Vorhabens (`session_rows::load_for_project`, Feld `workspace_dir`) ermitteln, ausdünnen, `set_trimmed`. `start(app)`: Thread `retention`, schläft 10 Minuten, ruft `run_once`, danach in einer Schleife alle 24 Stunden.
- [ ] `src-tauri/src/sessions/registry.rs` → `archive_project`: nach dem bestehenden Aufräumen der Worktrees, wenn `settings::load(&self.database)?.archive_trim`, `retention::trim_after_archive` mit dem Workspace der ersten Session rufen. Die Einstellungen vor dem Sperren von Sessions oder Vorhaben laden (Sperr-Regel in `db/mod.rs`).
- [ ] `src-tauri/src/lib.rs`: `mod retention;` und in `setup` nach `SessionRegistry::start_reaper(...)` die Zeile `retention::start(app.handle().clone());`.
- [ ] `src-tauri/examples/retention-probe.rs` mit dem Unterbefehl `trim`.
- [ ] Windows-Prüfpunkte fahren: langer Pfad und Junction (siehe README → Konfidenz); Ergebnis in den Report-Back.
- [ ] `docs/code-map.md`: neue Zeile „Aufbewahrung (Ausdünnen, Löschen nach Frist; ADR 076)“ mit `src-tauri/src/retention/`; `retention` in der Feature-Liste. `AGENTS.md`: Zeile für `retention-probe`.
- [ ] `pnpm check` grün.

## Report-Back
