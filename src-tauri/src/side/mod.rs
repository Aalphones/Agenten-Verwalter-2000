//! Nebenfragen: eine Frage zur Session, die Claude aus dem bisherigen Verlauf beantwortet, ohne dass
//! sie in den Chat wandert — ein Einmal-Aufruf auf einem Fork der Session, nur im Speicher (ADR 044).
pub mod model;

use std::time::Duration;

/// Je Session; die nächste verdrängt die älteste.
pub const MAX_QUESTIONS: usize = 20;
/// Gleichzeitig laufende je Session; die nächste wird abgelehnt.
pub const MAX_RUNNING: usize = 3;
pub const TIMEOUT_CLAUDE: Duration = Duration::from_secs(120);
/// Das erste Token kam beim Fortsetzen einer Session mit dem lokalen Modell nach 224 s
/// (docs/knowledge/claude-stream-json.md).
pub const TIMEOUT_LOCAL: Duration = Duration::from_secs(300);
pub const MAX_QUOTE_CHARS: usize = 1000;

const INSTRUCTION: &str =
    "Beantworte das nur aus dem bisherigen Verlauf, knapp und ohne Werkzeuge.";

/// Zitat und Anweisung stehen in der Frage, nicht im Systemprompt: der Anfang des Prompts bleibt
/// gleich, und die Nebenfrage liest den Verlauf aus dem Prompt-Cache der Session.
pub fn prompt(question: &str, quote: Option<&str>) -> String {
    let mut text = String::new();
    if let Some(quote) = quote.filter(|quote: &&str| !quote.trim().is_empty()) {
        text.push_str("Bezug (Auszug aus deiner Antwort):\n");
        for line in quote.lines() {
            text.push_str("> ");
            text.push_str(line);
            text.push('\n');
        }
        text.push('\n');
    }
    text.push_str(question);
    text.push('\n');
    text.push_str(INSTRUCTION);
    text
}

/// Kürzt an einer Zeichen-, nicht an einer Byte-Grenze.
pub fn clip_quote(quote: &str) -> String {
    match quote.char_indices().nth(MAX_QUOTE_CHARS) {
        Some((end, _)) => format!("{}…", &quote[..end]),
        None => quote.to_owned(),
    }
}
