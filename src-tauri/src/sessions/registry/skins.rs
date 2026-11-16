//! Was die Skin-Werkzeuge (ADR 065) von der aufrufenden Session brauchen.
use std::path::PathBuf;

use super::SessionRegistry;
use crate::error::CommandError;

impl SessionRegistry {
    /// Arbeitsordner der Session und ihre Beschriftung „Session #<Nr> · <Name>“, wie sie als
    /// `changed_by` an einem Paket steht.
    pub fn skin_context(&self, session_id: &str) -> Result<(PathBuf, String), CommandError> {
        let session = self.get(session_id)?;
        let name: String = session.lock().name.clone();
        Ok((
            session.workspace.clone(),
            format!("Session #{} · {name}", session.number),
        ))
    }
}
