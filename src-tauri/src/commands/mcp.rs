use crate::error::CommandError;
use crate::mcp::model::{McpConfigView, McpDraft, SessionMcp};
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
pub async fn mcp_authenticate(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    server: String,
) -> Result<bool, CommandError> {
    registry.authenticate_mcp(&app, &session_id, &server)
}

/// Mit zuhörendem Agenten eine Steueranfrage, sonst schreibt der Core die Datei; in beiden
/// Fällen `true`. `everywhere`: beim Ausschalten in allen Vorhaben, beim Einschalten ohne Wirkung.
#[tauri::command]
pub async fn mcp_toggle(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    server: String,
    enabled: bool,
    everywhere: bool,
) -> Result<bool, CommandError> {
    registry.toggle_mcp(&app, &session_id, &server, enabled, everywhere)
}

/// Legt einen Server an oder ersetzt einen; Fehler als `invalid` mit einem Satz.
#[tauri::command]
pub async fn mcp_config_save(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    draft: McpDraft,
) -> Result<(), CommandError> {
    registry.save_mcp_server(&app, &session_id, &draft)
}

/// Entfernt einen Server aus seiner Quelle; fehlt er, ist das kein Fehler.
#[tauri::command]
pub async fn mcp_config_remove(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    source_id: String,
    name: String,
) -> Result<(), CommandError> {
    registry.remove_mcp_server(&app, &session_id, &source_id, &name)
}

/// Die Server aus den Konfigurationsdateien; braucht keinen Agenten.
#[tauri::command]
pub async fn mcp_config_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<McpConfigView, CommandError> {
    registry.mcp_config(&session_id)
}
