# Phase 1 — Gerüst: Einstieg `agent`, Zeilenprotokoll, LM-Studio-Client, Transkript, Unterbrechen, Betriebsart „Autark“

Ziel: `verwalter.exe agent …` ist ein lauffähiger Agent **ohne Werkzeuge**: er nimmt Nachrichten über das Zeilenprotokoll an, fragt das Modell in LM Studio, gibt die Antwort als Protokollzeilen aus, speichert das Transkript, setzt es fort und lässt sich unterbrechen. Im Verwalter ist die Betriebsart „Autark“ wählbar und startet diesen Agenten.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ und „Kontrakt“ (verbindlich).
- Wie der Verwalter den Agenten heute startet und liest: `src-tauri/src/agents/claude/process.rs`, `print.rs`, `protocol.rs`, `translate.rs`; `src-tauri/src/sessions/registry.rs` (`start_process`, `create_project`, `send`, `restart`, `has_agent_history`, `push_entry` mit `ChatEntry::Error`); `src-tauri/src/sessions/registry/tldr.rs` (`ask_haiku`).
- Aus dem Vorgängerplan: `src-tauri/src/agents/claude/local.rs` (`LocalBackend`, `resolve`, `apply`), `src-tauri/src/settings/model.rs` (`OperatingMode`), `src-tauri/src/lmstudio/`, `src/lib/labels.ts` (`OPERATING_MODE_OPTIONS`), `src/features/settings/SettingsView.tsx`.
- `src-tauri/src/attachments/` (`message_content`: Format der Bild- und Textblöcke einer Nachricht), `src-tauri/src/processes/` (`hide_console`), `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.
- `src-tauri/src/voice/model_file.rs` — Vorbild `ureq` mit `into_body().into_reader()` (ohne Größenlimit).
- [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md).
- Konventionen: [rust.md](../../conventions/rust.md), [linting.md](../../conventions/linting.md).
- Fehlerklassen: `ureq` liefert bei HTTP-Status ab 400 `Err` (Kommentar in `model_file.rs`) — den Fehlertext von LM Studio (z. B. „model not loaded“) bekommt man so nicht aus dem Körper; der Satz im `result` nennt deshalb Status und Adresse. Vault `werkzeuge/claude-code.md`, „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“: nach einem Abbruch steht im Transkript, was wirklich passiert ist, nicht was geplant war (siehe Abbruch unten).

## AK der Phase

- Mit gesetzter Umgebung (`VERWALTER_AGENT_BASE_URL=http://localhost:1234`, `VERWALTER_AGENT_CONTEXT_WINDOW=64000`) und den Zeilen aus `artifacts/beispielzeilen.jsonl` liefert `src-tauri\target\debug\verwalter.exe agent -p --input-format stream-json --output-format stream-json --verbose --model google/gemma-4-12b-qat --permission-mode default --session-id <neue-uuid>` nacheinander `system/init`, eine `assistant`-Zeile mit Text und eine `result`-Zeile mit `modelUsage.<modell>.contextWindow = 64000`.
- Derselbe Aufruf mit `--resume <uuid>` und der Frage nach dem vorher Gesagten antwortet mit Bezug darauf.
- Ein `interrupt` während der Antwort führt binnen 2 s zu `result` mit `terminal_reason: "aborted_streaming"`; der Prozess nimmt danach die nächste Nachricht an.
- Im Verwalter: Betriebsart „Autark“, ruhende Session, Nachricht → Antwort im Chat, Status „Läuft“ → „Wartet auf dich“ wie bei Claude; Task-Manager zeigt `verwalter.exe` als Kindprozess, keine `claude.exe`. Das gilt auch im Release-Build (`pnpm tauri build --no-bundle`, dann die lose exe starten) — damit ist belegt, dass Standardein- und -ausgabe trotz `windows_subsystem = "windows"` funktionieren.
- Wechsel einer Session von „Claude“ zu „Autark“: Chat zeigt den Eintrag „Verlauf nicht übernommen“, der Agent antwortet trotzdem. Zurück zu „Claude“: `--resume` wie vorher (Claude-Transkript vorhanden), kein solcher Eintrag.
- `pnpm check` grün.

