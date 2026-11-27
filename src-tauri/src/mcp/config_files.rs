//! Die MCP-Konfigurationsdateien einer Session, gelesen ohne laufenden Agenten (ADR 070):
//! Benutzer und „nur ich, in diesem Vorhaben“ aus `~/.claude.json`, je Repository dessen
//! `.mcp.json` und, falls vorhanden, die des Workspace. Liest nur und legt nichts an.
//!
//! Die rohen Server-Objekte enthalten Zugangsdaten. Sie bleiben in `LoadedConfig` — ohne `Debug` —
//! und verlassen das Modul nur maskiert (`sources`) oder als Hash (`fingerprint`).
use std::collections::{HashMap, HashSet};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::mcp::model::{McpConfigEntry, McpPair, McpSource, McpSourceKind, McpTransport};
use crate::standalone::mcp::config::{
    ReadFailure, is_variable_reference, project_entries, try_read_json,
};

const USER_CONFIG_FILE: &str = ".claude.json";
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
