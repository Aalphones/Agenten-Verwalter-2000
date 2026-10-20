use std::sync::Arc;

use crate::db::Database;
use crate::error::CommandError;
use crate::lmstudio::{self, model::LocalModels};
use crate::settings::{
    self,
    model::{OperatingMode, Settings, SettingsChange, SettingsOverview},
};
use crate::usage::UsageService;

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
    app: tauri::AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    usage: tauri::State<'_, UsageService>,
    change: SettingsChange,
) -> Result<Settings, CommandError> {
    let changes_operating_mode = matches!(change, SettingsChange::OperatingMode { .. });
    let updated = settings::update(&database, change)?;
    // Das Kontingent gehört zum Abo der Betriebsart; der Stand der alten gilt nicht weiter.
    if changes_operating_mode
        && matches!(
            updated.operating_mode,
            OperatingMode::Claude | OperatingMode::Codex
        )
    {
        usage.restart(&app);
    }
    Ok(updated)
}

/// Die Modelle aus LM Studio; ein nicht erreichbarer Server steht in `error`, kein Fehler.
#[tauri::command]
pub async fn settings_local_models() -> Result<LocalModels, CommandError> {
    Ok(lmstudio::list())
}
