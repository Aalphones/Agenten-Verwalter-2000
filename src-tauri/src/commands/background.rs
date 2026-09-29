use crate::background::model::{ScratchpadListing, SessionBackground, TextPreview};
use crate::background::scratchpad;
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

/// Gelesen wird ohne Session-Sperre: der Ordner gehört dem Agenten, nicht dem Session-Zustand.
#[tauri::command]
pub async fn scratchpad_list(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<ScratchpadListing, CommandError> {
    let dir = registry.scratchpad_dir(&session_id)?;
    Ok(scratchpad::list(dir.as_deref()))
}

#[tauri::command]
pub async fn scratchpad_read(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    path: String,
) -> Result<TextPreview, CommandError> {
    let Some(dir) = registry.scratchpad_dir(&session_id)? else {
        return Err(CommandError::Io(
            "Kein Scratchpad-Ordner bekannt".to_owned(),
        ));
    };
    scratchpad::read(&dir, &path)
}
