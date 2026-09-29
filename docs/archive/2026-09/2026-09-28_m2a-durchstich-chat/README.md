# Meilenstein 2a — Durchstich & Chat

Ziel: In der App eine Session anlegen, mit Claude chatten, Werkzeug-Aktivität und Gedankengang sehen, Rückfragen und Rechte-Abfragen per Knopf beantworten, pausieren, fortsetzen, abbrechen, nach einem Absturz neu starten, Modell, Modus und Denkaufwand wechseln — alles nach dem abgenommenen Entwurf. Der Agent arbeitet in einem leeren Ordner pro Session; Repositories und Worktrees kommen mit Meilenstein 3, Speichern über einen Neustart hinweg mit Meilenstein 4.

Nicht in diesem Plan (eigener Plan **M2b**): Anhänge, `/`-Menü und Skills, Hintergrund-Panel mit Prozessen und Subagenten, Subagent- und Hintergrund-Zeilen im Verlauf.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 003](../../decisions/003-claude-anbindung.md), [knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Claude-Prozess & Protokoll im Core | [phase-1-protokoll-und-prozess.md](phase-1-protokoll-und-prozess.md) | heikel | complete |
| 2 | Sessions, Commands & Events | [phase-2-sessions-und-commands.md](phase-2-sessions-und-commands.md) | standard | complete |
| 3 | App-Rahmen, Leerzustand, Neue Session | [phase-3-rahmen-und-neue-session.md](phase-3-rahmen-und-neue-session.md) | standard | complete |
| 4 | Chat-Verlauf | [phase-4-chat-verlauf.md](phase-4-chat-verlauf.md) | heikel | complete |
| 5 | Markdown & Code-Blöcke | [phase-5-markdown-und-codebloecke.md](phase-5-markdown-und-codebloecke.md) | standard | complete |
| 6 | Eingabeleiste & Steuerung | [phase-6-eingabeleiste-und-steuerung.md](phase-6-eingabeleiste-und-steuerung.md) | standard | complete |

Umsetzung direkt auf `main`, ein Commit pro Phase, `pnpm check` vor jedem Commit grün. Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

- **Anbindung:** Claude-Kommandozeile im Stream-Modus, direkt aus dem Core ([ADR 003](../../decisions/003-claude-anbindung.md)). Die App-Session-ID ist zugleich Claudes Session-ID.
- **Arbeitsordner:** `<Benutzerordner>\.verwalter\workspaces\<session-id>\`, von der App leer angelegt, `cwd` des Agenten. Keine Repositories in diesem Plan.
- **Speicher:** Sessions und Chat-Einträge liegen in diesem Plan **im Speicher des Core**, nicht in SQLite und nicht im React-State. Die Schnittstelle (seitenweises Lesen per `chat_history`) ist schon die, die Meilenstein 4 mit SQLite hinterlegt. Nach einem App-Neustart sind die Sessions weg — bewusst, bis M4.
- **Status-Maschine** (ersetzt die Liste im Glossar):

  | Status | Anzeige | Sidebar-Gruppe | Wann |
  |---|---|---|---|
  | `starting` | Startet | Läuft | Prozess gestartet, noch kein `system/init` |
  | `running` | Läuft | Läuft | Agent arbeitet an einer Antwort |
  | `waiting` | Wartet | Braucht dich | offene Rückfrage oder Rechte-Abfrage |
  | `paused` | Pausiert | Läuft | nach Pause/Esc, nach „Agent neu starten“ |
  | `completed` | Abgeschlossen | Abgeschlossen | Antwort fertig (`result`), Agent wartet auf die nächste Nachricht |
  | `cancelled` | Abgebrochen | Abgeschlossen | nach „Abbrechen“; nimmt keine Nachrichten mehr an |
  | `error` | Fehler | Braucht dich | Prozess unerwartet beendet oder `result` mit Fehler |

  `CREATED` und `INTERRUPTED` aus dem Glossar entfallen: eine Unterbrechung ist `paused`.
- **Pause und Esc sind dieselbe Aktion:** Unterbrechung der laufenden Antwort, danach `paused`. „Fortsetzen“ schickt die Nachricht `Mach weiter.`; jede eigene Nachricht setzt ebenfalls fort.
- **Abbrechen:** Unterbrechung, dann stdin schließen, nach 5 s Prozess beenden. Status `cancelled`, Eingabe gesperrt.
- **Denkaufwand-Wechsel** wird vorgemerkt und vor der nächsten gesendeten Nachricht durch Neustart mit `--resume` angewendet; Modell und Modus wirken sofort per Steueranfrage.
- **Standardwerte einer neuen Session:** Sonnet 5, Denkaufwand Hoch, Modus Auto (wie im Entwurf).
- **Keine Wegwerf-Oberfläche:** Was in diesem Plan fehlt, fehlt ganz (kein toter Knopf): Reiter „Changes“ und „Artefakte“ (M5), Hintergrund-Knopf, `+`, `/` (M2b), ⋯-Menü und Umbenennen (M4), Einstellungen-Knopf (M6), Schritt 2 „Repositories“ in Neue Session (M3). Leerzustand und Neue Session übernimmt dieser Plan vom Entwurf (dort M4 bzw. M3 zugeordnet) — Tafel-Tabelle im Entwurf wird in Phase 3 nachgezogen.
- **Sidebar-Liste noch nicht virtualisiert** — das ist Meilenstein 6 („virtuelle Listen“). Der Chat-Verlauf wird ab jetzt virtualisiert.
- **Antworten als Markdown** (`react-markdown` + `remark-gfm`, kein rohes HTML), Code-Blöcke mit Sprache, Syntaxfarben nach VS Code Dark+ / Light+ und Knopf „Kopieren“; Links öffnen im Standardbrowser. Keine Tafel im Entwurf — freihändig nach Phase 5. Eigene Nachrichten und Gedankengang bleiben Klartext.

## Kontrakt Core ↔ Oberfläche

Alle Typen entstehen in Rust mit `derive(Serialize, Deserialize, TS)` und `#[serde(rename_all = "camelCase")]`, werden in `src-tauri/src/bin/gen-bindings.rs` eingetragen und per `pnpm bindings` nach `src/lib/bindings/` erzeugt. Enums mit Nutzlast: `#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]` — `rename_all` benennt nur die Varianten um, die Felder (`tool_use_id` → `toolUseId`) braucht `rename_all_fields`. Einfache Enums: `#[serde(rename_all = "camelCase")]`. Zeitpunkte: Millisekunden seit 1970 als `f64` (TS `number`), Zähler `u32`.

### Typen (`src-tauri/src/agents/event.rs` und `src-tauri/src/sessions/model.rs`)

```rust
// agents/event.rs — anbieterneutral
pub enum ModelId { Fable, Opus, Sonnet, Haiku }                 // "fable" | "opus" | "sonnet" | "haiku"
pub enum Effort { Low, Medium, High, Xhigh, Max }               // "low" … "max"
pub enum Mode { Manual, Edit, Plan, Auto }                      // "manual" | "edit" | "plan" | "auto"
pub enum ToolState { Running, Done, Failed, Interrupted }
pub enum TodoState { Done, Active, Todo }
pub struct TodoItem { pub label: String, pub state: TodoState }
pub struct QuestionOption { pub label: String, pub hint: String }
pub struct Question { pub question: String, pub options: Vec<QuestionOption>, pub multi_select: bool }
pub enum QuestionKind { AskUser, Permission }

pub enum ChatEntry {                                              // tag = "kind"
    User { seq: u32, text: String, sent_at: f64 },
    Text { seq: u32, text: String },
    Thinking { seq: u32, text: String, seconds: u32 },
    Tool { seq: u32, tool_use_id: String, tool: String, target: String, state: ToolState },
    Todos { seq: u32, items: Vec<TodoItem> },
    Question { seq: u32, request_id: String, question_kind: QuestionKind, questions: Vec<Question>, answer: Option<String> },
    Error { seq: u32, title: String, text: String },
}

pub enum QuestionAnswer {                                         // tag = "kind"
    Options { answers: Vec<String> },   // eine Antwort je Frage, in Reihenfolge von `questions`
    Allow,
    Deny { message: String },
}

// sessions/model.rs
pub enum SessionStatus { Starting, Running, Waiting, Paused, Completed, Cancelled, Error }
pub struct SessionSummary {
    pub id: String, pub name: String, pub status: SessionStatus,
    pub model: ModelId, pub effort: Effort, pub mode: Mode,
    pub created_at: f64, pub running_ms: f64, pub running_since: Option<f64>,
    pub context_used: u32, pub context_window: u32,
}
pub struct ChatPage { pub entries: Vec<ChatEntry>, pub has_more: bool }
pub struct ChatEntryEvent { pub session_id: String, pub entry: ChatEntry }
```

`seq` ist der Index des Eintrags in der Session (0, 1, 2 …). Ein geänderter Eintrag (Werkzeug fertig, Aufgabenliste aktualisiert, Rückfrage beantwortet) behält seine `seq` und wird erneut gesendet.

### Tauri Commands

| Command (`commands/<datei>.rs`) | Parameter | Rückgabe | Wrapper (`src/lib/<datei>.ts`) |
|---|---|---|---|
| `session_create` (sessions) | `task: String, model: ModelId, effort: Effort, mode: Mode` | `SessionSummary` | `createSession` |
| `session_list` (sessions) | — | `Vec<SessionSummary>`, neueste zuerst | `listSessions` |
| `session_pause` (sessions) | `session_id: String` | `()` | `pauseSession` |
| `session_resume` (sessions) | `session_id` | `()` | `resumeSession` |
| `session_cancel` (sessions) | `session_id` | `()` | `cancelSession` |
| `session_restart` (sessions) | `session_id` | `()` | `restartSession` |
| `session_set_model` (sessions) | `session_id, model: ModelId` | `()` | `setSessionModel` |
| `session_set_mode` (sessions) | `session_id, mode: Mode` | `()` | `setSessionMode` |
| `session_set_effort` (sessions) | `session_id, effort: Effort` | `()` | `setSessionEffort` |
| `session_log` (sessions) | `session_id` | `Vec<String>` (höchstens 300 Zeilen) | `getSessionLog` |
| `chat_history` (chat) | `session_id, before: Option<u32>, limit: u32` | `ChatPage` | `getChatHistory` |
| `chat_send` (chat) | `session_id, text: String` | `()` | `sendMessage` |
| `chat_answer` (chat) | `session_id, request_id: String, answer: QuestionAnswer` | `()` | `answerQuestion` |

Tauri übersetzt snake_case-Parameter auf JS-Seite nach camelCase (`sessionId`, `requestId`); die Wrapper übergeben `{ sessionId, … }`.

### Tauri Events

| Name | Nutzlast | Wann |
|---|---|---|
| `session://changed` | `SessionSummary` | jede Änderung an Status, Name, Modell, Modus, Denkaufwand, Kontext, Laufzeit-Feldern |
| `chat://entry` | `ChatEntryEvent` | neuer oder geänderter Chat-Eintrag |

Wrapper: `onSessionChanged(cb): Promise<UnlistenFn>` in `src/lib/sessions.ts`, `onChatEntry(cb): Promise<UnlistenFn>` in `src/lib/chat.ts`.

### Fehler (`src-tauri/src/error.rs`, Varianten ergänzen)

`SessionNotFound(String)`, `ClaudeNotFound`, `SessionClosed` (Session abgebrochen), `AgentStopped` (Status Fehler, Agent läuft nicht), `Io(String)`, dazu das bestehende `Internal(String)`.

## Finale Abnahmekriterien

1. Erster Start zeigt den Leerzustand; „Erste Session anlegen“ bzw. „Neue Session“ (auch Ctrl+N) öffnet Neue Session mit Aufgabe, Modell/Denkaufwand und Modus; „Session starten“ legt die Session an und zeigt ihren Chat.
2. Der Chat zeigt Nachrichten, Antworten, eingeklappten Gedankengang, gruppierte Werkzeug-Zeilen, Aufgabenliste und „Claude arbeitet …“ laufend, während der Agent arbeitet.
3. Eine Rückfrage des Agenten (`AskUserQuestion`) erscheint als Kasten mit nummerierten Knöpfen; ein Klick oder eine eigene Antwort im Eingabefeld beantwortet sie, der Agent arbeitet mit der Antwort weiter. Eine Rechte-Abfrage erscheint genauso mit „Erlauben“/„Ablehnen“.
4. Pause und Esc unterbrechen, Fortsetzen macht weiter, Abbrechen beendet die Session endgültig; nach einem Absturz des Agenten zeigt der Chat den Fehlerkasten, „Agent neu starten“ setzt mit vollem Verlauf fort.
5. Modell und Modus wechseln ohne Verlust des Verlaufs und wirken ab der nächsten Nachricht; ein Denkaufwand-Wechsel ebenso.
6. Antworten erscheinen als Markdown; Code-Blöcke zeigen die Sprache, sind farbig hervorgehoben und lassen sich per „Kopieren“ unverändert in die Zwischenablage legen.
7. Sidebar gruppiert nach „Braucht dich“ / „Läuft“ / „Abgeschlossen“ mit den Statussymbolen des Entwurfs; mehrere Sessions laufen gleichzeitig.
8. `pnpm check` grün; Code-Map, Glossar, Entwurfs-README, PROJECT.md und GAPS beschreiben den tatsächlichen Stand.

## Smoke-Checkliste

Nachgeholt während der M4-Abnahme (2026-09-29), delegiert an mich, echte App über den WebView2-Debug-Port:

- [x] **Langer Verlauf:** Bottom-Anchor und Gruppierung (79 Read-Aufrufe zu einer Zeile) bestätigt. Das Nachladen beim Hochscrollen selbst **nicht** ausgelöst — 80 Reads ergeben nur 86 Einträge, unter der Seitengröße 200. Kein Befund, nur eine Testlücke (vermerkt in M4 Deviations).
- [x] **Kein Konsolenfenster, schneller Start:** in keinem der ~30 Sessions dieser Runde ein Konsolenfenster gesehen; Start bis „Läuft“ regelmäßig unter 15 s.
- [x] **Rechte-Abfrage in „Manuell“:** `whoami` lief ohne Abfrage durch (Freigabe-Regel greift, wie im Text vermutet — offene Frage in GAPS.md damit beantwortet). Mit `rm nicht-vorhanden-datei.txt` erschien der Kasten korrekt mit Erlauben/Ablehnen.
- [x] **Code-Block kopieren:** beide Blöcke farbig mit Sprachlabel, Tabelle korrekt, „Kopieren“ legt den Block mit erhaltener Einrückung in die Zwischenablage, Link öffnet den externen Standardbrowser (Chrome), nicht das App-Fenster.
- [x] Rückfrage per Klick und per Texteingabe: beide Wege bestätigt.
- [x] Esc während der Arbeit → „Pausiert“ bestätigt. Die laufende Werkzeug-Zeile zeigte **„fehlgeschlagen“ statt „unterbrochen“** — Fund, siehe [M4-Deviations](../2026-09-28_m4-persistenz-und-wiederherstellung/README.md#deviations-from-plan). „Fortsetzen“ funktioniert.
- [x] Modellwechsel auf Haiku 4.5 bestätigt (Agent erkennt sich korrekt), Denkaufwand-Wechsel bestätigt, Verlauf blieb.
- [x] Absturz: Fehlerkasten, Status „Fehler“ in „Braucht dich“, „Protokoll anzeigen“, „Agent neu starten“ → „Pausiert“ → „Fortsetzen“ mit vollem Verlauf — alles bestätigt.
- [x] Abbrechen → „Abgebrochen“ unter „Abgeschlossen“, Eingabefeld gesperrt mit dem Hinweistext aus dem Design — bestätigt.
- [x] Zwei Sessions gleichzeitig, sauber getrennte Verläufe — bestätigt (Datenebene und Rendering-Muster).
- [x] Kontext-Balken/Laufzeit: Laufzeit tickte live (0:19 → 0:38 in 6 s Wandzeit), stand still während Pause.

## Summary

Die App startet Claude pro Session als eigenen Prozess im Stream-Modus, zeigt den Verlauf virtualisiert (Nachrichten, Markdown mit farbigen Code-Blöcken, eingeklappter Gedankengang, gruppierte Werkzeug-Zeilen, Aufgabenliste, Rückfragen und Rechte-Abfragen als Kasten mit Knöpfen) und steuert ihn über die Eingabeleiste: Senden, Pause per Esc, Fortsetzen, Abbrechen, Neustart nach Absturz, Modell-, Modus- und Denkaufwand-Wechsel. Sessions und Verlauf liegen im Speicher des Core (bis M4), der Agent arbeitet in einem leeren Ordner pro Session (bis M3). `pnpm check` ist grün; ein Release-Workflow baut bei Versions-Tags Installer und lose exe.

## Files touched

- Core: `src-tauri/src/agents/` (Claude-Prozess, Protokoll, Übersetzung), `src-tauri/src/sessions/`, `src-tauri/src/commands/{sessions,chat}.rs`, `src-tauri/src/filesystem/workspace.rs`, `src-tauri/src/error.rs`, `src-tauri/src/bin/gen-bindings.rs`
- Oberfläche: `src/app/`, `src/features/{sessions,chat}/`, `src/components/`, `src/stores/{sessions,chat}.ts`, `src/lib/{sessions,chat,labels}.ts`, `src/lib/bindings/` (generiert), `src/styles/theme.css`, `vite.config.ts`
- Doku und Betrieb: `AGENTS.md`, `docs/{PROJECT,code-map,glossary}.md`, `docs/conventions/`, `docs/knowledge/`, `docs/design/`, `.github/workflows/release.yml`, Startskript `starten.cmd`

## Commits

- Phase 1: `dee9739` feat(agents): add claude process, stream protocol and translation
- Phase 2: `c0d4b43` feat(sessions): add session registry, commands and events
- Phase 3: `3096a6f` feat(sessions): add app frame, empty state and new session view (dazu `16ad29a` fix(ui): resolve BEM nesting with postcss-nested)
- Phase 4: `da5f9e0` feat(chat): add virtualized chat timeline with answerable questions
- Phase 5: `d20d060` feat(chat): render agent replies as markdown with highlighted code blocks
- Phase 6: `e3fa46f` feat(chat): add composer with model, mode and effort menus
- Nebenbei: `47e0eb2` ci(setup): build release with installer and exe on version tags

## Deviations from plan

- **Smoke-Abnahme nicht in diesem Plan:** Sascha hat am Plan-Ende entschieden, dass sich auf dem Stand (Sessions weg nach Neustart, keine Repositories) nicht sauber abnehmen lässt. Die Checkliste ist am 2026-09-29 im Rahmen der M4-Abnahme nachgeholt worden (siehe oben) — der Tag für diesen Stand ist der von M4 (`v0.3.0`), nicht ein eigener für M2a.
- **Platzhalter „Antwort an Claude …“** hängt am Status `waiting`, nicht an einer aus den Einträgen abgeleiteten offenen Rückfrage.
- **Werkzeug-Gruppen** werden je Block virtualisiert, nicht je Zeile: 80 aufeinanderfolgende Read-Aufrufe ohne Text dazwischen stehen aufgeklappt alle im DOM.

## Follow-ups

- Bündel ~614 kB (Warnung „> 500 kB“) durch den `common`-Sprachsatz von highlight.js und `react-markdown`; Aufteilen erst bei spürbarer Startzeit.
- Hell/Dunkel-Optik im Fenster weiterhin ungeprüft (Link-Öffnen und Kopieren sind seit 2026-09-29 bestätigt, `opener:default` reicht für `openUrl`, kein `opener:allow-open-url` nötig).
- Offen aus M1: `gen-bindings.exe` im Installer (Entscheidung steht aus).
- `→ Vault`-Einträge in `FINDINGS.md` (Rust-`match` und Sperren, BEM-Nesting im Build, `rehype-highlight` und Sprachen) warten auf `session-review`.
