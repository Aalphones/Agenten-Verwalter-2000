//! Skills und Befehle für das Modell: der Text, den `Skill` und ein getipptes `/name` liefern.
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::skills::model::SkillKind;
use crate::skills::{self, frontmatter};

const ARGUMENTS_PLACEHOLDER: &str = "$ARGUMENTS";
const TEXT_BLOCK: &str = "text";

/// Skill: Ordner der Datei und Inhalt ohne Kopfdaten. Befehl: Inhalt ohne Kopfdaten, `$ARGUMENTS`
/// ersetzt. Gibt es Argumente, aber keinen Platzhalter (und bei Skills immer), hängt am Ende
/// `ARGUMENTS: <args>`.
pub fn render(kind: SkillKind, file: &Path, args: &str) -> Result<String, String> {
    let bytes = fs::read(file)
        .map_err(|error: std::io::Error| format!("{} nicht lesbar: {error}", file.display()))?;
    let text = String::from_utf8_lossy(&bytes);
    let (_, body) = frontmatter::parse(&text);
    let body = body.trim();
    let args = args.trim();
    let mut rendered = match kind {
        SkillKind::Skill => {
            let folder = file.parent().unwrap_or(file);
            format!(
                "Base directory for this skill: {}\n\n{body}",
                folder.display()
            )
        }
        SkillKind::Command => body.replace(ARGUMENTS_PLACEHOLDER, args),
    };
    let has_placeholder = kind == SkillKind::Command && body.contains(ARGUMENTS_PLACEHOLDER);
    if !args.is_empty() && !has_placeholder {
        rendered.push_str("\n\nARGUMENTS: ");
        rendered.push_str(args);
    }
    Ok(rendered)
}

/// Ist der Text der Nachricht ein Aufruf `/name …` eines vorhandenen Skills oder Befehls, kommt
/// der Inhalt an die Stelle des Textes (bei Blöcken: des ersten Textblocks); sonst bleibt die
/// Nachricht, wie sie ist. Der Chat im Verwalter zeigt den getippten Text weiter — das ist Sache
/// der Registry.
pub fn expand_message(content: &Value, home: &Path, roots: &[(String, PathBuf)]) -> Value {
    let Some(text) = first_text(content) else {
        return content.clone();
    };
    if !text.trim_start().starts_with('/') {
        return content.clone();
    }
    let skills = skills::collect(home, roots);
    let Some(invoked) = skills::match_invocation(text, &skills) else {
        return content.clone();
    };
    let Some((kind, file)) = skills::find_file(home, roots, &invoked.name) else {
        return content.clone();
    };
    let args = text
        .trim_start()
        .strip_prefix('/')
        .and_then(|invocation: &str| invocation.strip_prefix(invoked.name.as_str()))
        .unwrap_or_default();
    match render(kind, &file, args) {
        Ok(rendered) => replace_first_text(content, rendered),
        Err(error) => {
            eprintln!("Skill {} nicht geladen: {error}", invoked.name);
            content.clone()
        }
    }
}

fn first_text(content: &Value) -> Option<&str> {
    match content {
        Value::String(text) => Some(text.as_str()),
        Value::Array(blocks) => blocks.iter().find_map(|block: &Value| {
            if block.get("type").and_then(Value::as_str) == Some(TEXT_BLOCK) {
                block.get("text").and_then(Value::as_str)
            } else {
                None
            }
        }),
        _ => None,
    }
}

fn replace_first_text(content: &Value, replacement: String) -> Value {
    let Value::Array(blocks) = content else {
        return Value::from(replacement);
    };
    let mut blocks = blocks.clone();
    let first_text_block = blocks.iter_mut().find(|block: &&mut Value| {
        block.get("type").and_then(Value::as_str) == Some(TEXT_BLOCK)
            && block.get("text").is_some_and(Value::is_string)
    });
    if let Some(block) = first_text_block {
        block["text"] = Value::from(replacement);
    }
    Value::Array(blocks)
}
