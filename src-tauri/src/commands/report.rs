use tauri::AppHandle;

use crate::error::CommandError;
use crate::report;

/// Ordnet die Phase des Review-Berichts neu (ADR 073); kehrt sofort zurück, das Ergebnis meldet
/// `report://changed`. `async`, damit die Datenbank nicht auf dem Haupt-Thread gelesen wird.
#[tauri::command]
pub async fn report_retidy(app: AppHandle, phase_id: String) -> Result<(), CommandError> {
    report::retidy(&app, &phase_id)
}
