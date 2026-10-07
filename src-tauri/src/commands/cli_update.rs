use std::sync::Arc;

use crate::cli_update::CliUpdateService;
use crate::cli_update::model::CliVersionStatus;
use crate::db::Database;
use crate::error::CommandError;
use crate::settings::{self, model::OperatingMode};

/// In „Autark“ gibt es keine Claude-Kommandozeile, die sich lesen oder aktualisieren ließe.
const STANDALONE_MESSAGE: &str = "In der Betriebsart Autark läuft keine Claude-Kommandozeile.";

// `async`, damit das Warten auf die Kommandozeile nicht den Haupt-Thread blockiert.

/// Liest installierte und jüngste Version neu und wartet dafür bis zu 15 s.
#[tauri::command]
pub async fn cli_update_load(
    service: tauri::State<'_, CliUpdateService>,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<CliVersionStatus, CommandError> {
    if is_standalone(&database)? {
        return Ok(CliVersionStatus {
            installed: None,
            latest: None,
            has_update: false,
            is_updating: false,
            last_update: None,
            installed_error: Some(STANDALONE_MESSAGE.to_owned()),
            latest_error: None,
        });
    }
    Ok(service.load())
}

/// Startet `claude update`; Start und Ende melden `cli-update://changed`.
#[tauri::command]
pub async fn cli_update_run(
    app: tauri::AppHandle,
    service: tauri::State<'_, CliUpdateService>,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<(), CommandError> {
    if is_standalone(&database)? {
        return Ok(());
    }
    service.update(&app);
    Ok(())
}

fn is_standalone(database: &Database) -> Result<bool, CommandError> {
    Ok(settings::load(database)?.operating_mode == OperatingMode::Standalone)
}
