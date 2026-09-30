# Phase 5 — Core: TL;DR erzeugen

Rating: heikel · Commit-Scope: `tldr`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „TL;DR“ unter „Festgelegte Entscheidungen“ (Aufruf, gemessene Werte, Eingabe, Speicherung, Stand des Vorhabens für die neue Session) und „Kontrakt“ (Typen, Commands, Ereignis `tldr://changed`, Spalten `tldr*`).
- [claude-stream-json.md](../../knowledge/claude-stream-json.md) — Abschnitt zum Hilfsprozess (warum nicht `--bare`, Abo-Anmeldung).
- Code: `src-tauri/src/agents/claude/helper.rs` (Muster: kurzlebiger `claude.exe`, Lese-Thread, `recv_timeout`, `kill` + `wait` in jedem Fall, `hide_console`), `src-tauri/src/agents/claude/locate.rs` (`find_claude`), `src-tauri/src/agents/event.rs` (`ChatEntry`, `TodoItem`, `TodoState`, `Question`, `ModelId::cli_id`), `src-tauri/src/filesystem/workspace.rs` (`data_dir`), `src-tauri/src/sessions/registry.rs` (`SessionState`, `restored`, `send`, `lock_loaded`, `update`, Ereignis-Konstanten, `ProjectState` aus Phase 1), `src-tauri/src/db/sessions.rs`, `src-tauri/src/db/projects.rs`, `src-tauri/src/sessions/model.rs`.
- Vault-Fehlerklassen: geprüft (SQLite, Claude Code) — keine einschlägig.

## Abnahmekriterien

1. **Erster Schritt, vor dem Code:** Den größten vorhandenen Verlauf (Session mit den meisten Chat-Einträgen in `%USERPROFILE%\.verwalter\verwalter.db`) einmal als Transkript nach den Regeln unten durch den Aufruf aus der README schicken (per kleinem Rust-`example` oder Skript im Scratchpad, nicht committen). Dauer, `usage` und ob `structured_output` kommt, in FINDINGS.md eintragen. Das Zeitlimit `TLDR_TIMEOUT` ist die gemessene Dauer × 3, mindestens 60 s, höchstens 300 s (Startwert ohne Messung: 120 s).
2. `tldr_session_create(sessionId)` kehrt sofort zurück und erstellt im Hintergrund das TL;DR der Session; `tldr://changed` kommt beim Start und beim Ende. Ein zweiter Aufruf, während einer läuft, tut nichts. Eine Session ohne Chat-Einträge oder im Status „Neu“ → Fehler `internal` mit „Diese Session hat noch keinen Verlauf.“; ohne Kommandozeile → `claudeNotFound`.
3. `tldr_session_load` liefert `SessionTldrView`; das TL;DR übersteht einen Neustart der App, `isRunning`/`error` nicht.
4. `tldr_project_create(projectId)` erstellt zuerst nacheinander die fehlenden TL;DRs aller Sessions mit Verlauf (nicht „Neu“, mindestens ein Eintrag), dann das TL;DR des Vorhabens aus allen vorhandenen Session-TL;DRs; `tldr://changed` beim Start und Ende jedes Teilschritts. Keine Session mit Verlauf → Fehler im `error` des Vorhabens „Noch keine Session mit Verlauf.“
5. `tldr_project_load` liefert `ProjectTldrView` mit allen Sessions des Vorhabens (nach Nummer) samt Kurzfassung und Laufzustand.
6. Die erste Nachricht an eine Session im Status „Neu“ trägt das TL;DR des Vorhabens voran, wenn es existiert und `carries_project_tldr` wahr ist (Standard); `tldr_set_carry` schaltet das. Der Name der Session entsteht weiter aus dem **getippten** Text, nicht aus dem vorangestellten Block.
7. Kein Lauf hinterlässt einen Prozess (auch nicht nach Zeitlimit), keiner öffnet ein Konsolenfenster; jeder Fehler landet als Satz in `error`.
8. `pnpm check` grün.

## Checkliste

### Einmal-Aufruf der Kommandozeile

