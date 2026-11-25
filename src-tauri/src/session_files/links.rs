//! Erkennt in einer Agenten-Antwort die absoluten Dateipfade, die die Oberfläche als Dateilink
//! zeigt (Inline-Code und Ziele von Markdown-Links, Vorbild `filePathOf` in `src/lib/fileLinks.ts`).
use std::path::Path;

use crate::artifacts::{self, model::ArtifactKind};
use crate::file_links::{self, OPENABLE_EXTENSIONS, VIEWABLE_EXTENSIONS};
use crate::sourcing;

const MAX_PATH_LENGTH: usize = 400;
const FILE_URL_PREFIX: &str = "file:///";

/// Die absoluten Pfade der Dateilinks einer Antwort, ohne angehängte Zeile, mit nativem Trenner, in
/// der Reihenfolge des ersten Auftretens. Relative Pfade, Text ohne Dateiendung und der Inhalt von
/// Code-Blöcken zählen nicht.
pub fn link_candidates(text: &str) -> Vec<String> {
    let prose: String = sourcing::strip_fences(text);
    let mut found: Vec<String> = Vec::new();
    for raw in raw_candidates(&prose) {
        if !is_link_path(&raw) {
            continue;
        }
        let cleaned: String = file_links::clean(&raw);
        if is_absolute_path(&cleaned) && !found.contains(&cleaned) {
            found.push(cleaned);
        }
    }
    found
}

/// Inline-Code-Spannen und Ziele von Markdown-Links in der Reihenfolge ihres Auftretens. Ein Link
/// innerhalb einer Code-Spanne zählt nicht, weil das Lesen die ganze Spanne überspringt.
fn raw_candidates(prose: &str) -> Vec<String> {
    let bytes: &[u8] = prose.as_bytes();
    let mut raw: Vec<String> = Vec::new();
    let mut index: usize = 0;
    while index < bytes.len() {
        if bytes[index] == b'`' {
            let opening: usize = backtick_run(bytes, index);
            let content_start: usize = index + opening;
            let Some(closing) = closing_run(bytes, content_start, opening) else {
                index = content_start;
                continue;
            };
            raw.push(prose[content_start..closing].trim().to_owned());
            index = closing + opening;
        } else if bytes[index] == b']' && bytes.get(index + 1) == Some(&b'(') {
            let Some((target, next)) = link_target(prose, index + 2) else {
                index += 2;
                continue;
            };
            raw.push(percent_decoded(&target));
            index = next;
        } else {
            index += 1;
        }
    }
    raw
}

/// Länge der Folge von Backticks, die bei `start` beginnt.
fn backtick_run(bytes: &[u8], start: usize) -> usize {
    bytes[start..]
        .iter()
        .take_while(|byte: &&u8| **byte == b'`')
        .count()
}

/// Beginn der nächsten Folge von genau `length` Backticks ab `from`.
fn closing_run(bytes: &[u8], from: usize, length: usize) -> Option<usize> {
    let mut index: usize = from;
    while index < bytes.len() {
        if bytes[index] == b'`' {
            let run: usize = backtick_run(bytes, index);
            if run == length {
                return Some(index);
            }
            index += run;
        } else {
            index += 1;
        }
    }
    None
}

/// Das Ziel eines Markdown-Links ab `start` (hinter `](`) und die Stelle dahinter; `<…>` und ein
/// Titel in Anführungszeichen sind entfernt. `None`, wenn der Link nicht schließt.
fn link_target(prose: &str, start: usize) -> Option<(String, usize)> {
    let bytes: &[u8] = prose.as_bytes();
    if bytes.get(start) == Some(&b'<') {
        let closing: usize = start + 1 + prose[start + 1..].find('>')?;
        return Some((prose[start + 1..closing].to_owned(), closing + 1));
    }
    let mut depth: usize = 1;
    for (offset, byte) in bytes[start..].iter().enumerate() {
        match byte {
            b'\n' => return None,
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    let end: usize = start + offset;
                    return Some((without_title(&prose[start..end]).to_owned(), end + 1));
                }
            }
            _ => {}
        }
    }
    None
}

