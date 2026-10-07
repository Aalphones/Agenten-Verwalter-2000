//! Übersetzt den Inhalt einer `user`-Zeile (Format aus `attachments::message_content`) in eine
//! Nachricht im OpenAI-Format.
use serde_json::{Value, json};

const BASE64_SOURCE: &str = "base64";
const USER_ROLE: &str = "user";
const IMAGE_PART_TYPE: &str = "image_url";
/// Grobe Schätzung der Token aus der Zeichenzahl, wo das Modell keine Zahl meldet.
pub const CHARS_PER_TOKEN: usize = 4;

/// Steht an Stelle eines Bilds, das das geladene Modell nicht lesen kann.
pub const IMAGE_OMITTED_TEXT: &str =
    "[Bild weggelassen: das geladene Modell versteht keine Bilder]";
/// Beginn des Textteils der Nachricht, mit der `Read` ein Bild ins Gespräch bringt.
const READ_IMAGE_PREFIX: &str = "Image from Read: ";

/// Text bleibt Text; Blöcke werden zu `text`- und `image_url`-Teilen, andere Blöcke (PDF) fallen
/// weg — das Modell bekommt deren Pfad ohnehin im Text, wenn sie zu groß waren, sonst gar nicht.
/// Ohne Bildverständnis wird jedes Bild zu `IMAGE_OMITTED_TEXT`.
pub fn user_message(content: &Value, has_vision: bool) -> Value {
    let Some(blocks) = content.as_array() else {
        let text = content.as_str().unwrap_or_default();
        return json!({ "role": "user", "content": text });
    };
    let parts: Vec<Value> = blocks
        .iter()
        .filter_map(|block: &Value| convert_block(block, has_vision))
        .collect();
    json!({ "role": "user", "content": parts })
}

/// Das Bild, das `Read` gelesen hat: Werkzeug-Nachrichten tragen im OpenAI-Format keine Bilder,
/// deshalb folgt es als Benutzer-Nachricht hinter den Ergebnissen der Runde.
pub fn read_image_message(path: &str, media_type: &str, data: &str) -> Value {
    json!({
        "role": "user",
        "content": [
            { "type": "text", "text": format!("{READ_IMAGE_PREFIX}{path}") },
            { "type": "image_url", "image_url": { "url": format!("data:{media_type};base64,{data}") } },
        ],
    })
}

/// Eine Benutzer-Nachricht, mit der ein Mensch einen Turn beginnt — nicht das Bild aus `Read`,
/// das mitten in einem Turn steht.
pub fn starts_turn(message: &Value) -> bool {
    if role_of(message) != Some(USER_ROLE) {
        return false;
    }
    let first_text = message
        .pointer("/content/0/text")
        .and_then(Value::as_str)
        .unwrap_or_default();
    !first_text.starts_with(READ_IMAGE_PREFIX)
}

/// Eine Nachricht ohne ihre Bilder: jedes Bild wird zu einem kurzen Hinweis. Fürs Verdichten, wo
/// die Bilder nur Platz kosten.
pub fn without_images(message: &Value) -> Value {
    let Some(parts) = message.get("content").and_then(Value::as_array) else {
        return message.clone();
    };
    let replaced: Vec<Value> = parts
        .iter()
        .map(|part: &Value| {
            if part.get("type").and_then(Value::as_str) == Some(IMAGE_PART_TYPE) {
                json!({ "type": "text", "text": "[Bild entfernt]" })
            } else {
                part.clone()
            }
        })
        .collect();
    let mut copy = message.clone();
    copy["content"] = Value::Array(replaced);
    copy
}

/// Hängt `message` ans Ende von `list`; folgt eine Benutzer-Nachricht auf eine Benutzer-Nachricht,
/// werden beide zusammengelegt — manche Chat-Vorlagen lehnen zwei in Folge ab.
pub fn push_merged(list: &mut Vec<Value>, message: &Value) {
    let merged = list
        .last_mut()
        .is_some_and(|previous: &mut Value| merge_user(previous, message));
    if !merged {
        list.push(message.clone());
    }
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

fn convert_block(block: &Value, has_vision: bool) -> Option<Value> {
    match block.get("type").and_then(Value::as_str)? {
        "text" => {
            let text = block.get("text").and_then(Value::as_str)?;
            Some(json!({ "type": "text", "text": text }))
        }
        "image" if !has_vision => Some(json!({ "type": "text", "text": IMAGE_OMITTED_TEXT })),
        "image" => {
            let source = block.get("source")?;
            if source.get("type").and_then(Value::as_str) != Some(BASE64_SOURCE) {
                return None;
            }
            let media_type = source.get("media_type").and_then(Value::as_str)?;
            let data = source.get("data").and_then(Value::as_str)?;
            Some(json!({
                "type": IMAGE_PART_TYPE,
                "image_url": { "url": format!("data:{media_type};base64,{data}") },
            }))
        }
        _ => None,
    }
}
