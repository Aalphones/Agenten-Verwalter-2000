use crate::agents::event::{Effort, Mode, ModelId};
use crate::error::CommandError;
use crate::projects::model::{ProjectCreated, ProjectSummary};
use crate::sessions::registry::{NewSession, SessionRegistry};

// Die Commands sind `async`, damit der Prozessstart nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn project_list(
    registry: tauri::State<'_, SessionRegistry>,
) -> Result<Vec<ProjectSummary>, CommandError> {
    Ok(registry.list_projects())
}

// Die Parameter sind die Aufrufform der Oberfläche (`createProject`); zwei davon stellt Tauri selbst.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn project_create(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    task: String,
    attachment_ids: Vec<String>,
    repository_ids: Vec<String>,
    model: ModelId,
    effort: Effort,
    mode: Mode,
) -> Result<ProjectCreated, CommandError> {
    registry.create_project(
        &app,
        NewSession {
            task: &task,
            attachment_ids: &attachment_ids,
            repository_ids: &repository_ids,
            model,
            effort,
            mode,
        },
    )
}

#[tauri::command]
pub async fn project_rename(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
    name: String,
) -> Result<(), CommandError> {
    registry.rename_project(&app, &project_id, &name)
}

#[tauri::command]
pub async fn project_archive(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<(), CommandError> {
    registry.archive_project(&app, &project_id)
}
