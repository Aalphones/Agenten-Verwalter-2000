# Phase 3 — Core: Hintergrund und Scratchpad

**Status:** pending · **Rating:** heikel (neue Ereignisse im Übersetzer, Zustandsübergänge an vier Stellen, an denen der Agent-Prozess endet, Statusfix mit Wirkung auf alle Sessions, Pfadprüfung gegen Ausbruch aus dem Scratchpad)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ → „Hintergrund“ und „Kontrakt“ (Typen `BackgroundKind` … `BackgroundChangedEvent`, Commands Phase 3)
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitte „Befehle im Vordergrund (Bash)“, „Hintergrundprozesse und Subagenten“, „Steueranfragen“, „Scratchpad“ — **die Feldnamen unten stammen von dort**
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md), [ADR 006](../../decisions/006-changes-und-diff.md) (warum kein Dateisystem-Beobachter), [ADR 007](../../decisions/007-anhaenge-skills-hintergrund.md) (aus Phase 1)
- [docs/conventions/rust.md](../../conventions/rust.md)
- Bestand:
  - `src-tauri/src/agents/claude/protocol.rs` (`SystemLine`, `MessageLine`, `ContentBlock::ToolResult`), `translate.rs` (`Translator`, `handle_system`, `handle_assistant`, `handle_user`, `target_of`)
  - `src-tauri/src/agents/event.rs` (`AgentEvent`)
  - `src-tauri/src/sessions/registry.rs`: `SessionState`, `Outbox` (`emit`, `persist`), `apply_event`, `load_entries`, `restored`, `restore`, `reap_idle`, `cancel`, `process_exited`, `start_process`, `send_control`
  - `src-tauri/src/db/` (`mod.rs`, `migrations.rs` + `migrations/*.sql`, `chat_entries.rs` als Muster, `sessions.rs` mit `SessionRow`)
  - `src-tauri/src/changes/parse.rs` (Muster: Binärerkennung über NUL-Byte in den ersten 8000 Bytes)
- Fehlerklassen: Vault `werkzeuge/claude-code.md` gelesen, einschlägig ist **„Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“**. Deshalb heißt der Zustand nach dem Ende des Agenten `interrupted` („unterbrochen“) und nie „nicht ausgeführt“ (AK 6). `systeme/sqlite.md` gelesen — nicht einschlägig (Sicherung, Blobs). Projekteigen:
  - **Subagent-Zeilen verfälschen den Kontext-Balken:** `assistant`-Zeilen mit `parent_tool_use_id` tragen die `usage` des Subagenten. Sie dürfen kein `ContextUsed` erzeugen (bestehendes Verhalten, beim Umbau von `handle_assistant` erhalten).
  - **Pfad-Ausbruch:** `scratchpad_read` bekommt einen relativen Pfad aus der Oberfläche. Komponenten `..`, Wurzel und Laufwerk werden abgelehnt, **und** der kanonische Zielpfad muss unter dem kanonischen Scratchpad liegen (Symlinks). Prüfen per AK 7.
  - **Sperre und Dateizugriff:** Unter der Session-Sperre nur kleine Lesezugriffe (Kopf einer Ausgabedatei, 64 KiB). Ausgaben (bis 256 KiB) und Scratchpad-Listen werden **nach** dem Freigeben gelesen.

## Abnahmekriterien der Phase

1. `pnpm check` grün; `pnpm bindings` erzeugt die Typen aus dem Kontrakt (Phase 3).
2. Agent bitten, `node -e "console.log('Local: http://localhost:5173/'); setInterval(()=>{},1000)"` im Hintergrund zu starten: `background_load` liefert einen Eintrag `process`, `running`, `title` = der Befehl, `url` = `http://localhost:5173/`, `outputFile` gesetzt; `background_output` liefert die Zeile. `background://changed` kam mindestens einmal.
3. `background_stop` auf diesen Eintrag → kurz danach `stopped` mit `endedAt`; der Agent läuft weiter und nimmt die nächste Nachricht an.
4. Agent bitten, `node -e "console.log('eins'); process.exit(3)"` im Vordergrund auszuführen → Eintrag `command`, `failed`, `exitCode` 3, `background_output` enthält `eins`. Ein erfolgreicher Befehl → `completed`, `exitCode` 0.
5. Agent bitten, einen Subagenten zu starten → Eintrag `subagent` mit `subagentType`, `model`, wachsenden `toolUses` und `steps`, am Ende `completed` mit `result`. Arbeitet der Agent danach von selbst weiter, wechselt die Session auf `running` und nach dem `result` wieder auf `completed` (Sidebar beobachten).
6. Laufenden Hintergrundprozess starten lassen, dann die Session abbrechen → Eintrag `interrupted`. App beenden, neu starten, Session öffnen → Einträge sind noch da; keiner steht auf `running`.
7. `scratchpad_list` liefert nach dem ersten Agenten-Lauf `dir` = Claudes `scratchpad_path`; nach „leg eine Datei notiz.md im Scratchpad an“ steht `notiz.md` darin, `scratchpad_read(…, 'notiz.md')` liefert den Text. `scratchpad_read(…, '../x')`, `'C:/Windows/win.ini'` und ein leerer Pfad → `io`-Fehler.
8. Mit `VERWALTER_IDLE_SECONDS=60`: Solange ein Eintrag `running` ist, wird der Agent nicht beendet; ohne laufenden Eintrag nach rund einer Minute schon.

