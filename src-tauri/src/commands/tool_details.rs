use crate::agents::event::ToolDetail;
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

// `async`, damit der Datenbankzugriff nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn tool_detail(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    tool_use_id: String,
) -> Result<ToolDetail, CommandError> {
    registry.tool_detail(&session_id, &tool_use_id)
}
