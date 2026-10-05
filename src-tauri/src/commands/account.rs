use std::sync::Arc;

use crate::account::AccountService;
use crate::account::model::AccountStatus;
use crate::db::Database;
use crate::error::CommandError;
use crate::settings::{self, model::OperatingMode};

/// In „Autark“ startet keine `claude.exe` — auch nicht, wenn die Oberfläche doch nach dem Konto fragt.
const STANDALONE_MESSAGE: &str = "In der Betriebsart Autark gibt es kein Claude-Konto.";

// `async`, damit das Warten auf die Kommandozeile nicht den Haupt-Thread blockiert.

/// Liest das Konto neu und wartet dafür bis zu 15 s auf die Kommandozeile.
#[tauri::command]
pub async fn account_load(
    service: tauri::State<'_, AccountService>,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<AccountStatus, CommandError> {
    if is_standalone(&database)? {
        return Ok(AccountStatus {
            info: None,
            error: Some(STANDALONE_MESSAGE.to_owned()),
            is_logging_in: false,
        });
    }
    Ok(service.load())
}

/// Startet die Anmeldung der Kommandozeile; Start und Ende melden `account://changed`.
#[tauri::command]
pub async fn account_login(
    app: tauri::AppHandle,
    service: tauri::State<'_, AccountService>,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<(), CommandError> {
    if is_standalone(&database)? {
        return Ok(());
    }
    service.login(&app);
    Ok(())
}

fn is_standalone(database: &Database) -> Result<bool, CommandError> {
    Ok(settings::load(database)?.operating_mode == OperatingMode::Standalone)
}
