# Phase 3 — Automatischer Start

Rating: heikel · Modell: Opus · Commit: `feat(sessions): Einstiegszeile automatisch senden` (Release und Archiv: Phase 4)

Heikel, weil hier ein eigener Thread nach Ablauf eines Zeitgebers Sessions anlegt und sendet: Sperren-Reihenfolge, veraltete Zeitgeber und der Augenblick des Umschaltens müssen stimmen.

## Kontext

Lesen: [README](README.md) (Entscheidungen, Kontrakt — vor allem „Haltegründe“, „Countdown“, „Kettenbremse“), [Entwurf](artifacts/entwurf-automatisch-weiter.html) Zustände 2 und 3, [ADR 040](../../decisions/040-automatisch-weiter.md) (aus Phase 1), [ADR 032](../../decisions/032-wartet-auf-skript.md), [AGENTS.md](../../../AGENTS.md) (Critical Rules 2–4), [docs/code-map.md](../../code-map.md) (Zeilen „Sessions“, „Chat“), [docs/conventions/rust.md](../../conventions/rust.md), [react.md](../../conventions/react.md), [releases.md](../../conventions/releases.md). Fehlerklassen: keine einschlägig (README).

Bestand in `src-tauri/src/sessions/registry.rs` (gelesen 2026-10-26, per Grep neu finden):

- `fn update(app, session, change)` (~3166): sperrt die Session (`lock_loaded`), ruft `change(&mut state, &mut outbox)`, speichert, baut bei `summary_dirty` die Zusammenfassung, **gibt die Sperre frei**, dann `outbox.emit(app, session)` und `commit_scan::schedule(…)` — hier, hinter der Sperre, kommt der neue Aufruf hin.
- Agenten-Ereignisse laufen über `handle_output` → `update` → `state.apply_event` → bei `AgentEvent::TurnEnded` → `end_turn` (~2932); dort `TurnEnd::Completed => self.set_status(outbox, SessionStatus::Completed)`.
- `is_awaiting_subagent()` (~2239), `awaited_script()` (~2248) — abgeschlossen, aber der Agent setzt noch selbst fort.
- `push_user` (~2390, jede Nachricht von dir, auch die automatisch gesendete), `AgentEvent::Text` (~2519).
- `create_in_project(&self, project_id) -> Result<SessionSummary, CommandError>` (~550, gibt eine vorhandene Session „Neu“ zurück, sendet kein Ereignis), `set_model(&self, app, session_id, model: ModelId)` (~1189), `send(&self, app, session_id, text, attachment_ids: &[String], comments: &[ReviewComment])` (~840).
- Sperr-Regeln aus dem Bestand: Vorhaben- und Session-Sperre nie zugleich (Kommentar in `send`); nie zwei Session-Sperren zugleich; kein `Database::with` unter einer Session-Sperre.
- Thread-Muster: `start_reaper` (~1739, `thread::Builder::new().name(…).spawn`, `app.state::<SessionRegistry>()`).
- Phase 2: `project_auto_handoff`, `set_project_auto_handoff`.
- Oberfläche: `src/lib/sessions.ts` (`onSessionChanged` als Muster für ein Ereignis-Abo), `src/app/App.tsx`, `src/stores/sessions.ts` (`activeSessionId`, `showNewSession`, `showSettings`, `showProjectOverview`, `selectSession`), `HandoffBar.tsx`, `src/lib/labels.ts` (`modelName(id: ModelId): string`).

## AK

