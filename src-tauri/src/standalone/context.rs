//! Wie voll das Kontextfenster ist: der Messwert der letzten Antwort samt Schätzung für das, was
//! seither dazukam, die Schwelle fürs Verdichten und die Aufschlüsselung für `get_context_usage`.
use serde_json::{Value, json};

use super::content::{self, CHARS_PER_TOKEN};
use super::prompt::{MemoryFile, SystemPrompt};

/// Ab diesem Anteil des Fensters verdichtet der Agent vor der nächsten Anfrage.
const COMPACT_PERCENT: u64 = 80;
/// Kategorien und Art, wie der Verwalter sie liest (`agents/claude/stats.rs`).
const KIND_USED: &str = "used";
const KIND_FREE: &str = "free";

pub fn compact_threshold(context_window: u32) -> u32 {
    let threshold = u64::from(context_window) * COMPACT_PERCENT / 100;
    u32::try_from(threshold).unwrap_or(u32::MAX)
}

/// Zeichen aller Texte der Nachrichten; Bilder zählen nicht.
pub fn total_chars(messages: &[Value]) -> usize {
    messages.iter().map(content::text_chars).sum()
}

pub fn estimated_tokens(characters: usize) -> u32 {
    u32::try_from(characters / CHARS_PER_TOKEN).unwrap_or(u32::MAX)
}

/// Der Kontext zum Zeitpunkt der letzten Messung. `prompt_tokens` einer Antwort ist der **ganze**
/// Kontext, nicht der Zuwachs — eine neue Messung ersetzt die alte, nie addieren.
#[derive(Debug, Clone, Copy, Default)]
pub struct ContextMeasure {
    /// 0 = noch nichts gemessen (frischer Start, fortgesetzte Session).
    pub tokens: u32,
    /// Zeichen aller Nachrichten zu diesem Zeitpunkt, die Antwort eingerechnet.
    pub chars: usize,
}

impl ContextMeasure {
    /// Der Kontext nach einer Antwort: Anfrage plus Antwort, wie das Modell sie zählt; meldet es
    /// nichts, wird aus den Zeichen geschätzt. `messages` sind die gesendeten Nachrichten,
    /// `answer_chars` die Zeichen der Antwort.
    pub fn after_answer(
        prompt_tokens: Option<u32>,
        completion_tokens: Option<u32>,
        messages: &[Value],
        answer_chars: usize,
    ) -> ContextMeasure {
        let chars = total_chars(messages) + answer_chars;
        let tokens = match prompt_tokens {
            Some(prompt) => prompt.saturating_add(completion_tokens.unwrap_or(0)),
            None => estimated_tokens(chars),
        };
        ContextMeasure { tokens, chars }
    }

    /// Das Modell hat nichts gemeldet — alles geschätzt.
    pub fn estimated(messages: &[Value]) -> ContextMeasure {
        let chars = total_chars(messages);
        ContextMeasure {
            tokens: estimated_tokens(chars),
            chars,
        }
    }

    /// Token, die `messages` jetzt belegen: Messwert plus Schätzung für den Zuwachs seither.
    pub fn estimate(&self, messages: &[Value]) -> u32 {
        let current = total_chars(messages);
        if self.tokens == 0 {
            return estimated_tokens(current);
        }
        self.tokens
            .saturating_add(estimated_tokens(current.saturating_sub(self.chars)))
    }
}

/// Antwort auf `get_context_usage`, im Format, das `agents/claude/stats.rs` liest. `messages` ist
/// der Verlauf ohne Systemprompt.
pub fn usage_report(
    model: &str,
    context_window: u32,
    prompt: &SystemPrompt,
    tools: &[Value],
    messages: &[Value],
) -> Value {
    let memory_tokens: u32 = prompt
        .memory_files
        .iter()
        .map(|file: &MemoryFile| file.tokens)
        .sum();
    let tools_tokens = estimated_tokens(Value::Array(tools.to_vec()).to_string().chars().count());
    let used = [
        ("System prompt", prompt.base_tokens()),
        ("System tools", tools_tokens),
        ("Memory files", memory_tokens),
        ("Skills", prompt.skills_tokens),
        ("Messages", estimated_tokens(total_chars(messages))),
    ];
    let total_tokens: u32 = used.iter().map(|(_, tokens): &(&str, u32)| *tokens).sum();
    let mut categories: Vec<Value> = used
        .iter()
        .map(|(name, tokens): &(&str, u32)| {
            json!({ "name": name, "tokens": tokens, "kind": KIND_USED })
        })
        .collect();
    categories.push(json!({
        "name": "Free space",
        "tokens": context_window.saturating_sub(total_tokens),
        "kind": KIND_FREE,
    }));
    let memory_files: Vec<Value> = prompt
        .memory_files
        .iter()
        .map(|file: &MemoryFile| {
            json!({ "path": file.path.display().to_string(), "tokens": file.tokens })
        })
        .collect();
    json!({
        "categories": categories,
        "totalTokens": total_tokens,
        "maxTokens": context_window,
        "model": model,
        "memoryFiles": memory_files,
        "autoCompactThreshold": compact_threshold(context_window),
        "isAutoCompactEnabled": true,
    })
}
