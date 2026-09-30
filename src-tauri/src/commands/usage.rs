use crate::error::CommandError;
use crate::usage::UsageService;
use crate::usage::model::UsageStatus;

// `async`, damit der Zugriff auf den Zwischenspeicher nicht auf dem Haupt-Thread läuft.

/// Der Zwischenspeicher, ohne einen Abruf zu starten.
#[tauri::command]
pub async fn usage_load(
    service: tauri::State<'_, UsageService>,
) -> Result<UsageStatus, CommandError> {
    Ok(service.status())
}

/// Startet einen Abruf im Hintergrund; das Ergebnis meldet `usage://changed`.
#[tauri::command]
pub async fn usage_refresh(
    app: tauri::AppHandle,
    service: tauri::State<'_, UsageService>,
    force: bool,
) -> Result<(), CommandError> {
    service.refresh(&app, force);
    Ok(())
}
