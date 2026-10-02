# Phase 1 — Core: Typen, Steueranfragen, Antworten zuordnen, Commands, Ereignis

Rating: **standard** · Commit: `feat(mcp): MCP-Server einer Session abfragen und steuern`

## Kontext (vor dem Start lesen)

- [README.md](README.md) des Plans: Messungen, Festgelegte Entscheidungen, **Kontrakt** (Typen, Commands, Ereignis, Steueranfragen, `AgentEvent`-Varianten — exakt so umsetzen).
- [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/linting.md](../../conventions/linting.md), [ADR 008](../../decisions/008-kontext-und-kontingent.md).
- Vorbild in jeder Schicht ist die Kontext-Aufschlüsselung: `src-tauri/src/context/model.rs`, `src-tauri/src/commands/context.rs`, `src-tauri/src/agents/claude/stats.rs` (`context_breakdown`), in `src-tauri/src/sessions/registry.rs` die Methoden `context`/`refresh_context`, das Feld `context_breakdown`, `Outbox::context_changed` und dessen Ausgabe in `Outbox::emit`.
- `src-tauri/src/agents/claude/translate.rs`: `control_answered` (heute: nur `get_context_usage` wird ausgewertet, Fehler und leere Antworten fallen weg).
- `src-tauri/src/sessions/registry/tldr.rs` als Muster für ein Untermodul der Registry (`use super::{…}`, `impl SessionRegistry` im Untermodul).
- Fehlerklassen geprüft (Vault: `sprachen/typescript`, `frameworks/react`, `werkzeuge/claude-code`; für Rust und Tauri gibt es keine Entity): keine einschlägig.

## Abnahmekriterien der Phase

1. `mcp_load` liefert für eine Session mit laufendem Agenten nach der ersten Antwort des Agenten eine Liste; jeder Server trägt `status`, `scope`, `connection` (`stdio · <Dateiname>` bzw. `HTTPS · <Host>`), `tools` und bei `failed` den `error`-Text der Kommandozeile.
2. `mcp_reconnect` auf einen funktionierenden Server: Name steht bis zur Antwort in `busy`, danach nicht mehr; es folgt eine neue Liste. Auf einen kaputten Server: `error` = `{ server, action: "reconnect", text: "Connection closed" }`.
3. `mcp_toggle(…, false)` → nach der Antwort meldet die neue Liste den Server `disabled`; `mcp_toggle(…, true)` → `pending`, später `connected`.
4. Jeder Weg, auf dem der Agent-Prozess endet oder ersetzt wird, verwirft Liste, laufende Aktionen und Fehler und meldet `mcp://changed`; `SessionSummary.mcpProblems` ist danach 0.
5. Die Kontext-Aufschlüsselung kommt weiter an (Kontext-Fenster der Kopfzeile zeigt Kategorien), `stop_task` funktioniert weiter (Hintergrundprozess anhalten).
6. `pnpm check` grün; `pnpm bindings` erzeugt die neuen Typen, `SessionSummary.ts` trägt `mcpProblems: number`.

## Checkliste

### Typen und Parser

