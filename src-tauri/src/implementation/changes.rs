//! Plan-Änderungen (ADR 048, ADR 059, ADR 064): `implementation_set_phases` ersetzt die kommenden
//! Phasen und die noch nicht gestarteten Stationen genannter begonnener Phasen. Die Liste gilt
//! sofort, ohne Freigabe; war schon eine Station begonnen, steht sie danach als Karte „Plan
//! geändert“ im Verlauf.
use std::collections::{HashMap, HashSet};

use tauri::{AppHandle, Manager};

use super::model::{
    ChangeSummary, ImplementationView, PhaseInput, PhaseMark, PhaseView, StationInput,
    StationState, StationView, validate,
};
use super::{announce, now_ms, phase_rows, start, station_rows};
use crate::db::implementations::{BegunPhaseChange, ChangeRow, PhaseRow, StationRow};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

const IS_FINISHED: &str = "Die Umsetzung ist fertig; es gibt nichts mehr zu ändern.";
const APPLIED: &str = "Übernommen.";

/// Eine Station hat begonnen, sobald sie eine Session hat oder fertig gemeldet ist; dann ändert
/// keine Plan-Änderung sie mehr.
pub fn is_station_begun(station: &StationView) -> bool {
    station.session_id.is_some() || station.completed_at.is_some()
}

/// Eine Phase hat begonnen, sobald eine ihrer Stationen begonnen hat.
pub fn is_begun(phase: &PhaseView) -> bool {
    phase.stations.iter().any(is_station_begun)
}

/// Die erste Station, deren Session gerade arbeitet, als (Phasen-Schlüssel, Stufe); sie sperrt
/// Abbrechen und Löschen (ADR 060). Wartet die Session auf den Benutzer, sperrt sie nicht.
pub fn blocking_station(view: &ImplementationView) -> Option<(String, String)> {
    view.phases.iter().find_map(|phase: &PhaseView| {
        phase
            .stations
            .iter()
            .find(|station: &&StationView| {
                matches!(
                    station.state,
                    StationState::Starting | StationState::Running | StationState::WaitsForScript
                )
            })
            .map(|station: &StationView| (phase.key.clone(), station.stage.clone()))
    })
}

/// Löschen dürfen nur abgebrochene oder nie begonnene Umsetzungen; eine normal fertige bleibt als
/// Archiv (ADR 060).
pub fn may_delete(view: &ImplementationView) -> bool {
    view.cancelled_at.is_some() || !view.phases.iter().any(is_begun)
}

/// Alle Stationen der Phase sind fertig gemeldet.
pub fn is_finished(phase: &PhaseView) -> bool {
    !phase.stations.is_empty()
        && phase
            .stations
            .iter()
            .all(|station: &StationView| station.completed_at.is_some())
}

/// Schlüssel der begonnenen Phasen; nur sie dürfen im Vorschlag ohne Stationen stehen.
pub fn begun_keys(view: &ImplementationView) -> Vec<&str> {
    view.phases
        .iter()
        .filter(|phase: &&PhaseView| is_begun(phase))
        .map(|phase: &PhaseView| phase.key.as_str())
        .collect()
}

fn upcoming_stations(phase: &PhaseView) -> impl Iterator<Item = &StationView> {
    phase
        .stations
        .iter()
        .filter(|station: &&StationView| !is_station_begun(station))
}

/// Die begonnenen Phasen, die der Vorschlag nennt, mit ihrer Eingabe, in der Reihenfolge des
/// Vorschlags.
fn named_begun<'a>(
    view: &'a ImplementationView,
    proposed: &'a [PhaseInput],
) -> Vec<(&'a PhaseView, &'a PhaseInput)> {
    proposed
        .iter()
        .filter_map(|input: &PhaseInput| {
            view.phases
                .iter()
                .find(|phase: &&PhaseView| phase.key == input.key.trim() && is_begun(phase))
                .map(|phase: &PhaseView| (phase, input))
        })
        .collect()
}

