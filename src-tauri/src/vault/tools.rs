//! Werkzeuge des Developer Vault im MCP-Zugang (ADR 046, ADR 068): `vault_search` findet,
//! `vault_get` lädt. Gelesen wird nur, was der Index als Datei kennt — was `.gitignore`,
//! `.vaultignore` oder ein führender Punkt ausschließt, kommt hier nicht heraus.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use rusqlite::Connection;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

use super::index::{FileRow, VaultIndex};
use super::resolve::{Located, sentence};
use super::search::{
    self, MARK_END, MARK_START, VaultHit, VaultQuery, VaultSearchResult, escape_like,
};
use crate::db::Database;
use crate::filesystem::native_path;
use crate::mcp_access::tools::{ToolCall, ToolResult, ToolSet, ToolSpec};
use crate::settings;

const SEARCH: &str = "vault_search";
const GET: &str = "vault_get";

const SEARCH_DESCRIPTION: &str = "Durchsucht die Bibliothek des Benutzers: Wissen (Snippets, Rezepte, Ideen, Designs, Vorlagen, Skripte) und, falls vorhanden, Anweisungen, Memories, Skills, Befehle und Ausgabestile — nach Titel, Tags, Dateinamen und Text. Liefert kurze Treffer mit Pfad; Inhalte lädt vault_get.";
const GET_DESCRIPTION: &str = "Lädt aus der Bibliothek einen Abschnitt (path und line aus vault_search), eine Datei, die Dateiliste eines Ordners oder ein Bild.";
const UNAVAILABLE: &str =
    "Die Bibliothek ist nicht eingerichtet (Einstellungen → Skills & Umgebung → Bibliothek).";

const DEFAULT_LIMIT: u64 = 8;
const MAX_LIMIT: u64 = 20;
const MAX_IMAGE_BYTES: i64 = 5 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 20_000;
const MAX_SECTION_LINES: usize = 30;
const MAX_FOLDER_FILES: usize = 200;
const MAX_FOLDER_CHARS: usize = 8000;
const IMAGE_TYPES: [(&str, &str); 5] = [
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
];
const FOLDER_DOCS: [&str; 3] = ["manifest.yaml", "manifest.yml", "README.md"];
const KIND_BINARY: &str = "binary";
const KIND_IMAGE: &str = "image";

pub struct VaultTools;

impl ToolSet for VaultTools {
    fn prefix(&self) -> &'static str {
        "vault_"
    }

    fn tools(&self) -> Vec<ToolSpec> {
        vec![
            ToolSpec {
                name: SEARCH,
                description: SEARCH_DESCRIPTION,
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Suchtext; darf leer sein, dann kommen die zuletzt geänderten Artefakte."
                        },
                        "kind": { "type": "string", "description": "Art des Artefakts, z. B. snippet, note, skill, command, style, rules, memory." },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "Jeder Tag muss am Artefakt stehen."
                        },
                        "under": { "type": "string", "description": "Pfad-Präfix relativ zur Bibliothek, z. B. _vault oder skills." },
                        "limit": { "type": "integer", "minimum": 1, "maximum": 20, "description": "Höchstzahl der Treffer, Standard 8." }
                    },
                    "required": ["query"],
                    "additionalProperties": false
                }),
            },
            ToolSpec {
                name: GET,
                description: GET_DESCRIPTION,
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Pfad relativ zur Bibliothek: Datei oder Ordner." },
                        "line": { "type": "integer", "minimum": 1, "description": "Startzeile eines Abschnitts aus vault_search." }
                    },
                    "required": ["path"],
                    "additionalProperties": false
                }),
            },
        ]
    }

    fn call(&self, call: &ToolCall) -> ToolResult {
        let outcome: Result<ToolResult, String> = match call.name {
            SEARCH => run_search(call),
            GET => run_get(call),
            other => Err(format!("Unbekanntes Werkzeug: {other}")),
        };
        outcome.unwrap_or_else(ToolResult::Err)
    }

    fn offered(&self, app: &AppHandle) -> bool {
        let Some(database) = app.try_state::<Arc<Database>>() else {
            return false;
        };
        settings::load(&database)
            .is_ok_and(|loaded| loaded.vault_enabled && loaded.vault_dir.is_some())
    }

    fn unavailable_message(&self) -> &'static str {
        UNAVAILABLE
    }
}

