//! Zeigt, wohin ein Dateiverweis aus dem Chat aufgelöst wird, ohne etwas zu öffnen. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example file-link-probe -- --base <Ordner> [--base …] [--allow <Ordner> …] <pfad>`.
//! Relative Pfade werden gegen die `--base`-Ordner in ihrer Reihenfolge aufgelöst; erlaubt ist, was
//! in einem `--base`- oder `--allow`-Ordner liegt. Ausgabe `OK <pfad>` (Exit 0) oder
//! `FEHLER <Variante>: <Text>` (Exit 1).
use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

use verwalter_lib::error::CommandError;
use verwalter_lib::file_links::{self, LinkRoots};

const USAGE: &str =
    "Aufruf: file-link-probe --base <Ordner> [--base …] [--allow <Ordner> …] <pfad>";

fn main() -> ExitCode {
    let mut bases: Vec<PathBuf> = Vec::new();
    let mut extra_allowed: Vec<PathBuf> = Vec::new();
    let mut target: Option<String> = None;
    let mut arguments = env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--base" | "--allow" => {
                let Some(folder) = arguments.next() else {
                    eprintln!("{USAGE}");
                    return ExitCode::from(2);
                };
                if argument == "--base" {
                    bases.push(PathBuf::from(folder));
                } else {
                    extra_allowed.push(PathBuf::from(folder));
                }
            }
            _ if target.is_none() => target = Some(argument),
            _ => {
                eprintln!("{USAGE}");
                return ExitCode::from(2);
            }
        }
    }
    let (Some(target), false) = (target, bases.is_empty()) else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let mut allowed: Vec<PathBuf> = bases.clone();
    allowed.extend(extra_allowed);
    let roots = LinkRoots {
        relative_bases: bases,
        allowed,
    };
    match file_links::resolve(&target, &roots) {
        Ok(path) => {
            println!("OK {}", path.display());
            ExitCode::SUCCESS
        }
        Err(error) => {
            println!("FEHLER {}: {error}", variant_name(&error));
            ExitCode::from(1)
        }
    }
}

fn variant_name(error: &CommandError) -> &'static str {
    match error {
        CommandError::FileNotFound(_) => "FileNotFound",
        CommandError::FileNotAllowed(_) => "FileNotAllowed",
        CommandError::Io(_) => "Io",
        _ => "Sonstiger",
    }
}
