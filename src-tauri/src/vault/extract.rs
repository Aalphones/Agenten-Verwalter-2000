//! Was der Abgleich aus einer Datei macht: Dateiart, Abschnitte und Metadaten mit Standardwerten.
//! Reine Funktionen ohne Dateizugriff.
use std::collections::HashSet;

pub use crate::vault::index::SectionInput;
use crate::vault::meta::{self, Meta};

/// So viele Zeichen darf ein Abschnitt höchstens tragen.
const MAX_SECTION_CHARS: usize = 4000;
const MAX_DESCRIPTION_CHARS: usize = 300;
/// Anfang einer Datei, in dem ein NUL-Byte sie als binär ausweist.
const HEAD_PROBE_BYTES: usize = 8 * 1024;
const HTML_LINE_WIDTH: usize = 100;
const HEADING_SEPARATOR: &str = " › ";
const INBOX_PREFIX: &str = "inbox/";
const STATUS_INBOX: &str = "inbox";
const KIND_PACKAGE: &str = "package";
const ENTRYPOINT_HTML: &str = "index.html";
const ENTRYPOINT_README: &str = "README.md";
const PREVIEW_NAMES: [&str; 4] = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp"];

const MARKDOWN_EXTENSIONS: [&str; 3] = ["md", "markdown", "mdx"];
const WEB_EXTENSIONS: [&str; 2] = ["html", "htm"];
const IMAGE_EXTENSIONS: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
const CODE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "sql", "sh", "bash", "ps1", "psm1", "bat",
    "cmd", "go", "kt", "kts", "java", "cs", "c", "h", "cpp", "hpp", "swift", "rb", "php", "css",
    "scss", "less", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "xml", "vue", "svelte",
];
const TEXT_EXTENSIONS: [&str; 4] = ["txt", "log", "csv", "tsv"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileKind {
    Markdown,
    Code,
    Web,
    Image,
    Text,
    Binary,
}

impl FileKind {
    pub fn as_str(self) -> &'static str {
        match self {
            FileKind::Markdown => "markdown",
            FileKind::Code => "code",
            FileKind::Web => "web",
            FileKind::Image => "image",
            FileKind::Text => "text",
            FileKind::Binary => "binary",
        }
    }

    /// Ob der Inhalt dieser Art als Text in Abschnitte zerlegt wird.
    fn has_text(self) -> bool {
        !matches!(self, FileKind::Image | FileKind::Binary)
    }

    /// Standardart des Artefakts einer einzelnen Datei.
    fn default_artifact_kind(self) -> &'static str {
        match self {
            FileKind::Markdown | FileKind::Text => "note",
            FileKind::Code => "snippet",
            FileKind::Web => "web",
            FileKind::Image => "image",
            FileKind::Binary => "file",
        }
    }
}

/// Dateiart nach Endung; bei unbekannter Endung entscheidet der Anfang der Datei (`head`). Ohne
/// gelesenen Anfang (zu große Datei) gilt eine unbekannte Endung als binär.
pub fn file_kind(rel: &str, head: Option<&[u8]>) -> FileKind {
    let extension: String = file_name(rel)
        .rsplit_once('.')
        .map(|(_, extension): (&str, &str)| extension.to_lowercase())
        .unwrap_or_default();
    let extension: &str = extension.as_str();
    if MARKDOWN_EXTENSIONS.contains(&extension) {
        return FileKind::Markdown;
    }
    if WEB_EXTENSIONS.contains(&extension) {
        return FileKind::Web;
    }
    if IMAGE_EXTENSIONS.contains(&extension) {
        return FileKind::Image;
    }
    if CODE_EXTENSIONS.contains(&extension) {
        return FileKind::Code;
    }
    if TEXT_EXTENSIONS.contains(&extension) {
        return FileKind::Text;
    }
    match head {
        Some(bytes) if looks_like_text(bytes) => FileKind::Text,
        _ => FileKind::Binary,
    }
}

fn looks_like_text(bytes: &[u8]) -> bool {
    let head: &[u8] = &bytes[..bytes.len().min(HEAD_PROBE_BYTES)];
    if head.contains(&0) {
        return false;
    }
    match std::str::from_utf8(head) {
        Ok(_) => true,
        // Ein am Ende abgeschnittenes Zeichen ist kein Fehler der Datei.
        Err(error) => error.error_len().is_none(),
    }
}

