# Begonnene Phase umplanen

Eine Phase gilt heute als begonnen, sobald eine ihrer Stationen eine Session hat oder fertig gemeldet ist (`changes::is_begun`). Danach lehnt `implementation_set_phases` jeden Vorschlag ab, der ihren Schlüssel nennt („Phase X hat schon begonnen.“). Damit sind auch die **noch nicht gestarteten** Stationen dieser Phase eingefroren: Ein Agent kann sie weder streichen noch eine neue Phase vor sie setzen, und in der Oberfläche gibt es dafür auch keinen Weg. Anlass am 06.11.2026 in der Umsetzung GYMID-2601: Die Phase „Merge“ (Merge-Review läuft, danach Testfälle und Merge) sollte vor dem Merge eine Abnahme-Phase bekommen. Das ging nicht, die Merge-Station blieb vor der Abnahme stehen und musste über die Phasenbeschreibung stillgelegt werden. Zusätzlich startet heute eine Station, die ein offener Vorschlag streichen oder ändern würde, trotzdem, solange der Benutzer nicht übernimmt. Danach scheitert „Übernehmen“.

Dieser Plan erlaubt es, in einer begonnenen Phase die **noch nicht gestarteten Stationen** umzuplanen, und hält solche Stationen an, solange ein Vorschlag offen ist. Gestartete und fertige Stationen bleiben unantastbar.

## Phasen

| Phase | Inhalt | Rating | Modell | Wave | Schätzung | Sichtabnahme | Status |
|---|---|---|---|---|---|---|---|
| 1 | Core: begonnene Phase in `implementation_set_phases`, Anhalten bei offenem Vorschlag, Schutz beim Übernehmen, ADR 059 | heikel | opus | 1 | 3 h | keine (Core) | complete |
| 2 | Karte „Plan ändern?“ und Zeitleiste zeigen geänderte begonnene Phasen | standard | sonnet | 2 | 45 min | Karte „Plan ändern?“ | pending |

Sequenziell, weil Phase 2 die in Phase 1 erzeugten Bindings (`ChangeSummary.changed`) braucht.

## Entscheidungen (getroffen, nicht offen)

- **Gesperrt ist die Station, nicht die Phase.** Unantastbar ist jede Station mit Session oder Fertigmeldung (dieselbe Bedingung wie heute `is_begun`, nur je Station). Eine begonnene Phase darf im Vorschlag stehen; ihre `stations` beschreiben dann **nur die noch nicht gestarteten** Stationen und ersetzen genau diese. Die gestarteten bleiben unverändert und stehen davor.
- **`stations: []` ist bei einer begonnenen Phase erlaubt** und streicht alle ihre noch nicht gestarteten Stationen. Bei einer nicht begonnenen Phase bleibt „mindestens eine Station“ Pflicht (`validate` bekommt dafür die Menge der begonnenen Schlüssel).
- **Eine begonnene Phase, die der Vorschlag nicht nennt, bleibt unverändert.** Sie wird nicht gestrichen, damit ein Agent nichts aus Versehen verliert. Nicht begonnene Phasen ersetzt der Vorschlag wie bisher vollständig.
- **Reihenfolge:** Begonnene Phasen behalten ihren Platz. Im Vorschlag müssen genannte begonnene Phasen vor allen nicht begonnenen stehen und untereinander in ihrer heutigen Reihenfolge. Sonst kommt der Fehler „Phase X hat begonnen und steht vor allen kommenden Phasen.“
- **Fertige Phase** (alle Stationen fertig gemeldet): nennt der Vorschlag sie, kommt der Fehler „Phase X ist fertig.“
- **Titel und Beschreibung** einer genannten begonnenen Phase übernimmt der Vorschlag, `wave` dagegen nicht. Die Wellen-Zugehörigkeit einer laufenden Phase ändert sich nie.
- **Anhalten bei offenem Vorschlag:** Solange ein Vorschlag offen ist, startet keine Station, die er ersetzt. Das sind alle Stationen nicht begonnener Phasen und die noch nicht gestarteten Stationen genannter begonnener Phasen. Sie bleiben im Zustand `Pending`, ein laufender Countdown wird beim Vorschlagen abgebrochen. Stationen begonnener Phasen, die der Vorschlag nicht nennt, laufen weiter. Nach „Verwerfen“ wird wie nach „Übernehmen“ `start::schedule_ready` aufgerufen (nur wenn `auto_start` und nicht `stop_after_current`, wie in `apply`).
- **Schutz beim Übernehmen:** Ein Vorschlag merkt sich je genannter begonnener Phase die IDs ihrer noch nicht gestarteten Stationen (`PendingChange.seen_station_ids`). Weicht die Menge beim Übernehmen ab, weil etwa eine Fix-Runde per `complete_station_with_followups` dazukam, kommt der Fehler „Phase X hat sich seit dem Vorschlag geändert; bitte neu vorschlagen.“ Der Vorschlag bleibt dann liegen, damit „Verwerfen“ möglich bleibt.
- **Zusammenfassung:** `ChangeSummary` bekommt `changed: Vec<String>`, die Schlüssel genannter begonnener Phasen, deren noch nicht gestartete Stationen sich ändern. Gleiche Stationen (gleiche `stage`, `model`, `effort`, `by`, `skill`, `brief` in gleicher Reihenfolge) zählen nicht als Änderung. `describe` hängt „geändert X/Y“ an, die Karte zeigt eine Zeile „Geändert“.
- **Alte gespeicherte Daten:** `changed` und `seen_station_ids` tragen `#[serde(default)]`. Gespeicherte Zusammenfassungen (`implementation_changes.summary`) und offene Vorschläge (`implementations.pending_change`) ohne diese Felder lesen sich weiter. Ohne `default` würde `change_view` per `unwrap_or_default()` die ganze Zusammenfassung leeren. Keine Migration.
- **Nicht in diesem Plan:** ein Knopf in der Oberfläche, mit dem der Benutzer eine einzelne Station oder Phase selbst streicht. Umplanen bleibt Sache des Agenten per Vorschlag und der Übernahme auf der Karte.

