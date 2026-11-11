# Phase 2 — Warten und Weiterschicken für Stationen

**Rating:** heikel · **Wave:** 2 · **Modell:** opus

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans, Abschnitt **Kontrakt** (Warten) — verbindlich.
- Ergebnis von Phase 1: `src-tauri/src/limit_resume/mod.rs`, `Outbox.limit_stop`, Einstellung `auto_continue_at_limit`, ADR 063.
- Referenzmuster für einen Zeitgeber mit Marke: `src-tauri/src/implementation/mod.rs` `Countdowns` (um Zeile 56–110: `begin` gibt eine Marke, `take` prüft sie, `cancel` entfernt) und `src-tauri/src/implementation/start.rs` `schedule_station` (um Zeile 167: eigener `std::thread::Builder`-Thread, `fire` um Zeile 195). Kein tokio im Projekt.
- `src-tauri/src/sessions/auto_handoff.rs` `consider` (um Zeile 37) — wie ein Folgeschritt nach `outbox.emit` ohne Session-Sperre angestoßen wird.
- `src-tauri/src/sessions/registry.rs`: Ende von `update` (um Zeile 3636–3650), `SessionRegistry::send` (um Zeile 1142), `is_station` (um Zeile 2247), `implementation_countdowns` (Zeile 135/412) und die Wrapper in `src-tauri/src/sessions/registry/implementation.rs` (`begin_countdown` Zeile 448 ff., `cancel_countdowns_of` Zeile 387).
- `src-tauri/src/implementation/model.rs` `StationState` (um Zeile 27) mit `urgency_rank`; `src-tauri/src/implementation/mod.rs` `state_of` (um Zeile 483) und `build_view` (Zeile 345), `announce` (Zeile 157).
- Abbrechen und Löschen einer Umsetzung: ADR 060 (`docs/decisions/060-umsetzung-abbrechen-und-loeschen.md`) und deren Einstieg in `src-tauri/src/implementation/` bzw. `commands/` — dort zusätzlich die Wartezeit der Stationen verwerfen.

## AK

1. Nach einem Limit-Stopp einer Station (`is_station()`) bei Einstellung `auto_continue_at_limit = true` und `attempts < MAX_ATTEMPTS`: `LimitResumes::begin(session_id, resume_at_ms(reset_at, now))`, Versuchszähler +1. Kein zusätzlicher Verlaufseintrag: der Eintrag „Kontingent aufgebraucht“ aus Phase 1 bleibt, die Uhrzeit des Weiterlaufens zeigen Karte, Zeitleiste und Sidebar über `resumes_at` (Phase 4). Grund: ein neuer Hinweis-Typ (`ChatEntry::Notice`, ADR 033) bräuchte eigene Oberfläche.
2. Ein Thread `limit-resume` prüft alle `POLL` (30 s) die Wanduhr (nicht `sleep` bis zum Ziel — Schlaf und Uhrumstellung dürfen den Zeitpunkt nicht verschieben); ist `now_ms >= resume_at`, ruft er `take(session_id, token)` und bei `true` `SessionRegistry::send(app, session_id, RESUME_TEXT, &[], &[])`. Scheitert `send`, schreibt er die Fehlermeldung ins Session-Log und endet.
3. `LimitResumes::cancel(session_id)` läuft, wenn der Benutzer der Session eine Nachricht schickt (in `SessionRegistry::send` vor dem Senden, außer der Aufruf kommt aus dem Thread selbst — dafür entfernt `take` den Eintrag schon vorher), wenn die Umsetzung abgebrochen oder gelöscht wird und wenn die Session geschlossen wird.
4. Endet eine Antwort der Station normal (`TurnEnd::Completed`), `reset_attempts(session_id)`.
5. `attempts >= MAX_ATTEMPTS` oder Einstellung aus oder keine Station: kein Warten; die Station steht auf „wartet auf dich“.
6. `StationState::WaitsForLimit` mit `urgency_rank` 3 (wie `Running`); `build_view` setzt ihn und `resumes_at`, wenn die Session der Station in `limit_resumes.ends()` steht; sonst `resumes_at = None`. `announce` läuft beim Beginnen und beim Verwerfen, damit Karte und Sidebar sofort umschalten.
7. Unit-Tests in `src-tauri/src/limit_resume/tests.rs`: `resume_at_ms` (Reset in der Zukunft → Reset·1000 + 120 000; Reset in der Vergangenheit und `None` → now + 900 000); `LimitResumes` (`begin` ersetzt alte Marke, `take` mit alter Marke `false`, `cancel` → `any_waiting() == false`, Zähler bis `MAX_ATTEMPTS`).
8. Nach App-Neustart wartet nichts (nur im Speicher, wie ADR 040).
9. `pnpm bindings` erzeugt `'waitsForLimit'` und `resumesAt`; `pnpm check` und `cargo test` grün (Phase 4 baut die Texte; bis dahin darf `src/` die neuen Werte in `switch`-Anweisungen mit einem vorläufigen Text abdecken, damit der Typecheck grün bleibt — die finalen Texte setzt Phase 4).

## Checkliste

- [ ] `limit_resume/mod.rs`: `LimitResumes`, Konstanten und `resume_at_ms` nach Kontrakt; Doc-Kommentare je Konstante (Puffer: „Kontingent ist zum Reset-Zeitpunkt nicht immer sofort frei.“; Rückfall: „ohne bekannte Reset-Zeit“; Versuche: „Bremse gegen eine Schleife aus Limit-Stopps.“).
- [ ] `limit_resume/mod.rs`: `pub fn consider(app: &AppHandle, session: &Arc<Session>, stop: LimitStop)` — prüft Einstellung, `is_station`, Versuche; beginnt das Warten; startet den Thread.
- [ ] `registry.rs`: Feld `limit_resumes: Mutex<LimitResumes>` in `SessionRegistry` + Wrapper wie `begin_countdown`.
- [ ] `registry.rs` Ende von `update`: nach dem `auto_handoff`-Block `if let Some(stop) = outbox.limit_stop.take() { limit_resume::consider(app, session, stop); }`.
- [ ] `registry.rs` `end_turn` Zweig `Completed`: Versuchszähler zurücksetzen (Hinweis an `update` über `Outbox`, falls die Registry dort nicht erreichbar ist).
- [ ] Abbrechen/Löschen einer Umsetzung und Schließen einer Session: `cancel` für alle betroffenen Session-IDs.
- [ ] `implementation/model.rs`: `WaitsForLimit` (Doc-Kommentar „Vom Kontingent-Limit gestoppt; läuft zur Reset-Zeit von selbst weiter (ADR 063).“), `urgency_rank` 3; `StationView.resumes_at`.
- [ ] `implementation/mod.rs` `build_view`: Zustand und `resumes_at` aus `limit_resumes.ends()`.
- [ ] Tests nach AK 7; `pnpm bindings`.
- [ ] `docs/code-map.md` Zeile „Umsetzung“: `limit_resume` (Warten am Kontingent-Limit, ADR 063) ergänzen; `docs/glossary.md` **Station**: Zustand „wartet aufs Kontingent“ ergänzen.

## Report-Back