// ---------------------------------------------------------------- vault_search

fn run_search(call: &ToolCall) -> Result<ToolResult, String> {
    let query: VaultQuery = parse_query(call.arguments)?;
    let result: VaultSearchResult = search::search(call.app, &query).map_err(sentence)?;
    let structured: Value = serde_json::to_value(&result).map_err(|error| error.to_string())?;
    Ok(ToolResult::Ok {
        text: format_result(&result),
        structured: Some(structured),
    })
}

fn parse_query(arguments: &Value) -> Result<VaultQuery, String> {
    let text: String = match arguments.get("query") {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Null) | None => return Err("query fehlt.".to_owned()),
        Some(_) => return Err("query muss ein Text sein.".to_owned()),
    };
    let limit: u64 = match arguments.get("limit") {
        None | Some(Value::Null) => DEFAULT_LIMIT,
        Some(value) => value
            .as_u64()
            .filter(|number: &u64| (1..=MAX_LIMIT).contains(number))
            .ok_or_else(|| format!("limit muss eine ganze Zahl von 1 bis {MAX_LIMIT} sein."))?,
    };
    Ok(VaultQuery {
        text,
        kind: optional_text(arguments, "kind")?,
        tags: optional_texts(arguments, "tags")?,
        under: optional_text(arguments, "under")?,
        limit: u32::try_from(limit).unwrap_or(8),
        any_term: false,
    })
}

fn optional_text(arguments: &Value, key: &str) -> Result<Option<String>, String> {
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => Ok(Some(text.clone())),
        Some(_) => Err(format!("{key} muss ein Text sein.")),
    }
}

fn optional_texts(arguments: &Value, key: &str) -> Result<Vec<String>, String> {
    let message: String = format!("{key} muss eine Liste von Texten sein.");
    match arguments.get(key) {
        None | Some(Value::Null) => Ok(Vec::new()),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item: &Value| {
                item.as_str()
                    .map(str::to_owned)
                    .ok_or_else(|| message.clone())
            })
            .collect(),
        Some(_) => Err(message),
    }
}

pub fn format_result(result: &VaultSearchResult) -> String {
    let mut text: String = format!("Treffer: {} von {}", result.hits.len(), result.total);
    if result.is_scanning {
        text.push_str(" · Index wird gerade aktualisiert");
    }
    for hit in &result.hits {
        text.push('\n');
        text.push_str(&format_hit(hit));
    }
    text
}

pub fn format_hit(hit: &VaultHit) -> String {
    let mut text: String = format!(
        "- {} · {} · {} — {}",
        hit.path, hit.kind, hit.title, hit.description
    );
    if !hit.heading.is_empty() || hit.line > 1 {
        let section: String = if hit.heading.is_empty() {
            String::new()
        } else {
            format!("Abschnitt „{}“, ", hit.heading)
        };
        text.push_str(&format!(
            " ({section}Zeile {}: vault_get path=\"{}\" line={})",
            hit.line, hit.file, hit.line
        ));
    }
    let snippet: String = hit
        .snippet
        .replace([MARK_START, MARK_END], "**")
        .trim()
        .to_owned();
    if !snippet.is_empty() {
        text.push_str("\n  ");
        text.push_str(&snippet.replace('\n', " "));
    }
    text
}

// ------------------------------------------------------------------- vault_get

/// Was ein Aufruf von `vault_get` braucht.
struct Target {
    root: PathBuf,
    index: Arc<VaultIndex>,
}

fn run_get(call: &ToolCall) -> Result<ToolResult, String> {
    let path: String = match call.arguments.get("path") {
        Some(Value::String(text)) => text.replace('\\', "/").trim_matches('/').to_owned(),
        None | Some(Value::Null) => return Err("path fehlt.".to_owned()),
        Some(_) => return Err("path muss ein Text sein.".to_owned()),
    };
    let line: Option<u32> = match call.arguments.get("line") {
        None | Some(Value::Null) => None,
        Some(value) => Some(
            value
                .as_u64()
                .filter(|number: &u64| *number >= 1)
                .and_then(|number: u64| u32::try_from(number).ok())
                .ok_or_else(|| "line muss eine ganze Zahl ab 1 sein.".to_owned())?,
        ),
    };
    let located: Located = super::resolve::locate(call.app, &path)?;
    let target = Target {
        root: located.root,
        index: located.index,
    };
    match located.row {
        Some(row) => get_file(&target, &row, line),
        None => get_folder(&target, &path),
    }
}

