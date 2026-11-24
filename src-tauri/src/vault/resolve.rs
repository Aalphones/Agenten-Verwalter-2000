//! Pfadprüfung des Developer Vault: was ein Agent über `vault_get` lesen und der Benutzer im
//! Suchdialog öffnen darf. Beide gehen durch dieselbe Funktion.
use std::path::PathBuf;
use std::sync::Arc;

use rusqlite::Connection;
use tauri::AppHandle;

use super::index::{self, FileRow, VaultIndex};
use super::model::VaultStatus;
use super::search::{self, escape_like};
use crate::error::CommandError;
use crate::filesystem::native_path;

pub const OUTSIDE: &str = "Der Pfad liegt außerhalb des Vault.";

/// Ein geprüfter Pfad samt Vault-Ordner, Index und der Zeile der Datei (`None` bei einem Ordner).
pub struct Located {
    pub root: PathBuf,
    pub index: Arc<VaultIndex>,
    pub path: String,
    pub row: Option<FileRow>,
}

/// Wandelt einen Fehler des Cores in einen Satz.
pub fn sentence(error: CommandError) -> String {
    match error {
        CommandError::Internal(text) => text,
        other => other.to_string(),
    }
}

/// Prüft einen Pfad relativ zum Vault (Trenner `/`, ohne führenden oder folgenden Trenner):
/// Vault bereit, Pfad innerhalb des Ordners, danach die Zeile der Datei aus dem Index.
pub fn locate(app: &AppHandle, path: &str) -> Result<Located, String> {
    let status: VaultStatus = super::status(app);
    search::ensure_usable(&status).map_err(sentence)?;
    let index: Arc<VaultIndex> = super::index(app).map_err(sentence)?;
    let root: PathBuf = status
        .dir
        .map(PathBuf::from)
        .ok_or_else(|| search::NOT_SET_UP.to_owned())?;
    if !path.is_empty() {
        crate::files::checked_path(&root, path).map_err(|_| OUTSIDE.to_owned())?;
    }
    let row: Option<FileRow> = index
        .with(|connection: &mut Connection| index::file_row(connection, path))
        .map_err(sentence)?;
    Ok(Located {
        root,
        index,
        path: path.to_owned(),
        row,
    })
}

/// Der absolute Pfad einer eingelesenen Datei oder eines Ordners, der solche Dateien enthält;
/// sonst ein Fehlersatz wie bei `vault_get`.
pub fn resolve(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let path: String = path.replace('\\', "/").trim_matches('/').to_owned();
    let located: Located = locate(app, &path)?;
    if let Some(row) = &located.row {
        if let Some(error) = &row.error {
            return Err(format!(
                "Diese Datei konnte nicht eingelesen werden: {error}"
            ));
        }
        return Ok(located.root.join(native_path(&located.path)));
    }
    let prefix: String = if path.is_empty() {
        String::new()
    } else {
        format!("{path}/")
    };
    let known: bool = located
        .index
        .with(|connection: &mut Connection| {
            let count: i64 = connection.query_row(
                "SELECT COUNT(*) FROM files WHERE path LIKE ?1 ESCAPE '\\' AND error IS NULL",
                [format!("{}%", escape_like(&prefix))],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
        .map_err(sentence)?;
    if !known {
        return Err(format!("Nicht im Vault-Index: {path}."));
    }
    Ok(located.root.join(native_path(&located.path)))
}