- [ ] Neue Datei `src-tauri/src/agents/claude/print.rs` (Modul in `agents/claude/mod.rs`), Kopfkommentar „Kurzlebiger `claude.exe` im Druckmodus für eine einzige strukturierte Antwort, unabhängig von jeder Session.“:
  - `pub struct PrintRequest<'a> { pub model: ModelId, pub system_prompt: &'a str, pub json_schema: &'a str, pub input: &'a str }`
  - `pub fn run_print(exe: &Path, cwd: &Path, request: &PrintRequest<'_>, timeout: Duration) -> Result<Value, String>`
  - Kommando genau: `-p --model <model.cli_id()> --tools "" --safe-mode --strict-mcp-config --no-session-persistence --system-prompt <system_prompt> --json-schema <json_schema> --output-format json` (`--tools` nimmt mehrere Werte; der leere Wert wird mit `.arg("")` übergeben, das folgende `--safe-mode` beendet die Liste). `stdin`/`stdout` gepiped, `stderr` `Stdio::null()`, `current_dir(cwd)`, `hide_console`.
  - Ablauf: Kind starten; Lese-Thread liest `stdout` komplett in einen `String` und sendet ihn über einen Kanal (Muster `helper.rs`); `input` in `stdin` schreiben, `stdin` schließen (`drop`); `recv_timeout(timeout)`; danach **immer** `kill` + `wait` wie in `ask_once`.
  - Auswertung: JSON-Objekt; `is_error == true` → `Err(<Feld result als Text, sonst "Claude meldet einen Fehler">)`; `structured_output` ist ein Objekt → `Ok(structured_output)`; sonst `Err("Claude lieferte keine strukturierte Antwort")`. Zeitlimit → `Err("Claude antwortete nicht innerhalb von <s> s")`. Unlesbares JSON → `Err("Antwort von Claude nicht lesbar: <Fehler>")`.

### TL;DR-Modul

- [ ] Neues Modul `src-tauri/src/tldr/` (in `lib.rs` eintragen) mit:
  - `model.rs`: `SessionTldr`, `ProjectTldr`, `SessionTldrView`, `ProjectSessionTldr`, `ProjectTldrView`, `TldrChangedEvent` genau wie im Kontrakt; in `gen-bindings.rs` exportieren, `pnpm bindings`.
  - `prompt.rs`: Konstanten `SESSION_SYSTEM_PROMPT`, `SESSION_SCHEMA`, `PROJECT_SYSTEM_PROMPT`, `PROJECT_SCHEMA`, `TLDR_TIMEOUT` (nach AK 1). Schemas als JSON-Text: `{"type":"object","properties":{…je Feld {"type":"string"} bzw. {"type":"boolean"}…},"required":[alle Felder],"additionalProperties":false}` mit den serde-Namen `short, goal, done, ongoing, open, openNeedsUser` bzw. `summary, status, open, next, openNeedsUser`.
    - `SESSION_SYSTEM_PROMPT` wörtlich: „Du fasst den Verlauf einer Arbeitssitzung zwischen einem Entwickler (Nutzer) und einem Coding-Agenten (Claude) zusammen. Antworte auf Deutsch, knapp und sachlich, ohne Einleitung. short: ein Satz, höchstens 160 Zeichen, was die Session tut oder getan hat. goal: worum es geht, ein Satz. done: was erledigt ist, höchstens zwei Sätze. ongoing: woran zuletzt gearbeitet wurde und was noch läuft; leer, wenn nichts läuft. open: was offen ist; beginnt mit „Deine Entscheidung:“, wenn der Agent auf eine Entscheidung oder Antwort des Nutzers wartet; leer, wenn nichts offen ist. openNeedsUser: true genau dann, wenn open eine Entscheidung oder Antwort des Nutzers verlangt. Erfinde nichts, was nicht im Verlauf steht.“
    - `PROJECT_SYSTEM_PROMPT` wörtlich: „Du fasst ein Vorhaben zusammen, das aus mehreren nacheinander gelaufenen Arbeitssitzungen (Sessions) eines Entwicklers mit einem Coding-Agenten besteht. Du bekommst je Session ihre Nummer, ihren Namen, ihren Status und ihre Kurzfassung. Antworte auf Deutsch, knapp und sachlich, ohne Einleitung. summary: zwei Sätze, worum es geht und wo es steht. status: der Stand in einem Satz; nenne Sessions als #Nummer. open: das Wichtigste, was offen ist, mit #Nummer; leer, wenn nichts offen ist. next: der nächste sinnvolle Schritt in einem Satz; leer, wenn unklar. openNeedsUser: true genau dann, wenn open eine Entscheidung des Nutzers verlangt. Erfinde nichts.“
  - `transcript.rs`:
    - `pub fn session_transcript(entries: &[ChatEntry]) -> String`: je Eintrag ein Block, Blöcke mit Leerzeile getrennt: `User` → „Nutzer: <text>“ (mit Anhängen zusätzlich „ [Anhänge: <name>, <name>]“); `Text` → „Claude: <text>“; `Question` → „Rückfrage: <question> / <question> …“ und bei `answer` eine zweite Zeile „Antwort: <answer>“; `Error` → „Fehler: <title> – <text>“; `Thinking`, `Tool`, `Todos` → kein Block. Ganz am Ende, falls es einen `Todos`-Eintrag gibt, nur der **letzte** als „Aufgabenliste:“ und je Punkt eine Zeile „- [x] <label>“ (`Done`), „- [>] <label>“ (`Active`), „- [ ] <label>“ (`Todo`).
    - Obergrenze `MAX_TRANSCRIPT_CHARS = 300_000`, gezählt mit `chars().count()`. Darüber: erster `User`-Block (auf 20 000 Zeichen gekürzt, Rest „…“), dann „[… <n> Beiträge aus der Mitte ausgelassen …]“, dann so viele Blöcke vom Ende (Aufgabenliste eingeschlossen), wie in den Rest passen, in ursprünglicher Reihenfolge.
    - `pub fn project_input(sessions: &[(u32, String, SessionStatus, SessionTldr)]) -> String`: je Session „#<n> <Name> (<Status>)“ und darunter die Zeilen „Kurz: …“, „Ziel: …“, „Erledigt: …“, „Läuft: …“, „Offen: …“ (leere Felder weglassen); Status als deutsches Wort (`Läuft`, `Wartet`, `Pausiert`, `Abgeschlossen`, `Abgebrochen`, `Fehler`, `Startet`, `Neu`).
    - `pub fn carry_prefix(tldr: &ProjectTldr) -> String`: „Stand des Vorhabens (TL;DR):\n<summary>\nStand: <status>\nOffen: <open>\nAls Nächstes: <next>\n\n---\n\n“ (leere Felder samt Zeile weglassen).

