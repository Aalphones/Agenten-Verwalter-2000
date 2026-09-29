use crate::changes::{
    self,
    model::{ChangeScope, FileDiff, SessionChanges},
};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen.

#[tauri::command]
pub async fn changes_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionChanges, CommandError> {
    let (workspace, repositories) = registry.repositories_of(&session_id)?;
    Ok(changes::load(&workspace, &repositories))
}

#[tauri::command]
pub async fn changes_file_diff(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    position: u32,
    path: String,
    scope: ChangeScope,
) -> Result<FileDiff, CommandError> {
    let (workspace, repositories) = registry.repositories_of(&session_id)?;
    let Some(repository) = repositories.get(position as usize) else {
        return Err(CommandError::Internal(format!(
            "Repository-Position {position} gibt es in dieser Session nicht"
        )));
    };
    changes::file_diff(&workspace, repository, &path, scope)
}
