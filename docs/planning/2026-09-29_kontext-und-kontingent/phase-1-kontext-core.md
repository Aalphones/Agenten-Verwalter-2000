# Phase 1 — Core: Kontext-Aufschlüsselung je Session

Rating: standard · Commit-Scope: `context`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ und „Kontrakt“ (Typen, Commands, Ereignisse) — verbindlich.
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitte „Steueranfragen“ und „Kontext und Kontingent abfragen“ (Antwortformat von `get_context_usage`).
- [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/commits.md](../../conventions/commits.md).
- Code: `src-tauri/src/agents/claude/protocol.rs` (Zeilenformate, `Incoming`, `lenient`, `stop_task`), `src-tauri/src/agents/claude/translate.rs` (`Translator::handle_line`, `turn_ended`), `src-tauri/src/agents/event.rs` (`AgentEvent`), `src-tauri/src/sessions/registry.rs` (`SessionState`, `Outbox` samt Ausgabe von `background://changed`, `send_control`, `apply_event`, `end_turn`, `now_ms`, `stop_background` als Muster eines Commands mit `update`), `src-tauri/src/background/model.rs` (Muster für Typen mit `derive(TS)` und `BackgroundChangedEvent`), `src-tauri/src/commands/background.rs` (Muster Commands), `src-tauri/src/lib.rs` (Module, `generate_handler!`), `src-tauri/src/bin/gen-bindings.rs`, `src-tauri/src/filesystem/workspace.rs` (`home_dir`).
- Vault-Fehlerklassen: geprüft (Claude Code, SQLite, React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. Eine `control_response`-Zeile mit `subtype: "success"` und einer `get_context_usage`-Antwort wird zu `AgentEvent::ContextBreakdown`; jede andere `control_response` (Bestätigung von `stop_task`, `subtype: "error"`) erzeugt kein Ereignis und keinen `Unknown`-Eintrag.
2. `ContextBreakdown.categories` enthält nur Kategorien mit `kind` `used` oder `free` (`is_free` = `kind == "free"`), in Eingangsreihenfolge; Kategorien mit `kind` `deferred` oder ohne `kind` fehlen.
3. Nach jedem `TurnEnded` schickt der Core `{"subtype":"get_context_usage"}` an den Agenten, außer die Session wurde abgebrochen (`cancel_requested`) oder der Prozess hört nicht zu. Ein Fehler beim Einreihen ändert nichts am übrigen Ablauf von `end_turn`.
4. Eine eintreffende Aufschlüsselung setzt `fetched_at` auf `now_ms()`, ersetzt die vorige in `SessionState.context_breakdown` und löst genau ein `context://changed` mit der Session-ID aus. `context_used` und `context_window` bleiben unberührt.
5. `context_load` liefert `SessionContext`; jeder Pfad in `memory_files`, der mit dem Benutzerordner beginnt, beginnt dort mit `~` (Vergleich ohne Beachtung der Groß-/Kleinschreibung, Trenner bleiben `\`). `is_agent_running` ist `true` genau dann, wenn ein Prozess existiert und der Status weder `cancelled` noch `error` ist.
6. `context_refresh` gibt `true` zurück und schickt die Anfrage, wenn der Agent zuhört; sonst `false` ohne Fehler. Unbekannte Session → `sessionNotFound`.
7. Nach einem App-Neustart ist `breakdown` `None`; ein beendeter Agent (Ruhe-Timer) lässt die letzte Aufschlüsselung stehen.
8. `pnpm bindings` erzeugt `ContextCategory.ts`, `ContextFile.ts`, `ContextBreakdown.ts`, `SessionContext.ts`, `ContextChangedEvent.ts`; `pnpm check` grün.

## Checkliste

### Typen

- [ ] Neues Modul `src-tauri/src/context/` mit `mod.rs` (nur `pub mod model;`) und `model.rs`: die fünf Typen aus dem README-Kontrakt, `derive(Debug, Clone, Serialize, TS)` und `#[serde(rename_all = "camelCase")]` wie in `background/model.rs`. `pub mod context;` in `src-tauri/src/lib.rs` (alphabetisch nach `commands`).
- [ ] In `context/model.rs`: `impl SessionContext { pub fn with_home_shortened(mut self, home: &Path) -> SessionContext }` — ersetzt in jedem `memory_files[].path` den Präfix `home` (als `to_string_lossy`, Vergleich per `to_lowercase` auf beiden Seiten) durch `~`. Nur ein echter Präfix, gefolgt von `\` oder `/`.
- [ ] Alle fünf Typen in `src-tauri/src/bin/gen-bindings.rs` eintragen (`use` + `export_all`, neben den Hintergrund-Typen).

### Protokoll und Übersetzung

- [ ] `protocol.rs`: `Incoming::ControlResponse(ControlResponseLine)` mit `#[serde(rename = "control_response")]`, vor `Other`. `ControlResponseLine { pub response: ControlResponseBody }`, `ControlResponseBody { pub subtype: String, pub request_id: Option<String>, #[serde(default, deserialize_with = "lenient")] pub response: Option<Value>, pub error: Option<String> }`. Kommentar: Antwort auf eine eigene Steueranfrage.
- [ ] `protocol.rs`: `pub fn get_context_usage() -> Value { json!({ "subtype": "get_context_usage" }) }` neben `stop_task`, mit Doc-Kommentar (Aufschlüsselung des Kontexts; Antwort als `control_response`).
- [ ] Neue Datei `src-tauri/src/agents/claude/stats.rs` (in `agents/claude/mod.rs` eintragen): `pub fn context_breakdown(body: &Value) -> Option<ContextBreakdown>`. Liest über private `Deserialize`-Structs mit `#[serde(rename_all = "camelCase")]` und `Option`-Feldern (`categories: Option<Vec<RawCategory>>`, `total_tokens`, `max_tokens`, `model`, `memory_files`, `auto_compact_threshold`, `is_auto_compact_enabled`); `RawCategory { name: Option<String>, tokens: Option<u64>, kind: Option<String> }`, `RawFile { path: Option<String>, tokens: Option<u64> }`. Ergebnis `None`, wenn `categories` oder `max_tokens` fehlt oder `serde_json::from_value` scheitert. Kategorien/Dateien ohne Namen/Pfad fallen weg; Tokens per `u32::try_from(..).unwrap_or(u32::MAX)`. `auto_compact_threshold` nur, wenn `is_auto_compact_enabled == Some(true)`. `model` fehlt → leerer String. `fetched_at: 0.0`.
- [ ] `event.rs`: Variante `AgentEvent::ContextBreakdown(ContextBreakdown)` mit Doc-Kommentar (Antwort auf `get_context_usage`), direkt nach `TurnEnded`.
- [ ] `translate.rs`: in `handle_line` `Incoming::ControlResponse(line) => control_answered(line)`. Freie Funktion `control_answered(line: ControlResponseLine) -> Vec<AgentEvent>`: nur bei `subtype == "success"` und `Some(body)`: `stats::context_breakdown(&body)` → `vec![AgentEvent::ContextBreakdown(b)]`, sonst `Vec::new()`. Erkennung am Inhalt statt an der Request-ID, weil nur diese Antwort `categories` + `maxTokens` trägt (Kommentar).

### Registry

- [ ] `SessionState`: Feld `context_breakdown: Option<ContextBreakdown>` mit Doc-Kommentar (letzte Aufschlüsselung, nur im Speicher, siehe ADR 008); in beiden Konstruktoren (neu und `restored`) `None`.
- [ ] `SessionState::is_listening(&self) -> bool` aus der Bedingung in `send_control` herausziehen; `send_control` benutzt sie.
- [ ] `Outbox`: Feld `context_changed: bool`; beim Ausgeben analog zu `background_changed` `app.emit(CONTEXT_CHANGED_EVENT, ContextChangedEvent { session_id })`, Fehlertext „Kontext-Ereignis nicht gesendet: …“. Konstante `CONTEXT_CHANGED_EVENT: &str = "context://changed"` bei den anderen Ereignis-Namen.
- [ ] `apply_event`: `AgentEvent::ContextBreakdown(mut breakdown) => { breakdown.fetched_at = now_ms(); self.context_breakdown = Some(breakdown); outbox.context_changed = true; }` — ohne `wake_if_idle`.
- [ ] `end_turn`: nach dem Block zu `context_window` und `todos_seq`, **vor** `if self.cancel_requested { return; }` nur wenn `!self.cancel_requested`: `let _ = self.send_control(outbox, get_context_usage());` mit Kommentar: die Aufschlüsselung ist Beiwerk; ein Fehler darf das Ende der Antwort nicht stören.
- [ ] `pub fn context(&self, session_id: &str) -> Result<SessionContext, CommandError>`: Session holen, unter der Sperre `breakdown` klonen und `is_agent_running = state.is_listening()`.
- [ ] `pub fn refresh_context(&self, app: &AppHandle, session_id: &str) -> Result<bool, CommandError>`: über `update` wie `stop_background`; wenn `!state.is_listening()` → `Ok(false)`, sonst `state.send_control(outbox, get_context_usage())?; Ok(true)`.

### Commands

- [ ] Neue Datei `src-tauri/src/commands/context.rs` (in `commands/mod.rs` eintragen), beide `async` wie in `commands/background.rs`: `context_load(app, registry, session_id) -> Result<SessionContext, CommandError>` = `registry.context(&session_id)?.with_home_shortened(&home_dir(&app)?)`; `context_refresh(app, registry, session_id) -> Result<bool, CommandError>`.
- [ ] Beide in `generate_handler!` in `src-tauri/src/lib.rs`.
- [ ] `pnpm bindings`, `pnpm check`.

### Doku

- [ ] `docs/decisions/008-kontext-und-kontingent.md` aus README „Festgelegte Entscheidungen“: Kontext / betrachtete Optionen (Kontext: eigene Rechnung aus `usage` · `get_context_usage`; Speicher: SQLite · nur Speicher; Kontingent: Hilfsprozess · Agent der laufenden Session · `rate_limit_event`) / Entscheidung / Konsequenzen (experimentelles Format, Hilfsprozess kostet ~1,4 s und einen kurzen Prozess, Aufschlüsselung überlebt keinen Neustart).
- [ ] `docs/conventions/commits.md`: Scope `context` in die Liste.
- [ ] `docs/code-map.md`: Zeile „Kontext (Aufschlüsselung je Session)“ mit Core `src-tauri/src/context/` (Typen), `src-tauri/src/agents/claude/stats.rs`, `src-tauri/src/commands/context.rs`, Zustand in `sessions/registry.rs`; Oberfläche „folgt (Phase 3)“. `context` in die Feature-Liste unter „Namensschema“.

## Report-Back
