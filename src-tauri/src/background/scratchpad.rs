//! Claudes Scratchpad-Ordner einer Session: auflisten und einzelne Dateien lesen, ohne aus dem
//! Ordner auszubrechen.
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};

use super::model::{ScratchpadEntry, ScratchpadListing, TextPreview};
use super::output::{MAX_PREVIEW_BYTES, preview_of};
use crate::error::CommandError;

const MAX_DEPTH: usize = 6;
const MAX_ENTRIES: usize = 2_000;
const INVALID_PATH: &str = "Ungültiger Pfad";
const DIRECTORY_PREVIEW: &str = "Ordner haben keine Vorschau";

/// Der Ordner als flache Liste, nach Pfad sortiert. Fehlt er oder ist er unbekannt, ist die Liste leer.
pub fn list(dir: Option<&Path>) -> ScratchpadListing {
    let mut listing = ScratchpadListing {
        dir: dir.map(|path: &Path| path.to_string_lossy().into_owned()),
        entries: Vec::new(),
        truncated: false,
    };
    if let Some(root) = dir {
        collect(root, "", 1, &mut listing);
    }
    listing
        .entries
        .sort_by(|left: &ScratchpadEntry, right: &ScratchpadEntry| {
            left.path.as_bytes().cmp(right.path.as_bytes())
        });
    listing
}

/// Symlinks werden aufgeführt, aber nicht betreten — ein Ring aus Links liefe sonst bis `MAX_DEPTH`.
fn collect(folder: &Path, prefix: &str, depth: usize, listing: &mut ScratchpadListing) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        if listing.entries.len() >= MAX_ENTRIES {
            listing.truncated = true;
            return;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let is_dir = metadata.is_dir();
        listing.entries.push(ScratchpadEntry {
            path: path.clone(),
            is_dir,
            size_bytes: if is_dir { 0 } else { metadata.len() },
            modified_ms: metadata.modified().map_or(0.0, |modified: SystemTime| {
                modified
                    .duration_since(UNIX_EPOCH)
                    .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
            }),
        });
        let is_real_dir = is_dir && !metadata.file_type().is_symlink();
        if is_real_dir && depth < MAX_DEPTH {
            collect(&entry.path(), &path, depth + 1, listing);
        }
    }
}

/// Die Datei `relative` im Ordner `dir`, vom Anfang bis `MAX_PREVIEW_BYTES`. Der Pfad kommt aus der
/// Oberfläche: `..`, Wurzel und Laufwerk sind verboten, und das kanonische Ziel muss unter dem
/// kanonischen Ordner liegen — sonst führte ein Symlink im Scratchpad nach draußen.
pub fn read(dir: &Path, relative: &str) -> Result<TextPreview, CommandError> {
    let has_escape = Path::new(relative)
        .components()
        .any(|component: Component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        });
    if relative.trim().is_empty() || has_escape {
        return Err(invalid_path());
    }
    let root = fs::canonicalize(dir)?;
    let target = fs::canonicalize(dir.join(relative)).map_err(|_| invalid_path())?;
    if !target.starts_with(&root) {
        return Err(invalid_path());
    }
    if target.is_dir() {
        return Err(CommandError::Io(DIRECTORY_PREVIEW.to_owned()));
    }
    let file = File::open(&target)?;
    let length = file.metadata()?.len();
    let mut bytes: Vec<u8> = Vec::new();
    file.take(MAX_PREVIEW_BYTES).read_to_end(&mut bytes)?;
    Ok(preview_of(&bytes, length > MAX_PREVIEW_BYTES))
}

fn invalid_path() -> CommandError {
    CommandError::Io(INVALID_PATH.to_owned())
}