1. Schalter an, Agent antwortet mit `Weiter: Test – Modell haiku` und `**TL;DR:** fertig.` → unter der Antwort „Startet automatisch in 10 s auf Haiku“ mit „Abbrechen“, die Sekunden zählen herunter, der Knopf „In neuer Session weiter“ ist so lange ausgeblendet.
2. Nach Ablauf erscheint im Vorhaben eine neue Session auf Haiku, ihre erste Nachricht ist die Zeile, sie läuft; war die alte Session offen, ist jetzt die neue ausgewählt; die alte zeigt den grünen Haken.
3. „Abbrechen“ → „Automatisch weiter abgebrochen.“ und der Knopf ist wieder da; nichts startet.
4. Je eine Antwort mit 🔴 / mit einer letzten Zeile auf „?“ / mit „Merge“ in der TL;DR-Zeile / mit zwei „Weiter:“-Zeilen → kein Countdown, die graue Zeile nennt den jeweiligen Grund.
5. Steht im Vorhaben schon eine Session „Neu“ → kein Start, Grund „im Vorhaben wartet schon eine neue Session“.
6. Eine Kette, in der jede Session wieder mit einer „Weiter:“-Zeile endet, startet höchstens 6 Sessions automatisch; die 6. zeigt danach den Grund „6 automatische Starts in Folge“. Eine Nachricht von dir in einer Session setzt ihre Zählung auf 0.
7. Schalter aus während des Countdowns → Countdown weg, nichts startet. Schalter an bei einer fertigen Antwort mit genau einer „Weiter:“-Zeile → Countdown beginnt.
8. Eine Nachricht von dir oder eine neue Antwort während des Countdowns → Countdown weg, nichts startet.
9. App-Neustart während des Countdowns → nach dem Start kein Countdown, nichts startet, der Knopf steht da.
10. Endet die Antwort, während ein Subagent oder ein Skript (ADR 032) noch läuft → kein Countdown; erst die abschließende Antwort danach zählt.
11. Schlägt Anlegen, Modellwechsel oder Senden fehl → „Automatischer Start gescheitert: …“ unter der alten Antwort; bei gescheitertem Modellwechsel wird nicht gesendet.
12. `pnpm check` grün.

## Checkliste

### Core: Typen und Erkennung

- [x] `sessions/model.rs`: `HandoffHalt`, `AutoHandoff`, `HandoffStartedEvent` genau wie im README-Kontrakt. `SessionSummary`: `/// Stand der Automatik unter der letzten Antwort (ADR 040); nur im Speicher, `None` ohne.` `pub auto_handoff: Option<AutoHandoff>,` hinter `handoff_lines`.
- [x] `sessions/handoff.rs`: `pub fn stop_reason(text: &str) -> Option<HandoffHalt>`:
  1. `Red`, wenn eine Zeile außerhalb eines Code-Blocks `'🔴'` enthält (Zaun-Zustand von vorn mitführen: eine Zeile, die nach `trim()` mit `CODE_FENCE` beginnt, schaltet um; Zaun-Zeilen selbst zählen nicht).
  2. Sonst dieselbe Rückwärts-Schleife wie `handoff_lines` (gleiche Überspringen-Regeln, Einstiegszeilen zählen nicht, Abbruch nach `HANDOFF_WINDOW` gezählten Zeilen); für jede **gezählte** bereinigte Zeile, von unten: endet sie mit `'?'` → `Question`; enthält `to_lowercase()` `"merge"` → `Merge`. Erster Treffer gewinnt.
  3. Sonst `None`.

  Die Schleife nicht kopieren: eine private Funktion `fn tail(text: &str) -> (Vec<HandoffLine>, Vec<String>)` (Einstiegszeilen, gezählte bereinigte Zeilen — beide in Rückwärts-Reihenfolge) liefert beides; `handoff_lines` dreht ihren ersten Teil um.

### Core: Zustand (`registry.rs`)

- [x] `SessionState`, alle nur im Speicher (nicht in `row_of`, nicht wiederhergestellt; Initialisierung in `SessionState::new`):
  - `handoff_stop: Option<HandoffHalt>` — Haltegrund aus dem Text der letzten Antwort.
  - `auto_handoff: Option<AutoHandoff>`.
  - `auto_handoff_token: u64` — Marke; jede Änderung des Countdowns erhöht sie, der Zeitgeber vergleicht sie.
  - `auto_chain: u32` — der wievielte automatische Start in Folge diese Session ist; 0 = von dir gestartet.
