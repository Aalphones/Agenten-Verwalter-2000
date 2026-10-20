use crate::codex::models::{CodexModels, CodexService};
use crate::error::CommandError;

// `async`, damit der kurze Start von `codex app-server` nicht auf dem Haupt-Thread läuft.

/// Die Modelle, die Codex anbietet; ein Fehler steht in `error`, kein Throw.
#[tauri::command]
pub async fn codex_models(
    service: tauri::State<'_, CodexService>,
) -> Result<CodexModels, CommandError> {
    Ok(service.models())
}
