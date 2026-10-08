use std::sync::Arc;

use crate::archive::model::{ArchivePage, ProjectRestored};
use crate::archive::search;
use crate::db::Database;
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

/// Durchsucht das Archiv seitenweise; `offset` = Anzahl der Vorhaben, die die Oberfläche von dieser
/// Suche schon zeigt.
#[tauri::command]
pub async fn archive_search(
    database: tauri::State<'_, Arc<Database>>,
    query: String,
    offset: u32,
) -> Result<ArchivePage, CommandError> {
    let database = Arc::clone(&database);
    // Liest im schlimmsten Fall jeden archivierten Chat — nicht auf dem Thread der übrigen Befehle.
    tauri::async_runtime::spawn_blocking(move || search::run(&database, &query, offset))
        .await
        .map_err(|error| CommandError::Internal(error.to_string()))?
}

#[tauri::command]
pub async fn project_restore(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<ProjectRestored, CommandError> {
    registry.restore_project(&app, &project_id)
}
