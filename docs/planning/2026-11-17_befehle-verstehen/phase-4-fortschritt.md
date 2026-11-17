# Phase 4 — Live-Fortschritt aus der Ausgabe

Rating: heikel. Solange ein Befehl oder Hintergrundprozess mit bekannter Ausgabedatei läuft, liest ein Wächter einmal je Sekunde das Ende der Datei, erkennt Fortschritt und letzte Zeile und meldet Änderungen an die Oberfläche — ohne Schreibzugriff auf die Datenbank. Noch keine neue Anzeige.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt („Fortschritt erkennen“, Konstanten, Typen), Wackelstellen
- `src-tauri/src/background/output.rs` — `read_tail`, `strip_ansi` (ggf. `pub(crate)` machen)
- `src-tauri/src/sessions/registry.rs` — `update`, `Outbox` (`emit`), `persist`, `summarize`, `touch_background`, Zweige `CommandTask` (Phase 1) und `TaskOutputFile`, `running_command` und `awaited_script` (Phase 3)
- `src-tauri/src/sessions/registry/commit_scan.rs` — Muster: Thread, der nach dem Freigeben der Sperre aus `update` gestartet wird
- `src-tauri/src/keep_awake/mod.rs` — Muster: Thread mit Schleife und Ende-Bedingung
- `src-tauri/examples/runs-probe.rs` (Phase 3)
- `docs/conventions/rust.md`
- Fehlerklassen geprüft (Vault `werkzeuge/claude-code`): „Hintergrund-Subagent friert ein — Ausgabedatei bleibt bei null Bytes“ → eine leere oder fehlende Datei ist ein gültiger Zustand (`progress` und `last_line` bleiben `None`), kein Fehler und kein Abbruch des Wächters.

## AK

1. `runs-probe progress <Datei>` druckt für eine Datei, die auf `step 7/12` endet, `Count 7/12` und die letzte Zeile; für `… [ 45%]` `Percent 45/100`; für eine Datei ohne Treffer `kein Fortschritt` und die letzte Zeile; für eine leere Datei `kein Fortschritt` und `keine Zeile`. Eine Zeile `1/1` oder `13/12` zählt nicht; `C:/a/2/3/x` zählt nicht.
2. Während ein Vordergrund-Befehl `for i in 1 … 12; do echo "[$i/12] Schritt"; sleep 2; done` läuft, trägt `SessionSummary.running_command` nach spätestens 4 s `progress` und `last_line` und ändert sie mit der Ausgabe; nach dem Ende ist `running_command` `null`.
3. Dasselbe für einen Hintergrundprozess, auf den die Session wartet: `awaited_script.progress` und `.last_line` folgen der Ausgabe.
4. Der Wächter endet, sobald der Eintrag nicht mehr läuft oder die Session gelöscht ist; je Eintrag läuft höchstens ein Wächter.
5. Eine Änderung des Stands schreibt nichts in die Datenbank und sendet genau eine Meldung `session://changed`; ohne Änderung wird nichts gesendet. Gezählt über einen 60-s-Lauf mit einer Ausgabezeile alle 2 s: höchstens 31 Meldungen durch den Wächter.
6. Beim Ende eines Eintrags bleiben `progress` und `last_line` am gespeicherten Eintrag stehen (letzter Stand).
7. `pnpm check` grün.

## Checkliste

### Erkennung

- [ ] `src-tauri/src/runs/progress.rs`: `read(tail: &str) -> (Option<RunProgress>, Option<String>)` genau nach dem Kontrakt; die zwei Muster als `LazyLock<Regex>` (Crate `regex` ist vorhanden); Konstanten `TAIL_BYTES`, `MAX_LAST_LINE_CHARS`.
- [ ] `runs-probe`: Unterbefehl `progress <Datei>` (liest mit `read_tail(path, TAIL_BYTES)` und druckt wie in AK 1).

### Wächter

- [ ] `src-tauri/src/sessions/registry/run_watch.rs`: `pub(super) fn schedule(app: AppHandle, session: Arc<Session>, item_id: String, file: String)` startet einen Thread `run-watch`. Schleife: `WATCH_INTERVAL` schlafen; ist `session.deleted` gesetzt → Ende; Datei mit `read_tail(Path::new(&file), TAIL_BYTES)` lesen (fehlt sie oder ist sie binär → leerer Stand); `progress::read`; dann `update(&app, &session, |state, outbox| …)`: Eintrag `id == item_id` suchen; fehlt er oder läuft er nicht mehr → Ende melden; weichen `progress` oder `last_line` vom gespeicherten Stand ab → setzen und `outbox.live_changed = true`. Ein Fehler aus `update` beendet den Wächter.
- [ ] `Outbox`: `live_changed: bool` (Stand eines laufenden Eintrags hat sich geändert, nur für die Oberfläche) und `run_watches: Vec<(String, String)>` (ID, Datei).
- [ ] `update`: `if outbox.summary_dirty || outbox.live_changed { outbox.summary = Some(summarize(..)) }`; `persist` bleibt unverändert und schreibt bei `live_changed` allein nichts. Nach `outbox.emit` je `run_watches` `run_watch::schedule` aufrufen (wie `commit_scan::schedule`).
- [ ] `Outbox::emit`: prüfen, dass eine gesetzte `summary` `session://changed` auslöst, auch wenn `summary_dirty` nicht gesetzt ist; sonst dort angleichen.
- [ ] Session-Zustand: `watched_runs: HashSet<String>`. Zweige `CommandTask` und `TaskOutputFile` sowie `end_task`, falls dort erstmals ein `output_file` gesetzt wird, während der Eintrag läuft: ist die ID noch nicht in `watched_runs` → eintragen und (ID, Datei) in `outbox.run_watches`. `finish_command`, `end_task` und das Unterbrechen eines Eintrags entfernen die ID.
- [ ] `running_command` und `awaited_script` (Phase 3) geben `progress` und `last_line` des Eintrags weiter.
- [ ] Wandert ein Befehl in den Hintergrund (`CommandBackgrounded`), läuft sein Wächter weiter: gleiche ID, gleiche Datei.

### Doku

- [ ] `docs/code-map.md`, Zeile „Läufe“: `progress.rs`, `run_watch.rs`, `live_changed`.
- [ ] `docs/glossary.md`: „Fortschrittszeile“ (`[erledigt/gesamt] …`), „Live-Fortschritt“.
- [ ] `docs/knowledge/claude-stream-json.md`: ein Satz, dass der Verwalter die Datei laufender Vordergrund-Befehle liest.

## Report-Back