- [x] `src-tauri/src/mcp/mod.rs` (`pub mod model;`) und `src-tauri/src/mcp/model.rs` mit den Typen aus dem Kontrakt, Doc-Kommentare wie dort. In `src-tauri/src/lib.rs` `pub mod mcp;` alphabetisch einreihen.
- [x] In `McpServerStatus` zusätzlich `impl McpServerStatus { pub fn from_cli(value: &str) -> Self }`: `"connected"` → `Connected`, `"pending"` → `Pending`, `"failed"` → `Failed`, `"needs-auth"` → `NeedsAuth`, `"disabled"` → `Disabled`, alles andere → `Unknown`. Und `pub fn is_problem(self) -> bool` = `Failed | NeedsAuth`.
- [x] Neue Datei `src-tauri/src/agents/claude/mcp.rs` (in `agents/claude/mod.rs` eintragen), Kopfkommentar wie `stats.rs`: Format nicht als stabil dokumentiert, jedes Feld optional. Funktion `pub fn mcp_servers(body: &Value) -> Option<Vec<McpServer>>`:
  - `None`, wenn `body["mcpServers"]` kein Array ist (so unterscheidet `control_answered` die Antwort von anderen).
  - Je Element: ohne String-`name` überspringen. `status` über `McpServerStatus::from_cli` (fehlt → `Unknown`). `scope` als String, fehlt → `""`. `tools`: Array von Objekten, je `name` als String, Einträge ohne `name` fallen weg; fehlt → leer. `error`: String oder `None`.
  - `connection` aus `config` (private Funktion `connection(config: &Value) -> String`): hat `config` einen String `url` → Schema und Host: beginnt mit `https://` → `"HTTPS · <host>"`, mit `http://` → `"HTTP · <host>"`, `<host>` = Text nach `://` bis zum ersten `/`, `?` oder `#` (ohne diese Zeichen; Port bleibt dran). Sonst hat `config` einen String `command` → `"stdio · <dateiname>"`, `<dateiname>` = Teil nach dem letzten `\` oder `/` (ganzer String, wenn keiner vorkommt). Sonst `config.type` als String, sonst `""`.
  - Mit `serde_json::Value`-Zugriffen (`get`, `as_str`, `as_array`) statt eigener Deserialize-Structs — die Antwort ist verschachtelt und lose; kein `unwrap`.

### Protokoll und Übersetzung

- [x] `protocol.rs`: `pub fn mcp_status() -> Value`, `pub fn mcp_reconnect(server: &str) -> Value`, `pub fn mcp_toggle(server: &str, enabled: bool) -> Value` nach dem Kontrakt, unter `get_usage`, je mit einzeiligem Doc-Kommentar.
- [x] `event.rs`: die drei `AgentEvent`-Varianten aus dem Kontrakt hinter `ContextBreakdown` einfügen, mit Doc-Kommentaren („Antwort auf `mcp_status`.“ · „Erfolgreiche Antwort auf eine Steueranfrage ohne auswertbaren Inhalt.“ · „Fehlerantwort auf eine Steueranfrage.“). Import `crate::mcp::model::McpServer`.
- [x] `translate.rs`, `control_answered` ersetzen:
  ```rust
  /// Erkennung am Inhalt: `get_context_usage` trägt `categories` und `maxTokens`, `mcp_status`
  /// trägt `mcpServers`. Alles andere — leere Bestätigungen und Fehler — geht mit seiner Request-ID
  /// weiter; die Registry wertet nur IDs aus, die sie selbst für eine MCP-Aktion vergeben hat.
  fn control_answered(line: ControlResponseLine) -> Vec<AgentEvent> {
      let body = line.response;
      let request_id = body.request_id.unwrap_or_default();
      if body.subtype != "success" {
          return vec![AgentEvent::ControlFailed { request_id, error: body.error.unwrap_or_default() }];
      }
      let Some(response) = body.response else {
          return vec![AgentEvent::ControlSucceeded { request_id }];
      };
      if let Some(breakdown) = stats::context_breakdown(&response) {
          return vec![AgentEvent::ContextBreakdown(breakdown)];
      }
      if let Some(servers) = mcp::mcp_servers(&response) {
          return vec![AgentEvent::McpServers(servers)];
      }
      vec![AgentEvent::ControlSucceeded { request_id }]
  }
  ```

### Registry

- [x] `registry.rs`, `SessionState` — neue Felder hinter `context_breakdown`, mit Doc-Kommentaren:
  ```rust
  /// Letzte Antwort auf `mcp_status`; nur im Speicher und nur, solange der Prozess lebt (ADR 013).
  mcp_servers: Option<Vec<McpServer>>,
  mcp_fetched_at: Option<f64>,
  /// Laufende Aktionen als Request-ID → (Server, Aktion).
  mcp_actions: HashMap<String, (String, McpAction)>,
  mcp_error: Option<McpActionError>,
  ```
  In `SessionState::new` mit `None`, `None`, `HashMap::new()`, `None` belegen.
- [x] `Outbox`: Feld `mcp_changed: bool` hinter `context_changed`; in `Outbox::emit` nach dem Kontext-Block analog `McpChangedEvent` an `MCP_CHANGED_EVENT` senden, Logzeile „MCP-Ereignis nicht gesendet: {error}“. Die Konstante `pub(super) const MCP_CHANGED_EVENT: &str = "mcp://changed";` steht in `registry/mcp.rs`.
- [x] `summarize`: `mcp_problems: state.mcp_problem_count(),` hinter `number`. `SessionSummary` in `sessions/model.rs`: Feld `pub mcp_problems: u32` mit Doc-Kommentar „Server mit Status `Failed` oder `NeedsAuth`; 0 ohne Liste.“.
- [x] `mod mcp;` neben `mod tldr;`. Neue Datei `src-tauri/src/sessions/registry/mcp.rs`, Kopfkommentar: MCP-Server der Session über Steueranfragen an ihren Agenten; Liste nur im Speicher, verworfen mit dem Prozess (ADR 013). Inhalt:
  - `impl SessionRegistry`:
    - `pub fn mcp(&self, session_id: &str) -> Result<SessionMcp, CommandError>` — wie `context`: unter der Sperre `servers`, `busy` (Servernamen aus `mcp_actions`, sortiert, ohne Doppelte), `error`, `fetched_at`, `is_agent_running: state.is_listening()`.
    - `pub fn refresh_mcp(&self, app: &AppHandle, session_id: &str) -> Result<bool, CommandError>` — wie `refresh_context`, Anfrage `mcp_status()`.
    - `pub fn reconnect_mcp(&self, app, session_id, server: &str) -> Result<bool, CommandError>` → `start_mcp_action(outbox, server, McpAction::Reconnect, mcp_reconnect(server))`.
    - `pub fn toggle_mcp(&self, app, session_id, server: &str, enabled: bool) -> Result<bool, CommandError>` → Aktion `Enable` bzw. `Disable`, Anfrage `mcp_toggle(server, enabled)`.
    - alle über `update(app, &session, |state, outbox| …)`.
  - `impl SessionState`:
    - `fn start_mcp_action(&mut self, outbox: &mut Outbox, server: &str, action: McpAction, request: Value) -> Result<bool, CommandError>`: nicht `is_listening()` → `Ok(false)`. Server nicht in `mcp_servers` (oder Liste `None`) → `Err(CommandError::Internal(format!("MCP-Server unbekannt: {server}")))`. Sonst `let request_id = self.next_request_id();`, `outbox.write(self, control_request(&request_id, request))?;`, erst danach `mcp_actions.insert(request_id, (server.to_owned(), action))`, `mcp_error = None`, `outbox.mcp_changed = true`, `Ok(true)`.
    - `fn apply_mcp_servers(&mut self, outbox: &mut Outbox, servers: Vec<McpServer>)`: alte Problemzahl merken, Liste und `mcp_fetched_at = Some(now_ms())` setzen, `outbox.mcp_changed = true`; neue Problemzahl ≠ alte → `outbox.summary_dirty = true`.
    - `fn mcp_answered(&mut self, outbox: &mut Outbox, request_id: &str, error: Option<String>)`: `mcp_actions.remove(request_id)`; kein Treffer → nichts tun (fremde Antwort, z. B. `stop_task`). Treffer `(server, action)`: bei `Some(text)` → `mcp_error = Some(McpActionError { server, action, text })`. In beiden Fällen `outbox.mcp_changed = true` und `let _ = self.send_control(outbox, mcp_status());` (Kommentar: die Liste ist Beiwerk, ein Fehler beim Einreihen ändert nichts am Ausgang der Aktion).
    - `fn forget_mcp(&mut self, outbox: &mut Outbox)`: hatte die Session eine Liste, laufende Aktionen oder einen Fehler → alles leeren (`None`, `clear()`, `None`, `mcp_fetched_at = None`), `outbox.mcp_changed = true`; war die Problemzahl vorher > 0 → `outbox.summary_dirty = true`.
    - `fn mcp_problem_count(&self) -> u32`: Anzahl Server mit `status.is_problem()`, 0 ohne Liste (`u32::try_from(…).unwrap_or(u32::MAX)`).
- [x] `apply_event` in `registry.rs`, neue Arme hinter `ContextBreakdown`:
  ```rust
  AgentEvent::McpServers(servers) => self.apply_mcp_servers(outbox, servers),
  AgentEvent::ControlSucceeded { request_id } => self.mcp_answered(outbox, &request_id, None),
  AgentEvent::ControlFailed { request_id, error } => self.mcp_answered(outbox, &request_id, Some(error)),
  ```
- [x] `end_turn`: direkt unter `let _ = self.send_control(outbox, get_context_usage());` die Zeile `let _ = self.send_control(outbox, mcp_status());` (Kommentar darüber erweitern: „Aufschlüsselung und MCP-Liste sind Beiwerk …“).
- [x] `forget_mcp(outbox)` an den drei Stellen aufrufen, an denen der Prozess endet oder ersetzt wird — jeweils direkt nach der Zeile, die `process` leert bzw. ersetzt:
  - `process_exited`: nach `self.process = None;`
  - Start-Funktion (die Stelle mit `if let Some(previous) = state.process.take()`): **nach** diesem `if`-Block, unabhängig davon, ob es einen vorigen Prozess gab, `state.forget_mcp(outbox);`
  - `retire_idle_process`: nach `state.process = None;`
- [x] Imports in `registry.rs` und `registry/mcp.rs` ergänzen (`mcp_status`, `mcp_reconnect`, `mcp_toggle`, `control_request` aus `protocol`; Typen aus `crate::mcp::model`). Private Methoden von `SessionState` (`next_request_id`, `is_listening`, `send_control`) sind aus dem Untermodul erreichbar; nichts davon `pub` machen.

### Commands, Bindings

- [x] `src-tauri/src/commands/mcp.rs` (in `commands/mod.rs` eintragen) nach dem Kontrakt, Muster `commands/context.rs` (`async`, Kommentar zum Haupt-Thread übernehmen). Parameter heißen `session_id`, `server`, `enabled`. In `lib.rs` hinter `context_refresh` registrieren: `mcp_load`, `mcp_refresh`, `mcp_reconnect`, `mcp_toggle`.
- [x] `gen-bindings.rs`: Import `mcp::model::{McpAction, McpActionError, McpChangedEvent, McpServer, McpServerStatus, SessionMcp}`, Exporte hinter `ContextChangedEvent`. `pnpm bindings`, erzeugte Dateien mitcommitten.

### Doku (gleicher Commit)

- [x] `docs/decisions/013-mcp-server-im-dialog.md` aus README „Festgelegte Entscheidungen“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen; Messungen als Kontext).
- [x] `docs/knowledge/claude-stream-json.md`: Abschnitt „MCP-Server steuern“ mit den Messungen aus der README (Anfragen, Antwortformen, `pending` ohne Ereignis, Ausschalten pro Arbeitsordner gespeichert), Datum 2026-10-01.
- [x] `docs/conventions/commits.md`: Scope `mcp` hinter `usage`.
- [x] `docs/code-map.md`: `mcp` in die Feature-Liste; neue Tabellenzeile „MCP-Server (Liste, Neu verbinden, Ausschalten je Session)“, Spalte Oberfläche „folgt in Phase 2/3“ (Phase 3 füllt sie), Spalte Core: `src-tauri/src/mcp/` (`model.rs` Typen), `src-tauri/src/agents/claude/mcp.rs` (Antwort auf `mcp_status` lesen), `src-tauri/src/commands/mcp.rs`, Zustand, Zuordnung der Antworten und Ereignis `mcp://changed` in `src-tauri/src/sessions/registry/mcp.rs` ([ADR 013](decisions/013-mcp-server-im-dialog.md)).

## Report-Back

Umgesetzt wie geplant, `pnpm check` und `pnpm bindings` grün (2026-10-02). Abweichung: die im Untermodul `registry/mcp.rs` definierten Methoden, die `registry.rs` aufruft (`apply_mcp_servers`, `mcp_answered`, `forget_mcp`, `mcp_problem_count`), sind `pub(super)` statt privat — ein privates Element eines Untermoduls ist für das übergeordnete Modul nicht sichtbar. Nicht am laufenden Agenten geprüft (AK 1–5 setzen die App voraus; die Smoke-Checkliste der README deckt sie in Phase 3 ab).
