# Phase 2 — Sessions, Commands & Events

**Status:** pending · **Rating:** standard (Kontrakt und Status-Maschine stehen im README; hier wird verdrahtet)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (Status-Maschine, Pause, Abbrechen, Denkaufwand) und „Kontrakt“ (Typen, Commands, Events, Fehler)
- [phase-1-protokoll-und-prozess.md](phase-1-protokoll-und-prozess.md) → Report-Back; die Module `agents/event.rs`, `agents/claude/*`
- [knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md) — Antwortformate auf Rückfragen
- [docs/conventions/rust.md](../../conventions/rust.md), [typescript.md](../../conventions/typescript.md) → „Tauri-Grenze“, [ADR 002](../../decisions/002-typgenerierung-und-listen.md) (Wrapper von Hand, Command-Name im Wrapper und in `generate_handler!` im selben Commit)
- Bestand: `src-tauri/src/lib.rs`, `src-tauri/src/error.rs`, `src-tauri/src/commands/app.rs`, `src/lib/app.ts` (Muster für Wrapper)
- Vault-Fehlerklasse `werkzeuge/claude-code.md` → „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“: Werkzeug-Einträge, die bei Pause, Abbruch oder Absturz noch laufen, werden `Interrupted`, nie „nicht ausgeführt“.

## Abnahmekriterien der Phase

1. `pnpm check` grün, Bindings für `SessionStatus`, `SessionSummary`, `ChatPage`, `ChatEntryEvent`, `CommandError` aktuell und committet.
2. Prüfung über die Entwicklerwerkzeuge (in `pnpm tauri dev` Rechtsklick → „Untersuchen“ → Konsole), Ergebnisse im Report-Back:
   ```js
   const { invoke } = window.__TAURI_INTERNALS__;
   const s = await invoke('session_create', { task: 'Antworte nur mit OK.', model: 'haiku', effort: 'low', mode: 'auto' });
   // nach ~10 s:
   await invoke('session_list');                                            // status 'completed', contextUsed > 0
   await invoke('chat_history', { sessionId: s.id, before: null, limit: 50 }); // user + text "OK"
   ```
   Danach `AskUserQuestion`-Rückfrage auslösen (`chat_send` mit „Frag mich mit dem AskUserQuestion-Tool: Rot oder Blau?“), `chat_history` zeigt einen `question`-Eintrag, `session_list` Status `waiting`; `chat_answer` mit `{ kind: 'options', answers: ['Blau'] }` → Status `running`, dann `completed`, Antwort nennt Blau.
