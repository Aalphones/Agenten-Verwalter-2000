use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;
use crate::tldr::model::{ProjectTldrView, SessionTldrView};

// `async`, damit das Laden eines Verlaufs aus der Datenbank nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn tldr_session_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionTldrView, CommandError> {
    registry.session_tldr_view(&session_id)
}

#[tauri::command]
pub async fn tldr_session_create(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), CommandError> {
    registry.start_session_tldr(&app, &session_id)
}

#[tauri::command]
pub async fn tldr_project_load(
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<ProjectTldrView, CommandError> {
    registry.project_tldr_view(&project_id)
}

#[tauri::command]
pub async fn tldr_project_create(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<(), CommandError> {
    registry.start_project_tldr(&app, &project_id)
}

#[tauri::command]
pub async fn tldr_set_carry(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    carry: bool,
) -> Result<(), CommandError> {
    registry.set_carry(&session_id, carry)
}