pub fn file_name(rel: &str) -> &str {
    rel.rsplit('/').next().unwrap_or(rel)
}

fn file_stem(rel: &str) -> String {
    let name: &str = file_name(rel);
    match name.rsplit_once('.') {
        Some((stem, _)) if !stem.is_empty() => stem.to_owned(),
        _ => name.to_owned(),
    }
}

/// Der Dateiname mit Leerzeichen statt `-`, `_` und `.`, damit er als Wörter auffindbar ist.
fn name_as_words(rel: &str) -> String {
    file_name(rel).replace(['-', '_', '.'], " ")
}

// --- Abschnitte ------------------------------------------------------------------------------

/// Zerlegt eine Datei in Abschnitte. `text` ist `None`, wenn die Datei nicht gelesen wurde
/// (zu groß) oder kein Text ist; dann bleibt ein Abschnitt mit dem Dateinamen.
pub fn sections(kind: FileKind, rel: &str, text: Option<&str>) -> Vec<SectionInput> {
    let name_only = || {
        vec![SectionInput {
            heading: String::new(),
            line: 1,
            text: name_as_words(rel),
        }]
    };
    let Some(text) = text.filter(|_| kind.has_text()) else {
        return name_only();
    };
    let found: Vec<SectionInput> = match kind {
        FileKind::Markdown => markdown_sections(text),
        FileKind::Web => web_sections(text),
        _ => block_sections(text),
    };
    if found.is_empty() {
        return name_only();
    }
    found
}

type Line<'a> = (u32, &'a str);

fn numbered(text: &str, first_line: u32) -> Vec<Line<'_>> {
    text.lines()
        .enumerate()
        .map(|(position, line): (usize, &str)| (first_line + position as u32, line))
        .collect()
}

fn markdown_sections(text: &str) -> Vec<SectionInput> {
    let (_, body, skipped_lines) = meta::split_frontmatter(text);
    let lines: Vec<Line> = numbered(body, skipped_lines as u32 + 1);
    let mut found: Vec<SectionInput> = Vec::new();
    let mut path: Vec<(usize, String)> = Vec::new();
    let mut heading_line: Option<u32> = None;
    let mut current: Vec<Line> = Vec::new();
    let mut fence: Option<char> = None;
    for &(number, line) in &lines {
        fence = next_fence_state(fence, line);
        let heading: Option<(usize, String)> = match fence {
            None => parse_heading(line),
            Some(_) => None,
        };
        let Some((level, title)) = heading else {
            current.push((number, line));
            continue;
        };
        flush_markdown(&mut found, &path, heading_line, &current);
        current.clear();
        path.retain(|(existing, _): &(usize, String)| *existing < level);
        path.push((level, title));
        heading_line = Some(number);
    }
    flush_markdown(&mut found, &path, heading_line, &current);
    found
}

/// Schließt den laufenden Abschnitt ab. Text vor der ersten Überschrift ist ein Abschnitt ohne
/// Überschrift; eine Überschrift ohne Text bleibt als leerer Abschnitt auffindbar.
fn flush_markdown(
    found: &mut Vec<SectionInput>,
    path: &[(usize, String)],
    heading_line: Option<u32>,
    content: &[Line],
) {
    let heading: String = path
        .iter()
        .map(|(_, title): &(usize, String)| title.as_str())
        .collect::<Vec<&str>>()
        .join(HEADING_SEPARATOR);
    let mut parts: Vec<SectionInput> = split_oversized(&heading, content);
    if parts.is_empty() {
        let Some(line) = heading_line else {
            return;
        };
        parts.push(SectionInput {
            heading,
            line,
            text: String::new(),
        });
    } else if let (Some(line), Some(first)) = (heading_line, parts.first_mut()) {
        first.line = line;
    }
    found.extend(parts);
}

/// Zustand eines Code-Zauns nach dieser Zeile: `Some(Zeichen)` innerhalb, sonst `None`. Die
/// öffnende Zeile gilt schon als innerhalb.
fn next_fence_state(state: Option<char>, line: &str) -> Option<char> {
    let trimmed: &str = line.trim_start();
    let marker: Option<char> = if trimmed.starts_with("```") {
        Some('`')
    } else if trimmed.starts_with("~~~") {
        Some('~')
    } else {
        None
    };
    match (state, marker) {
        (None, Some(opening)) => Some(opening),
        (Some(opened), Some(closing)) if opened == closing => None,
        (current, _) => current,
    }
}

