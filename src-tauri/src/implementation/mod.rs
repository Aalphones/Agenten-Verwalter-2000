//! Umsetzung eines Plans: Phasen, Stationen, Werkzeuge für den Agenten (ADR 048).
pub mod model;
pub mod report;
pub mod schedule;
pub mod tools;

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::db::implementations::{
    ChangeRow, ImplementationRow, PhaseRow, StationRow, StoredImplementation,
};
use crate::sessions::model::SessionStatus;
use model::{
    ChangeSummary, ChangeView, ImplementationView, PendingChange, PhaseInput, PhaseView,
    StationState, StationView,
};

pub const IMPLEMENTATION_CHANGED_EVENT: &str = "implementation://changed";

/// Tauri-State der Umsetzungen; trägt die Marken der Countdowns (Station → Marke).
#[derive(Default)]
pub struct ImplementationService {
    pub countdowns: Mutex<HashMap<String, u64>>,
}

/// Was eine Station von ihrer Session wissen muss; die Registry liest es kurz unter der
/// Session-Sperre.
#[derive(Debug, Clone)]
pub struct SessionLive {
    pub status: SessionStatus,
    pub number: u32,
    /// Abgeschlossene Abschnitte + laufender.
    pub running_ms: f64,
    /// Text der ersten offenen Rückfrage.
    pub question: Option<String>,
    pub last_activity_at: f64,
    pub unread: bool,
}

/// Baut die Ansicht aus den Zeilen. `live` enthält die Sessions der Stationen, `numbers` die
/// Nummern aller Sessions des Vorhabens (für Plan-Änderungen).
pub fn build_view(
    stored: &StoredImplementation,
    live: &HashMap<String, SessionLive>,
    numbers: &HashMap<String, u32>,
) -> ImplementationView {
    let row = &stored.row;
    let mut phases: Vec<PhaseView> = stored
        .phases
        .iter()
        .map(|phase: &PhaseRow| PhaseView {
            id: phase.id.clone(),
            key: phase.key.clone(),
            title: phase.title.clone(),
            description: phase.description.clone(),
            wave: phase.wave,
            mark: phase.mark,
            stations: stored
                .stations
                .iter()
                .filter(|station: &&StationRow| station.phase_id == phase.id)
                .map(|station: &StationRow| station_view(station, live))
                .collect(),
        })
        .collect();
    settle_waiting(&mut phases, row.auto_start);
    let all_stations: Vec<&StationView> = phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .collect();
    let stations_done = count(
        all_stations
            .iter()
            .copied()
            .filter(|station: &&StationView| is_done(station))
            .count(),
    );
    let current_phase = phases
        .iter()
        .position(|phase: &PhaseView| !phase.stations.iter().all(is_done))
        .unwrap_or(phases.len().saturating_sub(1));
    let urgency = all_stations
        .iter()
        .map(|station: &&StationView| station.state)
        .max_by_key(|state: &StationState| state.urgency_rank())
        .unwrap_or(StationState::Done);
    let mut last_activity_at = row.created_at;
    let mut unread = false;
    for station in &all_stations {
        if let Some(completed_at) = station.completed_at {
            last_activity_at = last_activity_at.max(completed_at);
        }
        if let Some(session) = station
            .session_id
            .as_ref()
            .and_then(|session_id: &String| live.get(session_id))
        {
            last_activity_at = last_activity_at.max(session.last_activity_at);
            unread |= session.unread;
        }
    }
    ImplementationView {
        id: row.id.clone(),
        project_id: row.project_id.clone(),
        name: row.name.clone(),
        source: row.source.clone(),
        created_at: row.created_at,
        finished_at: row.finished_at,
        auto_start: row.auto_start,
        stop_after_current: row.stop_after_current,
        stations_total: count(all_stations.len()),
        stations_done,
        current_phase: count(current_phase + 1),
        urgency,
        last_activity_at,
        unread,
        changes: stored
            .changes
            .iter()
            .map(|change: &ChangeRow| change_view(change, numbers))
            .collect(),
        pending_change: row
            .pending_change
            .as_deref()
            .and_then(|json: &str| serde_json::from_str::<PendingChange>(json).ok()),
        phases,
    }
}

fn station_view(station: &StationRow, live: &HashMap<String, SessionLive>) -> StationView {
    let session = station
        .session_id
        .as_ref()
        .and_then(|session_id: &String| live.get(session_id));
    let state = if station.completed_at.is_some() {
        StationState::Done
    } else {
        session.map_or(StationState::Pending, |session: &SessionLive| {
            state_of(session.status)
        })
    };
    StationView {
        id: station.id.clone(),
        position: station.position,
        stage: station.stage.clone(),
        model: station.model,
        by_user: station.by_user,
        skill: station.skill.clone(),
        brief: station.brief.clone(),
        session_id: station.session_id.clone(),
        session_number: session.map(|session: &SessionLive| session.number),
        state,
        starts_at: None,
        started_at: station.started_at,
        completed_at: station.completed_at,
        result: station.result.clone(),
        question: session
            .filter(|_| state == StationState::Asking)
            .and_then(|session: &SessionLive| session.question.clone()),
        running_ms: session.map_or(0.0, |session: &SessionLive| session.running_ms),
    }
}