fn get_file(target: &Target, row: &FileRow, line: Option<u32>) -> Result<ToolResult, String> {
    if let Some(error) = &row.error {
        return Err(format!(
            "Diese Datei konnte nicht eingelesen werden: {error}"
        ));
    }
    let size_text: String = format_size(row.size);
    if row.kind == KIND_IMAGE {
        return get_image(target, row, &size_text);
    }
    if row.kind == KIND_BINARY {
        return Err(format!("Binärdatei ({size_text}) — nicht als Text lesbar."));
    }
    if let Some(start) = line {
        return get_section(target, row, start);
    }
    get_text(target, row)
}

fn get_image(target: &Target, row: &FileRow, size_text: &str) -> Result<ToolResult, String> {
    let extension: String = Path::new(&row.path)
        .extension()
        .map(|text| text.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime: Option<&str> = IMAGE_TYPES
        .iter()
        .find(|(known, _)| *known == extension)
        .map(|(_, mime)| *mime);
    let Some(mime_type) = mime else {
        return Err(format!("Binärdatei ({size_text}) — nicht als Text lesbar."));
    };
    if row.size > MAX_IMAGE_BYTES {
        return Err(format!(
            "Bild ({size_text}) — größer als 5 MiB, wird nicht geladen."
        ));
    }
    let bytes: Vec<u8> = fs::read(target.root.join(native_path(&row.path)))
        .map_err(|error| format!("Datei nicht lesbar: {error}"))?;
    Ok(ToolResult::Image {
        text: format!("{} ({size_text})", row.path),
        data: STANDARD.encode(bytes),
        mime_type: mime_type.to_owned(),
    })
}

/// Ein Bild des Vault als `data:`-Adresse für die Vorschau im Suchdialog; gleiche Prüfung und
/// gleiche Größengrenze wie `vault_get`.
pub fn image_data_url(app: &AppHandle, path: &str) -> Result<String, String> {
    let path: String = path.replace('\\', "/").trim_matches('/').to_owned();
    let located: Located = super::resolve::locate(app, &path)?;
    let row: FileRow = located
        .row
        .ok_or_else(|| format!("Nicht im Vault-Index: {path}."))?;
    if let Some(error) = &row.error {
        return Err(format!(
            "Diese Datei konnte nicht eingelesen werden: {error}"
        ));
    }
    let extension: String = Path::new(&row.path)
        .extension()
        .map(|text| text.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime: &str = IMAGE_TYPES
        .iter()
        .find(|(known, _)| *known == extension)
        .map(|(_, mime)| *mime)
        .ok_or_else(|| "Kein Bild.".to_owned())?;
    if row.size > MAX_IMAGE_BYTES {
        return Err(format!(
            "Bild ({}) — größer als 5 MiB, wird nicht geladen.",
            format_size(row.size)
        ));
    }
    let bytes: Vec<u8> = fs::read(located.root.join(native_path(&row.path)))
        .map_err(|error| format!("Datei nicht lesbar: {error}"))?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

struct SectionRow {
    heading: String,
    line: u32,
    text: String,
}

fn sections_of(target: &Target, file: &str) -> Result<Vec<SectionRow>, String> {
    target
        .index
        .with(|connection: &mut Connection| {
            let mut statement = connection.prepare(
                "SELECT heading, line, text FROM sections WHERE file = ?1 ORDER BY ordinal",
            )?;
            let rows: Vec<SectionRow> = statement
                .query_map([file], |row| {
                    Ok(SectionRow {
                        heading: row.get(0)?,
                        line: row.get(1)?,
                        text: row.get(2)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<SectionRow>>>()?;
            Ok(rows)
        })
        .map_err(sentence)
}

fn get_section(target: &Target, row: &FileRow, start: u32) -> Result<ToolResult, String> {
    let sections: Vec<SectionRow> = sections_of(target, &row.path)?;
    let exact: Option<&SectionRow> = sections
        .iter()
        .find(|part: &&SectionRow| part.line == start);
    let before: Option<&SectionRow> = sections
        .iter()
        .filter(|part: &&SectionRow| part.line <= start)
        .max_by_key(|part: &&SectionRow| part.line);
    let Some(section) = exact.or(before).or(sections.first()) else {
        return Err(format!("{} hat keine Abschnitte.", row.path));
    };
    let head: String = if section.heading.is_empty() {
        format!("{} · ab Zeile {}", row.path, section.line)
    } else {
        format!(
            "{} · {} · ab Zeile {}",
            row.path, section.heading, section.line
        )
    };
    Ok(plain(format!("{head}\n\n{}", section.text)))
}

fn get_text(target: &Target, row: &FileRow) -> Result<ToolResult, String> {
    let bytes: Vec<u8> = fs::read(target.root.join(native_path(&row.path)))
        .map_err(|error| format!("Datei nicht lesbar: {error}"))?;
    let content: String = String::from_utf8_lossy(&bytes).into_owned();
    let total: usize = content.chars().count();
    if total <= MAX_TEXT_CHARS {
        return Ok(plain(content));
    }
    let mut text: String = content.chars().take(MAX_TEXT_CHARS).collect();
    text.push_str(&format!(
        "\n\n… gekürzt ({total} Zeichen). Abschnitte mit line laden:"
    ));
    for section in sections_of(target, &row.path)?
        .iter()
        .take(MAX_SECTION_LINES)
    {
        text.push_str(&format!("\nZeile {}: {}", section.line, section.heading));
    }
    Ok(plain(text))
}

fn get_folder(target: &Target, folder: &str) -> Result<ToolResult, String> {
    let prefix: String = if folder.is_empty() {
        String::new()
    } else {
        format!("{folder}/")
    };
    let rows: Vec<(String, String, i64)> = target
        .index
        .with(|connection: &mut Connection| {
            let mut statement = connection.prepare(
                "SELECT path, kind, size FROM files
                 WHERE path LIKE ?1 ESCAPE '\\' AND error IS NULL ORDER BY path",
            )?;
            let rows = statement
                .query_map([format!("{}%", escape_like(&prefix))], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                })?
                .collect::<rusqlite::Result<Vec<(String, String, i64)>>>()?;
            Ok(rows)
        })
        .map_err(sentence)?;
    if rows.is_empty() {
        return Err(format!(
            "Nicht im Vault-Index: {folder}. Pfade liefert vault_search."
        ));
    }
    let label: &str = if folder.is_empty() {
        "(Wurzel)"
    } else {
        folder
    };
    let mut text: String = format!("{label} · {} Dateien", rows.len());
    for (path, kind, size) in rows.iter().take(MAX_FOLDER_FILES) {
        let relative: &str = path.strip_prefix(&prefix).unwrap_or(path);
        text.push_str(&format!("\n{relative} · {kind} · {}", format_size(*size)));
    }
    if rows.len() > MAX_FOLDER_FILES {
        text.push_str(&format!("\n… {} weitere", rows.len() - MAX_FOLDER_FILES));
    }
    for name in FOLDER_DOCS {
        let doc_path: String = format!("{prefix}{name}");
        if !rows.iter().any(|(path, _, _)| *path == doc_path) {
            continue;
        }
        if let Ok(content) = fs::read_to_string(target.root.join(native_path(&doc_path))) {
            text.push_str(&format!("\n\n--- {name} ---\n{content}"));
        }
    }
    Ok(plain(truncate_chars(&text, MAX_FOLDER_CHARS)))
}

fn plain(text: String) -> ToolResult {
    ToolResult::Ok {
        text,
        structured: None,
    }
}

fn truncate_chars(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_owned();
    }
    let mut cut: String = text.chars().take(limit).collect();
    cut.push('…');
    cut
}

fn format_size(bytes: i64) -> String {
    const KIB: f64 = 1024.0;
    let size: f64 = bytes.max(0) as f64;
    if size < KIB {
        return format!("{bytes} B");
    }
    if size < KIB * KIB {
        return format!("{:.1} KiB", size / KIB);
    }
    format!("{:.1} MiB", size / (KIB * KIB))
}
