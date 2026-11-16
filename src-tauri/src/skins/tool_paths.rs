//! Dateipfade der Skin-Werkzeuge: der Agent erreicht nur Dateien im Arbeitsordner seiner Session.
//! Geprüft wird der aufgelöste Pfad (`canonicalize`), nie der Text: so führen `..`, Laufwerke und
//! Verknüpfungen nicht hinaus.
use std::path::{Path, PathBuf};

const OUTSIDE: &str = "Der Pfad liegt außerhalb des Arbeitsordners der Session.";

fn root_of(workspace: &Path) -> Result<PathBuf, String> {
    workspace
        .canonicalize()
        .map_err(|error| format!("Der Arbeitsordner ist nicht lesbar: {error}"))
}

/// Eine vorhandene Datei im Arbeitsordner; `text` ist relativ dazu (oder absolut, dann geprüft).
pub fn existing_file(workspace: &Path, text: &str) -> Result<PathBuf, String> {
    let root: PathBuf = root_of(workspace)?;
    let resolved: PathBuf = workspace
        .join(text.trim())
        .canonicalize()
        .map_err(|_| format!("Die Datei „{}“ gibt es nicht.", text.trim()))?;
    if !resolved.starts_with(&root) {
        return Err(OUTSIDE.to_owned());
    }
    if !resolved.is_file() {
        return Err(format!("„{}“ ist keine Datei.", text.trim()));
    }
    Ok(resolved)
}

/// Eine noch nicht vorhandene Datei mit Endung `extension` in einem vorhandenen Ordner des
/// Arbeitsordners.
pub fn new_file(workspace: &Path, text: &str, extension: &str) -> Result<PathBuf, String> {
    let root: PathBuf = root_of(workspace)?;
    let candidate: PathBuf = workspace.join(text.trim());
    let Some(file_name) = candidate.file_name().map(std::ffi::OsStr::to_owned) else {
        return Err(format!("„{}“ nennt keine Datei.", text.trim()));
    };
    let has_extension: bool = Path::new(&file_name)
        .extension()
        .is_some_and(|found: &std::ffi::OsStr| found.eq_ignore_ascii_case(extension));
    if !has_extension {
        return Err(format!("Die Datei muss auf .{extension} enden."));
    }
    let parent: PathBuf = candidate
        .parent()
        .unwrap_or(workspace)
        .canonicalize()
        .map_err(|_| format!("Der Ordner von „{}“ gibt es nicht.", text.trim()))?;
    if !parent.starts_with(&root) {
        return Err(OUTSIDE.to_owned());
    }
    let resolved: PathBuf = parent.join(file_name);
    // `symlink_metadata` zählt auch eine Verknüpfung ins Leere als vorhanden.
    if resolved.symlink_metadata().is_ok() {
        return Err(format!(
            "Die Datei „{}“ gibt es schon; wähle einen anderen Namen.",
            text.trim()
        ));
    }
    Ok(resolved)
}
