//! Die Notiz eines Vorhabens: eine Textdatei im Datenordner des Verwalters, außerhalb jedes
//! Arbeitsordners, damit kein Agent sie beim Suchen oder Auflisten mitliest (ADR 074).
pub mod model;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::CommandError;
use model::{NoteSaved, NoteText};

const MAX_NOTE_BYTES: usize = 1024 * 1024;
const NOTES_FOLDER: &str = "notizen";
const NOTE_EXTENSION: &str = "txt";
const TOO_LARGE: &str = "Notiz ist größer als 1 MiB";

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|character: char| character.is_ascii_alphanumeric() || character == '-')
}

/// `<Datenordner>\notizen\<Vorhaben-ID>.txt`, auch wenn es sie nicht gibt.
/// Die ID wird geprüft, damit sie keinen Pfad aus dem Ordner heraus bilden kann.
pub fn path_of(data_dir: &Path, project_id: &str) -> Result<PathBuf, CommandError> {
    if !valid_id(project_id) {
        return Err(CommandError::Internal(format!(
            "Ungültige Vorhaben-ID für die Notiz: {project_id}"
        )));
    }
    Ok(data_dir
        .join(NOTES_FOLDER)
        .join(format!("{project_id}.{NOTE_EXTENSION}")))
}

fn modified_ms(path: &Path) -> f64 {
    fs::metadata(path)
        .and_then(|metadata: fs::Metadata| metadata.modified())
        .ok()
        .and_then(|time: SystemTime| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0.0, |elapsed: std::time::Duration| {
            elapsed.as_millis() as f64
        })
}

/// Liest die Notiz; fehlt die Datei, kommt ein leerer Text, und es wird nichts angelegt.
pub fn read(path: &Path) -> Result<NoteText, CommandError> {
    let bytes: Vec<u8> = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(NoteText {
                text: String::new(),
                modified_ms: 0.0,
            });
        }
        Err(error) => return Err(CommandError::Io(error.to_string())),
    };
    if bytes.len() > MAX_NOTE_BYTES {
        return Err(CommandError::Internal(TOO_LARGE.to_string()));
    }
    Ok(NoteText {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        modified_ms: modified_ms(path),
    })
}

/// Schreibt über eine Zwischendatei und benennt sie um, damit ein Abbruch nie eine halbe Notiz hinterlässt.
pub fn write(path: &Path, text: &str) -> Result<NoteSaved, CommandError> {
    if text.len() > MAX_NOTE_BYTES {
        return Err(CommandError::Internal(TOO_LARGE.to_string()));
    }
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder)
            .map_err(|error: io::Error| CommandError::Io(error.to_string()))?;
    }
    let mut temporary: PathBuf = path.to_path_buf().into_os_string().into();
    temporary.as_mut_os_string().push(".tmp");
    fs::write(&temporary, text.as_bytes())
        .map_err(|error: io::Error| CommandError::Io(error.to_string()))?;
    fs::rename(&temporary, path).map_err(|error: io::Error| CommandError::Io(error.to_string()))?;
    Ok(NoteSaved {
        modified_ms: modified_ms(path),
    })
}
