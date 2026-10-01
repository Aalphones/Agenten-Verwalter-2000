# Phase 3 — Shell, Rechte, Rückfragen, Hooks

Ziel: Der Agent führt Befehle in Git Bash und PowerShell aus, fragt je nach Modus und Pfad über die Rückfrage des Verwalters nach, stellt dem Benutzer mit `AskUserQuestion` Auswahlfragen und beachtet die PreToolUse-Hooks des Benutzers. Damit ist die Sicherheitsgrenze dieselbe wie im Verwalter mit Claude, außer dem fehlenden Klassifizierer im Modus Auto.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Rechte, Pfadgrenze, Hooks, Gleichzeitigkeit) und „Kontrakt“ (`can_use_tool`, `control_response` mit `allow`/`deny`, Werkzeug-Tabelle `Bash`, `PowerShell`, `AskUserQuestion`).
- Phase 1/2: `standalone/session.rs` (Hauptschleife, Arbeits-Thread, `cancel`), `standalone/tools/` (`ToolContext`, `run`), `standalone/paths.rs` (`Access`).
- Wie der Verwalter Rückfragen stellt und beantwortet: `src-tauri/src/agents/claude/translate.rs` (`handle_control_request`, `ask_user_questions`, `permission_question`), `src-tauri/src/sessions/registry.rs` (`answer_line`: `AskUserQuestion` bekommt `updatedInput.answers` als Objekt Frage → Antwort; `interrupt_agent` lehnt offene Rückfragen selbst ab).
- Hook-Vertrag von Claude Code (Eingabe-JSON auf stdin, Exit 2 blockiert, `hookSpecificOutput.permissionDecision`): https://code.claude.com/docs/en/hooks — beim Umsetzen gegen die Seite prüfen; die Felder unten sind der Teil, den dieser Plan unterstützt.
- Hooks des Benutzers liegen in `%USERPROFILE%\.claude\settings.json` unter `hooks.PreToolUse` (Matcher z. B. `Edit|Write|MultiEdit`, `Skill`, `Bash`; Befehle der Form `bash -c "bash ~/.claude/…/x.sh"`).
- `src-tauri/src/processes/` (`hide_console`).
- Fehlerklassen: Vault-Topic Windows (`windows.md`) — PowerShell 5.1 gibt umgeleitete Ausgabe in der Konsolen-Codepage aus (Umlaute kaputt) → Ausgabe-Kodierung im Befehl auf UTF-8 setzen (unten); `bash.exe` im PATH kann WSL statt Git Bash sein → nie blind `bash.exe` aus dem PATH nehmen (unten). Vault `werkzeuge/claude-code.md`, „Abgebrochener Werkzeug-Aufruf kann bereits gelaufen sein“: ein abgebrochener Befehl kann Wirkung gehabt haben — das Ergebnis an das Modell sagt deshalb „unterbrochen“, nie „nicht ausgeführt“.

## AK der Phase

- Modus „Manuell“: `Edit` und `Bash` erscheinen als Rückfrage im Chat; „Erlauben“ führt aus, „Ablehnen“ mit Text gibt dem Modell „Der Benutzer hat abgelehnt: <Text>“ und es antwortet darauf.
- Modus „Auto“: `Bash` `git status` läuft ohne Rückfrage; Ausgabe und Exit-Code stehen im Chat wie bei Claude (Befehl mit Exit-Code ≠ 0 zeigt den Code).
- Modus „Planen“: `Write` wird mit dem Satz aus der README abgelehnt, ohne Rückfrage.
- `Read` auf `C:\Windows\win.ini` → Rückfrage in jedem Modus; erlaubt → Inhalt.
- `PowerShell` `Write-Output 'Grüße'` liefert „Grüße“ mit Umlaut.
- `Bash` `sleep 30` + Esc → binnen 2 s „Pausiert“, kein `bash.exe`/`sleep.exe` aus diesem Aufruf mehr im Task-Manager.
- „Stell mir eine Auswahlfrage mit drei Optionen“ → die Rückfrage-Karte mit Optionen erscheint; die gewählte Antwort kommt beim Modell an.
- Testhook (Smoke 3 der README) blockiert `Write`; ein Hook, der mit Exit 1 scheitert, blockiert nicht und steht im Session-Protokoll.
- `pnpm check` grün.

