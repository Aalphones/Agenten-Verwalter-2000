use tauri::{AppHandle, Manager};

use crate::error::CommandError;
use crate::report::model::ReportView;
use crate::report::{self, TidyRuns};

/// Der Review-Bericht einer Umsetzung (ADR 073). `async`, weil Datenbank und Git gelesen werden.
#[tauri::command]
pub async fn report_load(
    app: AppHandle,
    implementation_id: String,
) -> Result<ReportView, CommandError> {
    report::load(&app, &implementation_id)
}

/// Die Umsetzung, zu deren Bericht die Session als Station gehört; `None`, wenn es keinen mit
/// Inhalt gibt.
#[tauri::command]
pub async fn report_of_session(
    app: AppHandle,
    session_id: String,
) -> Result<Option<String>, CommandError> {
    report::of_session(&app, &session_id)
}

/// Ordnet die Phase des Review-Berichts, auch eine laufende (ADR 075); kehrt sofort zurück, das
/// Ergebnis meldet `report://changed`. `async`, damit die Datenbank nicht auf dem Haupt-Thread
/// gelesen wird.
#[tauri::command]
pub async fn report_retidy(app: AppHandle, phase_id: String) -> Result<(), CommandError> {
    report::retidy(&app, &phase_id)
}

/// Bricht die laufende Ordnung der Phase ab; die vorherige bleibt. Läuft keine, ist das kein
/// Fehler.
#[tauri::command]
pub fn report_cancel_tidy(app: AppHandle, phase_id: String) -> Result<(), CommandError> {
    app.state::<TidyRuns>().cancel(&phase_id);
    Ok(())
}

/// Die Phasen der Umsetzung, die Haiku gerade ordnet.
#[tauri::command]
pub fn report_tidying(
    app: AppHandle,
    implementation_id: String,
) -> Result<Vec<String>, CommandError> {
    Ok(app.state::<TidyRuns>().tidying_of(&implementation_id))
}
