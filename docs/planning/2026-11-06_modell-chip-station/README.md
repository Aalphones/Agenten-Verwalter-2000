# Modell-Chip auf der Stationskarte

Die Karte der Station im Fokus zeigt oben rechts einen Chip mit Modell und Denkaufwand. Ein Klick öffnet dasselbe Menü wie im Chat (Denkaufwand-Punkte, Modellliste). Vor dem Start ändert es den Plan der Station, danach die laufende Session. Entwurf zum Anklicken: [artifacts/](artifacts/README.md).

## Phasen

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | [Plan-Aufwand an der Station + Befehl „Plan der Station ändern“](phase-1-kern-aufwand-und-befehl.md), Migration 018, ADR 057 | standard | complete |
| 2 | [Chip und Menü auf der Karte](phase-2-chip-und-menue.md) | standard | pending |

Reihenfolge fest: Phase 2 braucht das Feld `effort` und den Befehl aus Phase 1.

## Entscheidungen (getroffen, nicht offen)

- Jede Station bekommt ein optionales Feld `effort` (`low` … `max`) neben `model`. `None` heißt: Standard der Session.
- Der Chip zeigt **vor dem Start** den Plan (gestrichelt, Zusatz „(Plan)“), **ab dem Start** den Ist-Wert der Session. Weicht der Ist-Wert vom Plan ab, ist der Chip gelb, in der Statuszeile steht „geplant: …“.
- Klick vor dem Start → neuer Befehl ändert `model`/`effort` der Station. Klick bei laufender Station → vorhandene Befehle `session_set_model` / `session_set_effort`; der Plan bleibt stehen. Fertige Stationen: Chip nicht klickbar.
- Den Ist-Wert liefert die Session (`SessionSummary.model/effort`), die `ImplementationView.tsx` schon hält (`focusedSession`). Kein neues Live-Feld im Core.
- Der Start setzt nach dem Modell auch den Aufwand (`start.rs`). Fix-Runden-Stationen erben `effort` wie `model`.
- Gezeigt wird nur auf der Karte. Zeitleiste und Rückweg-Leiste bleiben unverändert.
- Nicht in dieser Runde: Ausweichmodell des Sicherheitsfilters (`fallbackModelId`) im Chip.

## Kontrakt

```rust
// src-tauri/src/implementation/model.rs
pub struct StationInput { /* … */ pub effort: Option<String> /* low|medium|high|xhigh|max, validiert */ }
pub struct StationView  { /* … */ pub effort: Option<Effort> }
// src-tauri/src/db/implementations.rs
pub struct StationRow   { /* … */ pub effort: Option<Effort> }
// src-tauri/src/commands/implementation.rs
#[tauri::command] pub async fn implementation_set_station_plan(
    app: AppHandle, registry: State<SessionRegistry>,
    id: String, station_id: String, model: Option<ModelId>, effort: Option<Effort>,
) -> Result<(), CommandError>;
```

```ts
// src/lib/implementation.ts
export async function setStationPlan(id: string, stationId: string, model: ModelId | null, effort: Effort | null): Promise<void>;
```

Fehler des Befehls (Text als `CommandError::Implementation`): „Die Station hat schon begonnen.“ (Session gebunden oder fertig), „Diese Station erledigst du selbst.“ (`by_user`).

## Finale AK

1. Eine Station, die der Agent mit `effort` anlegt, zeigt auf der Karte „Modell · Aufwand“ aus dem Plan; ohne `effort` steht dort „Standard“.
2. Klick auf den Chip öffnet das Menü aus dem Chat; Auswahl wirkt sofort; Esc und Klick daneben schließen.
3. Vor dem Start landet die Auswahl in der Datenbank und überlebt einen App-Neustart; der Start der Station nutzt Modell **und** Aufwand.
4. Bei laufender Station ändert die Auswahl die Session; der Plan bleibt, Abweichung ist gelb.
5. Fertige Stationen: Chip ohne Menü. `pnpm check` grün.

## Bottom-Sektionen (beim Archivieren füllen)

## Summary
## Files touched
## Commits
## Deviations from plan
## Follow-ups
