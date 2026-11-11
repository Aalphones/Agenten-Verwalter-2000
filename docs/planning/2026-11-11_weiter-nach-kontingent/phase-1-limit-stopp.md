# Phase 1 — Limit-Stopp erkennen, Einstellung, ADR 063

**Rating:** heikel · **Wave:** 1 · **Modell:** opus · **Status:** complete

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans, Abschnitt **Kontrakt** (Einstellung, Limit-Stopp) — verbindlich für Namen und Typen.
- `src-tauri/src/agents/claude/translate.rs` `turn_ended` (um Zeile 758): `is_error` der `result`-Zeile wird zu `TurnEnd::Failed(text)`; `rate_limit` (um Zeile 464) liefert `AgentEvent::RateLimit(RateLimitInfo { status, resets_at, … })`.
- `src-tauri/src/agents/event.rs` `RateLimitInfo` (um Zeile 308), `TurnEnd` (um Zeile 322).
- `src-tauri/src/sessions/registry.rs`:
  - `SessionState` (Felder um Zeile 338), `Outbox` (um Zeile 397, Feld `rate_limit`, `turn_completed`).
  - Ereignis-Verteilung, Zweig `AgentEvent::RateLimit` (um Zeile 3056) — setzt heute nur `outbox.rate_limit`, nur wenn `self.is_claude_process()`.
  - `end_turn` (um Zeile 3383): `TurnEnd::Failed` → Eintrag „Fehler vom Agenten“ + `SessionStatus::Error`. Verstanden: `Error` sperrt danach jedes `send` (`CommandError::AgentStopped`, um Zeile 1190) — deshalb ist eine Station nach dem Limit heute tot, bis der Benutzer eingreift.
  - `push_user` (um Zeile 2801).
  - Ende von `update` (um Zeile 3636–3650): nach `outbox.emit` wird `auto_handoff::consider` nur bei `outbox.turn_completed` gerufen — diese Stelle bleibt unverändert.
- `src-tauri/src/settings/model.rs` (Feld `auto_compact_stations` Zeile 80, `SettingsChange::AutoCompactStations` Zeile 141) und `src-tauri/src/settings/mod.rs` (`KEY_AUTO_COMPACT_STATIONS` Zeile 30, `DEFAULT_SETTINGS` Zeile 82, Laden Zeile 123–126, Schreiben um Zeile 223) — Referenzmuster für eine boolesche Einstellung.
- `docs/decisions/058-auto-zusammenfassen-in-stationen.md` — Form eines ADR in diesem Projekt.
- `docs/conventions/rust.md`, `docs/conventions/linting.md`.
- Fehlerklassen geprüft: Wissensbasis hat keine Einträge zu Rust, Tauri oder Windows; TypeScript/React nicht einschlägig.

## AK

1. `limit_resume::is_limit_stop` liefert `true` für (`"You've hit your session limit · resets 2:10pm (Europe/Berlin)"`, `None`), (`"Claude AI usage limit reached|1762900000"`, `None`), (`"irgendwas"`, `Some(1762900000)`); `false` für (`"API Error: 500"`, `None`). Belegt durch Unit-Tests in `src-tauri/src/limit_resume/tests.rs`.
2. Endet eine Antwort einer Claude-Session mit `TurnEnd::Failed` und `is_limit_stop` ist wahr: Verlaufseintrag `ChatEntry::Error` mit Titel `"Kontingent aufgebraucht"` und dem Text der Kommandozeile, Status `Completed`, `outbox.turn_completed` bleibt `false`, `outbox.limit_stop = Some(LimitStop { reset_at: self.limit_reset_at })`.
3. Jeder andere `Failed`-Fall verhält sich unverändert („Fehler vom Agenten“, Status `Error`).
4. `limit_reset_at` wird nur im `RateLimit`-Zweig einer Claude-Session gesetzt, nur bei `status == "rejected"` und vorhandenem `resets_at`; am Anfang von `push_user` und nach dem Auslesen in `end_turn` auf `None`.
5. Einstellung `auto_continue_at_limit` nach Kontrakt, Standard `false`, geladen und gespeichert wie `auto_compact_stations`; `pnpm bindings` erzeugt `autoContinueAtLimit` in `src/lib/bindings/Settings.ts` und `SettingsChange.ts`.
6. ADR `docs/decisions/063-weiter-nach-kontingent.md` liegt vor (Inhalt unten).
7. `pnpm check` grün, `cargo test --manifest-path src-tauri/Cargo.toml` grün.

## Checkliste

