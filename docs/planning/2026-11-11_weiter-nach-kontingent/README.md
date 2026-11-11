# Weiter nach dem Kontingent-Limit

**Ziel:** Eine Umsetzung läuft über Nacht ohne Benutzer weiter, auch wenn sie ins Kontingent-Limit (5-Stunden- oder Wochenfenster) rennt. Stoppt das Limit eine Station, wartet der Verwalter bis zum Zurücksetzen des Kontingents und schickt der Station dann selbst „weiter“. Solange eine Station läuft oder so wartet, hält der Verwalter Windows wach. Beides hängt an einer Einstellung „Nach Kontingent-Limit automatisch weiter“ (Standard aus). Begründung: [ADR 063](../../decisions/063-weiter-nach-kontingent.md) (entsteht in Phase 1).

**Warum nicht Claudes Schalter `autoContinueAtUsageLimit`:** Er wirkt nur im Limit-Dialog der interaktiven Claude-Oberfläche, wird nur aus `~/.claude/settings.json` gelesen und ist serverseitig per Schalter gesteuert (Beleg: Zeichenketten in `claude.exe` 2.1.322, Beschreibung „When a claude.ai usage limit stops your session, wait for the limit to reset … When off, the limit dialog offers the wait“). Stationen laufen als Kommandozeile ohne Dialog — dort ist die Wirkung unbelegt. Der Verwalter kennt die Reset-Zeit dagegen schon aus `rate_limit_event`.

## Overview

| Phase | Inhalt | Rating | Wave | Modell | Schätzung | Status |
|---|---|---|---|---|---|---|
| 1 | Limit-Stopp erkennen (Session bleibt ansprechbar statt „Fehler“), Einstellung `autoContinueAtLimit`, ADR 063 | heikel | 1 | opus | 3 h | pending |
| 2 | Warten und Weiterschicken für Stationen, Stationszustand „wartet aufs Kontingent“ | heikel | 2 | opus | 4 h | pending |
| 3 | Windows wachhalten, solange eine Station läuft oder wartet | standard | 3 | sonnet | 2 h | pending |
| 4 | Oberfläche: Einstellungszeile, Stationszustand auf Karte, Sidebar und Zeitleiste | standard | 3 | sonnet | 2 h | pending |

Sequenziell 1 → 2, weil Phase 2 Erkennung und Einstellung aus Phase 1 verbraucht. Phase 3 und 4 laufen parallel: 3 schreibt nur Core (`keep_awake/`, `lib.rs`, eine Abfrage in `registry.rs`), 4 nur `src/`; beide lesen den Kontrakt unten, keiner liefert dem anderen etwas.

## Kontrakt

**Einstellung** (Phase 1)
- Rust `Settings.auto_continue_at_limit: bool`, Standard `false`; Schlüssel `KEY_AUTO_CONTINUE_AT_LIMIT = "auto_continue_at_limit"`; `SettingsChange::AutoContinueAtLimit { value: bool }`.
- TypeScript (generiert): `Settings.autoContinueAtLimit: boolean`, `{ kind: 'autoContinueAtLimit', value: boolean }`.

**Limit-Stopp** (Phase 1) — neues Core-Modul `src-tauri/src/limit_resume/mod.rs`
- `pub fn is_limit_stop(text: &str, rejected_reset_at: Option<i64>) -> bool` — wahr, wenn in dieser Antwort ein `rate_limit_event` mit `status == "rejected"` kam (`rejected_reset_at.is_some()`), oder wenn `text` kleingeschrieben `"hit your"` und `"limit"` enthält, oder `"usage limit reached"`.
- `SessionState.limit_reset_at: Option<i64>` (Unix-Sekunden aus dem `rejected`-Ereignis der laufenden Antwort; `None`, wenn keins kam). Gesetzt im `AgentEvent::RateLimit`-Zweig, geleert am Anfang von `push_user`.
- `Outbox.limit_stop: Option<LimitStop>`; `pub struct LimitStop { pub reset_at: Option<i64> }` in `limit_resume/mod.rs`.
- Ein Limit-Stopp setzt den Status **`Completed`** statt `Error`, schreibt den Verlaufseintrag `ChatEntry::Error { title: "Kontingent aufgebraucht", text }` und lässt `outbox.turn_completed` auf `false` (kein „Automatisch weiter“ der Einstiegszeilen).

