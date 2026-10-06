use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::changes::{model::ChangesReach, sources};
use crate::db::{Database, session_commits};
use crate::error::CommandError;
use crate::git::model::{GitBranch, GitSessionStatus, GitSwitchMode};
use crate::git::{actions, status};
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen. `key` wie in
// `RepositoryChanges`; `sources::find` nimmt nur einen, den die Changes der Session selbst gebaut
// haben — ein Pfad aus der Oberfläche wird nie angenommen (ADR 025). Befehle, die Dateien im
// Arbeitsordner ändern, prüfen zuerst die Sperre (`ensure_not_busy`), bevor sie Git aufrufen.

/// Der Git-Zustand aller Einträge in den Changes der Session und wer gerade die Sperre hält.
#[tauri::command]
pub async fn git_status(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<GitSessionStatus, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let busy = registry.busy_in_project(&session_id)?;
    Ok(status::session_status(&input, busy))
}

#[tauri::command]
pub async fn git_branches(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<Vec<GitBranch>, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let source = sources::find(&input, &key)?;
    status::branches(&source.dir)
}

/// Committet die angehakten Pfade; der Commit zählt als Commit der Session — sonst verschwänden die
/// Dateien aus den Changes (ADR 014). Ohne Sperre: der Commit fasst den Arbeitsordner nicht an.
// Die Parameter sind die Aufrufform der Oberfläche; zwei davon stellt Tauri selbst.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn git_commit(
    registry: tauri::State<'_, SessionRegistry>,
    database: tauri::State<'_, Arc<Database>>,
    session_id: String,
    key: String,
    paths: Vec<String>,
    message: String,
    push: bool,
    amend: bool,
) -> Result<(), CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    let commit = actions::commit(&dir, &paths, &message, amend)?;
    database.with(|connection| session_commits::insert_all(connection, &session_id, &[commit]))?;
    if !push {
        return Ok(());
    }
    actions::push(&dir).map_err(|error: CommandError| match error {
        CommandError::Git(message) => {
            CommandError::Git(format!("Commit angelegt, Push gescheitert: {message}"))
        }
        other => other,
    })?;
    fetch_quietly(&dir);
    Ok(())
}

#[tauri::command]
pub async fn git_push(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::push(&dir)?;
    fetch_quietly(&dir);
    Ok(())
}

#[tauri::command]
pub async fn git_pull(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::pull(&dir)?;
    fetch_quietly(&dir);
    Ok(())
}

#[tauri::command]
pub async fn git_fetch(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::fetch(&dir)
}

#[tauri::command]
pub async fn git_switch(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    branch: String,
    mode: GitSwitchMode,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::switch(&dir, &branch, mode)
}

/// Gesperrt wie `git_switch`: der Wechsel auf den neuen Branch fasst den Ordner an.
#[tauri::command]
pub async fn git_create_branch(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    name: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::create_branch(&dir, &name)
}

#[tauri::command]
pub async fn git_abort_operation(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::abort_operation(&dir)
}

/// Ordner des Eintrags `key` in den Changes der Session; ein Eintrag ohne bestimmbare Basis meldet
/// seinen Fehler, statt Git dort laufen zu lassen.
fn entry_dir(
    registry: &SessionRegistry,
    session_id: &str,
    key: &str,
) -> Result<PathBuf, CommandError> {
    let input = registry.changes_input(session_id, ChangesReach::Session)?;
    let source = sources::find(&input, key)?;
    if let Some(error) = source.error {
        return Err(CommandError::Git(error));
    }
    Ok(source.dir)
}

/// Fetch nach Push/Pull frischt ↓/↑ auf; scheitert er, bleibt der Befehl davor trotzdem gelungen.
fn fetch_quietly(dir: &Path) {
    let _ = actions::fetch(dir);
}
