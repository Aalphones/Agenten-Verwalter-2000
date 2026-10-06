//! Der Output-Style, den der Benutzer in den Einstellungen gewählt hat (`outputStyle`).
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::settings;
use crate::skills::frontmatter;

const STYLE_KEY: &str = "outputStyle";
const STYLES_DIR: &str = "output-styles";
const STYLE_EXTENSION: &str = "md";
const DEFAULT_STYLE: &str = "default";

/// Name und Inhalt (ohne Kopfdaten). Den Namen nennt die zuletzt gelesene Einstellungsdatei mit
/// dem Schlüssel; die Datei liegt zuerst im Arbeitsordner, dann beim Benutzer. `default` oder eine
/// fehlende Datei ergeben nichts.
pub fn load(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Option<(String, String)> {
    let name = settings::files(home, cwd, add_dirs)
        .iter()
        .filter_map(|file: &PathBuf| settings::read(file))
        .filter_map(|content: Value| content.get(STYLE_KEY)?.as_str().map(str::to_owned))
        .next_back()?;
    if name == DEFAULT_STYLE || !is_plain_name(&name) {
        return None;
    }
    let file_name = format!("{name}.{STYLE_EXTENSION}");
    [cwd, home]
        .iter()
        .map(|root: &&Path| {
            root.join(settings::CLAUDE_DIR)
                .join(STYLES_DIR)
                .join(&file_name)
        })
        .find_map(|file: PathBuf| fs::read_to_string(file).ok())
        .map(|text: String| {
            let (_, body) = frontmatter::parse(&text);
            (name, body.trim().to_owned())
        })
}

/// Der Name wird Teil eines Dateipfads — nichts, womit er aus dem Ordner herausläuft.
fn is_plain_name(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('.') && !name.contains(['/', '\\', ':', '\0'])
}
