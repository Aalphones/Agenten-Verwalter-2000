use crate::changes::{
    self,
    model::{ChangeScope, ChangesReach, FileDiff, SessionChanges},
};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;
use crate::worktrees::{self, TicketWorktree};

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen.

/// Die Changes der Reichweite (ADR 014): nur die Session oder das ganze Vorhaben.
#[tauri::command]
pub async fn changes_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    reach: ChangesReach,
) -> Result<SessionChanges, CommandError> {
    let input = registry.changes_input(&session_id, reach)?;
    Ok(changes::load(&input))
}

/// `key` wie in `RepositoryChanges`: `"<Position>"` oder `"<Position>/<Ordner>"`. Der Ordner kommt
/// aus der Oberfläche und wird zu einem Pfad — er muss dem Vorhaben gehören und ein Worktree sein,
/// bevor irgendetwas ihn benutzt.
#[tauri::command]
pub async fn changes_file_diff(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    reach: ChangesReach,
    key: String,
    path: String,
    scope: ChangeScope,
) -> Result<FileDiff, CommandError> {
    let (position_text, folder) = match key.split_once('/') {
        Some((position_text, folder)) => (position_text, Some(folder)),
        None => (key.as_str(), None),
    };
    let Ok(index) = position_text.parse::<usize>() else {
        return Err(CommandError::Internal(format!(
            "Ungültiger Schlüssel {key}"
        )));
    };
    let input = registry.changes_input(&session_id, reach)?;
    let Some(repository) = input.repositories.get(index) else {
        return Err(CommandError::Internal(format!(
            "Repository-Position {index} gibt es in dieser Session nicht"
        )));
    };
    let Some(folder) = folder else {
        return changes::file_diff(&input.workspace, repository, None, &path, scope, &input.own);
    };
    validate_folder(folder)?;
    let position = u32::try_from(index)
        .map_err(|_| CommandError::Internal(format!("Ungültiger Schlüssel {key}")))?;
    let is_assigned = registry.project_ticket_worktrees(&session_id)?.iter().any(
        |(assigned_position, assigned_folder): &(u32, String)| {
            *assigned_position == position && assigned_folder.eq_ignore_ascii_case(folder)
        },
    );
    if !is_assigned {
        return Err(CommandError::Io(
            "Dieser Worktree gehört nicht zum Vorhaben.".to_owned(),
        ));
    }
    let found: Vec<TicketWorktree> =
        worktrees::ticket_worktrees(repository, position, &[folder.to_owned()]);
    let [ticket] = found.as_slice() else {
        return Err(CommandError::Io(
            "Diesen Worktree gibt es nicht mehr.".to_owned(),
        ));
    };
    changes::file_diff(
        &input.workspace,
        repository,
        Some(ticket),
        &path,
        scope,
        &input.own,
    )
}

/// Ein einzelner Ordnername neben dem Haupt-Checkout — nichts, was woandershin führt.
fn validate_folder(folder: &str) -> Result<(), CommandError> {
    let leaves_parent =
        folder.is_empty() || folder == "." || folder == ".." || folder.contains(['/', '\\', ':']);
    if leaves_parent {
        return Err(CommandError::Internal(format!(
            "Ungültiger Ordner: {folder}"
        )));
    }
    Ok(())
}
