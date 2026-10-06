use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri_plugin_opener::OpenerExt;

use crate::agents::claude::locate::find_claude;
use crate::agents::claude::print::{HaikuRequest, ask_haiku};
use crate::changes::{model::ChangesReach, sources};
use crate::db::{Database, session_commits};
use crate::error::CommandError;
use crate::git::model::{GitBranch, GitLog, GitOpenTarget, GitSessionStatus, GitSwitchMode};
use crate::git::{self, actions, log, status};
use crate::sessions::registry::SessionRegistry;
use crate::worktrees::RepositoryCheckout;
use serde::Deserialize;

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

/// Setzt eine Datei auf den letzten Commit zurück (neue Dateien werden gelöscht); gesperrt wie
/// `git_switch`.
#[tauri::command]
pub async fn git_discard(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    path: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::discard(&dir, &path)
}

#[tauri::command]
pub async fn git_stash_push(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::stash_push(&dir)
}

/// Ohne Sperre: die Liste liest nur.
#[tauri::command]
pub async fn git_stash_list(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<Vec<String>, CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::stash_list(&dir)
}

#[tauri::command]
pub async fn git_stash_pop(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    index: u32,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::stash_pop(&dir, index)
}

#[tauri::command]
pub async fn git_pull_rebase(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::pull_rebase(&dir)?;
    fetch_quietly(&dir);
    Ok(())
}

#[tauri::command]
pub async fn git_merge(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    branch: String,
) -> Result<(), CommandError> {
    registry.ensure_not_busy(&session_id)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::merge(&dir, &branch)
}

/// Ohne Sperre: ein Branch, den niemand ausgecheckt hat, ändert keine Datei im Arbeitsordner.
#[tauri::command]
pub async fn git_delete_branch(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    branch: String,
    force: bool,
) -> Result<(), CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    actions::delete_branch(&dir, &branch, force)
}

/// Legt neben dem Haupt-Checkout einen Ticket-Worktree mit neuem Branch an und merkt ihn der Session,
/// damit er als eigener Eintrag in den Changes erscheint (ADR 025). Ohne Sperre: der Ordner des
/// Haupt-Checkouts bleibt unberührt.
#[tauri::command]
pub async fn git_create_ticket_worktree(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    name: String,
) -> Result<(), CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let source = sources::find(&input, &key)?;
    if let Some(error) = source.error {
        return Err(CommandError::Git(error));
    }
    let is_main_checkout = source.ticket.is_none()
        && !key.contains(['/', ':'])
        && matches!(source.repository.checkout, RepositoryCheckout::Main);
    if !is_main_checkout {
        return Err(CommandError::Git(
            "Nur am Haupt-Checkout möglich.".to_owned(),
        ));
    }
    let position: u32 = key
        .parse()
        .map_err(|_| CommandError::Internal(format!("Ungültiger Schlüssel {key}")))?;
    let folder = actions::create_ticket_worktree(&source.dir, &name)?;
    registry.remember_ticket_worktree(&session_id, position, &folder)
}

/// Öffnet den Ordner des Eintrags im Explorer oder in VS Code. Ohne Sperre: ändert nichts.
#[tauri::command]
pub async fn git_open(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    target: GitOpenTarget,
) -> Result<(), CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    match target {
        GitOpenTarget::Explorer => app
            .opener()
            .open_path(dir.to_string_lossy(), None::<&str>)
            .map_err(|error| CommandError::Io(error.to_string())),
        GitOpenTarget::VsCode => actions::open_in_vs_code(&dir),
    }
}

/// Die letzten Commits des ausgecheckten Branches und, was im Upstream noch dazukommt. Ohne Sperre: liest nur.
#[tauri::command]
pub async fn git_log(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<GitLog, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Session)?;
    let source = sources::find(&input, &key)?;
    if let Some(error) = source.error {
        return Err(CommandError::Git(error));
    }
    let upstream = git::upstream(&source.dir)?;
    log::read(&source.dir, &input.own.commits, upstream.as_deref())
}

#[derive(Deserialize)]
struct SuggestedMessage {
    message: String,
}

/// Lässt Haiku zum Diff der angehakten Pfade eine Commit-Nachricht schreiben. Ohne Sperre: ändert nichts.
#[tauri::command]
pub async fn git_suggest_message(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    paths: Vec<String>,
) -> Result<String, CommandError> {
    let exe = find_claude().ok_or(CommandError::ClaudeNotFound)?;
    let dir = entry_dir(&registry, &session_id, &key)?;
    // Haiku braucht bis zu einer Minute — nicht auf dem Thread der übrigen Befehle.
    tauri::async_runtime::spawn_blocking(move || {
        let diff = actions::suggest_input(&dir, &paths)?;
        let request = HaikuRequest {
            system_prompt: actions::SUGGEST_SYSTEM_PROMPT,
            json_schema: actions::SUGGEST_SCHEMA,
            input: &diff,
            timeout: actions::SUGGEST_TIMEOUT,
            autark_message: actions::SUGGEST_AUTARK_MESSAGE,
        };
        let suggested: SuggestedMessage =
            ask_haiku(&app, &exe, &request).map_err(CommandError::Internal)?;
        Ok(suggested.message.trim().to_owned())
    })
    .await
    .map_err(|error| CommandError::Internal(error.to_string()))?
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