## Checkliste

### Einstieg

- [x] `src-tauri/src/main.rs`: vor `verwalter_lib::run()`: `let args: Vec<String> = std::env::args().collect(); if args.get(1).map(String::as_str) == Some(verwalter_lib::standalone::SUBCOMMAND) { std::process::exit(verwalter_lib::standalone::run(args[2..].to_vec())); }`. Die Zeile mit `windows_subsystem` bleibt unverändert.
- [x] `src-tauri/src/lib.rs`: `pub mod standalone;`.

### Laufzeit `src-tauri/src/standalone/`

- [x] `mod.rs` — Kopfkommentar: „Der eigene Agent der Betriebsart Autark (ADR 017): spricht den Ausschnitt des Zeilenprotokolls der Claude-Kommandozeile, den der Verwalter liest, und fragt ein OpenAI-kompatibles Modell (LM Studio).“ Inhalt: `pub const SUBCOMMAND: &str = "agent";`, `pub fn transcript_path(session_id: &str) -> Option<PathBuf>` (`%USERPROFILE%\.verwalter\agent\<id>.jsonl`; `USERPROFILE` fehlt → `None`), `pub fn run(args: Vec<String>) -> i32`: `args::parse` → bei `print` `print::run` (Phase 5; bis dahin Zeile auf stderr „Druckmodus folgt“ und Exit 2), sonst `session::run`. Rückgabe = Exit-Code (0 bei Dateiende von stdin, 2 bei Startfehler).
- [x] `args.rs` — `pub struct AgentArgs { pub print: bool, pub model: String, pub mode: Mode, pub start: Start, pub add_dirs: Vec<PathBuf>, pub allowed_rules: Vec<String>, pub system_prompt: Option<String>, pub json_schema: Option<String>, pub tools_disabled: bool }`, `pub enum Start { New(String), Resume(String), None }` (`None` nur im Druckmodus). `pub fn parse(args: &[String]) -> Result<AgentArgs, String>` nach der Tabelle „Start“ im Kontrakt; `--permission-mode` über eine Zuordnung `default→Manual`, `acceptEdits→Edit`, `plan→Plan`, `auto→Auto` (Typ `crate::agents::event::Mode`); `--allowedTools` nimmt alle Werte bis zum nächsten Argument, das mit `--` beginnt. Fehlt `--model` → `Err`.
- [x] `output.rs` — `pub struct Output` um ein `Mutex<std::io::Stdout>`; `pub fn line(&self, value: &serde_json::Value)` schreibt `value` + `\n` und `flush`; Schreibfehler → Prozess beendet sich mit Exit 0 (der Verwalter ist weg). Dazu Bau-Funktionen für jede ausgehende Zeile des Kontrakts: `init(session_id, model, cwd, tools)`, `assistant(session_id, blocks, input_tokens, output_tokens)`, `tool_results(session_id, results)`, `can_use_tool(request_id, tool_name, input)`, `control_success(request_id, response)`, `control_error(request_id, error)`, `result_success(session_id, text, model, context_window)`, `result_error(session_id, text, model, context_window)`, `result_aborted(session_id, model, context_window)` — Feldnamen und Werte exakt wie im Kontrakt.
- [x] `llm.rs` — OpenAI-kompatibler Client:
  - `pub struct ChatRequest<'a> { pub base_url: &'a str, pub model: &'a str, pub messages: &'a [Value], pub tools: &'a [Value], pub response_format: Option<&'a Value> }`.
  - `pub struct ToolCall { pub id: String, pub name: String, pub arguments: String }`, `pub struct Completion { pub text: String, pub reasoning: String, pub tool_calls: Vec<ToolCall>, pub prompt_tokens: Option<u32>, pub completion_tokens: Option<u32>, pub finish_reason: Option<String> }`, `pub enum LlmError { Cancelled, Failed(String) }`.
  - `pub fn complete(request: &ChatRequest, cancel: &AtomicBool) -> Result<Completion, LlmError>`: `POST {base_url}/v1/chat/completions`, Körper `{"model","messages","stream":true,"stream_options":{"include_usage":true}}`, `tools` nur wenn nicht leer (dann auch `"tool_choice":"auto"`), `response_format` wenn gesetzt. `ureq`-Agent nur mit Verbindungs-Zeitlimit 10 s (kein Gesamt-Zeitlimit, Antworten dauern Minuten). Antwort zeilenweise lesen (`BufReader` über `into_body().into_reader()`); vor jeder Zeile `cancel` prüfen → `Err(Cancelled)` (das Fallenlassen des Readers schließt die Verbindung, LM Studio bricht ab). Zeilen mit `data: ` auswerten, `data: [DONE]` beendet. Je Chunk `choices[0].delta`: `content` an `text`, `reasoning_content` an `reasoning` anhängen; `tool_calls[]` nach `index` sammeln (`id` und `function.name` beim ersten Auftreten, `function.arguments` anhängen); `choices[0].finish_reason` merken; `usage.prompt_tokens`/`completion_tokens` aus dem Chunk mit `usage`. Fehlende `id` → `call_<laufende Nummer>`. HTTP-Fehler → `Failed(format!("LM Studio unter {base_url} antwortet nicht: {fehler}"))`.
