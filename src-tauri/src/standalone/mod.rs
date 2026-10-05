//! Der eigene Agent der Betriebsart Autark (ADR 017): spricht den Ausschnitt des Zeilenprotokolls
//! der Claude-Kommandozeile, den der Verwalter liest, und fragt ein OpenAI-kompatibles Modell
//! (LM Studio).
pub mod args;
pub mod content;
pub mod llm;
pub mod output;
pub mod paths;
pub mod prompt;
pub mod session;
pub mod tools;
pub mod transcript;
pub mod turn;

use std::env;
use std::path::PathBuf;

/// Erstes Argument von `verwalter.exe`, das statt der App den Agenten startet.
pub const SUBCOMMAND: &str = "agent";

/// Umgebung, die der Verwalter setzt (`agents::claude::local::apply`).
pub const BASE_URL_VARIABLE: &str = "VERWALTER_AGENT_BASE_URL";
pub const CONTEXT_WINDOW_VARIABLE: &str = "VERWALTER_AGENT_CONTEXT_WINDOW";

/// Exit-Code bei fehlerhaften Argumenten, fehlender Umgebung oder unlesbarem Transkript.
pub const EXIT_START_FAILED: i32 = 2;

const DATA_DIR: &str = ".verwalter";
const AGENT_DIR: &str = "agent";
const TRANSCRIPT_EXTENSION: &str = "jsonl";

/// `<Benutzerordner>\.verwalter\agent\<id>.jsonl`; ohne bekannten Benutzerordner `None`.
pub fn transcript_path(session_id: &str) -> Option<PathBuf> {
    Some(agent_dir()?.join(format!("{session_id}.{TRANSCRIPT_EXTENSION}")))
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
        eprintln!("Druckmodus folgt");
        return EXIT_START_FAILED;
    }
    session::run(parsed)
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
