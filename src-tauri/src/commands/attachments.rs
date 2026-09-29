use crate::agents::event::Attachment;
use crate::attachments;
use crate::error::CommandError;

// `async`, damit das Kopieren großer Dateien nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn attachment_add_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<Attachment>, CommandError> {
    attachments::add_files(&app, &paths)
}

#[tauri::command]
pub async fn attachment_add_bytes(
    app: tauri::AppHandle,
    name: String,
    data_base64: String,
) -> Result<Attachment, CommandError> {
    attachments::add_bytes(&app, &name, &data_base64)
}

#[tauri::command]
pub async fn attachment_discard(app: tauri::AppHandle, id: String) -> Result<(), CommandError> {
    attachments::discard(&app, &id)
}