- [x] `AgentEvent::Text`: neben den Zeilen `self.handoff_stop = handoff::stop_reason(&text);` und `self.drop_auto_handoff(outbox);`.
- [x] `push_user`: `self.handoff_stop = None; self.drop_auto_handoff(outbox); self.auto_chain = 0;`.
- [x] Neu `fn drop_auto_handoff(&mut self, outbox: &mut Outbox)`: `self.auto_handoff_token += 1;` und, wenn `auto_handoff.is_some()`, auf `None` und `outbox.summary_dirty = true`.
- [x] `Outbox`: Feld `turn_completed: bool`. `end_turn`: Arm `TurnEnd::Completed => { self.set_status(outbox, SessionStatus::Completed); outbox.turn_completed = true; }`.
- [x] `update`: hinter `commit_scan::schedule` und vor `let value = result?;`: `if outbox.turn_completed { auto_handoff::consider(app, session); }`. **Prüfen:** dort ist die Session-Sperre schon frei (Block mit `lock_loaded` ist zu).
- [x] `summarize`: `auto_handoff: state.auto_handoff.clone()`.
- [x] Neue Methoden an `SessionRegistry` (Doc je eine Zeile; keine hält zwei Sperren zugleich):

  ```rust
  /// Spätere oder wartende Sessions im Vorhaben; sperrt jede andere Session einzeln und kurz.
  pub(crate) fn follow_up(&self, session: &Session) -> FollowUp;
  /// Entscheidet unter der Sperre der Session, ob ein Countdown beginnt (Tabelle unten).
  pub(crate) fn schedule_auto_handoff(&self, app: &AppHandle, session: &Arc<Session>, follow_up: FollowUp) -> Option<ScheduledHandoff>;
  /// Löst den Countdown ein: `true` nur, wenn `token` noch gilt und ein Countdown steht; setzt dann `None`.
  pub(crate) fn take_auto_handoff(&self, app: &AppHandle, session: &Arc<Session>, token: u64) -> bool;
  /// Setzt `Halted { reason }`, wenn `token` noch gilt.
  pub(crate) fn halt_auto_handoff(&self, app: &AppHandle, session: &Arc<Session>, token: u64, reason: HandoffHalt);
  /// Setzt `Failed { message }` (nach `take_auto_handoff`, ohne Marke).
  pub(crate) fn fail_auto_handoff(&self, app: &AppHandle, session: &Arc<Session>, message: String);
  pub(crate) fn set_auto_chain(&self, session_id: &str, chain: u32);
  /// Bricht einen laufenden Countdown ab: `Halted { Cancelled }`; ohne Countdown nichts.
  pub fn cancel_auto_handoff(&self, app: &AppHandle, session_id: &str) -> Result<(), CommandError>;
  /// Die Sessions eines Vorhabens (für Schalter an/aus).
  pub(crate) fn project_sessions(&self, project_id: &str) -> Vec<Arc<Session>>;
  ```

  mit `pub(crate) struct FollowUp { pub later_started: bool, pub pending_new: bool }` (`later_started`: andere Session mit höherer Nummer und Status ≠ `New`; `pending_new`: andere Session im Status `New`) und `pub(crate) struct ScheduledHandoff { pub token: u64, pub line: HandoffLine, pub chain: u32 }`. Alle Zustandsänderungen über `update(app, session, …)`, damit die Zusammenfassung gesendet wird; `set_auto_chain` darf direkt `session.lock()` nehmen (ändert nichts Sichtbares).

- [x] `schedule_auto_handoff` — Entscheidung unter der Sperre, in dieser Reihenfolge:
  1. Status ≠ `Completed`, oder `is_awaiting_subagent()`, oder `awaited_script().is_some()` → nichts ändern, `None`.
  2. `session_lines` = Zeilen mit `kind == Session`. Leer **oder** `follow_up.later_started` → `drop_auto_handoff`, `None`.
  3. Grund = `handoff_stop`, sonst `SeveralLines` bei `session_lines.len() > 1`, sonst `PendingSession` bei `follow_up.pending_new`, sonst `ChainLimit` bei `auto_chain >= AUTO_HANDOFF_CHAIN_LIMIT`. Gibt es einen → `auto_handoff_token += 1`, `auto_handoff = Some(Halted { reason })`, `summary_dirty`, `None`.
  4. Sonst `auto_handoff_token += 1`, `auto_handoff = Some(Countdown { starts_at: now_ms() + AUTO_HANDOFF_DELAY.as_millis() as f64, model: line.model })`, `summary_dirty`, `Some(ScheduledHandoff { token, line, chain: auto_chain })`.

