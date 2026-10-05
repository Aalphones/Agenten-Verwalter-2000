//! Ausgehende Zeilen des Zeilenprotokolls (Kontrakt in ADR 017 bzw. der Plan-README). Nur `Output`
//! schreibt auf stdout, damit sich Zeilen verschiedener Threads nie mischen.
use std::io::{self, Stdout, Write};
use std::path::Path;
use std::process;
use std::sync::{Mutex, PoisonError};

use serde_json::{Map, Value, json};

const ABORTED_REASON: &str = "aborted_streaming";
const COMPLETED_REASON: &str = "completed";

pub struct Output {
    stdout: Mutex<Stdout>,
}

impl Default for Output {
    fn default() -> Self {
        Output {
            stdout: Mutex::new(io::stdout()),
        }
    }
}

impl Output {
    /// Eine Zeile, sofort geleert. Scheitert das Schreiben, ist der Verwalter weg — dann gibt es
    /// niemanden mehr, für den der Agent arbeitet.
    pub fn line(&self, value: &Value) {
        let mut stdout = self.stdout.lock().unwrap_or_else(PoisonError::into_inner);
        let written = serde_json::to_writer(&mut *stdout, value)
            .map_err(io::Error::from)
            .and_then(|()| stdout.write_all(b"\n"))
            .and_then(|()| stdout.flush());
        if written.is_err() {
            process::exit(0);
        }
    }
}

pub fn init(session_id: &str, model: &str, cwd: &Path, tools: &[String]) -> Value {
    json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": model,
        "cwd": cwd.to_string_lossy(),
        "tools": tools,
    })
}

/// `blocks` in der Reihenfolge des Kontrakts: Denken, Text, Werkzeug-Aufrufe.
pub fn assistant(
    session_id: &str,
    blocks: Vec<Value>,
    input_tokens: u32,
    output_tokens: u32,
) -> Value {
    json!({
        "type": "assistant",
        "session_id": session_id,
        "parent_tool_use_id": null,
        "message": {
            "role": "assistant",
            "content": blocks,
            "usage": { "input_tokens": input_tokens, "output_tokens": output_tokens },
        },
    })
}

/// `results` sind fertige `tool_result`-Blöcke.
pub fn tool_results(session_id: &str, results: Vec<Value>) -> Value {
    json!({
        "type": "user",
        "session_id": session_id,
        "parent_tool_use_id": null,
        "message": { "role": "user", "content": results },
    })
}

pub fn can_use_tool(request_id: &str, tool_name: &str, input: &Value) -> Value {
    json!({
        "type": "control_request",
        "request_id": request_id,
        "request": { "subtype": "can_use_tool", "tool_name": tool_name, "input": input },
    })
}

pub fn control_success(request_id: &str, response: Value) -> Value {
    json!({
        "type": "control_response",
        "response": { "subtype": "success", "request_id": request_id, "response": response },
    })
}

pub fn control_error(request_id: &str, error: &str) -> Value {
    json!({
        "type": "control_response",
        "response": { "subtype": "error", "request_id": request_id, "error": error },
    })
}

pub fn result_success(session_id: &str, text: &str, model: &str, context_window: u32) -> Value {
    result(
        session_id,
        "success",
        false,
        text,
        COMPLETED_REASON,
        model,
        context_window,
    )
}

pub fn result_error(session_id: &str, text: &str, model: &str, context_window: u32) -> Value {
    result(
        session_id,
        "error_during_execution",
        true,
        text,
        COMPLETED_REASON,
        model,
        context_window,
    )
}

pub fn result_aborted(session_id: &str, model: &str, context_window: u32) -> Value {
    result(
        session_id,
        "success",
        false,
        "",
        ABORTED_REASON,
        model,
        context_window,
    )
}

fn result(
    session_id: &str,
    subtype: &str,
    is_error: bool,
    text: &str,
    terminal_reason: &str,
    model: &str,
    context_window: u32,
) -> Value {
    let mut model_usage = Map::new();
    model_usage.insert(model.to_owned(), json!({ "contextWindow": context_window }));
    json!({
        "type": "result",
        "subtype": subtype,
        "is_error": is_error,
        "result": text,
        "session_id": session_id,
        "terminal_reason": terminal_reason,
        "modelUsage": model_usage,
    })
}