## Checkliste

### Typen und Ereignisse

- [ ] `src-tauri/src/background/model.rs` (neu, Modul `background` mit `mod.rs`, `model.rs`, `output.rs`, `scratchpad.rs`; in `lib.rs` `mod background;`): Typen nach Kontrakt, in `gen-bindings.rs` eintragen.
- [ ] `src-tauri/src/agents/event.rs`: zwei anbieterneutrale Hilfstypen `pub enum TaskKind { Process, Subagent }` und `pub enum TaskEnd { Completed, Failed, Stopped }` (nur `Debug, Clone, Copy, PartialEq, Eq`, nicht über die Tauri-Grenze). Neue `AgentEvent`-Varianten:
  - `ScratchpadDir(String)`
  - `CommandStarted { tool_use_id: String, command: String }`
  - `CommandFinished { tool_use_id: String, output: String, exit_code: Option<i32> }`
  - `TaskStarted { task_id: String, tool_use_id: String, kind: TaskKind, title: String, subagent_type: Option<String> }`
  - `TaskOutputFile { tool_use_id: String, path: String }`
  - `TaskProgress { task_id: String, tool_uses: u32 }`
  - `TaskEnded { task_id: String, end: TaskEnd, summary: Option<String>, output_file: Option<String> }`
  - `SubagentStep { parent_tool_use_id: String, tool: String, target: String }`
  - `SubagentText { parent_tool_use_id: String, text: String }`
  - `SubagentModel { tool_use_id: String, model: String }`

### Protokoll und Übersetzer

- [ ] `protocol.rs`:
  - `SystemLine` um optionale Felder erweitern: `scratchpad_path`, `task_id`, `tool_use_id`, `task_type`, `description`, `subagent_type`, `status`, `summary`, `output_file` (alle `Option<String>`) und `usage: Option<TaskUsage>` mit `pub struct TaskUsage { pub tool_uses: Option<u32> }`.
  - `MessageLine` um `tool_use_result: Option<Value>` erweitern.
  - `ContentBlock::ToolResult` um `content: Option<Value>` erweitern.
  - `pub fn stop_task(task_id: &str) -> Value` = `json!({"subtype":"stop_task","task_id": task_id})`.
- [ ] `translate.rs`, `Translator` bekommt `bash_calls: HashMap<String, BashCall>` mit `struct BashCall { command: String, background: bool }`.
  - **Hauptagent, `tool_use` mit Name `Bash`:** `command` = `input.command` (String, sonst leer), `background` = `input.run_in_background == true`. In `bash_calls` merken. Zusätzlich zu `ToolStarted` bei `!background` ein `CommandStarted` erzeugen.
  - **`handle_assistant` mit `parent_tool_use_id = Some(parent)`:** kein `ContextUsed`. Je Block: `ToolUse` → `SubagentStep { parent, tool: name, target: target_of(&name, &input) }`; nicht leerer `Text` → `SubagentText`; sonst nichts.
  - **`handle_user`**, nur Hauptagent (Zeilen mit `parent_tool_use_id` weiter ignorieren). Je `ToolResult`:
    - wie bisher `ToolFinished`;
    - Vordergrund-Bash → `CommandFinished` mit `output` = Text des Inhalts (String direkt; Array → die `text`-Felder der Blöcke vom Typ `text`, verbunden mit `\n`). Bei `is_error` und Textanfang `Exit code <n>` ist `exit_code` = n und die erste Zeile wird aus `output` entfernt; bei `is_error` ohne dieses Muster `None`; sonst `Some(0)`;
    - Hintergrund-Bash → steht im Text `Output is being written to: `, ist der Rest dieser Zeile (getrimmt) der Pfad → `TaskOutputFile`;
    - ist `tool_use_result` ein Objekt mit String-Feld `resolvedModel` → `SubagentModel { tool_use_id, model }`.
  - **`handle_system`:**
    - `init` → `Ready` wie bisher und, wenn `scratchpad_path` gesetzt ist, zusätzlich `ScratchpadDir`.
    - `task_started`: `task_type` `local_bash` → `Process`, `local_agent` → `Subagent`, sonst nichts. `title` = bei `Process` der Befehl aus `bash_calls[tool_use_id]`, falls vorhanden, sonst `description`; bei `Subagent` `description`. Fehlen `task_id` oder `tool_use_id`, nichts erzeugen.
    - `task_progress` → `TaskProgress` mit `usage.tool_uses` (fehlt es: nichts).
    - `task_notification` → `TaskEnded`: `status` `completed` → `Completed`, `stopped` oder `killed` → `Stopped`, alles andere → `Failed`.
    - Andere Subtypen (`task_updated`, `background_tasks_changed` …) → nichts.