/// Fertig heißt gemeldet: eine Antwort ohne Meldung wartet auf den Benutzer.
fn state_of(status: SessionStatus) -> StationState {
    match status {
        SessionStatus::Starting | SessionStatus::New => StationState::Starting,
        SessionStatus::Running => StationState::Running,
        SessionStatus::Waiting => StationState::Asking,
        SessionStatus::Completed | SessionStatus::Paused => StationState::WaitsForYou,
        SessionStatus::Error | SessionStatus::Cancelled => StationState::Error,
    }
}

/// Stationen ohne Session, die starten dürfen: eine Station des Benutzers wartet auf ihn, eine des
/// Agenten ist bei ausgeschalteter Automatik bereit.
fn settle_waiting(phases: &mut [PhaseView], auto_start: bool) {
    let startable: Vec<String> = phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .filter(|station: &&StationView| {
            station.session_id.is_none() && station.state == StationState::Pending
        })
        .filter(|station: &&StationView| schedule::may_start(phases, &station.id))
        .map(|station: &StationView| station.id.clone())
        .collect();
    for station in phases
        .iter_mut()
        .flat_map(|phase: &mut PhaseView| phase.stations.iter_mut())
    {
        if !startable.contains(&station.id) {
            continue;
        }
        if station.by_user {
            station.state = StationState::WaitsForYou;
        } else if !auto_start {
            station.state = StationState::Ready;
        }
    }
}

fn change_view(change: &ChangeRow, numbers: &HashMap<String, u32>) -> ChangeView {
    let session_id = change.session_id.clone().unwrap_or_default();
    ChangeView {
        id: change.id.clone(),
        at: change.at,
        session_number: numbers.get(&session_id).copied().unwrap_or(0),
        session_id,
        summary: serde_json::from_str::<ChangeSummary>(&change.summary).unwrap_or_default(),
        after_station_id: change.after_station_id.clone(),
        stations_before: change.stations_before,
        stations_after: change.stations_after,
    }
}

pub fn is_done(station: &StationView) -> bool {
    station.state == StationState::Done
}

fn count(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

pub fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed: Duration| elapsed.as_secs_f64() * 1000.0)
}

/// Die Zeilen einer neuen Umsetzung aus geprüften Eingaben (`model::validate`).
pub fn new_rows(
    project_id: &str,
    created_by_session_id: &str,
    name: &str,
    source: &str,
    inputs: &[PhaseInput],
    now_ms: f64,
) -> (ImplementationRow, Vec<PhaseRow>, Vec<StationRow>) {
    let id = uuid::Uuid::new_v4().to_string();
    let row = ImplementationRow {
        id: id.clone(),
        project_id: project_id.to_owned(),
        name: name.trim().to_owned(),
        source: source.trim().to_owned(),
        created_by_session_id: Some(created_by_session_id.to_owned()),
        created_at: now_ms,
        finished_at: None,
        auto_start: true,
        stop_after_current: false,
        pending_change: None,
    };
    let (phases, stations) = phase_rows(&id, inputs, 0);
    (row, phases, stations)
}

/// Phasen und Stationen ab Position `first_position`.
pub fn phase_rows(
    implementation_id: &str,
    inputs: &[PhaseInput],
    first_position: u32,
) -> (Vec<PhaseRow>, Vec<StationRow>) {
    let mut phases: Vec<PhaseRow> = Vec::with_capacity(inputs.len());
    let mut stations: Vec<StationRow> = Vec::new();
    for (offset, input) in (first_position..).zip(inputs) {
        let phase_id = uuid::Uuid::new_v4().to_string();
        for (position, station) in (0..).zip(&input.stations) {
            stations.push(StationRow {
                id: uuid::Uuid::new_v4().to_string(),
                phase_id: phase_id.clone(),
                position,
                stage: station.stage.trim().to_owned(),
                model: station.model_id(),
                by_user: station.is_by_user(),
                skill: station.skill_name(),
                brief: station.brief.clone().unwrap_or_default().trim().to_owned(),
                session_id: None,
                started_at: None,
                completed_at: None,
                result: None,
            });
        }
        phases.push(PhaseRow {
            id: phase_id,
            implementation_id: implementation_id.to_owned(),
            position: offset,
            key: input.key.trim().to_owned(),
            title: input.title.trim().to_owned(),
            description: input
                .description
                .clone()
                .unwrap_or_default()
                .trim()
                .to_owned(),
            wave: input.wave,
            mark: None,
        });
    }
    (phases, stations)
}
