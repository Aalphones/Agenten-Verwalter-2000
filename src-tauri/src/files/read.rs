//! Eine Datei aus dem Ordner eines Eintrags zum Ansehen: Text, Bild oder nur ihr Zustand.
use std::fs;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;

use crate::changes::parse::MAX_DIFF_LINES;
use crate::changes::{self, BINARY_PROBE_BYTES, MAX_UNTRACKED_BYTES};
use crate::error::CommandError;
use crate::files::checked_path;
use crate::files::model::FileContent;

/// Bilder gehen als `data:`-Adresse über die Tauri-Grenze; größere zeigt die Ansicht nicht.
pub const MAX_IMAGE_BYTES: u64 = 2 * 1024 * 1024;
/// Endung (klein) → MIME-Typ der Bilder, die die Ansicht zeigt.
pub const IMAGE_EXTENSIONS: &[(&str, &str)] = &[
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
    ("svg", "image/svg+xml"),
    ("ico", "image/x-icon"),
];

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
    if let Some(mime) = image_mime(&file) {
        if size > MAX_IMAGE_BYTES {
            return Ok(FileContent::TooLarge { bytes });
        }
        let data = fs::read(&file)?;
        return Ok(FileContent::Image {
            data_url: format!("data:{mime};base64,{}", STANDARD.encode(data)),
            bytes,
        });
    }
    if size > MAX_UNTRACKED_BYTES {
        return Ok(FileContent::TooLarge { bytes });
    }
    let data = fs::read(&file)?;
    if changes::is_binary(&data[..data.len().min(BINARY_PROBE_BYTES)]) {
        return Ok(FileContent::Binary { bytes });
    }
    Ok(text_content(&String::from_utf8_lossy(&data)))
}

fn image_mime(file: &Path) -> Option<&'static str> {
    let extension = file.extension()?.to_str()?.to_ascii_lowercase();
    IMAGE_EXTENSIONS
        .iter()
        .find(|(known, _): &&(&str, &str)| *known == extension)
        .map(|(_, mime): &(&str, &'static str)| *mime)
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
