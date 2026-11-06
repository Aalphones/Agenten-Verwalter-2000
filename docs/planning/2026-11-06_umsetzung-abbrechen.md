# Umsetzung abbrechen und löschen

Ein Vorhaben hat höchstens eine unfertige Umsetzung (`db/implementations.rs` `unfinished_of_project`, geprüft in `create_implementation`, `sessions/registry/implementation.rs` ab Zeile 99). Eine ungewollte Umsetzung lässt sich heute weder beenden noch entfernen. Die Tauri-Befehle kennen nur Liste, Bericht, Nebenfrage, Umbenennen, Autostart, „nach dieser anhalten“, Station starten, Countdown abbrechen, Stationsplan, Vorschlag übernehmen und Station fertig. Die MCP-Werkzeuge kennen nur `create`, `get`, `set_phases`, `describe_phase` und `complete_station`.

Anlass am 06.11.2026: In einem Arbeits-Vorhaben lag eine falsch angelegte Umsetzung und blockierte jede neue. Ausschalten ließ sich nur der Autostart.

Dieser Plan führt **Abbrechen** als normalen Weg ein und **Löschen** für abgebrochene oder nie gestartete Umsetzungen. Beides kann der Benutzer direkt auslösen; ein Agent kann es per Werkzeug anfragen, und der Benutzer bestätigt auf einer Karte.

## Phasen

| Phase | Inhalt | Rating | Modell | Wave | Schätzung | Sichtabnahme | Status |
|---|---|---|---|---|---|---|---|
| 1 | Core: Abbrechen, Löschen, Anfrage per Werkzeug, Migration 019, ADR 060 | heikel | opus | 1 | 3 h | keine (Core) | pending |
| 2 | Oberfläche: Knöpfe in der Umsetzungsleiste, Karte „Umsetzung abbrechen?“, Anzeige „abgebrochen“ | standard | sonnet | 2 | 1,5 h | Umsetzungsleiste, Karte | pending |

Die Phasen laufen nacheinander, weil Phase 2 die Bindings und Befehle aus Phase 1 braucht.

**Reihenfolge zu anderen Plänen:** Erst nach `2026-11-06_kontingent-stationen` und `2026-11-06_begonnene-phase-umplanen` umsetzen. Alle drei ändern `implementation/tools.rs`, `implementation/start.rs` und `sessions/registry/implementation.rs`. Dort sind auch ADR 058 und 059 vergeben.

## Phase 1 — Core: Abbrechen, Löschen, Anfrage per Werkzeug

### Kontext (lesen)

- `src-tauri/src/db/migrations/017_implementations.sql` (Schema, `ON DELETE CASCADE` von Phasen, Stationen und Änderungen, `sessions.inquiry_of`) und `018_station_effort.sql` (Muster einer Migration); Registrierung der Migrationen per Grep `018_station_effort` in `src-tauri/src/db/`.
- `src-tauri/src/db/implementations.rs`: `IMPLEMENTATION_COLUMNS` (um Zeile 78), Zeilen-Mapping (um Zeile 283), `unfinished_of_project` 192–206, `set_flags` 465–483, `set_pending_change` 497–510.
- `src-tauri/src/implementation/model.rs`: `StationState` 29–42, `PendingChange` 144–151, `ImplementationView` 155–179.
- `src-tauri/src/implementation/mod.rs`: View-Aufbau (um Zeile 392), `announce` 148–155, Ereignis-Konstanten (`IMPLEMENTATION_CHANGED_EVENT`).
- `src-tauri/src/implementation/changes.rs`: `is_begun` Zeile 22.
- `src-tauri/src/implementation/start.rs`: `schedule_ready` ab Zeile 81, `fire` um 130–150, `start_now`.
- `src-tauri/src/sessions/registry/implementation.rs`: `create_implementation` ab 99, `bind_station` 162, Countdowns 307–327, `rename_implementation` 248 (Muster), Nebenfragen 388 und 405 (`inquiry_of`).
- `src-tauri/src/commands/implementation.rs`: Muster `implementation_rename` (Zeile 40–52), `implementation_set_auto_start`, `implementation_apply_change` (Zeile 153). Die Registrierung der Befehle findet ein Grep `implementation_rename` in `src-tauri/src/lib.rs`.
- `src-tauri/src/implementation/tools.rs`: Werkzeugliste 31–107, `create` 201–214, `announce` 293.
- `docs/decisions/057-modell-und-aufwand-der-station.md` (Form einer ADR).
- Fehlerklassen geprüft: Im Vault gibt es keine Einträge zu Rust, Tauri oder SQLite.

