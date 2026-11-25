use crate::changes::{
    self,
    model::{ChangesReach, FileDiff},
};
use crate::error::CommandError;
use crate::files::{
    self,
    model::{DirEntry, FileContent, ProjectHistory, RepoTree},
};
use crate::git;
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
    let dir = files::entry_dir(&registry, &session_id, &key)?;
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
    let dir = files::entry_dir(&registry, &session_id, &key)?;
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
    let dir = files::entry_dir(&registry, &session_id, &key)?;
    files::read::read(&dir, &path)
}

/// Der Verlauf des ganzen Vorhabens: je Session ihre Commits mit Dateien.
#[tauri::command]
pub async fn files_history(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<ProjectHistory, CommandError> {
    let (input, sessions, pairs) = registry.history_input(&session_id)?;
    Ok(files::history::history(&input, &sessions, &pairs))
}

/// Der Diff eines eigenen Commits an einer Datei gegen seinen ersten Elternteil.
#[tauri::command]
pub async fn files_commit_diff(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    commit: String,
    path: String,
) -> Result<FileDiff, CommandError> {
    let input = registry.changes_input(&session_id, ChangesReach::Project)?;
    let source = changes::sources::find(&input, &key)?;
    files::history::commit_diff(&source, &input.own, &commit, &path)
}

/// Öffnet eine Datei des Eintrags in VS Code, mit Zeile an dieser Stelle.
#[tauri::command]
pub async fn files_open_in_editor(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    key: String,
    path: String,
    line: Option<u32>,
) -> Result<(), CommandError> {
    let dir = files::entry_dir(&registry, &session_id, &key)?;
    let file = files::checked_path(&dir, &path)?;
    git::actions::open_file_in_vs_code(&file, line)
}
