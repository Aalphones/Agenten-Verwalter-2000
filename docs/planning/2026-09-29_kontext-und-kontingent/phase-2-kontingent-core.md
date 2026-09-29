# Phase 2 — Core: Kontingent über einen Hilfsprozess

Rating: heikel (Prozess-Lebensdauer, Zeitlimit, Threads) · Commit-Scope: `usage`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Festgelegte Entscheidungen“ und „Kontrakt“ — verbindlich.
- [claude-stream-json.md](../../knowledge/claude-stream-json.md), Abschnitt „Kontext und Kontingent abfragen“ (Antwortformat von `get_usage`, Schalter des Hilfsprozesses, warum nicht `--bare`).
- ADR 008 (aus Phase 1).
- [docs/conventions/rust.md](../../conventions/rust.md).
- Code: `src-tauri/src/agents/claude/process.rs` (`build_command`: Schalter-Stil, `hide_console`), `src-tauri/src/agents/claude/locate.rs` (`find_claude`), `src-tauri/src/agents/claude/protocol.rs` (`control_request`, `get_context_usage` aus Phase 1), `src-tauri/src/agents/claude/stats.rs` (aus Phase 1, Muster für nachsichtiges Lesen), `src-tauri/src/processes/mod.rs` (`hide_console`), `src-tauri/src/filesystem/workspace.rs` (`data_dir`), `src-tauri/src/lib.rs` (`setup`, `app.manage`, `generate_handler!`), `src-tauri/src/commands/background.rs` (Muster Commands).
- Vault-Fehlerklassen: geprüft — keine einschlägig.

## Abnahmekriterien

1. `usage_refresh(false)` startet einen Abruf, wenn keiner läuft und der letzte Start ≥ 30 s her ist; sonst tut es nichts. `usage_refresh(true)` startet, wenn keiner läuft. Der Command kehrt sofort zurück (Abruf in eigenem Thread).
2. Beim Start eines Abrufs ist `is_loading` `true` und es geht ein `usage://changed` hinaus; beim Ende `is_loading` `false`, ein weiteres `usage://changed`.
3. Erfolg: `snapshot` ist der neue Stand (`fetched_at = now`), `error` ist `None`. Fehler (Programm nicht gefunden, Start scheitert, Zeitlimit 20 s, Prozess endet ohne Antwort, `subtype: "error"`, Antwort unlesbar): `error` trägt einen deutschen Satz, `snapshot` bleibt der vorige.
4. Der Hilfsprozess wird in jedem Fall beendet und eingesammelt (`kill` + `wait`), auch bei Zeitlimit und Fehlern; er startet ohne Konsolenfenster, mit Arbeitsverzeichnis `data_dir`, mit genau den Schaltern aus der Wissensdatei.
5. `usage_snapshot` liest: `subscription_type` → `plan`; `rate_limits.limits[]` → `limits` (Einträge ohne `kind` oder `percent` fallen weg, `severity` fehlt → `"normal"`); `behaviors.day`/`.week` → `day`/`week` mit `behaviors[]` (`key`, `pct`) und `skills[]` (`name` → `key`, `pct`). Fehlt `rate_limits` oder ist `rate_limits_available` `false`, ist `limits` leer — kein Fehler.
6. `usage_load` liefert den Zwischenspeicher sofort, ohne einen Abruf zu starten.
7. `pnpm bindings` erzeugt die sechs Usage-Typen; `pnpm check` grün.

## Checkliste

### Typen

- [ ] Neues Modul `src-tauri/src/usage/` mit `mod.rs` und `model.rs`; `pub mod usage;` in `lib.rs`. `model.rs`: die sechs Typen aus dem README-Kontrakt, `derive(Debug, Clone, Serialize, TS)`, `camelCase`. In `gen-bindings.rs` eintragen.

### Einmal-Anfrage an einen Hilfsprozess

