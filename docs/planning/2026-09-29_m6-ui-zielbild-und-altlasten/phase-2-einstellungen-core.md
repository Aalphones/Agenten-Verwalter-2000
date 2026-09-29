# Phase 2 — Core: Einstellungen speichern, Branch-Präfix beim Anlegen

Rating: standard. Kontrakt und Speicherformat stehen im README; hier nur Umsetzung.

## Kontext

- [README dieses Plans](README.md): „Festgelegte Entscheidungen“ → „Einstellungen“, „Kontrakt“ → „Typen im Core“, „Tauri Commands“
- Muster für ein Feature im Core: `src-tauri/src/repositories/` (`mod.rs` Fachlogik, `model.rs` Typen), `src-tauri/src/commands/repositories.rs` (Commands mit `tauri::State<'_, Arc<Database>>`), `src-tauri/src/commands/skills.rs` (Commands mit `AppHandle` und `home_dir`)
- `src-tauri/src/db/mod.rs` (`Database::with`, `enum_to_text`, `enum_from_text`), `src-tauri/src/db/migrations.rs` + `migrations/003_background.sql` (Form einer Migration), `src-tauri/src/db/sessions.rs` (wie Enums gespeichert werden)
- `src-tauri/src/git/mod.rs` (`run_allowing_failure`, `git_error`, einziger Ort für `git`), `src-tauri/src/worktrees/mod.rs` (`BRANCH_PREFIX`, `create_all`, `free_branch`), `src-tauri/src/sessions/registry.rs` (`SessionRegistry::create` ruft `worktrees::create_all`)
- `src-tauri/src/skills/mod.rs` (`collect`), `src-tauri/src/filesystem/workspace.rs` (`home_dir`, `data_dir`, Konstante `WORKSPACES_DIR`)
- `src-tauri/src/agents/event.rs` (`ModelId`, `Effort`, `Mode`), `src-tauri/src/error.rs`, `src-tauri/src/lib.rs` (Command-Registrierung), `src-tauri/examples/gen-bindings.rs` (seit Phase 1)
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Migrationen werden nie geändert, nur angehängt), [ADR 005](../../decisions/005-repositories-und-worktrees.md) (Session-Branch), [rust.md](../../conventions/rust.md)
- Vault-Fehlerklassen SQLite gelesen: keine einschlägig (alle betreffen Sicherungen und Kopien laufender Datenbanken).

## Abnahmekriterien

1. Migration 4 legt `settings` an; eine bestehende Datenbank mit `user_version = 3` wird beim Start ohne Datenverlust auf 4 gebracht, eine frische durchläuft 1–4.
2. `settings_load` auf einer leeren Tabelle liefert die Standardwerte (`system`, `sonnet`, `high`, `auto`, `verwalter/`), `user_skills_dir` = `<Benutzerordner>\.claude\skills`, `user_skill_count` = Anzahl der Einträge aus `skills::collect(home, &[])` mit `kind == SkillKind::Skill` (Befehle zählen nicht), `workspaces_dir` = `<Benutzerordner>\.verwalter\workspaces`.
3. `settings_update` speichert genau den geänderten Schlüssel (bzw. bei `DefaultMode` die zwei Schlüssel `default_mode` und `default_effort`) und gibt den vollständigen neuen `Settings`-Stand zurück.
4. `BranchPrefix` mit leerem Wert, mehr als 40 Zeichen oder einem Wert, für den `git check-ref-format --branch <Wert>probe` scheitert → `CommandError::InvalidBranchPrefix`, nichts gespeichert. Die Meldung ist die erste Zeile von Gits Fehlerausgabe ohne `fatal: ` bzw. „darf nicht leer sein“ / „höchstens 40 Zeichen“.
5. Eine neue Session mit Repository bekommt den Branch `<gespeicherter Präfix><slug>` (Suffixe `-2` … wie bisher). Die Konstante `worktrees::BRANCH_PREFIX` gibt es nicht mehr.
6. ADR 008 liegt unter `docs/decisions/008-einstellungen-farbschema-und-listen.md`.
7. `pnpm bindings` erzeugt `ColorScheme.ts`, `Settings.ts`, `SettingsOverview.ts`, `SettingsChange.ts`; `pnpm check` grün.

## Checkliste

### Datenbank

