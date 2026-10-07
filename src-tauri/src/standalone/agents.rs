//! Typen von Subagenten für das Werkzeug `Agent`: eingebaut `general-purpose`, dazu die
//! Definitionen des Benutzers und der Repositories in `.claude\agents\*.md`.
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

use super::settings;
use crate::skills::frontmatter;

pub const DEFAULT_AGENT_TYPE: &str = "general-purpose";
const AGENTS_DIR: &str = "agents";
const DEFINITION_EXTENSION: &str = "md";
const NAME_KEY: &str = "name";
const DESCRIPTION_KEY: &str = "description";
const TOOLS_KEY: &str = "tools";
const TOOLS_SEPARATOR: char = ',';

const DEFAULT_DESCRIPTION: &str = "General-purpose agent for multi-step research and code changes.";
const DEFAULT_INSTRUCTIONS: &str = "You are a subagent. Complete the task you are given and finish \
     with a concise report of what you found or changed; your final message is returned to the main \
     agent.";

#[derive(Debug, Clone)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    /// Namen der erlaubten Werkzeuge; `None` = alle außer `Agent`.
    pub tools: Option<Vec<String>>,
    pub instructions: String,
}

/// Eingebaut zuerst, dann der Benutzer, dann Arbeitsordner und Repositories — ein späterer Eintrag
/// gleichen Namens ersetzt den früheren. `model` aus den Kopfdaten zählt nicht: es gibt nur das
/// geladene lokale Modell.
pub fn load(home: &Path, cwd: &Path, add_dirs: &[PathBuf]) -> Vec<AgentDefinition> {
    let mut definitions: Vec<AgentDefinition> = vec![AgentDefinition {
        name: DEFAULT_AGENT_TYPE.to_owned(),
        description: DEFAULT_DESCRIPTION.to_owned(),
        tools: None,
        instructions: DEFAULT_INSTRUCTIONS.to_owned(),
    }];
    let roots = [home, cwd]
        .into_iter()
        .chain(add_dirs.iter().map(PathBuf::as_path));
    for root in roots {
        for definition in read_folder(&root.join(settings::CLAUDE_DIR).join(AGENTS_DIR)) {
            definitions.retain(|known: &AgentDefinition| known.name != definition.name);
            definitions.push(definition);
        }
    }
    definitions
}

pub fn find<'a>(definitions: &'a [AgentDefinition], name: &str) -> Option<&'a AgentDefinition> {
    definitions
        .iter()
        .find(|definition: &&AgentDefinition| definition.name == name)
}

/// Die Dateien eines Ordners in Namensreihenfolge, damit das Ergebnis nicht vom Dateisystem abhängt.
fn read_folder(folder: &Path) -> Vec<AgentDefinition> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut files: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry: fs::DirEntry| entry.path())
        .filter(|path: &PathBuf| {
            path.is_file()
                && path.extension().is_some_and(|extension: &OsStr| {
                    extension.eq_ignore_ascii_case(DEFINITION_EXTENSION)
                })
        })
        .collect();
    files.sort();
    files
        .iter()
        .filter_map(|file: &PathBuf| read_definition(file))
        .collect()
}

fn read_definition(file: &Path) -> Option<AgentDefinition> {
    let text = fs::read_to_string(file).ok()?;
    let (values, body) = frontmatter::parse(&text);
    let name = values
        .get(NAME_KEY)
        .map(|name: &String| name.trim().to_owned())
        .filter(|name: &String| !name.is_empty())
        .or_else(|| Some(file.file_stem()?.to_string_lossy().into_owned()))?;
    let tools = values.get(TOOLS_KEY).map(|list: &String| {
        list.split(TOOLS_SEPARATOR)
            .map(str::trim)
            .filter(|tool: &&str| !tool.is_empty())
            .map(str::to_owned)
            .collect()
    });
    Some(AgentDefinition {
        name,
        description: values
            .get(DESCRIPTION_KEY)
            .map(|description: &String| description.trim().to_owned())
            .unwrap_or_default(),
        tools,
        instructions: body.trim().to_owned(),
    })
}
