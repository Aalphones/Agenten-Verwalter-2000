use crate::changes::{
    self,
    model::{ChangeScope, ChangesReach, FileDiff, SessionChanges},
};
use crate::error::CommandError;
use crate::sessions::registry::SessionRegistry;

// Die Commands sind `async`, damit die Git-Aufrufe nicht auf dem Haupt-Thread laufen.

/// Die Changes der Reichweite (ADR 014): nur die Session oder das ganze Vorhaben.
#[tauri::command]
pub async fn changes_load(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    reach: ChangesReach,
) -> Result<SessionChanges, CommandError> {
    let input = registry.changes_input(&session_id, reach)?;
    Ok(changes::load(&input))
}

/// `key` wie in `RepositoryChanges`: `"<Position>"`, `"<Position>/<Ordner>"` oder
/// `"<Position>:<Ordner>"` (ADR 020). Der Schlüssel kommt aus der Oberfläche; `sources::find`
/// nimmt nur einen, den die Changes derselben Reichweite selbst gebaut haben, bevor irgendetwas
/// ihn als Pfad benutzt.
#[tauri::command]
pub async fn changes_file_diff(
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    reach: ChangesReach,
    key: String,
    path: String,
    scope: ChangeScope,
) -> Result<FileDiff, CommandError> {
    let input = registry.changes_input(&session_id, reach)?;
    let source = changes::sources::find(&input, &key)?;
    changes::file_diff(&source, &path, scope, &input.own)
}
