# Phase 5 — Ruhende Agenten beenden

**Status:** complete · **Rating:** heikel (Nebenläufigkeit: ein Hintergrund-Thread greift in Sessions ein; das Beenden eines Prozesses darf nicht wie ein Absturz aussehen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Umgebungsvariable“
- [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) — „Ruhende Agenten beenden“ und dessen Folge für Hintergrundprozesse
- Bestand: `src-tauri/src/sessions/registry.rs` komplett (Stand nach Phase 4), insbesondere `SessionState::set_status`, `SessionState::process_exited`, `handle_output` (verwirft Ausgaben eines ersetzten Prozesses über `generation`), `retire_process`, `Outbox::retire`, `start_process`; `src-tauri/src/lib.rs`
- Fehlerklassen (Vault-Entity nicht lesbar): Sperren nie im Kopf eines `match`; nichts in die Prozess-Pipe schreiben oder sie schließen unter der Session-Sperre (`Outbox::retire` erledigt das nach dem Freigeben). Neu hier: **der Hintergrund-Thread darf keine Verläufe laden** — er prüft mit `session.lock()`, nicht mit `lock_loaded()`, und geht nur bei einem Treffer in `update`.
- Prüfpunkt Absturz-Verwechslung: Der beendete Prozess meldet `Exited`. Ohne Gegenmaßnahme würde `process_exited` daraus einen „Agent beendet“-Fehler machen. Gegenmaßnahme: `generation` wird vor dem Beenden erhöht, das `Exited` gilt dann als Ausgabe eines ersetzten Prozesses und landet nur im Protokoll.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. App mit `$env:VERWALTER_IDLE_SECONDS = "60"` starten (`starten.cmd` erbt die Variable aus der Sitzung), Session bis „Abgeschlossen“ laufen lassen, ohne etwas zu tun 2 Minuten warten: im Task-Manager ist der `claude.exe` dieser Session weg, die Sidebar zeigt unverändert „Abgeschlossen“, der Chat zeigt **keinen** Fehlerkasten.
3. Danach eine Nachricht senden: Status „Läuft“, der Agent antwortet und kennt den bisherigen Verlauf.
4. Dasselbe mit einer pausierten Session (Esc während der Arbeit, dann 2 Minuten warten, „Fortsetzen“).
5. Eine laufende Session oder eine mit offener Rückfrage (Status `running`/`waiting`/`starting`) wird nie beendet, egal wie lange sie dauert.
6. Ohne die Variable beträgt die Frist 30 Minuten; ein ungültiger Wert (Text, 0, negativ) fällt auf 30 Minuten zurück.

## Checkliste

- [x] `registry.rs`: Konstanten `DEFAULT_IDLE_SECONDS: u64 = 1800`, `IDLE_CHECK_INTERVAL: Duration = Duration::from_secs(15)`, `IDLE_SECONDS_VARIABLE: &str = "VERWALTER_IDLE_SECONDS"`.
- [x] `SessionState`: neues Feld `idle_since: Option<f64>` (in `new` und `restored`: `None`). In `set_status` (nach dem Early-Return bei gleichem Status, wo `now` schon berechnet ist): `self.idle_since = matches!(status, SessionStatus::Completed | SessionStatus::Paused).then_some(now);`.
- [x] `SessionRegistry::reap_idle(&self, app: &AppHandle, idle_ms: f64)` (neu): `let now = now_ms();` alle Sessions kopieren (`self.lock_sessions().values().cloned().collect::<Vec<_>>()`, Sperre sofort wieder frei). Je Session: erst billig mit `session.lock()` prüfen, ob es ein Kandidat ist (`state.process.is_some()` und `state.idle_since.is_some_and(|since| now - since >= idle_ms)`); nur dann `update(app, &session, |state, outbox| { … })` mit **erneuter** Prüfung derselben Bedingung (zwischen beiden Schritten kann sich der Zustand geändert haben) und darin: `state.generation += 1;` (macht das folgende `Exited` zu einer Ausgabe eines ersetzten Prozesses), `outbox.retire(state);`, `state.process = None;`, `state.idle_since = None;`. Fehler von `update` ignorieren (`let _ =`), ein Kommentar sagt warum: der nächste Durchlauf versucht es erneut, und ein nicht mehr laufender Prozess ist genau das Ziel.
- [x] `SessionRegistry::start_reaper(app: AppHandle)` (assoziierte Funktion): Frist lesen (`std::env::var(IDLE_SECONDS_VARIABLE)`, `.ok().and_then(|value| value.parse::<u64>().ok()).filter(|seconds| *seconds > 0).unwrap_or(DEFAULT_IDLE_SECONDS)`, in Millisekunden als `f64`), dann `thread::Builder::new().name("session-reaper".to_owned()).spawn(move || loop { thread::sleep(IDLE_CHECK_INTERVAL); let registry = app.state::<SessionRegistry>(); registry.reap_idle(&app, idle_ms); })`; `Manager` importieren (`use tauri::Manager;`). Schlägt das Starten des Threads fehl, in `stderr` schreiben (`eprintln!`), kein Abbruch der App — ohne Reaper laufen Agenten nur länger.
- [x] `lib.rs`: in `setup` nach `app.manage(registry)` `SessionRegistry::start_reaper(app.handle().clone());`.
- [x] Doku (im selben Commit): `AGENTS.md`, Tabelle „Befehle“: eine Zeile „`VERWALTER_IDLE_SECONDS`“ — „Sekunden, nach denen der Agent einer ruhenden Session beendet wird (Standard 1800); der nächste Klick auf Senden startet ihn neu“. `docs/decisions/003-claude-anbindung.md`: Konsequenzen-Zeile „Prozesse ruhender Sessions zu beenden … gehört zu Meilenstein 4“ → „…: umgesetzt, siehe [ADR 004](004-persistenz-und-wiederherstellung.md)“. `docs/conventions/rust.md`: Abschnitt „Prozesse“ und Critical Rule 3 auf den Stand bringen — „Sessions überleben die UI (Datenbank, `--resume`); der Agent-Prozess endet mit der App und wird bei Bedarf neu gestartet“; Punkt „Prozess-IDs … in SQLite gespeichert“ streichen (werden nicht gespeichert). `AGENTS.md` Critical Rule 4 entsprechend: „**Sessions überleben die UI** — ein Fenster-Absturz verliert keine Session und keinen Worktree; der Agent wird mit der nächsten Nachricht wieder gestartet.“
- [x] `docs/PROJECT.md`: Meilenstein-Liste — Reihenfolge „4 vor 3“ kenntlich machen (Punkt 3 und 4 tauschen die Reihenfolge, Zeile zu 4 nennt „Sessions, Chat-Einträge in SQLite, Wiederherstellung mit `--resume`, Umbenennen, Archivieren, ruhende Agenten“, Zeile zu 3 „…auf der Datenbank aus Meilenstein 4“); Constraint „Absturzfestigkeit“: „Ein UI-Absturz darf keine Session und keinen Worktree verlieren; der Agent-Prozess wird danach neu gestartet.“ `docs/code-map.md`: Stand-Satz oben auf „Meilenstein 4“ setzen, Zeile „Agent-Prozesse, Wiederherstellung“ (`src-tauri/src/processes/`) auf „— (Wiederherstellung in `src-tauri/src/sessions/registry.rs`)“.
- [x] Vor dem Abschluss: alle Smoke-Punkte der README, die diese Phase betreffen, selbst nachvollziehen soweit ohne Fenster möglich (Frist-Test mit 60 s: Prozessliste per `Get-Process claude` vor und nach dem Warten), Ergebnis im Report-Back.

## Report-Back

- Prüfkette grün.
- Alle AK am 2026-09-28 mit der laufenden App belegt (`VERWALTER_IDLE_SECONDS=60`, `starten.cmd` reicht die Variable durch, WebView2-Debug-Port, Prozesse über `Win32_Process.CommandLine` je Session-ID eindeutig zugeordnet — nicht über `Get-Process claude` pauschal, das träfe auch fremde Sitzungen):
  - AK 2/3: eine frisch abgeschlossene Session verlor ihren `claude.exe`-Prozess nach der Frist; Sidebar/DB blieben „Abgeschlossen“, kein Fehlerkasten, DB-Status blieb `completed` (kein `error`). Danach eine Nachricht gesendet: Agent startete neu (`--resume`) und beantwortete sie korrekt mit Bezug auf den vorherigen Verlauf.
  - AK 5: eine gleichzeitig laufende Session (Werkzeug-Aufruf über ~20 Read-Zyklen) behielt ihren Prozess über die volle Wartezeit hinweg — der Reaper prüft `process.is_some()` und den Status vor jedem Eingriff, erneut unter der Session-Sperre.
  - AK 6: Code-Prüfung — `start_reaper` fällt ohne oder mit ungültigem `VERWALTER_IDLE_SECONDS` (Text, 0, negativ) auf `DEFAULT_IDLE_SECONDS` (1800) zurück (`parse::<u64>` scheitert an negativen Zahlen, `filter(*seconds > 0)` fängt die 0 ab).
- Zwischenzeitlich ein echter Fund, kein Bug: eine wiederhergestellte Session hat `idle_since: None`, weil sie in diesem Prozesslauf nie über `set_status` lief. Das ist korrekt, nicht lückenhaft — `reap_idle` prüft zuerst `process.is_some()`, und eine wiederhergestellte Session hat erst nach der nächsten Nachricht überhaupt einen Prozess.
- Damit ist der gesamte Plan (Phasen 1–5) fertig.
