//! Zeilenformate der Claude-Kommandozeile (docs/knowledge/claude-stream-json.md).
//! Eingehend nur die Felder, die die Übersetzung braucht; unbekannte Felder und
//! unbekannte `type`-Werte werden ignoriert, weil das Protokoll nicht als stabil dokumentiert ist.
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum Incoming {
    #[serde(rename = "system")]
    System(SystemLine),
    #[serde(rename = "assistant")]
    Assistant(MessageLine<AssistantMessage>),
    #[serde(rename = "user")]
    User(MessageLine<UserMessage>),
    #[serde(rename = "control_request")]
    ControlRequest(ControlRequestLine),
    #[serde(rename = "result")]
    Result(ResultLine),
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
pub struct SystemLine {
    pub subtype: String,
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MessageLine<M> {
    pub message: M,
    /// Gesetzt bei Nachrichten eines Subagenten.
    pub parent_tool_use_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssistantMessage {
    pub content: Vec<ContentBlock>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
pub struct UserMessage {
    pub content: UserContent,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum UserContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Thinking {
        thinking: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    ToolResult {
        tool_use_id: String,
        is_error: Option<bool>,
    },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
pub struct Usage {
    pub input_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
    pub cache_read_input_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ControlRequestLine {
    pub request_id: String,
    pub request: ControlRequestBody,
}

#[derive(Debug, Deserialize)]
pub struct ControlRequestBody {
    pub subtype: String,
    pub tool_name: Option<String>,
    pub input: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ResultLine {
    pub subtype: String,
    /// Fehlt das Feld, gilt die Antwort als erfolgreich — eine unlesbare
    /// `result`-Zeile ließe die Session sonst ewig „laufen“.
    #[serde(default)]
    pub is_error: bool,
    pub terminal_reason: Option<String>,
    pub result: Option<String>,
    #[serde(rename = "modelUsage")]
    pub model_usage: Option<HashMap<String, ModelUsage>>,
}

#[derive(Debug, Deserialize)]
pub struct ModelUsage {
    #[serde(rename = "contextWindow")]
    pub context_window: Option<u32>,
}

pub fn user_message(text: &str) -> String {
    json!({
        "type": "user",
        "message": { "role": "user", "content": text },
    })
    .to_string()
}

pub fn control_request(request_id: &str, request: Value) -> String {
    json!({
        "type": "control_request",
        "request_id": request_id,
        "request": request,
    })
    .to_string()
}

pub fn allow(request_id: &str, updated_input: Value) -> String {
    control_success(
        request_id,
        json!({ "behavior": "allow", "updatedInput": updated_input }),
    )
}

pub fn deny(request_id: &str, message: &str) -> String {
    control_success(
        request_id,
        json!({ "behavior": "deny", "message": message }),
    )
}

fn control_success(request_id: &str, response: Value) -> String {
    json!({
        "type": "control_response",
        "response": {
            "subtype": "success",
            "request_id": request_id,
            "response": response,
        },
    })
    .to_string()
}
