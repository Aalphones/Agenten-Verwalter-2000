use crate::agents::event::{Effort, Mode, ModelId};
use crate::error::CommandError;
use crate::sessions::model::SessionSummary;
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit der Prozessstart nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn session_create(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    task: String,
    model: ModelId,
    effort: Effort,
    mode: Mode,
) -> Result<SessionSummary, CommandError> {
    registry.create(&app, &task, model, effort, mode)
}

#[tauri::command]
pub async fn session_list(
    registry: tauri::State<'_, SessionRegistry>,
) -> Result<Vec<SessionSummary>, CommandError> {
    Ok(registry.list())
}

#[tauri::command]
pub async fn session_pause(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), CommandError> {
    registry.pause(&app, &session_id)
}

#[tauri::command]
pub async fn session_resume(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), CommandError> {
    registry.resume(&app, &session_id)
}

#[tauri::command]
pub async fn session_cancel(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), CommandError> {
    registry.cancel(&app, &session_id)
}

#[tauri::command]
pub async fn session_restart(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), CommandError> {
    registry.restart(&app, &session_id)
}

#[tauri::command]
pub async fn session_set_model(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    model: ModelId,
) -> Result<(), CommandError> {
    registry.set_model(&app, &session_id, model)
}

#[tauri::command]
pub async fn session_set_mode(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    mode: Mode,
) -> Result<(), CommandError> {
    registry.set_mode(&app, &session_id, mode)
}

#[tauri::command]
pub async fn session_set_effort(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    effort: Effort,
) -> Result<(), CommandError> {
    registry.set_effort(&app, &session_id, effort)
}

#[tauri::command]
pub async fn session_log(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<Vec<String>, CommandError> {
    registry.log(&session_id)
}
