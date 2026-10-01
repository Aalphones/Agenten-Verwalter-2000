# Phase 5 — Kontext, Verdichten, Bilder, Druckmodus für TL;DR, Kontext-Aufschlüsselung; Doku

Ziel: Der Agent hält sich selbst im Kontextfenster (Verdichten), beantwortet die Kontext-Abfrage des Verwalters, liest Bilder per `Read`, berücksichtigt Modelle ohne Bildverständnis und liefert im Druckmodus die strukturierte Antwort für TL;DR. Doku und Abschluss des ganzen Plans macht Phase 9.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“, „Kontrakt“ (Druckmodus-Zeile, `get_context_usage`), „Finale Abnahmekriterien“, „Smoke-Checkliste“.
- Phase 1–4: `standalone/session.rs`, `llm.rs` (`response_format`, `prompt_tokens`), `transcript.rs` (`rewrite`), `content.rs`, `prompt.rs` (`MemoryFile`), `tools/read.rs`, `tools/mod.rs` (`definitions`).
- Format der Kontext-Aufschlüsselung, wie der Verwalter sie liest: `src-tauri/src/agents/claude/stats.rs` (`RawContext`: `categories[{name,tokens,kind}]` mit `kind` `used`/`free`, `totalTokens`, `maxTokens`, `model`, `memoryFiles[{path,tokens}]`, `autoCompactThreshold`, `isAutoCompactEnabled`); deutsche Namen der Kategorien in `src/features/context/categoryLabels.ts` (`System prompt`, `System tools`, `Memory files`, `Skills`, `Messages`, `Free space`, `Autocompact buffer`).
- TL;DR heute: `src-tauri/src/sessions/registry/tldr.rs` (`start_session_tldr`, `start_project_tldr`, `ask_haiku`), `src-tauri/src/agents/claude/print.rs` (`PrintRequest`, `print_command`, `structured_output`), `src-tauri/src/tldr/prompt.rs` (`TLDR_TIMEOUT` 90 s).
- Aus dem Vorgängerplan: `src-tauri/src/lmstudio/model.rs` (`LocalModelKind::Vlm`), `src-tauri/src/agents/claude/local.rs` (`resolve`, `apply`).
- Fehlerklassen: Vault `werkzeuge/claude-code.md` — „Fortsetzungen melden den Gesamtstand, nicht den Zuwachs“: `prompt_tokens` einer Antwort ist der ganze Kontext, nicht der Zuwachs — nie aufsummieren (unten).

## AK der Phase

- Finale AK 9 und 10 der README sind erfüllt (Verdichten, Bild, TL;DR).
- Das Kontext-Fenster (Klick auf den Donut) zeigt in „Autark“ die Kategorien Systemprompt, Systemwerkzeuge, Memory-Dateien, Skills, Nachrichten, Freier Platz mit plausiblen Zahlen und die Liste der Anweisungsdateien.
- Mit einem geladenen `llm`-Modell (ohne Bild) bekommt das Modell statt eines angehängten Bilds den Satz „[Bild weggelassen: das geladene Modell versteht keine Bilder]“; `Read` auf ein Bild liefert einen Fehler mit derselben Aussage.
- Im Task-Manager startet in „Autark“ auch für TL;DR keine `claude.exe` (finale AK 2).
- `pnpm check` grün.

## Checkliste

### Kontext und Verdichten `standalone/compact.rs`

- [ ] Stand in `session.rs`: `context_tokens: u32` = `prompt_tokens + completion_tokens` der letzten Antwort (fehlen sie: Zeichen aller gesendeten Nachrichten samt Systemprompt / 4). **Ersetzen, nie addieren.** Diesen Wert meldet auch die `assistant`-Zeile als `input_tokens`.
- [ ] Vor jeder Modellanfrage: Schätzung = `context_tokens` + Zeichen der seither angehängten Nachrichten / 4. Über 80 % von `VERWALTER_AGENT_CONTEXT_WINDOW` → erst verdichten.
- [ ] `pub fn compact(base_url, model, system_prompt, messages: &[Value], cancel) -> Result<Vec<Value>, LlmError>`:
  - Schwanz = alle Nachrichten ab der letzten `user`-Nachricht, die kein Werkzeug-Ergebnis ist (der laufende Turn mit seinen `tool_calls`/`tool`-Paaren); Kopf = alles davor. Kopf leer → Werkzeug-Ergebnisse im Schwanz auf je 2 000 Zeichen kürzen (Hinweis „… gekürzt beim Verdichten“) und zurückgeben.
  - Anfrage ohne Werkzeuge: System „You compress a coding session so that work can continue. Write a summary with these headings: Task, Decisions, Files touched, Current state, Next steps, Open questions. At most 1 500 words.“ + Kopf als Nachrichten + Benutzer-Nachricht „Summarize the conversation above.“
  - Ergebnis = `[{"role":"user","content":"Summary of the earlier conversation (compacted):\n\n<summary>"}, {"role":"assistant","content":"Understood — continuing from the summary."}]` + Schwanz.
