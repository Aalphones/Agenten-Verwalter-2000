//! Arbeitsordner der Sessions: die Sicherheitsgrenze, in der ein Agent arbeitet.
use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::error::CommandError;

/// Legt `<Benutzerordner>\.verwalter\workspaces\<session-id>\` an und liefert den Pfad.
pub fn session_workspace(
    app: &tauri::AppHandle,
    session_id: &str,
) -> Result<PathBuf, CommandError> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| CommandError::Io(error.to_string()))?;
    let workspace = home.join(".verwalter").join("workspaces").join(session_id);
    fs::create_dir_all(&workspace)?;
    Ok(workspace)
}
