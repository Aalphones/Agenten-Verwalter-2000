//! Die MCP-Konfigurationsdateien einer Session, gelesen ohne laufenden Agenten (ADR 070):
//! Benutzer und „nur ich, in diesem Vorhaben“ aus `~/.claude.json`, je Repository dessen
//! `.mcp.json` und, falls vorhanden, die des Workspace. `load` liest nur und legt nichts an;
//! `save`, `remove` und die Aus-Listen schreiben jeweils nur den betroffenen Knoten (`rewrite`).
//!
//! Die rohen Server-Objekte enthalten Zugangsdaten. Sie bleiben in `LoadedConfig` — ohne `Debug` —
//! und verlassen das Modul nur maskiert (`sources`) oder als Hash (`fingerprint`).
use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde_json::{Map, Value, json};

use crate::error::CommandError;
use crate::mcp::model::{
    McpConfigEntry, McpDraft, McpPair, McpPairDraft, McpSource, McpSourceKind, McpTransport,
};
use crate::standalone::mcp::config::{
    ReadFailure, folder_key, is_variable_reference, project_entries, try_read_json,
};

const USER_CONFIG_FILE: &str = ".claude.json";
const PROJECTS_KEY: &str = "projects";
const MAX_NAME_CHARS: usize = 64;
const PROJECT_CONFIG_FILE: &str = ".mcp.json";
const SERVERS_KEY: &str = "mcpServers";
const DISABLED_SERVERS_KEY: &str = "disabledMcpServers";
const DISABLED_PROJECT_SERVERS_KEY: &str = "disabledMcpjsonServers";

const USER_SOURCE_ID: &str = "user";
const LOCAL_SOURCE_ID: &str = "local";
const WORKSPACE_SOURCE_ID: &str = "workspace";
const REPOSITORY_SOURCE_PREFIX: &str = "repo:";

const ERROR_UNREADABLE: &str = "Datei ist nicht lesbar.";
const ERROR_INVALID_JSON: &str = "Datei ist kein gültiges JSON.";
const ERROR_NO_OBJECT: &str = "Datei enthält kein JSON-Objekt.";

struct LoadedSource {
    id: String,
    kind: McpSourceKind,
    label: String,
    file: String,
    servers: Map<String, Value>,
    error: Option<&'static str>,
}

/// Der Stand aller Quellen eines Lesevorgangs, in der Reihenfolge der Anzeige.
pub struct LoadedConfig {
    sources: Vec<LoadedSource>,
    /// `disabledMcpServers` des Workspace: gilt für Server jeder Quelle.
    disabled: HashSet<String>,
    /// `disabledMcpjsonServers` des Workspace: gilt nur für dessen `.mcp.json`.
    disabled_workspace: HashSet<String>,
}

/// `repositories`: Name und Arbeitsordner in der Reihenfolge der Session.
pub fn load(home: &Path, workspace: &Path, repositories: &[(String, PathBuf)]) -> LoadedConfig {
    let (user_config, user_error) = read_object(&home.join(USER_CONFIG_FILE));
    let user_config = Value::Object(user_config.unwrap_or_default());
    let user_file = display_path(home, &home.join(USER_CONFIG_FILE));
    let entries = project_entries(&user_config, workspace);

    let mut sources = vec![LoadedSource {
        id: USER_SOURCE_ID.to_owned(),
        kind: McpSourceKind::User,
        label: String::new(),
        file: user_file.clone(),
        servers: servers_of(user_config.get(SERVERS_KEY)),
        error: user_error,
    }];
    for (name, folder) in repositories {
        let (config, error) = read_object(&folder.join(PROJECT_CONFIG_FILE));
        // Auch ohne Datei eine Quelle: sie ist ein Ziel für neue Server.
        sources.push(LoadedSource {
            id: format!("{REPOSITORY_SOURCE_PREFIX}{name}"),
            kind: McpSourceKind::Repository,
            label: name.clone(),
            file: format!("{name}/{PROJECT_CONFIG_FILE}"),
            servers: servers_of(config.unwrap_or_default().get(SERVERS_KEY)),
            error,
        });
    }
    let workspace_file = workspace.join(PROJECT_CONFIG_FILE);
    let (config, error) = read_object(&workspace_file);
    if config.is_some() || error.is_some() {
        sources.push(LoadedSource {
            id: WORKSPACE_SOURCE_ID.to_owned(),
            kind: McpSourceKind::Workspace,
            label: String::new(),
            file: display_path(home, &workspace_file),
            servers: servers_of(config.unwrap_or_default().get(SERVERS_KEY)),
            error,
        });
    }
    // Mehrere Schreibweisen desselben Ordners: je Name gewinnt der erste Eintrag, wie beim
    // autarken Agenten.
    let mut local_servers = Map::new();
    for entry in &entries {
        for (name, server) in servers_of(entry.get(SERVERS_KEY)) {
            local_servers.entry(name).or_insert(server);
        }
    }
    sources.push(LoadedSource {
        id: LOCAL_SOURCE_ID.to_owned(),
        kind: McpSourceKind::Local,
        label: String::new(),
        file: user_file,
        servers: local_servers,
        error: user_error,
    });

    LoadedConfig {
        sources,
        disabled: names_in(&entries, DISABLED_SERVERS_KEY),
        disabled_workspace: names_in(&entries, DISABLED_PROJECT_SERVERS_KEY),
    }
}