### Entscheidungen

- **Abbrechen** setzt `finished_at` und das neue `cancelled_at` auf jetzt. Dazu schaltet es `auto_start` aus, leert `pending_change` und `pending_cancel` und bricht alle Countdowns der Umsetzung ab (`cancel_countdown` je Station). Die Umsetzung gilt damit als abgeschlossen: `unfinished_of_project` findet sie nicht mehr, eine neue Umsetzung ist sofort möglich. Phasen, Stationen, Verlauf und die Sessions der Stationen bleiben erhalten.
- **Löschen** ist erlaubt, wenn `cancelled_at` gesetzt ist oder keine Phase `changes::is_begun` ist. Es entfernt die Zeile in `implementations`, Phasen, Stationen und Änderungen gehen per Kaskade mit. Eine normal fertige Umsetzung bleibt als Archiv bestehen.
  - In derselben Transaktion: `UPDATE sessions SET inquiry_of = NULL WHERE inquiry_of = ?1`.
  - Im Speicher: `inquiry_of` und `station_of` jeder geladenen Session leeren, die auf die Umsetzung zeigen.
  - Die Sessions selbst bleiben bestehen.
- **Laufende Station sperrt.** Steht eine Station auf `Starting`, `Running` oder `WaitsForScript`, lehnen Abbrechen, Löschen und das Bestätigen einer Anfrage ab. Fehlertext: „Station „<stage>“ in Phase <key> läuft noch. „Nach dieser anhalten“ einschalten und abbrechen, sobald sie fertig ist.“ `Asking` und `WaitsForYou` sperren nicht, weil der Prozess dann auf den Benutzer wartet. Kein Prozess wird beendet.
- **Agenten fragen an, der Benutzer bestätigt.** Das Werkzeug `implementation_cancel` nimmt `reason` (Pflicht, 1–300 Zeichen) und `delete` (optional, Standard `false`).
  - Es legt nur `pending_cancel` an und bricht die Countdowns ab. Antwort: „Anfrage liegt beim Benutzer.“
  - Ziel ist wie bei `implementation_get` die Umsetzung der Session, sonst die neueste des Vorhabens.
  - Fehler, ohne etwas zu ändern: bei schon abgeschlossener Umsetzung „Umsetzung ist schon abgeschlossen.“; bei `delete: true` und nicht löschbarer Umsetzung „Nur abgebrochene oder nie gestartete Umsetzungen lassen sich löschen.“; bei schon offener Anfrage „Es liegt schon eine Anfrage vor.“
- **Offene Anfrage hält an.** Solange `pending_cancel` gesetzt ist, startet keine Station der Umsetzung: `schedule_ready`, `fire` und `start_now` prüfen das. „Verwerfen“ löscht die Anfrage und ruft danach `start::schedule_ready` auf, wenn `auto_start` an ist und `stop_after_current` aus, wie in `implementation_apply_change`.
- **Bestätigen** führt die Anfrage aus: erst abbrechen, bei `delete: true` danach löschen. Läuft eine Station, scheitert es mit dem Sperrtext, und die Anfrage bleibt liegen.
- **Migration 019:** `ALTER TABLE implementations ADD COLUMN cancelled_at REAL;` und `ALTER TABLE implementations ADD COLUMN pending_cancel TEXT;`. `PendingCancel` wird als JSON gespeichert wie `pending_change`.
- **Ereignisse:** Nach jeder Änderung `implementation::announce` mit der neuen Sicht. Nach dem Löschen das neue Ereignis `implementation-removed` mit `{ id: string }`, Konstante neben `IMPLEMENTATION_CHANGED_EVENT`.
- **Nicht in diesem Plan:** einzelne Phasen oder Stationen löschen (Plan `begonnene-phase-umplanen`), normal fertige Umsetzungen löschen, eine laufende Station hart beenden.

