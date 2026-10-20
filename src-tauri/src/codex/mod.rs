//! Der Übersetzer der Betriebsart Codex (ADR 031): spricht nach außen den Ausschnitt des
//! Zeilenprotokolls der Claude-Kommandozeile, den der Verwalter liest (Kontrakt aus ADR 017), und
//! nach innen JSON-RPC mit `codex app-server`.
pub mod approvals;
pub mod input;
pub mod instructions;
pub mod items;
pub mod policy;
pub mod rpc;
pub mod session;

use std::env;
use std::ffi::OsString;
use std::path::PathBuf;

use crate::standalone::{EXIT_START_FAILED, args, home_dir};

/// Erstes Argument von `verwalter.exe`, das statt der App den Übersetzer startet.
pub const SUBCOMMAND: &str = "codex";
/// Pfad zu `codex.exe`, gesetzt vom Verwalter (`agents::claude::process`).
pub const EXE_VARIABLE: &str = "VERWALTER_CODEX_EXE";

const DATA_DIR: &str = ".verwalter";
const THREAD_DIR: &str = "codex";

/// `<Benutzerordner>\.verwalter\codex\<id>.json` mit der Codex-Thread-ID der Session; ohne bekannten
/// Benutzerordner `None`.
pub fn thread_file(session_id: &str) -> Option<PathBuf> {
    Some(
        home_dir()?
            .join(DATA_DIR)
            .join(THREAD_DIR)
            .join(format!("{session_id}.json")),
    )
}

/// Läuft bis zum Dateiende der Standardeingabe; Rückgabe ist der Exit-Code des Prozesses.
pub fn run(raw_args: Vec<String>) -> i32 {
    let parsed = match args::parse(&raw_args) {
        Ok(parsed) => parsed,
        Err(error) => {
            eprintln!("{error}");
            return EXIT_START_FAILED;
        }
    };
    if parsed.print {
        eprintln!("Der Druckmodus ist in der Betriebsart Codex noch nicht verfügbar");
        return EXIT_START_FAILED;
    }
    let Some(exe) = env::var_os(EXE_VARIABLE)
        .filter(|value: &OsString| !value.is_empty())
        .map(PathBuf::from)
    else {
        eprintln!("{EXE_VARIABLE} fehlt");
        return EXIT_START_FAILED;
    };
    session::run(parsed, &exe)
}