/// Eine Überschrift `#` bis `###`: Ebene und Text.
fn parse_heading(line: &str) -> Option<(usize, String)> {
    let level: usize = line
        .chars()
        .take_while(|letter: &char| *letter == '#')
        .count();
    if !(1..=3).contains(&level) {
        return None;
    }
    let rest: &str = line[level..].strip_prefix(' ')?;
    let title: &str = rest.trim().trim_end_matches('#').trim();
    if title.is_empty() {
        return None;
    }
    Some((level, title.to_owned()))
}

fn web_sections(html: &str) -> Vec<SectionInput> {
    let Some(plain) = html_to_text(html) else {
        return Vec::new();
    };
    split_oversized("", &numbered(&plain, 1))
}

fn html_to_text(html: &str) -> Option<String> {
    html2text::from_read(html.as_bytes(), HTML_LINE_WIDTH).ok()
}

/// Code und Text: jeder Block zwischen Leerzeilen ist ein Abschnitt.
fn block_sections(text: &str) -> Vec<SectionInput> {
    let mut found: Vec<SectionInput> = Vec::new();
    for block in blocks(&numbered(text, 1)) {
        found.extend(split_block("", &block));
    }
    found
}

/// Blöcke zwischen Leerzeilen; die Leerzeilen selbst fallen weg.
fn blocks<'a>(lines: &[Line<'a>]) -> Vec<Vec<Line<'a>>> {
    let mut found: Vec<Vec<Line<'a>>> = Vec::new();
    let mut current: Vec<Line<'a>> = Vec::new();
    for &line in lines {
        if line.1.trim().is_empty() {
            if !current.is_empty() {
                found.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(line);
    }
    if !current.is_empty() {
        found.push(current);
    }
    found
}

fn chars_of(block: &[Line]) -> usize {
    block
        .iter()
        .map(|(_, line): &Line| line.chars().count() + 1)
        .sum::<usize>()
}

/// Text mit Überschrift: bis 4000 Zeichen ein Abschnitt, Längeres wird an Leerzeilen geteilt.
fn split_oversized(heading: &str, content: &[Line]) -> Vec<SectionInput> {
    let trimmed: Vec<Line> = trim_blank_edges(content);
    if trimmed.is_empty() {
        return Vec::new();
    }
    if chars_of(&trimmed) <= MAX_SECTION_CHARS {
        return vec![SectionInput {
            heading: heading.to_owned(),
            line: trimmed[0].0,
            text: join_lines(&trimmed),
        }];
    }
    let mut pieces: Vec<Vec<Line>> = Vec::new();
    for block in blocks(&trimmed) {
        pieces.extend(split_by_lines(&block));
    }
    let packed: Vec<(u32, String)> = pack(&pieces);
    named_parts(heading, packed)
}

/// Ein einzelner Block, der über 4000 Zeichen reicht, wird an Zeilengrenzen geteilt.
fn split_block(heading: &str, block: &[Line]) -> Vec<SectionInput> {
    let pieces: Vec<Vec<Line>> = split_by_lines(block);
    let parts: Vec<(u32, String)> = pieces
        .iter()
        .map(|piece: &Vec<Line>| (piece[0].0, join_lines(piece)))
        .collect();
    named_parts(heading, parts)
}

/// Teilt an Zeilengrenzen in Stücke bis 4000 Zeichen; eine längere Zeile wird hart geschnitten.
fn split_by_lines<'a>(block: &[Line<'a>]) -> Vec<Vec<Line<'a>>> {
    if chars_of(block) <= MAX_SECTION_CHARS {
        return vec![block.to_vec()];
    }
    let mut pieces: Vec<Vec<Line<'a>>> = Vec::new();
    let mut current: Vec<Line<'a>> = Vec::new();
    for &(number, line) in block {
        let line_chars: usize = line.chars().count() + 1;
        if line_chars > MAX_SECTION_CHARS {
            if !current.is_empty() {
                pieces.push(std::mem::take(&mut current));
            }
            pieces.extend(hard_cut(number, line));
            continue;
        }
        if chars_of(&current) + line_chars > MAX_SECTION_CHARS {
            pieces.push(std::mem::take(&mut current));
        }
        current.push((number, line));
    }
    if !current.is_empty() {
        pieces.push(current);
    }
    pieces
}

