//! Woher die MCP-Server kommen — dieselben Orte wie bei Claude Code: Benutzer- und lokaler Bereich
//! in `~/.claude.json`, Projektbereich in `.mcp.json` des Arbeitsordners, dazu die Dateien aus
//! `--mcp-config`, mit denen der Verwalter die `.mcp.json` der Repositories nachreicht.
//!
//! Die Dateien enthalten Zugangsdaten (Umgebung, Header). Nichts davon geht ins Protokoll — auch
//! kein Fehlertext des JSON-Lesers, der Ausschnitte des Inhalts zitieren kann.
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::{Captures, Regex};
use serde_json::{Map, Value, json};

use super::super::agent_dir;
use super::super::settings;

const USER_CONFIG_FILE: &str = ".claude.json";
const PROJECT_CONFIG_FILE: &str = ".mcp.json";
const DISABLED_FILE: &str = "mcp-disabled.json";
const SERVERS_KEY: &str = "mcpServers";
const PROJECTS_KEY: &str = "projects";
const DISABLED_PROJECT_SERVERS_KEY: &str = "disabledMcpjsonServers";
const BYTE_ORDER_MARK: char = '\u{feff}';

pub const SCOPE_LOCAL: &str = "local";
/// Wortlaut der Claude-Kommandozeile für Server aus `--mcp-config`.
pub const SCOPE_DYNAMIC: &str = "dynamic";
pub const SCOPE_PROJECT: &str = "project";
pub const SCOPE_USER: &str = "user";

const TYPE_STDIO: &str = "stdio";
const TYPE_HTTP: &str = "http";
/// Name des Transports in der MCP-Spezifikation; Claude Code nimmt ihn als Synonym für `http`.
const TYPE_STREAMABLE_HTTP: &str = "streamable-http";
const TYPE_SSE: &str = "sse";

static VARIABLE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")
        .expect("feste, gültige Regex für ${VAR} und ${VAR:-vorgabe}")
});

pub enum Transport {
    Stdio {
        command: String,
        args: Vec<String>,
        env: Vec<(String, String)>,
    },
    Http {
        url: String,
        headers: Vec<(String, String)>,
    },
    /// Eintrag, den der Agent nicht verbinden kann; der Text erscheint als Fehler des Servers.
    Unsupported(String),
}

pub struct ServerConfig {
    pub name: String,
    pub scope: &'static str,
    pub transport: Transport,
    /// Gemeldeter `type` — auch für einen nicht unterstützten Eintrag.
    pub type_name: String,
}

impl ServerConfig {
    /// Was `mcp_status` über die Verbindung zeigt: nie `env` oder `headers`.
    pub fn public_config(&self) -> Value {
        match &self.transport {
            Transport::Stdio { command, args, .. } => {
                json!({ "type": TYPE_STDIO, "command": command, "args": args })
            }
            Transport::Http { url, .. } => json!({ "type": TYPE_HTTP, "url": url }),
            Transport::Unsupported(_) => json!({ "type": self.type_name }),
        }
    }
}

