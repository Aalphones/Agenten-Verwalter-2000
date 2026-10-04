//! Fragt den lokalen Server von LM Studio nach Modellen (ADR 016). Nur lesend; geladen und
//! entladen wird in LM Studio.
pub mod model;

use std::env;
use std::time::Duration;

use serde::Deserialize;

use model::{LocalModel, LocalModelKind, LocalModels};

pub const URL_VARIABLE: &str = "VERWALTER_LMSTUDIO_URL";
const DEFAULT_URL: &str = "http://localhost:1234";
const TIMEOUT: Duration = Duration::from_secs(3);
const MODEL_TYPE_LLM: &str = "llm";
const MODEL_TYPE_VLM: &str = "vlm";
const STATE_LOADED: &str = "loaded";

#[derive(Deserialize)]
struct RawModel {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    state: Option<String>,
    max_context_length: Option<u32>,
    loaded_context_length: Option<u32>,
}

#[derive(Deserialize)]
struct RawList {
    data: Vec<RawModel>,
}

/// Adresse des Servers ohne Schrägstrich am Ende.
pub fn base_url() -> String {
    let configured = env::var(URL_VARIABLE).unwrap_or_default();
    let trimmed = configured.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_URL.to_owned()
    } else {
        trimmed.to_owned()
    }
}

/// Alle Sprach- und Bildmodelle, geladene zuerst. Ein Fehler steht in `error`, die Liste ist dann leer.
pub fn list() -> LocalModels {
    let base_url = base_url();
    let result = get(&base_url, "/api/v0/models").and_then(|body: String| {
        serde_json::from_str::<RawList>(&body)
            .map_err(|error| format!("Antwort von LM Studio nicht lesbar: {error}"))
    });
    match result {
        Ok(raw_list) => {
            let mut models: Vec<LocalModel> =
                raw_list.data.into_iter().filter_map(convert).collect();
            models.sort_by(|left: &LocalModel, right: &LocalModel| {
                right
                    .is_loaded
                    .cmp(&left.is_loaded)
                    .then_with(|| left.id.cmp(&right.id))
            });
            LocalModels {
                base_url,
                models,
                error: None,
            }
        }
        Err(error) => LocalModels {
            base_url,
            models: Vec::new(),
            error: Some(error),
        },
    }
}

/// Ein einzelnes Modell. Ein unbekanntes Modell (404) landet wie ein nicht erreichbarer Server im `Err`.
pub fn find(id: &str) -> Result<LocalModel, String> {
    // Die `/` in der Kennung bleiben, LM Studio erwartet sie so.
    let body = get(&base_url(), &format!("/api/v0/models/{id}"))?;
    let raw: RawModel = serde_json::from_str(&body)
        .map_err(|error| format!("Antwort von LM Studio nicht lesbar: {error}"))?;
    convert(raw).ok_or_else(|| "kein Sprachmodell".to_owned())
}

fn get(base_url: &str, path: &str) -> Result<String, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(TIMEOUT))
        .build()
        .into();
    let mut response = agent
        .get(&format!("{base_url}{path}"))
        .call()
        .map_err(|error: ureq::Error| error.to_string())?;
    response
        .body_mut()
        .read_to_string()
        .map_err(|error: ureq::Error| error.to_string())
}

fn convert(raw: RawModel) -> Option<LocalModel> {
    let kind = match raw.kind.as_str() {
        MODEL_TYPE_LLM => LocalModelKind::Llm,
        MODEL_TYPE_VLM => LocalModelKind::Vlm,
        _ => return None,
    };
    Some(LocalModel {
        id: raw.id,
        kind,
        is_loaded: raw.state.as_deref() == Some(STATE_LOADED),
        loaded_context_length: raw.loaded_context_length,
        max_context_length: raw.max_context_length.unwrap_or(0),
    })
}