- [x] `transcript.rs` — `pub struct Transcript { path: PathBuf, pub messages: Vec<Value> }`; `create(session_id)` (Ordner anlegen; Datei existiert schon → `Err`), `resume(session_id)` (Datei fehlt → `Err`; jede Zeile ein JSON, unlesbare Zeile → `Err` mit Zeilennummer), `append(&mut self, message: Value)` (an `messages` und als Zeile an die Datei, `flush`), `rewrite(&mut self, messages: Vec<Value>)` (in `<id>.jsonl.tmp` schreiben, dann `fs::rename`). Gespeichert wird nur der Verlauf, nie der Systemprompt.
- [x] `content.rs` — `pub fn user_message(content: &Value) -> Value`: Text → `{"role":"user","content":<text>}`; Block-Array → `{"role":"user","content":[…]}` mit `text` → `{"type":"text","text":…}` und `image` (`source.type == "base64"`) → `{"type":"image_url","image_url":{"url":"data:<media_type>;base64,<data>"}}`; andere Blöcke weglassen.
- [x] `prompt.rs` — vorerst `pub fn system_prompt(cwd: &Path) -> String` mit einem Absatz (englisch): „You are a coding agent running inside Agenten Verwalter 2000 on Windows. Working directory: <cwd>. Today: <YYYY-MM-DD>.“ Phase 4 ersetzt das.
- [x] `session.rs` — Hauptschleife:
  - Start: `Start::New` → `Transcript::create`, `Start::Resume` → `Transcript::resume`; Fehler → stderr, Exit 2. Umgebung lesen (Kontrakt), fehlend → stderr, Exit 2. `init`-Zeile ausgeben (Werkzeugliste in Phase 1 leer).
  - Ein Thread liest stdin zeilenweise und schickt `Input::Line(String)` bzw. am Ende `Input::Closed` in einen `mpsc`-Kanal.
  - Zustand: `queue: VecDeque<Value>` (wartende Nachrichten), `mode`, `model`, `cancel: Arc<AtomicBool>`.
  - Die Modellanfrage läuft in einem Arbeits-Thread, der sein `Result` über einen zweiten Kanal zurückgibt; die Hauptschleife wartet mit `select`-Ersatz: abwechselnd `try_recv` auf beiden Kanälen mit 20 ms Pause, damit ein `interrupt` während der Anfrage ankommt.
  - `user`-Zeile: in die Schlange; ist kein Turn aktiv, Turn starten. Turn: Nachricht per `content::user_message` an das Transkript, Anfrage mit `[system_prompt] + transcript.messages`. Antwort → `assistant`-Zeile (Blöcke nach Kontrakt), Nachricht `{"role":"assistant","content":text}` ans Transkript, `result_success`. `Failed` → `result_error` mit dem Satz. Danach nächste Nachricht aus der Schlange.
  - `control_request`: `interrupt` → `cancel` setzen, `control_success`; der Arbeits-Thread liefert `Cancelled` → `result_aborted`, `cancel` zurücksetzen; kam schon Text, wird er **nicht** ans Transkript gehängt (das Modell hat ihn nie fertig gesagt). `set_permission_mode`, `set_model`, `stop_task` → Wert übernehmen bzw. nichts, `control_success`. Alles andere → `control_error`.
  - `Input::Closed` → laufende Anfrage abbrechen, Exit 0.

