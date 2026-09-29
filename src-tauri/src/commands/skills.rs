use std::path::PathBuf;
use std::sync::Arc;

use crate::db::Database;
use crate::db::repositories::{self as repository_rows, RepositoryRow};
use crate::error::CommandError;
use crate::filesystem::workspace::home_dir;
use crate::sessions::registry::SessionRegistry;
use crate::skills::{self, model::SkillInfo};

// `async`, damit das Lesen der Skill-Ordner nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn skill_list_for_session(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<Vec<SkillInfo>, CommandError> {
    let roots = registry.skill_roots(&session_id)?;
    Ok(skills::collect(&home_dir(&app)?, &roots))
}

/// Für „Neue Session“: gesucht wird in den Haupt-Checkouts der gewählten Repositories.
#[tauri::command]
pub async fn skill_list_for_repositories(
    app: tauri::AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    repository_ids: Vec<String>,
) -> Result<Vec<SkillInfo>, CommandError> {
    let rows: Vec<RepositoryRow> =
        database.with(|connection| repository_rows::get_many(connection, &repository_ids))?;
    let roots: Vec<(String, PathBuf)> = rows
        .into_iter()
        .map(|row: RepositoryRow| (row.name, PathBuf::from(row.path)))
        .collect();
    Ok(skills::collect(&home_dir(&app)?, &roots))
}