### Speicherung

- [ ] Neue Datei `src-tauri/src/db/tldr.rs`: `save_session(connection, session_id, tldr_json: &str, at: f64, seq: u32)` (`UPDATE sessions SET tldr = ?2, tldr_at = ?3, tldr_seq = ?4 WHERE id = ?1`), `save_project(connection, project_id, tldr_json, at, sources: u32)` (`UPDATE projects SET tldr = …, tldr_at = …, tldr_sources = … WHERE id = …`).
- [ ] `db/sessions.rs`: `SessionRow` bekommt `tldr: Option<String>`, `tldr_at: Option<f64>`, `tldr_seq: Option<u32>`; `load_active` liest sie; `upsert` schreibt sie **nicht** (sie gehören `db/tldr.rs`).
- [ ] `db/projects.rs`: `ProjectRow` bekommt `tldr: Option<String>`, `tldr_at: Option<f64>`, `tldr_sources: Option<u32>`; `load_active` liest sie; `insert` schreibt sie nicht.

### Registry

- [ ] `SessionState` bekommt `tldr: Option<SessionTldr>`, `tldr_at: Option<f64>`, `tldr_seq: u32`, `tldr_running: bool`, `tldr_error: Option<String>`, `carries_project_tldr: bool` (in `new`: `None`, `None`, 0, `false`, `None`, `true`). `restored` liest die drei gespeicherten Felder; ein JSON, das sich nicht als `SessionTldr` lesen lässt, gilt als nicht vorhanden.
- [ ] `ProjectState` bekommt `tldr: Option<ProjectTldr>`, `tldr_at: Option<f64>`, `tldr_sources: u32`, `tldr_running: bool`, `tldr_error: Option<String>`; `restore` liest die gespeicherten Felder wie oben.
- [ ] Konstante `TLDR_CHANGED_EVENT = "tldr://changed"`; Hilfsfunktion `emit_tldr_changed(app, project_id, session_id: Option<&str>)`, Sendefehler ignoriert.
- [ ] `pub fn session_tldr_view(&self, session_id) -> Result<SessionTldrView, CommandError>` (unter `lock()`, `seq` = `tldr_seq`, 0 ohne TL;DR) und `pub fn project_tldr_view(&self, project_id) -> Result<ProjectTldrView, CommandError>` (erst Vorhaben-Sperre lesen und freigeben, dann je Session einzeln `lock()`).
- [ ] `pub fn start_session_tldr(&self, app: &AppHandle, session_id) -> Result<(), CommandError>`: `find_claude()` (fehlt → `ClaudeNotFound`); unter `lock_loaded()`: läuft schon → `Ok(())`; Status `New` oder keine Einträge → Fehler nach AK 2; sonst `transcript = session_transcript(&state.entries)`, `seq = state.entries.len() as u32`, `tldr_running = true`, `tldr_error = None`; Sperre frei; Ereignis; Thread `tldr-session` starten, der `run_session_tldr(app, session_id, exe, transcript, seq)` ausführt.
- [ ] Freie Funktion `fn run_session_tldr(app: &AppHandle, session_id: &str, exe: PathBuf, transcript: String, seq: u32)`: `run_print` mit Haiku, `SESSION_SYSTEM_PROMPT`, `SESSION_SCHEMA`, Arbeitsordner `data_dir(app)`; Ergebnis mit `serde_json::from_value::<SessionTldr>` lesen (Fehler → Text „Antwort von Claude nicht lesbar: …“); dann über `app.state::<SessionRegistry>()` die Session holen (inzwischen archiviert → nichts tun), unter `lock()` bei Erfolg `tldr`, `tldr_at = now_ms()`, `tldr_seq = seq` setzen und `db::tldr::save_session` aufrufen (Speicherfehler → `tldr_error`), bei Fehler `tldr_error` setzen; immer `tldr_running = false`; Sperre frei; Ereignis.
- [ ] `pub fn start_project_tldr(&self, app, project_id) -> Result<(), CommandError>`: `find_claude()`; unter der Vorhaben-Sperre: läuft schon → `Ok(())`, sonst `tldr_running = true`, `tldr_error = None`; frei; Ereignis; Thread `tldr-project`:
  1. Sessions des Vorhabens nach Nummer. Für jede, deren Status nicht `New` ist, die Einträge hat (`lock_loaded`) und kein `tldr` hat und nicht gerade läuft: wie `start_session_tldr` vorbereiten (Transkript, `seq`, `tldr_running`, Ereignis) und `run_session_tldr` **im selben Thread** ausführen.
  2. Alle Sessions mit `tldr` sammeln → `project_input`. Keine → `tldr_error` des Vorhabens nach AK 4.
  3. Sonst `run_print` mit `PROJECT_SYSTEM_PROMPT`/`PROJECT_SCHEMA`, Ergebnis als `ProjectTldr`; bei Erfolg Vorhaben-Felder setzen (`tldr_sources` = Anzahl der Eingabe-Sessions) und `db::tldr::save_project`; sonst `tldr_error`.
  4. Immer `tldr_running = false`, Ereignis.