### Startseite im Core

- [x] `settings/model.rs`: `OperatingMode` um `Standalone` (TS `'standalone'`). `src/lib/labels.ts`: `OPERATING_MODE_OPTIONS` um `{ id: 'standalone', label: 'Autark' }`. `SettingsView.tsx`, Info der Zeile „Betriebsart“ um den Satz „Autark: ohne Claude-Kommandozeile und ohne Anthropic — ein eigener, kleinerer Agent des Verwalters mit dem lokalen Modell.“ ergänzen.
- [x] `agents/claude/local.rs`: `pub enum LocalProgram { ClaudeCode, Standalone }` und Feld `pub program: LocalProgram` in `LocalBackend`; `resolve` setzt es nach Betriebsart (`Standalone` braucht dieselben Prüfungen wie `ClaudeCodeLocal`). `apply` bei `Standalone`: nur `VERWALTER_AGENT_BASE_URL` und `VERWALTER_AGENT_CONTEXT_WINDOW` setzen.
- [x] `src-tauri/src/agents/standalone.rs` (in `agents/mod.rs` deklarieren): `pub fn program() -> Result<PathBuf, CommandError>` (`std::env::current_exe()`, Fehler → `CommandError::Io`) und `pub fn leading_args() -> Vec<String> { vec![crate::standalone::SUBCOMMAND.to_owned()] }`.
- [x] `agents/claude/locate.rs`: `pub fn has_transcript(session_id: &str) -> bool` — Basis `CLAUDE_CONFIG_DIR`, sonst `%USERPROFILE%\.claude`; `true`, wenn in einem Unterordner von `<Basis>\projects` die Datei `<session_id>.jsonl` liegt; ist `projects` nicht lesbar → `true` (bisheriges Verhalten: fortsetzen).
- [x] `process.rs`: `SpawnOptions` um `pub leading_args: Vec<String>`; `build_command` hängt sie direkt nach `Command::new` an, vor `-p`.
- [x] `registry.rs`, `start_process`: Programm wählen — `Standalone` → `standalone::program()?` mit `standalone::leading_args()`, sonst `find_claude()` wie bisher und leere `leading_args`. `resume` = `state.has_agent_history && <Transkript vorhanden>` (Standalone: `crate::standalone::transcript_path(&session.id).is_some_and(|p| p.exists())`; sonst `locate::has_transcript(&session.id)`). Ist `state.has_agent_history && !resume`: `state.push_entry` mit `ChatEntry::Error { title: "Verlauf nicht übernommen", text: "Diese Session lief bisher in einer anderen Betriebsart. Der Agent kennt den bisherigen Verlauf nicht — schreib ihm kurz, worum es geht." }`.
- [x] `registry.rs`, `create_project`: `self.agent_backend()?` **vor** die `find_claude()`-Prüfung ziehen; die Prüfung nur, wenn das Backend nicht `Standalone` ist.
- [x] `tldr.rs`, `ask_haiku`: bei `LocalProgram::Standalone` vorerst `Err("TL;DR folgt in der Betriebsart „Autark“ mit dem Druckmodus.".to_owned())` (Phase 5 ersetzt das).

### Hilfen, Doku