/// Unterschiede zwischen dem heutigen Plan und dem Vorschlag. Fehler, wenn der Vorschlag eine
/// fertige Phase nennt oder eine begonnene hinter einer kommenden oder außer der Reihe.
pub fn diff(view: &ImplementationView, proposed: &[PhaseInput]) -> Result<ChangeSummary, String> {
    check_begun_order(view, proposed)?;
    let named = named_begun(view, proposed);
    let named_keys: HashSet<&str> = named
        .iter()
        .map(|(phase, _): &(&PhaseView, &PhaseInput)| phase.key.as_str())
        .collect();
    let current: Vec<&str> = view
        .phases
        .iter()
        .filter(|phase: &&PhaseView| !is_begun(phase))
        .map(|phase: &PhaseView| phase.key.as_str())
        .collect();
    let keys: Vec<&str> = proposed
        .iter()
        .map(|input: &PhaseInput| input.key.trim())
        .filter(|key: &&str| !named_keys.contains(key))
        .collect();
    let index_in = |list: &[&str], key: &str| list.iter().position(|entry: &&str| *entry == key);
    let mut summary = ChangeSummary::default();
    for (new_index, key) in keys.iter().enumerate() {
        let Some(old_index) = index_in(&current, key) else {
            summary.added.push((*key).to_owned());
            continue;
        };
        // Vorgezogen: steht jetzt vor einer bekannten Phase, hinter der sie vorher stand.
        let is_pulled_forward = current[..old_index].iter().any(|earlier: &&str| {
            index_in(&keys, earlier).is_some_and(|earlier_index: usize| earlier_index > new_index)
        });
        if is_pulled_forward {
            summary.moved.push((*key).to_owned());
        }
    }
    summary.removed = current
        .iter()
        .filter(|key: &&&str| !keys.contains(*key))
        .map(|key: &&str| (*key).to_owned())
        .collect();
    summary.changed = named
        .iter()
        .filter(|(phase, input): &&(&PhaseView, &PhaseInput)| !has_same_upcoming(phase, input))
        .map(|(phase, _): &(&PhaseView, &PhaseInput)| phase.key.clone())
        .collect();
    Ok(summary)
}

/// Genannte begonnene Phasen stehen vor allen kommenden und untereinander in ihrer heutigen
/// Reihenfolge; eine fertige darf der Vorschlag nicht nennen.
fn check_begun_order(view: &ImplementationView, proposed: &[PhaseInput]) -> Result<(), String> {
    let mut has_upcoming_before = false;
    let mut last_index: Option<usize> = None;
    for input in proposed {
        let key = input.key.trim();
        let Some(index) = view
            .phases
            .iter()
            .position(|phase: &PhaseView| phase.key == key && is_begun(phase))
        else {
            has_upcoming_before = true;
            continue;
        };
        if is_finished(&view.phases[index]) {
            return Err(format!("Phase {key} ist fertig."));
        }
        let is_out_of_order = last_index.is_some_and(|last: usize| index < last);
        if has_upcoming_before || is_out_of_order {
            return Err(format!(
                "Phase {key} hat begonnen und steht vor allen kommenden Phasen."
            ));
        }
        last_index = Some(index);
    }
    Ok(())
}

/// Die noch nicht gestarteten Stationen gleichen der Eingabe Station für Station.
fn has_same_upcoming(phase: &PhaseView, input: &PhaseInput) -> bool {
    let upcoming: Vec<&StationView> = upcoming_stations(phase).collect();
    upcoming.len() == input.stations.len()
        && upcoming.iter().zip(&input.stations).all(
            |(station, wanted): (&&StationView, &StationInput)| is_same_station(station, wanted),
        )
}

fn is_same_station(station: &StationView, wanted: &StationInput) -> bool {
    station.stage == wanted.stage.trim()
        && station.model == wanted.model_id()
        && station.effort == wanted.effort_id()
        && station.by_user == wanted.is_by_user()
        && station.skill == wanted.skill_name()
        && station.brief == wanted.brief.as_deref().unwrap_or_default().trim()
}

/// Die Unterschiede als Satzteil für den Agenten und den Lagebericht: „neu 5/6, entfallen 7“.
pub fn describe(summary: &ChangeSummary) -> String {
    let groups: [(&str, &Vec<String>); 4] = [
        ("neu", &summary.added),
        ("vorgezogen", &summary.moved),
        ("entfallen", &summary.removed),
        ("geändert", &summary.changed),
    ];
    let parts: Vec<String> = groups
        .iter()
        .filter(|(_, keys): &&(&str, &Vec<String>)| !keys.is_empty())
        .map(|(label, keys): &(&str, &Vec<String>)| format!("{label} {}", keys.join("/")))
        .collect();
    if parts.is_empty() {
        return "gleiche Phasen, Stationen neu gefasst".to_owned();
    }
    parts.join(", ")
}

