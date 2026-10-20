//! Die Eingabe eines Turns: aus `message.content` der `user`-Zeile werden die Einträge für
//! `turn/start` — Text, `/name`-Aufrufe von Skills und Befehlen, Bilder.
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use crate::skills;
use crate::skills::model::{SkillInfo, SkillKind};
use crate::standalone::invocation;

const TEXT_BLOCK: &str = "text";
const IMAGE_BLOCK: &str = "image";
const DOCUMENT_BLOCK: &str = "document";
const SKILL_INPUT: &str = "skill";
const CODEX_DIR: &str = ".codex";
const SKILLS_DIR: &str = "skills";
const SKILL_FILE: &str = "SKILL.md";
/// Codex nimmt nur Bilder an; die PDF-Blöcke des Verwalters würden sonst stumm verschwinden.
const DOCUMENT_NOTE: &str = "[PDF-Anhang nicht übertragen: Codex nimmt nur Bilder an.]";

/// Einträge für `turn/start`. Ist der erste Text ein `/name …`, wird er ersetzt: ein Skill geht als
/// `skill`-Eintrag samt Argumenten, ein Befehl als gerenderter Text. Leere Textblöcke entfallen.
pub fn user_input(content: &Value, home: &Path, roots: &[(String, PathBuf)]) -> Vec<Value> {
    let mut entries: Vec<Value> = Vec::new();
    let mut is_first_text = true;
    for block in blocks_of(content) {
        match block.get("type").and_then(Value::as_str) {
            Some(TEXT_BLOCK) => {
                let text = block
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if is_first_text {
                    is_first_text = false;
                    entries.extend(invocation_entries(text, home, roots));
                } else if !text.trim().is_empty() {
                    entries.push(text_entry(text));
                }
            }
            Some(IMAGE_BLOCK) => entries.extend(image_entry(&block)),
            Some(DOCUMENT_BLOCK) => entries.push(text_entry(DOCUMENT_NOTE)),
            _ => {}
        }
    }
    entries
}

/// Die Blöcke der Nachricht; eine einfache Zeichenkette gilt als ein Textblock.
fn blocks_of(content: &Value) -> Vec<Value> {
    match content {
        Value::String(text) => vec![json!({ "type": TEXT_BLOCK, "text": text })],
        Value::Array(blocks) => blocks.clone(),
        _ => Vec::new(),
    }
}

fn text_entry(text: &str) -> Value {
    json!({ "type": "text", "text": text })
}

/// `data:<media_type>;base64,<data>` aus einem Bildblock des Verwalters.
fn image_entry(block: &Value) -> Option<Value> {
    let source = block.get("source")?;
    let media_type = source.get("media_type").and_then(Value::as_str)?;
    let data = source.get("data").and_then(Value::as_str)?;
    Some(json!({ "type": "image", "url": format!("data:{media_type};base64,{data}") }))
}

fn invocation_entries(text: &str, home: &Path, roots: &[(String, PathBuf)]) -> Vec<Value> {
    let plain = || {
        if text.trim().is_empty() {
            Vec::new()
        } else {
            vec![text_entry(text)]
        }
    };
    if !text.trim_start().starts_with('/') {
        return plain();
    }
    let known: Vec<SkillInfo> = skills::collect(home, roots);
    let Some(invoked) = skills::match_invocation(text, &known) else {
        return plain();
    };
    let Some((kind, file)) = skills::find_file(home, roots, &invoked.name) else {
        return plain();
    };
    let args = text
        .trim_start()
        .strip_prefix('/')
        .and_then(|invocation: &str| invocation.strip_prefix(invoked.name.as_str()))
        .unwrap_or_default()
        .trim();
    if kind == SkillKind::Skill
        && let Some(catalog_file) = codex_catalog_file(home, &invoked.name)
    {
        let mut entries = vec![json!({
            "type": SKILL_INPUT,
            "name": invoked.name,
            "path": catalog_file.to_string_lossy(),
        })];
        if !args.is_empty() {
            entries.push(text_entry(args));
        }
        return entries;
    }
    match invocation::render(kind, &file, args) {
        Ok(rendered) => vec![text_entry(&rendered)],
        Err(error) => {
            eprintln!("{} nicht geladen: {error}", invoked.name);
            plain()
        }
    }
}

/// Die `SKILL.md` im Katalog von Codex (`~/.codex/skills`), falls der Skill dorthin gespiegelt ist.
/// Codex spielt einen `skill`-Eintrag nur ein, wenn sein Pfad in diesem Katalog liegt — jeder andere
/// wird ohne Meldung verworfen. Skills aus Repositories und ungespiegelte gehen deshalb als Text.
fn codex_catalog_file(home: &Path, name: &str) -> Option<PathBuf> {
    let file = home
        .join(CODEX_DIR)
        .join(SKILLS_DIR)
        .join(name)
        .join(SKILL_FILE);
    file.is_file().then_some(file)
}
