//! `Edit`: Text in einer Datei ersetzen, Zeilenenden der Datei bleiben erhalten.
use std::fs;

use serde_json::Value;

use super::write::NOT_READ_ERROR;
use super::{ToolContext, checked_path, optional_flag, required_string};

const CRLF: &str = "\r\n";

pub fn run(input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let path = checked_path(context, required_string(input, "file_path")?, true)?;
    let old_string = required_string(input, "old_string")?;
    let new_string = required_string(input, "new_string")?;
    let replace_all = optional_flag(input, "replace_all");
    if !path.is_file() {
        return Err(format!(
            "Datei nicht gefunden: {} — neue Dateien legt Write an.",
            path.display()
        ));
    }
    if !context.has_read(&path) {
        return Err(NOT_READ_ERROR.to_owned());
    }
    if old_string.is_empty() {
        return Err("old_string ist leer.".to_owned());
    }
    if old_string == new_string {
        return Err("old_string und new_string sind gleich.".to_owned());
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("{} nicht lesbar: {error}", path.display()))?;
    // Verlustbehaftet dekodiert würde Edit kaputte Zeichen zurückschreiben.
    let content = String::from_utf8(bytes)
        .map_err(|_| format!("{} ist kein UTF-8 — Edit geht nicht.", path.display()))?;
    // Read zeigt Zeilen ohne `\r`; das Modell schickt deshalb `\n`, die Datei braucht `\r\n`.
    let (old_string, new_string) = if content.contains(CRLF) {
        (with_crlf(old_string), with_crlf(new_string))
    } else {
        (old_string.to_owned(), new_string.to_owned())
    };
    let occurrences = content.matches(old_string.as_str()).count();
    if occurrences == 0 {
        return Err("old_string nicht gefunden — Datei neu lesen und exakt kopieren.".to_owned());
    }
    if occurrences > 1 && !replace_all {
        return Err(format!(
            "old_string kommt {occurrences}-mal vor — mehr umgebenden Text angeben oder replace_all setzen."
        ));
    }
    let changed = if replace_all {
        content.replace(old_string.as_str(), &new_string)
    } else {
        content.replacen(old_string.as_str(), &new_string, 1)
    };
    fs::write(&path, changed)
        .map_err(|error| format!("{} nicht schreibbar: {error}", path.display()))?;
    Ok(format!(
        "Datei geändert: {} ({occurrences} Stelle(n))",
        path.display()
    ))
}

/// Jedes `\n`, vor dem kein `\r` steht, wird zu `\r\n`.
fn with_crlf(text: &str) -> String {
    let mut converted = String::with_capacity(text.len());
    let mut previous: Option<char> = None;
    for character in text.chars() {
        if character == '\n' && previous != Some('\r') {
            converted.push('\r');
        }
        converted.push(character);
        previous = Some(character);
    }
    converted
}
