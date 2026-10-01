# Phase 7 — Subagenten

Ziel: Das Modell kann über das Werkzeug `Agent` einen Subagenten mit eigenem Kontext beauftragen — im Vordergrund (Ergebnis kommt als Werkzeug-Ergebnis) oder im Hintergrund (Ergebnis kommt später als eigene Nachricht). Der Verwalter zeigt Subagenten und ihre Schritte im Hintergrund-Panel wie bei Claude.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Subagenten, Rechte, Gleichzeitigkeit, Grenzen), „Kontrakt“ (Aufgaben-Zeilen mit `local_agent`, `parent_tool_use_id`, `tool_use_result.resolvedModel`, Werkzeug `Agent`).
- Wie der Verwalter Subagenten liest: `src-tauri/src/agents/claude/translate.rs` (`handle_assistant` mit `parent_tool_use_id` → `subagent_events`; `handle_user` ignoriert Zeilen mit `parent_tool_use_id`, liest `resolvedModel`; `task_started` mit `local_agent`; `task_progress` mit `usage.tool_uses`; `task_notification`), `src-tauri/src/sessions/registry.rs` (`subagent_index`, `start_background`, `end_task`).
- Phase 2/3/5/6: Werkzeug-Schleife in `session.rs`, `permissions.rs`, `hooks.rs`, `compact.rs`, `tasks.rs`; Phase 4: `prompt.rs`, `memory.rs`, `skills::frontmatter::parse`.
- Agent-Definitionen des Benutzers: `%USERPROFILE%\.claude\agents\*.md` (Kopfdaten `name`, `description`, optional `tools` als Komma-Liste, optional `model`; Rest = Anweisung des Subagenten).
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — „Fortsetzungen melden den Gesamtstand, nicht den Zuwachs“: `task_progress.usage.tool_uses` ist der Gesamtstand des Subagenten, nicht der Zuwachs. „Hintergrund-Subagent friert ein, ohne tot zu sein“: Ende nur melden, wenn der Thread fertig ist.

## AK der Phase

- „Lass einen Subagenten alle TODO-Kommentare in `src/` zählen“ → das Panel zeigt unter „Subagenten“ einen Eintrag mit Beschreibung und wachsender Schrittzahl, die Schritte (Grep, Read …) sind darin sichtbar; der Hauptagent bekommt das Ergebnis und antwortet darauf.
- Dasselbe „im Hintergrund“ → der Hauptagent antwortet sofort mit der Startmeldung; wenn der Subagent fertig ist, steht im Panel „fertig“, und der Hauptagent bekommt eine neue Nachricht mit dem Ergebnis und antwortet von selbst darauf.
- Esc während eines Vordergrund-Subagenten → beide stoppen, Session „Pausiert“. „Stoppen“ im Panel bei einem Hintergrund-Subagenten → er stoppt, Panel „gestoppt“.
- Eine Rückfrage aus einem Subagenten (Modus „Manuell“, `Edit`) erscheint im Chat und wird ihm zugestellt — auch während der Hauptagent selbst auf eine Antwort wartet.
- Eine eigene Definition `%USERPROFILE%\.claude\agents\pruefer.md` mit `tools: Read, Grep` ist als `subagent_type: "pruefer"` aufrufbar; der Subagent bekommt nur diese Werkzeuge.
- Ein Subagent bekommt das Werkzeug `Agent` nicht.
- `pnpm check` grün.

## Checkliste

### Definitionen `standalone/agents.rs`

- [ ] `pub struct AgentDefinition { pub name: String, pub description: String, pub tools: Option<Vec<String>>, pub instructions: String }`. Eingebaut: `general-purpose` — Beschreibung „General-purpose agent for multi-step research and code changes.“, `tools: None`, Anweisung „You are a subagent. Complete the task you are given and finish with a concise report of what you found or changed; your final message is returned to the main agent.“
- [ ] `pub fn load(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Vec<AgentDefinition>`: eingebaut zuerst, dann `<home>\.claude\agents\*.md`, dann je `cwd`/`add_dir` `.claude\agents\*.md`; Kopfdaten über `skills::frontmatter::parse`; ohne `name` → Dateiname ohne Endung; späterer Eintrag gleichen Namens ersetzt den früheren; `tools` an `,` trennen und trimmen; `model` ignorieren.

### Schleife wiederverwendbar machen

