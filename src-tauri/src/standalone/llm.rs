//! Client für die OpenAI-kompatible Schnittstelle (`/v1/chat/completions`) von LM Studio — auch
//! Ollama und llama.cpp sprechen sie.
use std::collections::BTreeMap;
use std::io::{self, BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde_json::{Value, json};

/// Nur der Verbindungsaufbau ist begrenzt: eine Antwort darf Minuten dauern.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const COMPLETIONS_PATH: &str = "/v1/chat/completions";
const DATA_PREFIX: &str = "data:";
const DONE_MARKER: &str = "[DONE]";
/// So viel vom Fehlerkörper kommt in den Satz an den Benutzer.
const ERROR_BODY_CHARS: usize = 300;

pub struct ChatRequest<'a> {
    pub base_url: &'a str,
    pub model: &'a str,
    pub messages: &'a [Value],
    pub tools: &'a [Value],
    pub response_format: Option<&'a Value>,
}

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Default)]
pub struct Completion {
    pub text: String,
    pub reasoning: String,
    pub tool_calls: Vec<ToolCall>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub enum LlmError {
    Cancelled,
    Failed(String),
}

/// Werkzeug-Aufruf im Aufbau: Kennung und Name kommen mit dem ersten Stück, die Argumente in
/// Teilen.
#[derive(Default)]
struct PartialCall {
    id: Option<String>,
    name: String,
    arguments: String,
}

/// Fragt das Modell mit Streaming. `cancel` wird vor jeder gelesenen Zeile geprüft; das Fallenlassen
/// des Readers schließt die Verbindung, und LM Studio bricht die Antwort ab.
pub fn complete(request: &ChatRequest<'_>, cancel: &AtomicBool) -> Result<Completion, LlmError> {
    let base_url = request.base_url;
    let failed = |error: String| -> LlmError {
        LlmError::Failed(format!(
            "LM Studio unter {base_url} antwortet nicht: {error}"
        ))
    };
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_connect(Some(CONNECT_TIMEOUT))
        // Sonst wäre ein Status ab 400 ein Fehler ohne Körper — und der Grund („model not loaded“)
        // stünde nur im Körper.
        .http_status_as_error(false)
        .build()
        .into();
    let mut response = agent
        .post(&format!("{base_url}{COMPLETIONS_PATH}"))
        .header("Content-Type", "application/json")
        .send(request_body(request).to_string())
        .map_err(|error: ureq::Error| failed(error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.body_mut().read_to_string().unwrap_or_default();
        let excerpt: String = body.chars().take(ERROR_BODY_CHARS).collect();
        return Err(failed(format!("Status {status}: {excerpt}")));
    }
    let reader = BufReader::new(response.into_body().into_reader());
    read_stream(reader, cancel).map_err(|error: StreamError| match error {
        StreamError::Cancelled => LlmError::Cancelled,
        StreamError::Failed(message) => failed(message),
    })
}

fn request_body(request: &ChatRequest<'_>) -> Value {
    let mut body = json!({
        "model": request.model,
        "messages": request.messages,
        "stream": true,
        "stream_options": { "include_usage": true },
    });
    if !request.tools.is_empty() {
        body["tools"] = Value::from(request.tools.to_vec());
        body["tool_choice"] = Value::from("auto");
    }
    if let Some(format) = request.response_format {
        body["response_format"] = format.clone();
    }
    body
}

enum StreamError {
    Cancelled,
    Failed(String),
}

/// Liest Server-Sent Events bis `data: [DONE]` oder Dateiende.
fn read_stream(mut reader: impl BufRead, cancel: &AtomicBool) -> Result<Completion, StreamError> {
    let mut completion = Completion::default();
    let mut calls: BTreeMap<u64, PartialCall> = BTreeMap::new();
    let mut buffer: Vec<u8> = Vec::new();
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(StreamError::Cancelled);
        }
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer) {
            Ok(0) => break,
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(StreamError::Failed(error.to_string())),
        }
        let line = String::from_utf8_lossy(&buffer);
        let Some(data) = line.trim().strip_prefix(DATA_PREFIX) else {
            continue;
        };
        let data = data.trim_start();
        if data == DONE_MARKER {
            break;
        }
        let chunk: Value = serde_json::from_str(data)
            .map_err(|error| StreamError::Failed(format!("Antwort nicht lesbar: {error}")))?;
        if let Some(error) = chunk.get("error") {
            return Err(StreamError::Failed(error_text(error)));
        }
        apply_chunk(&chunk, &mut completion, &mut calls);
    }
    // Eine fehlende Kennung wird eindeutig erzeugt: der Verwalter ordnet Ergebnisse über sie zu,
    // über alle Runden und Turns hinweg.
    completion.tool_calls = calls
        .into_values()
        .map(|call: PartialCall| ToolCall {
            id: call
                .id
                .unwrap_or_else(|| format!("call_{}", uuid::Uuid::new_v4().simple())),
            name: call.name,
            arguments: call.arguments,
        })
        .collect();
    Ok(completion)
}

fn apply_chunk(chunk: &Value, completion: &mut Completion, calls: &mut BTreeMap<u64, PartialCall>) {
    if let Some(usage) = chunk
        .get("usage")
        .filter(|usage: &&Value| usage.is_object())
    {
        completion.prompt_tokens = token_count(usage, "prompt_tokens");
        completion.completion_tokens = token_count(usage, "completion_tokens");
    }
    let Some(choice) = chunk.pointer("/choices/0") else {
        return;
    };
    if let Some(reason) = choice.get("finish_reason").and_then(Value::as_str) {
        completion.finish_reason = Some(reason.to_owned());
    }
    let Some(delta) = choice.get("delta") else {
        return;
    };
    if let Some(text) = delta.get("content").and_then(Value::as_str) {
        completion.text.push_str(text);
    }
    if let Some(reasoning) = delta.get("reasoning_content").and_then(Value::as_str) {
        completion.reasoning.push_str(reasoning);
    }
    for call_delta in delta
        .get("tool_calls")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let index = call_delta.get("index").and_then(Value::as_u64).unwrap_or(0);
        let call = calls.entry(index).or_default();
        if call.id.is_none() {
            call.id = call_delta
                .get("id")
                .and_then(Value::as_str)
                .filter(|id: &&str| !id.is_empty())
                .map(str::to_owned);
        }
        if call.name.is_empty()
            && let Some(name) = call_delta.pointer("/function/name").and_then(Value::as_str)
        {
            call.name = name.to_owned();
        }
        if let Some(arguments) = call_delta
            .pointer("/function/arguments")
            .and_then(Value::as_str)
        {
            call.arguments.push_str(arguments);
        }
    }
}

fn token_count(usage: &Value, key: &str) -> Option<u32> {
    usage
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|count: u64| u32::try_from(count).ok())
}

fn error_text(error: &Value) -> String {
    match error {
        Value::String(text) => text.clone(),
        other => other
            .get("message")
            .and_then(Value::as_str)
            .map_or_else(|| other.to_string(), str::to_owned),
    }
}
