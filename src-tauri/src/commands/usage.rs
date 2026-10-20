use std::sync::Arc;

use crate::db::Database;
use crate::error::CommandError;
use crate::settings::{self, model::OperatingMode};
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

/// Startet einen Abruf im Hintergrund; das Ergebnis meldet `usage://changed`. Nur „Claude“ und
/// „Codex“ haben ein Abo-Kontingent; in einer lokalen Betriebsart fragt der Verwalter Anthropic nicht
/// (ADR 016).
#[tauri::command]
pub async fn usage_refresh(
    app: tauri::AppHandle,
    service: tauri::State<'_, UsageService>,
    database: tauri::State<'_, Arc<Database>>,
    force: bool,
) -> Result<(), CommandError> {
    let operating_mode = settings::load(&database)?.operating_mode;
    if !matches!(operating_mode, OperatingMode::Claude | OperatingMode::Codex) {
        return Ok(());
    }
    service.refresh(&app, force);
    Ok(())
}
