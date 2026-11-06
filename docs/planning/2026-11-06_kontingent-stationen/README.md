# Kontingent sparen in Stationen

Stationen einer Umsetzung verbrauchen das meiste Kontingent über lange Verläufe: Jeder Aufruf liest den ganzen Verlauf neu. Messung vom 06.11.2026 an 14 Stationen zweier Umsetzungen: Ø 225k Kontext je Aufruf, 5 von 12 Stationen über 300k, Spitze 468k; eine Station läuft als **ein** Durchlauf mit 50–128 Aufrufen. Dieser Plan setzt drei Hebel im Verwalter um: automatisches Zusammenfassen nur in Stationen (Schalter und Regler in den Einstellungen), schlanke Antworten der Umsetzungs-Werkzeuge und die Git-Lage in der ersten Stationsnachricht. Denkaufwand je Station gibt es schon ([ADR 057](../../decisions/057-modell-und-aufwand-der-station.md)).

## Phasen

| Phase | Inhalt | Rating | Modell | Wave | Schätzung | Status |
|---|---|---|---|---|---|---|
| 1 | [Automatisch zusammenfassen in Stationen](phase-1-auto-zusammenfassen.md), ADR 058 | standard | sonnet | 1 | 2 h | pending |
| 2 | [Schlanke Antworten der Umsetzungs-Werkzeuge](phase-2-schlanke-werkzeug-antworten.md) | standard | sonnet | 1 | 45 min | pending |
| 3 | [Git-Lage in der ersten Stationsnachricht](phase-3-git-lage.md) | standard | sonnet | 2 | 1 h | pending |

Phase 1 und 2 berühren getrennte Dateien und laufen parallel. Phase 3 wartet auf Phase 2, weil beide `src-tauri/src/implementation/` und dessen Tests anfassen.

## Entscheidungen (getroffen, nicht offen)

- **Nur Stationen fassen automatisch zusammen.** Erkennungsmerkmal ist `SessionState.station_of.is_some()`. Einzel-Sessions und Nebenfragen bekommen nie etwas; dort fasst der Benutzer mit `/compact` selbst zusammen.
- **Mechanik: Umgebungsvariable beim Prozessstart.** Der Verwalter setzt `CLAUDE_CODE_AUTO_COMPACT_WINDOW = Schwelle + 33 000` in die Umgebung des Claude-Prozesses einer Station; das Zusammenfassen selbst macht Claude Code mitten im Durchlauf. Gemessen am 06.11.2026 per `get_context_usage` mit Sonnet und Opus: ohne Variable Fenster 1 000 000 und Schwelle 967 000; mit `283000` Schwelle 250 000; mit `280000` Schwelle 247 000 — der Abstand ist fest 33 000. Der Verwalter schickt **kein** `/compact`: Eine Station ist ein einziger Durchlauf, zwischen Durchläufen gäbe es keinen Zeitpunkt.
- **Nur Betriebsart Claude.** Bei LM Studio, Autark und Codex bleibt die Variable weg.
- **Einstellungen:** `autoCompactStations` (Schalter, Standard an) und `autoCompactThreshold` (Tokens, Standard 250 000, Bereich 150 000–500 000, Schritt 10 000). Unter 150k bleibt nach dem Zusammenfassen kaum Arbeitsraum, weil eine Station schon mit 95–110k startet. Über 500k spart es kaum noch.
- **Wirkung ab dem nächsten Prozessstart einer Station.** Ein laufender Prozess behält seinen Wert, weil die Variable beim Start feststeht. Der Verwalter startet den Prozess ohnehin neu, wenn eine ruhende Station die nächste Nachricht bekommt oder der Denkaufwand wechselt.
- **Regler als neue Komponente** `src/components/Slider.tsx`. Eine Zahleneingabe oder einen Regler gibt es in der App noch nicht; der Wert wird erst beim Loslassen gespeichert, nicht bei jeder Bewegung.
- **`implementation_get` liefert standardmäßig nur den Lagebericht als Text**, kein `structuredContent`. Grund: Claude Code reicht bei vorhandenem `structuredContent` diesen an das Modell weiter; gemessen kamen in einer Station 37 900 Zeichen JSON an. Mit `details: true` kommt der View wie bisher. `implementation_create` und `implementation_set_phases` antworten nur noch mit Text.
- **Git-Lage** in der ersten Nachricht aus `status::session_status` mit `ChangesReach::Project`, also über alle Sessions des Vorhabens einschließlich ihrer Ticket-Worktrees. Je Eintrag eine Zeile, höchstens 3 Commit-Betreffs.
- **Nicht in diesem Plan:**
  - MCP-Server je Station filtern: Die Studio-Server kommen aus der `.mcp.json` des Repos, und die claude.ai-Connectoren ließen sich in der Probe nicht nachweisen.
  - Ein Knopf „Zusammenfassen“ für Einzel-Sessions: `/compact` gibt es dort schon.

