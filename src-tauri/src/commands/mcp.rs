use crate::error::CommandError;
use crate::mcp::model::SessionMcp;
use crate::sessions::registry::SessionRegistry;

// `async`, damit der Zugriff auf den Session-Zustand nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn mcp_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionMcp, CommandError> {
    registry.mcp(&session_id)
}

/// `false`, wenn der Agent nicht zuhört und deshalb nichts angefragt wurde.
#[tauri::command]
pub async fn mcp_refresh(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<bool, CommandError> {
    registry.refresh_mcp(&app, &session_id)
}

/// `false`, wenn der Agent nicht zuhört und deshalb nichts angefragt wurde.
#[tauri::command]
pub async fn mcp_reconnect(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    server: String,
) -> Result<bool, CommandError> {
    registry.reconnect_mcp(&app, &session_id, &server)
}

/// `false`, wenn der Agent nicht zuhört und deshalb nichts angefragt wurde.
#[tauri::command]
pub async fn mcp_toggle(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    server: String,
    enabled: bool,
) -> Result<bool, CommandError> {
    registry.toggle_mcp(&app, &session_id, &server, enabled)
}
