use std::sync::Arc;

use crate::db::Database;
use crate::error::CommandError;
use crate::lmstudio::{self, model::LocalModels};
use crate::settings::{
    self,
    model::{Settings, SettingsChange, SettingsOverview},
};

// `async`, damit Datenbank und Skill-Ordner nicht auf dem Haupt-Thread gelesen werden.

#[tauri::command]
pub async fn settings_load(
    app: tauri::AppHandle,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<SettingsOverview, CommandError> {
    settings::overview(&app, &database)
}

#[tauri::command]
pub async fn settings_update(
    database: tauri::State<'_, Arc<Database>>,
    change: SettingsChange,
) -> Result<Settings, CommandError> {
    settings::update(&database, change)
}

/// Die Modelle aus LM Studio; ein nicht erreichbarer Server steht in `error`, kein Fehler.
#[tauri::command]
pub async fn settings_local_models() -> Result<LocalModels, CommandError> {
    Ok(lmstudio::list())
}