## Kontrakt

```rust
// src-tauri/src/implementation/model.rs
pub struct ChangeSummary { pub added: Vec<String>, pub moved: Vec<String>, pub removed: Vec<String>,
    #[serde(default)] pub changed: Vec<String> }
pub struct PendingChange { /* … */ #[serde(default)] pub seen_station_ids: Vec<String> }
pub fn validate(phases: &[PhaseInput], begun_keys: &[&str]) -> Result<(), String>;
// src-tauri/src/implementation/changes.rs
pub fn is_station_begun(station: &StationView) -> bool;      // session_id.is_some() || completed_at.is_some()
pub fn is_finished(phase: &PhaseView) -> bool;               // alle Stationen completed_at.is_some()
pub fn held_station_ids(view: &ImplementationView, pending: &PendingChange) -> HashSet<String>;
// src-tauri/src/db/implementations.rs — erweitert, eine Transaktion
pub struct BegunPhaseChange { pub phase_id: String, pub title: String, pub description: String,
    pub removed_station_ids: Vec<String>, pub stations: Vec<StationRow> /* Positionen ab 0; die DB setzt sie hinter die verbleibenden */ }
pub fn replace_upcoming_phases(connection: &mut Connection, implementation_id: &str,
    removed_phase_ids: &[String], begun: &[BegunPhaseChange], phases: &[PhaseRow],
    stations: &[StationRow], change: Option<&ChangeRow>) -> Result<(), CommandError>;
```

```ts
// src/lib/bindings/ChangeSummary.ts (erzeugt): changed: Array<string>
```

Werkzeugbeschreibung `implementation_set_phases` (`tools.rs`), wörtlich: „Schlägt die kommenden Phasen vor; der Benutzer übernimmt oder verwirft sie. Nicht begonnene Phasen ersetzt die Liste vollständig. Eine begonnene Phase darf vorn stehen: ihre stations ersetzen nur die noch nicht gestarteten Stationen (leer = alle streichen); gestartete und fertige bleiben. Nicht genannte begonnene Phasen bleiben unverändert.“

## Finale AK

1. Umsetzung mit Phase A (Station 1 fertig, Station 2 läuft, Station 3 und 4 offen) und Phase B (offen). Vorschlag `[A: stations [3'], C, B']` → übernommen: A = 1, 2, 3'; danach C, dann B'. Station 4 ist gelöscht, 1 und 2 haben unveränderte IDs und Zustände.
2. Vorschlag mit `A: stations []` → A behält nur 1 und 2.
3. Ein Vorschlag, der eine fertige Phase nennt, scheitert mit „Phase X ist fertig.“. Steht eine begonnene Phase hinter einer nicht begonnenen, scheitert er mit „Phase X hat begonnen und steht vor allen kommenden Phasen.“.
4. Solange ein Vorschlag offen ist, bekommt keine von ihm ersetzte Station einen Countdown oder eine Session. Eine Station einer nicht genannten begonnenen Phase startet normal. Nach „Verwerfen“ startet die nächste bereite Station.
5. Kommt nach dem Vorschlag eine Fix-Runde in eine genannte Phase, scheitert „Übernehmen“ mit „Phase X hat sich seit dem Vorschlag geändert; bitte neu vorschlagen.“. Der Vorschlag bleibt sichtbar und lässt sich verwerfen.
6. Ein gespeicherter Vorschlag und eine gespeicherte Zusammenfassung ohne die neuen Felder werden ohne Verlust gelesen.
7. Lagebericht und Karte nennen „geändert A“, die Stationszahl auf der Karte stimmt (vorher → nachher, inklusive gestrichener offener Stationen begonnener Phasen).
8. `pnpm check` ist grün, ADR 059 liegt vor, Code-Map und Glossar sind nachgezogen.