fn hard_cut(number: u32, line: &str) -> Vec<Vec<Line<'_>>> {
    let letters: Vec<(usize, char)> = line.char_indices().collect();
    let step: usize = MAX_SECTION_CHARS - 1;
    let mut pieces: Vec<Vec<Line>> = Vec::new();
    let mut start: usize = 0;
    while start < letters.len() {
        let end: usize = (start + step).min(letters.len());
        let from: usize = letters[start].0;
        let to: usize = letters
            .get(end)
            .map_or(line.len(), |entry: &(usize, char)| entry.0);
        pieces.push(vec![(number, &line[from..to])]);
        start = end;
    }
    pieces
}

/// Packt Stücke der Reihe nach in Abschnitte bis 4000 Zeichen, getrennt durch eine Leerzeile.
fn pack(pieces: &[Vec<Line>]) -> Vec<(u32, String)> {
    let mut packed: Vec<(u32, String)> = Vec::new();
    for piece in pieces {
        let text: String = join_lines(piece);
        let fits: bool = packed.last().is_some_and(|(_, existing): &(u32, String)| {
            existing.chars().count() + 2 + text.chars().count() <= MAX_SECTION_CHARS
        });
        if fits {
            if let Some((_, existing)) = packed.last_mut() {
                existing.push_str("\n\n");
                existing.push_str(&text);
            }
            continue;
        }
        packed.push((piece[0].0, text));
    }
    packed
}

/// Mehrere Teile heißen „<Überschrift> (Teil n)“, ein einziger behält die Überschrift.
fn named_parts(heading: &str, parts: Vec<(u32, String)>) -> Vec<SectionInput> {
    let is_split: bool = parts.len() > 1;
    parts
        .into_iter()
        .enumerate()
        .map(|(position, (line, text)): (usize, (u32, String))| {
            let name: String = if !is_split {
                heading.to_owned()
            } else if heading.is_empty() {
                format!("Teil {}", position + 1)
            } else {
                format!("{heading} (Teil {})", position + 1)
            };
            SectionInput {
                heading: name,
                line,
                text,
            }
        })
        .collect()
}

fn trim_blank_edges<'a>(content: &[Line<'a>]) -> Vec<Line<'a>> {
    let start: usize = content
        .iter()
        .position(|(_, line): &Line| !line.trim().is_empty())
        .unwrap_or(content.len());
    let end: usize = content
        .iter()
        .rposition(|(_, line): &Line| !line.trim().is_empty())
        .map_or(start, |position: usize| position + 1);
    content[start..end].to_vec()
}

fn join_lines(lines: &[Line]) -> String {
    lines
        .iter()
        .map(|(_, line): &Line| *line)
        .collect::<Vec<&str>>()
        .join("\n")
}

// --- Metadaten -------------------------------------------------------------------------------

/// Metadaten einer einzelnen Datei als Artefakt: Frontmatter (Markdown) vor den Standardwerten.
pub fn file_meta(kind: FileKind, rel: &str, text: Option<&str>) -> Meta {
    let text: Option<&str> = text.filter(|_| kind.has_text());
    let mut found: Meta = Meta::default();
    let mut body: &str = text.unwrap_or("");
    if kind == FileKind::Markdown {
        let (yaml, rest, _) = meta::split_frontmatter(body);
        if let Some(yaml) = yaml {
            found = meta::parse_yaml(yaml);
        }
        body = rest;
    }
    let plain: Option<String> = match kind {
        FileKind::Web => html_to_text(body),
        _ => None,
    };
    let readable: &str = plain.as_deref().unwrap_or(body);
    if found.title.is_none() {
        found.title = Some(default_title(kind, rel, body));
    }
    if found.description.is_none() {
        found.description = first_paragraph(readable);
    }
    if found.kind.is_none() {
        found.kind = Some(kind.default_artifact_kind().to_owned());
    }
    finish(found, rel)
}

fn default_title(kind: FileKind, rel: &str, body: &str) -> String {
    let from_content: Option<String> = match kind {
        FileKind::Markdown => first_markdown_heading(body),
        FileKind::Web => html_title(body),
        _ => None,
    };
    from_content.unwrap_or_else(|| file_stem(rel))
}

