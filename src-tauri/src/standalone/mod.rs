//! Der eigene Agent der Betriebsart Autark (ADR 017): spricht den Ausschnitt des Zeilenprotokolls
//! der Claude-Kommandozeile, den der Verwalter liest, und fragt ein OpenAI-kompatibles Modell
//! (LM Studio).
pub mod agents;
pub mod args;
pub mod compact;
pub mod content;
pub mod context;
pub mod hooks;
pub mod invocation;
pub mod llm;
pub mod mcp;
pub mod memory;
pub mod output;
pub mod paths;
pub mod permissions;
pub mod print;
pub mod prompt;
pub mod session;
pub mod settings;
pub mod style;
pub mod subagent;
pub mod tasks;
pub mod tools;
pub mod transcript;
pub mod turn;

use std::env;
use std::ffi::OsString;
use std::path::PathBuf;

/// Erstes Argument von `verwalter.exe`, das statt der App den Agenten startet.
pub const SUBCOMMAND: &str = "agent";

/// Umgebung, die der Verwalter setzt (`agents::claude::local::apply`).
pub const BASE_URL_VARIABLE: &str = "VERWALTER_AGENT_BASE_URL";
pub const CONTEXT_WINDOW_VARIABLE: &str = "VERWALTER_AGENT_CONTEXT_WINDOW";
/// `1`, wenn das geladene Modell Bilder versteht, sonst `0`.
pub const VISION_VARIABLE: &str = "VERWALTER_AGENT_VISION";
/// Scratchpad-Ordner der Session (ADR 022), gesetzt von `agents::claude::process`.
pub const SCRATCHPAD_VARIABLE: &str = "VERWALTER_AGENT_SCRATCHPAD";

/// Exit-Code bei fehlerhaften Argumenten, fehlender Umgebung oder unlesbarem Transkript.
pub const EXIT_START_FAILED: i32 = 2;

const DATA_DIR: &str = ".verwalter";
const AGENT_DIR: &str = "agent";
const TRANSCRIPT_EXTENSION: &str = "jsonl";
const SCRATCHPAD_DIR: &str = "scratchpad";

/// `<Benutzerordner>\.verwalter\agent\<id>.jsonl`; ohne bekannten Benutzerordner `None`.
pub fn transcript_path(session_id: &str) -> Option<PathBuf> {
    Some(agent_dir()?.join(format!("{session_id}.{TRANSCRIPT_EXTENSION}")))
}

/// Ersatz-Scratchpad, wenn der Agent ohne Verwalter läuft (Aufruf von Hand):
/// `<Benutzerordner>\.verwalter\agent\<id>\scratchpad`.
pub fn fallback_scratchpad(session_id: &str) -> Option<PathBuf> {
    Some(agent_dir()?.join(session_id).join(SCRATCHPAD_DIR))
}

/// Läuft bis zum Dateiende der Standardeingabe; Rückgabe ist der Exit-Code des Prozesses.
pub fn run(args: Vec<String>) -> i32 {
    let parsed = match args::parse(&args) {
        Ok(parsed) => parsed,
        Err(error) => {
            eprintln!("{error}");
            return EXIT_START_FAILED;
        }
    };
    if parsed.print {
        return print::run(&parsed);
    }
    session::run(parsed)
}

/// Was der Verwalter dem Agenten über die Umgebung mitgibt (`agents::claude::local::apply`).
pub struct Environment {
    pub base_url: String,
    pub context_window: u32,
    /// Fehlt die Variable, versteht das Modell keine Bilder.
    pub has_vision: bool,
    /// Fehlt die Variable, nimmt die Session `fallback_scratchpad`.
    pub scratchpad: Option<PathBuf>,
}

impl Environment {
    pub fn read() -> Result<Environment, String> {
        let base_url = env::var(BASE_URL_VARIABLE)
            .ok()
            .map(|value: String| value.trim().trim_end_matches('/').to_owned())
            .filter(|value: &String| !value.is_empty())
            .ok_or_else(|| format!("{BASE_URL_VARIABLE} fehlt"))?;
        let context_window = env::var(CONTEXT_WINDOW_VARIABLE)
            .ok()
            .and_then(|value: String| value.trim().parse::<u32>().ok())
            .ok_or_else(|| format!("{CONTEXT_WINDOW_VARIABLE} fehlt oder ist keine Ganzzahl"))?;
        let has_vision = env::var(VISION_VARIABLE).is_ok_and(|value: String| value.trim() == "1");
        let scratchpad = env::var_os(SCRATCHPAD_VARIABLE)
            .filter(|value: &OsString| !value.is_empty())
            .map(PathBuf::from);
        Ok(Environment {
            base_url,
            context_window,
            has_vision,
            scratchpad,
        })
    }
}

fn agent_dir() -> Option<PathBuf> {
    Some(home_dir()?.join(DATA_DIR).join(AGENT_DIR))
}

fn home_dir() -> Option<PathBuf> {
    // `HOME` für die Builds unter macOS und Linux, die kein `USERPROFILE` kennen.
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
}