/// Alle Server, je Name einer: lokal vor `--mcp-config` vor Projekt vor Benutzer — der ganze
/// Eintrag der wichtigsten Quelle, Felder werden nicht gemischt (wie bei Claude Code).
///
/// Server aus `.mcp.json` laufen ohne Freigabe: der Verwalter startet Sessions nicht-interaktiv
/// (`-p`), und dort lädt Claude Code sie ebenfalls ungefragt. Nur `disabledMcpjsonServers` gilt.
pub fn load(
    home: &Path,
    cwd: &Path,
    mcp_config_files: &[PathBuf],
    settings_files: &[PathBuf],
) -> Vec<ServerConfig> {
    let user_config = read_json(&home.join(USER_CONFIG_FILE));
    let project_entries: Vec<&Map<String, Value>> = user_config
        .as_ref()
        .map(|config: &Value| project_entries(config, cwd))
        .unwrap_or_default();
    let mut sources: Vec<(&'static str, Map<String, Value>)> = Vec::new();
    for entry in &project_entries {
        sources.push((SCOPE_LOCAL, servers_of(entry.get(SERVERS_KEY))));
    }
    for file in mcp_config_files {
        if let Some(config) = read_json(file) {
            sources.push((SCOPE_DYNAMIC, servers_of(config.get(SERVERS_KEY))));
        }
    }
    let rejected = rejected_project_servers(&project_entries, settings_files);
    if let Some(config) = read_json(&cwd.join(PROJECT_CONFIG_FILE)) {
        let mut servers = servers_of(config.get(SERVERS_KEY));
        servers.retain(|name: &String, _: &mut Value| !rejected.contains(name));
        sources.push((SCOPE_PROJECT, servers));
    }
    if let Some(config) = &user_config {
        sources.push((SCOPE_USER, servers_of(config.get(SERVERS_KEY))));
    }
    let mut seen: HashSet<String> = HashSet::new();
    let mut configs: Vec<ServerConfig> = Vec::new();
    for (scope, servers) in sources {
        for (name, entry) in servers {
            if seen.insert(name.clone()) {
                configs.push(server_config(name, scope, &entry));
            }
        }
    }
    configs
}

/// Die Einträge in `projects`, deren Schlüssel der Arbeitsordner ist. Claude Code schreibt
/// denselben Ordner in mehreren Schreibweisen (`C:\…`, `c:/…`), deshalb alle passenden.
fn project_entries<'a>(config: &'a Value, cwd: &Path) -> Vec<&'a Map<String, Value>> {
    let wanted = folder_key(cwd);
    let Some(projects) = config.get(PROJECTS_KEY).and_then(Value::as_object) else {
        return Vec::new();
    };
    projects
        .iter()
        .filter(|(key, _): &(&String, &Value)| folder_key(Path::new(key.as_str())) == wanted)
        .filter_map(|(_, entry): (&String, &Value)| entry.as_object())
        .collect()
}

/// Ordner als Vergleichsschlüssel: klein, `/` statt `\`, ohne `/` am Ende.
pub fn folder_key(folder: &Path) -> String {
    folder
        .to_string_lossy()
        .to_lowercase()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_owned()
}

fn rejected_project_servers(
    project_entries: &[&Map<String, Value>],
    settings_files: &[PathBuf],
) -> HashSet<String> {
    let settings_values: Vec<Value> = settings_files
        .iter()
        .filter_map(|file: &PathBuf| settings::read(file))
        .collect();
    let lists = project_entries
        .iter()
        .filter_map(|entry: &&Map<String, Value>| entry.get(DISABLED_PROJECT_SERVERS_KEY))
        .chain(
            settings_values
                .iter()
                .filter_map(|value: &Value| value.get(DISABLED_PROJECT_SERVERS_KEY)),
        );
    lists
        .filter_map(Value::as_array)
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect()
}

