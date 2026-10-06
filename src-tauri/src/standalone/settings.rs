//! Die Einstellungsdateien, aus denen der Agent Hooks und Output-Style liest — dieselben Dateien
//! und dieselbe Reihenfolge wie bei Claude Code (ADR 017).
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde_json::Value;

pub const CLAUDE_DIR: &str = ".claude";
const SETTINGS_FILES: [&str; 2] = ["settings.json", "settings.local.json"];
const BYTE_ORDER_MARK: char = '\u{feff}';

/// Benutzer-Einstellungen zuerst, dann je Arbeitsordner und `--add-dir`; in jedem Ordner erst
/// `settings.json`, dann `settings.local.json`. Wer einen Schlüssel „zuletzt“ liest, bekommt den
/// spezifischsten Wert.
pub fn files(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Vec<PathBuf> {
    let mut claude_dirs: Vec<PathBuf> = vec![home.join(CLAUDE_DIR), cwd.join(CLAUDE_DIR)];
    claude_dirs.extend(add_dirs.iter().map(|dir: &PathBuf| dir.join(CLAUDE_DIR)));
    claude_dirs
        .iter()
        .flat_map(|dir: &PathBuf| SETTINGS_FILES.map(|file: &str| dir.join(file)))
        .collect()
}

/// Der Inhalt einer Einstellungsdatei. Eine fehlende Datei ist normal und bleibt still; eine
/// unlesbare oder kaputte kommt als Zeile ins Protokoll.
pub fn read(path: &Path) -> Option<Value> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == ErrorKind::NotFound => return None,
        Err(error) => {
            eprintln!("Einstellungen {} nicht lesbar: {error}", path.display());
            return None;
        }
    };
    match serde_json::from_str(text.trim_start_matches(BYTE_ORDER_MARK)) {
        Ok(settings) => Some(settings),
        Err(error) => {
            eprintln!("Einstellungen {} kein JSON: {error}", path.display());
            None
        }
    }
}
