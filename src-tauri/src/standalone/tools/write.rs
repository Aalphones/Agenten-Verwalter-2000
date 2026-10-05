//! `Write`: Datei anlegen oder ganz ersetzen.
use std::fs;

use serde_json::Value;

use super::{ToolContext, checked_path, required_string};

pub const NOT_READ_ERROR: &str = "Bestehende Datei erst mit Read lesen.";

pub fn run(input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let path = checked_path(context, required_string(input, "file_path")?, true)?;
    let content = required_string(input, "content")?;
    if path.is_dir() {
        return Err(format!("Ist ein Ordner: {}", path.display()));
    }
    if path.exists() && !context.has_read(&path) {
        return Err(NOT_READ_ERROR.to_owned());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Ordner {} nicht anlegbar: {error}", parent.display()))?;
    }
    fs::write(&path, content)
        .map_err(|error| format!("{} nicht schreibbar: {error}", path.display()))?;
    context.remember_read(&path);
    Ok(format!("Datei geschrieben: {}", path.display()))
}
