//! Eine Datei aus dem Ordner eines Eintrags zum Ansehen: Text oder nur ihr Zustand. Bilder, Video,
//! Ton und PDF zeigt der Betrachter über seine Adresse (ADR 071), nicht dieser Weg.
use std::fs;
use std::path::Path;

use crate::changes::parse::MAX_DIFF_LINES;
use crate::changes::{self, BINARY_PROBE_BYTES, MAX_UNTRACKED_BYTES};
use crate::error::CommandError;
use crate::files::checked_path;
use crate::files::model::FileContent;

/// Die Fassung von `path` im Arbeitsverzeichnis `dir`. Prüft den Pfad, bevor etwas gelesen wird.
pub fn read(dir: &Path, path: &str) -> Result<FileContent, CommandError> {
    let file = checked_path(dir, path)?;
    let Ok(metadata) = fs::metadata(&file) else {
        return Ok(FileContent::Missing);
    };
    if !metadata.is_file() {
        return Ok(FileContent::Missing);
    }
    let size = metadata.len();
    let bytes = size as f64;
    if size > MAX_UNTRACKED_BYTES {
        return Ok(FileContent::TooLarge { bytes });
    }
    let data = fs::read(&file)?;
    if changes::is_binary(&data[..data.len().min(BINARY_PROBE_BYTES)]) {
        return Ok(FileContent::Binary { bytes });
    }
    Ok(text_content(&String::from_utf8_lossy(&data)))
}

/// Text mit `\n` als Zeilenende, an `MAX_DIFF_LINES` Zeilen gekürzt. `line_count` zählt die Zeilen
/// der ganzen Datei; ein abschließender Zeilenumbruch ist keine eigene Zeile.
fn text_content(content: &str) -> FileContent {
    let text = content.replace("\r\n", "\n");
    let mut lines: Vec<&str> = text.split('\n').collect();
    if text.ends_with('\n') || text.is_empty() {
        lines.pop();
    }
    let line_count = u32::try_from(lines.len()).unwrap_or(u32::MAX);
    if lines.len() <= MAX_DIFF_LINES {
        return FileContent::Text {
            text,
            line_count,
            truncated: false,
        };
    }
    let mut kept = lines[..MAX_DIFF_LINES].join("\n");
    kept.push('\n');
    FileContent::Text {
        text: kept,
        line_count,
        truncated: true,
    }
}