## Phase 1 — Core (heikel, opus)

**Kontext (lesen):** `docs/decisions/048-umsetzung.md` · `src-tauri/src/implementation/changes.rs` (ganz) · `model.rs` (`ChangeSummary`, `PendingChange`, `PhaseInput`, `validate`) · `mod.rs` (`phase_rows`, `settle_waiting`, View-Aufbau ab Zeile ~380) · `schedule.rs` (`may_start`) · `start.rs` (`schedule_ready`) · `tools.rs` (`SET_PHASES`, `set_phases`) · `db/implementations.rs` (`replace_upcoming_phases`, `complete_station_with_followups` als Muster für Stationen in einer laufenden Phase) · `sessions/registry/implementation.rs` (`store_plan_change`, `store_pending_change`, `cancel_countdown`) · `examples/implementation-probe.rs` (`set-phases`) · `tests.rs` (Muster `station`, `phase_with`) · `docs/conventions/rust.md`. Fehlerklassen geprüft: Für Rust gibt es keine Entity im Vault. Einschlägig ist die serde-Falle bei neuen Feldern in gespeichertem JSON (siehe Entscheidung „Alte gespeicherte Daten“).

**AK der Phase:** finale AK 1–6, dazu: `implementation-probe set-phases` spielt einen Vorschlag mit begonnener Phase gegen eine Datenbank-Kopie ein und druckt den neuen Stand.

- [x] ~~Tests zuerst (Test-Station)~~ entfällt (privates Profil), in `src-tauri/src/implementation/tests.rs`: `diff` mit begonnener Phase (geändert, gleich, leer, fertig, falsche Reihenfolge), `held_station_ids`, Lesen alter JSON-Texte für `ChangeSummary` und `PendingChange`, Stationszahl in `change_row`. Einmal rot belegen.
- [x] `changes.rs`: `is_station_begun` und `is_finished` hinzufügen. `diff` prüft die Reihenfolge und fertige Phasen und füllt `changed`. `propose` speichert `seen_station_ids` und bricht die Countdowns der angehaltenen Stationen ab (`registry.cancel_countdown`). `decide` prüft `seen_station_ids` gegen den heutigen Stand und ruft nach „Verwerfen“ `schedule_ready` auf. `apply` baut `BegunPhaseChange` je genannter begonnener Phase, löscht in nicht genannten nichts und rechnet `stations_after` mit den gestrichenen offenen Stationen.
- [x] `model.rs`: Felder mit `#[serde(default)]` hinzufügen, `validate(phases, begun_keys)` erlaubt leere `stations` nur für Schlüssel aus `begun_keys`. Alle Aufrufer anpassen (`implementation_create` übergibt `&[]`).
- [x] `mod.rs` `settle_waiting`: Stationen aus `held_station_ids` bleiben `Pending`.
- [x] `db/implementations.rs` `replace_upcoming_phases`: Je `BegunPhaseChange` löscht es `removed_station_ids`, fügt `stations` hinter der höchsten Position der verbleibenden Stationen ein und setzt Titel und Beschreibung. Alles in derselben Transaktion.
- [x] `tools.rs`: Werkzeugbeschreibung wörtlich aus dem Kontrakt, der Fehlertext von `set_phases` bleibt der Satz aus `diff`.
- [x] `examples/implementation-probe.rs` `set-phases`: über `changes::diff`/`apply`-Logik, druckt `changed`.
- [x] `pnpm bindings`, ADR `docs/decisions/059-begonnene-phase-umplanen.md` (Kontext, Optionen: Phase sperren wie bisher / Station sperren / Benutzer-Knopf, Entscheidung, Konsequenzen), in ADR 048 den Satz zur Sperre der begonnenen Phase auf ADR 059 verweisen. Glossar „begonnen“ (Station statt Phase), Code-Map falls neue Funktionen eine Zeile brauchen.
- [x] DoD (ohne neue Tests, privates Profil): AK-Tests grün mit der Ausgabezeile von `cargo test`, `pnpm check` grün. Artefakt: Ausgabe von `implementation-probe set-phases` vorher und nachher gegen eine Datenbank-Kopie mit begonnener Phase im Report-Back.