impl LoadedConfig {
    /// Die Quellen für die Oberfläche: Zugangsdaten maskiert, mit Aus-Zustand und Überdeckung.
    pub fn sources(&self) -> Vec<McpSource> {
        let winners = self.winners();
        self.sources
            .iter()
            .map(|source: &LoadedSource| McpSource {
                id: source.id.clone(),
                kind: source.kind,
                label: source.label.clone(),
                file: source.file.clone(),
                servers: source
                    .servers
                    .iter()
                    .map(|(name, server): (&String, &Value)| {
                        let mut entry = config_entry(name, server);
                        entry.enabled = !self.is_disabled(source.kind, name);
                        entry.shadowed_by = winners
                            .get(name.as_str())
                            .filter(|winner: &&&str| **winner != source.id)
                            .map(|winner: &&str| (*winner).to_owned());
                        entry
                    })
                    .collect(),
                error: source.error.map(str::to_owned),
            })
            .collect()
    }

    /// Hash über die rohen Server-Objekte samt Werten, ohne die Aus-Listen. Die Reihenfolge der
    /// Schlüssel zählt nicht: die Kommandozeile schreibt `~/.claude.json` neu, ohne dass sich ein
    /// Server ändert. Nur innerhalb eines App-Laufs vergleichbar.
    pub fn fingerprint(&self) -> u64 {
        let mut hasher = DefaultHasher::new();
        for source in &self.sources {
            let mut names: Vec<&String> = source.servers.keys().collect();
            names.sort();
            for name in names {
                source.id.hash(&mut hasher);
                name.hash(&mut hasher);
                hash_value(&source.servers[name], &mut hasher);
            }
        }
        hasher.finish()
    }

    /// Je Servername die ID der Quelle, die gewinnt: nur ich vor Repository (in Reihenfolge der
    /// Session) vor Workspace vor Benutzer.
    fn winners(&self) -> HashMap<&str, &str> {
        let mut ranked: Vec<&LoadedSource> = self.sources.iter().collect();
        // Stabil: Repositories behalten untereinander ihre Reihenfolge.
        ranked.sort_by_key(|source: &&LoadedSource| rank(source.kind));
        let mut winners: HashMap<&str, &str> = HashMap::new();
        for source in ranked {
            for name in source.servers.keys() {
                winners.entry(name).or_insert(&source.id);
            }
        }
        winners
    }

    fn is_disabled(&self, kind: McpSourceKind, name: &str) -> bool {
        self.disabled.contains(name)
            || (kind == McpSourceKind::Workspace && self.disabled_workspace.contains(name))
    }
}

