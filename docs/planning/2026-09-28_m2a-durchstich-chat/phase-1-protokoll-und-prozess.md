# Phase 1 — Claude-Prozess & Protokoll im Core

**Status:** pending · **Rating:** heikel (Prozess-Threads, Protokoll-Übersetzung; legt die Typen fest, die alle weiteren Phasen benutzen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Abschnitte „Festgelegte Entscheidungen“ und „Kontrakt“
- [ADR 003](../../decisions/003-claude-anbindung.md) — Anbindungsweg, Programmsuche
- [knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md) — Aufruf, Zeilenformate, Antworten auf Rückfragen (die Quelle für jedes Feld unten)
- [docs/conventions/rust.md](../../conventions/rust.md) — Fehlerbehandlung, kein `unwrap()`, Prozesse, Typen für die UI
- Bestand: `src-tauri/src/lib.rs`, `src-tauri/src/error.rs`, `src-tauri/src/bin/gen-bindings.rs`, `src-tauri/Cargo.toml`
- Vault-Fehlerklasse `werkzeuge/claude-code.md` → „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“: ein unterbrochener Werkzeug-Aufruf kann trotzdem ausgeführt worden sein. Deshalb gibt es `ToolState::Interrupted` („unterbrochen“) und **kein** „nicht ausgeführt“.
- Umgebung: Frisch installiertes Rust ist im PATH des PowerShell-Werkzeugs evtl. unsichtbar — `$env:Path += ";$env:USERPROFILE\.cargo\bin"` voranstellen (Findings Meilenstein 1).

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt die Typen `ModelId`, `Effort`, `Mode`, `ToolState`, `TodoState`, `TodoItem`, `QuestionOption`, `Question`, `QuestionKind`, `ChatEntry`, `QuestionAnswer` unter `src/lib/bindings/`, sie stehen im Commit.
2. Die erzeugten TS-Typen haben camelCase-Felder und -Varianten: `src/lib/bindings/ChatEntry.ts` enthält `"kind": "tool"`, `toolUseId`, `requestId`, `questionKind`, `sentAt`; `Question.ts` enthält `multiSelect`; `QuestionKind.ts` enthält `"askUser"`. Übernimmt `ts-rs` `rename_all_fields` nicht → an den betroffenen Feldern `#[serde(rename = "…")]` setzen und in FINDINGS vermerken.
3. Kein `unwrap()`/`expect()` in den neuen Modulen; Clippy ohne Ausnahmen.
4. Die Übersetzungsregeln unten sind vollständig umgesetzt (Gegenlesen Regel für Regel, Häkchen im Report-Back).
5. Der Prozessstart setzt unter Windows `CREATE_NO_WINDOW`, startet ohne Shell und übergibt jedes Argument einzeln.

## Checkliste

### Abhängigkeiten

- [ ] `src-tauri/Cargo.toml`: `uuid = { version = "1", features = ["v4"] }` (wird in Phase 2 benutzt, hier schon eintragen, damit die Phase-2-Umsetzung nichts an `Cargo.toml` ändern muss).

### `src-tauri/src/agents/event.rs` — anbieterneutrale Typen

- [ ] Alle Typen aus README → „Kontrakt → Typen“, Abschnitt `agents/event.rs`, exakt mit den dortigen Namen, Feldern und Serde-Attributen; jeder mit `#[derive(Debug, Clone, Serialize, Deserialize, TS)]`, die einfachen Enums zusätzlich `Copy, PartialEq, Eq`.
- [ ] Methoden:
  - `ModelId::cli_id(self) -> &'static str`: Fable → `claude-fable-5-1`, Opus → `claude-opus-5-5`, Sonnet → `claude-sonnet-5`, Haiku → `claude-haiku-4-5-20251001`.
  - `Effort::cli_value(self) -> &'static str`: `low`, `medium`, `high`, `xhigh`, `max`.
  - `Mode::cli_value(self) -> &'static str`: Manual → `default`, Edit → `acceptEdits`, Plan → `plan`, Auto → `auto`.
  - `ChatEntry::seq(&self) -> u32`.
- [ ] Internes (nicht exportiertes) Enum für die Übersetzung, ohne `TS`:

  ```rust
  pub enum TurnEnd { Completed, Aborted, Failed(String) }

  /// Was aus einer Zeile des Agenten folgt — anbieterneutral, ohne Session-Zustand.
  pub enum AgentEvent {
      Ready { model: String },
      Text(String),
      Thinking { text: String, seconds: u32 },
      ToolStarted { tool_use_id: String, tool: String, target: String },
      ToolFinished { tool_use_id: String, failed: bool },
      Todos(Vec<TodoItem>),
      QuestionAsked { request_id: String, question_kind: QuestionKind, questions: Vec<Question>, input: serde_json::Value },
      ContextUsed(u32),
      TurnEnded { end: TurnEnd, context_window: Option<u32> },
      Unknown(String),
  }
  ```

### `src-tauri/src/agents/claude/protocol.rs` — Zeilenformate

- [ ] Eingehende Zeilen als Serde-Typen, nur die Felder, die die Übersetzung braucht; unbekannte Felder werden ignoriert (Serde-Standard), unbekannte `type`-Werte landen in einer Einheitsvariante:

  ```rust
  #[derive(Deserialize)]
  #[serde(tag = "type")]
  pub enum Incoming {
      #[serde(rename = "system")] System(SystemLine),
      #[serde(rename = "assistant")] Assistant(MessageLine<AssistantMessage>),
      #[serde(rename = "user")] User(MessageLine<UserMessage>),
      #[serde(rename = "control_request")] ControlRequest(ControlRequestLine),
      #[serde(rename = "result")] Result(ResultLine),
      #[serde(other)] Other,
  }
  ```

  - `SystemLine { subtype: String, model: Option<String> }`
  - `MessageLine<M> { message: M, parent_tool_use_id: Option<String> }`
  - `AssistantMessage { content: Vec<ContentBlock>, usage: Option<Usage> }`
  - `UserMessage { content: UserContent }` mit `#[serde(untagged)] enum UserContent { Text(String), Blocks(Vec<ContentBlock>) }`
  - `ContentBlock` mit `#[serde(tag = "type")]`: `text { text: String }`, `thinking { thinking: String }`, `tool_use { id: String, name: String, input: serde_json::Value }`, `tool_result { tool_use_id: String, is_error: Option<bool> }`, `#[serde(other)] Other`
  - `Usage { input_tokens: Option<u64>, cache_creation_input_tokens: Option<u64>, cache_read_input_tokens: Option<u64> }`
  - `ControlRequestLine { request_id: String, request: ControlRequestBody }`, `ControlRequestBody { subtype: String, tool_name: Option<String>, input: Option<serde_json::Value> }`
  - `ResultLine { subtype: String, is_error: bool, terminal_reason: Option<String>, result: Option<String>, #[serde(rename = "modelUsage")] model_usage: Option<HashMap<String, ModelUsage>> }`, `ModelUsage { #[serde(rename = "contextWindow")] context_window: Option<u32> }`
- [ ] Ausgehende Zeilen als Funktionen, die je einen String **ohne** Zeilenumbruch liefern (gebaut mit `serde_json::json!`, Formate aus der Wissensdatei):
  - `user_message(text: &str) -> String`
  - `control_request(request_id: &str, request: serde_json::Value) -> String`
  - `allow(request_id: &str, updated_input: serde_json::Value) -> String`
  - `deny(request_id: &str, message: &str) -> String`

### `src-tauri/src/agents/claude/translate.rs` — Übersetzung

- [ ] `pub struct Translator { thinking_started: Option<std::time::Instant> }` mit `Default` und `pub fn handle_line(&mut self, line: &str) -> Vec<AgentEvent>`.
- [ ] Regeln (in dieser Reihenfolge prüfen):
  1. Zeile lässt sich nicht als `Incoming` lesen → `Unknown(line)`.
  2. `System`: `subtype == "init"` → `Ready { model }` (leerer String, wenn `model` fehlt). `subtype == "thinking_tokens"` → `thinking_started` setzen, falls `None`; kein Ereignis. Alles andere → kein Ereignis.
  3. `Assistant` mit `parent_tool_use_id: Some(_)` → kein Ereignis (Subagent, kommt mit M2b).
  4. `Assistant`: hat `usage` → zuerst `ContextUsed(input + cache_creation + cache_read)`, fehlende Werte als 0, per `u32::try_from(...).unwrap_or(u32::MAX)`. Dann pro Block:
     - `text` mit nicht nur Leerraum → `Text(text)`.
     - `thinking` → `Thinking { text, seconds }`, `seconds` = vergangene Sekunden seit `thinking_started` (gerundet, mindestens 1; ohne Startzeit 1); danach `thinking_started = None`.
     - `tool_use` mit `name == "TodoWrite"` → `Todos(items)` aus `input.todos[]`: `label` = Feld `content`, `state` = `completed` → `Done`, `in_progress` → `Active`, sonst `Todo`. Einträge ohne `content` überspringen.
     - `tool_use` mit `name == "AskUserQuestion"` → kein Ereignis (die Frage kommt als `can_use_tool`).
     - sonstiges `tool_use` → `ToolStarted { tool_use_id: id, tool: name, target: target_of(&name, &input) }`.
  5. `User` mit `parent_tool_use_id: Some(_)` → kein Ereignis. `UserContent::Blocks`: jedes `tool_result` → `ToolFinished { tool_use_id, failed: is_error == Some(true) }`. `UserContent::Text` und `text`-Blöcke → kein Ereignis.
  6. `ControlRequest` mit `request.subtype == "can_use_tool"`:
     - `tool_name == "AskUserQuestion"` → `QuestionAsked { question_kind: AskUser, questions, input }`; `questions` aus `input.questions[]`: `question`, `options[]` (`label`, `hint` = `description` oder leer), `multi_select` = `multiSelect` oder `false`.
     - jedes andere Werkzeug → `QuestionAsked { question_kind: Permission, input, questions: [Question { question, options, multi_select: false }] }` mit `question` = `Claude möchte <tool> ausführen: <target>` (ohne `: <target>`, wenn `target` leer) und `options` = `Erlauben` / Hinweis `Nur diesen Aufruf`, `Ablehnen` / Hinweis `Claude bekommt eine Absage und sucht einen anderen Weg`.
     - `input` fehlt → `serde_json::Value::Object` leer.
     - andere `subtype` → `Unknown(line)`.
  7. `Result` → `TurnEnded { end, context_window }`: `terminal_reason == Some("aborted_streaming")` → `Aborted`; sonst `is_error` → `Failed(result oder subtype)`; sonst `Completed`. `context_window` = erster `context_window` in `model_usage`.
  8. `Other` → kein Ereignis.
- [ ] `fn target_of(tool: &str, input: &Value) -> String`: bei `Grep` → `"<pattern>" in <path>` bzw. `"<pattern>"` ohne `path`; sonst der erste vorhandene String aus den Feldern `file_path`, `notebook_path`, `path`, `command`, `pattern`, `url`, `query`, `description`, `skill`; nichts davon → leer. Ergebnis: nur die erste Zeile, höchstens 120 Zeichen (Zeichen, nicht Bytes), bei Kürzung mit `…` am Ende.

### `src-tauri/src/agents/claude/locate.rs` — Programm finden

- [ ] `pub fn find_claude() -> Option<PathBuf>` in der Reihenfolge aus ADR 003: `VERWALTER_CLAUDE_PATH` (nur wenn die Datei existiert) → `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` → `%USERPROFILE%\.local\bin\claude.exe` → jedes Verzeichnis aus `PATH` + `claude.exe`. Erste existierende Datei gewinnt. Umgebungsvariablen über `std::env::var_os`, Pfade über `PathBuf::join`.

### `src-tauri/src/agents/claude/process.rs` — Prozess

- [ ] Typen:

  ```rust
  pub struct SpawnOptions { pub exe: PathBuf, pub cwd: PathBuf, pub session_id: String, pub resume: bool, pub model: ModelId, pub effort: Effort, pub mode: Mode }
  pub enum ProcessOutput { Line(String), Stderr(String), Exited(Option<i32>) }
  pub struct ClaudeProcess { child: Arc<Mutex<Child>>, stdin: Mutex<Option<ChildStdin>> }
  ```

- [ ] `pub fn spawn(opts: SpawnOptions, on_output: impl Fn(ProcessOutput) + Send + Sync + 'static) -> std::io::Result<ClaudeProcess>`:
  - `Command::new(&opts.exe)`, `current_dir(&opts.cwd)`, stdin/stdout/stderr `Stdio::piped()`, unter `#[cfg(windows)]` `std::os::windows::process::CommandExt::creation_flags(0x0800_0000)` (`CREATE_NO_WINDOW`).
  - Argumente einzeln per `.arg(...)`: `-p`, `--input-format`, `stream-json`, `--output-format`, `stream-json`, `--verbose`, `--permission-prompt-tool`, `stdio`, `--model`, `<cli_id>`, `--effort`, `<cli_value>`, `--permission-mode`, `<cli_value>`, dann `--session-id <id>` (bei `resume == false`) bzw. `--resume <id>`.
  - `on_output` in ein `Arc` legen. Thread „stdout“: `BufReader::lines()`, jede nicht leere Zeile → `Line`; nach Dateiende `child.lock()` + `wait()` → `Exited(status.code())` (bei Fehler `Exited(None)`). Thread „stderr“: jede Zeile → `Stderr`.
  - Gesperrte Mutexe nie mit `unwrap()`: `lock().unwrap_or_else(std::sync::PoisonError::into_inner)`.
- [ ] Methoden: `write_line(&self, line: &str) -> std::io::Result<()>` (Zeile + `\n`, danach `flush`; stdin schon geschlossen → `io::ErrorKind::BrokenPipe`), `close_stdin(&self)` (nimmt stdin heraus und lässt es fallen), `kill(&self)` (Fehler ignorieren), `pid(&self) -> u32`.

### Verdrahtung und Doku

- [ ] `src-tauri/src/agents/mod.rs` (`pub mod claude; pub mod event;`), `src-tauri/src/agents/claude/mod.rs` (`pub mod locate; pub mod process; pub mod protocol; pub mod translate;`), in `lib.rs` `pub mod agents;`.
- [ ] Code, der erst in Phase 2 benutzt wird, erzeugt `dead_code`-Warnungen: **nicht** mit `#[allow]` unterdrücken, sondern die Module `pub` halten (öffentliche Elemente einer Bibliothek warnen nicht). Bleibt trotzdem eine Warnung → Findings, nicht wegdrücken.
- [ ] `gen-bindings.rs`: die elf TS-Typen aus AK 1 eintragen; `pnpm bindings`.
- [ ] `docs/code-map.md`: Zeile „Agent-Provider“ um `agents/event.rs` (anbieterneutrale Typen) und `agents/claude/` (Protokoll, Prozess, Übersetzung) konkretisieren; Stand-Satz oben anpassen.

## Report-Back