/// `implementation_set_phases`: gilt sofort (ADR 064). Vor dem ersten Start ist es die erste
/// Planung ohne Vermerk; danach steht die Änderung als Karte „Plan geändert“ im Verlauf. Gibt den
/// Satz für den Agenten zurück.
pub fn propose(app: &AppHandle, session_id: &str, inputs: &[PhaseInput]) -> Result<String, String> {
    let registry = app.state::<SessionRegistry>();
    let view = registry
        .require_implementation_of_session(session_id)
        .map_err(|error: CommandError| error.to_string())?;
    validate(inputs, &begun_keys(&view))?;
    if view.finished_at.is_some() {
        return Err(IS_FINISHED.to_owned());
    }
    let summary = diff(&view, inputs)?;
    if !view.phases.iter().any(is_begun) {
        apply(app, &registry, &view, inputs, None)
            .map_err(|error: CommandError| error.to_string())?;
        return Ok(APPLIED.to_owned());
    }
    let record = Record {
        session_id: session_id.to_owned(),
        summary: summary.clone(),
    };
    apply(app, &registry, &view, inputs, Some(record))
        .map_err(|error: CommandError| error.to_string())?;
    Ok(format!("Übernommen: {}.", describe(&summary)))
}

/// Wer die Änderung vorschlug und was sie bewirkt; fehlt er, wird nichts vermerkt.
pub struct Record {
    pub session_id: String,
    pub summary: ChangeSummary,
}

/// Alles, was eine Übernahme schreibt; `replace_upcoming_phases` legt es in einem Zug ab.
pub struct PlanChange {
    pub removed_phase_ids: Vec<String>,
    pub begun: Vec<BegunPhaseChange>,
    pub phases: Vec<PhaseRow>,
    pub stations: Vec<StationRow>,
    pub change: Option<ChangeRow>,
    /// Stationen, die wegfallen; ihre Countdowns sind abzubrechen.
    pub dropped_station_ids: Vec<String>,
}

/// Rechnet die Übernahme aus, ohne etwas zu schreiben: nicht begonnene Phasen ersetzt der
/// Vorschlag ganz, genannte begonnene nur in ihren noch nicht gestarteten Stationen, nicht
/// genannte begonnene bleiben unberührt.
pub fn plan_change(
    view: &ImplementationView,
    inputs: &[PhaseInput],
    record: Option<&Record>,
) -> PlanChange {
    let named = named_begun(view, inputs);
    let named_keys: HashSet<&str> = named
        .iter()
        .map(|(phase, _): &(&PhaseView, &PhaseInput)| phase.key.as_str())
        .collect();
    let removed: Vec<&PhaseView> = view
        .phases
        .iter()
        .filter(|phase: &&PhaseView| !is_begun(phase))
        .collect();
    let upcoming_inputs: Vec<PhaseInput> = inputs
        .iter()
        .filter(|input: &&PhaseInput| !named_keys.contains(input.key.trim()))
        .cloned()
        .collect();
    let (mut phases, mut stations) = phase_rows(&view.id, &upcoming_inputs, 0);
    keep_known_ids(&removed, &mut phases, &mut stations);
    set_marks(&removed, record, &mut phases);
    let begun: Vec<BegunPhaseChange> = named
        .iter()
        .map(
            |(phase, input): &(&PhaseView, &PhaseInput)| BegunPhaseChange {
                phase_id: phase.id.clone(),
                title: input.title.trim().to_owned(),
                description: input
                    .description
                    .as_deref()
                    .unwrap_or_default()
                    .trim()
                    .to_owned(),
                removed_station_ids: upcoming_stations(phase)
                    .map(|station: &StationView| station.id.clone())
                    .collect(),
                stations: station_rows(&phase.id, &input.stations),
            },
        )
        .collect();
    let dropped_station_ids: Vec<String> = removed
        .iter()
        .flat_map(|phase: &&PhaseView| phase.stations.iter())
        .map(|station: &StationView| station.id.clone())
        .chain(
            begun
                .iter()
                .flat_map(|change: &BegunPhaseChange| change.removed_station_ids.iter().cloned()),
        )
        .collect();
    let added_count: usize = stations.len()
        + begun
            .iter()
            .map(|change: &BegunPhaseChange| change.stations.len())
            .sum::<usize>();
    let change = record
        .map(|record: &Record| change_row(view, dropped_station_ids.len(), added_count, record));
    PlanChange {
        removed_phase_ids: removed
            .iter()
            .map(|phase: &&PhaseView| phase.id.clone())
            .collect(),
        begun,
        phases,
        stations,
        change,
        dropped_station_ids,
    }
}

