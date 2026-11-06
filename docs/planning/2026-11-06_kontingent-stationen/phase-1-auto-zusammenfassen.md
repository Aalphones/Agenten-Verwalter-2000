# Phase 1 — Automatisch zusammenfassen in Stationen

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Abschnitte „Entscheidungen“ und „Kontrakt“ — [README.md](README.md)
- Konventionen: `docs/conventions/rust.md`, `docs/conventions/react.md`, `docs/conventions/tailwind.md`, `docs/conventions/linting.md`
- ADR-Muster: `docs/decisions/057-modell-und-aufwand-der-station.md`
- Messwerte zum Zusammenfassen: `docs/knowledge/claude-stream-json.md`, Abschnitt „Cache, Kontingent, Zusammenfassung, Kosten“
- Code Kern:
  - `src-tauri/src/agents/claude/process.rs`: `SpawnOptions` Zeile 18–48, `common_args` Zeile 145–222.
  - `src-tauri/src/sessions/registry.rs`:
    - `start_process` ab Zeile 3797; dort wird `SpawnOptions` in Zeile 3871–3889 befüllt, mit den Variablen `backend` und `codex_exe`.
    - Das Feld `SessionState.station_of` steht in Zeile 338, `Session::is_station` in Zeile 2239.
    - `Session` hat das private Feld `database: Arc<Database>` in Zeile 200.
  - `src-tauri/src/sessions/registry/side.rs`: Befüllung von `SpawnOptions` in Zeile 110–128.
  - `src-tauri/examples/side-probe.rs`: Zeile 70 baut ebenfalls `SpawnOptions`.
  - `src-tauri/src/settings/model.rs`: `Settings` Zeile 62–86, `SettingsChange` Zeile 103–151.
  - `src-tauri/src/settings/mod.rs`:
    - Schlüssel-Konstanten Zeile 21–32, `DEFAULT_SETTINGS` Zeile 57–76, `load` Zeile 78–126, `update` Zeile 129–210.
    - Muster für einen Wahrheitswert: `mark_unsourced`. Muster für eine Zahl mit Bereich: `terminal_height` mit `TERMINAL_SIZE_RANGE`.
- Code Oberfläche:
  - `src/components/Switch.tsx` und `Switch.css` sind das Muster für die neue Komponente (BEM, Tokens wie `--color-accent`, `--radius-full`, `--duration-base`).
  - `src/features/settings/settingsCatalog.ts`: `ENTRY_DATA` Zeile 49–162; neue Zeile = Eintrag hier plus Zweig in `renderRow`.
  - `src/features/settings/SettingsView.tsx`: `renderRow` Zeile 308–513, Muster `case 'markUnsourced'` Zeile 443–454.
  - `src/features/settings/SettingRow.tsx` (ⓘ-Erklärung).
- Unverändert, nur zum Verständnis: `src/features/context/ContextPanel.tsx` Zeile 156–161 zeigt die Schwelle aus `get_context_usage` schon an; `src/features/notices/CompactDivider.tsx` zeigt eine Zusammenfassung im Chat schon an.
- Vault-Fehlerklassen: keine Entity für Rust, React, TypeScript, Tauri oder Claude Code im Vault vorhanden (Glob am 06.11.2026).

## AK dieser Phase

1. `Settings` trägt `auto_compact_stations` (Standard `true`) und `auto_compact_threshold` (Standard `250000`). Beide werden gespeichert und überleben einen Neustart der App.
2. `update` lehnt eine Schwelle außerhalb 150 000–500 000 ab, mit dem Text „Schwelle außerhalb 150 000–500 000 Tokens“. `load` liest einen gespeicherten Wert außerhalb des Bereichs als Standard.
3. `settings::auto_compact_window` liefert `None` bei ausgeschaltetem Schalter und sonst `Schwelle + 33 000`.
4. `common_args` setzt `CLAUDE_CODE_AUTO_COMPACT_WINDOW` genau dann, wenn `opts.auto_compact_window` `Some` ist. Belegt durch einen Rust-Test über `Command::get_envs()`.
5. `start_process` setzt `auto_compact_window` nur für Stationen (`state.station_of.is_some()`) in der Betriebsart Claude (`backend.is_none() && codex_exe.is_none()`). Nebenfragen und `side-probe` setzen `None`.
6. Einstellungen → Agent → Abschnitt „Umsetzungen“ zeigt den Schalter „Automatisch zusammenfassen“ und, nur wenn er an ist, den Regler „Zusammenfassen ab“ mit Anzeige des Werts (z. B. „250k Tokens“). Beide haben eine ⓘ-Erklärung. Der Regler speichert erst beim Loslassen bzw. nach einer Pfeiltaste.
7. Probe belegt, dass Claude Code im Druckmodus mitten im Durchlauf zusammenfasst. Ergebnis in `artifacts/phase-1-probe-compact.txt` (siehe Checkliste).
8. `pnpm bindings` und `pnpm check` laufen grün; ADR 058 liegt in `docs/decisions/`.

## Checkliste