## Checkliste

### Shell `standalone/tools/shell.rs`

- [ ] `fn bash_path() -> Result<PathBuf, String>`: Umgebungsvariable `VERWALTER_BASH_PATH`, wenn die Datei existiert; sonst `C:\Program Files\Git\bin\bash.exe`, wenn vorhanden; sonst im `PATH` nach `git.exe` suchen und bei `…\Git\cmd\git.exe` bzw. `…\Git\bin\git.exe` den Pfad `…\Git\bin\bash.exe` nehmen, wenn vorhanden; sonst Fehler „Git Bash nicht gefunden — Umgebungsvariable VERWALTER_BASH_PATH auf bash.exe setzen.“. Nie `bash.exe` direkt aus dem `PATH` (kann WSL sein).
- [ ] `pub fn run(kind: ShellKind, input: &Value, ctx: &ToolContext) -> ToolOutput` mit `ShellKind { Bash, PowerShell }`: `command` Pflicht; `timeout` in ms, Standard 120 000, höchstens 600 000. Bash: `<bash> -c <command>`; PowerShell: `powershell.exe -NoProfile -NonInteractive -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; <command>"`. Arbeitsordner `ctx.cwd`, stdin `null`, stdout und stderr über je einen Lese-Thread in einen gemeinsamen Puffer, `hide_console`.
- [ ] Warten in 50-ms-Schritten (`try_wait`), dabei `ctx.cancel` und Zeitlimit prüfen. Abbruch oder Zeitlimit → `taskkill /PID <pid> /T /F` (mit `hide_console`, beendet auch Kindprozesse), dann `wait`. Ergebnis: Abbruch → „Vom Benutzer unterbrochen. Der Befehl kann teilweise ausgeführt worden sein.“ (`is_error`); Zeitlimit → „Exit code 124\nZeitlimit von <s> s überschritten.\n<Ausgabe>“ (`is_error`); Exit ≠ 0 → „Exit code <n>\n<Ausgabe>“ (`is_error`); sonst die Ausgabe oder „(keine Ausgabe)“.
- [ ] In `tools::definitions()` und `tools::run` `Bash` und `PowerShell` ergänzen (Beschreibung englisch: Windows, Git Bash bzw. PowerShell 5.1, Arbeitsordner, Zeitlimit, keine Hintergrundprozesse).

### Rechte `standalone/permissions.rs`

- [ ] `pub enum Decision { Allow, Ask, Deny(String) }`; `pub fn decide(tool: &str, mode: Mode, access: Option<Access>) -> Decision` (`access` = Ergebnis von `Roots::access` für `file_path`/`path` des Aufrufs, `None` bei Werkzeugen ohne Pfad), genau nach README „Rechte“ und „Pfadgrenze“: `Outside` → `Ask` (alle Werkzeuge, alle Modi); schreibend auf `ReadOnly` → `Deny("Nur lesbar: …")`; `Read`/`Glob`/`Grep`/`TodoWrite`/`Skill` → `Allow`; `Write`/`Edit`: `Manual` → `Ask`, `Edit`/`Auto` → `Allow`, `Plan` → `Deny("Im Modus Planen sind keine Änderungen erlaubt.")`; `Bash`/`PowerShell`: `Auto` → `Allow`, sonst `Ask`; `AskUserQuestion` → `Ask`.
- [ ] Die Datei-Werkzeuge aus Phase 2 bekommen einen Parameter `allow_outside: bool`; nach einer erlaubten Rückfrage für `Outside` läuft das Werkzeug mit `true` (keine Fehlermeldung „außerhalb“ mehr).
- [ ] `session.rs`: `mode` als `Arc<Mutex<Mode>>`, damit `set_permission_mode` auch den laufenden Turn erreicht.

### Rückfrage-Fluss in `session.rs`

