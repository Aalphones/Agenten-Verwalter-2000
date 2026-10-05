use crate::account::AccountService;
use crate::account::model::AccountStatus;
use crate::error::CommandError;

// `async`, damit das Warten auf die Kommandozeile nicht den Haupt-Thread blockiert.

/// Liest das Konto neu und wartet dafür bis zu 15 s auf die Kommandozeile.
#[tauri::command]
pub async fn account_load(
    service: tauri::State<'_, AccountService>,
) -> Result<AccountStatus, CommandError> {
    Ok(service.load())
}

/// Startet die Anmeldung der Kommandozeile; Start und Ende melden `account://changed`.
#[tauri::command]
pub async fn account_login(
    app: tauri::AppHandle,
    service: tauri::State<'_, AccountService>,
) -> Result<(), CommandError> {
    service.login(&app);
    Ok(())
}