/// Legt einen Server an oder ersetzt einen (`original_name`, auch zum Umbenennen). Nicht
/// angefasste Felder des bearbeiteten Eintrags bleiben stehen.
pub fn save(
    home: &Path,
    workspace: &Path,
    repositories: &[(String, PathBuf)],
    draft: &McpDraft,
) -> Result<(), CommandError> {
    validate(draft)?;
    if draft.original_name.is_none() && draft.source_id == WORKSPACE_SOURCE_ID {
        return Err(invalid(
            "In die Datei des Vorhaben-Ordners lässt sich nichts Neues eintragen.",
        ));
    }
    let target = locate(home, repositories, workspace, &draft.source_id)?;
    let is_new = draft.original_name.is_none();
    rewrite(&target.file, |root: &mut Value| {
        let maps = server_maps_mut(root, &target.node, workspace, is_new)?;
        let original = draft.original_name.as_deref();
        // Beim Bearbeiten gilt die Map, in der der Eintrag steht; ein Neuer geht in die erste.
        let servers = maps
            .into_iter()
            .find(|servers: &&mut Map<String, Value>| {
                original.is_none_or(|name: &str| servers.contains_key(name))
            })
            .ok_or_else(|| {
                invalid(format!(
                    "Der Server {} ist in dieser Quelle nicht mehr vorhanden.",
                    original.unwrap_or_default()
                ))
            })?;
        replace_server(servers, draft)?;
        Ok(true)
    })
}

/// Entfernt genau den Eintrag; fehlt er, passiert nichts. Eine leere `mcpServers`-Liste bleibt
/// in der Datei stehen.
pub fn remove(
    home: &Path,
    workspace: &Path,
    repositories: &[(String, PathBuf)],
    source_id: &str,
    name: &str,
) -> Result<(), CommandError> {
    let target = locate(home, repositories, workspace, source_id)?;
    rewrite(&target.file, |root: &mut Value| {
        let mut changed = false;
        for servers in server_maps_mut(root, &target.node, workspace, false)? {
            changed |= servers.shift_remove(name).is_some();
        }
        Ok(changed)
    })
}

/// Trägt die Namen in `disabledMcpServers` des Workspace ein oder nimmt sie heraus. Ohne
/// Eintrag für den Ordner entsteht beim Ausschalten ein neuer unter dem Pfad mit `/`.
pub fn set_disabled_for_workspace(
    home: &Path,
    workspace: &Path,
    names: &[String],
    is_disabled: bool,
) -> Result<(), CommandError> {
    if names.is_empty() {
        return Ok(());
    }
    rewrite(&home.join(USER_CONFIG_FILE), |root: &mut Value| {
        let mut changed = false;
        for node in project_nodes_mut(root, workspace, is_disabled)? {
            changed |= update_disabled(node, names, is_disabled)?;
        }
        Ok(changed)
    })
}

/// Nimmt die Namen aus `disabledMcpServers` aller Ordner unter `workspace_root`, außer dem von
/// `keep`.
pub fn clear_disabled_under(
    home: &Path,
    workspace_root: &Path,
    names: &[String],
    keep: Option<&Path>,
) -> Result<(), CommandError> {
    if names.is_empty() {
        return Ok(());
    }
    let prefix = format!("{}/", folder_key(workspace_root));
    let kept = keep.map(folder_key);
    rewrite(&home.join(USER_CONFIG_FILE), |root: &mut Value| {
        let Some(projects) = projects_mut(root, false)? else {
            return Ok(false);
        };
        let mut changed = false;
        for (key, node) in projects.iter_mut() {
            let folder = folder_key(Path::new(key.as_str()));
            if !folder.starts_with(&prefix) || kept.as_ref() == Some(&folder) {
                continue;
            }
            if let Some(object) = node.as_object_mut() {
                changed |= update_disabled(object, names, false)?;
            }
        }
        Ok(changed)
    })
}

/// Wo in einer Datei die Server einer Quelle stehen.
enum ServersNode {
    /// `mcpServers` an der Wurzel.
    Root,
    /// `projects[<Workspace>].mcpServers` in `~/.claude.json`.
    Project,
}

struct Target {
    file: PathBuf,
    node: ServersNode,
}

