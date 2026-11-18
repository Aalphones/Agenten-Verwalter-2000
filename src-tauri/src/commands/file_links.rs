use std::path::PathBuf;

use tauri_plugin_opener::OpenerExt;

use crate::changes::model::ChangesReach;
use crate::changes::sources;
use crate::error::CommandError;
use crate::file_links::{self, FileLinkTarget};
use crate::sessions::registry::SessionRegistry;

/// Sagt, wohin ein Dateilink aus dem Chat führt (ADR 067): in „Dateien“, ins Standardprogramm oder
/// zur Suche nach dem Namen. Öffnet selbst nichts.
#[tauri::command]
pub async fn file_link_resolve(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    path: String,
) -> Result<FileLinkTarget, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Project)?;
    let entries: Vec<(String, PathBuf)> = sources::sources(&input)
        .into_iter()
        .map(|source: sources::Source| (source.key, source.dir))
        .collect();
    file_links::target(&path, &file_links::roots(&input), &entries)
}

/// Öffnet einen Dateiverweis aus dem Chat mit dem Standardprogramm (ADR 023). Der Pfad kommt aus
/// einer Agenten-Antwort: Endung und Sicherheitsgrenze prüft `file_links::resolve`, bevor irgendetwas
/// geöffnet wird. `async`, damit Git- und Dateizugriffe nicht auf dem Haupt-Thread laufen.
#[tauri::command]
pub async fn file_link_open(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    path: String,
) -> Result<(), CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Project)?;
    let target = file_links::resolve(&path, &file_links::roots(&input))?;
    app.opener()
        .open_path(target.to_string_lossy(), None::<&str>)
        .map_err(|error| CommandError::Io(error.to_string()))
}
