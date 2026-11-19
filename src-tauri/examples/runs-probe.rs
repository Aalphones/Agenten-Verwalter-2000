//! Prüft das Laufzeit-Gedächtnis. Aufrufe:
//! `runs-probe key "<Befehl>"` druckt den Schlüssel des vereinheitlichten Befehls;
//! `runs-probe estimate <Datenbank-Kopie> <Vorhaben-ID> "<Befehl>"` druckt die Schätzung in ms oder
//! `keine` und die Zahl der zugrunde liegenden Läufe;
//! `runs-probe backfill <Datenbank-Kopie>` druckt die Zahl der aus `background_items` übernommenen
//! Läufe;
//! `runs-probe progress <Datei>` druckt den erkannten Fortschritt und die letzte Zeile vom Ende
//! der Datei. Nie gegen `%USERPROFILE%\.verwalter\verwalter.db` — `Database::open` führt Migrationen aus.
use std::env;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::background::output::read_tail;
use verwalter_lib::db::Database;
use verwalter_lib::runs::model::{ProgressUnit, RunProgress};
use verwalter_lib::runs::{self, backfill, normalize, progress};

const USAGE: &str = "Aufruf: runs-probe key \"<Befehl>\" | estimate <Datenbank-Kopie> <Vorhaben-ID> \"<Befehl>\" | backfill <Datenbank-Kopie> | progress <Datei>";

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let parts: Vec<&str> = arguments.iter().map(String::as_str).collect();
    match parts.as_slice() {
        ["key", command] => {
            println!("{}", normalize::command_key(command));
            Ok(ExitCode::SUCCESS)
        }
        ["estimate", database_path, project_id, command] => {
            let Some(database) = open_copy(database_path)? else {
                return Ok(ExitCode::from(2));
            };
            let (estimate, samples) = database.with(|connection| {
                Ok((
                    runs::estimate(connection, project_id, command)?,
                    runs::sample_size(connection, project_id, command)?,
                ))
            })?;
            match estimate {
                Some(milliseconds) => println!("{milliseconds} ms ({samples} Läufe)"),
                None => println!("keine ({samples} Läufe)"),
            }
            Ok(ExitCode::SUCCESS)
        }
        ["backfill", database_path] => {
            let Some(database) = open_copy(database_path)? else {
                return Ok(ExitCode::from(2));
            };
            let taken = database.with(backfill::run)?;
            println!("{taken} Läufe übernommen");
            Ok(ExitCode::SUCCESS)
        }
        ["progress", file] => {
            let tail = read_tail(Path::new(file), progress::TAIL_BYTES);
            let (found, last_line) = progress::read(&tail.text);
            println!("{}", describe_progress(found));
            println!("{}", last_line.unwrap_or_else(|| "keine Zeile".to_owned()));
            Ok(ExitCode::SUCCESS)
        }
        _ => {
            eprintln!("{USAGE}");
            Ok(ExitCode::from(2))
        }
    }
}

fn describe_progress(found: Option<RunProgress>) -> String {
    let Some(run_progress) = found else {
        return "kein Fortschritt".to_owned();
    };
    let unit = match run_progress.unit {
        ProgressUnit::Count => "Count",
        ProgressUnit::Percent => "Percent",
    };
    format!("{unit} {}/{}", run_progress.done, run_progress.total)
}

fn open_copy(path: &str) -> Result<Option<Database>, Box<dyn std::error::Error>> {
    let database_path = PathBuf::from(path);
    if is_app_database(&database_path) {
        eprintln!(
            "Nur gegen eine Kopie: {} ist die Datenbank der App.",
            database_path.display()
        );
        return Ok(None);
    }
    Ok(Some(Database::open(&database_path)?))
}

fn is_app_database(path: &Path) -> bool {
    let Some(home) = env::var_os("USERPROFILE") else {
        return false;
    };
    let app_database = PathBuf::from(home).join(".verwalter").join("verwalter.db");
    match (path.canonicalize(), app_database.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}
