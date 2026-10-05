//! `Glob`: Dateien nach Muster, neueste zuerst.
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::SystemTime;

use serde_json::Value;

use super::{ToolContext, checked_path, optional_string, required_string, walk};

const MAX_RESULTS: usize = 200;

pub fn run(input: &Value, context: &mut ToolContext) -> Result<String, String> {
    let matcher = walk::matcher(required_string(input, "pattern")?)?;
    let base = match optional_string(input, "path") {
        Some(raw) => checked_path(context, raw, false)?,
        None => context.cwd.clone(),
    };
    if !base.is_dir() {
        return Err(format!("Ordner nicht gefunden: {}", base.display()));
    }
    let mut found: Vec<(SystemTime, PathBuf)> = Vec::new();
    for path in walk::files(&base) {
        if context.cancel.load(Ordering::SeqCst) {
            return Err(super::INTERRUPTED.to_owned());
        }
        if !matcher.is_match(walk::relative(&path, &base)) {
            continue;
        }
        let modified = fs::metadata(&path)
            .and_then(|metadata: fs::Metadata| metadata.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        found.push((modified, path));
    }
    if found.is_empty() {
        return Ok("Keine Treffer.".to_owned());
    }
    found.sort_by_key(|(modified, _): &(SystemTime, PathBuf)| std::cmp::Reverse(*modified));
    let mut lines: Vec<String> = found
        .iter()
        .take(MAX_RESULTS)
        .map(|(_, path): &(SystemTime, PathBuf)| path.display().to_string())
        .collect();
    if found.len() > MAX_RESULTS {
        lines.push(format!("… ({} weitere)", found.len() - MAX_RESULTS));
    }
    Ok(lines.join("\n"))
}