- [ ] Vor jedem Werkzeug-Aufruf: erst Hooks (unten), dann `permissions::decide`, außer ein Hook hat `Allow` (dann ohne Rückfrage) oder `Ask` (dann Rückfrage erzwingen) geliefert.
- [ ] `Ask`: `can_use_tool`-Zeile mit `request_id` `agent-<laufende Nummer>`, `tool_name`, `input`. Der Arbeits-Thread wartet auf einem eigenen Kanal `answers` (Paare Request-ID → `response`-Objekt); die Hauptschleife leitet jede eingehende `control_response` mit `subtype: success` dorthin weiter. Warten in 50-ms-Schritten mit `cancel`-Prüfung.
- [ ] `behavior: allow` → mit `updatedInput` (falls vorhanden, sonst ursprüngliche Eingabe) ausführen. `behavior: deny` → Ergebnis „Der Benutzer hat abgelehnt: <message>“ (`is_error`). `cancel` während des Wartens → „Vom Benutzer unterbrochen.“ und Turn-Abbruch wie in Phase 2.
- [ ] `Deny(text)` → Ergebnis `text` (`is_error`), ohne Rückfrage.

### AskUserQuestion `standalone/tools/ask.rs`

- [ ] Schema nach Kontrakt. Läuft nur nach erlaubter Rückfrage: `updatedInput.answers` ist ein Objekt Frage → Antwort; Ergebnis je Frage eine Zeile „<Frage>: <Antwort>“. Fehlt `answers` → Fehler „Keine Antwort erhalten.“

### Hooks `standalone/hooks.rs`

- [ ] `pub struct Hooks { entries: Vec<HookEntry> }`, `struct HookEntry { matcher: Option<Regex>, command: String, timeout: Duration }`. `pub fn load(cwd: &Path, add_dirs: &[PathBuf]) -> Hooks`: Dateien nach README in dieser Reihenfolge lesen; je Datei `hooks.PreToolUse[]` mit `matcher` (leer oder `*` → `None` = alle, sonst `Regex::new(&format!("^(?:{matcher})$"))`, ungültig → überspringen mit stderr-Zeile) und `hooks[]` mit `type == "command"`, `command`, `timeout` (Sekunden, Standard 60). Fehlende Datei → still überspringen; unlesbare → stderr-Zeile.
- [ ] `pub enum HookVerdict { None, Allow, Ask, Deny(String) }`; `pub fn pre_tool_use(&self, session_id: &str, cwd: &Path, transcript_path: &Path, tool: &str, input: &Value) -> HookVerdict`: für jeden passenden Eintrag `<bash_path()> -c <command>` im Arbeitsordner, stdin = `{"session_id","transcript_path","cwd","hook_event_name":"PreToolUse","tool_name","tool_input"}`, Zeitlimit wie oben (Abbruch per `taskkill /T /F`). Exit 2 → `Deny(<stderr getrimmt, leer → "Von einem Hook blockiert.">)` und sofort zurück. Exit 0 und stdout beginnt mit `{`: `hookSpecificOutput.permissionDecision` `deny` → `Deny(<permissionDecisionReason>)`, `allow` → merken, `ask` → merken; alternativ `{"decision":"block","reason":…}` → `Deny(reason)`. Anderer Exit-Code oder Git Bash fehlt → stderr-Zeile „Hook fehlgeschlagen (<exit>): <command>“, weiter. Ergebnis: `Ask` vor `Allow` vor `None`.
- [ ] `session.rs`: `Hooks::load` beim Start; Aufruf vor jeder Werkzeug-Ausführung (Schritt 1 im Rückfrage-Fluss).

### Doku

- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `permissions`, `hooks`, `tools/shell`, `tools/ask` ergänzen.
- [ ] `AGENTS.md`, Tabelle „Befehle“: Zeile `VERWALTER_BASH_PATH` — „Pfad zu `bash.exe` von Git für den Agenten der Betriebsart „Autark“, falls Git nicht unter `C:\Program Files\Git` liegt“.
- [ ] Commit `feat(standalone): Shell, Rechte, Rückfragen und PreToolUse-Hooks`.

## Report-Back
