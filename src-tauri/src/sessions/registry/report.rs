//! Was die Werkzeuge des Review-Berichts aus der Datenbank brauchen (ADR 073).
use std::collections::HashMap;

use super::SessionRegistry;
use crate::agents::event::ChatEntry;
use crate::db::report::{self as report_rows, NewEntry};
use crate::db::tool_details::ToolSummary;
use crate::error::CommandError;
use crate::report::anchor;

impl SessionRegistry {
    /// Ob die Nummer in dieser Phase ein Befund ist.
    pub fn is_report_finding(&self, phase_id: &str, number: u32) -> Result<bool, CommandError> {
        self.database
            .with(|connection| report_rows::is_finding(connection, phase_id, number))
    }

    /// Der letzte Schreib-Aufruf der Session samt den Eingaben ihrer Aufrufe.
    pub fn last_write_of(
        &self,
        session_id: &str,
    ) -> Result<(Vec<ChatEntry>, HashMap<String, ToolSummary>), CommandError> {
        self.database
            .with(|connection| anchor::load_last_write(connection, session_id))
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
}
