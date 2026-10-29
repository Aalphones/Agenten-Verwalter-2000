use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;
use crate::side::model::SideQuestion;

// `async`, damit die Abfrage von LM Studio in `side_ask` nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn side_ask(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    question: String,
    quote: Option<String>,
) -> Result<String, CommandError> {
    registry.ask_side(&app, &session_id, &question, quote.as_deref())
}

#[tauri::command]
pub async fn side_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
) -> Result<Vec<SideQuestion>, CommandError> {
    registry.side_view(&session_id)
}

#[tauri::command]
pub async fn side_dismiss(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    id: String,
) -> Result<(), CommandError> {
    registry.dismiss_side(&session_id, &id)
}
