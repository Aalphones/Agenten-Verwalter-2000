# Phase 2 — Sessions schreiben mit

**Status:** complete · **Rating:** heikel (Schreibpfad im Herz der Registry: Sperr-Reihenfolge, Fehlerpfade, jede Änderung geht durch `update`)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Kontrakt, ADR-Verweis
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) — Abschnitt „Konsequenzen“ (Fehlerverhalten)
- Bestand, vollständig lesen: `src-tauri/src/sessions/registry.rs` (Kopfkommentar zur Sperr-Disziplin, `update`, `Outbox`, `SessionState`, `start_process`), dazu `src-tauri/src/sessions/mod.rs`, `src-tauri/src/lib.rs`, die in Phase 1 entstandenen `src-tauri/src/db/*`
- Fehlerklasse (aus dem Vorgängerplan, Vault-Entity nicht lesbar): Sperren nie im Kopf eines `match` halten; Schreiben in die Prozess-Pipe nie unter der Session-Sperre (steht schon im Kopfkommentar der Registry). Neu hier: **die Datenbank-Sperre liegt immer innerhalb der Session-Sperre, nie umgekehrt** — kein Code unter `Database::with` darf `session.lock()` aufrufen.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. App starten (`starten.cmd`), Session anlegen, eine Nachricht senden, Antwort abwarten. Danach in einem zweiten Terminal (die App darf offen bleiben, WAL erlaubt Mitlesen):
   ```powershell
   node -e "const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(process.env.USERPROFILE+'/.verwalter/verwalter.db',{readOnly:true}); console.log(JSON.stringify(d.prepare('select name,status,has_agent_history from sessions').all())); console.log(JSON.stringify(d.prepare('select seq,substr(payload,1,60) as anfang from chat_entries order by seq').all()))"
   ```
   (Node 26 bringt `node:sqlite` mit; Python ist auf dieser Maschine nicht installiert.) Ergebnis: eine Zeile in `sessions` (`has_agent_history` = 1, Status passend zur Anzeige) und mindestens die Einträge `user` und `text` in `chat_entries`, mit lückenlosem `seq` ab 0.
3. Das Verhalten der App bleibt gegenüber Meilenstein 2a unverändert; der Chat friert beim Streamen nicht ein.
4. Code-Prüfung des Fehlerpfads in `create`: schlägt `start_process` fehl (z. B. `ClaudeNotFound`), wird die Zeile in `sessions` wieder gelöscht (`sessions::delete`), und die Session steht nicht in der Map.

## Checkliste

- [x] `SessionRegistry` (`registry.rs`): `#[derive(Default)]` entfernen; Feld `database: Arc<Database>` ergänzen; `pub fn new(database: Arc<Database>) -> SessionRegistry` (leere Map). Aufruf `new` statt `default` in `lib.rs`: das `.manage(SessionRegistry::default())` aus dem Builder entfernen und in `.setup(...)` nach dem `app.manage(database)` **`app.manage(SessionRegistry::new(Arc::clone(&database)))`** setzen (vorher `database` klonen, dann `manage`).
- [x] `Session`-Struct: Feld `database: Arc<Database>`; `create` reicht `Arc::clone(&self.database)` hinein.
- [x] `SessionState`: neues Feld `has_agent_history: bool` (in `SessionState::new` `false`). In `apply_event` bei `AgentEvent::Ready { .. }`: vor dem Statuswechsel `if !self.has_agent_history { self.has_agent_history = true; outbox.summary_dirty = true; }`.
- [x] `start_process` verliert den Parameter `resume: bool` und nimmt stattdessen `resume = state.has_agent_history` (Wert **vor** dem Spawn lesen und in `SpawnOptions.resume` übergeben). Aufrufer anpassen: `create`, `send` (Denkaufwand-Wechsel), `restart`. Kommentar an der Stelle: Claude kennt eine Session erst nach `system/init`; `--resume` auf eine unbekannte ID bricht mit „No conversation found“ ab.
- [x] Neue freie Funktion in `registry.rs`:
  ```rust
  fn row_of(session: &Session, state: &SessionState) -> SessionRow
  ```
  füllt `SessionRow` aus `state` (`id` aus `session.id`; `created_at`, `running_ms`, `context_*`, `has_agent_history`, Modell/Denkaufwand/Modus/Status/Name).
- [x] Neue freie Funktion `fn persist(session: &Session, state: &mut SessionState, outbox: &Outbox)`: ruft `session.database.with(|connection| { … })` und schreibt darin (a) wenn `outbox.summary_dirty`: `sessions::upsert(connection, &row_of(session, state))?`, (b) wenn `!outbox.entries.is_empty()`: `chat_entries::upsert_all(connection, &session.id, &outbox.entries)?`; **Reihenfolge: erst Session, dann Einträge** (Fremdschlüssel). Schlägt es fehl: `state.push_log(format!("Speichern fehlgeschlagen: {error}"))` — kein Abbruch, kein Fehler an die Oberfläche (der Closure-Borrow von `state` endet vor dem `push_log`).
- [x] `update(...)`: direkt nach `let result = change(&mut state, &mut outbox);` und **vor** dem Bauen von `outbox.summary` `persist(session, &mut state, &outbox);` aufrufen — auch wenn `result` ein Fehler ist (die Closure kann den Zustand schon verändert haben). Alles bleibt innerhalb des Blocks, in dem die Session-Sperre gehalten wird.
- [x] `create`: in der Closure als erste Zeile `outbox.summary_dirty = true;` (sonst wird die neue Session nie als Zeile angelegt). Im Fehlerpfad (`if created.is_err()`) zusätzlich die Zeile wieder löschen: `let _ = session.database.with(|connection| sessions::delete(connection, &id));` — `persist` läuft auch bei Fehlern und hat sonst eine Geister-Session hinterlassen.
- [x] `lib.rs`: `Database` und `SessionRegistry` beide in `setup` verwalten; Reihenfolge: Datenbank öffnen → `manage(Arc<Database>)` → `manage(SessionRegistry::new(...))`.
- [x] Prüfen per Lesen (kein Test, keine Suche nötig): jede Stelle, die `.database.with(` aufruft, steht in `registry.rs` und läuft entweder unter der Session-Sperre (`persist`) oder ohne (`create`-Fehlerpfad, nach `update`) — nirgends ruft eine Closure in `database.with` `session.lock()` oder `update` auf.
- [x] Doku: `docs/code-map.md` unverändert (Ordner-grob). `docs/glossary.md`: nichts. Diese Phase ändert keine Konvention.

## Report-Back

- Prüfkette grün. Sperr-Reihenfolge per Lesen geprüft: `database.with` steht nur in `persist` (unter der Session-Sperre, der Closure-Inhalt sperrt keine Session) und im Fehlerpfad von `create` (nach `update`, ohne Sperre).
- AK 2 belegt am 2026-09-28 mit der laufenden App (Debug-Port von WebView2, `session_create` direkt aufgerufen, Modell Haiku): `sessions` enthält die Session mit Status `completed`, `has_agent_history` = 1, Kontext 44560; `chat_entries` die Einträge 0 (`user`), 1 (`thinking`), 2 (`text`) ohne Lücke.
- AK 4 (Fehlerpfad von `create`) nur per Code-Prüfung: bei einem Fehler wird die Session aus der Map entfernt und die Zeile per `sessions::delete` gelöscht.
- Findings/Beobachtung: `persist` schreibt bei jedem Eintrag die Session-Zeile mit, sobald `summary_dirty` gesetzt ist (Statuswechsel, Kontextänderung); das sind wenige Schreibvorgänge pro Antwort, kein Engpass beobachtet.
