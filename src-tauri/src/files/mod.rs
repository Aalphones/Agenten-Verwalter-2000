//! Ansicht „Dateien“ (ADR 067): der vollständige Baum eines Eintrags der Changes samt ignorierter
//! Einträge und der Inhalt einer Datei zum Ansehen. Welche Einträge es gibt und welcher Ordner zu
//! einem Schlüssel gehört, bleibt bei `changes::sources`; hier wird nur in diesem Ordner gelesen.
pub mod history;
pub mod model;
pub mod read;
pub mod tree;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::changes::{self, model::ChangesReach};
use crate::error::CommandError;
use crate::filesystem::native_path;
use crate::sessions::registry::SessionRegistry;

const OUTSIDE_REPOSITORY: &str = "Liegt außerhalb des Repositorys";

/// Der Ordner des Eintrags `key` — nur einer, den `sources` für das Vorhaben selbst gebaut hat.
pub(crate) fn entry_dir(
    registry: &SessionRegistry,
    session_id: &str,
    key: &str,
) -> Result<PathBuf, CommandError> {
    let input = registry.changes_input(session_id, ChangesReach::Project)?;
    let source = changes::sources::find(&input, key)?;
    if let Some(error) = source.error {
        return Err(CommandError::Git(error));
    }
    Ok(source.dir)
}

/// `path` aus der Oberfläche als Pfad in `dir` — nur, wenn er dort bleibt: kein `..`, kein absoluter
/// Pfad, und nach dem Auflösen symbolischer Links noch in `dir`. Gibt es den Pfad nicht, kommt er
/// ungeprüft auf Links zurück, damit der Aufrufer „fehlt“ melden kann; geöffnet wird dann nichts.
/// Rückgabe ist der unkanonische Pfad: das Präfix `\\?\` der kanonischen Form verstehen nicht alle
/// Programme, und der Link führt nachweislich in denselben Ordner.
pub(crate) fn checked_path(dir: &Path, path: &str) -> Result<PathBuf, CommandError> {
    changes::validate_path(path)?;
    let joined = dir.join(native_path(path));
    let target = match fs::canonicalize(&joined) {
        Ok(target) => target,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(joined),
        Err(error) => return Err(error.into()),
    };
    let root = fs::canonicalize(dir)?;
    if !target.starts_with(&root) {
        return Err(CommandError::FileNotAllowed(OUTSIDE_REPOSITORY.to_owned()));
    }
    Ok(joined)
}