- [ ] `session.rs`: nach erfolgreichem Verdichten `transcript.rewrite(neu)`, `context_tokens` neu schätzen, stderr-Zeile „Verdichtet: <alt> → <neu> Token“, Zeile `{"type":"system","subtype":"compact_boundary"}` ausgeben (der Verwalter ignoriert sie, sie steht im Protokoll). Scheitert das Verdichten → `result_error` „Kontext voll und Verdichten fehlgeschlagen: <Grund>“.

### Kontext-Aufschlüsselung

- [ ] `get_context_usage` in `session.rs` beantworten mit `control_success` und einem Objekt nach `RawContext`: Kategorien `System prompt` (Basis-Prompt + Umgebung + Output-Style), `System tools` (JSON der Werkzeug-Definitionen), `Memory files` (Summe aus `MemoryFile`), `Skills` (Skill-Liste im Prompt), `Messages` (Transkript), alle `kind: "used"`; `Free space` = Fenster − Summe, `kind: "free"`, nicht negativ. `totalTokens` = Summe der genutzten, `maxTokens` = Fenster, `model`, `memoryFiles` je Datei, `autoCompactThreshold` = 80 % des Fensters, `isAutoCompactEnabled: true`. Schätzung Zeichen / 4.

### Bilder

- [ ] `agents/claude/local.rs`: `LocalBackend` um `pub vision: bool` (aus `LocalModel.kind == Vlm` in `resolve`); `apply` setzt bei `Standalone` zusätzlich `VERWALTER_AGENT_VISION` = `1` bzw. `0`.
- [ ] `content.rs`: ohne Bildverständnis wird jeder Bildblock zu `{"type":"text","text":"[Bild weggelassen: das geladene Modell versteht keine Bilder]"}`.
- [ ] `tools/read.rs`: Endungen `png`, `jpg`, `jpeg`, `gif`, `webp` (ohne Groß-/Kleinschreibung): ohne Bildverständnis Fehler „Das geladene Modell versteht keine Bilder.“; über 5 MB Fehler „Bild zu groß (über 5 MB).“; sonst Ergebnis „Bild <Pfad> (<Größe>) folgt als Bild in der nächsten Nachricht.“ und das Bild als Base64 im `ToolOutput` (neues Feld `pub image: Option<(String, String)>` = Medientyp, Daten). `session.rs` hängt nach den `tool`-Nachrichten der Runde je Bild eine Nachricht `{"role":"user","content":[{"type":"text","text":"Image from Read: <Pfad>"},{"type":"image_url","image_url":{"url":"data:<typ>;base64,<daten>"}}]}` ans Transkript (Werkzeug-Nachrichten tragen im OpenAI-Format keine Bilder).

### Druckmodus `standalone/print.rs`

- [ ] `pub fn run(args: &AgentArgs) -> i32`: Umgebung wie im Sitzungsmodus; stdin vollständig lesen; Nachrichten `[{"role":"system","content":<--system-prompt>}, {"role":"user","content":<Eingabe>}]`; ohne Werkzeuge; bei `--json-schema` `response_format` = `{"type":"json_schema","json_schema":{"name":"answer","strict":true,"schema":<geparstes Schema>}}`. Antworttext als JSON parsen: Objekt → `{"type":"result","subtype":"success","is_error":false,"result":<text>,"structured_output":<objekt>}`; sonst `is_error: true`, `result` „Antwort ist kein JSON-Objekt“. LM-Studio-Fehler → `is_error: true` mit dem Satz. Eine Zeile auf stdout, Exit 0. `mod.rs` ruft `print::run` statt der Platzhalter-Meldung aus Phase 1.
- [ ] Core: `PrintRequest` um `pub leading_args: &'a [String]`; `print_command` hängt sie direkt nach `Command::new` an.
- [ ] `sessions/registry/tldr.rs`: Hilfsfunktion `fn print_program(app: &AppHandle) -> Result<(PathBuf, Vec<String>, Option<LocalBackend>), CommandError>` — Einstellungen laden, `local::resolve`; `Standalone` → `(standalone::program()?, standalone::leading_args(), backend)`, sonst `(find_claude().ok_or(CommandError::ClaudeNotFound)?, vec![], backend)`. `start_session_tldr` und `start_project_tldr` ersetzen ihr `find_claude()` durch `print_program`; `ask_haiku` bekommt das Tupel statt `exe` und baut `PrintRequest` mit `leading_args` und `local`. Die Sperre „TL;DR folgt …“ aus Phase 1 entfällt. Die Variante B des Vorgängerplans („nicht verfügbar“) gilt nur noch für `ClaudeCodeLocal`, falls sie dort gebaut wurde.

### Doku

- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `compact`, `print`, Bilder in `content`/`tools/read`, `print_program` in `sessions/registry/tldr.rs`; Zeile „TL;DR“ um den Weg über den eigenen Agenten ergänzen.
- [ ] Commit `feat(standalone): Verdichten, Kontext-Aufschlüsselung, Bilder und TL;DR`.

## Report-Back