3. Im Arbeitsordner `<Benutzerordner>\.verwalter\workspaces\<id>\` liegt nach einer Schreib-Aufgabe die erzeugte Datei; außerhalb nichts.
4. Kein Konsolenfenster beim Start einer Session.
5. Fortsetzen über die Session-ID: `claude.exe` der Session im Task-Manager beenden → `session_list` zeigt `error`; `invoke('session_restart', { sessionId: s.id })` → `paused`; `chat_send` mit „Was war meine erste Nachricht?“ → die Antwort zitiert sie. Das belegt, dass `--session-id` beim Start und `--resume` beim Neustart dieselbe Claude-Session treffen.

## Checkliste

### Typen und Fehler

- [ ] `src-tauri/src/sessions/model.rs`: `SessionStatus`, `SessionSummary`, `ChatPage`, `ChatEntryEvent` exakt nach README → „Kontrakt“, mit `derive(Debug, Clone, Serialize, Deserialize, TS)`.
- [ ] `src-tauri/src/error.rs`: Varianten `SessionNotFound(String)` („Session nicht gefunden: {0}“), `ClaudeNotFound` („Claude-Kommandozeile nicht gefunden“), `SessionClosed` („Session ist abgebrochen“), `AgentStopped` („Agent läuft nicht“), `Io(String)` („Dateisystem: {0}“). `impl From<std::io::Error> for CommandError` → `Io(e.to_string())`. Unit-Varianten serialisieren ohne `message` — das ist bei `tag`/`content` so gewollt.

### Arbeitsordner

- [ ] `src-tauri/src/filesystem/mod.rs` (`pub mod workspace;`) und `filesystem/workspace.rs`: `pub fn session_workspace(app: &tauri::AppHandle, session_id: &str) -> Result<PathBuf, CommandError>` — `app.path().home_dir()` (Trait `tauri::Manager`), `.join(".verwalter").join("workspaces").join(session_id)`, `std::fs::create_dir_all`.

### Registry — `src-tauri/src/sessions/registry.rs`

- [ ] Aufbau:

  ```rust
  #[derive(Default)]
  pub struct SessionRegistry { sessions: Mutex<HashMap<String, Arc<Session>>> }
  pub struct Session { pub id: String, workspace: PathBuf, state: Mutex<SessionState> }
  struct PendingRequest { question_kind: QuestionKind, questions: Vec<Question>, input: serde_json::Value, seq: u32 }
  struct SessionState {
      name: String, status: SessionStatus, model: ModelId, effort: Effort, process_effort: Effort, mode: Mode,
      created_at: f64, running_ms: f64, running_since: Option<f64>, context_used: u32, context_window: u32,
      entries: Vec<ChatEntry>, tool_seqs: HashMap<String, u32>, todos_seq: Option<u32>,
      pending: Vec<(String, PendingRequest)>,          // (request_id, Rückfrage), älteste zuerst
      process: Option<Arc<ClaudeProcess>>, generation: u32, translator: Translator,
      log: VecDeque<String>, pause_requested: bool, cancel_requested: bool, next_request: u32,
  }
  ```

  `context_window` startet mit 200000. Steueranfragen der App bekommen die IDs `app-1`, `app-2` … aus `next_request`.
- [ ] Hilfsfunktionen im Modul:
  - `now_ms() -> f64` aus `SystemTime::now().duration_since(UNIX_EPOCH)`.
  - `set_status(state, new)`: war `Running` und wird nicht `Running` → `running_ms += now - running_since`, `running_since = None`; wird `Running` und war es nicht → `running_since = Some(now)`.
  - `push_entry(state, build: impl FnOnce(u32) -> ChatEntry) -> ChatEntry` (seq = `entries.len()`), `replace_entry(state, entry)`.
  - `summary(session, state) -> SessionSummary`.
  - `interrupt_running_tools(state) -> Vec<ChatEntry>`: alle `Tool`-Einträge mit `Running` → `Interrupted`, geänderte zurückgeben.
  - `name_from_task(task) -> String` in `sessions/mod.rs`: Text bis zum ersten `.`, `!`, `?` oder Zeilenumbruch, getrimmt; leer → `Neue Session`; über 60 Zeichen → erste 57 Zeichen + `…`.
- [ ] Ereignisse an die Oberfläche: Änderungen unter gesperrtem Zustand sammeln (`Vec<ChatEntry>` + „Summary geändert“), **nach** dem Freigeben des Locks senden: `app.emit("chat://entry", ChatEntryEvent { … })` bzw. `app.emit("session://changed", summary)` (Trait `tauri::Emitter`). Emit-Fehler ins `log` schreiben, nicht zurückgeben.
- [ ] `start_process(app, session, resume) -> Result<(), CommandError>`: `find_claude()` → sonst `ClaudeNotFound`; `generation += 1`; `spawn` mit einem Callback, der `app`, `Arc<Session>` und die aktuelle `generation` festhält und `handle_output` ruft; `process_effort = effort`.
- [ ] `handle_output(app, session, generation, output)`:
  - `Stderr(line)` → ins `log` (immer, auch bei veralteter Generation).
  - Generation ≠ aktuelle → nur `log`, sonst nichts.
  - `Line(line)` → `translator.handle_line`, jedes Ereignis nach der Tabelle unten anwenden.
  - `Exited(code)` → `process = None`; `cancel_requested` → nichts weiter; sonst `interrupt_running_tools`, alle `pending` entfernen, Fehler-Eintrag `Error { title: "Agent beendet", text: "Claude wurde unerwartet beendet (Exit-Code <code bzw. unbekannt>)." }`, Status `Error`.
- [ ] Ereignis → Zustand:

  | Ereignis | Wirkung |
  |---|---|
  | `Ready` | Status `Starting` → `Running`; sonst nichts |
  | `Text(t)` | Eintrag `Text` |
  | `Thinking` | Eintrag `Thinking` |
  | `ToolStarted` | Eintrag `Tool { state: Running }`, `tool_seqs[tool_use_id] = seq` |
  | `ToolFinished` | Eintrag aus `tool_seqs` suchen; ist er `Running` → `Done` bzw. `Failed`; unbekannte ID → nichts |
  | `Todos(items)` | `todos_seq` gesetzt → diesen Eintrag ersetzen; sonst neuer Eintrag, `todos_seq = Some(seq)` |
  | `QuestionAsked` | Eintrag `Question { answer: None }`, `pending.push`, Status `Waiting` |
  | `ContextUsed(n)` | `context_used = n` |
  | `TurnEnded { end, context_window }` | `context_window` übernehmen, falls `Some`; `todos_seq = None`; dann: `cancel_requested` → nichts weiter · `Aborted` oder `pause_requested` → `interrupt_running_tools`, Status `Paused`, `pause_requested = false` · `Failed(text)` → Eintrag `Error { title: "Fehler vom Agenten", text }`, Status `Error` · `Completed` → Status `Completed` |
  | `Unknown(line)` | ins `log` |

  `log` hält höchstens 300 Zeilen (älteste fliegen raus), jede Zeile höchstens 500 Zeichen.
- [ ] Öffentliche Methoden von `SessionRegistry` (jede nimmt `&tauri::AppHandle`, holt die Session per ID → sonst `SessionNotFound`):
  - `create(task, model, effort, mode) -> SessionSummary`: ID `uuid::Uuid::new_v4().to_string()`, Arbeitsordner anlegen, Zustand mit Status `Starting`, in die Map, `start_process(resume = false)`, dann wie `send` die Aufgabe als erste Nachricht (Eintrag `User`, `write_line(user_message)`), Status bleibt `Starting` bis `Ready`.
  - `list() -> Vec<SessionSummary>` nach `created_at` absteigend.
  - `send(text)`: `Cancelled` → `SessionClosed`; `Error` → `AgentStopped`. Gibt es `pending` → wie `answer` für den ältesten Eintrag mit freiem Text: `AskUser` → `Options` mit `text` für jede Frage; `Permission` → `Deny { message: text }`; zusätzlich Eintrag `User`. Sonst: `effort != process_effort` → laufenden Prozess ersetzen (stdin schließen, alte Generation ist ab `generation += 1` in `start_process` stumm) und `start_process(resume = true)`; Eintrag `User`, Status `Running`, `write_line(user_message(text))`; Schreibfehler → `AgentStopped`.
  - `answer(request_id, answer)`: `pending` ohne diese ID → `Internal("Rückfrage nicht offen")`. Antwortzeile: `AskUser` + `Options { answers }` → `allow` mit `updatedInput` = `input` plus Objekt `answers: { <questions[i].question>: <answers[i]> }`; `Allow` → `allow` mit `updatedInput = input`; `Deny { message }` → `deny`. Question-Eintrag: `answer` = Antworten mit ` · ` verbunden bzw. `Erlaubt` bzw. `Abgelehnt: <message>`. Keine weiteren `pending` → Status `Running`.
  - `pause()`: nur bei `Starting`/`Running`/`Waiting`: `pause_requested = true`; jede offene Rückfrage mit `deny("Vom Benutzer pausiert.")` beantworten, ihr Eintrag `answer = "Pausiert"`; `control_request("app-<n>", {"subtype":"interrupt"})`. Sonst nichts.
  - `resume()`: nur bei `Paused` → `send("Mach weiter.")`.
  - `cancel()`: `cancel_requested = true`; bei `Running`/`Waiting` offene Rückfragen ablehnen und `interrupt` senden; `close_stdin()`; Status `Cancelled`; `interrupt_running_tools`; Thread: 5 s schlafen, dann ist die Generation unverändert und `process` noch `Some` → `kill()`.
  - `restart()`: nur bei `Error` → `start_process(resume = true)`, Status `Paused`.
  - `set_model(model)`, `set_mode(mode)`: Wert speichern; läuft ein Prozess → `control_request` mit `{"subtype":"set_model","model":<cli_id>}` bzw. `{"subtype":"set_permission_mode","mode":<cli_value>}`. `set_effort(effort)`: nur speichern. Alle drei senden `session://changed`.
  - `history(before, limit) -> ChatPage`: `limit` auf 1…500 begrenzen; `end = before.unwrap_or(len).min(len)`, `start = end.saturating_sub(limit)`; `has_more = start > 0`.
  - `log() -> Vec<String>`.

