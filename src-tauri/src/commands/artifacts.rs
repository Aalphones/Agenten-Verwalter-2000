use tauri_plugin_opener::OpenerExt;

use crate::artifacts::{self, model::ArtifactList};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

/// Die Artefakte des Vorhabens, zu dem die Session gehört (ADR 026). `async`, damit Ordner und
/// Datenbank nicht auf dem Haupt-Thread gelesen werden.
#[tauri::command]
pub async fn artifacts_list(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<ArtifactList, CommandError> {
    let (workspace, owners) = registry.artifact_scope(&session_id)?;
    let dir = artifacts::dir(&workspace);
    let items = artifacts::list(&dir, &owners);
    Ok(ArtifactList {
        dir: dir.to_string_lossy().into_owned(),
        items,
    })
}

/// Öffnet ein Artefakt mit dem Standardprogramm. `file` kommt aus der Oberfläche: nur ein Name
/// direkt im Ordner, und `artifacts::resolve` prüft die Grenze, bevor etwas geöffnet wird.
#[tauri::command]
pub async fn artifact_open_in_browser(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    file: String,
) -> Result<(), CommandError> {
    if !artifacts::is_artifact_file(&file) {
        return Err(CommandError::FileNotAllowed(format!(
            "Kein Artefakt: {file}"
        )));
    }
    let dir = registry.artifacts_dir(&session_id)?;
    let target = artifacts::resolve(&dir, &file)?;
    app.opener()
        .open_path(target.to_string_lossy(), None::<&str>)
        .map_err(|error| CommandError::Io(error.to_string()))
}
