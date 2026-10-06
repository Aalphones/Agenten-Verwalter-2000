//! `Skill`: lädt die Anweisungen eines Skills (oder Befehls) in den Verlauf.
use serde_json::Value;

use super::{ToolContext, optional_string, required_string};
use crate::skills;
use crate::skills::model::{SkillInfo, SkillKind};
use crate::standalone::invocation;

pub fn run(input: &Value, context: &ToolContext) -> Result<String, String> {
    let requested = required_string(input, "skill")?;
    let name = requested.trim().trim_start_matches('/');
    let args = optional_string(input, "args").unwrap_or_default();
    let Some((kind, file)) = skills::find_file(&context.home, &context.skill_roots, name) else {
        return Err(format!(
            "Skill nicht gefunden: {name}. Verfügbar: {}",
            available_names(context)
        ));
    };
    invocation::render(kind, &file, args)
}

/// Nur Skills — Befehle ruft der Benutzer auf, das Modell soll sie nicht von sich aus suchen.
fn available_names(context: &ToolContext) -> String {
    skills::collect(&context.home, &context.skill_roots)
        .into_iter()
        .filter(|skill: &SkillInfo| skill.kind == SkillKind::Skill)
        .map(|skill: SkillInfo| skill.name)
        .collect::<Vec<String>>()
        .join(", ")
}