fn locate(
    home: &Path,
    repositories: &[(String, PathBuf)],
    workspace: &Path,
    source_id: &str,
) -> Result<Target, CommandError> {
    let root_in = |file: PathBuf| Target {
        file,
        node: ServersNode::Root,
    };
    match source_id {
        USER_SOURCE_ID => Ok(root_in(home.join(USER_CONFIG_FILE))),
        LOCAL_SOURCE_ID => Ok(Target {
            file: home.join(USER_CONFIG_FILE),
            node: ServersNode::Project,
        }),
        WORKSPACE_SOURCE_ID => Ok(root_in(workspace.join(PROJECT_CONFIG_FILE))),
        other => other
            .strip_prefix(REPOSITORY_SOURCE_PREFIX)
            .and_then(|name: &str| {
                repositories
                    .iter()
                    .find(|(repository, _): &&(String, PathBuf)| repository == name)
            })
            .map(|(_, folder): &(String, PathBuf)| root_in(folder.join(PROJECT_CONFIG_FILE)))
            .ok_or_else(|| invalid("Die Quelle gehört nicht zu dieser Session.")),
    }
}

fn invalid(sentence: impl Into<String>) -> CommandError {
    CommandError::Invalid(sentence.into())
}

fn validate(draft: &McpDraft) -> Result<(), CommandError> {
    let is_name_valid = !draft.name.is_empty()
        && draft.name.chars().count() <= MAX_NAME_CHARS
        && draft.name.chars().all(|character: char| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        });
    if !is_name_valid {
        return Err(invalid(
            "Der Name darf nur Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich enthalten und höchstens 64 Zeichen lang sein.",
        ));
    }
    match draft.transport {
        McpTransport::Stdio => {
            let command = draft.command.as_deref().unwrap_or_default().trim();
            if command.is_empty() {
                return Err(invalid("Der Befehl fehlt."));
            }
        }
        McpTransport::Http | McpTransport::Sse => {
            let url = draft.url.as_deref().unwrap_or_default().trim();
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(invalid(
                    "Die Adresse muss mit http:// oder https:// beginnen.",
                ));
            }
        }
        McpTransport::Other => {
            return Err(invalid("Diese Art von Server lässt sich nicht eintragen."));
        }
    }
    Ok(())
}

/// Die `mcpServers`-Objekte der Quelle. Mit `create` genau eines, bei Bedarf neu angelegt;
/// ohne nur die vorhandenen (`~/.claude.json` kann denselben Ordner unter mehreren Schlüsseln
/// führen).
fn server_maps_mut<'a>(
    root: &'a mut Value,
    node: &ServersNode,
    workspace: &Path,
    create: bool,
) -> Result<Vec<&'a mut Map<String, Value>>, CommandError> {
    let mut containers: Vec<&mut Map<String, Value>> = match node {
        ServersNode::Root => vec![
            root.as_object_mut()
                .ok_or_else(|| invalid(ERROR_NO_OBJECT))?,
        ],
        ServersNode::Project => project_nodes_mut(root, workspace, create)?,
    };
    if create {
        containers.truncate(1);
    }
    let mut maps: Vec<&mut Map<String, Value>> = Vec::new();
    for container in containers {
        if !container.contains_key(SERVERS_KEY) {
            if !create {
                continue;
            }
            container.insert(SERVERS_KEY.to_owned(), Value::Object(Map::new()));
        }
        let servers = container
            .get_mut(SERVERS_KEY)
            .and_then(Value::as_object_mut)
            .ok_or_else(|| invalid("mcpServers in der Datei ist kein Objekt."))?;
        maps.push(servers);
    }
    Ok(maps)
}

fn projects_mut(
    root: &mut Value,
    create: bool,
) -> Result<Option<&mut Map<String, Value>>, CommandError> {
    let object = root
        .as_object_mut()
        .ok_or_else(|| invalid(ERROR_NO_OBJECT))?;
    if !object.contains_key(PROJECTS_KEY) {
        if !create {
            return Ok(None);
        }
        object.insert(PROJECTS_KEY.to_owned(), Value::Object(Map::new()));
    }
    object
        .get_mut(PROJECTS_KEY)
        .and_then(Value::as_object_mut)
        .map(Some)
        .ok_or_else(|| invalid("projects in der Datei ist kein Objekt."))
}