- [ ] Die Werkzeug-Schleife aus `session.rs` in `standalone/turn.rs` herauslösen: `pub struct TurnSetup { pub system_prompt: String, pub tools: Vec<Value>, pub parent_tool_use_id: Option<String>, pub max_rounds: u32, pub cancel: Arc<AtomicBool> }`, `pub fn run(setup: &TurnSetup, messages: &mut Vec<Value>, shared: &Shared) -> TurnOutcome` mit `enum TurnOutcome { Done { text: String, tool_uses: u32 }, Aborted, Failed(String) }`. `Shared` bündelt, was alle Schleifen teilen: `Output`, `ToolContext`-Teile, `Hooks`, `Tasks`, Modus, Modell, Basis-URL, Fenster, Rückfrage-Vermittlung. Hauptagent: `parent_tool_use_id = None`, `max_rounds = 50`, Transkript schreibt `session.rs` wie bisher. Verhalten des Hauptagenten bleibt unverändert (Phase-2/3-AK erneut prüfen).
- [ ] Mit `parent_tool_use_id = Some(id)`: `assistant`-Zeilen mit diesem Wert und ohne `usage`; `user`-Zeilen mit Werkzeug-Ergebnissen ebenfalls mit diesem Wert; kein `result` (das schreibt nur der Hauptagent).
- [ ] Rückfrage-Vermittlung: statt eines einzelnen Kanals `Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>` — wer eine `can_use_tool`-Anfrage stellt, legt seinen Sender unter der `request_id` ab; die Hauptschleife leitet jede eingehende `control_response` an den Sender ihrer ID und entfernt ihn. So können Hauptagent und Subagenten gleichzeitig warten.

### Werkzeug `Agent` `standalone/tools/agent.rs`

- [ ] Schema nach Kontrakt; die Beschreibung listet die verfügbaren Typen je Zeile „- <name>: <description>“. Nur im Hauptagenten angeboten (in `tools::definitions` Parameter `for_subagent: bool`; bei `true` ohne `Agent`).
- [ ] Unbekannter `subagent_type` → Fehler „Unbekannter Subagent-Typ: <typ>. Verfügbar: <Namen>“.
- [ ] Werkzeuge des Subagenten: `tools` der Definition (Namen, die es nicht gibt, still weglassen) bzw. alle außer `Agent`. Systemprompt: `prompt::system_prompt` (Basis, Umgebung, Output-Style, Skills, Anweisungsdateien) + Abschnitt „# Subagent instructions“ mit `instructions`. Nachrichten: `[{"role":"user","content":<prompt>}]`. `max_rounds = 30`. Kontext voll → `compact` wie beim Hauptagenten.
- [ ] Aufgaben-ID `a` + 8 Hex-Zeichen. Vor dem Start `task_started` (`task_type: "local_agent"`, `tool_use_id` = ID des `Agent`-Aufrufs, `description`, `subagent_type`). Nach jeder Werkzeug-Runde `task_progress` mit der bisherigen Gesamtzahl der Werkzeug-Aufrufe. Am Ende `task_notification` mit `completed`/`failed`/`stopped` und `summary` = erste 200 Zeichen des letzten Texts bzw. des Fehlers.
- [ ] **Vordergrund:** läuft im Arbeits-Thread des Hauptagenten mit dessen `cancel`; Ergebnis des Werkzeugs = letzter Text des Subagenten (Fehler → `is_error`). Die `user`-Zeile der Runde trägt `"tool_use_result":{"resolvedModel":<modell>}`.
- [ ] **Hintergrund** (`run_in_background: true`): eigener Thread mit eigenem `cancel` (in `Tasks` als `TaskControl::Subagent`); sofortiges Ergebnis „Subagent läuft im Hintergrund (Aufgabe <id>). Sein Ergebnis kommt als eigene Nachricht, sobald er fertig ist.“. Beim Ende legt der Thread über einen Kanal der Hauptschleife eine Benutzer-Nachricht in die Schlange: „Background subagent <id> (<description>) finished (<status>):\n\n<letzter Text oder Fehler>“. Die Hauptschleife behandelt sie wie eine eingehende Nachricht (neuer Turn, sobald keiner läuft). Sie erscheint **nicht** als Benutzer-Eintrag im Verwalter (der Verwalter sieht nur die Antwort des Hauptagenten).
- [ ] Rechte für `Agent`: `Allow` (in `permissions::decide`). Hooks laufen für `Agent` und für jedes Werkzeug des Subagenten.

### Doku

- [ ] ADR 016, „Konsequenzen“: Subagenten sind nicht fortsetzbar (kein Transkript), nicht verschachtelbar, und die automatische Antwort auf einen fertigen Hintergrund-Subagenten erscheint im Verwalter ohne vorherige Benutzer-Nachricht. FINDINGS-Eintrag, falls der Status der Session dabei nicht auf „Läuft“ springt (Registry setzt „Läuft“ nur beim Senden).
- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `agents`, `turn`, `tools/agent`.
- [ ] Commit `feat(standalone): Subagenten im Vorder- und Hintergrund`.

## Report-Back
