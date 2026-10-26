//! Einstiegszeilen am Ende einer Agenten-Antwort (ADR 027, ADR 040).

use std::sync::LazyLock;

use regex::Regex;

use crate::agents::event::ModelId;
use crate::sessions::model::{HandoffHalt, HandoffKind, HandoffLine};

const HANDOFF_PREFIX: &str = "Weiter:";
const PROJECT_PREFIX: &str = "Neues Vorhaben";
const PROJECT_LABEL_MAX: usize = 80;
const HANDOFF_WINDOW: usize = 5;
const CODE_FENCE: &str = "```";
const RED: char = '🔴';

static MODEL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\bModell\s+(fable|opusplan|opus|sonnet|haiku)\b")
        .expect("MODEL ist ein gültiger regulärer Ausdruck")
});

/// Die Einstiegszeilen einer Antwort in Antwort-Reihenfolge. Gesucht wird von hinten; Einstiegszeilen
/// zählen nicht gegen das Fenster, andere nicht leere Zeilen schon (fünf, dann ist Schluss).
pub fn handoff_lines(text: &str) -> Vec<HandoffLine> {
    let (mut found, _) = tail(text);
    found.reverse();
    found
}

/// Warum die Einstiegszeile dieser Antwort nicht automatisch gesendet wird (ADR 040); `None` ohne
/// Haltegrund im Text. 🔴 zählt überall außerhalb von Code-Blöcken, Frage und „merge“ nur in den
/// gezählten Zeilen am Ende.
pub fn stop_reason(text: &str) -> Option<HandoffHalt> {
    if has_red(text) {
        return Some(HandoffHalt::Red);
    }
    let (_, counted) = tail(text);
    counted.iter().find_map(|line: &String| {
        if line.ends_with('?') {
            Some(HandoffHalt::Question)
        } else if line.to_lowercase().contains("merge") {
            Some(HandoffHalt::Merge)
        } else {
            None
        }
    })
}

/// Einstiegszeilen und gezählte bereinigte Zeilen vom Ende der Antwort, beide von unten nach oben.
fn tail(text: &str) -> (Vec<HandoffLine>, Vec<String>) {
    let mut found: Vec<HandoffLine> = Vec::new();
    let mut counted: Vec<String> = Vec::new();
    for line in text.lines().rev().map(str::trim) {
        if line.is_empty() || line.starts_with(CODE_FENCE) {
            continue;
        }
        let cleaned: String = clean(line);
        match parse_line(&cleaned) {
            Some(handoff) => found.push(handoff),
            None => {
                counted.push(cleaned);
                if counted.len() == HANDOFF_WINDOW {
                    break;
                }
            }
        }
    }
    (found, counted)
}

fn has_red(text: &str) -> bool {
    let mut in_code: bool = false;
    for line in text.lines() {
        if line.trim().starts_with(CODE_FENCE) {
            in_code = !in_code;
        } else if !in_code && line.contains(RED) {
            return true;
        }
    }
    false
}

/// Erkennt eine bereinigte Zeile als „Weiter: …“ oder „Neues Vorhaben … : …“.
pub fn parse_line(cleaned: &str) -> Option<HandoffLine> {
    let kind: HandoffKind = if is_session_line(cleaned) {
        HandoffKind::Session
    } else if is_project_line(cleaned) {
        HandoffKind::Project
    } else {
        return None;
    };
    Some(HandoffLine {
        kind,
        text: cleaned.to_owned(),
        model: model_of(cleaned),
    })
}

/// Die Zeilen für die Spalte `handoff_line`, durch Zeilenumbruch getrennt; `None` ohne Zeilen.
pub fn join(lines: &[HandoffLine]) -> Option<String> {
    if lines.is_empty() {
        return None;
    }
    let texts: Vec<&str> = lines
        .iter()
        .map(|line: &HandoffLine| line.text.as_str())
        .collect();
    Some(texts.join("\n"))
}

/// Gegenstück zu [`join`]; liest auch Altbestände mit einer einzelnen Zeile.
pub fn split(stored: Option<&str>) -> Vec<HandoffLine> {
    stored.map_or_else(Vec::new, |value: &str| {
        value.lines().filter_map(parse_line).collect()
    })
}

fn is_session_line(cleaned: &str) -> bool {
    cleaned.starts_with(HANDOFF_PREFIX) && cleaned.chars().count() > HANDOFF_PREFIX.len() + 1
}

fn is_project_line(cleaned: &str) -> bool {
    let Some(rest) = cleaned.strip_prefix(PROJECT_PREFIX) else {
        return false;
    };
    let Some(colon) = rest.find(':') else {
        return false;
    };
    rest[..colon].chars().count() <= PROJECT_LABEL_MAX && !rest[colon + 1..].trim().is_empty()
}

fn model_of(line: &str) -> Option<ModelId> {
    let name: &str = MODEL.captures(line)?.get(1)?.as_str();
    match name.to_lowercase().as_str() {
        "fable" => Some(ModelId::Fable),
        "opusplan" => Some(ModelId::Opusplan),
        "opus" => Some(ModelId::Opus),
        "sonnet" => Some(ModelId::Sonnet),
        "haiku" => Some(ModelId::Haiku),
        _ => None,
    }
}

/// Entfernt Zitat-Zeichen, Fettdruck und Backticks um die Zeile.
fn clean(line: &str) -> String {
    let unquoted = line
        .strip_prefix('>')
        .map_or(line, |rest: &str| rest.trim_start());
    let without_bold = unquoted.replace("**", "");
    without_bold.trim().trim_matches('`').trim().to_owned()
}
