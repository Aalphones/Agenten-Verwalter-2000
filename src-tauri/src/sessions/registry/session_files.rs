//! Was die Registry zu den Session-Dateien eines Vorhabens beisteuert (ADR 071): die Sessions und
//! das Eintragen eines angeklickten Dateilinks. Liste und Grenze liegen in `crate::session_files`.
use std::sync::Arc;

use super::{Session, SessionRegistry, now_ms};
use crate::changes::model::ChangesReach;
use crate::db::session_links;
use crate::error::CommandError;
use crate::session_files::{
    self,
    model::{MemberIdentity, SessionFilesInput},
};

impl SessionRegistry {
    /// Die Eingabe für Liste und Grenze: alle Sessions des Vorhabens, auch beendete.
    pub fn session_files_input(&self, session_id: &str) -> Result<SessionFilesInput, CommandError> {
        let session = self.get(session_id)?;
        // Eine Session nach der anderen sperren — nie zwei zugleich; die Datenbank erst danach.
        let members: Vec<MemberIdentity> = self
            .project_members(&session.project_id)
            .iter()
            .map(|member: &Arc<Session>| MemberIdentity {
                session_id: member.id.clone(),
                number: member.number,
                name: member.lock().name.clone(),
                workspace: member.workspace.clone(),
                is_own: member.id == session.id,
            })
            .collect();
        let changes = self.changes_input(session_id, ChangesReach::Project)?;
        session_files::collect_input(&self.database, members, &changes)
    }

    /// Merkt einen angeklickten Dateilink als verlinkt: erst damit darf die App die Datei zeigen.
    pub fn record_linked_file(&self, session_id: &str, path: &str) -> Result<(), CommandError> {
        let session = self.get(session_id)?;
        self.database.with(|connection| {
            session_links::upsert_all(connection, &session.id, &[(path.to_owned(), now_ms())])
        })
    }
}