### Core: Ablauf (`src-tauri/src/sessions/auto_handoff.rs`, neu, `pub mod auto_handoff;` in `sessions/mod.rs`)

- [x] Modul-Doc: „Automatisch weiter: startet nach einer Antwort mit Einstiegszeile die Folgesession selbst (ADR 040).“ Konstanten `pub const AUTO_HANDOFF_DELAY: Duration = Duration::from_secs(10);`, `pub const AUTO_HANDOFF_CHAIN_LIMIT: u32 = 6;`, `pub const HANDOFF_STARTED_EVENT: &str = "session://handoff-started";`.
- [x] `pub fn consider(app: &AppHandle, session: &Arc<Session>)` — **nie unter einer Sperre aufrufen**:
  1. `let registry = app.state::<SessionRegistry>();` `if !registry.project_auto_handoff(&session.project_id) { return; }`
  2. `let follow_up = registry.follow_up(session);`
  3. `let Some(scheduled) = registry.schedule_auto_handoff(app, session, follow_up) else { return; };`
  4. Thread `auto-handoff` (Muster `start_reaper`) mit Klonen von `AppHandle` und `Arc<Session>`: `thread::sleep(AUTO_HANDOFF_DELAY); fire(&app, &session, scheduled);`. Scheitert `spawn` → `registry.fail_auto_handoff(app, session, format!("Zeitgeber nicht gestartet: {error}"))` — vorher den Countdown per `take_auto_handoff(…, scheduled.token)` einlösen.
- [x] `fn fire(app: &AppHandle, session: &Arc<Session>, scheduled: ScheduledHandoff)`:
  1. `registry.project_auto_handoff` falsch → zurück (Ausschalten hat den Countdown schon entfernt).
  2. `follow_up` neu holen; `later_started` → `take_auto_handoff` (Ergebnis egal), zurück; `pending_new` → `halt_auto_handoff(…, scheduled.token, PendingSession)`, zurück.
  3. `if !registry.take_auto_handoff(app, session, scheduled.token) { return; }` — **Marke, nicht Uhr:** beim Ablauf ist „läuft der Countdown noch?“ nach der Uhr immer „nein“.
  4. `create_in_project` → Fehler: `fail_auto_handoff(…, format!("Session nicht angelegt: {error}"))`, zurück.
  5. `if let Some(model) = scheduled.line.model && model != created.model` → `set_model(app, &created.id, model)`; Fehler: `fail_auto_handoff(…, format!("Modell nicht umgestellt: {error}"))`, zurück (nicht senden).
  6. `send(app, &created.id, &scheduled.line.text, &[], &[])`; Fehler: `fail_auto_handoff(…, format!("Nicht gesendet: {error}"))`, zurück.
  7. `set_auto_chain(&created.id, scheduled.chain + 1)`.
  8. `app.emit(HANDOFF_STARTED_EVENT, HandoffStartedEvent { from_session_id: session.id.clone(), to_session_id: created.id.clone() })`; Sendefehler nur ins Protokoll der Session (`session.log_line`).
- [x] `set_project_auto_handoff` (Phase 2) ergänzen, nach dem Ereignis: `for member in self.project_sessions(project_id)`: `enabled` → `auto_handoff::consider(app, &member)`; sonst ein `update`, der `drop_auto_handoff` ruft. Keine Sperre halten, während die Schleife läuft (`project_sessions` gibt geklonte `Arc`s zurück).
- [x] `commands/sessions.rs`: `session_cancel_auto_handoff(app, registry, session_id: String) -> Result<(), CommandError>` → `registry.cancel_auto_handoff(&app, &session_id)`; in `lib.rs` registrieren.
- [x] `pnpm bindings` (neu: `HandoffHalt.ts`, `AutoHandoff.ts`, `HandoffStartedEvent.ts`).
- [x] **Sperren-Beleg vor dem Commit:** per Grep alle Aufrufe von `auto_handoff::consider` und `fire` auflisten und je Fundstelle im Report-Back eine Zeile, warum dort keine Sperre gehalten wird.