### Hilfsfunktionen `background/output.rs` und `background/scratchpad.rs`

- [ ] `output.rs`:
  - Konstanten `MAX_COMMAND_OUTPUT_BYTES: usize = 65_536`, `MAX_PREVIEW_BYTES: u64 = 262_144`, `URL_SCAN_BYTES: u64 = 65_536`, `BINARY_SCAN_BYTES: usize = 8_000`.
  - `pub fn tail_text(text: &str, max_bytes: usize) -> (String, bool)`: länger → die letzten `max_bytes` an einer Zeichengrenze, dann bis hinter das erste `\n` gekürzt, `true`.
  - `pub fn read_head(path: &Path, max_bytes: u64) -> Option<String>`.
  - `pub fn read_tail(path: &Path, max_bytes: u64) -> TextPreview`: fehlt die Datei → `missing: true`. Größer → ab `len - max_bytes` lesen, bis hinter das erste `\n` kürzen, `truncated: true`. NUL-Byte in den ersten `BINARY_SCAN_BYTES` des Gelesenen → `binary: true`, `text` leer. Sonst `from_utf8_lossy`.
  - `pub fn find_local_url(text: &str) -> Option<String>`: nach Regel im README („Adresse eines Prozesses“), ohne neue Abhängigkeit (Suche nach `http://` und `https://`, Ende am ersten Leerzeichen oder einem von `"'<>`).
  - `pub fn exit_code_from_summary(summary: &str) -> Option<i32>`: letzte Fundstelle von `exit code ` (Kleinschreibung verglichen), dahinter optional `-` und Ziffern.
- [ ] `scratchpad.rs`:
  - `const MAX_DEPTH: usize = 6; const MAX_ENTRIES: usize = 2_000;`
  - `pub fn list(dir: Option<&Path>) -> ScratchpadListing`: `None` oder fehlender Ordner → leere Liste. Rekursiv bis `MAX_DEPTH`; ab `MAX_ENTRIES` `truncated: true` und aufhören. Pfade relativ mit `/`, Ordner mit `is_dir: true` und Größe 0, `modified_ms` aus `metadata().modified()`. Nach `path` sortiert (Byte-Reihenfolge).
  - `pub fn read(dir: &Path, relative: &str) -> Result<TextPreview, CommandError>`: leer, oder eine Komponente (`Path::new(relative).components()`) ist `ParentDir`, `RootDir` oder `Prefix` → `Io("Ungültiger Pfad")`. `dir.join(relative)` und `dir` kanonisieren (`fs::canonicalize`); das Ziel muss mit dem kanonischen `dir` beginnen, sonst dieselbe Meldung. Ordner → `Io("Ordner haben keine Vorschau")`. Lesen wie `read_tail`, aber vom **Anfang** bis `MAX_PREVIEW_BYTES` (`truncated`, wenn größer).

### Datenbank

- [ ] `src-tauri/src/db/migrations/003_background.sql`:

  ```sql
  CREATE TABLE background_items (
    session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id               TEXT NOT NULL,
    started_at       REAL NOT NULL,
    payload          TEXT NOT NULL,
    output           TEXT,
    output_truncated INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, id)
  ) WITHOUT ROWID;

  ALTER TABLE sessions ADD COLUMN scratchpad_dir TEXT;
  ```

  In `migrations.rs` als dritten Eintrag von `MIGRATIONS` (Arraylänge 3).
