use crate::error::CommandError;
use crate::implementation::model::ImplementationView;
use crate::implementation::{now_ms, report};
use crate::sessions::registry::SessionRegistry;

/// Alle Umsetzungen nicht archivierter Vorhaben, neueste zuerst (ADR 048). `async`, damit die
/// Datenbank nicht auf dem Haupt-Thread gelesen wird.
#[tauri::command]
pub async fn implementation_list(
    registry: tauri::State<'_, SessionRegistry>,
) -> Result<Vec<ImplementationView>, CommandError> {
    registry.implementation_views()
}

/// Der Lagebericht als Text, wie der Agent ihn über `implementation_get` bekommt.
#[tauri::command]
pub async fn implementation_report(
    registry: tauri::State<'_, SessionRegistry>,
    id: String,
) -> Result<String, CommandError> {
    let view = registry.implementation_view(&id)?;
    Ok(report::text(&view, now_ms(), false))
}