### Oberfläche

- [x] `src/lib/sessions.ts`: `cancelAutoHandoff(sessionId: string): Promise<void>` (`invoke('session_cancel_auto_handoff', { sessionId })`), `onHandoffStarted(callback: (event: HandoffStartedEvent) => void): Promise<UnlistenFn>` (`listen('session://handoff-started', …)`, Muster `onSessionChanged`).
- [x] `src/features/chat/handoff.ts`: `export const HALT_TEXT: Record<HandoffHalt, string>` = `red`: „Nicht automatisch weiter: die Antwort enthält 🔴.“ · `question`: „Nicht automatisch weiter: die Antwort endet mit einer Frage.“ · `merge`: „Nicht automatisch weiter: die Antwort nennt den Merge.“ · `severalLines`: „Nicht automatisch weiter: mehrere Einstiegszeilen — wähle selbst.“ · `pendingSession`: „Nicht automatisch weiter: im Vorhaben wartet schon eine neue Session.“ · `chainLimit`: „Nicht automatisch weiter: 6 automatische Starts in Folge — schick eine Nachricht oder starte von Hand.“ · `cancelled`: „Automatisch weiter abgebrochen.“
- [x] Neu `src/features/chat/useSecondsUntil.ts`: `export function useSecondsUntil(target: number | null): number | null` — `null` bei `target === null`, sonst `Math.max(0, Math.ceil((target - Date.now()) / 1000))`, neu berechnet per `setInterval` alle 250 ms (aufräumen im Effekt-Cleanup).
- [x] `HandoffBar.tsx` + `.css`: Props zusätzlich `sessionId: string` und `autoState: AutoHandoff | null` (aus `session.autoHandoff`, durchgereicht von `ChatTimeline`).
  - `autoState?.kind === 'countdown'`: Reihen der Art `session` ausblenden (Reihen „Neues Vorhaben“ bleiben); vor dem Fuß `<div className="handoff-bar__auto" role="status">` mit Pfeil-Symbol (SVG aus `StatusIcon` Fall `handoff`), Text `Startet automatisch in {s} s auf {modelName(model)}` (bei `model === null`: „auf dem bisherigen Modell“; bei `s === 0`: „Startet …“) und Textknopf „Abbrechen“ → `cancelAutoHandoff(sessionId)` (Fehler → `console.error`, Countdown bleibt sichtbar bis zum nächsten Ereignis).
  - `kind === 'halted'`: im Fuß links `<span className="handoff-bar__halt">{HALT_TEXT[reason]}</span>`.
  - `kind === 'failed'`: `<p className="handoff-bar__error" role="alert">Automatischer Start gescheitert: {message}</p>`.
  - CSS: `__auto` Flex, `gap: var(--space-sm)`, `padding: var(--space-xs) var(--space-md)`, `border-radius: var(--radius-lg)`, `background: var(--color-accent-subtle)`, Zahl `font-variant-numeric: tabular-nums`; Abbrechen-Knopf wie `mcp-server__reconnect` (`src/features/mcp/McpServerRow.css`); `__halt` `font-size: var(--font-size-xs)`, `color: var(--color-fg-muted)`; `__error` wie `handoff__error`; `__foot` jetzt `justify-content: space-between`. Aussehen nach Entwurf Zustände 2 und 3.
- [x] `App.tsx`: Effekt mit `onHandoffStarted` (Abo-Muster wie in `useSessionSummaries`: abonnieren, Abbruch über `AbortController`, `unlisten` im Cleanup): `const state = useSessionsStore.getState(); if (state.activeSessionId === event.fromSessionId && !state.showNewSession && !state.showSettings && !state.showProjectOverview) { state.selectSession(event.toSessionId); }`. Die neue Session kommt über `session://changed` in die Liste (`useSessionSummaries` fügt Unbekannte ein) — kein `upsertSession` nötig.

