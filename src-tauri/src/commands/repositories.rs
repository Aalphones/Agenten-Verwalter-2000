use std::sync::Arc;

use crate::db::Database;
use crate::error::CommandError;
use crate::repositories::{self, model::KnownRepository};

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen.

#[tauri::command]
pub async fn repository_list(
    database: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<KnownRepository>, CommandError> {
    repositories::list(&database)
}

#[tauri::command]
pub async fn repository_add(
    database: tauri::State<'_, Arc<Database>>,
    path: String,
) -> Result<KnownRepository, CommandError> {
    repositories::add(&database, &path)
}

#[tauri::command]
pub async fn repository_remove(
    database: tauri::State<'_, Arc<Database>>,
    repository_id: String,
) -> Result<(), CommandError> {
    repositories::remove(&database, &repository_id)
}
