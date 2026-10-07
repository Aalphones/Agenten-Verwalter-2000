//! MCP-Server der Session: verbinden im Hintergrund, Werkzeuge als `mcp__<server>__<werkzeug>`
//! anbieten, Aufrufe weiterreichen und die Steueranfragen des MCP-Dialogs beantworten.
//!
//! Hauptagent und Subagenten teilen eine Instanz (`turn::Shared`). Ein Aufruf hält die Sperre nicht:
//! er holt sich den Client als `Arc` heraus, damit ein langer Aufruf weder `mcp_status` noch andere
//! Server blockiert.
pub mod client;
pub mod config;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;

use serde_json::{Value, json};

use self::client::{McpClient, McpTool};
use self::config::ServerConfig;
use super::tools::ToolOutput;

pub const TOOL_PREFIX: &str = "mcp__";
const NAME_SEPARATOR: &str = "__";
/// Höchstlänge eines Werkzeugnamens in der OpenAI-Schnittstelle.
const MAX_TOOL_NAME_CHARS: usize = 64;

pub fn is_mcp_tool(name: &str) -> bool {
    name.starts_with(TOOL_PREFIX)
}

enum ServerState {
    Pending,
    Connected(Arc<McpClient>),
    Failed(String),
    Disabled,
}

struct Server {
    config: Arc<ServerConfig>,
    state: ServerState,
    /// Jede neue Verbindung zählt hoch; ein Verbindungs-Thread, dessen Nummer veraltet ist (Server
    /// inzwischen neu verbunden oder ausgeschaltet), verwirft sein Ergebnis.
    generation: u64,
}

pub struct McpServers {
    cwd: PathBuf,
    servers: Mutex<Vec<Server>>,
    /// Gesetzt beim Prozessende: laufende Verbindungsversuche brechen ab.
    is_closing: AtomicBool,
}

impl McpServers {
    /// Startet je eingeschaltetem Server einen Thread, der verbindet — der Agent wartet nicht darauf.
    pub fn start(configs: Vec<ServerConfig>, cwd: &Path) -> Arc<McpServers> {
        let disabled = config::disabled(cwd);
        let servers: Vec<Server> = configs
            .into_iter()
            .map(|config: ServerConfig| {
                let state = if disabled.contains(&config.name) {
                    ServerState::Disabled
                } else {
                    ServerState::Pending
                };
                Server {
                    config: Arc::new(config),
                    state,
                    generation: 0,
                }
            })
            .collect();
        let pending: Vec<String> = servers
            .iter()
            .filter(|server: &&Server| matches!(server.state, ServerState::Pending))
            .map(|server: &Server| server.config.name.clone())
            .collect();
        let manager = Arc::new(McpServers {
            cwd: cwd.to_path_buf(),
            servers: Mutex::new(servers),
            is_closing: AtomicBool::new(false),
        });
        for name in pending {
            manager.connect_in_background(&name, 0);
        }
        manager
    }

    /// Werkzeug-Beschreibungen aller verbundenen Server, für jede Modellanfrage neu — ein spät
    /// verbundener Server zählt ab der nächsten.
    pub fn tool_definitions(&self) -> Vec<Value> {
        let servers = self.lock();
        let mut definitions: Vec<Value> = Vec::new();
        for server in servers.iter() {
            let ServerState::Connected(client) = &server.state else {
                continue;
            };
            for tool in client.tools() {
                definitions.push(definition(&server.config.name, tool));
            }
        }
        definitions
    }

    pub fn call(&self, full_name: &str, input: &Value, cancel: &AtomicBool) -> ToolOutput {
        let Some((server_name, client, tool)) = self.find_tool(full_name) else {
            return ToolOutput::from_result(Err(self.missing_tool_text(full_name)));
        };
        let result = match client.call(&tool, input, cancel) {
            Ok((text, false)) => Ok(text),
            Ok((text, true)) => Err(text),
            Err(error) => Err(format!("MCP-Server {server_name}: {error}")),
        };
        ToolOutput::from_result(result)
    }