### Kontrakt

```rust
// src-tauri/src/implementation/model.rs
pub struct PendingCancel {
    pub session_id: String,
    pub session_number: u32,
    #[ts(type = "number")] pub at: f64,
    pub reason: String,
    pub delete: bool,
}
pub struct ImplementationView { /* … */
    #[ts(type = "number | null")] pub cancelled_at: Option<f64>,
    pub pending_cancel: Option<PendingCancel>,
}
// src-tauri/src/implementation/changes.rs
pub fn blocking_station(view: &ImplementationView) -> Option<(String, String)>; // (phase key, stage) bei Starting|Running|WaitsForScript
pub fn may_delete(view: &ImplementationView) -> bool;                         // cancelled_at.is_some() || !phases.iter().any(is_begun)
// src-tauri/src/db/implementations.rs
pub fn cancel(connection: &Connection, id: &str, at: f64) -> Result<(), CommandError>;
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError>;  // inquiry_of leeren + DELETE, eine Transaktion
pub fn set_pending_cancel(connection: &Connection, id: &str, value: Option<&PendingCancel>) -> Result<(), CommandError>;
// src-tauri/src/sessions/registry/implementation.rs
pub fn cancel_implementation(&self, id: &str) -> Result<ImplementationView, CommandError>;
pub fn delete_implementation(&self, id: &str) -> Result<(), CommandError>;
pub fn request_cancel(&self, session_id: &str, reason: &str, delete: bool) -> Result<ImplementationView, String>;
pub fn discard_cancel(&self, id: &str) -> Result<ImplementationView, CommandError>;
```

```ts
// Tauri-Befehle (src-tauri/src/commands/implementation.rs)
implementation_cancel(id: string): ImplementationView
implementation_delete(id: string): void
implementation_apply_cancel(id: string): ImplementationView | null   // null nach dem Löschen
implementation_discard_cancel(id: string): ImplementationView
// Ereignis
"implementation-removed": { id: string }
// MCP-Werkzeug
implementation_cancel { reason: string /* 1–300 */, delete?: boolean }
```

### AK

1. Migration 019 fügt `cancelled_at` und `pending_cancel` an `implementations`. Eine Bestandszeile aus Migration 018 liest sich danach mit `cancelled_at = None` und `pending_cancel = None` (Test).
2. `cancel_implementation` ohne laufende Station: `finished_at` und `cancelled_at` sind gesetzt, `auto_start` ist aus, `pending_change` und `pending_cancel` sind leer, die Countdowns sind weg. Danach gelingt `create_implementation` im selben Vorhaben (Test).
3. Je Zustand `Starting`, `Running`, `WaitsForScript` lehnen `cancel_implementation`, `delete_implementation` und das Bestätigen mit dem Sperrtext ab, und nichts ändert sich. `Asking` und `WaitsForYou` sperren nicht (Tests).
4. `delete_implementation` löscht eine abgebrochene und eine nie begonnene Umsetzung. Bei einer begonnenen, nicht abgebrochenen kommt der Fehlertext aus „Entscheidungen“. Nach dem Löschen bleibt keine Zeile in den vier Umsetzungs-Tabellen zu ihr, kein `sessions.inquiry_of` zeigt auf sie, die Sessions der Stationen existieren weiter und `station_of` im Speicher ist leer (Test).
5. `implementation_cancel` legt `pending_cancel` an, ändert sonst nichts, bricht die Countdowns ab und antwortet „Anfrage liegt beim Benutzer.“. Leerer oder zu langer Grund, abgeschlossene Umsetzung, nicht löschbare Umsetzung bei `delete: true` und schon offene Anfrage ergeben je ihren Fehler (Tests).
6. Bei gesetztem `pending_cancel` startet keine Station über `schedule_ready`, `fire` oder `start_now` (Test). `discard_cancel` löscht die Anfrage und plant neu.
7. Die vier Tauri-Befehle sind registriert. Nach jeder Änderung läuft `announce`, nach dem Löschen `implementation-removed`.
8. Mutationsprobe gefahren: Die Sperrprüfung für laufende Stationen herausnehmen, dann fällt der Test aus AK 3.
9. ADR 060 liegt vor. `cargo test --manifest-path src-tauri/Cargo.toml implementation` und `pnpm check` sind grün. Die Bindings (`ImplementationView.ts`, neu `PendingCancel.ts`) sind erzeugt.