/// Schreibt die Übernahme, vermerkt sie (mit `record`) und plant die Stationen, die danach starten
/// dürfen.
fn apply(
    app: &AppHandle,
    registry: &SessionRegistry,
    view: &ImplementationView,
    inputs: &[PhaseInput],
    record: Option<Record>,
) -> Result<(), CommandError> {
    let plan = plan_change(view, inputs, record.as_ref());
    for station_id in &plan.dropped_station_ids {
        let _ = registry.cancel_countdown(station_id);
    }
    registry.store_plan_change(
        &view.id,
        &plan.removed_phase_ids,
        &plan.begun,
        &plan.phases,
        &plan.stations,
        plan.change.as_ref(),
    )?;
    let fresh = registry.implementation_view(&view.id)?;
    announce(app, &fresh);
    schedule_if_running(app, &fresh)
}

/// Plant die bereiten Stationen, wenn die Automatik an ist. Eine Umsetzung, deren erste Station
/// der Benutzer noch nicht gestartet hat, beginnt auch nach einer Plan-Änderung nicht von selbst.
pub fn schedule_if_running(app: &AppHandle, view: &ImplementationView) -> Result<(), CommandError> {
    let has_begun: bool = view
        .phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .any(|station: &StationView| station.session_id.is_some());
    if has_begun && view.auto_start && !view.stop_after_current {
        start::schedule_ready(app, &view.id)?;
    }
    Ok(())
}

/// Eine Phase mit bekanntem Schlüssel behält ihre `id`, damit die Oberfläche sie wiederfindet.
fn keep_known_ids(removed: &[&PhaseView], phases: &mut [PhaseRow], stations: &mut [StationRow]) {
    let known: HashMap<&str, &str> = removed
        .iter()
        .map(|phase: &&PhaseView| (phase.key.as_str(), phase.id.as_str()))
        .collect();
    for phase in phases.iter_mut() {
        let Some(&old_id) = known.get(phase.key.as_str()) else {
            continue;
        };
        for station in stations
            .iter_mut()
            .filter(|station: &&mut StationRow| station.phase_id == phase.id)
        {
            station.phase_id = old_id.to_owned();
        }
        phase.id = old_id.to_owned();
    }
}

/// Neue und vorgezogene Phasen tragen eine Marke; eine bekannte behält die ihre.
fn set_marks(removed: &[&PhaseView], record: Option<&Record>, phases: &mut [PhaseRow]) {
    let Some(record) = record else {
        return;
    };
    for phase in phases.iter_mut() {
        phase.mark = if record.summary.added.contains(&phase.key) {
            Some(PhaseMark::New)
        } else if record.summary.moved.contains(&phase.key) {
            Some(PhaseMark::Moved)
        } else {
            removed
                .iter()
                .find(|old: &&&PhaseView| old.key == phase.key)
                .and_then(|old: &&PhaseView| old.mark)
        };
    }
}

/// Die Marke steht nach der letzten fertigen Station zum Zeitpunkt der Übernahme. Die
/// Stationszahl danach zählt gestrichene offene Stationen begonnener Phasen mit.
fn change_row(
    view: &ImplementationView,
    dropped_count: usize,
    added_count: usize,
    record: &Record,
) -> ChangeRow {
    let after_station_id: Option<String> = view
        .phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .rfind(|station: &&StationView| station.state == StationState::Done)
        .map(|station: &StationView| station.id.clone());
    let total: usize = usize::try_from(view.stations_total).unwrap_or(usize::MAX);
    ChangeRow {
        id: uuid::Uuid::new_v4().to_string(),
        implementation_id: view.id.clone(),
        session_id: Some(record.session_id.clone()),
        at: now_ms(),
        summary: serde_json::to_string(&record.summary).unwrap_or_default(),
        after_station_id,
        stations_before: view.stations_total,
        stations_after: u32::try_from(total.saturating_sub(dropped_count) + added_count)
            .unwrap_or(u32::MAX),
    }
}