## Phase 2 — Anzeige (standard, sonnet)

**Kontext (lesen):** `src/features/implementation/PlanChangeCard.tsx` und `.css`, `implementationTexts.ts` (`keysText`, Titel-Texte), `Timeline.tsx` (Marke der Änderung), `src/lib/bindings/ChangeSummary.ts`, `docs/conventions/react.md`, `docs/conventions/tailwind.md`. Fehlerklassen geprüft (React, TypeScript): Keine ist einschlägig, die Karte ist reine Anzeige ohne Eingabefeld.

**AK der Phase:** Die Karte „Plan ändern?“ und die übernommene Karte „Plan geändert“ zeigen eine vierte Zeile „Geändert“ mit `keysText(summary.changed)`, unter „Entfallen“, gleiches Markup wie die drei anderen (`dt`/`dd` in `plan-change-card__list`). `APPLY_CHANGE_TITLE` lautet „Ersetzt die kommenden Phasen und die offenen Stationen begonnener Phasen durch den Vorschlag“. Für ältere Änderungen ohne `changed` zeigt die Zeile dasselbe wie eine leere Liste.

> Hinweis aus Phase 1: `implementation-probe set-phases` schreibt die Änderung jetzt gleich als übernommen in die Kopie; einen offenen Vorschlag für die Karte „Plan ändern?“ legt nur `implementation_set_phases` aus einer Station an. Die Stationszahl der Karte (`CardStack.tsx` `stationsAfterProposal`) ist schon nachgezogen.

- [ ] `PlanChangeCard.tsx`: Zeile „Geändert“ ergänzen.
- [ ] `implementationTexts.ts`: `APPLY_CHANGE_TITLE` neu.
- [ ] Sichtabnahme: Screenshot der Karte mit „Geändert: Merge“ aus `pnpm tauri dev` mit einer Umsetzung, an die per `implementation-probe set-phases` ein Vorschlag mit begonnener Phase gehängt wurde. Ablage in `docs/planning/…/artifacts/` bzw. im Report-Back.
- [ ] DoD: `pnpm check` grün, Screenshot vorgelegt.

## Risiken

- 🟡 Ein offener Vorschlag, den niemand übernimmt, hält jetzt die Umsetzung an. Das ist gewollt, ändert aber das Verhalten: Bisher lief die nächste Phase weiter, und „Übernehmen“ scheiterte danach.
- 🟡 `stations_after` und die Marke auf der Linie (`after_station_id`) müssen gestrichene offene Stationen begonnener Phasen mitzählen. Ein Fehler zeigt eine falsche Stationszahl, schadet aber den Daten nicht. Abgedeckt durch einen Test in Phase 1.
- 🟡 Skills außerhalb des Repos (Master `mode-planning/WORK.md`: „eine begonnene Phase stellt der Verwalter nicht mehr um“) beschreiben die alte Sperre. Siehe Follow-ups.

## Summary

## Files touched

## Commits

## Deviations from plan

- Phase 1: `BegunPhaseChange.stations` tragen Positionen ab 0; `replace_upcoming_phases` setzt sie hinter die höchste verbleibende Position der Phase (wie bei den Phasen). Löscht dort nur Stationen ohne Session und Fertigmeldung und bricht sonst den ganzen Zug ab.
- Phase 1: `start::start_now` lehnt eine angehaltene Station ab (auch ▶), nicht nur der Zeitgeber über `settle_waiting`.
- Phase 1: `CardStack.tsx` `stationsAfterProposal` zählt bei genannten begonnenen Phasen nur die begonnenen Stationen (AK 7); sonst zeigte die Karte zu viele Stationen.
- Phase 1: `implementation-probe set-phases` schreibt jetzt in die Kopie (als wäre übernommen) und druckt angehaltene Stationen, vorher und nachher. `schedule_if_running` bündelt den Start nach Übernehmen und Verwerfen.
- Phase 1: keine neuen automatisierten Tests (privates Profil); Belege per Prüfprogramm gegen Kopien der echten Datenbank.

## Follow-ups

- Master-Skill `mode-planning/WORK.md` (Absatz „Nach dem Plan-Vorlegen“ → Auslieferung als eigene Phase) und `mode-implementing` auf die neue Regel umstellen: Offene Stationen einer begonnenen Phase sind per `implementation_set_phases` umplanbar.
