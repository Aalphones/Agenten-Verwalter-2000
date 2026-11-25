//! Die Grenze zum Ansehen und Öffnen (ADR 071): erreichbar ist, was in einem Scratchpad einer
//! Session des Vorhabens oder in einem Repository-Eintrag liegt, und was eine Session geschrieben
//! oder verlinkt hat. Was nur irgendwo existiert, aber nie genannt wurde, bleibt zu.
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use super::model::{FileRef, SessionFilesInput, SessionFilesMember};
use super::{scratchpad_root, scratchpads_of};
use crate::changes::attribution::normalize_path;
use crate::error::CommandError;
use crate::file_links;
use crate::files::{self, model::FileContent};
use crate::filesystem;
use crate::sessions::registry::SessionRegistry;

const NOT_A_SESSION_FILE: &str = "Keine Datei einer Session dieses Vorhabens";

/// Der echte Pfad der Session-Datei `path` — oder die Absage. Der Pfad kommt aus der Oberfläche.
pub fn allowed_absolute(input: &SessionFilesInput, path: &str) -> Result<PathBuf, CommandError> {
    if !Path::new(path).is_absolute() || file_links::has_stream_colon(path) {
        return Err(not_a_session_file());
    }
    let canonical: PathBuf = match fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err(CommandError::FileNotFound(path.to_owned()));
        }
        Err(error) => return Err(error.into()),
    };
    if !canonical.is_file() {
        return Err(CommandError::FileNotFound(path.to_owned()));
    }
    if !is_in_open_folder(input, &canonical) && !is_named(input, path, &canonical) {
        return Err(not_a_session_file());
    }
    filesystem::plain_path(&canonical)
}

/// Die Session-Datei `path` zum Ansehen, wie `files_read` eine Datei eines Eintrags liefert.
pub fn read(input: &SessionFilesInput, path: &str) -> Result<FileContent, CommandError> {
    let file: PathBuf = allowed_absolute(input, path)?;
    let (Some(parent), Some(name)) = (file.parent(), file.file_name()) else {
        return Err(CommandError::FileNotFound(path.to_owned()));
    };
    files::read::read(parent, &name.to_string_lossy())
}

/// Der Pfad zu einer Adresse der Oberfläche, geprüft; die Datei gibt es.
pub fn resolve_ref(
    registry: &SessionRegistry,
    session_id: &str,
    file: &FileRef,
) -> Result<PathBuf, CommandError> {
    match file {
        FileRef::Entry { key, path } => {
            let dir: PathBuf = files::entry_dir(registry, session_id, key)?;
            let target: PathBuf = files::checked_path(&dir, path)?;
            // `checked_path` gibt einen fehlenden Pfad ungeprüft zurück.
            if !target.is_file() {
                return Err(CommandError::FileNotFound(path.clone()));
            }
            Ok(target)
        }
        FileRef::Absolute { path } => {
            allowed_absolute(&registry.session_files_input(session_id)?, path)
        }
    }
}

/// Ob die Datei wirklich in einem Scratchpad einer Session oder in einem Repository-Eintrag liegt.
fn is_in_open_folder(input: &SessionFilesInput, canonical: &Path) -> bool {
    let in_scratchpad: bool = input.members.iter().any(|member: &SessionFilesMember| {
        let (own, cli) = scratchpads_of(member);
        [own, cli]
            .into_iter()
            .flatten()
            .filter_map(|dir: PathBuf| scratchpad_root(&dir))
            .any(|root: PathBuf| canonical.starts_with(&root))
    });
    in_scratchpad
        || input
            .repository_dirs
            .iter()
            .filter(|dir: &&PathBuf| dir.is_absolute())
            .filter_map(|dir: &PathBuf| fs::canonicalize(dir).ok())
            .any(|root: PathBuf| canonical.starts_with(&root))
}

/// Ob eine Session den Pfad geschrieben oder verlinkt hat — in dieser Schreibweise
/// (`normalize_path`) oder als dieselbe Datei: die Liste zeigt den echten Pfad, gespeichert sein
/// kann einer mit `..`, Kurznamen oder über eine Verknüpfung.
fn is_named(input: &SessionFilesInput, path: &str, canonical: &Path) -> bool {
    let named = || {
        input
            .members
            .iter()
            .flat_map(|member: &SessionFilesMember| member.written.iter().chain(&member.linked))
    };
    let key: String = normalize_path(path);
    named().any(|stored: &String| normalize_path(stored) == key)
        || named()
            .filter(|stored: &&String| {
                Path::new(stored).is_absolute()
                    && !file_links::is_network_path(stored)
                    && !file_links::has_stream_colon(stored)
            })
            .any(|stored: &String| fs::canonicalize(stored).is_ok_and(|real| real == canonical))
}

fn not_a_session_file() -> CommandError {
    CommandError::FileNotAllowed(NOT_A_SESSION_FILE.to_owned())
}
