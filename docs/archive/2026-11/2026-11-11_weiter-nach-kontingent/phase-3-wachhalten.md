# Phase 3 — Windows wachhalten

**Rating:** standard · **Wave:** 3 (parallel zu Phase 4) · **Modell:** sonnet

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans, Abschnitt **Kontrakt** (Wachhalten).
- `src-tauri/src/lib.rs`: `.setup` (um Zeile 67, Dienste um Zeile 74–89, z. B. `app.manage(UsageService::new())`) und `.run` mit `RunEvent::Exit` (um Zeile 242).
- `src-tauri/src/processes/mod.rs` Zeilen 8–29 — Muster für `#[cfg(windows)]` samt `#[cfg(not(windows))]`-Gegenstück.
- `src-tauri/src/settings/mod.rs` — wie die Einstellungen aus der Datenbank gelesen werden (Einstieg, den `auto_compact_window` um Zeile 43 benutzt).
- `src-tauri/src/sessions/registry.rs` — `SessionState.station_of`, `status`; `limit_resumes` aus Phase 2.
- Windows-API: `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)` hält den Rechner wach, `SetThreadExecutionState(ES_CONTINUOUS)` gibt frei. **Der Zustand gehört dem aufrufenden Thread** und endet mit ihm — deshalb setzt ihn immer derselbe, langlebige Thread. Kein neues Crate: eigene Deklaration `#[link(name = "kernel32")] extern "system" { fn SetThreadExecutionState(flags: u32) -> u32; }` mit `ES_CONTINUOUS = 0x8000_0000`, `ES_SYSTEM_REQUIRED = 0x0000_0001`. Kein `ES_DISPLAY_REQUIRED` — der Bildschirm darf ausgehen.

## AK

1. `src-tauri/src/keep_awake/mod.rs` mit `KeepAwake::start(app)`: Thread `keep-awake`, Schleife alle 30 s: `wanted = settings.auto_continue_at_limit && registry.stations_busy()`; nur bei Wechsel `SetThreadExecutionState` rufen und den Wechsel ins Log schreiben (`eprintln!`, Text „Wachhalten an“ / „Wachhalten aus“).
2. `SessionRegistry::stations_busy` nach Kontrakt.
3. Unter Nicht-Windows ist der Aufruf ein No-Op (`#[cfg(not(windows))]`), der Thread läuft trotzdem nicht ins Leere (kein Panik, kein Busy-Loop).
4. Bei `RunEvent::Exit` gibt der Dienst frei (Nachricht an den Thread über einen `mpsc`-Kanal mit `recv_timeout(30 s)` als Schleifentakt; „Exit“ → `ES_CONTINUOUS`, Thread endet).
5. Prüfung am Gerät: Einstellung an, Station läuft → `powercfg /requests` (Admin-PowerShell) zeigt unter `SYSTEM:` einen Eintrag `[PROCESS] …\verwalter.exe`; nach Ende der Station spätestens 30 s später nicht mehr.
6. `pnpm check` grün.

## Checkliste

- [x] `keep_awake/mod.rs` neu, Modul-Kommentar: „Hält Windows wach, solange eine Station läuft oder aufs Kontingent wartet und die Einstellung ‚Nach Kontingent-Limit automatisch weiter‘ an ist (ADR 063).“
- [x] `lib.rs`: `mod keep_awake;`, in `.setup` nach dem `TerminalService` `KeepAwake::start(app.handle())` und `app.manage(...)`; in `RunEvent::Exit` Freigabe.
- [x] `registry.rs`: `stations_busy`.
- [x] `docs/code-map.md`: Querschnitt `keep_awake` (Wachhalten, nur Core); ADR 063 um „Umgesetzt mit eigener `extern`-Deklaration, kein Crate“ ergänzen, falls abweichend (nicht abweichend, ADR unverändert).

## Report-Back

**Status: complete.** AK 1–4 per Code, AK 6 per `cargo clippy --all-targets -D warnings` und `cargo fmt --check` grün. AK 5 (`powercfg /requests` am Gerät) steht aus — nach Plan-Abschluss im Betrieb.

- `KeepAwake::release` sendet „Exit“ und wartet auf das Ende des Threads; dieser löst den Zustand selbst (gleicher Thread wie beim Setzen).
- 🟡 Ein Lesefehler der Einstellung zählt als „nicht wachhalten“; der nächste 30-s-Takt korrigiert.
- 🟡 `stations_busy` sperrt die Sessions nacheinander, nie unter der Map-Sperre (Sperr-Regel der Registry).
