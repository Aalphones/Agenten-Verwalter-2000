use crate::error::CommandError;
use crate::voice::VoiceService;
use crate::voice::model::VoiceModelState;

// `async`, damit der Dateizugriff nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn voice_model_status(
    app: tauri::AppHandle,
    voice: tauri::State<'_, VoiceService>,
) -> Result<VoiceModelState, CommandError> {
    voice.model_state(&app)
}

/// Startet den Download im Hintergrund; der Fortschritt kommt als `voice://model`.
#[tauri::command]
pub async fn voice_model_download(
    app: tauri::AppHandle,
    voice: tauri::State<'_, VoiceService>,
) -> Result<(), CommandError> {
    voice.start_download(&app)
}

#[tauri::command]
pub async fn voice_model_cancel_download(
    voice: tauri::State<'_, VoiceService>,
) -> Result<(), CommandError> {
    voice.cancel_download();
    Ok(())
}