## Kontrakt

```rust
// src-tauri/src/settings/model.rs
pub struct Settings { /* … */ pub auto_compact_stations: bool, pub auto_compact_threshold: u32 }
pub enum SettingsChange { /* … */ AutoCompactStations { value: bool }, AutoCompactThreshold { value: u32 } }
// src-tauri/src/settings/mod.rs
pub const AUTO_COMPACT_THRESHOLD_RANGE: std::ops::RangeInclusive<u32> = 150_000..=500_000;
pub const AUTO_COMPACT_BUFFER: u32 = 33_000;
pub fn auto_compact_window(settings: &Settings) -> Option<u32>; // None, wenn der Schalter aus ist
// src-tauri/src/agents/claude/process.rs
pub struct SpawnOptions { /* … */ pub auto_compact_window: Option<u32> }
// src-tauri/src/implementation/tools.rs — Eingabe von implementation_get
{ "details": boolean /* optional, Standard false */ }
```

```ts
// src/lib/bindings/Settings.ts (erzeugt): autoCompactStations: boolean; autoCompactThreshold: number
// src/lib/bindings/SettingsChange.ts (erzeugt): { kind: 'autoCompactStations', value: boolean } | { kind: 'autoCompactThreshold', value: number }
```

## Finale AK

1. Schalter an, Schwelle 250 000: Der Claude-Prozess jeder Station startet mit `CLAUDE_CODE_AUTO_COMPACT_WINDOW=283000`; das Kontext-Panel der Station zeigt das automatische Zusammenfassen ab 250 000 Tokens.
2. Einzel-Sessions und Nebenfragen starten ohne die Variable. Ihr Kontext-Panel zeigt weiter die Standardschwelle.
3. Schalter aus: Auch Stationen starten ohne die Variable.
4. Belegt: Im Druckmodus fasst Claude Code mitten im Durchlauf zusammen (`compact_boundary` mit `trigger: "auto"` vor der `result`-Zeile).
5. `implementation_get` ohne `details` antwortet ohne `structuredContent`; mit `details: true` wie bisher. `implementation_create` und `implementation_set_phases` antworten ohne `structuredContent`.
6. Die erste Nachricht einer Station enthält den Block „Git-Lage:“.
7. `pnpm check` ist grün, ADR 058 liegt vor, Code-Map und Glossar sind nachgezogen.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups

- Skills außerhalb dieses Repos nachziehen (Master `mode-implementing`, facepass `project-implementing`): `implementation_get` am Stationsstart nur bei Bedarf aufrufen, `details: true` nur für Planänderungen; in den Stationstabellen `effort` je Rolle setzen (Bau mittel, Review/Planung hoch).
- MCP-Server je Station filtern (Studio-Server aus der Repo-`.mcp.json`, claude.ai-Connectoren) — erst nach eigener Probe.
