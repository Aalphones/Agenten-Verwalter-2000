# Phase 3 — Nach dem Neustart wiederherstellen

**Status:** pending · **Rating:** heikel (Zustandsübergänge nach einem Absturz, Verlauf wird erst beim ersten Zugriff geladen, Agent startet erst bei Bedarf — jede Methode der Registry muss mit „kein Prozess“ und „Verlauf noch nicht geladen“ umgehen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Kontrakt (`load_active`, `load_all`, `SessionRow`)
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) — „Entscheidung“, „Konsequenzen“
- Bestand vollständig: `src-tauri/src/sessions/registry.rs` (Stand nach Phase 2), `src-tauri/src/lib.rs`, `src/app/App.tsx`, `src/features/sessions/useSessionSummaries.ts`
- Fehlerklassen (Vault-Entity nicht lesbar): Sperren nie im Kopf eines `match`; Datenbank-Sperre nur innerhalb der Session-Sperre. Neu hier: **ein Lade-Fehler darf die Session nicht verschwinden lassen** — schlägt `load_all` fehl, bleibt `entries_loaded` auf `false`, der Aufruf meldet den Fehler, ein späterer Versuch lädt erneut.
- Belegt am 2026-09-28: `claude -p --resume <unbekannte-id>` endet mit Exit-Code 1 und „No conversation found with session ID …“ — deshalb `has_agent_history` (Phase 2).

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. Session mit einer Antwort anlegen, App normal schließen und neu starten: Session steht in der Sidebar (Gruppe „Läuft“, Status „Pausiert“, wenn sie vor dem Schließen lief; „Abgeschlossen“, wenn sie fertig war), Verlauf ist vollständig, die Kopfzeile zeigt Modell, Modus, Kontext-Balken und Laufzeit wie vorher.
3. Nachricht senden (oder „Fortsetzen“ in der Kopfzeile bei einer pausierten Session): Status wird „Läuft“, der Agent antwortet und kennt den Verlauf („Worüber haben wir gerade gesprochen?“).
4. Eine Session mit offener Rückfrage beim Beenden: nach dem Start trägt der Rückfrage-Kasten „Nicht beantwortet“, ohne Knöpfe; eine Werkzeug-Zeile, die lief, zeigt „unterbrochen“.
5. Code-Prüfung (kein Fenster nötig): `load_all` liefert bei einer Lücke in `seq` nur den Verlauf bis zur Lücke, und eine Session, deren Laden fehlschlägt, bleibt in der Liste und lädt beim nächsten Zugriff erneut.
6. Nach dem Start ist die neueste Session geöffnet (nicht der Leerzustand), solange mindestens eine existiert; „Neue Session“ und Ctrl+N gehen wie vorher.

## Checkliste