### Checkliste

- [ ] Tests zuerst (AK 1–6), rot sehen
- [ ] Migration 019 und ihre Registrierung
- [ ] `PendingCancel`, `ImplementationView`-Felder, `blocking_station`, `may_delete`
- [ ] db-Funktionen `cancel`, `delete`, `set_pending_cancel`, Spalten im Lesen
- [ ] Registry: `cancel_implementation`, `delete_implementation`, `request_cancel`, `discard_cancel`, Speicher-Bereinigung `inquiry_of`/`station_of`
- [ ] Start-Sperre bei `pending_cancel` in `schedule_ready`, `fire`, `start_now`
- [ ] Tauri-Befehle und Registrierung, Ereignis `implementation-removed`
- [ ] MCP-Werkzeug `implementation_cancel` (Beschreibung nennt: Anfrage, keine sofortige Wirkung)
- [ ] ADR 060 `docs/decisions/060-umsetzung-abbrechen-und-loeschen.md`, Code-Map und Glossar (Grep „Umsetzung“)
- [ ] DoD: AK 1–9 belegt; Ergebniszeilen von `cargo test` und `pnpm check` im Report-Back; sichtbar ist für den Reviewer nichts (Core); Seven-Goals-Check

### Report-Back

## Phase 2 — Oberfläche: Abbrechen, Löschen, Karte

### Kontext (lesen)

- Kontrakt von Phase 1 (oben) und die erzeugten Bindings `src/lib/bindings/ImplementationView.ts`, `PendingCancel.ts`.
- `src/features/implementation/ImplementationBar.tsx` (Schalter um Zeile 60, Aktionen ab Zeile 69) und `.css`.
- `src/features/implementation/PlanChangeCard.tsx` und `.css` (Muster einer Karte mit Übernehmen/Verwerfen), `CardStack.tsx` (wo Karten erscheinen).
- `src/features/implementation/implementationTexts.ts` (alle Texte), `useImplementations.ts` (Ereignisse und Liste), `stationState.ts`.
- Einen bestehenden Bestätigungsdialog der App finden und wiederverwenden (Grep `confirm` bzw. `Dialog` unter `src/components/`). Gibt es keinen, die Rückfrage in der Leiste als Inline-Bestätigung bauen (zweiter Klick auf „Wirklich abbrechen“ binnen 5 s).
- Fehlerklassen `frameworks/react` (Vault, Abschnitt Fehlerklassen): Für Zusicherungen auf Sichtbarkeit gilt die gefahrene Mutationsprobe.

### AK

