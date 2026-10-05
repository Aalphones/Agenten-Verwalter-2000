//! Startseite des eigenen Agenten (Betriebsart Autark, ADR 017): dasselbe Programm wie die App,
//! mit dem Unterbefehl `agent` vor den Argumenten der Claude-Kommandozeile.
use std::env;
use std::path::PathBuf;

use crate::error::CommandError;

pub fn program() -> Result<PathBuf, CommandError> {
    Ok(env::current_exe()?)
}

pub fn leading_args() -> Vec<String> {
    vec![crate::standalone::SUBCOMMAND.to_owned()]
}
