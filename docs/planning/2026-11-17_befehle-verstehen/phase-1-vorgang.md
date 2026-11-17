# Phase 1 — Befehle nur einmal führen, Ausgabedatei kennen

Rating: heikel. Die Vorgangs-Meldungen der Kommandozeile zu einem Vordergrund-Befehl landen am vorhandenen Eintrag der Art `Command` statt in einem zweiten Eintrag der Art `Process`; der Eintrag kennt danach seine Ausgabedatei. Kein neues Aussehen.

## Kontext (lesen)

- [README.md](README.md) → „Gemessene Grundlage“, „Kontrakt“ (Typen, `matches_task`, `task_ref`); [ADR 066](../../decisions/066-befehle-verstehen.md)
- [artifacts/vordergrund.jsonl](artifacts/vordergrund.jsonl), [artifacts/zeitlimit.jsonl](artifacts/zeitlimit.jsonl) — die echten Zeilen beider Fälle
- `docs/knowledge/claude-stream-json.md` → „Befehle im Vordergrund (Bash)“, „Hintergrundprozesse und Subagenten“
- `src-tauri/src/agents/claude/protocol.rs` — `SystemLine`, Helfer `lenient`
- `src-tauri/src/agents/claude/translate.rs` — `Translator` (Felder `bash_calls`, `started_tasks`, `early_task_events`), `handle_system`, `task_started`, `process_title`, `remember_bash`, `handle_user`, `task_ended`, `output_file_of`
- `src-tauri/src/agents/event.rs` — `AgentEvent`
- `src-tauri/src/background/model.rs` — `BackgroundItem`, `BackgroundKind`
- `src-tauri/src/sessions/registry.rs` — `apply_event` (Zweige `ScratchpadDir`, `CommandStarted`, `CommandFinished`, `TaskStarted`, `TaskOutputFile`, `TaskProgress`, `TaskEnded`), `start_background`, `finish_command`, `end_task`, `background_index`, `touch_background`, `background_output`, `stop_background`
- `src-tauri/examples/file-link-probe.rs` — Muster eines kleinen Prüfprogramms
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `werkzeuge/claude-code`): „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“ → ein unterbrochener Eintrag bleibt `Interrupted`, auch wenn später noch eine Vorgangs-Meldung kommt (`end_task` prüft schon `is_running`; so lassen).

## Verstanden, bevor es geändert wird

- `task_started` legt heute für jeden `local_bash`-Vorgang einen Eintrag `Process` an. Für `run_in_background`-Aufrufe ist das richtig und bleibt; nur der Fall `is_backgrounded: false` wird umgeleitet.
- `process_title` hält den Aufruf in `bash_calls`, damit das spätere `tool_result` den Befehl noch beenden kann. Bleibt.
- `finish_command` sucht `kind == Command && id == tool_use_id`. Bleibt; ein umgewandelter Eintrag (`kind == Process`) wird davon absichtlich nicht mehr gefunden.

## AK

1. `cargo run --manifest-path src-tauri/Cargo.toml --example translate-probe -- docs/planning/2026-11-17_befehle-verstehen/artifacts/vordergrund.jsonl` druckt in dieser Reihenfolge `CommandStarted`, `CommandTask`, `ToolFinished`, `CommandFinished` (mit `exit_code: Some(0)`) und **kein** `TaskStarted` und **kein** `TaskEnded`.
2. Dasselbe mit `zeitlimit.jsonl` druckt `CommandStarted`, `CommandTask`, `CommandBackgrounded`, `ToolFinished`, `TaskOutputFile`, später `TaskEnded` mit `end: Completed` und **kein** `CommandFinished`.
3. Vertauscht man in einer Kopie von `zeitlimit.jsonl` die Zeilen `task_updated` (mit `is_backgrounded`) und `user` (`tool_result`), druckt das Prüfprogramm `CommandFinished` vor `CommandBackgrounded`; im Session-Zustand ist der Eintrag danach trotzdem `kind: Process`, `state: Running` (Regel siehe Checkliste „Zustand“).
4. Ein Vordergrund-Befehl über 2 s ergibt genau einen Hintergrund-Eintrag (`kind: Command`) mit gesetztem `task_id` und `output_file`.
5. `background_output` liefert für einen **laufenden** Eintrag `Command` mit `output_file` den Inhalt der Datei (`read_tail`), für einen beendeten wie bisher die gespeicherte Ausgabe.
6. `pnpm bindings` ausgeführt, `pnpm check` grün.

## Checkliste

### Protokoll

- [ ] `protocol.rs`, `SystemLine`: `#[serde(default, deserialize_with = "lenient")] pub is_backgrounded: Option<bool>` und `#[serde(default, deserialize_with = "lenient")] pub patch: Option<TaskPatch>`; neuer Typ `pub struct TaskPatch { #[serde(default)] pub is_backgrounded: Option<bool> }` (`Debug, Deserialize`).

### Ereignisse

- [ ] `event.rs`: `AgentEvent::CommandTask { tool_use_id: String, task_id: String }` und `AgentEvent::CommandBackgrounded { tool_use_id: String, task_id: String }` mit Kommentar aus dem Kontrakt.

