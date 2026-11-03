//! Umsetzungen der Vorhaben (ADR 048): was die Registry an Sessions beisteuert. Die Zeilen liegen
//! in `db::implementations`, die Ansicht baut `crate::implementation::build_view`.
//!
//! Sperren: erst die Datenbank lesen, dann jede Station-Session einzeln und kurz sperren — nie zwei
//! Session-Sperren zugleich, nie `Database::with` unter einer Session-Sperre.
use std::collections::HashMap;
use std::sync::Arc;

use super::{PendingRequest, ProjectState, Session, SessionRegistry, now_ms};
use crate::agents::event::Question;
use crate::db::implementations::{self as implementation_rows, StationRow, StoredImplementation};
use crate::error::CommandError;
use crate::implementation::model::{ImplementationView, PhaseInput, PhaseView};
use crate::implementation::{SessionLive, build_view, new_rows};
use crate::sessions::model::SessionStatus;

const NO_IMPLEMENTATION: &str = "In diesem Vorhaben gibt es keine Umsetzung.";

impl SessionRegistry {
    /// Alle Umsetzungen nicht archivierter Vorhaben, neueste zuerst.
    pub fn implementation_views(&self) -> Result<Vec<ImplementationView>, CommandError> {
        let stored = self
            .database
            .with(|connection| implementation_rows::load_all(connection))?;
        let active: Vec<StoredImplementation> = {
            let projects = self.lock_projects();
            stored
                .into_iter()
                .filter(|item: &StoredImplementation| projects.contains_key(&item.row.project_id))
                .collect()
        };
        Ok(active
            .iter()
            .map(|item: &StoredImplementation| self.view_of(item))
            .collect())
    }

    /// Eine Umsetzung nach ID.
    pub fn implementation_view(&self, id: &str) -> Result<ImplementationView, CommandError> {
        let stored = self
            .database
            .with(|connection| implementation_rows::load(connection, id))?
            .ok_or_else(|| {
                CommandError::Implementation(format!("Umsetzung nicht gefunden: {id}"))
            })?;
        Ok(self.view_of(&stored))
    }

    /// Für eine Station ihre Umsetzung, sonst die neueste des Vorhabens der Session.
    pub fn implementation_of_session(
        &self,
        session_id: &str,
    ) -> Result<Option<ImplementationView>, CommandError> {
        let session = self.get(session_id)?;
        let station_of: Option<String> = session.lock().station_of.clone();
        let id = match station_of {
            Some(id) => Some(id),
            None => self.database.with(|connection| {
                implementation_rows::latest_of_project(connection, &session.project_id)
            })?,
        };
        id.map(|id: String| self.implementation_view(&id))
            .transpose()
    }

    /// Wie `implementation_of_session`, ohne Umsetzung ein Fehler mit dem Satz für den Agenten.
    pub fn require_implementation_of_session(
        &self,
        session_id: &str,
    ) -> Result<ImplementationView, CommandError> {
        self.implementation_of_session(session_id)?
            .ok_or_else(|| CommandError::Implementation(NO_IMPLEMENTATION.to_owned()))
    }

    /// Legt im Vorhaben der Session eine Umsetzung an; `phases` sind schon geprüft
    /// (`model::validate`). Prüfung auf eine unfertige Umsetzung und Anlegen laufen unter derselben
    /// Datenbank-Sperre, damit zwei gleichzeitige Aufrufe nicht beide durchkommen.
    pub fn create_implementation(
        &self,
        session_id: &str,
        name: &str,
        source: &str,
        phases: &[PhaseInput],
    ) -> Result<ImplementationView, CommandError> {
        let project_id = self.get(session_id)?.project_id.clone();
        let (row, phase_rows, station_rows) =
            new_rows(&project_id, session_id, name, source, phases, now_ms());
        self.database.with(|connection| {
            if let Some((_, running)) =
                implementation_rows::unfinished_of_project(connection, &project_id)?
            {
                return Err(CommandError::Implementation(format!(
                    "Im Vorhaben läuft schon die Umsetzung „{running}“."
                )));
            }
            implementation_rows::insert(connection, &row, &phase_rows, &station_rows)
        })?;
        self.implementation_view(&row.id)
    }

    /// Ändert Titel und Beschreibung einer Phase, auch einer fertigen; `None` lässt den Text stehen.
    pub fn describe_implementation_phase(
        &self,
        session_id: &str,
        key: &str,
        title: Option<&str>,
        description: Option<&str>,
    ) -> Result<ImplementationView, CommandError> {
        let view = self.require_implementation_of_session(session_id)?;
        let Some(phase) = view
            .phases
            .iter()
            .find(|phase: &&PhaseView| phase.key == key)
        else {
            return Err(CommandError::Implementation(format!(
                "key: keine Phase „{key}“ in der Umsetzung „{}“",
                view.name
            )));
        };
        let title = title.map_or(phase.title.as_str(), str::trim);
        let description = description.map_or(phase.description.as_str(), str::trim);
        self.database.with(|connection| {
            implementation_rows::update_phase_text(connection, &phase.id, title, description)
        })?;
        self.implementation_view(&view.id)
    }

    /// Name des Vorhabens für Kopfzeilen; leer für ein unbekanntes.
    pub fn project_name(&self, project_id: &str) -> String {
        self.lock_projects()
            .get(project_id)
            .map(|project: &ProjectState| project.name.clone())
            .unwrap_or_default()
    }

    fn view_of(&self, stored: &StoredImplementation) -> ImplementationView {
        let members = self.project_sessions(&stored.row.project_id);
        let numbers: HashMap<String, u32> = members
            .iter()
            .map(|member: &Arc<Session>| (member.id.clone(), member.number))
            .collect();
        let now = now_ms();
        let live: HashMap<String, SessionLive> = members
            .iter()
            .filter(|member: &&Arc<Session>| {
                stored.stations.iter().any(|station: &StationRow| {
                    station.session_id.as_deref() == Some(member.id.as_str())
                })
            })
            .map(|member: &Arc<Session>| (member.id.clone(), live_of(member, now)))
            .collect();
        build_view(stored, &live, &numbers)
    }
}

/// Liest unter der Sperre dieser einen Session, ohne den Verlauf zu laden.
fn live_of(session: &Session, now: f64) -> SessionLive {
    let state = session.lock();
    let status = if state.is_awaiting_subagent() {
        SessionStatus::Running
    } else {
        state.status
    };
    let running_ms = state.running_ms
        + state
            .running_since
            .map_or(0.0, |since: f64| (now - since).max(0.0));
    let question = state
        .pending
        .first()
        .and_then(|(_, request): &(String, PendingRequest)| request.questions.first())
        .map(|question: &Question| question.question.clone());
    SessionLive {
        status,
        number: session.number,
        running_ms,
        question,
        last_activity_at: state.last_activity_at,
        unread: state.last_activity_at > state.seen_at,
    }
}
