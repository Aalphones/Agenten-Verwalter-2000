//! Zeigt, was die Changes für eine Session aus einer **Kopie** der Datenbank ermitteln. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example changes-probe -- <Datenbank-Kopie> <Session-ID> [session|project]`.
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{Database, session_files, session_repositories, session_ticket_worktrees};
use verwalter_lib::worktrees::{self, RepositoryCheckout, SessionRepository, TicketRoot};

const USAGE: &str = "Aufruf: changes-probe <Datenbank-Kopie> <Session-ID> [session|project]";

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
    let (repositories, remembered, files) = database.with(|connection| {
        let repositories = session_repositories::load(connection, session_id)?;
        let remembered = session_ticket_worktrees::load(connection, session_id)?;
        let session_ids = match reach {
            Reach::Session => vec![session_id.clone()],
            Reach::Project => project_session_ids(&sessions::load_active(connection)?, session_id),
        };
        let files = session_files::load_for(connection, &session_ids)?;
        Ok((repositories, remembered, files))
    })?;

    print_repositories(&repositories);
    let roots = worktrees::ticket_roots(&repositories);
    print_roots(&roots);
    println!("Gemerkte Ticket-Worktrees:");
    for (position, folder) in &remembered {
        println!("  {position}  {folder}");
    }
    print_files(&roots, &files);
    Ok(ExitCode::SUCCESS)
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

/// Die Sessions im Vorhaben von `session_id`; eine archivierte Session nur sich selbst.
fn project_session_ids(rows: &[SessionRow], session_id: &str) -> Vec<String> {
    let Some(project_id) = rows
        .iter()
        .find(|row: &&SessionRow| row.id == session_id)
        .map(|row: &SessionRow| row.project_id.clone())
    else {
        return vec![session_id.to_owned()];
    };
    rows.iter()
        .filter(|row: &&SessionRow| row.project_id == project_id)
        .map(|row: &SessionRow| row.id.clone())
        .collect()
}

fn print_repositories(repositories: &[SessionRepository]) {
    println!("Repositories:");
    for (position, repository) in repositories.iter().enumerate() {
        let kind = match &repository.checkout {
            RepositoryCheckout::AppWorktree { .. } => "App-Worktree",
            RepositoryCheckout::Main => "Haupt-Checkout",
            RepositoryCheckout::Folder => "Ordner ohne Git",
        };
        println!(
            "  {position}  {}  {}  {kind}",
            repository.name,
            repository.repository_path.display()
        );
    }
}

fn print_roots(roots: &[TicketRoot]) {
    println!("Wurzeln:");
    for root in roots {
        let inner = root.inner.as_deref().unwrap_or("-");
        println!("  {}  {}  inner={inner}", root.position, root.prefix);
    }
}

/// Je geschriebene Datei die Ticket-Worktrees, die ihr Pfad nennt, mit dem inneren Repository.
fn print_files(roots: &[TicketRoot], files: &HashMap<String, f64>) {
    let mut paths: Vec<&String> = files.keys().collect();
    paths.sort();
    println!("Geschriebene Dateien ({}):", paths.len());
    for path in paths {
        let found = worktrees::mentioned_ticket_worktrees(roots, path);
        if found.is_empty() {
            println!("  {path}  -> kein Ticket-Worktree");
            continue;
        }
        for (position, folder) in found {
            let inner = worktrees::ticket_root_of(roots, position, &folder)
                .and_then(|root: &TicketRoot| root.inner.clone())
                .unwrap_or_else(|| "-".to_owned());
            println!("  {path}  -> ({position}, {folder}) inner={inner}");
        }
    }
}
