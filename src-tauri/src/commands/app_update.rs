use crate::app_update::AppUpdateService;
use crate::app_update::model::AppUpdateStatus;
use crate::error::CommandError;

// `async`, damit das Warten auf GitHub und der Download nicht den Haupt-Thread blockieren.

/// Fragt die GitHub-Releases ab und wartet dafür bis zu 10 s.
#[tauri::command]
pub async fn app_update_load(
    app: tauri::AppHandle,
    service: tauri::State<'_, AppUpdateService>,
) -> Result<AppUpdateStatus, CommandError> {
    Ok(service.load(&app))
}

/// Lädt, prüft und installiert die neueste Version; Fortschritt über `app-update://progress`. Bei
/// Erfolg endet die App, zurück kommt nur ein Fehler.
#[tauri::command]
pub async fn app_update_install(
    app: tauri::AppHandle,
    service: tauri::State<'_, AppUpdateService>,
) -> Result<(), CommandError> {
    service.install(&app)
}