    /// Format wie `mcp_status` der Claude-Kommandozeile; `config` nie mit `env` oder `headers`.
    pub fn status(&self) -> Value {
        let servers = self.lock();
        let entries: Vec<Value> = servers
            .iter()
            .map(|server: &Server| {
                let config = &server.config;
                let mut entry = json!({
                    "name": config.name,
                    "scope": config.scope,
                    "config": config.public_config(),
                });
                let status = match &server.state {
                    ServerState::Pending => "pending",
                    ServerState::Connected(client) => {
                        let tools: Vec<Value> = client
                            .tools()
                            .iter()
                            .map(|tool: &McpTool| json!({ "name": tool.name }))
                            .collect();
                        entry["tools"] = Value::from(tools);
                        "connected"
                    }
                    ServerState::Failed(error) => {
                        entry["error"] = Value::from(error.as_str());
                        "failed"
                    }
                    ServerState::Disabled => "disabled",
                };
                entry["status"] = Value::from(status);
                entry
            })
            .collect();
        Value::from(entries)
    }

    /// Schließt die Verbindung, verbindet neu und wartet auf das Ergebnis.
    pub fn reconnect(&self, name: &str) -> Result<(), String> {
        let (config, generation) = {
            let mut servers = self.lock();
            let server = find_server(&mut servers, name)?;
            if matches!(server.state, ServerState::Disabled) {
                return Err(format!("Server is disabled: {name}"));
            }
            close_state(&server.state);
            server.generation += 1;
            server.state = ServerState::Pending;
            (Arc::clone(&server.config), server.generation)
        };
        let outcome = McpClient::connect(&config, &self.is_closing);
        let error = outcome.as_ref().err().cloned();
        self.settle(name, generation, outcome);
        match error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    /// Ausschalten gilt für diesen Arbeitsordner und bleibt gespeichert; Einschalten verbindet im
    /// Hintergrund.
    pub fn toggle(self: &Arc<Self>, name: &str, is_enabled: bool) -> Result<(), String> {
        let generation = {
            let mut servers = self.lock();
            let server = find_server(&mut servers, name)?;
            config::set_disabled(&self.cwd, name, !is_enabled)?;
            if !is_enabled {
                close_state(&server.state);
                server.generation += 1;
                server.state = ServerState::Disabled;
                return Ok(());
            }
            if !matches!(server.state, ServerState::Disabled) {
                return Ok(());
            }
            server.generation += 1;
            server.state = ServerState::Pending;
            server.generation
        };
        self.connect_in_background(name, generation);
        Ok(())
    }

    /// Beim Prozessende: laufende Verbindungsversuche abbrechen, stdio-Server beenden.
    pub fn close_all(&self) {
        self.is_closing
            .store(true, std::sync::atomic::Ordering::SeqCst);
        let mut servers = self.lock();
        for server in servers.iter_mut() {
            close_state(&server.state);
            server.generation += 1;
        }
    }

    fn connect_in_background(self: &Arc<Self>, name: &str, generation: u64) {
        let Some(config) = self
            .lock()
            .iter()
            .find(|server: &&Server| server.config.name == name)
            .map(|server: &Server| Arc::clone(&server.config))
        else {
            return;
        };
        let manager = Arc::clone(self);
        let server_name = name.to_owned();
        let spawned = thread::Builder::new()
            .name("agent-mcp-connect".to_owned())
            .spawn(move || {
                let outcome = McpClient::connect(&config, &manager.is_closing);
                manager.settle(&server_name, generation, outcome);
            });
        if let Err(error) = spawned {
            self.settle(
                name,
                generation,
                Err(format!("Verbindungs-Thread startet nicht: {error}")),
            );
        }
    }

    /// Trägt das Ergebnis eines Verbindungsversuchs ein — wenn er noch der aktuelle ist.
    fn settle(&self, name: &str, generation: u64, outcome: Result<McpClient, String>) {
        let mut servers = self.lock();
        let Some(server) = servers
            .iter_mut()
            .find(|server: &&mut Server| server.config.name == name)
        else {
            return;
        };
        if server.generation != generation {
            // Der Client schließt sich beim Fallenlassen selbst.
            return;
        }
        match outcome {
            Ok(client) => server.state = ServerState::Connected(Arc::new(client)),
            Err(error) => {
                eprintln!("MCP-Server {name} nicht verbunden");
                server.state = ServerState::Failed(error);
            }
        }
    }

    /// Server, Client und Originalname des Werkzeugs zum vollen Namen, wie ihn `definition` baut.
    fn find_tool(&self, full_name: &str) -> Option<(String, Arc<McpClient>, String)> {
        let servers = self.lock();
        servers.iter().find_map(|server: &Server| {
            let ServerState::Connected(client) = &server.state else {
                return None;
            };
            client
                .tools()
                .iter()
                .find(|tool: &&McpTool| tool_name(&server.config.name, &tool.name) == full_name)
                .map(|tool: &McpTool| {
                    (
                        server.config.name.clone(),
                        Arc::clone(client),
                        tool.name.clone(),
                    )
                })
        })
    }

    fn missing_tool_text(&self, full_name: &str) -> String {
        let servers = self.lock();
        let server = servers.iter().find(|server: &&Server| {
            full_name.starts_with(&format!(
                "{TOOL_PREFIX}{}{NAME_SEPARATOR}",
                sanitized(&server.config.name)
            ))
        });
        match server.map(|server: &Server| &server.state) {
            Some(ServerState::Pending) => {
                "Der MCP-Server verbindet sich noch; versuche es gleich noch einmal.".to_owned()
            }
            Some(ServerState::Failed(error)) => {
                format!("Der MCP-Server ist nicht verbunden: {error}")
            }
            Some(ServerState::Disabled) => "Der MCP-Server ist ausgeschaltet.".to_owned(),
            Some(ServerState::Connected(_)) | None => format!("Unbekanntes Werkzeug: {full_name}"),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Vec<Server>> {
        self.servers.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn find_server<'a>(servers: &'a mut [Server], name: &str) -> Result<&'a mut Server, String> {
    servers
        .iter_mut()
        .find(|server: &&mut Server| server.config.name == name)
        // Wortlaut wie die Claude-Kommandozeile.
        .ok_or_else(|| format!("Server not found: {name}"))
}

fn close_state(state: &ServerState) {
    if let ServerState::Connected(client) = state {
        client.close();
    }
}

fn definition(server: &str, tool: &McpTool) -> Value {
    // Die Chat-Vorlage braucht ein Objekt-Schema; ein Server ohne Parameter schickt manchmal keins.
    let parameters = if tool.input_schema.is_object() {
        tool.input_schema.clone()
    } else {
        json!({ "type": "object", "properties": {} })
    };
    json!({
        "type": "function",
        "function": {
            "name": tool_name(server, &tool.name),
            "description": tool.description,
            "parameters": parameters,
        },
    })
}

/// `mcp__<server>__<werkzeug>` mit erlaubten Zeichen, höchstens 64 lang.
fn tool_name(server: &str, tool: &str) -> String {
    let full = format!(
        "{TOOL_PREFIX}{}{NAME_SEPARATOR}{}",
        sanitized(server),
        sanitized(tool)
    );
    full.chars().take(MAX_TOOL_NAME_CHARS).collect()
}

fn sanitized(name: &str) -> String {
    name.chars()
        .map(|character: char| {
            if character.is_ascii_alphanumeric() || character == '_' || character == '-' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

/// Welche MCP-Werkzeuge eine Schleife bekommt.
#[derive(Clone)]
pub enum McpAccess {
    All,
    /// Nur diese vollen Namen — für eine Agent-Definition mit `tools`.
    Only(HashSet<String>),
    None,
}

impl McpAccess {
    pub fn allows(&self, full_name: &str) -> bool {
        match self {
            McpAccess::All => true,
            McpAccess::Only(names) => names.contains(full_name),
            McpAccess::None => false,
        }
    }

    pub fn definitions(&self, servers: &McpServers) -> Vec<Value> {
        if matches!(self, McpAccess::None) {
            return Vec::new();
        }
        servers
            .tool_definitions()
            .into_iter()
            .filter(|definition: &Value| {
                definition
                    .pointer("/function/name")
                    .and_then(Value::as_str)
                    .is_some_and(|name: &str| self.allows(name))
            })
            .collect()
    }
}
