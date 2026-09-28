# Meilenstein 2a — Durchstich & Chat

Ziel: In der App eine Session anlegen, mit Claude chatten, Werkzeug-Aktivität und Gedankengang sehen, Rückfragen und Rechte-Abfragen per Knopf beantworten, pausieren, fortsetzen, abbrechen, nach einem Absturz neu starten, Modell, Modus und Denkaufwand wechseln — alles nach dem abgenommenen Entwurf. Der Agent arbeitet in einem leeren Ordner pro Session; Repositories und Worktrees kommen mit Meilenstein 3, Speichern über einen Neustart hinweg mit Meilenstein 4.

Nicht in diesem Plan (eigener Plan **M2b**): Anhänge, `/`-Menü und Skills, Hintergrund-Panel mit Prozessen und Subagenten, Subagent- und Hintergrund-Zeilen im Verlauf.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 003](../../decisions/003-claude-anbindung.md), [knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Claude-Prozess & Protokoll im Core | [phase-1-protokoll-und-prozess.md](phase-1-protokoll-und-prozess.md) | heikel | complete |
| 2 | Sessions, Commands & Events | [phase-2-sessions-und-commands.md](phase-2-sessions-und-commands.md) | standard | pending |
| 3 | App-Rahmen, Leerzustand, Neue Session | [phase-3-rahmen-und-neue-session.md](phase-3-rahmen-und-neue-session.md) | standard | pending |
| 4 | Chat-Verlauf | [phase-4-chat-verlauf.md](phase-4-chat-verlauf.md) | heikel | pending |
| 5 | Markdown & Code-Blöcke | [phase-5-markdown-und-codebloecke.md](phase-5-markdown-und-codebloecke.md) | standard | pending |
| 6 | Eingabeleiste & Steuerung | [phase-6-eingabeleiste-und-steuerung.md](phase-6-eingabeleiste-und-steuerung.md) | standard | pending |

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

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

- [ ] **Langer Verlauf bleibt unten verankert und lädt Älteres nach:** Aufgabe „Lies die Datei a.txt 80 Mal nacheinander, jedes Mal mit einem eigenen Read-Aufruf. Lege sie vorher mit Inhalt hi an.“ — während der Arbeit bleibt die Ansicht am unteren Ende; nach oben scrollen lädt ältere Einträge ohne Sprung.
- [ ] **Kein Konsolenfenster, schneller Start:** „Session starten“ → innerhalb von 10 s wechselt der Status von „Startet“ auf „Läuft“; kein schwarzes Fenster blitzt auf.
- [ ] **Rechte-Abfrage in „Manuell“:** Modus Manuell, Aufgabe „Führe den Befehl `whoami` aus.“ — erscheint ein Kasten mit Erlauben/Ablehnen? Erscheint keiner, greift eine Freigabe-Regel aus deinen Claude-Einstellungen (dann Befehl nennen, der nicht freigegeben ist, und wiederholen).
- [ ] **Code-Block kopieren:** „Zeig mir ein kurzes TypeScript-Beispiel und ein PowerShell-Beispiel als Code-Blöcke, dazu eine Tabelle und einen Link auf https://tauri.app.“ → beide Blöcke farbig mit Sprache; „Kopieren“ → in Notepad einfügen, Einrückung stimmt; Link öffnet den Browser, nicht das App-Fenster.
- [ ] Rückfrage: „Frag mich mit dem AskUserQuestion-Tool: Rot oder Blau?“ → Kasten mit 1/2; Klick auf „Blau“ → Agent antwortet mit Blau. Nochmal, diesmal „Grün“ ins Eingabefeld tippen und senden.
- [ ] Esc während der Arbeit → Status „Pausiert“, laufende Werkzeug-Zeile zeigt „unterbrochen“; „Fortsetzen“ → Agent macht weiter.
- [ ] Modell auf Haiku 4.5 stellen, fragen „Welches Modell bist du?“ → Antwort nennt Haiku; Denkaufwand auf Niedrig, nächste Nachricht kommt an, Verlauf ist noch da.
- [ ] Absturz: im Task-Manager `claude.exe` der Session beenden → Fehlerkasten „Agent beendet“, Status „Fehler“ in „Braucht dich“; „Protokoll anzeigen“ klappt Zeilen auf; „Agent neu starten“ → Status „Pausiert“, „Fortsetzen“ → Agent kennt den bisherigen Verlauf.
- [ ] Abbrechen → Status „Abgebrochen“ unter „Abgeschlossen“, Eingabefeld gesperrt mit Hinweis.
- [ ] Zwei Sessions gleichzeitig laufen lassen, zwischen ihnen wechseln — jeder Chat zeigt nur seine Einträge.
- [ ] Kontext-Balken und Laufzeit in der Kopfzeile bewegen sich; Laufzeit steht still, solange die Session nicht läuft.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