**Warten** (Phase 2)
- `pub struct LimitResumes` in `limit_resume/mod.rs`, gehalten in `SessionRegistry.limit_resumes: Mutex<LimitResumes>`; Methoden `begin(session_id, resume_at_ms) -> u64`, `take(session_id, token) -> bool`, `cancel(session_id) -> bool`, `ends() -> HashMap<String, f64>` (Session-ID → Zeitpunkt in ms), `any_waiting() -> bool`, `attempts(session_id) -> u32`, `reset_attempts(session_id)`.
- Konstanten: `RESUME_BUFFER_MS = 120_000.0`, `RESUME_FALLBACK_MS = 900_000.0` (15 min), `MAX_ATTEMPTS = 8`, `POLL = Duration::from_secs(30)`, `RESUME_TEXT = "Das Kontingent ist wieder frei. Mach an der Stelle weiter, an der dich das Limit unterbrochen hat."`.
- `pub fn resume_at_ms(reset_at: Option<i64>, now_ms: f64) -> f64` — liegt `reset_at * 1000` in der Zukunft: das plus `RESUME_BUFFER_MS`; sonst `now_ms + RESUME_FALLBACK_MS`.
- `StationState::WaitsForLimit` (neu), `StationView.resumes_at: Option<f64>` (ms; nur bei `WaitsForLimit` gesetzt). TS: `'waitsForLimit'`, `resumesAt: number | null`.

**Wachhalten** (Phase 3) — neues Core-Modul `src-tauri/src/keep_awake/mod.rs`
- `pub struct KeepAwake` (Tauri-State), `KeepAwake::start(app: &AppHandle)` startet einen Thread, der alle 30 s `SessionRegistry::stations_busy()` und die Einstellung liest und den Wach-Zustand setzt.
- `SessionRegistry::stations_busy(&self) -> bool` — wahr, wenn eine Session mit `station_of.is_some()` den Status `Starting`, `New` oder `Running` hat oder `limit_resumes.any_waiting()` wahr ist.

## Finale AK

1. Einstellung aus (Standard): Eine Station, die ins Limit läuft, steht danach auf „wartet auf dich“ (nicht „Fehler“), der Verlauf zeigt „Kontingent aufgebraucht“ samt Text der Kommandozeile, und eine Nachricht des Benutzers („weiter“) wird angenommen. Kein automatisches Weiter, kein Wachhalten.
2. Einstellung an: Dieselbe Station zeigt „wartet aufs Kontingent · weiter um HH:MM“ auf Karte, Zeitleiste und Sidebar und bekommt zum Zeitpunkt (Reset + 2 min) die Nachricht `RESUME_TEXT` ohne Zutun des Benutzers; die Umsetzung läuft danach normal weiter.
3. Schreibt der Benutzer der wartenden Station selbst, entfällt das automatische Weiter; bricht er die Umsetzung ab, ebenso.
4. Nach `MAX_ATTEMPTS` aufeinanderfolgenden Limit-Stopps ohne normal beendete Antwort wartet die Station auf den Benutzer statt erneut zu planen.
5. Einzel-Sessions (keine Station) werden nie automatisch weitergeschickt, bleiben aber nach einem Limit-Stopp ansprechbar.
6. Einstellung an und eine Station läuft oder wartet: `powercfg /requests` listet `verwalter.exe` unter `SYSTEM`. Keine Station läuft oder wartet, oder Einstellung aus: der Eintrag ist spätestens 30 s später weg.
7. `pnpm check` grün; `cargo test --manifest-path src-tauri/Cargo.toml` grün; Bindings neu erzeugt; ADR 063, Glossar und Code-Map nachgezogen.

## Risiken

- 🟡 **Reihenfolge der Ereignisse unbelegt:** Ob `rate_limit_event` (`rejected`) vor der `result`-Zeile kommt, ist nicht gemessen. Abgefangen durch die Text-Erkennung (`"You've hit your session limit · resets 2:10pm (Europe/Berlin)"` steht so in einem Verwalter-Transkript vom Nov. 2026) und den 15-Minuten-Rückfall ohne Reset-Zeit.
- 🟡 **Deckel zu = Schlaf:** `SetThreadExecutionState` verhindert nur den Schlaf durch Untätigkeit. Zuklappen folgt der Windows-Energieeinstellung „Beim Zuklappen“; die Info der Einstellung sagt das.
- 🟡 **Prozess nach Limit-Stopp:** Ob die Kommandozeile nach einer Fehler-`result`-Zeile weiterläuft, ist unbelegt; unkritisch, weil `send` einen beendeten Agenten neu startet (wie nach dem Ruhe-Timeout `VERWALTER_IDLE_SECONDS`), solange der Status nicht `Error` ist.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