- [ ] `src-tauri/src/db/background.rs` (neu, `pub mod background;` in `db/mod.rs`), Muster `chat_entries.rs`:
  - `upsert_items(connection: &mut Connection, session_id, items: &[BackgroundItem])`: in einer Transaktion, `ON CONFLICT(session_id, id) DO UPDATE SET payload = excluded.payload, started_at = excluded.started_at` — **ohne** die Ausgabe anzufassen.
  - `set_output(connection, session_id, id, output: &str, truncated: bool)` (`UPDATE`).
  - `load_items(connection, session_id) -> Vec<BackgroundItem>` nach `started_at`.
  - `load_output(connection, session_id, id) -> Option<(String, bool)>`.
- [ ] `src-tauri/src/db/sessions.rs`: `SessionRow.scratchpad_dir: Option<String>` in Lesen und Schreiben; `row_of` in `registry.rs` setzt es aus `state.scratchpad_dir`.

### Registry

- [ ] Konstante `BACKGROUND_CHANGED_EVENT = "background://changed"`, `MAX_SUBAGENT_STEPS: usize = 200`.
- [ ] `SessionState` bekommt `background: Vec<BackgroundItem>` und `scratchpad_dir: Option<String>`. `new` → leer/`None`; `restored` → `scratchpad_dir` aus der Zeile; `load_entries` lädt `background` per `load_items`. Jeder geladene Eintrag mit `running` wird `interrupted` mit `ended_at = now_ms()` und sofort per `upsert_items` zurückgeschrieben.
- [ ] `Outbox` bekommt `background: Vec<BackgroundItem>` (geänderte Einträge), `outputs: Vec<(String, String, bool)>` (id, Ausgabe, gekürzt), `background_changed: bool`, `scratchpad_dir: Option<String>`.
  - `persist` schreibt `background` per `upsert_items` und danach `outputs` per `set_output`, jeweils nach den Chat-Einträgen.
  - `emit` sendet bei `background_changed` `BACKGROUND_CHANGED_EVENT` mit `BackgroundChangedEvent { session_id }` und gibt bei gesetztem `scratchpad_dir` den Ordner frei: `app.asset_protocol_scope().allow_directory(dir, true)` (Fehler ins Session-Protokoll).
- [ ] Hilfsmethode `SessionState::touch_background(&mut self, outbox, index)`: legt eine Kopie von `self.background[index]` in `outbox.background` und setzt `background_changed`. Jede Änderung eines Eintrags geht darüber.
- [ ] `apply_event` — neue Arme:
  - `ScratchpadDir(dir)`: weicht er von `scratchpad_dir` ab → speichern, `outbox.summary_dirty = true` (schreibt die Zeile), `outbox.scratchpad_dir = Some(dir)`.
  - `CommandStarted`: neuer Eintrag `{ id: tool_use_id, tool_use_id, kind: Command, state: Running, title: command, started_at: now_ms(), sonst leer/None/0 }`.
  - `CommandFinished`: Eintrag mit dieser `id` suchen (fehlt er: nichts). `state` = `Completed` bei `exit_code == Some(0)`, sonst `Failed`; `exit_code`, `ended_at`. `tail_text(output, MAX_COMMAND_OUTPUT_BYTES)` → `outbox.outputs`.
  - `TaskStarted`: gibt es die `task_id` schon, nichts. Sonst neuer Eintrag `{ id: task_id, tool_use_id, kind: Process|Subagent, state: Running, title, subagent_type, started_at: now_ms() }`.
  - `TaskOutputFile`: den `process`-Eintrag mit diesem `tool_use_id` suchen, `output_file` setzen.
  - `TaskProgress`: `tool_uses` setzen.
  - `TaskEnded`: nur wenn der Eintrag noch `running` ist (ein angehaltener Eintrag kann nach `interrupted` nicht mehr umschlagen). `state` aus `end`, `ended_at`, `output_file` (falls gesetzt). `process`: `exit_code` = `exit_code_from_summary(summary)`, bei `Completed` ohne Zahl `Some(0)`. `subagent`: ist `result` leer und `end == Completed`, `result = summary`.
  - `SubagentStep`: den `subagent` mit `tool_use_id == parent_tool_use_id` suchen; Schritt anhängen, über `MAX_SUBAGENT_STEPS` den ältesten entfernen.
  - `SubagentText`: dessen `result = Some(text)`.
  - `SubagentModel`: den Eintrag mit diesem `tool_use_id` suchen, `model` setzen.
