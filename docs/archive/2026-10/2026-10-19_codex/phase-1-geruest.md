# Phase 1 — Gerüst: Betriebsart, Programm finden, Übersetzer mit Text-Chat

## Kontext

Lesen vor dem Start: [README.md](README.md) (Entscheidungen, Kontrakt), [ADR 017](../../decisions/017-autarker-agent.md), Kontrakt im Plan [Autarker Agent](../../archive/2026-10/2026-10-01_autarker-agent/README.md#kontrakt), [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md), [docs/conventions/rust.md](../../conventions/rust.md), [docs/conventions/react.md](../../conventions/react.md).

Code-Stellen:

- `src-tauri/src/main.rs` — Weiche auf den Unterbefehl `agent`; daneben `codex`.
- `src-tauri/src/standalone/mod.rs` (`run`, `SUBCOMMAND`, `transcript_path`, `home_dir`), `standalone/args.rs` (`parse`, `AgentArgs`, `Start`), `standalone/output.rs` (`Output`, `init`, `assistant`, `result_success`/`_error`/`_aborted`, `control_success`/`_error`, `can_use_tool`) — wiederverwenden, nicht kopieren.
- `src-tauri/src/agents/standalone.rs` (`program`, `leading_args`) — Muster für `agents/codex.rs`.
- `src-tauri/src/agents/claude/locate.rs` (`find_claude`, `candidates`) — Muster fürs Finden.
- `src-tauri/src/agents/claude/process.rs` (`SpawnOptions`, `build_command`).
- `src-tauri/src/agents/claude/local.rs` (`resolve`, `LocalProgram`), `src-tauri/src/sessions/registry.rs` (`agent_backend`, `create_project` Prüfung `find_claude`, `is_standalone`, `start_process`).
- `src-tauri/src/settings/model.rs` (`OperatingMode`), `src-tauri/src/error.rs`.
- Oberfläche: `src/lib/labels.ts` (`OPERATING_MODE_OPTIONS`), `src/features/settings/OperatingModeSegment.tsx`, `SettingsView.tsx`, `src/features/chat/Composer.tsx`, `src/features/chat/useCommandMenu.ts`, `src/features/sessions/NewSession.tsx`, `src/app/SessionHeader.tsx` — alle mit `operatingMode !== 'claude'` bzw. `=== 'claude'`.
- `src-tauri/src/commands/account.rs` und `commands/cli_update.rs` (`is_standalone`).

Fehlerklassen geprüft: `typescript`/`react` im Vault — keine einschlägig; für Rust/Tauri keine Einträge.

## AK der Phase

1. `OperatingMode::Codex` existiert (serde `codex`), Bindings neu; die Einstellungsseite zeigt den vierten Knopf „Codex“ mit i-Erklärung „Sessions arbeiten mit OpenAI Codex und deinem ChatGPT-Konto.“
2. In „Codex“ gelten im Frontend **nicht** die LM-Studio-Sonderwege: die Prüfungen `operatingMode !== 'claude'` sind durch eine Hilfsfunktion `isLocalOperatingMode(mode)` (`true` nur für `claudeCodeLocal` und `standalone`) in `src/lib/labels.ts` ersetzt; „Lokales Modell“ ist in „Codex“ ausgeblendet.
3. `find_codex()` findet die Datei nach der Reihenfolge aus der README; fehlt sie, scheitert Senden/Anlegen mit `CommandError::CodexNotFound` und dem Satz aus der README, die Nachricht bleibt im Feld.
4. `verwalter.exe codex …` startet `codex app-server`, macht `initialize` + `initialized`, legt mit `--session-id` einen Thread an (Datei `%USERPROFILE%\.verwalter\codex\<id>.json`) bzw. setzt ihn mit `--resume` fort, gibt `init` aus, beantwortet Text-Nachrichten mit `assistant`- und `result`-Zeilen und bricht auf `interrupt` ab.
5. Die Registry startet in „Codex“ den Übersetzer, setzt `--resume` nur bei vorhandener Thread-Datei und braucht keine Claude-Kommandozeile.
6. ADR 031 liegt vor; Scope `codex` steht in `commits.md`.

## Checkliste

**Core — Betriebsart und Programm**

- [x] `settings/model.rs`: `OperatingMode::Codex` ergänzen. Alle `match` über `OperatingMode` nachziehen (Compiler zeigt sie): `local::resolve` → `OperatingMode::Codex => return Ok(None)` (kein LM Studio).
- [x] `error.rs`: `CodexNotFound` mit Satz „Codex nicht gefunden — installiere die Codex-Erweiterung für VS Code oder setze VERWALTER_CODEX_PATH.“ (Muster `ClaudeNotFound`).
- [x] Neue Datei `src-tauri/src/agents/codex.rs`: `pub fn find_codex() -> Option<PathBuf>` (1. `VERWALTER_CODEX_PATH`, wenn Datei existiert; 2. jedes `PATH`-Verzeichnis + `codex.exe`; 3. Ordner `%USERPROFILE%\.vscode\extensions` nach Namen `openai.chatgpt-*-win32-x64` durchsuchen, Versionsteil zwischen `openai.chatgpt-` und `-win32-x64` an `.` in Zahlen zerlegen, höchste Version nehmen, darin `bin\windows-x86_64\codex.exe` wenn vorhanden); `pub fn program()`/`pub fn leading_args()` wie `agents/standalone.rs` mit `crate::codex::SUBCOMMAND`; `pub fn has_thread(session_id) -> bool` = `crate::codex::thread_file(session_id)` existiert. In `agents/mod.rs` eintragen.
- [x] `agents/claude/process.rs`: `SpawnOptions` bekommt `codex_exe: Option<PathBuf>`; ist er gesetzt, `command.env(crate::codex::EXE_VARIABLE, path)` und `VERWALTER_AGENT_SCRATCHPAD` wie bei Standalone. Kein `--chrome`-Sonderfall nötig (Übersetzer ignoriert ihn); `CLAUDE_CODE_ARTIFACT` schadet nicht.
- [x] `sessions/registry.rs`: `agent_backend` gibt künftig `(OperatingMode, Option<LocalBackend>)` zurück (die Einstellungen lädt es ohnehin); alle Aufrufer anpassen und die Betriebsart bis `start_process` durchreichen. Bei `Codex`: `find_codex()` statt `find_claude()` prüfen; in `start_process` Zweig `(codex::program()?, codex::leading_args(), codex::has_thread(&session.id))` und `codex_exe: Some(find_codex()…)` an `SpawnOptions`. Der restliche Ablauf (`--resume`/„Verlauf nicht übernommen“) bleibt.
- [x] `commands/account.rs` und `commands/cli_update.rs`: `is_standalone` bleibt nur für `Standalone`; in „Codex“ bleiben Claude-Konto und Claude-Version sichtbar (sie betreffen die Claude-Kommandozeile, die nach dem Zurückschalten gilt).

**Übersetzer `src-tauri/src/codex/`**

- [x] `mod.rs`: `pub const SUBCOMMAND: &str = "codex"`, `pub const EXE_VARIABLE: &str = "VERWALTER_CODEX_EXE"`, `pub fn thread_file(session_id) -> Option<PathBuf>` (`%USERPROFILE%\.verwalter\codex\<id>.json`, Ordner bei Bedarf anlegen beim Schreiben), `pub fn run(args: Vec<String>) -> i32` (Muster `standalone::run`: Argumente mit `standalone::args::parse`, Umgebung lesen, Exit 2 bei Startfehler).
- [x] `standalone/args.rs`: `AgentArgs.effort: Option<Effort>` aus `--effort` (bisher überlesen; Standalone ignoriert das Feld weiter).
- [x] `rpc.rs`: JSON-RPC-Client über stdio für den Kindprozess `codex app-server` (`hide_console`, stdin/stdout/stderr gepiped). Ein Lese-Thread liest Zeilen und verteilt: Antworten (`id` + `result`/`error`) an wartende Aufrufer (`HashMap<u64, Sender>`), Server-Anfragen (`id` + `method`) und Benachrichtigungen (`method` ohne `id`) in einen Kanal an die Hauptschleife. `call(method, params, timeout) -> Result<Value, String>`, `notify(method, params)`, `respond(id, result)`. Zeitlimit für `initialize` 20 s, sonst 60 s; `turn/start` antwortet sofort, der Turn läuft über Benachrichtigungen.
- [x] `session.rs` Hauptschleife (Muster `standalone/session.rs`): stdin-Lese-Thread (Zeilen in denselben Kanal), Start: `initialize {clientInfo:{name:"verwalter",version:<CARGO_PKG_VERSION>}}`, `initialized`; `Start::New(id)` → `thread/start {cwd, model (leer → weglassen), approvalPolicy, sandbox}`, Thread-ID aus `result.thread.id` in die Datei schreiben (existiert sie schon → Fehler wie im Kontrakt); `Start::Resume(id)` → `thread/resume {threadId, cwd}`. Danach `output::init`.
- [x] Turn: `user`-Zeile → Text aus den Blöcken (nur `text` in dieser Phase) → `turn/start {threadId, input:[{type:"text",text}]}`; Benachrichtigungen bis `turn/completed` übersetzen: `item/completed` `agentMessage` → `output::assistant` mit Text; `turn/completed` → `result_success`/`_error`/`_aborted` nach `turn.status`. Läuft ein Turn, wartet eine neue `user`-Zeile in einer Schlange.
- [x] `interrupt` → `turn/interrupt {threadId, turnId}`, `control_success` sofort.
- [x] Unbekannte Steueranfragen → `control_error` „nicht unterstützt: <subtype>“. Server-Anfragen von Codex in dieser Phase → mit `decline` beantworten und eine stderr-Zeile.
- [x] Ende der Standardeingabe → `codex app-server` beenden (stdin schließen, 3 s warten, dann `kill`), Exit 0.
- [x] `main.rs`: zweite Weiche `codex` → `verwalter_lib::codex::run`. `lib.rs`: `pub mod codex;`.
- [x] `artifacts/beispielzeilen.jsonl` mit einer `user`-Zeile und einem `interrupt` anlegen.

**Oberfläche**

- [x] `src/lib/labels.ts`: Option `{ id: 'codex', label: 'Codex', hint: 'Sessions arbeiten mit OpenAI Codex und deinem ChatGPT-Konto.' }` (Feldnamen wie die bestehenden Optionen) und `export function isLocalOperatingMode(mode: OperatingMode): boolean`.
- [x] Jede Stelle mit `operatingMode !== 'claude'` / `=== 'claude'` (Composer, NewSession, SettingsView, SessionHeader, useCommandMenu) prüfen und auf `isLocalOperatingMode` bzw. eine ausdrückliche Liste umstellen. Kontingent in `SessionHeader` vorerst nur bei `claude` (Phase 5 erweitert).

**Doku**

- [x] `docs/decisions/031-codex.md` aus den README-Entscheidungen (Kontext / Optionen / Entscheidung / Konsequenzen).
- [x] `docs/conventions/commits.md`: Scope `codex`.
- [x] `docs/code-map.md`: Zeile „Codex (Betriebsart Codex)“ und `codex` in der Feature-Liste.
- [x] `docs/glossary.md`: „Codex“ (Betriebsart), „Übersetzer“ (der Unterbefehl `codex`).
- [x] `AGENTS.md`: Zeile `VERWALTER_CODEX_PATH` in der Befehlstabelle.

## Report-Back

**Status:** complete (2026-10-20).

- Übersetzer live gegen `codex.exe` aus `openai.chatgpt-26.1007.21434-win32-x64` geprobt (ohne Oberfläche, Probe-Skript außerhalb des Repos): neue Session → `init` mit `gpt-6-luna`, Antwort „Hallo“, `result` `success`; `--resume` mit der gemerkten Thread-ID → Codex kennt die erste Nachricht; Esc nach 4 s → sofort `aborted_streaming`, die nächste Nachricht danach läuft normal; `get_context_usage` → `error` „nicht unterstützt“.
- Nicht geprobt: der Weg über die Registry und die Oberfläche (App nicht gestartet) — Knopf „Codex“, Senden aus der Eingabeleiste, Fortsetzen nach App-Neustart und „Codex nicht gefunden“ prüft der Smoke.
- Abweichungen: Die i-Erklärung steht als Satz „Codex: Sessions arbeiten mit OpenAI Codex und deinem ChatGPT-Konto.“ im bestehenden Info-Text der Zeile „Betriebsart“ — die Optionen haben kein eigenes `hint`-Feld. Neu `process_mode` im Session-Zustand: ohne ihn erkennt `send` den Wechsel Claude ↔ Codex nicht (beide ohne lokales Backend) und startet den Agenten nicht neu. Der Browser-Zugriff (Knopf und `/`-Zeile) ist nur in „Claude“ sichtbar (`hasBrowser`), weil Claude in Chrome am Claude-Abo hängt. `set_model` geht in „Codex“ nicht an den Übersetzer (Claude-Kennung). `--chrome`/`--no-chrome` werden in `standalone/args.rs` still überlesen.
