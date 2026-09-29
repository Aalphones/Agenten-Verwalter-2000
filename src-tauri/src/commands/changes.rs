use crate::changes::{self, model::SessionChanges};
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