- [ ] `SessionState` (`registry.rs`): neue Felder `entries_loaded: bool` (in `new`: `true` — eine frisch angelegte Session hat nichts nachzuladen) und `needs_settling: bool` (in `new`: `false`).
- [ ] `SessionState::restored(row: &SessionRow) -> SessionState` (neu): alle Felder aus `row`; `status` = `Paused`, wenn `row.status` `Starting`, `Running` oder `Waiting` war, sonst unverändert; `needs_settling` = „war aktiv“; `entries` leer, `entries_loaded: false`; `running_since: None`; `process: None`; `process_effort` = `row.effort`; alle übrigen Felder wie in `new`.
- [ ] `SessionState::settle_after_restart(&mut self, outbox: &mut Outbox)` (neu): über `self.entries` iterieren (Muster wie `interrupt_running_tools`: `let … = entry else { continue };`, danach `outbox.entries.push(entry.clone())`): `ChatEntry::Question` mit `answer == None` → `Some("Nicht beantwortet")`; `ChatEntry::Tool` mit `state == ToolState::Running` → `ToolState::Interrupted`.
- [ ] `SessionState::load_entries(&mut self, session: &Session) -> Result<(), CommandError>` (neu): `session.database.with(|connection| chat_entries::load_all(connection, &session.id))?` → `self.entries`; `self.entries_loaded = true`; wenn `self.needs_settling`: `let mut outbox = Outbox::default(); self.settle_after_restart(&mut outbox); self.needs_settling = false;` und `outbox.entries` direkt mit `chat_entries::upsert_all` zurückschreiben (Fehler → `self.push_log`, kein Abbruch). Es wird nichts an die Oberfläche gesendet — sie hat den Verlauf noch nie gesehen.
- [ ] `Session::lock_loaded(&self) -> Result<MutexGuard<'_, SessionState>, CommandError>` (neu): `let mut state = self.lock(); if !state.entries_loaded { state.load_entries(self)?; } Ok(state)`.
- [ ] `update(...)`: `session.lock()` durch `session.lock_loaded()?` ersetzen (Fehler vor `change` zurückgeben). `history(...)`: ebenfalls `lock_loaded()?`. `list`, `log`, `resume` (liest nur `status`) und `get` bleiben bei `lock()` — sie brauchen den Verlauf nicht und dürfen ihn nicht laden.
- [ ] `SessionRegistry::restore(app: &AppHandle, database: Arc<Database>) -> Result<SessionRegistry, CommandError>` (ersetzt `new` im Aufruf von `lib.rs`; `new` darf entfallen): `sessions::load_active` lesen; je `SessionRow` `session_workspace(app, &row.id)?`, `Session { id, workspace, database: Arc::clone(&database), state: Mutex::new(SessionState::restored(&row)) }`; für jede Zeile, deren Status sich durch das Wiederherstellen ändert (war aktiv), die Zeile mit `status: Paused` per `sessions::upsert` zurückschreiben (eine `database.with`-Runde für alle).
- [ ] `send(...)`: die Bedingung vor `start_process` wird `if state.process.is_none() || state.effort != state.process_effort { start_process(app, &session, state)?; }` — ein wiederhergestellter Agent startet hier, mit `--resume` (bzw. `--session-id`, solange `has_agent_history` falsch ist).
- [ ] Prüfen per Lesen, dass die übrigen Methoden mit `process: None` sicher sind (kein Code nötig, wenn es stimmt; sonst anpassen): `pause` (nicht aktiv → `Ok`), `resume` (→ `send`), `cancel` (`outbox.retire` tut bei `None` nichts; kein `interrupt_agent`, weil der Status nicht `Running`/`Waiting` ist), `restart` (nur Status `Error`; `start_process`), `set_model`/`set_mode` (`send_control` ist bei fehlendem Prozess ein `Ok`-No-op; der Wert steht im Zustand und geht beim nächsten Start in `SpawnOptions`), `set_effort`, `answer` (keine offenen Anfragen → `Rückfrage nicht offen`). Ergebnis in den Report-Back.
- [ ] `lib.rs`: in `setup` `SessionRegistry::restore(app.handle(), Arc::clone(&database))?` statt `new`.
- [ ] Frontend `src/app/App.tsx`: neue Ableitung `const currentSession: SessionSummary | undefined = activeSession ?? sessions[0];` (ohne Effekt, ohne Zustand). `renderMain` und die `activeSessionId`-Prop der Sidebar nutzen `currentSession` statt `activeSession`; solange die Liste noch lädt (leer), bleibt der Leerzustand sichtbar. `ChatView` behält `key={currentSession.id}`.
- [ ] Doku (im selben Commit): `docs/glossary.md` — Eintrag „Event Store“ auf den Stand bringen: aus „SQLite-Tabelle `events`“ wird „Chat-Einträge einer Session in SQLite (`chat_entries`); rohe Agent-Ereignisse werden nicht gespeichert (ADR 004)“; `Session-Status`-Eintrag ergänzen: „Nach einem App-Neustart ist eine vorher aktive Session `paused`.“ `docs/design/2026-09-28_hauptansichten/README.md`, „Abweichungen bis Meilenstein 3“: Zeile „Nach dem Start öffnet sich die neueste Session; der Leerzustand erscheint nur ohne Sessions.“

## Report-Back