- [x] `src-tauri/src/limit_resume/mod.rs` neu, Modul-Kommentar: „Weiter nach dem Kontingent-Limit (ADR 063): erkennt den Limit-Stopp einer Antwort; das Warten und Weiterschicken für Stationen folgt.“ Inhalt: `LimitStop`, `is_limit_stop` nach Kontrakt. In `lib.rs` als `mod limit_resume;` eintragen.
- [x] `src-tauri/src/limit_resume/tests.rs` mit den Fällen aus AK 1 (`#[cfg(test)] mod tests;` in `mod.rs`).
- [x] `registry.rs`: Feld `limit_reset_at: Option<i64>` in `SessionState` (Doc-Kommentar „Reset-Zeit aus einem `rejected`-Kontingent-Ereignis der laufenden Antwort (ADR 063).“), Initialwert `None` überall, wo `SessionState` gebaut wird.
- [x] `registry.rs` `RateLimit`-Zweig: innerhalb `if self.is_claude_process()` zusätzlich `if info.status == "rejected" { if let Some(reset) = info.resets_at { self.limit_reset_at = Some(reset); } }` — vor der Zuweisung an `outbox.rate_limit` (die `info` danach verschieben).
- [x] `registry.rs` `push_user`: erste Zeile `self.limit_reset_at = None;`.
- [x] `registry.rs` `Outbox`: Feld `limit_stop: Option<LimitStop>`.
- [x] `registry.rs` `end_turn`, Zweig `TurnEnd::Failed(text)`: `let reset_at = self.limit_reset_at.take();` dann `if self.is_claude_process() && limit_resume::is_limit_stop(&text, reset_at)` → `interrupt_running_tools`, `abandon_pending(outbox, "Nicht beantwortet")`, Eintrag mit Titel `"Kontingent aufgebraucht"`, `set_status(Completed)`, `outbox.limit_stop = Some(LimitStop { reset_at })`; sonst bisheriger Ablauf.
- [x] Einstellung nach Kontrakt in `settings/model.rs` und `settings/mod.rs` (Muster `auto_compact_stations`); `pnpm bindings`.
- [x] ADR 063 schreiben: Kontext (Stationen sterben am Limit im Status `Error`; Ziel Nachtlauf), Optionen (a) Claudes `autoContinueAtUsageLimit` durchreichen — verworfen, wirkt nur im interaktiven Dialog, nur aus `userSettings`, serverseitig geschaltet; (b) Verwalter wartet selbst — gewählt; Entscheidung: Erkennung (Ereignis `rejected` oder Text), Status `Completed` statt `Error` für alle Claude-Sessions, Warten nur für Stationen bei Einstellung an, Puffer 2 min, Rückfall 15 min, höchstens 8 Versuche, Wachhalten per `SetThreadExecutionState` nur bei laufender oder wartender Station; Konsequenzen: Einzel-Sessions nach Limit ansprechbar statt „Fehler“; Zuklappen schläft weiter; nach App-Neustart kein Warten (wie Countdown ADR 040).
- [x] `docs/glossary.md`: Eintrag **Limit-Stopp** — „Antwort, die das Kontingent-Limit abbricht; die Session bleibt ansprechbar ([ADR 063](decisions/063-weiter-nach-kontingent.md)).“
- [x] `docs/code-map.md`: Querschnitts-Liste (Zeile 17) um `limit_resume` (Weiter nach dem Kontingent-Limit, nur Core) ergänzen.
- [x] STATE.md: ADR 063 als vergeben eintragen.

## Report-Back

- Erkennung in `limit_resume::is_limit_stop`, Unit-Tests für die vier Fälle aus AK 1 in `limit_resume/tests.rs`.
- `end_turn` hat einen eigenen Zweig vor dem bisherigen `Failed`: nur Claude-Sessions, Titel „Kontingent aufgebraucht“, Status `Completed`, `outbox.limit_stop` gesetzt, `turn_completed` bleibt aus. `limit_reset_at` wird vor dem `match` per `take()` geleert, also bei jedem Antwortende (auch bei Pause/Abbruch), nicht nur im `Failed`-Zweig.
- Abweichung: `limit_resume` steht in `lib.rs` als `pub mod` wie alle anderen Module (Checkliste: `mod`).
- Abweichung: `update` liest `outbox.limit_stop` schon jetzt und schreibt eine Zeile ins Session-Log („Limit-Stopp: Kontingent aufgebraucht, …“). Ohne Leser schlägt `clippy -D warnings` wegen eines nie gelesenen Felds an; Phase 2 hängt das Planen des Weiterschickens an dieselbe Stelle.
- Einstellung `auto_continue_at_limit` nach Kontrakt, Bindings erzeugt; die Oberfläche zeigt sie noch nicht (Phase 4).
- ADR 063, Glossar (Limit-Stopp), Code-Map (Querschnitt) nachgezogen.