fn servers_of(value: Option<&Value>) -> Map<String, Value> {
    value
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn server_config(name: String, scope: &'static str, entry: &Value) -> ServerConfig {
    let command = entry.get("command").and_then(Value::as_str);
    let url = entry.get("url").and_then(Value::as_str);
    let declared = entry.get("type").and_then(Value::as_str);
    // Ohne `type` entscheidet, was da ist — so liest Claude Code ältere Einträge.
    let type_name = match (declared, command, url) {
        (Some(declared), _, _) => declared.to_owned(),
        (None, Some(_), _) => TYPE_STDIO.to_owned(),
        (None, None, Some(_)) => TYPE_HTTP.to_owned(),
        (None, None, None) => String::new(),
    };
    let transport = match (type_name.as_str(), command, url) {
        (TYPE_STDIO, Some(command), _) => Transport::Stdio {
            command: expanded(command),
            args: string_list(entry.get("args")),
            env: string_pairs(entry.get("env")),
        },
        (TYPE_HTTP | TYPE_STREAMABLE_HTTP, _, Some(url)) => Transport::Http {
            url: expanded(url),
            headers: string_pairs(entry.get("headers")),
        },
        (TYPE_SSE, _, _) => {
            Transport::Unsupported("SSE-Transport wird nicht unterstützt.".to_owned())
        }
        (TYPE_STDIO, None, _) => Transport::Unsupported("Eintrag ohne command.".to_owned()),
        (TYPE_HTTP | TYPE_STREAMABLE_HTTP, _, None) => {
            Transport::Unsupported("Eintrag ohne url.".to_owned())
        }
        (other, _, _) => {
            Transport::Unsupported(format!("Transport „{other}“ wird nicht unterstützt."))
        }
    };
    ServerConfig {
        name,
        scope,
        transport,
        type_name,
    }
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(expanded)
        .collect()
}

fn string_pairs(value: Option<&Value>) -> Vec<(String, String)> {
    value
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
        .filter_map(|(key, value): (&String, &Value)| {
            value
                .as_str()
                .map(|text: &str| (key.clone(), expanded(text)))
        })
        .collect()
}

/// `${VAR}` und `${VAR:-vorgabe}` aus der Umgebung. Fehlt die Variable und gibt es keine Vorgabe,
/// bleibt der Text stehen — wie bei Claude Code.
fn expanded(text: &str) -> String {
    VARIABLE_PATTERN
        .replace_all(text, |captures: &Captures<'_>| {
            let name = &captures[1];
            match (env::var(name), captures.get(2)) {
                (Ok(value), _) => value,
                (Err(_), Some(default)) => default.as_str().to_owned(),
                (Err(_), None) => captures[0].to_owned(),
            }
        })
        .into_owned()
}

/// Eine fehlende Datei bleibt still; eine unlesbare oder kaputte kommt ins Protokoll — nur mit
/// Pfad und Zeile, nie mit dem Fehlertext des JSON-Lesers, der Inhalt zitieren kann.
fn read_json(path: &Path) -> Option<Value> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == ErrorKind::NotFound => return None,
        Err(error) => {
            eprintln!(
                "MCP-Konfiguration {} nicht lesbar: {}",
                path.display(),
                error.kind()
            );
            return None;
        }
    };
    match serde_json::from_str::<Value>(text.trim_start_matches(BYTE_ORDER_MARK)) {
        Ok(value) => Some(value),
        Err(error) => {
            eprintln!(
                "MCP-Konfiguration {} ist kein gültiges JSON (Zeile {})",
                path.display(),
                error.line()
            );
            None
        }
    }
}

/// Server, die der Benutzer in diesem Arbeitsordner ausgeschaltet hat. Der eigene Agent speichert
/// das in eigener Datei, nicht in der Konfiguration von Claude Code.
pub fn disabled(cwd: &Path) -> HashSet<String> {
    let Some(path) = disabled_path() else {
        return HashSet::new();
    };
    let Some(all) = read_json(&path) else {
        return HashSet::new();
    };
    all.get(folder_key(cwd))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect()
}

pub fn set_disabled(cwd: &Path, name: &str, is_disabled: bool) -> Result<(), String> {
    let path = disabled_path().ok_or_else(|| "Benutzerordner unbekannt".to_owned())?;
    let mut all: HashMap<String, Vec<String>> = read_json(&path)
        .and_then(|value: Value| serde_json::from_value(value).ok())
        .unwrap_or_default();
    let names = all.entry(folder_key(cwd)).or_default();
    names.retain(|existing: &String| existing != name);
    if is_disabled {
        names.push(name.to_owned());
    }
    all.retain(|_, names: &mut Vec<String>| !names.is_empty());
    let text = serde_json::to_string_pretty(&all).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", parent.display()))?;
    }
    // Erst vollständig schreiben, dann ersetzen — ein Absturz dazwischen lässt die alte Datei stehen.
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, text).map_err(|error| format!("{}: {error}", temporary.display()))?;
    fs::rename(&temporary, &path).map_err(|error| format!("{}: {error}", path.display()))
}

fn disabled_path() -> Option<PathBuf> {
    Some(agent_dir()?.join(DISABLED_FILE))
}