/// Entfernt einen Titel in Anführungszeichen hinter dem Ziel (`pfad "Titel"`).
fn without_title(destination: &str) -> &str {
    let trimmed: &str = destination.trim();
    let Some(quote) = trimmed
        .chars()
        .last()
        .filter(|character: &char| matches!(character, '"' | '\''))
    else {
        return trimmed;
    };
    let body: &str = &trimmed[..trimmed.len() - 1];
    match body.rfind(quote) {
        Some(open) if body[..open].ends_with(char::is_whitespace) => body[..open].trim_end(),
        _ => trimmed,
    }
}

/// Löst `%XX` auf; ergibt das kein gültiges UTF-8, bleibt der Text, wie er ist.
fn percent_decoded(text: &str) -> String {
    let bytes: &[u8] = text.as_bytes();
    let mut decoded: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index: usize = 0;
    while index < bytes.len() {
        let hex_value: Option<u8> = bytes
            .get(index + 1..index + 3)
            .filter(|_| bytes[index] == b'%')
            .and_then(|hex: &[u8]| std::str::from_utf8(hex).ok())
            .and_then(|hex: &str| u8::from_str_radix(hex, 16).ok());
        if let Some(value) = hex_value {
            decoded.push(value);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).unwrap_or_else(|_| text.to_owned())
}

/// Bildet `filePathOf` nach: ein einzeiliger Text, der als Ganzes ein Dateiverweis mit bekannter
/// Endung ist und keine Adresse mit Schema.
fn is_link_path(text: &str) -> bool {
    let trimmed: &str = text.trim();
    if trimmed.is_empty() || trimmed.contains('\n') || trimmed.chars().count() > MAX_PATH_LENGTH {
        return false;
    }
    let without_scheme: &str = match trimmed.get(..FILE_URL_PREFIX.len()) {
        Some(prefix) if prefix.eq_ignore_ascii_case(FILE_URL_PREFIX) => {
            &trimmed[FILE_URL_PREFIX.len()..]
        }
        _ => trimmed,
    };
    if without_scheme.contains("://") {
        return false;
    }
    let cleaned: String = file_links::clean(trimmed);
    let Some(extension) = extension_of(&cleaned) else {
        return false;
    };
    OPENABLE_EXTENSIONS.contains(&extension.as_str())
        || VIEWABLE_EXTENSIONS.contains(&extension.as_str())
        || is_media(&cleaned)
}

/// Video und Ton: `filePathOf` kennt diese Endungen noch nicht, die Session-Dateien brauchen sie
/// aber (ein Video aus „Downloads“ im Chat). Die Zuordnung steht allein in `artifacts::kind_of`.
fn is_media(cleaned: &str) -> bool {
    matches!(
        artifacts::kind_of(Path::new(cleaned)),
        ArtifactKind::Video | ArtifactKind::Audio
    )
}

/// Endung (klein) des letzten Namens; `None`, wenn der Name keinen Punkt hat oder mit einem Punkt
/// beginnt (`.gitignore`). Beide Trenner gelten — unter Unix ist `\` im Namen erlaubt, aber ein Agent
/// schreibt damit Windows-Pfade.
fn extension_of(cleaned: &str) -> Option<String> {
    let last_dot: usize = cleaned.rfind('.')?;
    let name_start: usize = cleaned
        .rfind(['/', '\\'])
        .map_or(0, |index: usize| index + 1);
    if last_dot <= name_start {
        return None;
    }
    Some(cleaned[last_dot + 1..].to_ascii_lowercase())
}

/// Absolut im Sinne des Betriebssystems; ein UNC-Pfad (`\\server\…`) zählt nicht, denn ihn zu lesen
/// hieße, einen fremden Rechner anzufragen.
fn is_absolute_path(cleaned: &str) -> bool {
    if cfg!(windows) && cleaned.starts_with(r"\\") {
        return false;
    }
    Path::new(cleaned).is_absolute()
}
