use std::path::{Path, PathBuf};

use tauri_plugin_opener::OpenerExt;

use crate::error::CommandError;
use crate::vault::{
    self,
    model::{VaultState, VaultStatus},
    search::{VaultQuery, VaultSearchResult},
    skeleton, tools,
};

// `async`, damit das Prüfen und Beschreiben des Ordners nicht auf dem Haupt-Thread läuft.

#[tauri::command]
pub async fn vault_status(app: tauri::AppHandle) -> Result<VaultStatus, CommandError> {
    Ok(vault::status(&app))
}

/// Gleicht den Index im Hintergrund mit dem Ordner ab; kehrt sofort zurück.
#[tauri::command]
pub async fn vault_rescan(app: tauri::AppHandle) -> Result<(), CommandError> {
    vault::spawn_scan(&app);
    Ok(())
}

/// Schreibt das Grundgerüst in den leeren Vault-Ordner bzw. nach `_vault` der Bibliothek;
/// `skeleton::create` prüft, dass das Ziel leer ist.
#[tauri::command]
pub async fn vault_create_skeleton(app: tauri::AppHandle) -> Result<VaultStatus, CommandError> {
    let current: VaultStatus = vault::status(&app);
    let Some(dir) = current
        .dir
        .as_deref()
        .filter(|_| current.state == VaultState::Ready)
    else {
        return Err(CommandError::Internal(
            "Der Vault ist nicht bereit.".to_owned(),
        ));
    };
    skeleton::create(Path::new(dir))?;
    vault::announce(&app);
    Ok(vault::status(&app))
}

/// Sucht im Vault für den Suchdialog; zieht den Index bei Bedarf nach, ohne zu warten.
#[tauri::command]
pub async fn vault_find(
    app: tauri::AppHandle,
    query: VaultQuery,
) -> Result<VaultSearchResult, CommandError> {
    vault::search::search(&app, &query)
}

/// Öffnet eine eingelesene Datei oder einen Ordner mit dem Standardprogramm, mit `reveal` zeigt
/// sie den Eintrag im Explorer. Nur Pfade, die auch `vault_get` liest.
#[tauri::command]
pub async fn vault_open(
    app: tauri::AppHandle,
    path: String,
    reveal: bool,
) -> Result<(), CommandError> {
    let target: PathBuf = vault::resolve(&app, &path).map_err(CommandError::Internal)?;
    if reveal {
        app.opener()
            .reveal_item_in_dir(&target)
            .map_err(|error| CommandError::Io(error.to_string()))
    } else {
        app.opener()
            .open_path(target.to_string_lossy(), None::<&str>)
            .map_err(|error| CommandError::Io(error.to_string()))
    }
}

/// Ein Bild des Vault als `data:`-Adresse für die Vorschau.
#[tauri::command]
pub async fn vault_preview(app: tauri::AppHandle, path: String) -> Result<String, CommandError> {
    tools::image_data_url(&app, &path).map_err(CommandError::Internal)
}