### Commands, Registrierung, Wrapper

- [ ] `src-tauri/src/commands/sessions.rs` und `commands/chat.rs`: je ein `#[tauri::command] pub async fn` pro Zeile der Command-Tabelle im README, Parameter wie dort, dazu `app: tauri::AppHandle` und `registry: tauri::State<'_, SessionRegistry>`; Rumpf ruft nur die Registry-Methode. `async`, damit der Prozessstart nicht auf dem Haupt-Thread läuft.
- [ ] `lib.rs`: `pub mod sessions; pub mod filesystem;`, `.manage(SessionRegistry::default())`, alle Commands in `generate_handler!`.
- [ ] `gen-bindings.rs`: `SessionStatus`, `SessionSummary`, `ChatPage`, `ChatEntryEvent` ergänzen; `pnpm bindings`.
- [ ] `src/lib/sessions.ts`: Wrapper nach README-Tabelle (Muster `src/lib/app.ts`, JSDoc mit `@throws`), dazu `onSessionChanged(cb: (s: SessionSummary) => void): Promise<UnlistenFn>` über `listen` aus `@tauri-apps/api/event`.
- [ ] `src/lib/chat.ts`: `getChatHistory`, `sendMessage`, `answerQuestion`, `onChatEntry(cb: (e: ChatEntryEvent) => void): Promise<UnlistenFn>`.

### Doku

- [ ] `docs/glossary.md`: Zeile **Session-Status** durch die Status-Maschine aus dem README ersetzen (sieben Werte, je ein Halbsatz); neue Zeile **Rechte-Abfrage** („Der Agent fragt vor einem Werkzeug-Aufruf um Erlaubnis; erscheint im Chat wie eine Rückfrage mit Erlauben/Ablehnen“); Zeile **Waiting** auf „Rückfrage oder Rechte-Abfrage“ erweitern.
- [ ] `docs/code-map.md`: Zeilen Sessions, Chat und Workspace nachziehen (`sessions/registry.rs`, `sessions/model.rs`, `filesystem/workspace.rs`, `commands/sessions.rs`, `commands/chat.rs`, `src/lib/sessions.ts`, `src/lib/chat.ts`); vermerken, dass `db/messages.rs`/`db/events.rs` mit M4 kommen und bis dahin die Registry im Speicher hält.

## Report-Back
