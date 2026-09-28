# Phase 1 — Datenbank-Grundlage

**Status:** pending · **Rating:** standard (alle Entscheidungen stehen in ADR 004 und der Kontrakt-Sektion der README; nichts bleibt offen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Kontrakt (Schema, Rust-Schnittstellen, Fehler)
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md)
- [docs/conventions/rust.md](../../conventions/rust.md) — Abschnitte „Fehlerbehandlung“, „Datenbank“, Critical Rules (kein `unwrap()`; Clippy verbietet es per `unwrap_used = "deny"`)
- Bestand: `src-tauri/Cargo.toml`, `src-tauri/src/error.rs`, `src-tauri/src/filesystem/workspace.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/agents/event.rs` (`ChatEntry`, `ModelId`, `Effort`, `Mode` — alle `Serialize + Deserialize`), `src-tauri/src/sessions/model.rs` (`SessionStatus`), `src-tauri/src/bin/gen-bindings.rs` (`CommandError` wird dort schon exportiert, kein Eintrag nötig)
- Fehlerklassen: die Vault-Entity `sprachen/rust` ist auf dieser Maschine nicht lesbar. Übernommen aus dem Vorgängerplan: **Sperren nie im Kopf eines `match` halten** (`match mutex.lock().x() { … }` hält den Guard bis zum Ende des ganzen `match`) — immer erst in eine Variable (`let guard = …;`), dann arbeiten. In dieser Phase gilt das für `Database::with`.
- Belegt am 2026-09-28: `rusqlite` 0.40.2 mit Feature `bundled` baut und läuft auf dieser Maschine (Probe-Projekt, Ausgabe `ok 1`).

## Abnahmekriterien der Phase

1. `pnpm check` grün (rustfmt, Clippy `-D warnings`, Lint, Typecheck, Build).
2. `pnpm bindings` ändert genau eine Datei: `src/lib/bindings/CommandError.ts` bekommt die Variante `{ "kind": "database", "message": string }`.
3. Nach einem App-Start existiert `%USERPROFILE%\.verwalter\verwalter.db`; ein zweiter Start ändert nichts an ihr, die App startet normal. Ist die Datei nicht öffnbar (Ordner schreibgeschützt), meldet der Start den Fehler und beendet sich — kein stiller Weiterlauf ohne Datenbank.
4. Verhalten der App sonst unverändert (Sessions verhalten sich wie in Meilenstein 2a).

## Checkliste

- [ ] `src-tauri/Cargo.toml`: unter `[dependencies]` `rusqlite = { version = "0.40", features = ["bundled"] }`.
- [ ] `src-tauri/src/error.rs`: Variante `#[error("Datenbank: {0}")] Database(String)` und `impl From<rusqlite::Error> for CommandError` (wie das bestehende `From<std::io::Error>`: `CommandError::Database(error.to_string())`).
- [ ] `src-tauri/src/filesystem/workspace.rs`: neue Funktion `pub fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, CommandError>` (`<Benutzerordner>/.verwalter`, legt nichts an). `session_workspace` ruft sie statt `home_dir()` direkt auf (Ergebnis unverändert).
- [ ] `src-tauri/src/db/mod.rs` (neu; `pub mod chat_entries; pub mod migrations; pub mod sessions;`):
  - `pub struct Database { connection: Mutex<Connection> }`.
  - `Database::open(path: &Path)`: Elternordner mit `fs::create_dir_all` anlegen (`?` wandelt `io::Error` um), `Connection::open(path)?`, dann `connection.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;")?`, dann `migrations::run(&mut connection)?`.
  - `Database::with`: Sperre poison-tolerant holen (`self.connection.lock().unwrap_or_else(PoisonError::into_inner)`, als eigene `let`-Zeile), `work(&mut connection)` aufrufen. Kein `unwrap`.
  - `enum_to_text` (`serde_json::to_value(value)`, muss `Value::String` sein, sonst `CommandError::Database("Wert ist kein Text")`) und `enum_from_text` (`serde_json::from_value(Value::String(text.to_owned()))`, Fehler → `CommandError::Database(format!("Unbekannter Wert „{text}“: {error}"))`).
