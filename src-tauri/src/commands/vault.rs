use std::path::Path;

use crate::error::CommandError;
use crate::vault::{
    self,
    model::{VaultState, VaultStatus},
    skeleton,
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

/// Schreibt das Grundgerüst in den leeren Vault-Ordner.
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
