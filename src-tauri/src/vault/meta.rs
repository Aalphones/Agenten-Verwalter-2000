//! Metadaten eines Artefakts: ein kleiner Leser für den Teil von YAML, den Manifeste und
//! Frontmatter im Vault brauchen. Der Leser der Skills (`skills::frontmatter`) kennt keine Listen
//! und bleibt unberührt.

/// Die ausgewerteten Felder; fehlt eines, setzt `extract` den Standardwert ein.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Meta {
    pub title: Option<String>,
    pub description: Option<String>,
    pub kind: Option<String>,
    pub status: Option<String>,
    pub preview: Option<String>,
    pub entrypoint: Option<String>,
    /// Klein geschrieben, ohne Doppelte, in der Reihenfolge des ersten Auftretens.
    pub tags: Vec<String>,
}

const FRONTMATTER_FENCE: &str = "---";
const BOM: char = '\u{feff}';
/// Schlüssel, deren Werte alle in `tags` wandern.
const TAG_KEYS: [&str; 5] = ["tags", "aliases", "technologies", "platforms", "components"];

enum Value {
    Scalar(String),
    List(Vec<String>),
}

/// Liest die oberste Ebene eines YAML-Textes (siehe Plan Phase 3, AK 3).
pub fn parse_yaml(text: &str) -> Meta {
    let lines: Vec<&str> = text.lines().collect();
    let mut meta = Meta::default();
    let mut index: usize = 0;
    while index < lines.len() {
        let line: &str = lines[index];
        index += 1;
        let Some((key, raw_value)) = split_key(line) else {
            continue;
        };
        let (value, consumed) = read_value(raw_value, &lines[index..]);
        index += consumed;
        assign(&mut meta, key, value);
    }
    meta.tags = unique_lowercase(std::mem::take(&mut meta.tags));
    meta
}

/// Trennt `schlüssel: wert` einer Zeile ohne Einrückung; alles andere ist keine Schlüsselzeile.
fn split_key(line: &str) -> Option<(&str, &str)> {
    let first: char = line.chars().next()?;
    if first.is_whitespace() || first == '#' {
        return None;
    }
    let (key, rest) = line.split_once(':')?;
    let is_key: bool = !key.is_empty()
        && key
            .chars()
            .all(|letter: char| letter.is_alphanumeric() || letter == '_' || letter == '-');
    if !is_key {
        return None;
    }
    Some((key, rest.trim()))
}

/// Liest den Wert zu einem Schlüssel samt Folgezeilen; gibt ihn und die Zahl der verbrauchten
/// Folgezeilen zurück.
fn read_value(raw_value: &str, following: &[&str]) -> (Value, usize) {
    if raw_value.starts_with('>') || raw_value.starts_with('|') {
        let (body, consumed) = indented_block(following);
        let is_folded: bool = raw_value.starts_with('>');
        return (Value::Scalar(join_block(&body, is_folded)), consumed);
    }
    if raw_value.is_empty() {
        let (body, consumed) = indented_block(following);
        let items: Vec<String> = body
            .iter()
            .filter_map(|line: &&str| list_item(line))
            .collect();
        if items.is_empty() {
            return (Value::Scalar(String::new()), consumed);
        }
        return (Value::List(items), consumed);
    }
    if raw_value.starts_with('[') && raw_value.ends_with(']') {
        let inner: &str = &raw_value[1..raw_value.len() - 1];
        return (Value::List(split_list(inner)), 0);
    }
    (Value::Scalar(unquote(raw_value)), 0)
}

