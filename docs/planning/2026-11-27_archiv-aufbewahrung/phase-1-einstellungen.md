# Phase 1 — Einstellungen, Migration, ADR

## Kontext

Lesen: [README.md](README.md) (Kontrakt), `src-tauri/src/settings/model.rs`, `src-tauri/src/settings/mod.rs`, `src-tauri/src/db/migrations.rs` (Liste der Migrationen), `src-tauri/src/db/projects.rs`, `docs/conventions/rust.md`, `docs/decisions/058-*.md` als Muster für ein ADR mit Schalter und Schwelle. Fehlerklassen geprüft (Vault: `systeme/sqlite`, `frameworks/react`, `sprachen/typescript`, `werkzeuge/claude-code`): für diese Phase keine einschlägig.

Referenzmuster: `auto_compact_stations` (Schalter) und `auto_compact_threshold` (Zahl mit Grenzen) — jede Stelle, an der diese beiden in `model.rs` und `mod.rs` vorkommen, bekommt ihr Gegenstück.

## Akzeptanzkriterien

- `Settings` trägt `archive_trim`, `archive_purge`, `archive_purge_days` mit den Standardwerten und Grenzen aus dem Kontrakt; `SettingsChange` trägt die drei Varianten.
- `settings::update` lehnt `ArchivePurgeDays` außerhalb `7..=365` mit `CommandError::Internal("Frist außerhalb 7–365 Tage")` ab; `settings::load` liefert für einen gespeicherten Wert außerhalb der Grenzen `30`.
- Nach dem Start steht `PRAGMA user_version` auf 24 und `projects` hat die Spalte `trimmed_at`.
- `project_rows::restore` setzt `trimmed_at = NULL`.
- `pnpm bindings` ist gelaufen; `src/lib/bindings/Settings.ts` und `SettingsChange.ts` enthalten die neuen Felder; `pnpm check` grün.

## Checkliste

- [ ] `src-tauri/src/settings/model.rs`: drei Felder in `Settings` (Doc-Kommentar je Feld mit Verweis „ADR 076“), drei Varianten in `SettingsChange`.
- [ ] `src-tauri/src/settings/mod.rs`: Konstanten `KEY_ARCHIVE_TRIM`, `KEY_ARCHIVE_PURGE`, `KEY_ARCHIVE_PURGE_DAYS`, `pub const ARCHIVE_PURGE_DAYS_RANGE: RangeInclusive<u32> = 7..=365`; Einträge in `DEFAULT_SETTINGS`, `load` (Zahl mit `.filter(|value| ARCHIVE_PURGE_DAYS_RANGE.contains(value))` wie bei `auto_compact_threshold`), Prüfung und Schreibzweige in `update`.
- [ ] `src-tauri/src/db/migrations/024_retention.sql` mit `ALTER TABLE projects ADD COLUMN trimmed_at REAL;` und Eintrag in der Liste in `migrations.rs`.
- [ ] `src-tauri/src/db/projects.rs`: in `restore` das erste `UPDATE` auf `SET archived_at = NULL, trimmed_at = NULL` erweitern; neue Funktionen `pub fn set_trimmed(connection, id, at: f64)` und `pub fn untrimmed_archived(connection) -> Vec<String>` (IDs mit `archived_at IS NOT NULL AND trimmed_at IS NULL`).
- [ ] `pnpm bindings` laufen lassen. Jede Stelle im Frontend, die ein vollständiges `Settings`-Objekt von Hand baut (Suche nach `autoCompactThreshold:` in `src/`), bekommt die drei Felder mit den Standardwerten.
- [ ] `docs/decisions/076-aufbewahrung-archivierter-vorhaben.md`: Kontext (Zahlen aus dem README), Optionen (nur Frist · Stufen mit eigenem Schalter · Artefakte behalten), Entscheidung (Abschnitte „Entscheidungen des Benutzers“ und „Von mir gesetzt“ des README), Konsequenzen (unumkehrbar; Archiv-Suche findet Gelöschtes nicht mehr; `VACUUM` verzögert einen Start um rund 10 s).
- [ ] `docs/code-map.md`: Zeile „Persistenz“ um Migration 24 ergänzen. `docs/glossary.md`: Begriffe „Ausdünnen“ (Sofort-Stufe) und „Aufbewahrungsfrist“.
- [ ] `pnpm check` grün.

## Report-Back
