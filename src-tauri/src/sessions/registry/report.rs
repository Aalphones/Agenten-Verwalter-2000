//! Was Werkzeuge und Ordnung des Review-Berichts aus der Datenbank brauchen (ADR 073).
use std::collections::HashMap;

use super::SessionRegistry;
use crate::agents::event::ChatEntry;
use crate::changes::ChangesInput;
use crate::changes::model::ChangesReach;
use crate::db::report::{self as report_rows, EntryRow, NewEntry, PhaseRow};
use crate::db::sessions::{self as session_rows, SessionRow};
use crate::db::tool_details::{self, ToolSummary};
use crate::db::{chat_entries, session_commits, session_files};
use crate::error::CommandError;
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::implementation::now_ms;
use crate::report::anchor;
use crate::worktrees;

/// Der gespeicherte Verlauf einer Session und die Eingaben ihrer Aufrufe.
pub type SessionHistory = (Vec<ChatEntry>, HashMap<String, ToolSummary>);

/// Was der Bericht über die Sessions einer Umsetzung wissen muss.
pub struct ReportSessions {
    /// Die Changes-Eingabe des Vorhabens samt der Dateien aller Stationen; `None`, wenn keine
    /// Session des Vorhabens geladen ist.
    pub changes: Option<ChangesInput>,
    /// Session-ID → Nummer im Vorhaben, auch archivierte.
    pub numbers: HashMap<String, u32>,
    /// Die Paare `(Session, Commit)` der Stationen.
    pub commits: Vec<(String, String)>,
}

impl SessionRegistry {
    /// Auch die Sessions, die nicht mehr geladen sind: ihre Commits und Dateien kommen aus der
    /// Datenbank.
    pub fn report_sessions(
        &self,
        view: &ImplementationView,
    ) -> Result<ReportSessions, CommandError> {
        let stations: Vec<String> = view
            .phases
            .iter()
            .flat_map(|phase: &PhaseView| &phase.stations)
            .filter_map(|station: &StationView| station.session_id.clone())
            .collect();
        let (rows, commits, touched) = self.database.with(|connection| {
            Ok((
                session_rows::load_for_project(connection, &view.project_id)?,
                session_commits::load_by_session(connection, &stations)?,
                session_files::load_for(connection, &stations)?,
            ))
        })?;
        // Die jüngste Station zuerst, danach die übrigen Sessions des Vorhabens.
        let mut changes = stations
            .iter()
            .rev()
            .chain(rows.iter().rev().map(|row: &SessionRow| &row.id))
            .find_map(|session_id: &String| {
                self.changes_input(session_id, ChangesReach::Project).ok()
            });
        if let Some(input) = &mut changes {
            for (path, touched_at) in touched {
                let latest = input.own.touched.entry(path).or_insert(touched_at);
                *latest = latest.max(touched_at);
            }
            input.discovered = worktrees::discover(&input.repositories, &input.own.touched);
        }
        Ok(ReportSessions {
            changes,
            numbers: rows
                .into_iter()
                .map(|row: SessionRow| (row.id, row.number))
                .collect(),
            commits,
        })
    }

    /// Was zu den Phasen einer Umsetzung gespeichert ist; Phasen ohne Zeile fehlen.
    pub fn report_phases(&self, implementation_id: &str) -> Result<Vec<PhaseRow>, CommandError> {
        self.database
            .with(|connection| report_rows::load_phases(connection, implementation_id))
    }

    /// Ob die Nummer in dieser Phase ein Befund ist.
    pub fn is_report_finding(&self, phase_id: &str, number: u32) -> Result<bool, CommandError> {
        self.database
            .with(|connection| report_rows::is_finding(connection, phase_id, number))
    }

    /// Der letzte Schreib-Aufruf der Session samt den Eingaben ihrer Aufrufe.
    pub fn last_write_of(&self, session_id: &str) -> Result<SessionHistory, CommandError> {
        self.database
            .with(|connection| anchor::load_last_write(connection, session_id))
    }

    /// Aus der Datenbank, damit auch eine nicht geladene oder archivierte Session ihren Verlauf
    /// liefert, ohne ihn in den Speicher der Registry zu holen.
    pub fn history_of(&self, session_id: &str) -> Result<SessionHistory, CommandError> {
        self.database.with(|connection| {
            let entries = chat_entries::load_all(connection, session_id)?;
            let details = tool_details::load_summaries(connection, session_id)?;
            Ok((entries, details))
        })
    }

    /// Hängt den Eintrag an und liefert seine Nummer in der Phase.
    pub fn append_report_entry(
        &self,
        entry: NewEntry,
        name_files: impl FnOnce(u32, &mut NewEntry) -> Result<(), CommandError>,
    ) -> Result<u32, CommandError> {
        self.database
            .with(|connection| report_rows::insert_entry(connection, entry, name_files))
    }

    /// Alle Einträge der Umsetzung, sortiert nach Phase und Nummer.
    pub fn report_entries(&self, implementation_id: &str) -> Result<Vec<EntryRow>, CommandError> {
        self.database
            .with(|connection| report_rows::load_entries(connection, implementation_id))
    }

    /// Speichert die geordnete Fassung einer Phase.
    pub fn store_report_tidy(
        &self,
        implementation_id: &str,
        phase_id: &str,
        tidy: &str,
        tidy_json: &str,
        tidy_entries: u32,
    ) -> Result<(), CommandError> {
        self.database.with(|connection| {
            report_rows::store_tidy(
                connection,
                phase_id,
                implementation_id,
                tidy,
                tidy_json,
                tidy_entries,
                now_ms(),
            )
        })
    }

    /// Setzt bzw. räumt den Fehlersatz der Ordnung einer Phase.
    pub fn store_report_tidy_error(
        &self,
        implementation_id: &str,
        phase_id: &str,
        error: Option<&str>,
    ) -> Result<(), CommandError> {
        self.database.with(|connection| {
            report_rows::store_tidy_error(connection, phase_id, implementation_id, error)
        })
    }

    pub fn implementation_of_phase(&self, phase_id: &str) -> Result<Option<String>, CommandError> {
        self.database
            .with(|connection| report_rows::implementation_of_phase(connection, phase_id))
    }
}