/// Die Einträge des Ordners in `projects`, in Dateireihenfolge. Mit `create` und ohne Treffer
/// entsteht einer unter dem Pfad mit `/`.
fn project_nodes_mut<'a>(
    root: &'a mut Value,
    folder: &Path,
    create: bool,
) -> Result<Vec<&'a mut Map<String, Value>>, CommandError> {
    let wanted = folder_key(folder);
    let Some(projects) = projects_mut(root, create)? else {
        return Ok(Vec::new());
    };
    let mut keys: Vec<String> = projects
        .keys()
        .filter(|key: &&String| folder_key(Path::new(key.as_str())) == wanted)
        .cloned()
        .collect();
    if keys.is_empty() {
        if !create {
            return Ok(Vec::new());
        }
        let new_key = folder.to_string_lossy().replace('\\', "/");
        projects.insert(new_key.clone(), json!({}));
        keys.push(new_key);
    }
    Ok(projects
        .iter_mut()
        .filter(|(key, _): &(&String, &mut Value)| keys.contains(key))
        .filter_map(|(_, node): (&String, &mut Value)| node.as_object_mut())
        .collect())
}

/// `true`, wenn sich die Liste geändert hat. Ohne Liste legt nur das Ausschalten eine an.
fn update_disabled(
    node: &mut Map<String, Value>,
    names: &[String],
    is_disabled: bool,
) -> Result<bool, CommandError> {
    if !node.contains_key(DISABLED_SERVERS_KEY) {
        if !is_disabled {
            return Ok(false);
        }
        node.insert(DISABLED_SERVERS_KEY.to_owned(), json!([]));
    }
    let items = node
        .get_mut(DISABLED_SERVERS_KEY)
        .and_then(Value::as_array_mut)
        .ok_or_else(|| invalid("disabledMcpServers in der Datei ist keine Liste."))?;
    let before = items.len();
    if is_disabled {
        for name in names {
            if !items.iter().any(|item: &Value| item.as_str() == Some(name)) {
                items.push(Value::String(name.clone()));
            }
        }
    } else {
        items.retain(|item: &Value| {
            item.as_str()
                .is_none_or(|text: &str| !names.iter().any(|name: &String| name == text))
        });
    }
    Ok(items.len() != before)
}

/// Setzt den Eintrag an die Stelle des alten (Umbenennen) bzw. ans Ende (neu).
fn replace_server(servers: &mut Map<String, Value>, draft: &McpDraft) -> Result<(), CommandError> {
    let name = draft.name.as_str();
    let original = draft.original_name.as_deref();
    if original != Some(name) && servers.contains_key(name) {
        return Err(invalid(format!(
            "Der Name {name} gibt es in dieser Quelle schon."
        )));
    }
    let previous: Option<Value> = original.and_then(|old: &str| servers.get(old).cloned());
    let entry = build_entry(previous.as_ref(), draft)?;
    let Some(old) = original else {
        servers.insert(name.to_owned(), entry);
        return Ok(());
    };
    let mut replacement = Some(entry);
    for (key, value) in std::mem::take(servers) {
        match replacement.take() {
            Some(entry) if key == old => {
                servers.insert(name.to_owned(), entry);
            }
            other => {
                replacement = other;
                servers.insert(key, value);
            }
        }
    }
    Ok(())
}

