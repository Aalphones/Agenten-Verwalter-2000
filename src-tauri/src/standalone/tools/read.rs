//! `Read`: Textdatei mit Zeilennummern.
use std::fs;

use serde_json::Value;

use super::{
    ToolContext, checked_path, is_binary, optional_count, required_string, shortened_line,
};

const DEFAULT_LIMIT: usize = 2000;
const BYTE_ORDER_MARK: char = '\u{feff}';

pub fn run(input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let path = checked_path(context, required_string(input, "file_path")?, false)?;
    if path.is_dir() {
        return Err(format!("Ist ein Ordner — nimm Glob: {}", path.display()));
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("{} nicht lesbar: {error}", path.display()))?;
    if is_binary(&bytes) {
        return Err(format!("Binärdatei: {}", path.display()));
    }
    context.remember_read(&path);
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