fn first_markdown_heading(body: &str) -> Option<String> {
    let mut fence: Option<char> = None;
    for line in body.lines() {
        fence = next_fence_state(fence, line);
        if fence.is_some() {
            continue;
        }
        if let Some((1, title)) = parse_heading(line) {
            return Some(title);
        }
    }
    None
}

fn html_title(html: &str) -> Option<String> {
    let lowered: String = html.to_ascii_lowercase();
    let open: usize = lowered.find("<title")?;
    let content_start: usize = open + lowered[open..].find('>')? + 1;
    let content_end: usize = content_start + lowered[content_start..].find("</title>")?;
    let title: String = html[content_start..content_end]
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");
    if title.is_empty() {
        return None;
    }
    Some(title)
}

/// Erste zusammenhängende Textzeilen, die keine Überschrift sind (Code-Zäune werden übersprungen).
fn first_paragraph(text: &str) -> Option<String> {
    let mut paragraph: Vec<&str> = Vec::new();
    let mut fence: Option<char> = None;
    for line in text.lines() {
        fence = next_fence_state(fence, line);
        let trimmed: &str = line.trim();
        let is_fence_line: bool = trimmed.starts_with("```") || trimmed.starts_with("~~~");
        let is_skipped: bool = fence.is_some() || is_fence_line || parse_heading(line).is_some();
        if trimmed.is_empty() || is_skipped {
            if !paragraph.is_empty() {
                break;
            }
            continue;
        }
        paragraph.push(trimmed);
    }
    if paragraph.is_empty() {
        return None;
    }
    Some(paragraph.join(" "))
}

/// Metadaten eines Ordner-Artefakts. `existing_files` sind die Dateien des Ordners (relativ zum
/// Vault); `readme_text` ist die `README.md` im Ordner, wenn es sie gibt.
pub fn folder_meta(
    folder_rel: &str,
    manifest_text: &str,
    readme_text: Option<&str>,
    existing_files: &HashSet<String>,
) -> Meta {
    let mut found: Meta = meta::parse_yaml(manifest_text);
    if found.title.is_none() {
        found.title = Some(file_name(folder_rel).to_owned());
    }
    if found.description.is_none() {
        let (_, body, _) = meta::split_frontmatter(readme_text.unwrap_or(""));
        found.description = first_paragraph(body);
    }
    if found.kind.is_none() {
        found.kind = Some(KIND_PACKAGE.to_owned());
    }
    found.preview = match found.preview.take() {
        Some(name) => Some(in_folder(folder_rel, &name)),
        None => PREVIEW_NAMES
            .iter()
            .map(|name: &&str| in_folder(folder_rel, name))
            .find(|path: &String| existing_files.contains(path)),
    };
    found.entrypoint = match found.entrypoint.take() {
        Some(name) => Some(in_folder(folder_rel, &name)),
        None => [ENTRYPOINT_HTML, ENTRYPOINT_README]
            .iter()
            .map(|name: &&str| in_folder(folder_rel, name))
            .find(|path: &String| existing_files.contains(path)),
    };
    finish(found, folder_rel)
}

fn in_folder(folder_rel: &str, name: &str) -> String {
    format!("{folder_rel}/{}", name.trim_start_matches("./"))
}

/// Status-Standard und Kürzung der Beschreibung, gemeinsam für beide Arten von Artefakt.
fn finish(mut found: Meta, rel: &str) -> Meta {
    if found.status.is_none() && rel.starts_with(INBOX_PREFIX) {
        found.status = Some(STATUS_INBOX.to_owned());
    }
    found.description = found
        .description
        .map(|description: String| shorten(&description, MAX_DESCRIPTION_CHARS));
    found
}

/// Kürzt auf höchstens `limit` Zeichen an einer Wortgrenze und hängt `…` an.
fn shorten(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_owned();
    }
    let budget: usize = limit - 1;
    let cut: String = text.chars().take(budget).collect();
    let next_is_space: bool = text
        .chars()
        .nth(budget)
        .is_some_and(|letter: char| letter.is_whitespace());
    let kept: &str = if next_is_space {
        cut.as_str()
    } else {
        cut.rsplit_once(char::is_whitespace)
            .map_or(cut.as_str(), |(head, _): (&str, &str)| head)
    };
    format!("{}…", kept.trim_end())
}
