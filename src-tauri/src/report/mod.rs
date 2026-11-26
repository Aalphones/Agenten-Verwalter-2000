//! Review-Bericht einer Umsetzung (ADR 073): Stationen hängen über die Werkzeuge `report_*`
//! Einträge an; die Zeilen liegen in `db::report`, die Bilder im Bericht-Ordner.
pub mod anchor;
pub mod images;
pub mod model;
pub mod raw;
pub mod tools;

use std::path::PathBuf;

use tauri::AppHandle;

use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;

pub const REPORT_CHANGED_EVENT: &str = "report://changed";
const REPORTS_DIR_NAME: &str = "reports";

/// `<data_dir>\reports\<implementation_id>`; die Bilder liegen je Phase in einem Unterordner mit
/// deren ID (`phase_dir`), weil die Nummern der Einträge je Phase von vorn zählen.
pub fn report_dir(app: &AppHandle, implementation_id: &str) -> Result<PathBuf, CommandError> {
    Ok(data_dir(app)?
        .join(REPORTS_DIR_NAME)
        .join(implementation_id))
}

/// Der Ordner der Bilder einer Phase.
pub fn phase_dir(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
) -> Result<PathBuf, CommandError> {
    Ok(report_dir(app, implementation_id)?.join(phase_id))
}
