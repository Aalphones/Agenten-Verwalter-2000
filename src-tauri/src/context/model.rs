//! Typen, die die Kontext-Aufschlüsselung einer Session über die Tauri-Grenze beschreiben.
use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContextCategory {
    pub name: String,
    pub tokens: u32,
    /// Der freie Platz im Fenster, kein belegter Anteil.
    pub is_free: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContextFile {
    pub path: String,
    pub tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContextBreakdown {
    pub model: String,
    pub total_tokens: u32,
    pub max_tokens: u32,
    /// Nur `kind` `used` und `free`, in der Reihenfolge der Kommandozeile; `deferred` fällt weg.
    pub categories: Vec<ContextCategory>,
    pub memory_files: Vec<ContextFile>,
    /// `None`, wenn `isAutoCompactEnabled` nicht `true` ist oder der Wert fehlt.
    pub auto_compact_threshold: Option<u32>,
    /// Millisekunden seit 1970; gesetzt beim Eintreffen im Core.
    pub fetched_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionContext {
    pub breakdown: Option<ContextBreakdown>,
    pub is_agent_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContextChangedEvent {
    pub session_id: String,
}

impl SessionContext {
    /// Ersetzt den Benutzerordner am Anfang jedes Memory-Pfads durch `~`. Verglichen wird ohne
    /// Beachtung der Groß-/Kleinschreibung (Windows); die Trenner des Pfads bleiben, wie sie sind.
    pub fn with_home_shortened(mut self, home: &Path) -> SessionContext {
        let home_text = home.to_string_lossy().to_lowercase();
        if home_text.is_empty() {
            return self;
        }
        let Some(breakdown) = self.breakdown.as_mut() else {
            return self;
        };
        for file in &mut breakdown.memory_files {
            file.path = shorten(&file.path, &home_text);
        }
        self
    }
}

/// `home_lower` ist der kleingeschriebene Benutzerordner. Nur ein echter Präfix zählt: danach
/// muss ein Trenner folgen, sonst würde `C:\Users\sa` auch `C:\Users\sasch` kürzen.
fn shorten(path: &str, home_lower: &str) -> String {
    let path_lower = path.to_lowercase();
    let Some(rest_lower) = path_lower.strip_prefix(home_lower) else {
        return path.to_owned();
    };
    if !rest_lower.starts_with(['\\', '/']) {
        return path.to_owned();
    }
    // Das Kleinschreiben kann Zeichen länger oder kürzer machen; der Rest wird deshalb vom Ende
    // des Originals her abgeschnitten, nicht an der Länge des Präfixes.
    let rest_chars = rest_lower.chars().count();
    let rest: String = path
        .chars()
        .skip(path.chars().count().saturating_sub(rest_chars))
        .collect();
    format!("~{rest}")
}
