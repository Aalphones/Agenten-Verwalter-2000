# Phase 2 — Core: Einstellungen speichern

Rating: standard. Kontrakt und Speicherformat stehen im README; hier nur Umsetzung.

**Status:** complete

## Kontext

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ → „Einstellungen“, „Kontrakt“ → „Typen im Core“, „Tauri Commands“
- Muster für ein Feature im Core: `src-tauri/src/repositories/` (`mod.rs` Fachlogik, `model.rs` Typen), `src-tauri/src/commands/repositories.rs` (Commands mit `tauri::State<'_, Arc<Database>>`), `src-tauri/src/commands/skills.rs` (Commands mit `AppHandle` und `home_dir`)
- `src-tauri/src/db/mod.rs` (`Database::with`, `enum_to_text`, `enum_from_text`), `src-tauri/src/db/migrations.rs` + `migrations/003_background.sql` (Form einer Migration), `src-tauri/src/db/sessions.rs` (wie Enums gespeichert werden)
- `src-tauri/src/skills/mod.rs` (`collect`), `src-tauri/src/filesystem/workspace.rs` (`home_dir`, `data_dir`, Konstante `WORKSPACES_DIR`)
- `src-tauri/src/agents/event.rs` (`ModelId`, `Effort`, `Mode`), `src-tauri/src/error.rs`, `src-tauri/src/lib.rs` (Command-Registrierung), `src-tauri/examples/gen-bindings.rs` (seit Phase 1)
- [ADR 004](../../../decisions/004-persistenz-und-wiederherstellung.md) (Migrationen werden nie geändert, nur angehängt), [ADR 010](../../../decisions/010-worktrees-durch-den-agenten.md) (die App legt keine Branches an), [rust.md](../../../conventions/rust.md)
- Vault-Fehlerklassen SQLite gelesen: keine einschlägig (alle betreffen Sicherungen und Kopien laufender Datenbanken).

## Abnahmekriterien

1. Migration 006 legt `settings` an; eine bestehende Datenbank mit `user_version = 5` wird beim Start ohne Datenverlust auf 6 gebracht, eine frische durchläuft 1–6.
2. `settings_load` auf einer leeren Tabelle liefert die Standardwerte (`system`, `sonnet`, `high`, `auto`), `user_skills_dir` = `<Benutzerordner>\.claude\skills`, `user_skill_count` = Anzahl der Einträge aus `skills::collect(home, &[])` mit `kind == SkillKind::Skill` (Befehle zählen nicht), `workspaces_dir` = `<Benutzerordner>\.verwalter\workspaces`.
3. `settings_update` speichert genau den geänderten Schlüssel (bzw. bei `DefaultMode` die zwei Schlüssel `default_mode` und `default_effort`) und gibt den vollständigen neuen `Settings`-Stand zurück.
4. ADR 012 liegt unter `docs/decisions/012-einstellungen-farbschema-und-listen.md`.
5. `pnpm bindings` erzeugt `ColorScheme.ts`, `Settings.ts`, `SettingsOverview.ts`, `SettingsChange.ts`; `pnpm check` grün.

## Checkliste

### Datenbank

- [x] `src-tauri/src/db/migrations/006_settings.sql`: `CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`
- [x] `migrations.rs`: `MIGRATIONS: [&str; 6]`, sechste Zeile `include_str!("migrations/006_settings.sql")`.
- [x] `src-tauri/src/db/settings.rs` (in `db/mod.rs` als `pub mod settings;`): `read_all` und `write` (Upsert).

### Fachlogik

- [x] `src-tauri/src/settings/model.rs`: Typen exakt wie im README-Kontrakt.
- [x] `src-tauri/src/settings/mod.rs` (in `lib.rs` als `pub mod settings;`): Schlüssel-Konstanten, `DEFAULT_SETTINGS`, `load` (fehlend/unlesbar → Standardwert, nichts überschreiben), `update` (eine Transaktion, am Ende `load`), `overview`. `WORKSPACES_DIR` in `workspace.rs` ist `pub const`.

### Commands

- [x] `src-tauri/src/commands/settings.rs` (in `commands/mod.rs` eingetragen): `settings_load`, `settings_update`; beide in `lib.rs` registriert.
- [x] `src-tauri/examples/gen-bindings.rs`: `ColorScheme`, `Settings`, `SettingsOverview`, `SettingsChange`; `pnpm bindings`.
- [x] `src/lib/settings.ts`: `loadSettings()`, `updateSettings(change)`.

### Doku

- [x] ADR 012 `docs/decisions/012-einstellungen-farbschema-und-listen.md`.
- [x] Code-Map: Zeile „Einstellungen“ (vorher „Settings“), Zeile „Persistenz“ um Migration 6, Zeile „Skills“ um `skills_dir`.
- [x] Glossar: **Session-Branch** auf Sessions vor ADR 010 beschränkt; neuer Eintrag **Einstellungen**.
- [x] ADR 005, Konsequenzen: Verweis auf ADR 010 und ADR 012 statt „Einstellungen folgen in Meilenstein 6“.

## Report-Back

- **Branch-Präfix gestrichen** (Entscheidung Sascha, 2026-10-01): Der Plan entstand am 29.09., ADR 010 kam am 30.09. — seitdem legt die App bei neuen Vorhaben keine Branches an (`SessionRegistry::create_project`, Kommentar „Worktrees und Branches legt die App nicht an“); `worktrees::BRANCH_PREFIX`, `create_all` und `free_branch` gab es beim Start dieser Phase nicht mehr. Entfallen damit: Feld `branch_prefix`, Variante `SettingsChange::BranchPrefix`, `CommandError::InvalidBranchPrefix`, `git::check_branch_name`, die Präfix-Übergabe beim Anlegen. README (Kontrakt, Entscheidungen, Final-AK 4, Smoke) und Phase 3 (AK, Zeilen-Tabelle, Erklärtext der Repository-Auswahl, Entwurfs-Abweichungen) sind nachgezogen; Abschnitt „Git“ der Seite heißt „Ordner“, Zeile „Workspaces“; die Texte von „Dateizugriff“ beschreiben den Stand nach ADR 010.
- **Abweichung:** `skills::skills_dir(root)` neu und öffentlich, damit der Pfad `.claude\skills` nicht ein zweites Mal als Text im Core steht; `skills_in` nutzt sie ebenfalls.
- **Nicht geprüft:** Migration 006 auf einer echten Datenbank mit `user_version = 5` — der Ablauf in `migrations::run` ist derselbe wie bei 1–5; zeigt sich beim ersten Start von `pnpm tauri dev`.