- [ ] `src-tauri/src/db/migrations/004_settings.sql`: `CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`
- [ ] `migrations.rs`: `MIGRATIONS: [&str; 4]`, vierte Zeile `include_str!("migrations/004_settings.sql")`.
- [ ] `src-tauri/src/db/settings.rs` (in `db/mod.rs` als `pub mod settings;`): `pub fn read_all(connection: &Connection) -> Result<HashMap<String, String>, CommandError>` (alle Zeilen) und `pub fn write(connection: &Connection, key: &str, value: &str) -> Result<(), CommandError>` (`INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).

### Fachlogik

- [ ] `src-tauri/src/settings/model.rs`: Typen exakt wie im README-Kontrakt (Derives, `rename_all`, `tag = "kind"` + `rename_all_fields = "camelCase"` bei `SettingsChange`).
- [ ] `src-tauri/src/settings/mod.rs` (in `lib.rs` als `pub mod settings;`): Konstanten `KEY_COLOR_SCHEME = "color_scheme"`, `KEY_DEFAULT_MODEL = "default_model"`, `KEY_DEFAULT_EFFORT = "default_effort"`, `KEY_DEFAULT_MODE = "default_mode"`, `KEY_BRANCH_PREFIX = "branch_prefix"`, `pub const DEFAULT_BRANCH_PREFIX: &str = "verwalter/"`, `const MAX_BRANCH_PREFIX_CHARS: usize = 40`.
  - `pub fn load(database: &Database) -> Result<Settings, CommandError>`: `read_all`, dann je Schlüssel `enum_from_text` bzw. wörtlich; fehlt ein Schlüssel oder scheitert `enum_from_text`, gilt der Standardwert (kein Fehler, kein Überschreiben).
  - `pub fn update(database: &Database, change: SettingsChange) -> Result<Settings, CommandError>`: bei `BranchPrefix` zuerst `validate_branch_prefix`; dann schreiben (`enum_to_text` für Enums; `DefaultMode` schreibt `default_mode` und `default_effort` in **einer** Transaktion); am Ende `load` zurückgeben.
  - `fn validate_branch_prefix(value: &str) -> Result<(), CommandError>`: leer → `InvalidBranchPrefix("darf nicht leer sein")`; `value.chars().count() > 40` → `InvalidBranchPrefix("höchstens 40 Zeichen")`; sonst `git::check_branch_name(&format!("{value}probe"))`.
  - `pub fn overview(app: &AppHandle, database: &Database) -> Result<SettingsOverview, CommandError>`: `home_dir(app)?`, `user_skills_dir = home.join(".claude").join("skills")`, Zählung wie AK 2, `workspaces_dir = data_dir(app)?.join(WORKSPACES_DIR)` — dafür `WORKSPACES_DIR` in `workspace.rs` auf `pub const` stellen. Pfade als `to_string_lossy()`.
- [ ] `src-tauri/src/git/mod.rs`: `pub fn check_branch_name(name: &str) -> Result<(), CommandError>` — `run_allowing_failure(&std::env::temp_dir(), &args(&["check-ref-format", "--branch", name]))`; Erfolg → `Ok(())`; sonst `Err(CommandError::InvalidBranchPrefix(<erste Zeile von stderr, führendes „fatal: “ entfernt>))`. `-C <Temp-Ordner>` nur, weil `run_allowing_failure` immer ein Verzeichnis braucht; `check-ref-format` braucht kein Repository (belegt im README).
- [ ] `src-tauri/src/error.rs`: Variante `InvalidBranchPrefix(String)` mit `#[error("Branch-Präfix ungültig: {0}")]`, Serialisierung wie die übrigen Varianten.

### Branch-Präfix beim Anlegen

- [ ] `worktrees/mod.rs`: `BRANCH_PREFIX` löschen; `create_all` bekommt den Parameter `branch_prefix: &str` nach `session_name`; `free_branch(repositories, branch_prefix, slug)` baut `format!("{branch_prefix}{slug}")` bzw. `…-{suffix}`. Doku-Kommentare, die `verwalter/` nennen, auf „`<Präfix><slug>`“ ändern.
- [ ] `sessions/registry.rs`, `SessionRegistry::create`: vor `worktrees::create_all` `let settings = settings::load(&self.database)?;` und `&settings.branch_prefix` übergeben. Die Datenbank-Sperre ist dabei nicht gehalten, während Git läuft (`load` gibt sie nach dem Lesen frei) — Sperr-Reihenfolge aus `db/mod.rs` bleibt gewahrt, weil hier keine Session-Sperre gehalten ist.

### Commands

- [ ] `src-tauri/src/commands/settings.rs` (in `commands/mod.rs` eintragen): `#[tauri::command] pub async fn settings_load(app: tauri::AppHandle, database: tauri::State<'_, Arc<Database>>) -> Result<SettingsOverview, CommandError>` → `settings::overview`; `#[tauri::command] pub async fn settings_update(database: tauri::State<'_, Arc<Database>>, change: SettingsChange) -> Result<Settings, CommandError>` → `settings::update`. Beide in `lib.rs` registrieren.
- [ ] `src-tauri/examples/gen-bindings.rs`: `ColorScheme`, `Settings`, `SettingsOverview`, `SettingsChange` importieren und exportieren wie die übrigen; `pnpm bindings`.
- [ ] `src/lib/settings.ts`: `loadSettings(): Promise<SettingsOverview>` und `updateSettings(change: SettingsChange): Promise<Settings>` über `invoke`, Muster wie `src/lib/repositories.ts`.

### Doku

- [ ] ADR 008 `docs/decisions/008-einstellungen-farbschema-und-listen.md` aus den README-Abschnitten „Einstellungen“, „Farbschema“, „Virtuelle Listen“, „Sichtbare Fehler“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen; die verworfenen Optionen aus dem README nennen).
- [ ] Code-Map: Zeile „Settings“ auf den Stand bringen (`src-tauri/src/settings/` `model.rs` + `mod.rs`, `commands/settings.rs`, `db/settings.rs`, Migration 4, Wrapper `src/lib/settings.ts`); Zeile „Persistenz“ um Migration 4 = Einstellungen ergänzen; Zeile „Worktrees“: Präfix aus den Einstellungen.
- [ ] Glossar: **Session-Branch** → „Der Branch `<Präfix><Name>`, … Präfix aus den Einstellungen, Standard `verwalter/`; ein geänderter Präfix gilt nur für neue Sessions.“ Neuer Eintrag **Einstellungen**: „Werte, die für die ganze App gelten (Farbschema, Standardwerte neuer Sessions, Branch-Präfix); gespeichert in der Tabelle `settings`.“
- [ ] ADR 005, Stelle zum Branch-Namen: Verweis „Präfix seit M6 einstellbar, ADR 008“.

## Report-Back
