# Phase 4 — Schlanker Ausgabestil in Stationen

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Abschnitte „Entscheidungen“ (Nachtrag Phase 4) und „Kontrakt“ — [README.md](README.md)
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/linting.md`
- Code — dieselben Stellen wie Phase 1, Zeilennummern nach Phase 1 neu greifen:
  - `src-tauri/src/agents/claude/process.rs`: `SpawnOptions`, `common_args`.
  - `src-tauri/src/sessions/registry.rs`: `start_process`, Befüllung von `SpawnOptions`; `SessionState.station_of`.
  - `src-tauri/src/sessions/registry/side.rs` und `src-tauri/examples/side-probe.rs`: weitere Befüllungen von `SpawnOptions`.
  - `src-tauri/src/agents/claude/locate.rs`: private `config_dir()` liefert `CLAUDE_CONFIG_DIR` oder `~\.claude` — Grundlage für die Prüfung, ob der Stil installiert ist.
- Chesterton's Fence, verstanden: `common_args` ist mit Absicht für Hauptprozess und Nebenfrage gleich, damit die Nebenfrage den Prompt-Cache des Hauptprozesses liest (ADR 044). Der Ausgabestil steht im Systemprompt — eine Nebenfrage an eine Station muss deshalb denselben Stil bekommen wie die Station, sonst liest sie den Cache nicht.
- Beleg für den Nutzen: Der Ausgabestil des Benutzers (`vera`, 9 690 Byte) läuft in jedem Aufruf jeder Station mit; Stationen führen keinen Dialog. Der Stil `station` hat 596 Byte.
- Beleg für die Mechanik, gemessen am 06.11.2026: `claude -p --settings '{"outputStyle":"station"}'` lädt den Stil `station` (die Session zitiert dessen ersten Satz).

## AK dieser Phase

1. Liegt `<config_dir>\output-styles\station.md`, startet der Claude-Prozess jeder Station in der Betriebsart Claude mit `--settings {"outputStyle":"station"}`.
2. Fehlt die Datei, startet die Station ohne das Argument — wie bisher.
3. Einzel-Sessions starten nie mit dem Argument. Eine Nebenfrage bekommt das Argument genau dann, wenn ihre Session eine Station ist.
4. Rust-Test über `Command::get_args()`: mit `station_style: true` enthält `common_args` die beiden Argumente, mit `false` nicht. `pnpm check` ist grün.

## Checkliste

- [x] `process.rs`: `SpawnOptions` um `pub station_style: bool` erweitern. Doc-Kommentar: „Nur Stationen in der Betriebsart Claude, nur wenn der Stil `station` installiert ist: schlanker Ausgabestil statt des Benutzer-Stils.“
- [x] `common_args`: im Zweig `opts.local.is_none()` bei `opts.station_style` die Argumente `--settings` und `{"outputStyle":"station"}` anhängen.
- [x] `registry.rs`, `start_process`: `station_style` = `state.station_of.is_some() && backend.is_none() && codex_exe.is_none() && <config_dir>\output-styles\station.md existiert`. Die Prüfung als öffentliche Funktion `station_style_installed()` in `locate.rs`, damit `side.rs` sie mitbenutzt.
- [x] `side.rs`: `station_style` nach derselben Regel für die Session der Nebenfrage. `side-probe.rs`: `station_style: false`. Danach per Grep auf `SpawnOptions {` prüfen, dass keine Stelle fehlt.
- [x] Test wie AK 4 im `#[cfg(test)] mod tests` von `process.rs` (aus Phase 1 vorhanden).
- [x] `docs/glossary.md`: Eintrag „Station“ um einen Satz ergänzen: „Stationen laufen mit dem schlanken Ausgabestil `station`, wenn er installiert ist.“
- [x] `pnpm check`.

## Definition of Done

- AK 1–4 erfüllt, AK 4 durch Test belegt.
- Für den Benutzer sichtbar: Eine Station antwortet sachlich ohne Persona; Einzel-Sessions bleiben im eigenen Stil.
- Ausgeführt und mit Summary-Zeile im Report-Back festgehalten: `cargo test --manifest-path src-tauri/Cargo.toml process` und `pnpm check`.
- Seven-Goals-Check im Report-Back.

## Report-Back