/// Die Folgezeilen bis zur nächsten nicht eingerückten, nicht leeren Zeile. Ein `- x` ohne
/// Einrückung gehört noch zum Schlüssel darüber (gängige Schreibweise von Listen).
fn indented_block<'a>(following: &[&'a str]) -> (Vec<&'a str>, usize) {
    let mut body: Vec<&'a str> = Vec::new();
    for line in following {
        let is_blank: bool = line.trim().is_empty();
        let is_indented: bool = line.starts_with([' ', '\t']);
        let is_bare_item: bool = line.starts_with("- ");
        if !is_blank && !is_indented && !is_bare_item {
            break;
        }
        body.push(line);
    }
    let consumed: usize = body.len();
    (body, consumed)
}

fn list_item(line: &str) -> Option<String> {
    let trimmed: &str = line.trim();
    let item: &str = trimmed.strip_prefix("- ")?;
    let value: String = unquote(item.trim());
    if value.is_empty() {
        return None;
    }
    Some(value)
}

fn join_block(body: &[&str], is_folded: bool) -> String {
    let lines: Vec<&str> = body.iter().map(|line: &&str| line.trim()).collect();
    if is_folded {
        let parts: Vec<&str> = lines
            .into_iter()
            .filter(|line: &&str| !line.is_empty())
            .collect();
        return parts.join(" ");
    }
    lines.join("\n").trim().to_owned()
}

fn split_list(inner: &str) -> Vec<String> {
    inner
        .split(',')
        .map(|part: &str| unquote(part.trim()))
        .filter(|part: &String| !part.is_empty())
        .collect()
}

fn unquote(value: &str) -> String {
    let trimmed: &str = value.trim();
    for quote in ['\'', '"'] {
        if trimmed.len() >= 2 && trimmed.starts_with(quote) && trimmed.ends_with(quote) {
            return trimmed[1..trimmed.len() - 1].to_owned();
        }
    }
    trimmed.to_owned()
}

fn assign(meta: &mut Meta, key: &str, value: Value) {
    if TAG_KEYS.contains(&key) {
        match value {
            Value::List(items) => meta.tags.extend(items),
            Value::Scalar(text) => meta.tags.extend(split_list(&text)),
        }
        return;
    }
    let text: String = match value {
        Value::Scalar(text) => text,
        Value::List(items) => items.join(", "),
    };
    if text.is_empty() {
        return;
    }
    match key {
        "title" => meta.title = Some(text),
        "description" => meta.description = Some(text),
        "summary" if meta.description.is_none() => meta.description = Some(text),
        "kind" => meta.kind = Some(text),
        "type" if meta.kind.is_none() => meta.kind = Some(text),
        "status" => meta.status = Some(text),
        "preview" => meta.preview = Some(text),
        "entrypoint" => meta.entrypoint = Some(text),
        _ => {}
    }
}

fn unique_lowercase(tags: Vec<String>) -> Vec<String> {
    let mut unique: Vec<String> = Vec::new();
    for tag in tags {
        let lowered: String = tag.trim().to_lowercase();
        if !lowered.is_empty() && !unique.contains(&lowered) {
            unique.push(lowered);
        }
    }
    unique
}

/// Trennt das Frontmatter eines Markdown-Textes ab: (YAML, Rest, Zahl der Zeilen vor dem Rest).
/// Ohne öffnende Zeile `---` am Anfang oder ohne schließende Zeile gibt es keines.
pub fn split_frontmatter(text: &str) -> (Option<&str>, &str, usize) {
    let text: &str = text.strip_prefix(BOM).unwrap_or(text);
    let mut lines = text.split_inclusive('\n');
    let Some(first) = lines.next() else {
        return (None, text, 0);
    };
    if first.trim_end() != FRONTMATTER_FENCE {
        return (None, text, 0);
    }
    let yaml_start: usize = first.len();
    let mut offset: usize = yaml_start;
    for (position, line) in lines.enumerate() {
        if line.trim_end() == FRONTMATTER_FENCE {
            let yaml: &str = &text[yaml_start..offset];
            let rest: &str = &text[offset + line.len()..];
            return (Some(yaml), rest, position + 2);
        }
        offset += line.len();
    }
    (None, text, 0)
}
