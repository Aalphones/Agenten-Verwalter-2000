//! `Read`: Textdatei mit Zeilennummern, oder ein Bild, das als nächste Nachricht ans Modell geht.
use std::fs;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;

use super::{
    ToolContext, ToolImage, checked_path, is_binary, optional_count, required_string,
    shortened_line,
};

const DEFAULT_LIMIT: usize = 2000;
const BYTE_ORDER_MARK: char = '\u{feff}';
/// Größere Bilder sprengen Anfrage und Kontext.
const MAX_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const BYTES_PER_KILOBYTE: u64 = 1024;
const BYTES_PER_MEGABYTE: u64 = BYTES_PER_KILOBYTE * 1024;
/// Endung (klein geschrieben) und Medientyp der Bilder, die `Read` weitergibt.
const IMAGE_TYPES: [(&str, &str); 5] = [
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
];

/// Text der Antwort und bei einem Bild dessen Daten.
pub fn run(
    input: &Value,
    context: &mut ToolContext,
) -> Result<(String, Option<ToolImage>), String> {
    let path = checked_path(context, required_string(input, "file_path")?, false)?;
    if path.is_dir() {
        return Err(format!("Ist ein Ordner — nimm Glob: {}", path.display()));
    }
    if let Some(media_type) = image_media_type(&path) {
        return read_image(&path, media_type, context);
    }
    read_text(&path, input, context).map(|text: String| (text, None))
}

fn image_media_type(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_string_lossy().to_lowercase();
    IMAGE_TYPES
        .iter()
        .find(|(known, _): &&(&str, &str)| *known == extension)
        .map(|(_, media_type): &(&str, &str)| *media_type)
}

fn read_image(
    path: &Path,
    media_type: &str,
    context: &ToolContext,
) -> Result<(String, Option<ToolImage>), String> {
    if !context.has_vision {
        return Err("Das geladene Modell versteht keine Bilder.".to_owned());
    }
    let size = fs::metadata(path)
        .map_err(|error| format!("{} nicht lesbar: {error}", path.display()))?
        .len();
    if size > MAX_IMAGE_BYTES {
        return Err("Bild zu groß (über 5 MB).".to_owned());
    }
    let bytes =
        fs::read(path).map_err(|error| format!("{} nicht lesbar: {error}", path.display()))?;
    let text = format!(
        "Bild {} ({}) folgt als Bild in der nächsten Nachricht.",
        path.display(),
        size_text(size)
    );
    let image = ToolImage {
        path: path.display().to_string(),
        media_type: media_type.to_owned(),
        data: STANDARD.encode(bytes),
    };
    Ok((text, Some(image)))
}

/// „812 B“, „340 KB“, „1,2 MB“ — ganze Einheiten, bei Megabyte eine Nachkommastelle.
fn size_text(size: u64) -> String {
    if size < BYTES_PER_KILOBYTE {
        return format!("{size} B");
    }
    if size < BYTES_PER_MEGABYTE {
        return format!("{} KB", size / BYTES_PER_KILOBYTE);
    }
    let tenths = size * 10 / BYTES_PER_MEGABYTE;
    format!("{},{} MB", tenths / 10, tenths % 10)
}

fn read_text(path: &Path, input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let bytes =
        fs::read(path).map_err(|error| format!("{} nicht lesbar: {error}", path.display()))?;
    if is_binary(&bytes) {
        return Err(format!("Binärdatei: {}", path.display()));
    }
    context.remember_read(path);
    let text = String::from_utf8_lossy(&bytes);
    let text = text.trim_start_matches(BYTE_ORDER_MARK);
    if text.is_empty() {
        return Ok("(Datei ist leer)".to_owned());
    }
    // `lines` schneidet `\r\n` und `\n` ab; die Zeilenenden erhält erst `Edit`.
    let lines: Vec<&str> = text.lines().collect();
    let offset = optional_count(input, "offset").unwrap_or(1).max(1);
    let limit = optional_count(input, "limit")
        .filter(|limit: &usize| *limit > 0)
        .unwrap_or(DEFAULT_LIMIT);
    if offset > lines.len() {
        return Ok(format!("(Datei hat nur {} Zeilen)", lines.len()));
    }
    let first_index = offset - 1;
    let end_index = first_index.saturating_add(limit).min(lines.len());
    let mut numbered: Vec<String> = lines[first_index..end_index]
        .iter()
        .enumerate()
        .map(|(position, line): (usize, &&str)| {
            format!("{:>6}\t{}", offset + position, shortened_line(line))
        })
        .collect();
    let remaining = lines.len() - end_index;
    if remaining > 0 {
        numbered.push(format!(
            "… ({remaining} weitere Zeilen, mit offset weiterlesen)"
        ));
    }
    Ok(numbered.join("\n"))
}