- [ ] `pub fn set_carry(&self, session_id, carry: bool)`: setzt `carries_project_tldr` unter `lock()`.
- [ ] `send`: **vor** `update(…)` die Vorhaben-Sperre kurz nehmen und `carry = projects[project_id].tldr.as_ref().map(carry_prefix)` lesen (Sperre frei). In der Closure: ist `state.status == SessionStatus::New && state.carries_project_tldr` und `carry` gesetzt, geht `format!("{carry}{text}")` als Nachricht an den Agenten **und** als Text des Chat-Eintrags (`push_user`, `message_line`); die Namensregel aus Phase 2 benutzt weiter den ursprünglichen `text`.

### Commands und Doku

- [ ] Neue Datei `src-tauri/src/commands/tldr.rs` mit den fünf Commands aus dem Kontrakt (dünn auf die Registry); in `commands/mod.rs` und `lib.rs` eintragen.
- [ ] `docs/knowledge/claude-stream-json.md`: neuer Abschnitt „Einmal-Aufruf im Druckmodus (TL;DR)“ mit dem Kommando, der Messung aus README („Festgelegte Entscheidungen / TL;DR“) und der Messung aus AK 1, mit Datum und Claude-Code-Version.
- [ ] ADR 011, Abschnitt „TL;DR“: nur per Knopf; Haiku; abgespeckter Einmal-Aufruf statt Fortsetzen der Session (Fortsetzen lädt 110 k bis 650 k Tokens Kontext und passt ab 200 k nicht in Haiku); Eingabe nur Gesprächstext mit Obergrenze; Vorhaben aus Session-TL;DRs; Kosten unter 1 Cent je Session-TL;DR (API-Preise, bei Abo aus dem Kontingent).
- [ ] `docs/code-map.md`: neue Zeile „TL;DR“ (Core `src-tauri/src/tldr/` `model.rs`, `prompt.rs`, `transcript.rs`; `agents/claude/print.rs`; `commands/tldr.rs`; `db/tldr.rs`; Zustand in `sessions/registry.rs`); `docs/glossary.md` Eintrag **TL;DR** („Kurzfassung einer Session bzw. eines Vorhabens in drei, vier Zeilen, per Knopf von Haiku erstellt; zeigt, wie viele Einträge seither dazugekommen sind.“); `docs/conventions/commits.md`: Scope `tldr`.
- [ ] README dieses Plans: Phase 5 auf `complete`.

## Report-Back
