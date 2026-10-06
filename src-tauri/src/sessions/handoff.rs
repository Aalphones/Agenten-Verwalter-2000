//! Die Einstiegszeile am Ende einer Agenten-Antwort (ADR 027).

const HANDOFF_PREFIX: &str = "Weiter:";
const HANDOFF_WINDOW: usize = 5;
const CODE_FENCE: &str = "```";

/// Die Einstiegszeile am Ende einer Antwort (ADR 027); `None`, wenn keine der letzten fünf nicht
/// leeren Zeilen mit „Weiter:“ beginnt.
pub fn handoff_line(text: &str) -> Option<String> {
    let counted_lines = text
        .lines()
        .rev()
        .map(str::trim)
        .filter(|line: &&str| !line.is_empty() && !line.starts_with(CODE_FENCE))
        .take(HANDOFF_WINDOW);
    for line in counted_lines {
        let cleaned = clean(line);
        if cleaned.starts_with(HANDOFF_PREFIX) && cleaned.chars().count() > HANDOFF_PREFIX.len() + 1
        {
            return Some(cleaned);
        }
    }
    None
}

/// Entfernt Zitat-Zeichen, Fettdruck und Backticks um die Zeile.
fn clean(line: &str) -> String {
    let unquoted = line
        .strip_prefix('>')
        .map_or(line, |rest: &str| rest.trim_start());
    let without_bold = unquoted.replace("**", "");
    without_bold.trim().trim_matches('`').trim().to_owned()
}
