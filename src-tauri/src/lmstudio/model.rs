use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum LocalModelKind {
    Llm,
    /// Versteht Bilder.
    Vlm,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub id: String,
    pub kind: LocalModelKind,
    pub is_loaded: bool,
    /// Nur bei geladenem Modell.
    pub loaded_context_length: Option<u32>,
    pub max_context_length: u32,
}

/// Was die Einstellungsseite zeigt. Ein nicht erreichbares LM Studio ist kein Command-Fehler,
/// sondern `error`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LocalModels {
    pub base_url: String,
    pub models: Vec<LocalModel>,
    pub error: Option<String>,
}