- [ ] **Probe zuerst** (vor dem Code, damit ein Fehlschlag die Phase stoppt). Im Repo-Wurzelordner in PowerShell:
  ```powershell
  $env:CLAUDE_CODE_AUTO_COMPACT_WINDOW = '100000'
  '{"type":"user","message":{"role":"user","content":"Lies nacheinander mit dem Read-Werkzeug vollständig: docs/konzept.md, docs/glossary.md, docs/code-map.md, docs/PROJECT.md, docs/knowledge/claude-stream-json.md. Nenne danach je Datei die Zeilenzahl."}}' | claude -p --input-format stream-json --output-format stream-json --verbose --model claude-sonnet-5-5 --max-turns 15 > $env:TEMP\probe-compact.jsonl
  Remove-Item Env:CLAUDE_CODE_AUTO_COMPACT_WINDOW
  ```
  - Aus der Ausgabe nur die Zeile mit `"subtype":"compact_boundary"` und die `result`-Zeile, gekürzt auf je 300 Zeichen, nach `docs/planning/2026-11-06_kontingent-stationen/artifacts/phase-1-probe-compact.txt` schreiben. Die ganze Ausgabe nicht committen.
  - Erwartet: `compact_boundary` mit `"trigger":"auto"` steht **vor** `result`.
  - Fehlt sie: Eintrag in `FINDINGS.md`, Phase anhalten, Rückfrage an den Benutzer. Ohne Zusammenfassen mitten im Durchlauf wirkt der Hebel nicht.
- [ ] `src-tauri/src/settings/model.rs`:
  - `Settings` um `pub auto_compact_stations: bool` und `pub auto_compact_threshold: u32` erweitern, jeweils mit Doc-Kommentar.
  - `SettingsChange` um `AutoCompactStations { value: bool }` und `AutoCompactThreshold { value: u32 }` erweitern.
- [ ] `src-tauri/src/settings/mod.rs`:
  - Konstanten `KEY_AUTO_COMPACT_STATIONS = "auto_compact_stations"`, `KEY_AUTO_COMPACT_THRESHOLD = "auto_compact_threshold"` sowie die beiden `pub const` aus dem Kontrakt. Kommentar am Puffer: „Abstand zwischen Fenster und Schwelle; gemessen 06.11.2026: 283 000 → 250 000, 280 000 → 247 000“.
  - `DEFAULT_SETTINGS`: `auto_compact_stations: true`, `auto_compact_threshold: 250_000`.
  - `load`: den Wahrheitswert wie `mark_unsourced` lesen; die Zahl wie `terminal_height`, zusätzlich `.filter(|value| AUTO_COMPACT_THRESHOLD_RANGE.contains(value))`.
  - `update`: Bereichsprüfung wie bei `TerminalHeight` mit dem Fehlertext aus AK 2; zwei neue Zweige im `match`, geschrieben per `setting_rows::write`.
  - Neue Funktion `pub fn auto_compact_window(settings: &Settings) -> Option<u32>`: `settings.auto_compact_stations.then(|| settings.auto_compact_threshold + AUTO_COMPACT_BUFFER)`.
  - Tests im vorhandenen bzw. neuen `#[cfg(test)] mod tests` der Datei: Standardwerte; `auto_compact_window` an/aus.
- [ ] `src-tauri/src/agents/claude/process.rs`:
  - `SpawnOptions` um `pub auto_compact_window: Option<u32>` erweitern. Doc-Kommentar: „Nur Stationen in der Betriebsart Claude (ADR 058): Fenster für das automatische Zusammenfassen; `None` = Standard der Kommandozeile.“
  - In `common_args` direkt nach der Zeile mit `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`:
    ```rust
    if let Some(window) = opts.auto_compact_window {
        command.env("CLAUDE_CODE_AUTO_COMPACT_WINDOW", window.to_string());
    }
    ```
  - Test (`#[cfg(test)] mod tests` am Dateiende, anlegen falls nicht vorhanden): `SpawnOptions` mit allen Feldern bauen, `common_args(&mut command, &opts, "default")` aufrufen. Prüfen, dass `command.get_envs()` den Schlüssel `CLAUDE_CODE_AUTO_COMPACT_WINDOW` mit `283000` enthält; mit `None` fehlt der Schlüssel.
- [ ] `src-tauri/src/sessions/registry.rs`, `start_process`: vor `spawn(SpawnOptions { … })`
  ```rust
  // Nur Stationen fassen automatisch zusammen (ADR 058); Einzel-Sessions steuert der Benutzer.
  let auto_compact_window =
      if state.station_of.is_some() && backend.is_none() && codex_exe.is_none() {
          settings::load(&session.database)
              .ok()
              .and_then(|loaded| settings::auto_compact_window(&loaded))
      } else {
          None
      };
  ```
  Dann in `SpawnOptions { … }` `auto_compact_window,` ergänzen; der Import ist `crate::settings`. Steht `backend` dort unter anderem Namen, die Variable verwenden, aus der `local: backend.cloned()` gebildet wird.
