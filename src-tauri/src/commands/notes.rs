use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::notes::model::{NoteSaved, NoteText};
use crate::sessions::registry::SessionRegistry;

#[tauri::command]
pub async fn note_read(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
) -> Result<NoteText, CommandError> {
    // Nur die Existenzprüfung: ein unbekanntes Vorhaben bekommt keine Notiz.
    registry.project_workspace(&project_id)?;
    let path = crate::notes::path_of(&data_dir(&app)?, &project_id)?;
    crate::notes::read(&path)
}

#[tauri::command]
pub async fn note_write(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    project_id: String,
    text: String,
) -> Result<NoteSaved, CommandError> {
    registry.project_workspace(&project_id)?;
    let path = crate::notes::path_of(&data_dir(&app)?, &project_id)?;
    crate::notes::write(&path, &text)
}
