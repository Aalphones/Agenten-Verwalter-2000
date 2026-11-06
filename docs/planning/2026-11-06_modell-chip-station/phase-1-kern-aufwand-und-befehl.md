# Phase 1 — Plan-Aufwand an der Station + Befehl

## Kontext (lesen vor dem ersten Edit)

- Plan-README: Kontrakt-Sektion — [README.md](README.md)
- `docs/conventions/rust.md` (falls vorhanden), `docs/decisions/055-rueckfrage-auf-der-karte.md` als ADR-Muster
- Code: `src-tauri/src/db/migrations.rs` + `db/migrations/017_implementations.sql`, `db/implementations.rs` (`StationRow`, `STATION_COLUMNS`, `insert_phases`, `StoredStation`, `complete_station_with_followups`), `implementation/model.rs` (`StationInput`, `StationView`, `validate_station`), `implementation/mod.rs` (`station_view`, `phase_rows`, die Fix-Stationen um Zeile 260–296), `implementation/start.rs` (`start_claimed`, `set_model`), `implementation/tools.rs` (`phases_schema`), `commands/implementation.rs`, `lib.rs` (Befehlsliste), `sessions/registry.rs` (`set_effort`, Signatur `(app, session_id, Effort)`), `examples/gen-bindings.rs`
- Vault-Fehlerklassen: keine einschlägig (reine Rust-/SQLite-Erweiterung im Muster des Bestands).

## AK dieser Phase

1. Migration 018 fügt `implementation_stations.effort TEXT` (nullable) hinzu; alte Datenbanken laufen durch, bestehende Stationen haben `effort = NULL`.
2. `implementation_create` / `implementation_set_phases` nehmen pro Station `effort` an (`low|medium|high|xhigh|max`); ein unbekannter Wert wird mit Feldnamen gemeldet: `phases[i].stations[j].effort: unbekannter Denkaufwand „x“ (low, medium, high, xhigh, max)`.
3. `StationView.effort` kommt im Ereignis `implementation://changed` und in `implementation_list` an.
4. `start_now` setzt nach dem Modell den Aufwand der Station auf die frische Session, wenn er vom Aufwand der Session abweicht.
5. Fix-Runden-Stationen (`FIX_STAGE`, Reporting) erben `effort` wie `model`.
6. Befehl `implementation_set_station_plan` setzt `model` und `effort` einer Station, die noch keine Session hat und nicht fertig ist; sonst die Fehlertexte aus dem Kontrakt. Danach `announce(...)`.
7. `pnpm bindings` und `pnpm check` laufen grün; ADR 057 liegt in `docs/decisions/`.

## Checkliste

- [ ] `src-tauri/src/db/migrations/018_station_effort.sql`: `ALTER TABLE implementation_stations ADD COLUMN effort TEXT;`. In `migrations.rs` die Liste von `[&str; 17]` auf `[&str; 18]` verlängern und `include_str!("migrations/018_station_effort.sql"),` hinter die 017-Zeile setzen.
- [ ] `db/implementations.rs`:
  - `StationRow` bekommt `pub effort: Option<Effort>` (Import von `Effort` wie der von `ModelId`).
  - `STATION_COLUMNS` um `s.effort` am Ende erweitern (Index 12); `StoredStation::read` liest ihn als `Option<String>` in ein zweites Hilfsfeld `effort: Option<String>`, `into_row` wandelt ihn wie `model` per `enum_from_text`.
  - Den INSERT in `insert_phases` und den in `complete_station_with_followups` um die Spalte `effort` erweitern (Platzhalter nachzählen), Wert `station.effort.as_ref().map(enum_to_text).transpose()?`.
  - Neue Funktion `set_station_plan(connection, station_id, model: Option<ModelId>, effort: Option<Effort>)`: `UPDATE implementation_stations SET model = ?2, effort = ?3 WHERE id = ?1 AND session_id IS NULL AND completed_at IS NULL`; liefert die Zahl der geänderten Zeilen zurück (`usize`).
- [ ] `implementation/model.rs`: `StationInput.effort: Option<String>` mit `#[serde(default, skip_serializing_if = "Option::is_none")]` und `#[ts(optional, type = "'low' | 'medium' | 'high' | 'xhigh' | 'max'")]`; Methode `effort_id()` analog `model_id()`; in `validate_station` die Prüfung analog zum Modell (Fehlertext aus AK 2); `StationView.effort: Option<Effort>`.
- [ ] `implementation/mod.rs`: `station_view` setzt `effort: station.effort`; `phase_rows` setzt `effort: station.effort_id()`; die Fix-Stationen (`row`-Closure) bekommen einen Parameter `effort: Option<Effort>` und erhalten für Fix `source.effort`, für Reporting `reporting.effort` (Fallback-Fix: `None`).
- [ ] `implementation/tools.rs`: in `phases_schema` neben `model` `"effort": { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }` ergänzen.
- [ ] `implementation/start.rs`, `start_claimed`: nach dem `set_model`-Block
  ```rust
  if let Some(effort) = station.effort && effort != created.effort {
      registry.set_effort(app, &created.id, effort)?;
  }
  ```
  Schlägt es fehl, wie bei `set_model` per `registry.log_session_line(...)` vermerken (neue Hilfsfunktion `set_effort` neben `set_model`, Meldung „Denkaufwand nicht umgestellt: …“).
- [ ] `commands/implementation.rs` + `lib.rs`: Befehl `implementation_set_station_plan` nach dem Kontrakt. Ablauf: `view = registry.implementation_view(&id)?`; Station suchen (wie `implementation_complete_station`); `by_user` → Fehler „Diese Station erledigst du selbst.“; `session_id.is_some()` oder `state == Done` → „Die Station hat schon begonnen.“; sonst `registry.set_station_plan(...)` (dünner Wrapper in `sessions/registry/implementation.rs` über `database.with(...)` wie die anderen Schreibzugriffe dort), danach `announce(&app, &registry.implementation_view(&id)?)`. In die Befehlsliste in `lib.rs` hinter `implementation_cancel_countdown` eintragen.
- [ ] `src/lib/implementation.ts`: `setStationPlan` nach dem Kontrakt, mit `@throws`-Kommentar im Stil der Nachbarn.
- [ ] `pnpm bindings` (erzeugt `StationView.ts`, `StationInput.ts` neu); `pnpm check`.
- [ ] Probe: `implementation-probe create` mit einer JSON-Datei, in der eine Station `effort` trägt, gegen eine **Kopie** der Datenbank; `show` zeigt den Wert.
- [ ] `docs/decisions/057-modell-und-aufwand-der-station.md`, 10 Zeilen: Kontext (Karte zeigt kein Modell), Optionen (nur Ist-Anzeige / Plan-Aufwand mit Schema-Feld; Live-Werte im Core / aus der Session in der Oberfläche), Entscheidung (Feld `effort`, Live-Werte aus der Session), Konsequenzen (Migration 018, alte Stationen `NULL`).
- [ ] Doc-Updates: `docs/models.md` (Spalte `effort`), `docs/routes.md` bzw. die Befehlsliste in `docs/clients.md` (neuer Befehl und `setStationPlan`), `docs/code-map.md` nur, falls eine neue Datei entstand (hier: keine).

## Report-Back
