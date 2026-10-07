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

/// `scratchpad` steht nur der Vollständigkeit halber in der Zeile: den Ordner gibt der Verwalter
/// vor (ADR 022) und überliest die Angabe.
pub fn init(
    session_id: &str,
    model: &str,
    cwd: &Path,
    tools: &[String],
    scratchpad: &Path,
) -> Value {
    json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": model,
        "cwd": cwd.to_string_lossy(),
        "tools": tools,
        "scratchpad_path": scratchpad.to_string_lossy(),
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

/// Antwort eines Subagenten, zugeordnet über seinen `Agent`-Aufruf. Ohne `usage`: die gilt seinem
/// eigenen Kontext, nicht dem Donut der Session.
pub fn subagent_assistant(session_id: &str, parent_tool_use_id: &str, blocks: Vec<Value>) -> Value {
    json!({
        "type": "assistant",
        "session_id": session_id,
        "parent_tool_use_id": parent_tool_use_id,
        "message": { "role": "assistant", "content": blocks },
    })
}

/// `results` sind fertige `tool_result`-Blöcke; `parent_tool_use_id` ist bei einem Subagenten die
/// ID seines `Agent`-Aufrufs. `resolved_model` steht in einer Runde mit `Agent`-Ergebnis — daran
/// liest der Verwalter das Modell des Subagenten ab.
pub fn tool_results(
    session_id: &str,
    parent_tool_use_id: Option<&str>,
    results: Vec<Value>,
    resolved_model: Option<&str>,
) -> Value {
    let mut line = json!({
        "type": "user",
        "session_id": session_id,
        "parent_tool_use_id": parent_tool_use_id,
        "message": { "role": "user", "content": results },
    });
    if let Some(model) = resolved_model {
        line["tool_use_result"] = json!({ "resolvedModel": model });
    }
    line
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

/// Der Verwalter ignoriert die Zeile; im Protokoll zeigt sie, wo der Verlauf ersetzt wurde.
pub fn compact_boundary() -> Value {
    json!({ "type": "system", "subtype": "compact_boundary" })
}

/// Die einzige Zeile des Druckmodus: `raw` ist der Text des Modells, `structured` sein Inhalt als
/// JSON-Objekt.
pub fn print_success(raw: &str, structured: &Value) -> Value {
    json!({
        "type": "result",
        "subtype": "success",
        "is_error": false,
        "result": raw,
        "structured_output": structured,
    })
}

pub fn print_error(text: &str) -> Value {
    json!({
        "type": "result",
        "subtype": "error_during_execution",
        "is_error": true,
        "result": text,
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
