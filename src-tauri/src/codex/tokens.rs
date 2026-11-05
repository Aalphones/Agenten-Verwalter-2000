//! Die Token-Zählung von Codex (`thread/tokenUsage/updated`) als Kontext-Angaben für den Verwalter.
use serde_json::{Value, json};

/// Name der einzigen Kategorie, die Codex hergibt: eine Aufschlüsselung wie bei Claude gibt es nicht.
const HISTORY_CATEGORY: &str = "Verlauf";
const KIND_USED: &str = "used";

/// Was der letzte Aufruf des Modells belegt hat und wie groß das Fenster ist.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TokenCount {
    pub input: u64,
    pub output: u64,
    pub window: Option<u64>,
}

impl TokenCount {
    /// `params` einer `thread/tokenUsage/updated`-Benachrichtigung; ohne `last` `None`.
    pub fn from_notification(params: &Value) -> Option<TokenCount> {
        let usage = params.get("tokenUsage")?;
        let last = usage.get("last")?;
        let mut input = last.get("inputTokens").and_then(Value::as_u64)?;
        let output = last
            .get("outputTokens")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        // Nach dem Zusammenfassen meldet Codex `inputTokens` und `outputTokens` mit 0 und nur
        // `totalTokens` mit dem Stand; ohne diesen Ausweg stünde der Kontext danach bei 0.
        let total = last.get("totalTokens").and_then(Value::as_u64).unwrap_or(0);
        if input == 0 && output == 0 && total > 0 {
            input = total;
        }
        Some(TokenCount {
            input,
            output,
            window: usage.get("modelContextWindow").and_then(Value::as_u64),
        })
    }

    /// Antwort auf `get_context_usage` in der Form, die `agents/claude/stats.rs` liest.
    pub fn context_usage(&self, model: &str) -> Value {
        let used = self.input + self.output;
        json!({
            "model": model,
            "totalTokens": used,
            "maxTokens": self.window.unwrap_or(0),
            "categories": [{ "name": HISTORY_CATEGORY, "tokens": used, "kind": KIND_USED }],
        })
    }
}

/// Setzt die Token-Zählung in eine `assistant`-Zeile des Hauptagenten; ohne Zählung fällt das Feld
/// weg, damit der Verwalter den Balken nicht auf 0 setzt.
pub fn apply_to_assistant(line: &mut Value, count: Option<TokenCount>) {
    if line.get("type").and_then(Value::as_str) != Some("assistant") {
        return;
    }
    let Some(message) = line.get_mut("message").and_then(Value::as_object_mut) else {
        return;
    };
    match count {
        Some(count) => {
            message.insert(
                "usage".to_owned(),
                json!({ "input_tokens": count.input, "output_tokens": count.output }),
            );
        }
        None => {
            message.remove("usage");
        }
    }
}
