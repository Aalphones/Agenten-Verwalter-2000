//! Liest die Antworten der Kommandozeile auf `get_context_usage`. Das Format ist nicht als stabil
//! dokumentiert: jedes Feld ist optional, ein unlesbares Feld macht die Antwort unbrauchbar (`None`),
//! nie zu einem Fehler.
use serde::Deserialize;
use serde_json::Value;

use crate::context::model::{ContextBreakdown, ContextCategory, ContextFile};

const KIND_USED: &str = "used";
const KIND_FREE: &str = "free";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawContext {
    categories: Option<Vec<RawCategory>>,
    total_tokens: Option<u64>,
    max_tokens: Option<u64>,
    model: Option<String>,
    memory_files: Option<Vec<RawFile>>,
    auto_compact_threshold: Option<u64>,
    is_auto_compact_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RawCategory {
    name: Option<String>,
    tokens: Option<u64>,
    kind: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawFile {
    path: Option<String>,
    tokens: Option<u64>,
}

/// `None`, wenn `body` keine Kontext-Aufschlüsselung ist (`categories` oder `maxTokens` fehlt).
pub fn context_breakdown(body: &Value) -> Option<ContextBreakdown> {
    let raw: RawContext = serde_json::from_value(body.clone()).ok()?;
    let categories = raw.categories?;
    let max_tokens = raw.max_tokens?;
    Some(ContextBreakdown {
        model: raw.model.unwrap_or_default(),
        total_tokens: saturating_u32(raw.total_tokens.unwrap_or(0)),
        max_tokens: saturating_u32(max_tokens),
        categories: categories.into_iter().filter_map(category).collect(),
        memory_files: raw
            .memory_files
            .unwrap_or_default()
            .into_iter()
            .filter_map(memory_file)
            .collect(),
        auto_compact_threshold: raw
            .auto_compact_threshold
            .filter(|_| raw.is_auto_compact_enabled == Some(true))
            .map(saturating_u32),
        fetched_at: 0.0,
    })
}

/// `deferred` (nachladbare Werkzeuge, nicht im Kontext) und Kategorien ohne `kind` fallen weg.
fn category(raw: RawCategory) -> Option<ContextCategory> {
    let is_free = match raw.kind.as_deref() {
        Some(KIND_USED) => false,
        Some(KIND_FREE) => true,
        _ => return None,
    };
    Some(ContextCategory {
        name: raw.name?,
        tokens: saturating_u32(raw.tokens.unwrap_or(0)),
        is_free,
    })
}

fn memory_file(raw: RawFile) -> Option<ContextFile> {
    Some(ContextFile {
        path: raw.path?,
        tokens: saturating_u32(raw.tokens.unwrap_or(0)),
    })
}

fn saturating_u32(value: u64) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
