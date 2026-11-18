use std::path::PathBuf;

use crate::changes::{self, model::ChangesReach};
use crate::error::CommandError;
use crate::files::{
    self,
    model::{DirEntry, FileContent, RepoTree},
};
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit Git und das Dateisystem nicht auf dem Haupt-Thread laufen. `key`
// wie in `RepositoryChanges`; aufgelöst immer über das ganze Vorhaben, damit jeder Eintrag der
// Ansicht „Dateien“ lesbar ist, gleich aus welcher Session er stammt (ADR 067).

/// Der Dateibaum eines Eintrags.
#[tauri::command]
pub async fn files_tree(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
) -> Result<RepoTree, CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    files::tree::tree(&dir)
}

/// Eine Ebene eines ignorierten Ordners im Eintrag.
#[tauri::command]
pub async fn files_ignored_children(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    path: String,
) -> Result<Vec<DirEntry>, CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    files::tree::ignored_children(&dir, &path)
}

/// Die Fassung einer Datei im Arbeitsverzeichnis des Eintrags.
#[tauri::command]
pub async fn files_read(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    path: String,
) -> Result<FileContent, CommandError> {
    let dir = entry_dir(&registry, &session_id, &key)?;
    files::read::read(&dir, &path)
}

/// Der Ordner des Eintrags `key` — nur einer, den `sources` für das Vorhaben selbst gebaut hat.
fn entry_dir(
    registry: &SessionRegistry,
    session_id: &str,
    key: &str,
) -> Result<PathBuf, CommandError> {
    let input = registry.changes_input(session_id, ChangesReach::Project)?;
    let source = changes::sources::find(&input, key)?;
    if let Some(error) = source.error {
        return Err(CommandError::Git(error));
    }
    Ok(source.dir)
}
