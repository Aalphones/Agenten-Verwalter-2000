use crate::context::model::SessionContext;
use crate::error::CommandError;
use crate::filesystem::workspace::home_dir;
use crate::sessions::registry::SessionRegistry;

// `async`, damit der Zugriff auf den Session-Zustand nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn context_load(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionContext, CommandError> {
    Ok(registry
        .context(&session_id)?
        .with_home_shortened(&home_dir(&app)?))
}

/// `false`, wenn der Agent nicht zuhört und deshalb nichts angefragt wurde.
#[tauri::command]
pub async fn context_refresh(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<bool, CommandError> {
    registry.refresh_context(&app, &session_id)
}