- [ ] `src-tauri/src/db/migrations.rs` (neu) und `src-tauri/src/db/migrations/001_sessions_and_chat.sql` (Inhalt: die zwei `CREATE TABLE` aus der README, wörtlich). In `migrations.rs`:
  ```rust
  const MIGRATIONS: [&str; 1] = [include_str!("migrations/001_sessions_and_chat.sql")];

  pub fn run(connection: &mut Connection) -> Result<(), CommandError> {
      let applied: usize = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
      if applied > MIGRATIONS.len() {
          return Err(CommandError::Database(
              "Die Datenbank stammt von einer neueren Version der App.".to_owned(),
          ));
      }
      for (index, script) in MIGRATIONS.iter().enumerate().skip(applied) {
          let transaction = connection.transaction()?;
          transaction.execute_batch(script)?;
          transaction.execute_batch(&format!("PRAGMA user_version = {}", index + 1))?;
          transaction.commit()?;
      }
      Ok(())
  }
  ```
  Kommentar über `MIGRATIONS`: neue Migration = neue Datei anhängen und die Konstante verlängern, nie eine bestehende ändern.
- [ ] `src-tauri/src/db/sessions.rs` (neu): `SessionRow` und die vier Funktionen `upsert`, `load_active`, `archive`, `delete` laut README. Spalten-/Reihenfolge wie im Schema; Enums über `enum_to_text` / `enum_from_text`, `bool` als `i64` 0/1 (`rusqlite` bindet `bool` direkt). `upsert` per `INSERT … ON CONFLICT(id) DO UPDATE SET name, status, model, effort, mode, running_ms, context_used, context_window, has_agent_history` — **nicht** `created_at`, **nicht** `archived_at`. `load_active`: `SELECT … WHERE archived_at IS NULL ORDER BY created_at DESC`. `delete`: `DELETE FROM sessions WHERE id = ?1` (Einträge fallen per `ON DELETE CASCADE` mit).
- [ ] `src-tauri/src/db/chat_entries.rs` (neu): `upsert_all` (eine Transaktion über `connection.transaction()`, je Eintrag `INSERT INTO chat_entries (session_id, seq, payload) VALUES (?1, ?2, ?3) ON CONFLICT(session_id, seq) DO UPDATE SET payload = excluded.payload`, Nutzlast `serde_json::to_string(entry)`; Fehler von `to_string` → `CommandError::Database`) und `load_all` (`SELECT seq, payload … ORDER BY seq`, jede Nutzlast mit `serde_json::from_str::<ChatEntry>`; sobald `seq` nicht dem laufenden Index (0, 1, 2 …) entspricht, hier aufhören und bis dahin Gelesenes zurückgeben — der Verlauf im Speicher indiziert mit `seq`, eine Lücke darf nicht durchrutschen).
- [ ] `src-tauri/src/lib.rs`: `pub mod db;`. Im Builder `.setup(|app| { … })` ergänzen: Pfad `data_dir(app.handle())?.join("verwalter.db")`, `let database = Arc::new(Database::open(&path)?);`, `app.manage(database);`, `Ok(())`. Das bestehende `.manage(SessionRegistry::default())` bleibt in dieser Phase unverändert.
- [ ] `pnpm bindings` ausführen, die geänderte `CommandError.ts` mitcommitten.
- [ ] Doku (im selben Commit): `docs/code-map.md` — Zeile „Persistenz“ (Oberfläche: —, Core: `src-tauri/src/db/` mit `mod.rs` Verbindung + Text-Helfer, `migrations.rs` + `migrations/*.sql`, `sessions.rs`, `chat_entries.rs`) und die Zeile „Sessions“ um `src-tauri/src/db/sessions.rs` bereinigen (steht dort schon als „mit M4“). `docs/conventions/rust.md`, Abschnitt „Datenbank“: „Datei `<Benutzerordner>\.verwalter\verwalter.db`, eine Verbindung hinter einem Mutex (`Database::with`), WAL; Schreiben nur unter der Session-Sperre, Reihenfolge Session-Sperre → Datenbank-Sperre“ ergänzen.

## Report-Back