- [ ] **Statusfix:** neue Methode `wake_if_idle(&mut self, outbox)`: ist `status` `Completed` oder `Paused` und weder `pause_requested` noch `cancel_requested` gesetzt → `set_status(outbox, SessionStatus::Running)`. Aufruf am Anfang der Arme `Text`, `Thinking`, `ToolStarted` und `Todos` in `apply_event`. **Nicht** bei `Ready`, `TurnEnded`, `QuestionAsked` und den Hintergrund-Ereignissen.
- [ ] **Ende des Prozesses:** Methode `interrupt_background(&mut self, outbox)`: jeder `running`-Eintrag → `interrupted`, `ended_at = now_ms()`, `touch_background`. Aufruf an genau den Stellen, an denen der Agent-Prozess der Session endet oder ersetzt wird:
  1. `process_exited` (neben `interrupt_running_tools`);
  2. `cancel` (neben `interrupt_running_tools`);
  3. `reap_idle`, in dessen `update`-Closure direkt neben `state.process = None` (die Closure hat den `outbox` schon);
  4. `start_process`, wenn ein vorheriger Prozess ersetzt wird (`if let Some(previous) = state.process.take()`).
- [ ] **Ruhe-Timer:** Methode `has_running_background(&self) -> bool`. In `reap_idle` kommt `&& !state.has_running_background()` in **beide** Prüfungen (die Vorprüfung `is_candidate` und die Wiederholung in der `update`-Closure).
- [ ] `restore`: für jede geladene Zeile mit `scratchpad_dir` `app.asset_protocol_scope().allow_directory(dir, true)` (Fehler ignorieren).
- [ ] Neue öffentliche Methoden:
  - `pub fn background(&self, app, session_id) -> Result<SessionBackground, CommandError>` über `update`: für jeden `process` mit `running`, `url == None` und `output_file` → `read_head(URL_SCAN_BYTES)` + `find_local_url`; Treffer setzen und `touch_background`. Rückgabe: Kopie von `background` und `scratchpad_dir`.
  - `pub fn background_output(&self, session_id, item_id) -> Result<TextPreview, CommandError>`: Eintrag unter der Sperre kopieren, danach lesen. `command` → `load_output` (fehlt → `missing: true`); `process` → `read_tail(output_file, MAX_PREVIEW_BYTES)` (`output_file` fehlt → `missing: true`); `subagent` → `Internal("Subagenten haben keine Ausgabe")`. Unbekannte ID → `Internal("Eintrag nicht gefunden")`.
  - `pub fn stop_background(&self, app, session_id, item_id) -> Result<(), CommandError>` über `update`: Eintrag muss `process` oder `subagent` und `running` sein, sonst `Internal("Eintrag läuft nicht")`; dann `send_control(outbox, stop_task(item_id))`. Den Zustand ändert erst das folgende `TaskEnded`.
  - `pub fn scratchpad_dir(&self, session_id) -> Result<Option<PathBuf>, CommandError>`.

### Commands

- [ ] `src-tauri/src/commands/background.rs` (neu, in `commands/mod.rs`, registriert in `lib.rs`), alle `async`: `background_load`, `background_output`, `background_stop`, `scratchpad_list` (= `scratchpad::list(registry.scratchpad_dir(..)?.as_deref())`, außerhalb der Sperre), `scratchpad_read` (ohne bekannten Ordner → `Io("Kein Scratchpad-Ordner bekannt")`).
- [ ] `src/lib/background.ts` (neu): Wrapper aus dem Kontrakt plus `onBackgroundChanged(callback: (event: BackgroundChangedEvent) => void): Promise<UnlistenFn>` nach Muster `onChatEntry`.

### Doku

- [ ] `docs/code-map.md`: Zeile „Hintergrund (Prozesse, Subagenten, Scratchpad)“ mit `src/lib/background.ts` · `src-tauri/src/background/` (`model.rs`, `output.rs`, `scratchpad.rs`), `src-tauri/src/commands/background.rs`, `src-tauri/src/db/background.rs`; Persistenz-Zeile um Migration 3 ergänzen; Feature-Liste im Namensschema um `background`.
- [ ] `docs/glossary.md`: „Hintergrundprozess“ präzisieren (Bash mit `run_in_background`, Ausgabe in Claudes Ausgabedatei, anhaltbar); neu **Ausgeführter Befehl** („Ein Bash-Aufruf des Agenten im Vordergrund; steht im Hintergrund-Panel unter ‚Ausgeführt‘ mit Exit-Code und Ausgabe“); „Scratchpad“ ersetzen durch: „Claudes eigener temporärer Ordner einer Session (`%TEMP%\claude\…\<session-id>\scratchpad`), gemeldet in `system/init`; liegt außerhalb des Workspace, die Kommandozeile erlaubt ihn dem Agenten selbst.“ „Session-Status“ um den Satz ergänzen: „Arbeitet der Agent in `completed` oder `paused` von selbst weiter (nach dem Ende eines Subagenten oder Hintergrundprozesses), wechselt die Session auf `running`.“

## Report-Back