### Doku und Abschluss

- [x] `docs/code-map.md` Zeile „Sessions“: `auto_handoff.rs` (Countdown, Start, Kettenbremse), Haltegründe in `handoff.rs`; Zeile „Chat“: `useSecondsUntil`, Zustände der `HandoffBar`.
- [x] `docs/glossary.md`: Eintrag **Automatisch weiter** — Schalter je Vorhaben; startet nach einer Antwort mit genau einer „Weiter:“-Zeile nach 10 s Countdown die nächste Session mit dem Modell der Zeile; hält an bei 🔴, Frage, „Merge“, mehreren Zeilen, wartender neuer Session, 6 Starts in Folge; ADR 040.
- [x] `pnpm check` grün, Commit (Bindings mit).
- [x] Plan archivieren und Release entfallen hier: beides macht Phase 4 ([phase-4-arbeitsbaeume.md](phase-4-arbeitsbaeume.md)). Phase 3 endet mit dem Commit.

## Report-Back

Status: complete.

- **Gebaut wie Checkliste:** Typen `HandoffHalt`/`AutoHandoff`/`HandoffStartedEvent`, `stop_reason` über die gemeinsame Rückwärts-Schleife `tail`, Zustand mit Marke und Kettenzähler nur im Speicher, neues Modul `sessions/auto_handoff.rs` (`consider`, `fire`), Command `session_cancel_auto_handoff`, Countdown/Haltegrund/Fehler in der `HandoffBar`, Ansicht folgt in `App.tsx`, Code-Map und Glossar.
- **Sperren-Beleg:** `auto_handoff::consider` steht an zwei Stellen. (1) `registry.rs` in `update` hinter dem Block mit `lock_loaded` — die Session-Sperre ist dort schon freigegeben, `update` selbst wird aus `handle_output` (Lese-Thread des Prozesses) ohne weitere Sperre gerufen. (2) `set_project_auto_handoff` — die Vorhaben-Sperre ist eine temporäre und vor der Schleife frei, `project_sessions` gibt geklonte `Arc`s zurück. `fire` läuft nur im Thread `auto-handoff` (`auto_handoff.rs`), ohne gehaltene Sperre; `create_in_project`, `set_model`, `send` nehmen ihre Sperren selbst nacheinander. Keine Rekursion: die von `consider`/`fire` ausgelösten `update`-Aufrufe setzen `turn_completed` nie.
- **Abweichung 1:** `handoff_stop` wird nach einem App-Neustart beim Laden des Verlaufs (`load_entries`) aus dem letzten Text-Eintrag neu bestimmt. Grund: sonst startete nach Neustart + Einschalten eine Antwort mit 🔴, Frage oder „Merge“ automatisch.
- **Abweichung 2:** `take_auto_handoff` löst nur ein, wenn die Session noch „abgeschlossen“ ist und weder auf Subagent noch Skript wartet. Grund: ein Agent kann ohne neuen Text wieder anlaufen (Subagent fertig), dann darf der alte Countdown nicht feuern.
- **Abweichung 3:** Countdown als eigene Unterkomponente mit `key={startsAt}`, damit `useSecondsUntil` ab dem Erscheinen zählt (die Uhr des Hooks steht ohne Ziel still; `Date.now()` im Render verbietet die Lint-Regel). Bei 0 s steht „Startet auf <Modell> …“ statt nur „Startet …“.
- **Nicht im Betrieb gefahren:** der Ablauf im Test-Vorhaben (README „Risiken“) und der Vergleich Auto-Titel/TL;DR mit dem Knopf stehen aus — nur `pnpm check` ist belegt.
- 🟡 **Wackelstelle:** `fire` setzt `auto_chain` erst nach `send`, weil `push_user` den Zähler auf 0 setzt. Endet die erste Antwort der neuen Session schneller als dieser eine Aufruf, zählt die Kette einmal von 0 — praktisch ausgeschlossen, aber nicht abgesichert. Ebenso: legt jemand genau zwischen Prüfung und Anlegen von Hand eine Session „Neu“ an, sendet `create_in_project` die Zeile in diese.
