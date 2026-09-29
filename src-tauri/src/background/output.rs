//! Ausgaben von Befehlen und Hintergrundprozessen: kürzen, aus Claudes Ausgabedatei lesen,
//! Adresse und Exit-Code herausziehen.
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use super::model::TextPreview;

/// Ende der Ausgabe eines Befehls, das in SQLite landet.
pub const MAX_COMMAND_OUTPUT_BYTES: usize = 65_536;
/// Ende einer Prozess-Ausgabe bzw. Anfang einer Scratchpad-Datei, das die Vorschau zeigt.
pub const MAX_PREVIEW_BYTES: u64 = 262_144;
/// So weit vom Anfang der Ausgabe sucht `find_local_url`.
pub const URL_SCAN_BYTES: u64 = 65_536;
/// Ein NUL-Byte hier drin heißt binär — dieselbe Probe wie bei den Changes.
pub const BINARY_SCAN_BYTES: usize = 8_000;

const URL_SCHEMES: [&str; 2] = ["http://", "https://"];
const URL_TERMINATORS: [char; 4] = ['"', '\'', '<', '>'];
const URL_TRAILING_PUNCTUATION: [char; 5] = ['.', ',', ';', ':', ')'];
const LOCAL_HOSTS: [&str; 4] = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
const ANY_ADDRESS_HOST: &str = "0.0.0.0";
const EXIT_CODE_MARKER: &str = "exit code ";
const ESCAPE: char = '\u{1b}';

/// Die letzten `max_bytes` von `text`, gekürzt bis hinter den ersten Zeilenumbruch, damit keine
/// halbe Zeile oben steht. Zweiter Wert: ob gekürzt wurde.
pub fn tail_text(text: &str, max_bytes: usize) -> (String, bool) {
    if text.len() <= max_bytes {
        return (text.to_owned(), false);
    }
    let mut start = text.len() - max_bytes;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    let tail = &text[start..];
    let whole_lines = match tail.find('\n') {
        Some(position) => &tail[position + 1..],
        None => tail,
    };
    (whole_lines.to_owned(), true)
}

/// Höchstens `max_bytes` vom Anfang der Datei; `None`, wenn sie sich nicht lesen lässt.
pub fn read_head(path: &Path, max_bytes: u64) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut bytes: Vec<u8> = Vec::new();
    file.take(max_bytes).read_to_end(&mut bytes).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// Das Ende der Datei als Vorschau: größer als `max_bytes` → ab `len - max_bytes`, gekürzt bis
/// hinter den ersten Zeilenumbruch.
pub fn read_tail(path: &Path, max_bytes: u64) -> TextPreview {
    let Ok(mut file) = File::open(path) else {
        return missing_preview();
    };
    let length = file.metadata().map_or(0, |metadata| metadata.len());
    let truncated = length > max_bytes;
    if truncated && file.seek(SeekFrom::Start(length - max_bytes)).is_err() {
        return missing_preview();
    }
    let mut bytes: Vec<u8> = Vec::new();
    if file.take(max_bytes).read_to_end(&mut bytes).is_err() {
        return missing_preview();
    }
    let whole_lines: &[u8] = if truncated {
        match bytes.iter().position(|byte: &u8| *byte == b'\n') {
            Some(position) => &bytes[position + 1..],
            None => &bytes,
        }
    } else {
        &bytes
    };
    preview_of(whole_lines, truncated)
}

/// Text- oder Binärvorschau aus gelesenen Bytes.
pub fn preview_of(bytes: &[u8], truncated: bool) -> TextPreview {
    let probe = &bytes[..bytes.len().min(BINARY_SCAN_BYTES)];
    if probe.contains(&0) {
        return TextPreview {
            text: String::new(),
            truncated,
            missing: false,
            binary: true,
        };
    }
    TextPreview {
        text: String::from_utf8_lossy(bytes).into_owned(),
        truncated,
        missing: false,
        binary: false,
    }
}

fn missing_preview() -> TextPreview {
    TextPreview {
        missing: true,
        ..TextPreview::default()
    }
}

/// Die erste lokale Adresse in der Ausgabe (`localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`),
/// `0.0.0.0` als `localhost`. Farbcodes werden vorher entfernt: Dev-Server heben den Port oft fett hervor.
pub fn find_local_url(text: &str) -> Option<String> {
    let plain = strip_ansi(text);
    let mut candidates: Vec<usize> = URL_SCHEMES
        .iter()
        .flat_map(|scheme: &&str| {
            plain
                .match_indices(*scheme)
                .map(|(index, _)| index)
                .collect::<Vec<usize>>()
        })
        .collect();
    candidates.sort_unstable();
    candidates
        .into_iter()
        .find_map(|start: usize| local_url_at(&plain[start..]))
}

/// `text` beginnt mit `http://` oder `https://`; `Some` nur bei einem lokalen Host.
fn local_url_at(text: &str) -> Option<String> {
    let end = text
        .find(|character: char| character.is_whitespace() || URL_TERMINATORS.contains(&character))
        .unwrap_or(text.len());
    let url = text[..end].trim_end_matches(URL_TRAILING_PUNCTUATION.as_slice());
    let (scheme, rest) = url.split_once("://")?;
    let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
    let host = if authority.starts_with('[') {
        authority
            .find(']')
            .map_or(authority, |close: usize| &authority[..=close])
    } else {
        authority.split(':').next().unwrap_or_default()
    };
    let is_local = LOCAL_HOSTS
        .iter()
        .any(|local: &&str| host.eq_ignore_ascii_case(local));
    if !is_local {
        return None;
    }
    if host == ANY_ADDRESS_HOST {
        let after_host = &rest[host.len()..];
        return Some(format!("{scheme}://localhost{after_host}"));
    }
    Some(url.to_owned())
}

/// Entfernt Steuersequenzen der Form `ESC [ … Buchstabe`.
fn strip_ansi(text: &str) -> String {
    let mut plain = String::with_capacity(text.len());
    let mut characters = text.chars().peekable();
    while let Some(character) = characters.next() {
        if character != ESCAPE {
            plain.push(character);
            continue;
        }
        if characters.peek() != Some(&'[') {
            continue;
        }
        characters.next();
        for sequence_character in characters.by_ref() {
            if sequence_character.is_ascii_alphabetic() {
                break;
            }
        }
    }
    plain
}

/// Die Zahl hinter der letzten Fundstelle von „exit code “, z.B. in
/// `Background command "…" failed with exit code 4`.
pub fn exit_code_from_summary(summary: &str) -> Option<i32> {
    let lowered = summary.to_lowercase();
    let start = lowered.rfind(EXIT_CODE_MARKER)? + EXIT_CODE_MARKER.len();
    let rest = &lowered[start..];
    let sign_length = usize::from(rest.starts_with('-'));
    let digits_length = rest[sign_length..]
        .find(|character: char| !character.is_ascii_digit())
        .unwrap_or(rest.len() - sign_length);
    if digits_length == 0 {
        return None;
    }
    rest[..sign_length + digits_length].parse::<i32>().ok()
}
