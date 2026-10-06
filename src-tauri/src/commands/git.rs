use crate::changes::{model::ChangesReach, sources};
use crate::error::CommandError;
use crate::git::model::{GitBranch, GitSessionStatus};
use crate::git::status;
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen. `key` wie in
// `RepositoryChanges`; `sources::find` nimmt nur einen, den die Changes der Session selbst gebaut
// haben — ein Pfad aus der Oberfläche wird nie angenommen (ADR 025).

/// Der Git-Zustand aller Einträge in den Changes der Session und wer gerade die Sperre hält.
#[tauri::command]
pub async fn git_status(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<GitSessionStatus, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let busy = registry.busy_in_project(&session_id)?;
    Ok(status::session_status(&input, busy))
}

#[tauri::command]
pub async fn git_branches(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<Vec<GitBranch>, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let source = sources::find(&input, &key)?;
    status::branches(&source.dir)
}
