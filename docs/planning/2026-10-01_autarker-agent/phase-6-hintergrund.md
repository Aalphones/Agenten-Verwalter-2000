# Phase 6 — Hintergrundprozesse und Scratchpad

Ziel: Der Agent startet Befehle auf Wunsch im Hintergrund (Dev-Server, lange Builds), schreibt ihre Ausgabe in eine Datei im Scratchpad der Session, meldet Start und Ende so, dass das Hintergrund-Panel des Verwalters sie unverändert zeigt, und beendet sie auf `TaskStop` des Modells oder „Stoppen“ im Panel.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Hintergrund, Gleichzeitigkeit), „Kontrakt“ (`init` mit `scratchpad_path`, Aufgaben-Zeilen, `stop_task`, Werkzeuge `Bash`/`PowerShell` mit `run_in_background`, `TaskStop`).
- Wie der Verwalter Hintergrundprozesse liest: `src-tauri/src/agents/claude/translate.rs` (`remember_bash` merkt `run_in_background`, `task_started` mit `task_type` `local_bash`, `output_file_of` sucht `Output is being written to: ` im Werkzeug-Ergebnis, `task_ended` über `task_notification`), `src-tauri/src/sessions/registry.rs` (`start_background`, `end_task`, `stop_background` schickt `stop_task`, `has_running_background` hält den Agenten wach), `src-tauri/src/background/` (Ausgabe lesen, Scratchpad mit Pfadprüfung).
- Phase 3: `standalone/tools/shell.rs` (Programmwahl, Kodierung, `taskkill /T /F`).
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — „Hintergrund-Subagent friert ein, ohne tot zu sein“: eine Ausgabedatei, die eine Weile nicht wächst, heißt nicht „tot“ — der Agent meldet ein Ende nur, wenn der Prozess wirklich beendet ist (`try_wait`), nie nach Zeit.

## AK der Phase

- „Starte `python -m http.server 8765` im Hintergrund“ → im Panel unter „Prozesse“ erscheint der Befehl mit laufender Ausgabe; der Agent antwortet sofort weiter; „Stoppen“ im Panel beendet den Prozess (Port 8765 wieder frei), das Panel zeigt „gestoppt“.
- Ein kurzer Hintergrund-Befehl (`ping -n 3 localhost` in PowerShell) endet von selbst → Panel zeigt „fertig“; bei der nächsten Nachricht weiß das Modell vom Ende (Hinweis im Verlauf).
- Das Modell kann die Ausgabe per `Read` auf die gemeldete Datei lesen und einen Prozess per `TaskStop` beenden.
- Der Reiter „Scratchpad“ zeigt `%USERPROFILE%\.verwalter\agent\<session-id>\scratchpad` mit dem Unterordner `tasks`.
- Esc während ein Hintergrundprozess läuft → der Prozess läuft weiter; die Session wird nach `VERWALTER_IDLE_SECONDS` nicht beendet, solange er läuft (Verhalten der Registry).
- Endet der Agent-Prozess (App schließen), sind seine Hintergrundprozesse beendet (Task-Manager).
- `pnpm check` grün.

## Checkliste

### Scratchpad

- [ ] `standalone/mod.rs`: `pub fn scratchpad_dir(session_id: &str) -> Option<PathBuf>` = `%USERPROFILE%\.verwalter\agent\<id>\scratchpad`. `session.rs` legt ihn beim Start an (`create_dir_all`, samt `tasks`), meldet ihn in `init` als `scratchpad_path` und nimmt ihn in `Roots.writable` auf (`paths::Roots::from_args` um den Parameter erweitern).

### Aufgaben `standalone/tasks.rs`

- [ ] `pub struct Tasks { inner: Mutex<HashMap<String, Task>> }` mit `enum TaskControl { Process { pid: u32 }, Subagent { cancel: Arc<AtomicBool> } }` (Subagent erst ab Phase 7 benutzt), `struct Task { control: TaskControl, description: String, output_file: Option<PathBuf> }`. IDs: `b` + 8 Hex-Zeichen einer UUID für Prozesse (`a` + 8 für Subagenten in Phase 7).
- [ ] `pub fn stop(&self, task_id: &str) -> Result<(), String>`: Prozess → `taskkill /PID <pid> /T /F` (mit `hide_console`); Subagent → `cancel` setzen; unbekannt → `Err("Aufgabe unbekannt: <id>")`. Das `task_notification` schreibt der Überwacher-Thread, nicht `stop`, mit `status: "stopped"` (Merker `stopped` je Aufgabe, damit der Überwacher „stopped“ statt „failed“ meldet).
- [ ] `pub fn stop_all(&self)` für das Prozessende.
- [ ] `pub fn take_notes(&self) -> Vec<String>`: gesammelte Hinweise über beendete Aufgaben für das Modell (siehe unten), danach leer.

### Hintergrund in `tools/shell.rs`

- [ ] Schema von `Bash`/`PowerShell` um `run_in_background` (boolean) ergänzen; Beschreibung: „Set run_in_background for servers and long builds; read the output file with Read; stop with TaskStop.“
- [ ] Bei `run_in_background: true`: Aufgaben-ID vergeben, Ausgabedatei `<scratchpad>\tasks\<id>.output` anlegen, Prozess wie im Vordergrund starten, aber stdout und stderr über zwei Threads **an die Datei anhängen** (je Block `write_all` + `flush`, Datei mit `OpenOptions::append`). Sofort `task_started` ausgeben (`task_type: "local_bash"`, `description` = `description`-Parameter, sonst `command`), in `Tasks` eintragen und als Ergebnis `Command running in background with ID: <id>. Output is being written to: <Datei>` zurückgeben (Wortlaut exakt, `translate.rs` sucht den zweiten Satzteil).
- [ ] Überwacher-Thread je Prozess: `wait`; danach `task_notification` mit `status` `completed` (Exit 0), `stopped` (gestoppt) oder `failed` (sonst), `summary` = `Exit code <n>`, `output_file`; Hinweis an `Tasks` für das Modell: „Background task <id> (<description>) finished: <status>, exit code <n>. Output: <Datei>“; Eintrag entfernen.
- [ ] Hintergrund-Aufrufe zählen nicht als laufender Befehl: kein Warten, Esc (`cancel`) betrifft sie nicht.

### Werkzeug `TaskStop` und Steueranfrage `stop_task`

- [ ] `tools/task_stop.rs`: `task_id` Pflicht → `Tasks::stop`; Ergebnis „Aufgabe <id> beendet.“ bzw. der Fehlertext. Rechte: `Allow` (in `permissions::decide` ergänzen).
- [ ] `session.rs`, `stop_task`: `request.task_id` → `Tasks::stop`; Erfolg → `control_success` mit `{}`, Fehler → `control_error`.
- [ ] Vor jeder Modellanfrage `Tasks::take_notes()`; sind Hinweise da, als Benutzer-Nachricht `{"role":"user","content":"<system-reminder>\n<Hinweise je Zeile>\n</system-reminder>"}` vor die Anfrage ins Transkript.
- [ ] Bei `Input::Closed` und jedem Exit-Pfad `Tasks::stop_all()` vor dem Beenden.

### Doku

- [ ] ADR 017, „Konsequenzen“: Hintergrundprozesse laufen bei Esc weiter und enden mit dem Agent-Prozess; Hinweise über beendete Aufgaben kommen erst mit der nächsten Modellanfrage beim Modell an (kein eigener Turn).
- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `tasks`, `tools/task_stop`, Scratchpad.
- [ ] Commit `feat(standalone): Hintergrundprozesse und Scratchpad`.

## Report-Back
