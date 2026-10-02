//! Zeigt, was die Changes für eine Session aus einer **Kopie** der Datenbank ermitteln. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example changes-probe -- <Datenbank-Kopie> <Session-ID> [session|project] [<Schlüssel> <Pfad>]`.
//! Ohne Schlüssel die Changes als JSON, mit Schlüssel und Pfad den Diff dieser Datei (Blickwinkel
//! „alles“). Die Wurzeln der Ticket-Worktrees gehen nach stderr.
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::changes::model::ChangeScope;
use verwalter_lib::changes::{self, ChangesInput, sources};
use verwalter_lib::db::projects::{self, ProjectRow};
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{
    Database, session_commits, session_files, session_repositories, session_ticket_worktrees,
};
use verwalter_lib::worktrees::{self, TicketRoot};

const USAGE: &str =
    "Aufruf: changes-probe <Datenbank-Kopie> <Session-ID> [session|project] [<Schlüssel> <Pfad>]";
const DIFF_PREVIEW_LINES: usize = 20;

/// Reichweite wie in der Oberfläche: nur die Session oder alle Sessions ihres Vorhabens.
enum Reach {
    Session,
    Project,
}

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let (Some(database_path), Some(session_id)) = (arguments.first(), arguments.get(1)) else {
        eprintln!("{USAGE}");
        return Ok(ExitCode::from(2));
    };
    let reach = match arguments.get(2).map(String::as_str) {
        None | Some("session") => Reach::Session,
        Some("project") => Reach::Project,
        Some(_) => {
            eprintln!("{USAGE}");
            return Ok(ExitCode::from(2));
        }
    };
    let diff_target = match (arguments.get(3), arguments.get(4)) {
        (Some(key), Some(path)) => Some((key.as_str(), path.as_str())),
        (None, None) => None,
        _ => {
            eprintln!("{USAGE}");
            return Ok(ExitCode::from(2));
        }
    };
    let database_path = PathBuf::from(database_path);
    // `Database::open` führt Migrationen aus: gegen die Datenbank der App liefe das neben ihr her.
    if is_app_database(&database_path) {
        eprintln!(
            "Nur gegen eine Kopie: {} ist die Datenbank der App.",
            database_path.display()
        );
        return Ok(ExitCode::from(2));
    }
    let database = Database::open(&database_path)?;
    let input = database.with(|connection| {
        let rows = sessions::load_active(connection)?;
        let Some(row) = rows.iter().find(|row: &&SessionRow| row.id == *session_id) else {
            return Err(verwalter_lib::error::CommandError::Internal(format!(
                "Session {session_id} ist nicht aktiv oder unbekannt"
            )));
        };
        let repositories = session_repositories::load(connection, session_id)?;
        let session_ids: Vec<String> = match reach {
            Reach::Session => vec![session_id.clone()],
            Reach::Project => rows
                .iter()
                .filter(|other: &&SessionRow| other.project_id == row.project_id)
                .map(|other: &SessionRow| other.id.clone())
                .collect(),
        };
        let mut remembered: Vec<(u32, String)> = Vec::new();
        for id in &session_ids {
            for (position, folder) in session_ticket_worktrees::load(connection, id)? {
                let is_known = remembered
                    .iter()
                    .any(|(known_position, known): &(u32, String)| {
                        *known_position == position && known.eq_ignore_ascii_case(&folder)
                    });
                if !is_known {
                    remembered.push((position, folder));
                }
            }
        }
        let own = Ownership {
            commits: session_commits::load_for(connection, &session_ids)?,
            touched: session_files::load_for(connection, &session_ids)?,
            untracked_before: sessions::untracked_before(connection, &session_ids)?,
        };
        let since_ms = match reach {
            Reach::Session => row.created_at,
            Reach::Project => projects::load_active(connection)?
                .iter()
                .find(|project: &&ProjectRow| project.id == row.project_id)
                .map_or(row.created_at, |project: &ProjectRow| project.created_at),
        };
        let ticket_roots = worktrees::ticket_roots(&repositories);
        print_roots(&ticket_roots);
        let ticket_folders = sources::scope_ticket_folders(&ticket_roots, remembered, &own.touched);
        Ok(ChangesInput {
            workspace: PathBuf::from(row.workspace_dir.clone().unwrap_or_default()),
            repositories,
            ticket_roots,
            ticket_folders,
            since_ms,
            own,
        })
    })?;

    let Some((key, path)) = diff_target else {
        println!("{}", serde_json::to_string_pretty(&changes::load(&input))?);
        return Ok(ExitCode::SUCCESS);
    };
    let diff = sources::find(&input, key)
        .and_then(|source| changes::file_diff(&source, path, ChangeScope::All, &input.own));
    match diff {
        Ok(diff) => {
            println!("{} Zeilen", diff.lines.len());
            for line in diff.lines.iter().take(DIFF_PREVIEW_LINES) {
                println!("{:?}  {}", line.kind, line.text);
            }
            Ok(ExitCode::SUCCESS)
        }
        Err(error) => {
            println!("Fehler: {error}");
            Ok(ExitCode::from(1))
        }
    }
}

fn is_app_database(path: &Path) -> bool {
    let Some(profile) = env::var_os("USERPROFILE") else {
        return false;
    };
    let app_database = Path::new(&profile).join(".verwalter").join("verwalter.db");
    match (fs::canonicalize(path), fs::canonicalize(app_database)) {
        (Ok(given), Ok(app)) => given == app,
        _ => false,
    }
}

fn print_roots(roots: &[TicketRoot]) {
    eprintln!("Wurzeln:");
    for root in roots {
        let inner = root.inner.as_deref().unwrap_or("-");
        eprintln!("  {}  {}  inner={inner}", root.position, root.prefix);
    }
}