- [ ] `src-tauri/src/sessions/registry/side.rs` und `src-tauri/examples/side-probe.rs`: `auto_compact_window: None` mit Kommentar „Nebenfragen fassen nie zusammen“. Danach per Grep auf `SpawnOptions {` prüfen, dass keine weitere Stelle fehlt.
- [ ] `src/components/Slider.tsx` und `Slider.css` (neu, Muster `Switch`):
  - Props: `value: number`, `min: number`, `max: number`, `step: number`, `label: string` (zugänglicher Name), `format: (value: number) => string`, `disabled?: boolean`, `onCommit: (value: number) => void`.
  - Aufbau: `<div className="slider">`, darin `<input type="range" className="slider__input" aria-label={label} aria-valuetext={format(draft)} …>` und `<span className="slider__value">{format(draft)}</span>`.
  - `draft` per `useState(value)`; ein `useEffect` gleicht `draft` an, wenn sich `value` ändert. `onChange` setzt nur `draft`. `onPointerUp`, `onKeyUp` und `onBlur` rufen `onCommit(draft)`, wenn `draft !== value`.
  - CSS: Breite 160px, Akzentfarbe über `accent-color: var(--color-accent)`, Fokusrahmen wie `.switch:focus-visible`, `&:disabled` wie bei `.switch`, Wert rechts daneben mit `font-variant-numeric: tabular-nums`.
- [ ] `src/features/settings/settingsCatalog.ts`: zwei Einträge direkt hinter `markUnsourced`, Kategorie `'agent'`, Abschnitt `'Umsetzungen'`, beide mit `isShown: (settings) => settings.operatingMode === 'claude'`; der Regler zusätzlich nur bei `settings.autoCompactStations`.
  - `autoCompactStations`, Label „Automatisch zusammenfassen“, ⓘ: „Fasst den Verlauf einer Station automatisch zusammen, sobald ihr Kontext die Schwelle erreicht; danach arbeitet sie mit einer Kurzfassung weiter. Spart Kontingent, weil jeder weitere Schritt weniger Verlauf mitliest. Gilt nur für Stationen einer Umsetzung, nie für einzelne Sessions — dort fasst du mit /compact selbst zusammen. Wirkt ab dem nächsten Start einer Station.“
  - `autoCompactThreshold`, Label „Zusammenfassen ab“, ⓘ: „Kontextgröße, ab der eine Station zusammenfasst. Niedriger spart mehr, fasst aber öfter zusammen, und jede Zusammenfassung verliert Einzelheiten. Bei 250k fasst eine Station meist höchstens zweimal zusammen.“
- [ ] `src/features/settings/SettingsView.tsx`, `renderRow`:
  - `case 'autoCompactStations'` als `Switch` nach dem Muster von `markUnsourced`, gespeichert mit `save({ kind: 'autoCompactStations', value })`.
  - `case 'autoCompactThreshold'` mit `<Slider value={current.autoCompactThreshold} min={150000} max={500000} step={10000} label="Schwelle" format={(value) => `${Math.round(value / 1000)}k Tokens`} onCommit={(value) => { save({ kind: 'autoCompactThreshold', value }).catch(() => undefined); }} />`.
- [ ] `pnpm bindings`; `pnpm check`.
- [ ] `docs/decisions/058-auto-zusammenfassen-in-stationen.md` nach dem ADR-057-Muster:
  - Kontext: Messung aus der README.
  - Optionen: (a) globale Einstellung in `~/.claude/settings.json` — verworfen, wirkt auch in Einzel-Sessions; (b) Verwalter schickt `/compact` — verworfen, weil eine Station ein Durchlauf ist; (c) Umgebungsvariable je Stationsprozess — gewählt.
  - Entscheidung und Konsequenzen wie in der README.
- [ ] `docs/code-map.md`: Zeile für `src/components/Slider.tsx`, falls die Map Komponenten führt. `docs/glossary.md`: Eintrag „Zusammenfassung (Verlauf)“ um einen Satz ergänzen: „In Stationen fasst Claude automatisch ab der Schwelle aus den Einstellungen zusammen (ADR 058).“
- [ ] Selbstprüfung in `pnpm tauri dev`: Einstellungen → Agent → Umsetzungen. Schalter aus → Regler verschwindet. Schalter an → Regler auf 300k ziehen, App neu starten, der Wert ist 300k. Screenshot nach `artifacts/phase-1-einstellungen.png`.

## Definition of Done

- AK 1–8 erfüllt. AK 3 und 4 sind durch Rust-Tests belegt, AK 6 durch den Screenshot, AK 7 durch die Probe-Datei.
- Für den Benutzer sichtbar: neuer Abschnitt „Umsetzungen“ in den Einstellungen; das Kontext-Panel einer Station zeigt nach ihrem nächsten Start die eingestellte Schwelle.
- Ausgeführt und mit Summary-Zeile im Report-Back festgehalten: `cargo test --manifest-path src-tauri/Cargo.toml settings`, `cargo test … process` und `pnpm check`.
- Seven-Goals-Check im Report-Back.

## Report-Back
