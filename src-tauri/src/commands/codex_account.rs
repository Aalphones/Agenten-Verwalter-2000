use crate::account::model::AccountStatus;
use crate::codex_account::CodexAccountService;
use crate::error::CommandError;

// `async`, damit das Warten auf Codex nicht den Haupt-Thread blockiert.

/// Liest das Codex-Konto neu und wartet dafür bis zu 20 s auf `codex app-server`.
#[tauri::command]
pub async fn codex_account_load(
    service: tauri::State<'_, CodexAccountService>,
) -> Result<AccountStatus, CommandError> {
    Ok(service.load())
}

/// Startet die Anmeldung von Codex im Browser; Start und Ende melden `codex-account://changed`.
#[tauri::command]
pub async fn codex_account_login(
    app: tauri::AppHandle,
    service: tauri::State<'_, CodexAccountService>,
) -> Result<(), CommandError> {
    service.login(&app);
    Ok(())
}
