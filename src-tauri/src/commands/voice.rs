use std::path::PathBuf;
use std::sync::Arc;

use tauri::Manager;

use crate::db::Database;
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;
use crate::settings;
use crate::voice::VoiceService;
use crate::voice::model::VoiceModelState;
use crate::worktrees::SessionRepository;

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

/// Startet ein Diktat; Pegel und Zwischentext kommen als `voice://level` und `voice://partial`.
#[tauri::command]
pub async fn voice_start(
    app: tauri::AppHandle,
    voice: tauri::State<'_, VoiceService>,
    registry: tauri::State<'_, SessionRegistry>,
    database: tauri::State<'_, Arc<Database>>,
    session_id: Option<String>,
) -> Result<(), CommandError> {
    // Je Diktat gelesen: eine geänderte Sprache gilt ab dem nächsten Diktat.
    let language: Option<String> = settings::load(&database)?.voice_language;
    // Eine unbekannte Session kostet nur den Wortschatz-Hinweis, nicht das Diktat.
    let repository_names: Vec<String> = session_id
        .and_then(|id: String| registry.repositories_of(&id).ok())
        .map(|(_, repositories): (PathBuf, Vec<SessionRepository>)| {
            repositories
                .into_iter()
                .map(|repository: SessionRepository| repository.name)
                .collect()
        })
        .unwrap_or_default();
    voice.start(app, repository_names, language)
}

/// Kehrt erst zurück, wenn auch der letzte Abschnitt erkannt ist; liefert den gesamten Text.
#[tauri::command]
pub async fn voice_stop(app: tauri::AppHandle) -> Result<String, CommandError> {
    tauri::async_runtime::spawn_blocking(move || app.state::<VoiceService>().stop())
        .await
        .map_err(|error: tauri::Error| CommandError::Internal(format!("Diktat: {error}")))?
}

#[tauri::command]
pub async fn voice_cancel(voice: tauri::State<'_, VoiceService>) -> Result<(), CommandError> {
    voice.cancel();
    Ok(())
}