### Übersetzer (`translate.rs`)

- [ ] `Translator`: neues Feld `foreground_tasks: HashMap<String, String>` (`task_id` → `tool_use_id`) mit Kommentar: Vorgänge von Vordergrund-Befehlen, bis ihr Ende oder ihr Wechsel in den Hintergrund kommt.
- [ ] `task_started`: ist `task_type == local_bash` **und** `system.is_backgrounded == Some(false)` **und** kennt `bash_calls` den `tool_use_id` mit `background == false` → `foreground_tasks.insert(task_id, tool_use_id)` und nur `vec![AgentEvent::CommandTask { .. }]` zurückgeben (kein `started_tasks.insert`, kein `TaskStarted`). Alle anderen Fälle unverändert.
- [ ] `handle_system`: neuer Zweig `"task_updated"`: ist `patch.is_backgrounded == Some(true)` und steht `task_id` in `foreground_tasks` → Eintrag entfernen, in `bash_calls` den Aufruf auf `background = true` setzen (falls noch da), `started_tasks.insert(tool_use_id)`, `vec![AgentEvent::CommandBackgrounded { .. }]`. Sonst `Vec::new()`.
- [ ] Zweig `"task_notification"`: steht `task_id` noch in `foreground_tasks` (nie in den Hintergrund gewandert) → Eintrag entfernen und `Vec::new()` zurückgeben. Sonst wie bisher `task_ended`.
- [ ] `handle_user`: unverändert lassen und am Ablauf prüfen: nach `CommandBackgrounded` ist der Aufruf in `bash_calls` `background == true`, also entsteht kein `CommandFinished`, und `output_file_of(&text)` liefert die Datei als `TaskOutputFile`.

### Zustand (`registry.rs`)

- [ ] `background/model.rs`: `BackgroundItem.task_id: Option<String>` mit `#[serde(default)]`; Methoden `matches_task(&self, task_id: &str) -> bool` und `task_ref(&self) -> &str` (Kontrakt). `start_background` setzt `task_id: None`.
- [ ] Session-Zustand: neues Feld `cli_tasks_dir: Option<PathBuf>`. Zweig `AgentEvent::ScratchpadDir(dir)`: `cli_tasks_dir = Path::new(&dir).parent().map(|parent| parent.join("tasks"))`; der bestehende Kommentar bleibt, ergänzt um den Satz, wofür der Ordner jetzt dient.
- [ ] Zweig `CommandTask`: Eintrag `kind == Command && id == tool_use_id` suchen; `task_id` setzen; ist `cli_tasks_dir` bekannt, `output_file = Some(<cli_tasks_dir>/<task_id>.output)`; `touch_background`.
- [ ] Zweig `CommandBackgrounded`: Eintrag `id == tool_use_id` suchen (egal welcher Zustand außer `Interrupted`): `kind = Process`, `task_id = Some(task_id)`, `state = Running`, `ended_at = None`, `exit_code = None`; `touch_background` (setzt `summary_dirty`, weil jetzt `Process`). Kommentar: deckt auch den Fall, dass das `tool_result` vorher kam.
- [ ] Zweige `TaskStarted`, `TaskProgress` und `end_task`: die Suche `item.id == task_id` durch `item.matches_task(&task_id)` ersetzen.
- [ ] Zweig `TaskOutputFile`: sucht heute `kind == Process && tool_use_id == …` — passt nach der Umwandlung unverändert.
- [ ] `stop_background`: wo heute `item.id` als Vorgang an `stop_task` geht, `item.task_ref()` nehmen.
- [ ] `background_output`, Zweig `BackgroundKind::Command`: läuft der Eintrag und hat er `output_file` → `read_tail(Path::new(&file), MAX_PREVIEW_BYTES)`; sonst wie bisher aus der Datenbank.

### Prüfprogramm

- [ ] `src-tauri/examples/translate-probe.rs`: liest die Datei aus dem ersten Argument zeilenweise, gibt jede Zeile an einen `Translator` (`handle_line`) und druckt je Ereignis eine Zeile `{:?}`, gekürzt auf 200 Zeichen; `AgentEvent::Unknown` druckt `Unknown`. Kein Zugriff auf Datenbank oder Netz. Falls `Translator` außerhalb des Crates nicht erreichbar ist: den nötigen `pub`-Pfad so öffnen, wie es die anderen Prüfprogramme für ihre Module tun.
- [ ] `AGENTS.md`, Tabelle „Befehle“: Zeile für `translate-probe` (Aufruf, was es druckt).

### Doku

- [ ] `docs/knowledge/claude-stream-json.md`: Abschnitt „Befehle im Vordergrund (Bash)“ um die Punkte aus „Gemessene Grundlage“ ergänzen (Stand 2.1.322, 2026-11-17).
- [ ] `docs/code-map.md`, Zeile „Hintergrund“: `task_id`, Ausgabedatei laufender Befehle, `translate-probe`.
- [ ] `docs/glossary.md`: „Vorgang“ (Eintrag der Kommandozeile zu einem laufenden Befehl oder Subagenten, Kennung `task_id`).

## Report-Back
