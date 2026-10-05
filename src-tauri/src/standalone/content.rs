//! Übersetzt den Inhalt einer `user`-Zeile (Format aus `attachments::message_content`) in eine
//! Nachricht im OpenAI-Format.
use serde_json::{Value, json};

const BASE64_SOURCE: &str = "base64";
const USER_ROLE: &str = "user";

/// Text bleibt Text; Blöcke werden zu `text`- und `image_url`-Teilen, andere Blöcke (PDF) fallen
/// weg — das Modell bekommt deren Pfad ohnehin im Text, wenn sie zu groß waren, sonst gar nicht.
pub fn user_message(content: &Value) -> Value {
    let Some(blocks) = content.as_array() else {
        let text = content.as_str().unwrap_or_default();
        return json!({ "role": "user", "content": text });
    };
    let parts: Vec<Value> = blocks.iter().filter_map(convert_block).collect();
    json!({ "role": "user", "content": parts })
}

/// Hängt `next` an `previous` an, wenn beide Benutzer-Nachrichten sind; sonst `false` und nichts
/// geändert.
pub fn merge_user(previous: &mut Value, next: &Value) -> bool {
    if role_of(previous) != Some(USER_ROLE) || role_of(next) != Some(USER_ROLE) {
        return false;
    }
    let merged = match (previous.get("content"), next.get("content")) {
        (Some(Value::String(first)), Some(Value::String(second))) => {
            Value::from(format!("{first}\n\n{second}"))
        }
        (first, second) => {
            let mut parts = as_parts(first);
            parts.extend(as_parts(second));
            Value::Array(parts)
        }
    };
    previous["content"] = merged;
    true
}

/// Zeichen der Texte einer Nachricht; Bilder zählen nicht.
pub fn text_chars(message: &Value) -> usize {
    match message.get("content") {
        Some(Value::String(text)) => text.chars().count(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part: &Value| part.get("text").and_then(Value::as_str))
            .map(|text: &str| text.chars().count())
            .sum(),
        _ => 0,
    }
}

fn role_of(message: &Value) -> Option<&str> {
    message.get("role").and_then(Value::as_str)
}

fn as_parts(content: Option<&Value>) -> Vec<Value> {
    match content {
        Some(Value::String(text)) => vec![json!({ "type": "text", "text": text })],
        Some(Value::Array(parts)) => parts.clone(),
        _ => Vec::new(),
    }
}

fn convert_block(block: &Value) -> Option<Value> {
    match block.get("type").and_then(Value::as_str)? {
        "text" => {
            let text = block.get("text").and_then(Value::as_str)?;
            Some(json!({ "type": "text", "text": text }))
        }
        "image" => {
            let source = block.get("source")?;
            if source.get("type").and_then(Value::as_str) != Some(BASE64_SOURCE) {
                return None;
            }
            let media_type = source.get("media_type").and_then(Value::as_str)?;
            let data = source.get("data").and_then(Value::as_str)?;
            Some(json!({
                "type": "image_url",
                "image_url": { "url": format!("data:{media_type};base64,{data}") },
            }))
        }
        _ => None,
    }
}