fn build_entry(previous: Option<&Value>, draft: &McpDraft) -> Result<Value, CommandError> {
    let mut entry: Map<String, Value> = previous
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let (type_text, pairs_key, stale_keys): (&str, &str, &[&str]) = match draft.transport {
        McpTransport::Stdio => ("stdio", "env", &["url", "headers"]),
        McpTransport::Http => ("http", "headers", &["command", "args", "env"]),
        McpTransport::Sse => ("sse", "headers", &["command", "args", "env"]),
        McpTransport::Other => {
            return Err(invalid("Diese Art von Server lässt sich nicht eintragen."));
        }
    };
    for key in stale_keys {
        entry.shift_remove(*key);
    }
    entry.insert("type".to_owned(), json!(type_text));
    if draft.transport == McpTransport::Stdio {
        entry.insert(
            "command".to_owned(),
            json!(draft.command.as_deref().unwrap_or_default().trim()),
        );
        entry.insert("args".to_owned(), json!(draft.args));
    } else {
        entry.insert(
            "url".to_owned(),
            json!(draft.url.as_deref().unwrap_or_default().trim()),
        );
    }
    let pairs = merged_pairs(
        &draft.pairs,
        previous.and_then(|old: &Value| old.get(pairs_key)),
    )?;
    if pairs.is_empty() {
        entry.shift_remove(pairs_key);
    } else {
        entry.insert(pairs_key.to_owned(), Value::Object(pairs));
    }
    Ok(Value::Object(entry))
}

/// Ein Paar ohne Wert behält den bisherigen Wert desselben Schlüssels; leere Schlüssel entfallen.
fn merged_pairs(
    drafts: &[McpPairDraft],
    previous: Option<&Value>,
) -> Result<Map<String, Value>, CommandError> {
    let mut pairs = Map::new();
    for pair in drafts {
        let key = pair.key.trim();
        if key.is_empty() {
            continue;
        }
        let value = match &pair.value {
            Some(value) => value.clone(),
            None => previous
                .and_then(|old: &Value| old.get(key))
                .and_then(Value::as_str)
                .map(str::to_owned)
                .ok_or_else(|| invalid(format!("Wert für {key} fehlt.")))?,
        };
        pairs.insert(key.to_owned(), Value::String(value));
    }
    Ok(pairs)
}

/// Serialisiert die Schreibungen des Verwalters: zwei gleichzeitige Befehle lesen sonst dieselbe
/// Datei, und der zweite ginge über die Änderung des ersten hinweg.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Liest die Datei unmittelbar vor der Änderung frisch (fehlt sie, gilt `{}`), lässt `change`
/// den Knoten ändern und schreibt nur, wenn es `true` meldet: mit 2 Leerzeichen Einzug über eine
/// Zwischendatei, damit ein Abbruch die alte Datei stehen lässt.
fn rewrite(
    path: &Path,
    change: impl FnOnce(&mut Value) -> Result<bool, CommandError>,
) -> Result<(), CommandError> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let mut root = match try_read_json(path) {
        Ok(Some(value)) => value,
        Ok(None) => Value::Object(Map::new()),
        Err(ReadFailure::Unreadable) => return Err(unusable(path, ERROR_UNREADABLE)),
        Err(ReadFailure::InvalidJson) => return Err(unusable(path, ERROR_INVALID_JSON)),
    };
    if !root.is_object() {
        return Err(unusable(path, ERROR_NO_OBJECT));
    }
    if !change(&mut root)? {
        return Ok(());
    }
    let text = serde_json::to_string_pretty(&root)
        .map_err(|error: serde_json::Error| CommandError::Internal(error.to_string()))?;
    let mut temporary_name = path.file_name().unwrap_or_default().to_os_string();
    temporary_name.push(".verwalter.tmp");
    let temporary = path.with_file_name(temporary_name);
    let io_error = |error: std::io::Error| CommandError::Io(format!("{}: {error}", path.display()));
    fs::write(&temporary, text).map_err(io_error)?;
    // Die neue Datei erbt die Rechte der alten (`~/.claude.json` ist unter Unix nur für den Benutzer lesbar).
    if let Ok(existing) = fs::metadata(path) {
        let _ = fs::set_permissions(&temporary, existing.permissions());
    }
    fs::rename(&temporary, path).map_err(|error: std::io::Error| {
        let _ = fs::remove_file(&temporary);
        io_error(error)
    })
}

fn unusable(path: &Path, reason: &str) -> CommandError {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    invalid(format!("{name}: {reason}"))
}

fn rank(kind: McpSourceKind) -> u8 {
    match kind {
        McpSourceKind::Local => 0,
        McpSourceKind::Repository => 1,
        McpSourceKind::Workspace => 2,
        McpSourceKind::User => 3,
    }
}