- [x] `artifacts/beispielzeilen.jsonl` (je Zeile ein JSON): eine `user`-Zeile „Sag Hallo in einem Satz.“, eine `user`-Zeile „Worum ging es gerade?“, eine `control_request` `interrupt`. `artifacts/README.md`: wie man den Agenten von Hand startet (Aufruf aus der README dieses Plans, Umgebung im PowerShell-Werkzeug per `$env:…`) und die Zeilen einspeist (`Get-Content artifacts\beispielzeilen.jsonl | …` bzw. Zeilen einzeln).
- [x] ADR 017 `docs/decisions/017-autarker-agent.md` aus „Festgelegte Entscheidungen“; Konsequenzen: Risiko Auto-Modus ohne Klassifizierer, kein Verlauf über den Wechsel der Betriebsart, Pflicht zum Mitziehen bei Änderungen an `translate.rs`, Liste der nicht enthaltenen Fähigkeiten. ADR 016, „Konsequenzen“: Verweis auf ADR 017 für die Betriebsart „Autark“.
- [x] `docs/conventions/commits.md`: Scope `standalone` ergänzen.
- [x] `docs/code-map.md`: neue Zeile „Autarker Agent (Betriebsart Autark)“ — Oberfläche: Knopf „Autark“ in `OperatingModeSegment`; Core: `src-tauri/src/standalone/` (`args`, `output`, `llm`, `transcript`, `content`, `prompt`, `session`), Start über `src-tauri/src/agents/standalone.rs` und `leading_args` in `process.rs`, Einstieg in `src-tauri/src/main.rs` ([ADR 017](decisions/017-autarker-agent.md)). `standalone` in die Querschnitts-Aufzählung.
- [x] `docs/glossary.md`, Eintrag **Betriebsart** um „Autark (eigener Agent des Verwalters, ohne Claude-Kommandozeile und ohne Anthropic)“ ergänzen.
- [x] Commit `feat(standalone): eigener Agent mit LM Studio, Chat ohne Werkzeuge`.

## Report-Back

**Status:** complete (2026-10-05). Kommandozeilen-AK geprüft mit `artifacts/treiber.ps1` gegen `google/gemma-4-12b-qat`: `init` → `assistant` → `result` mit `contextWindow` 64 000; `--resume` antwortete mit Bezug auf den vorigen Turn; `interrupt` → `result` mit `aborted_streaming` nach 5 bzw. 68 ms, danach wurde die nächste Nachricht im selben Prozess beantwortet; ohne `VERWALTER_AGENT_BASE_URL` Exit 2. `pnpm check` grün. **Nicht von mir geprüft** (Oberfläche, Smoke am Plan-Ende): Autark-Session im Verwalter, Task-Manager ohne `claude.exe`, Release-Build mit `windows_subsystem`, Wechsel Claude ↔ Autark mit „Verlauf nicht übernommen“.

**Abweichungen vom Plan:**

- Druckmodus wird an `--json-schema` erkannt, nicht an `-p` — der Verwalter startet auch Sessions mit `-p`.
- `interrupt` meldet den Abbruch sofort, statt auf `Cancelled` aus dem Arbeits-Thread zu warten (der liest erst beim nächsten Stück der Antwort wieder); ein `AtomicBool` je Turn statt eines zurückgesetzten; der nächste Turn wartet, bis der Thread zurück ist. Nach dem Abbruch steht `[Request interrupted by user]` im Transkript (FINDINGS → Phase 2).
- Kein `mode`-Feld in der Session (wäre ungelesen und scheiterte an Clippy); `set_permission_mode` prüft nur (FINDINGS → Phase 3).
- Benutzerordner `USERPROFILE`, sonst `HOME` (Builds für macOS/Linux) — in `transcript_path` und `locate::has_transcript`.
- Session-ID nur aus Buchstaben, Ziffern und Bindestrich (wird Teil eines Dateinamens).
- Ein Byte-Order-Mark vor einer Eingabezeile wird überlesen (.NET-`Process` schreibt eins).
- `llm` liest bei HTTP-Status ab 400 den Körper (`http_status_as_error(false)`) und nennt Status und Anfang des Körpers im Satz.
- Zusätzlich `artifacts/treiber.ps1`: schickt Nachrichten, wartet je auf `result`, kann eine Nachricht unterbrechen.
