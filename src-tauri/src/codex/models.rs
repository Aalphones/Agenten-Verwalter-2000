//! Die Modelle von Codex (`model/list`) und der Zwischenspeicher, aus dem die Oberfläche sie liest.
use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use super::rpc::{Incoming, RpcClient};
use crate::agents::event::Effort;
use crate::standalone::args::effort_from_cli;

const LIST_TIMEOUT: Duration = Duration::from_secs(20);
const CACHE_LIFETIME: Duration = Duration::from_secs(10 * 60);

/// Ein Modell, das Codex für das Konto anbietet.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CodexModel {
    pub id: String,
    pub display_name: String,
    /// Die Denkaufwand-Stufen, die das Modell kennt und der Verwalter anbietet (`ultra` fehlt hier).
    pub efforts: Vec<Effort>,
    pub default_effort: Effort,
    pub is_default: bool,
}

/// Was die Menüs zeigen. Ein Fehler steht in `error`, kein Command-Fehler (wie bei `LocalModels`).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CodexModels {
    pub models: Vec<CodexModel>,
    pub error: Option<String>,
}

/// Fragt ein laufendes `codex app-server` nach den sichtbaren Modellen. Es gibt nur eine Seite:
/// `nextCursor` war bei allen Proben `null`.
pub fn list(rpc: &RpcClient) -> Result<Vec<CodexModel>, String> {
    let result = rpc.call("model/list", serde_json::json!({}), LIST_TIMEOUT)?;
    Ok(parse(&result))
}

fn parse(result: &Value) -> Vec<CodexModel> {
    let Some(entries) = result.get("data").and_then(Value::as_array) else {
        return Vec::new();
    };
    entries.iter().filter_map(parse_model).collect()
}

fn parse_model(entry: &Value) -> Option<CodexModel> {
    if entry.get("hidden").and_then(Value::as_bool) == Some(true) {
        return None;
    }
    let id = entry.get("id").and_then(Value::as_str)?;
    let efforts: Vec<Effort> = entry
        .get("supportedReasoningEfforts")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter_map(|option: &Value| option.get("reasoningEffort")?.as_str())
        .filter_map(effort_from_cli)
        .collect();
    let default_effort = entry
        .get("defaultReasoningEffort")
        .and_then(Value::as_str)
        .and_then(effort_from_cli)
        .unwrap_or(Effort::Medium);
    Some(CodexModel {
        id: id.to_owned(),
        display_name: entry
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or(id)
            .to_owned(),
        efforts,
        default_effort,
        is_default: entry.get("isDefault").and_then(Value::as_bool) == Some(true),
    })
}

/// Hält die Modellliste zehn Minuten vor: jede Abfrage startet sonst einen eigenen `codex
/// app-server` (gut eine Sekunde).
#[derive(Default)]
pub struct CodexService {
    cache: Mutex<Option<(Instant, Vec<CodexModel>)>>,
}

impl CodexService {
    pub fn new() -> CodexService {
        CodexService::default()
    }

    /// Blockiert, solange ein frischer Start nötig ist — vom Aufrufer auf einem Arbeits-Thread.
    pub fn models(&self, exe: &Path) -> CodexModels {
        if let Some(models) = self.cached() {
            return CodexModels {
                models,
                error: None,
            };
        }
        match fetch(exe) {
            Ok(models) => {
                *self.lock() = Some((Instant::now(), models.clone()));
                CodexModels {
                    models,
                    error: None,
                }
            }
            Err(error) => CodexModels {
                models: Vec::new(),
                error: Some(error),
            },
        }
    }

    fn cached(&self) -> Option<Vec<CodexModel>> {
        let cache = self.lock();
        let (fetched_at, models) = cache.as_ref()?;
        (fetched_at.elapsed() < CACHE_LIFETIME).then(|| models.clone())
    }

    fn lock(&self) -> MutexGuard<'_, Option<(Instant, Vec<CodexModel>)>> {
        self.cache.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Startet `codex app-server` nur für diese eine Frage.
fn fetch(exe: &Path) -> Result<Vec<CodexModel>, String> {
    let workdir = std::env::temp_dir();
    let rpc = RpcClient::start(exe, &workdir, |_: Incoming| {})
        .map_err(|error: std::io::Error| format!("Codex startet nicht: {error}"))?;
    let listed = rpc.initialize().and_then(|()| list(&rpc));
    rpc.shutdown();
    listed
}