1. Die Umsetzungsleiste hat den Knopf „Abbrechen…“, solange die Umsetzung nicht abgeschlossen ist. Er öffnet die Rückfrage „Umsetzung „<Name>“ abbrechen? Die Sessions bleiben, danach lässt sich eine neue Umsetzung anlegen.“ mit „Abbrechen“ und „Zurück“. Läuft eine Station, ist der Knopf gesperrt, und der Tooltip zeigt den Sperrtext.
2. „Löschen…“ erscheint bei abgebrochener oder nie gestarteter Umsetzung. Rückfrage: „Umsetzung „<Name>“ endgültig löschen? Phasen, Stationen und Verlauf gehen verloren, die Sessions bleiben.“
3. Eine abgebrochene Umsetzung zeigt in der Leiste „Abgebrochen am <Datum Uhrzeit>“ statt Schalter und Anhalten-Knopf. Keine Station lässt sich mehr per ▶ starten.
4. Liegt eine Anfrage eines Agenten vor, erscheint eine Karte „Umsetzung abbrechen?“ bzw. „Umsetzung löschen?“. Sie zeigt Grund, Session-Nummer und Zeit, dazu „Bestätigen“ und „Verwerfen“. Läuft eine Station, zeigt die Karte den Sperrtext und „Bestätigen“ ist gesperrt.
5. Nach dem Löschen verschwindet die Umsetzung ohne Neuladen aus allen Listen und Ansichten (Ereignis `implementation-removed` in `useImplementations.ts`).
6. vitest-Tests decken die Knöpfe je Zustand (offen, Station läuft, abgebrochen, nie gestartet) und die Karte ab. Mutationsprobe gefahren: Die Sperrbedingung des Knopfs herausnehmen, dann fällt ein Test. `pnpm check` ist grün.
7. Sichtabnahme mit Fotos im Report-Back: Leiste offen, Leiste mit laufender Station (Knopf gesperrt), Leiste abgebrochen und die Karte.

### Checkliste

- [ ] Tests zuerst (AK 1–6), rot sehen
- [ ] Texte in `implementationTexts.ts`
- [ ] Knöpfe und Rückfrage in `ImplementationBar.tsx`, Anzeige „Abgebrochen am …“
- [ ] Karte `CancelRequestCard.tsx` nach dem Muster `PlanChangeCard.tsx`, eingehängt in `CardStack.tsx`
- [ ] `useImplementations.ts`: Ereignis `implementation-removed`
- [ ] Code-Map nachziehen
- [ ] DoD: AK 1–7 belegt; vitest-Ergebniszeile und `pnpm check` im Report-Back; sichtbar ist für den Reviewer „Abbrechen…“ → Rückfrage → Leiste zeigt „Abgebrochen am …“ → „Löschen…“ → Umsetzung ist weg; Seven-Goals-Check

### Report-Back

## Finale AK

1. Eine Umsetzung ohne laufende Station lässt sich in der Oberfläche abbrechen. Danach legt `implementation_create` im selben Vorhaben eine neue an.
2. Eine abgebrochene oder nie gestartete Umsetzung lässt sich löschen. Ihre Sessions bleiben, Listen und Seitenleiste zeigen sie nicht mehr.
3. Ein Agent kann per `implementation_cancel` nur anfragen; erst „Bestätigen“ auf der Karte bricht ab bzw. löscht, und „Verwerfen“ lässt alles wie vorher.
4. Eine laufende Station sperrt Abbrechen und Löschen in Core und Oberfläche.
5. `pnpm check` ist grün, ADR 060 liegt vor, Code-Map und Glossar sind nachgezogen.

## Konfidenz

- 🟡 **Speicherstand nach dem Löschen:** Geladene Sessions halten `station_of` und `inquiry_of` im Speicher. Die Bereinigung muss alle geladenen Sessions des Vorhabens durchgehen; das deckt der Test aus AK 4 von Phase 1 ab.
- 🟡 **Seitenleiste (ADR 056):** Ob die Stationen-Liste dort abgeschlossene Umsetzungen schon ausblendet, ist nicht geprüft. Phase 2 prüft das per Grep auf die Quelle der Liste und blendet abgebrochene Umsetzungen sonst dort aus.
- 🟡 **Reihenfolge zu den zwei anderen Plänen:** Laufen sie nicht vorher durch, gibt es Konflikte in `tools.rs`, `start.rs` und `registry/implementation.rs`. Das ist kein Fehler im Plan, kostet aber eine Merge-Runde.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
