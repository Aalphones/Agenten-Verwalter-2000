use crate::background::model::{SessionBackground, TextPreview};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

// `async`, damit Datei- und Datenbankzugriffe nicht auf dem Haupt-Thread laufen.

#[tauri::command]
pub async fn background_load(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionBackground, CommandError> {
    registry.background(&app, &session_id)
}

#[tauri::command]
pub async fn background_output(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    item_id: String,
) -> Result<TextPreview, CommandError> {
    registry.background_output(&session_id, &item_id)
}

#[tauri::command]
pub async fn background_stop(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    item_id: String,
) -> Result<(), CommandError> {
    registry.stop_background(&app, &session_id, &item_id)
}
