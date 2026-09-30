use crate::changes::{
    self,
    model::{ChangeScope, FileDiff, SessionChanges},
};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;
use crate::worktrees::{self, TicketWorktree};

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen.

#[tauri::command]
pub async fn changes_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<SessionChanges, CommandError> {
    let (workspace, repositories) = registry.repositories_of(&session_id)?;
    let ticket_folders = registry.ticket_worktrees_of(&session_id)?;
    Ok(changes::load(&workspace, &repositories, &ticket_folders))
}

/// `key` wie in `RepositoryChanges`: `"<Position>"` oder `"<Position>/<Ordner>"`. Der Ordner kommt
/// aus der Oberfläche und wird zu einem Pfad — er muss der Session gehören und ein Worktree sein,
/// bevor irgendetwas ihn benutzt.
#[tauri::command]
pub async fn changes_file_diff(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
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
    let (workspace, repositories) = registry.repositories_of(&session_id)?;
    let Some(repository) = repositories.get(index) else {
        return Err(CommandError::Internal(format!(
            "Repository-Position {index} gibt es in dieser Session nicht"
        )));
    };
    let Some(folder) = folder else {
        return changes::file_diff(&workspace, repository, None, &path, scope);
    };
    validate_folder(folder)?;
    let position = u32::try_from(index)
        .map_err(|_| CommandError::Internal(format!("Ungültiger Schlüssel {key}")))?;
    let is_assigned = registry.ticket_worktrees_of(&session_id)?.iter().any(
        |(assigned_position, assigned_folder): &(u32, String)| {
            *assigned_position == position && assigned_folder.eq_ignore_ascii_case(folder)
        },
    );
    if !is_assigned {
        return Err(CommandError::Io(
            "Dieser Worktree gehört nicht zur Session.".to_owned(),
        ));
    }
    let found: Vec<TicketWorktree> =
        worktrees::ticket_worktrees(repository, position, &[folder.to_owned()]);
    let [ticket] = found.as_slice() else {
        return Err(CommandError::Io(
            "Diesen Worktree gibt es nicht mehr.".to_owned(),
        ));
    };
    changes::file_diff(&workspace, repository, Some(ticket), &path, scope)
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