/// `(None, None)`: die Datei fehlt.
fn read_object(path: &Path) -> (Option<Map<String, Value>>, Option<&'static str>) {
    match try_read_json(path) {
        Ok(None) => (None, None),
        Ok(Some(Value::Object(object))) => (Some(object), None),
        Ok(Some(_)) => (None, Some(ERROR_NO_OBJECT)),
        Err(ReadFailure::Unreadable) => (None, Some(ERROR_UNREADABLE)),
        Err(ReadFailure::InvalidJson) => (None, Some(ERROR_INVALID_JSON)),
    }
}

fn servers_of(value: Option<&Value>) -> Map<String, Value> {
    value
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn names_in(entries: &[&Map<String, Value>], key: &str) -> HashSet<String> {
    entries
        .iter()
        .filter_map(|entry: &&Map<String, Value>| entry.get(key))
        .filter_map(Value::as_array)
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect()
}

/// Liest den Eintrag so, wie er in der Datei steht — Variablen werden nicht ersetzt.
fn config_entry(name: &str, server: &Value) -> McpConfigEntry {
    let text_of = |key: &str| server.get(key).and_then(Value::as_str);
    let command = text_of("command");
    let url = text_of("url");
    // Ohne `type` entscheidet, was da ist — so liest Claude Code ältere Einträge.
    let transport = match text_of("type") {
        Some("stdio") => McpTransport::Stdio,
        Some("http" | "streamable-http") => McpTransport::Http,
        Some("sse") => McpTransport::Sse,
        Some(_) => McpTransport::Other,
        None if command.is_some() => McpTransport::Stdio,
        None if url.is_some() => McpTransport::Http,
        None => McpTransport::Other,
    };
    let mut entry = McpConfigEntry {
        name: name.to_owned(),
        transport,
        target: String::new(),
        command: None,
        args: Vec::new(),
        url: None,
        pairs: Vec::new(),
        enabled: true,
        shadowed_by: None,
    };
    match transport {
        McpTransport::Stdio => {
            entry.command = command.map(str::to_owned);
            entry.args = server
                .get("args")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect();
            let mut parts: Vec<&str> = command.into_iter().collect();
            parts.extend(entry.args.iter().map(String::as_str));
            entry.target = parts.join(" ");
            entry.pairs = masked_pairs(server.get("env"));
        }
        McpTransport::Http | McpTransport::Sse => {
            entry.url = url.map(str::to_owned);
            entry.target = url.unwrap_or_default().to_owned();
            entry.pairs = masked_pairs(server.get("headers"));
        }
        McpTransport::Other => {}
    }
    entry
}

/// Nur ein reiner `${VAR}`-Verweis ist lesbar; jeder andere Wert bleibt im Core.
fn masked_pairs(value: Option<&Value>) -> Vec<McpPair> {
    value
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
        .map(|(key, value): (&String, &Value)| McpPair {
            key: key.clone(),
            value: value
                .as_str()
                .filter(|text: &&str| is_variable_reference(text))
                .map(str::to_owned),
        })
        .collect()
}

fn display_path(home: &Path, path: &Path) -> String {
    let shown = match path.strip_prefix(home) {
        Ok(relative) => Path::new("~").join(relative),
        Err(_) => path.to_path_buf(),
    };
    shown.to_string_lossy().replace('\\', "/")
}

fn hash_value(value: &Value, hasher: &mut DefaultHasher) {
    std::mem::discriminant(value).hash(hasher);
    match value {
        Value::Null => {}
        Value::Bool(flag) => flag.hash(hasher),
        Value::Number(number) => number.to_string().hash(hasher),
        Value::String(text) => text.hash(hasher),
        Value::Array(items) => {
            items.len().hash(hasher);
            for item in items {
                hash_value(item, hasher);
            }
        }
        Value::Object(object) => {
            object.len().hash(hasher);
            let mut keys: Vec<&String> = object.keys().collect();
            keys.sort();
            for key in keys {
                key.hash(hasher);
                hash_value(&object[key], hasher);
            }
        }
    }
}
