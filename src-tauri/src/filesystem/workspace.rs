//! Arbeitsordner der Sessions: die Sicherheitsgrenze, in der ein Agent arbeitet.
//!
//! Der Arbeitsordner einer Session ändert sich nie: Claude legt den Verlauf unter dem
//! Arbeitsordner ab, und `--resume` fände ihn nach einem Wechsel nicht mehr.
use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::error::CommandError;

const WORKSPACES_DIR: &str = "workspaces";
const SHORT_ID_CHARS: usize = 8;

/// `<Benutzerordner>\.verwalter` — hier liegen Datenbank und Session-Arbeitsordner. Legt nichts an.
pub fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, CommandError> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| CommandError::Io(error.to_string()))?;
    Ok(home.join(".verwalter"))
}

/// Legt den Arbeitsordner einer neuen Session an: `workspaces\<erste 8 Zeichen der ID>`, und
/// wenn den schon eine andere Session belegt, `workspaces\<volle ID>`.
pub fn new_session_workspace(
    app: &tauri::AppHandle,
    session_id: &str,
) -> Result<PathBuf, CommandError> {
    let root = data_dir(app)?.join(WORKSPACES_DIR);
    let short_id: String = session_id.chars().take(SHORT_ID_CHARS).collect();
    let mut workspace = root.join(short_id);
    if workspace.exists() {
        workspace = root.join(session_id);
    }
    fs::create_dir_all(&workspace)?;
    Ok(workspace)
}

/// Der gespeicherte Arbeitsordner einer Session, bei Bedarf wieder angelegt.
pub fn stored_session_workspace(
    app: &tauri::AppHandle,
    session_id: &str,
    workspace_dir: Option<&str>,
) -> Result<PathBuf, CommandError> {
    let Some(dir) = workspace_dir else {
        return legacy_session_workspace(app, session_id);
    };
    let workspace = PathBuf::from(dir);
    fs::create_dir_all(&workspace)?;
    Ok(workspace)
}

/// Ordner der Sessions von vor Meilenstein 3: `workspaces\<volle ID>`, bei Bedarf angelegt.
fn legacy_session_workspace(
    app: &tauri::AppHandle,
    session_id: &str,
) -> Result<PathBuf, CommandError> {
    let workspace = data_dir(app)?.join(WORKSPACES_DIR).join(session_id);
    fs::create_dir_all(&workspace)?;
    Ok(workspace)
}
