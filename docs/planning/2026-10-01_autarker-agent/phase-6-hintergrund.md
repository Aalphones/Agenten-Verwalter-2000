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
- Der Reiter „Scratchpad“ zeigt den Ordner der Session `<Workspace>\.scratchpad\<session-id>` (ADR 022) mit dem Unterordner `tasks`.
- Esc während ein Hintergrundprozess läuft → der Prozess läuft weiter; die Session wird nach `VERWALTER_IDLE_SECONDS` nicht beendet, solange er läuft (Verhalten der Registry).
- Endet der Agent-Prozess (App schließen), sind seine Hintergrundprozesse beendet (Task-Manager).
- `pnpm check` grün.

## Checkliste

### Scratchpad

- [x] Den Ordner gibt der Verwalter vor (ADR 022, FINDINGS). `process.rs` setzt für den eigenen Agenten zusätzlich `VERWALTER_AGENT_SCRATCHPAD`; `Environment` liest sie, fehlt sie, nimmt `session.rs` `standalone::fallback_scratchpad` (`%USERPROFILE%\.verwalter\agent\<id>\scratchpad`). `session.rs` legt ihn samt `tasks` an, meldet ihn in `init` als `scratchpad_path` und nimmt ihn in die schreibbaren Ordner auf (`paths::Roots::from_args` mit Parameter `scratchpad`).

### Aufgaben `standalone/tasks.rs`

- [x] `Tasks` mit laufenden Aufgaben (`pid`, Beschreibung, Ausgabedatei, Merker `is_stopped`) und gesammelten Hinweisen. IDs `b` + 8 Hex-Zeichen einer UUID. Abweichung: kein `enum TaskControl` mit Variante `Subagent` — eine nie gebaute Variante lässt Clippy (`-D warnings`) scheitern; Phase 7 ergänzt sie.
- [x] `stop(task_id)`: `taskkill /PID <pid> /T /F` mit `hide_console`, unbekannt → `Err("Aufgabe unbekannt: <id>")`; `task_notification` schreibt der Überwacher.
- [x] `stop_all()` für das Prozessende.
- [x] `take_notes()`.

### Hintergrund in `tools/shell.rs`

- [x] Schema von `Bash`/`PowerShell` um `run_in_background` ergänzt, Beschreibung wie geplant.
- [x] Bei `run_in_background: true`: ID, Ausgabedatei `<scratchpad>\tasks\<id>.output` (append), zwei Lese-Threads hängen an die Datei an, sofort `task_started`, Ergebnis `Command running in background with ID: <id>. Output is being written to: <Datei>`.
- [x] Überwacher-Thread je Prozess (`Tasks::watch_process`): `wait`, kurz auf die Lese-Threads, dann `task_notification` (`completed`/`stopped`/`failed`, `summary` `Exit code <n>`, `output_file`) und der Hinweis fürs Modell; Eintrag entfernt.
- [x] Hintergrund-Aufrufe laufen nicht über `wait_for`: kein Warten, kein Zeitlimit, Esc betrifft sie nicht.

### Werkzeug `TaskStop` und Steueranfrage `stop_task`

- [x] `tools/task_stop.rs`; `TaskStop` in `permissions::decide` erlaubt.
- [x] `session.rs`, `stop_task` → `Tasks::stop`, `success` bzw. `error`.
- [x] Vor jeder Modellanfrage `take_notes()` (`turn::add_task_notes`): als `<system-reminder>`-Benutzer-Nachricht in die Anfrage und über `TurnEvent::Messages` ins Transkript.
- [x] Nach dem Ende der Hauptschleife (`Input::Closed`) `Tasks::stop_all()`.

### Doku

- [x] ADR 017, „Konsequenzen“: Hintergrundprozesse.
- [x] `docs/code-map.md`, Zeile „Autarker Agent“.
- [x] Commit `feat(standalone): Hintergrundprozesse und Scratchpad`.

## Report-Back

- **Treiber-Lauf** (`qwen3.8-27b…`, Modus Auto, Scratchpad per Variable): `ping -n 3 localhost` in PowerShell im Hintergrund → `init` mit `scratchpad_path`, `task_started` (`local_bash`, Beschreibung des Modells), Ergebnis im exakten Wortlaut, `task_notification` `completed` / `Exit code 0`, Ausgabe vollständig in der Datei. Die Antworten des Modells kamen nicht innerhalb der 300 s des Treibers (über 17 000 Token Prompt) — **nicht gefahren** sind damit: Hinweis im Verlauf bei der nächsten Nachricht, `TaskStop` durch das Modell, `stop_task`, Esc mit laufendem Hintergrundprozess, Panel im Verwalter. Alles davon steht in der Smoke-Liste der README (AK 11, Punkt 9).
- **Hinweis kommt nur mit einer Anfrage:** Endet ein Prozess nach der letzten Anfrage eines Turns, erfährt das Modell es erst mit der nächsten Benutzer-Nachricht — wie geplant, kein eigener Turn.
- **Hart abgeschossener Agent:** Beendet der Verwalter den Agenten per `kill` statt über das Ende der Standardeingabe (nur nach `KILL_GRACE`, wenn er hängt), bleiben dessen Hintergrundprozesse liegen. In ADR 017 benannt.
- **Nebenbefund (nicht Phase 6):** Umlaute in der Ausgabe von Windows-Programmen kommen in der OEM-Codepage (850) an und werden als UTF-8 gelesen — `ping` zeigt „ausgef�hrt“. Betrifft Vorder- und Hintergrund gleich (FINDINGS).
