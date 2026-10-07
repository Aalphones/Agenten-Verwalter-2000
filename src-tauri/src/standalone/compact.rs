//! Verdichten: ein Verlauf, der das Fenster füllt, wird bis auf den laufenden Turn durch eine
//! Zusammenfassung des Modells ersetzt.
use std::sync::atomic::AtomicBool;

use serde_json::{Value, json};

use super::content;
use super::llm::{self, ChatRequest, LlmError};

const SUMMARY_SYSTEM_PROMPT: &str = "You compress a coding session so that work can continue. Write a summary with these headings: Task, Decisions, Files touched, Current state, Next steps, Open questions. At most 1 500 words.";
const SUMMARY_REQUEST: &str = "Summarize the conversation above.";
const SUMMARY_PREFIX: &str = "Summary of the earlier conversation (compacted):\n\n";
const SUMMARY_ACKNOWLEDGEMENT: &str = "Understood — continuing from the summary.";
/// So viel behält ein Werkzeug-Ergebnis, wenn es nichts zum Zusammenfassen gibt und nur Kürzen hilft.
const TOOL_RESULT_KEPT_CHARS: usize = 2_000;
const TOOL_RESULT_CUT_NOTE: &str = "\n… gekürzt beim Verdichten";
const TOOL_ROLE: &str = "tool";

/// `messages` ist der Verlauf ohne Systemprompt. Der laufende Turn — alles ab der letzten
/// Benutzer-Nachricht eines Menschen, samt Werkzeug-Aufrufen und -Ergebnissen — bleibt wörtlich
/// erhalten; alles davor fasst das Modell zusammen. Gibt es davor nichts, kürzt das Verdichten
/// stattdessen die Werkzeug-Ergebnisse des Turns.
pub fn compact(
    base_url: &str,
    model: &str,
    messages: &[Value],
    cancel: &AtomicBool,
) -> Result<Vec<Value>, LlmError> {
    let turn_start = messages.iter().rposition(content::starts_turn).unwrap_or(0);
    let (head, tail) = messages.split_at(turn_start);
    if head.is_empty() {
        return Ok(tail.iter().map(shortened_tool_result).collect());
    }
    let summary = summarize(base_url, model, head, cancel)?;
    let mut compacted: Vec<Value> = vec![
        json!({ "role": "user", "content": format!("{SUMMARY_PREFIX}{summary}") }),
        json!({ "role": "assistant", "content": SUMMARY_ACKNOWLEDGEMENT }),
    ];
    compacted.extend(tail.iter().cloned());
    Ok(compacted)
}

fn summarize(
    base_url: &str,
    model: &str,
    head: &[Value],
    cancel: &AtomicBool,
) -> Result<String, LlmError> {
    let mut request_messages: Vec<Value> =
        vec![json!({ "role": "system", "content": SUMMARY_SYSTEM_PROMPT })];
    for message in head {
        content::push_merged(&mut request_messages, &content::without_images(message));
    }
    content::push_merged(
        &mut request_messages,
        &json!({ "role": "user", "content": SUMMARY_REQUEST }),
    );
    let request = ChatRequest {
        base_url,
        model,
        messages: &request_messages,
        tools: &[],
        response_format: None,
    };
    let completion = llm::complete(&request, cancel)?;
    let summary = completion.text.trim();
    if summary.is_empty() {
        return Err(LlmError::Failed(
            "Das Modell lieferte keine Zusammenfassung".to_owned(),
        ));
    }
    Ok(summary.to_owned())
}

fn shortened_tool_result(message: &Value) -> Value {
    let is_tool_result = message.get("role").and_then(Value::as_str) == Some(TOOL_ROLE);
    let Some(text) = message.get("content").and_then(Value::as_str) else {
        return message.clone();
    };
    if !is_tool_result || text.chars().count() <= TOOL_RESULT_KEPT_CHARS {
        return message.clone();
    }
    let kept: String = text.chars().take(TOOL_RESULT_KEPT_CHARS).collect();
    let mut shortened = message.clone();
    shortened["content"] = Value::from(format!("{kept}{TOOL_RESULT_CUT_NOTE}"));
    shortened
}
