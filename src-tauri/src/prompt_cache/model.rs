//! Typen des Prompt-Caches, die über die Tauri-Grenze gehen.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::agents::event::ModelId;

/// Was der Core über den Prompt-Cache einer Session weiß; ob er noch warm ist, rechnet die
/// Oberfläche mit der aktuellen Uhrzeit aus.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PromptCache {
    /// Eingang der ersten Zeile der letzten Antwort mit Cache-Angaben, ms seit 1970.
    pub anchor_at: f64,
    /// Haltedauer: `TTL_5M_MS` oder `TTL_1H_MS`.
    pub ttl_ms: u32,
    /// Token, die der Cache nach dieser Antwort trägt (Eingabe + geschrieben + gelesen).
    pub tokens: u32,
    /// Modell, für das der Cache gilt — ein anderes Modell liest ihn nicht.
    pub model: ModelId,
    /// Zeitpunkt der letzten Zusammenfassung; bis zur nächsten Antwort ist der Cache „neu“.
    pub compacted_at: Option<f64>,
}
