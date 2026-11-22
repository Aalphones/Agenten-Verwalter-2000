//! Developer Vault: Ordner mit der Entwicklerbibliothek des Benutzers (ADR 068). Dieses Modul
//! kennt bisher Einstellung, Status und Grundgerüst; der Index kommt in einer späteren Phase.
pub mod model;
pub mod skeleton;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};

use crate::db::Database;
use crate::filesystem::workspace::{data_dir, home_dir};
use crate::settings;
use model::{VaultState, VaultStatus};

pub const CHANGED_EVENT: &str = "vault://changed";

/// Hält später die Verbindung zur Index-Datei und den laufenden Abgleich.
pub struct VaultService {}

impl Default for VaultService {
    fn default() -> Self {
        VaultService::new()
    }
}

impl VaultService {
    pub fn new() -> VaultService {
        VaultService {}
    }
}

/// Stand des Vault aus den Einstellungen und dem Ordner; Zähler und Abgleichzeit füllt erst der Index.
pub fn status(app: &AppHandle) -> VaultStatus {
    let database: Arc<Database> = Arc::clone(&app.state::<Arc<Database>>());
    let loaded = match settings::load(&database) {
        Ok(loaded) => loaded,
        Err(error) => return failure(None, format!("Einstellungen nicht lesbar: {error}")),
    };
    let Some(dir_text) = loaded.vault_dir.filter(|_| loaded.vault_enabled) else {
        return base(None, VaultState::Off);
    };
    let dir: PathBuf = PathBuf::from(&dir_text);
    let (home, data): (PathBuf, PathBuf) = match (home_dir(app), data_dir(app)) {
        (Ok(home), Ok(data)) => (home, data),
        (Err(error), _) | (_, Err(error)) => return failure(Some(dir_text), error.to_string()),
    };
    match check_dir(&dir, &home, &data) {
        Err((state, message)) => VaultStatus {
            message: Some(message),
            ..base(Some(dir_text), state)
        },
        Ok(()) => VaultStatus {
            is_empty_dir: is_empty_dir(&dir),
            ..base(Some(dir_text), VaultState::Ready)
        },
    }
}

/// Sendet den aktuellen Stand an die Oberfläche.
pub fn announce(app: &AppHandle) {
    if let Err(error) = app.emit(CHANGED_EVENT, status(app)) {
        eprintln!("Vault-Ereignis nicht gesendet: {error}");
    }
}

fn base(dir: Option<String>, state: VaultState) -> VaultStatus {
    VaultStatus {
        state,
        dir,
        files: 0,
        artifacts: 0,
        skipped: 0,
        scanned_at: None,
        message: None,
        is_empty_dir: false,
    }
}

fn failure(dir: Option<String>, message: String) -> VaultStatus {
    VaultStatus {
        message: Some(message),
        ..base(dir, VaultState::Error)
    }
}

/// Fehlt der Ordner, ist der Zustand `Missing`; ein ungeeigneter Ordner ist `Error`.
fn check_dir(dir: &Path, home: &Path, data_dir: &Path) -> Result<(), (VaultState, String)> {
    let Ok(resolved) = fs::canonicalize(dir) else {
        return Err((
            VaultState::Missing,
            format!("Ordner nicht gefunden: {}", dir.display()),
        ));
    };
    let resolved_home: PathBuf = fs::canonicalize(home).unwrap_or_else(|_| home.to_path_buf());
    if resolved == resolved_home {
        return Err((
            VaultState::Error,
            "Bitte einen Unterordner deines Benutzerordners wählen.".to_owned(),
        ));
    }
    let resolved_data: PathBuf =
        fs::canonicalize(data_dir).unwrap_or_else(|_| data_dir.to_path_buf());
    if resolved.starts_with(&resolved_data) {
        return Err((
            VaultState::Error,
            "Der Datenordner des Verwalters kann kein Vault sein.".to_owned(),
        ));
    }
    Ok(())
}

/// Wahr, wenn der Ordner lesbar ist und keinen Eintrag ohne führenden Punkt enthält.
pub fn is_empty_dir(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    entries
        .flatten()
        .all(|entry: fs::DirEntry| entry.file_name().to_string_lossy().starts_with('.'))
}
