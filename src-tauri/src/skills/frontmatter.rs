//! Minimaler Leser für das YAML-Frontmatter von Skills und Befehlen. Kennt nur `schlüssel: wert`
//! auf oberster Ebene, dazu Blockwerte (`>`, `|`); Listen und verschachtelte Objekte werden ignoriert.
use std::collections::HashMap;

const DELIMITER: &str = "---";
const BYTE_ORDER_MARK: char = '\u{feff}';

/// Gibt die Schlüssel/Werte des Frontmatters und den Text danach zurück. Ohne Frontmatter ist
/// die Map leer und der ganze Text der Rest.
pub fn parse(text: &str) -> (HashMap<String, String>, &str) {
    let mut values: HashMap<String, String> = HashMap::new();
    let text_without_mark: &str = text.strip_prefix(BYTE_ORDER_MARK).unwrap_or(text);
    let mut lines = text_without_mark.split_inclusive('\n');
    let Some(first_line) = lines.next() else {
        return (values, text);
    };
    if first_line.trim_end() != DELIMITER {
        return (values, text);
    }
    let mut consumed: usize = first_line.len();
    let mut current_key: Option<String> = None;
    let mut is_closed = false;
    for line in lines {
        consumed += line.len();
        let content: &str = line.trim_end_matches(['\r', '\n']);
        if content.trim_end() == DELIMITER {
            is_closed = true;
            break;
        }
        let is_indented: bool = content.starts_with([' ', '\t']);
        if is_indented {
            append_continuation(&mut values, current_key.as_deref(), content.trim());
            continue;
        }
        current_key = read_entry(&mut values, content);
    }
    if !is_closed {
        return (HashMap::new(), text);
    }
    (values, &text_without_mark[consumed..])
}

/// Legt einen Eintrag der obersten Ebene an. Gibt den Schlüssel zurück, wenn er Folgezeilen
/// aufnehmen darf (Blockwert oder leerer Wert), sonst `None`.
fn read_entry(values: &mut HashMap<String, String>, line: &str) -> Option<String> {
    let (key, raw_value) = line.split_once(':')?;
    let key: &str = key.trim();
    if key.is_empty() || key.contains(char::is_whitespace) {
        return None;
    }
    let raw_value: &str = raw_value.trim();
    let takes_continuation: bool = matches!(raw_value, "" | ">" | ">-" | "|" | "|-");
    if takes_continuation {
        values.insert(key.to_owned(), String::new());
        return Some(key.to_owned());
    }
    values.insert(key.to_owned(), unquote(raw_value).to_owned());
    None
}

fn append_continuation(values: &mut HashMap<String, String>, key: Option<&str>, line: &str) {
    let Some(key) = key else {
        return;
    };
    if line.is_empty() {
        return;
    }
    let Some(value) = values.get_mut(key) else {
        return;
    };
    if !value.is_empty() {
        value.push(' ');
    }
    value.push_str(line);
}

fn unquote(value: &str) -> &str {
    for quote in ['"', '\''] {
        if let Some(inner) = value
            .strip_prefix(quote)
            .and_then(|rest: &str| rest.strip_suffix(quote))
        {
            return inner;
        }
    }
    value
}
