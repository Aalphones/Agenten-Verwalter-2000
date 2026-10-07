use crate::error::CommandError;
use crate::retro::model::RetroExport;
use crate::sessions::registry::SessionRegistry;

/// `async`: der Lauf dauert Minuten und darf den Haupt-Thread nicht blockieren.
#[tauri::command]
pub async fn retro_run(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<RetroExport, CommandError> {
    registry.run_retro(&app, &project_id)
}