- [ ] Neue Datei `src-tauri/src/agents/claude/helper.rs` (in `agents/claude/mod.rs` eintragen): `pub fn ask_once(exe: &Path, cwd: &Path, request: Value, timeout: Duration) -> Result<Value, String>`.
  - `Command::new(exe)`, `current_dir(cwd)`, `stdin`/`stdout` `piped`, `stderr` `null`, Schalter `-p --input-format stream-json --output-format stream-json --verbose --strict-mcp-config --no-session-persistence`, `hide_console(&mut command)`. Start scheitert → `Err("Claude-Kommandozeile startet nicht: {error}")`.
  - `control_request(REQUEST_ID, request)` + `\n` auf stdin schreiben und flushen; stdin **offen lassen** (in der Probe blieb es offen). Konstante `REQUEST_ID: &str = "verwalter-usage"`.
  - Lese-Thread über `BufReader::new(stdout).lines()`: jede Zeile als `serde_json::Value`; bei `type == "control_response"` und `response.request_id == REQUEST_ID` → bei `response.subtype == "success"` `Ok(response.response)` (fehlt → `Value::Null`), sonst `Err("Claude lehnt die Abfrage ab: {response.error}")`; Ergebnis über `std::sync::mpsc::channel` senden und den Thread beenden. EOF ohne Treffer → `Err("Claude beendete sich ohne Antwort")`.
  - Hauptfaden: `receiver.recv_timeout(timeout)`; Zeitlimit → `Err("Claude antwortete nicht innerhalb von 20 s")`. Danach **immer** `child.kill()` (Fehler ignorieren) und `child.wait()` — auch auf dem Fehlerweg. Kommentar: ohne `wait` bliebe ein Prozess-Handle offen; der Lese-Thread endet mit dem EOF nach `kill`.
- [ ] `protocol.rs`: `pub fn get_usage() -> Value { json!({ "subtype": "get_usage" }) }` mit Doc-Kommentar (experimentell im SDK).
- [ ] `stats.rs`: `pub fn usage_snapshot(body: &Value) -> Option<UsageSnapshot>` nach AK 5, private `Deserialize`-Structs in `snake_case` mit `Option`-Feldern; `None` nur, wenn `body` kein Objekt ist. `percent`/`pct` sind Zahlen (auch mit Nachkommastellen denkbar) → als `f64` lesen, `round()`, auf `0..=100` begrenzen, `as u32`. `fetched_at: 0.0`.

### Zwischenspeicher und Abruf

- [ ] `usage/mod.rs`: `pub struct UsageService { cache: Mutex<UsageCache> }`, privat `struct UsageCache { snapshot: Option<UsageSnapshot>, error: Option<String>, is_loading: bool, last_started: Option<Instant> }`. Konstanten `MIN_REFRESH_INTERVAL = Duration::from_secs(30)`, `HELPER_TIMEOUT = Duration::from_secs(20)`, `USAGE_CHANGED_EVENT = "usage://changed"`.
  - `pub fn new() -> UsageService`; `pub fn status(&self) -> UsageStatus` (Kopie).
  - `pub fn refresh(&self, app: &AppHandle, force: bool)`: unter der Sperre prüfen (AK 1), dann `is_loading = true`, `last_started = Some(Instant::now())`; Sperre freigeben; `app.emit(USAGE_CHANGED_EVENT, ())`; `thread::spawn` mit geklontem `AppHandle`: `find_claude()` (`None` → Fehler „Claude-Kommandozeile nicht gefunden“), `data_dir(&app)` (Fehler → Text), `helper::ask_once(&exe, &dir, get_usage(), HELPER_TIMEOUT)`, dann `stats::usage_snapshot` (`None` → „Antwort von Claude unlesbar“). Ergebnis über `app.state::<UsageService>()` eintragen (`fetched_at` = Millisekunden seit 1970 wie `now_ms` im Registry — kleine eigene Funktion, nicht aus `sessions` importieren), `is_loading = false`, `usage://changed` senden. Fehler beim Senden eines Ereignisses nur mit `eprintln!` melden.
  - Kommentar am Typ: warum Hilfsprozess statt Session-Agent (ADR 008).
- [ ] `lib.rs`: `app.manage(UsageService::new())` im `setup` neben `registry`/`database`.

### Commands

- [ ] Neue Datei `src-tauri/src/commands/usage.rs` (in `commands/mod.rs`): `usage_load(service: State<UsageService>) -> UsageStatus` und `usage_refresh(app, service, force: bool)`, beide `async`, Rückgabe `Result<…, CommandError>` wie die übrigen Commands. In `generate_handler!`.
- [ ] `pnpm bindings`, `pnpm check`.

### Doku

- [ ] `docs/conventions/commits.md`: Scope `usage`.
- [ ] `docs/code-map.md`: Zeile „Kontingent (Usage des Abos)“ mit Core `src-tauri/src/usage/` (Zwischenspeicher, Abruf), `src-tauri/src/agents/claude/helper.rs` (Hilfsprozess), `stats.rs` (Lesen), `src-tauri/src/commands/usage.rs`; Oberfläche „folgt (Phase 3)“. `usage` in die Feature-Liste.

## Report-Back
