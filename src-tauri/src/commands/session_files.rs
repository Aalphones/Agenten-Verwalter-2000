use std::path::PathBuf;

use tauri_plugin_opener::OpenerExt;

use crate::error::CommandError;
use crate::file_links;
use crate::files::model::FileContent;
use crate::git;
use crate::session_files::{
    access,
    model::{FileRef, SessionFilesListing},
    scan,
};
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit Datenbank und Dateisystem nicht auf dem Haupt-Thread laufen. Jede
// Datei geht vorher durch die Grenze in `session_files::access` (ADR 071).

/// Die Session-Dateien des Vorhabens, zu dem die Session gehört.
#[tauri::command]
pub async fn session_files_list(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionFilesListing, CommandError> {
    Ok(scan::listing(&registry.session_files_input(&session_id)?))
}

/// Eine Session-Datei zum Ansehen.
#[tauri::command]
pub async fn session_file_read(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    path: String,
) -> Result<FileContent, CommandError> {
    access::read(&registry.session_files_input(&session_id)?, &path)
}

/// Zeigt eine Datei im Explorer, markiert in ihrem Ordner.
#[tauri::command]
pub async fn file_reveal(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    file: FileRef,
) -> Result<(), CommandError> {
    let target: PathBuf = access::resolve_ref(&registry, &session_id, &file)?;
    app.opener()
        .reveal_item_in_dir(&target)
        .map_err(|error| CommandError::Io(error.to_string()))
}

/// Öffnet eine Datei mit dem Standardprogramm; ausführbare Dateien lehnt `program_target` ab.
#[tauri::command]
pub async fn file_open_default(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    file: FileRef,
) -> Result<(), CommandError> {
    let resolved: PathBuf = access::resolve_ref(&registry, &session_id, &file)?;
    let target: PathBuf = file_links::program_target(&resolved)?;
    app.opener()
        .open_path(target.to_string_lossy(), None::<&str>)
        .map_err(|error| CommandError::Io(error.to_string()))
}

/// Öffnet eine Datei in VS Code, mit Zeile an dieser Stelle.
#[tauri::command]
pub async fn file_open_in_editor(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    file: FileRef,
    line: Option<u32>,
) -> Result<(), CommandError> {
    let target: PathBuf = access::resolve_ref(&registry, &session_id, &file)?;
    git::actions::open_file_in_vs_code(&target, line)
}
