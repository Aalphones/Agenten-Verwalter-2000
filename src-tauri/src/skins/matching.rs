//! Welches Fach einen Werkzeug-Aufruf fängt (ADR 065). Gegenstück zu `matchSlot.ts` und
//! `BUILTIN_TOOL_SLOTS` in `slotCatalog.ts`: gleiche Regeln, damit `skin_tool_usage` dem Agenten
//! zeigt, was die Statuszeile tatsächlich tut.
use regex::{Regex, RegexBuilder};

use super::model::{BuiltinSlot, CustomSlot, FiguresData};
use crate::db::enum_to_text;

/// Werkzeugname → Fach; jedes Werkzeug ohne Eintrag gehört ins Fach „Sonstiges“.
const BUILTIN_TOOL_SLOTS: [(&str, BuiltinSlot); 12] = [
    ("Grep", BuiltinSlot::Search),
    ("Glob", BuiltinSlot::Search),
    ("Read", BuiltinSlot::Read),
    ("Edit", BuiltinSlot::Write),
    ("Write", BuiltinSlot::Write),
    ("NotebookEdit", BuiltinSlot::Write),
    ("Bash", BuiltinSlot::Shell),
    ("PowerShell", BuiltinSlot::Shell),
    ("WebSearch", BuiltinSlot::Web),
    ("WebFetch", BuiltinSlot::Web),
    ("Agent", BuiltinSlot::Agent),
    ("Task", BuiltinSlot::Agent),
];

/// `*` steht für beliebig viele Zeichen, `?` für eines; Groß-/Kleinschreibung zählt nicht.
fn glob_to_regex(pattern: &str) -> Option<Regex> {
    let mut source = String::from("^");
    for character in pattern.chars() {
        match character {
            '*' => source.push_str(".*"),
            '?' => source.push('.'),
            other => source.push_str(&regex::escape(&other.to_string())),
        }
    }
    source.push('$');
    RegexBuilder::new(&source)
        .case_insensitive(true)
        .build()
        .ok()
}

/// Passt `text` auf mindestens eines der durch Komma getrennten Muster? Leere Teile zählen nicht.
pub fn matches_any(patterns: &str, text: &str) -> bool {
    patterns
        .split(',')
        .map(str::trim)
        .filter(|pattern: &&str| !pattern.is_empty())
        .filter_map(glob_to_regex)
        .any(|regex: Regex| regex.is_match(text))
}

fn matches_custom(slot: &CustomSlot, tool: &str, target: &str) -> bool {
    if !matches_any(&slot.tools, tool) {
        return false;
    }
    match &slot.input {
        Some(input) => matches_any(input, target),
        None => true,
    }
}

/// Das eingebaute Fach eines Werkzeugs.
pub fn builtin_slot_of(tool: &str) -> BuiltinSlot {
    BUILTIN_TOOL_SLOTS
        .iter()
        .find(|(name, _): &&(&str, BuiltinSlot)| *name == tool)
        .map_or(BuiltinSlot::Other, |(_, slot): &(&str, BuiltinSlot)| *slot)
}

/// Das Fach eines Aufrufs: die ID des ersten passenden eigenen Fachs, sonst der Name des
/// eingebauten Fachs.
pub fn slot_for(tool: &str, target: &str, figures: Option<&FiguresData>) -> String {
    if let Some(data) = figures
        && let Some(slot) = data
            .custom
            .iter()
            .find(|slot: &&CustomSlot| matches_custom(slot, tool, target))
    {
        return slot.id.clone();
    }
    enum_to_text(&builtin_slot_of(tool)).unwrap_or_else(|_| "other".to_owned())
}
