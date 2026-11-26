//! Zeigt, wohin ein Dateiverweis aus dem Chat aufgelöst wird, ohne etwas zu öffnen. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example file-link-probe -- --base <Ordner> [--base …] [--allow <Ordner> …] [--entry <Schlüssel>=<Ordner> …] [--artifacts <Ordner>] <pfad>`.
//! Relative Pfade werden gegen die `--base`-Ordner in ihrer Reihenfolge aufgelöst; erlaubt ist, was
//! in einem `--base`- oder `--allow`-Ordner liegt. Ohne `--entry` gilt jede Basis als Eintrag (Schlüssel =
//! Position), ohne `--artifacts` führt kein Pfad zu „Artefakte“. Erste Zeile, das Ziel des Klicks:
//! `ZIEL view <Schlüssel> <Pfad> <Zeile|->` | `ZIEL external` | `ZIEL name <Name>` |
//! `ZIEL session <Pfad> <Zeile|->` | `ZIEL artifact <Datei>` | `ZIEL FEHLER …`. Zweite, ob das
//! Standardprogramm ihn bekäme: `OK <pfad>` (Exit 0) oder `FEHLER <Variante>: <Text>` (Exit 1).
use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

use verwalter_lib::error::CommandError;
use verwalter_lib::file_links::{self, FileLinkTarget, LinkRoots};

const USAGE: &str = "Aufruf: file-link-probe --base <Ordner> [--base …] [--allow <Ordner> …] [--entry <Schlüssel>=<Ordner> …] [--artifacts <Ordner>] <pfad>";

fn main() -> ExitCode {
    let mut bases: Vec<PathBuf> = Vec::new();
    let mut extra_allowed: Vec<PathBuf> = Vec::new();
    let mut entries: Vec<(String, PathBuf)> = Vec::new();
    // Leer: kein Ordner, in dem eine Datei als Artefakt gälte.
    let mut artifacts_dir: PathBuf = PathBuf::new();
    let mut target: Option<String> = None;
    let mut arguments = env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--base" | "--allow" | "--entry" | "--artifacts" => {
                let Some(folder) = arguments.next() else {
                    eprintln!("{USAGE}");
                    return ExitCode::from(2);
                };
                match argument.as_str() {
                    "--base" => bases.push(PathBuf::from(folder)),
                    "--allow" => extra_allowed.push(PathBuf::from(folder)),
                    "--artifacts" => artifacts_dir = PathBuf::from(folder),
                    _ => match folder.split_once('=') {
                        Some((key, dir)) => entries.push((key.to_owned(), PathBuf::from(dir))),
                        None => {
                            eprintln!("{USAGE}");
                            return ExitCode::from(2);
                        }
                    },
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
    // Ohne `--entry` gilt jede Basis als Eintrag mit ihrer Position als Schlüssel.
    if entries.is_empty() {
        entries = roots
            .relative_bases
            .iter()
            .enumerate()
            .map(|(index, base): (usize, &PathBuf)| (index.to_string(), base.clone()))
            .collect();
    }
    match file_links::target(&target, &roots, &entries, &artifacts_dir) {
        Ok(FileLinkTarget::View { key, path, line }) => {
            println!("ZIEL view {key} {path} {}", line_text(line))
        }
        Ok(FileLinkTarget::External) => println!("ZIEL external"),
        Ok(FileLinkTarget::Name { name }) => println!("ZIEL name {name}"),
        Ok(FileLinkTarget::SessionFile { path, line, .. }) => {
            println!("ZIEL session {path} {}", line_text(line))
        }
        Ok(FileLinkTarget::Artifact { file }) => println!("ZIEL artifact {file}"),
        Err(error) => println!("ZIEL FEHLER {}: {error}", variant_name(&error)),
    }
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

fn line_text(line: Option<u32>) -> String {
    line.map_or_else(|| "-".to_owned(), |number: u32| number.to_string())
}

fn variant_name(error: &CommandError) -> &'static str {
    match error {
        CommandError::FileNotFound(_) => "FileNotFound",
        CommandError::FileNotAllowed(_) => "FileNotAllowed",
        CommandError::Io(_) => "Io",
        _ => "Sonstiger",
    }
}
