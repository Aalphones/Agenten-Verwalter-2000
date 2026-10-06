//! Zeigt, was die Git-Werkzeuge für eine Session aus einer **Kopie** der Datenbank lesen. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example git-probe -- <Datenbank-Kopie> <Session-ID> [<Schlüssel>]`.
//! Ohne Schlüssel den `GitSessionStatus` als JSON, mit Schlüssel die Branch-Liste dieses Eintrags.
//! `busy` bleibt leer: ohne laufende App gibt es keine arbeitende Session. Nie gegen
//! `%USERPROFILE%\.verwalter\verwalter.db` — `Database::open` führt Migrationen aus.
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::changes::{ChangesInput, sources};
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{
    Database, session_commits, session_files, session_repositories, session_ticket_worktrees,
};
use verwalter_lib::error::CommandError;
use verwalter_lib::git::status;
use verwalter_lib::worktrees;

const USAGE: &str = "Aufruf: git-probe <Datenbank-Kopie> <Session-ID> [<Schlüssel>]";

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let (Some(database_path), Some(session_id)) = (arguments.first(), arguments.get(1)) else {
        eprintln!("{USAGE}");
        return Ok(ExitCode::from(2));
    };
    let database_path = PathBuf::from(database_path);
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
            return Err(CommandError::Internal(format!(
                "Session {session_id} ist nicht aktiv oder unbekannt"
            )));
        };
        let repositories = session_repositories::load(connection, session_id)?;
        let session_ids = vec![session_id.clone()];
        let own = Ownership {
            commits: session_commits::load_for(connection, &session_ids)?,
            touched: session_files::load_for(connection, &session_ids)?,
            untracked_before: sessions::untracked_before(connection, &session_ids)?,
        };
        let remembered = session_ticket_worktrees::load(connection, session_id)?;
        let ticket_roots = worktrees::ticket_roots(&repositories);
        let ticket_folders = sources::scope_ticket_folders(&ticket_roots, remembered, &own.touched);
        Ok(ChangesInput {
            workspace: PathBuf::from(row.workspace_dir.clone().unwrap_or_default()),
            repositories,
            ticket_roots,
            ticket_folders,
            since_ms: row.created_at,
            own,
        })
    })?;

    let Some(key) = arguments.get(2) else {
        let status = status::session_status(&input, Vec::new());
        println!("{}", serde_json::to_string_pretty(&status)?);
        return Ok(ExitCode::SUCCESS);
    };
    match sources::find(&input, key).and_then(|source| status::branches(&source.dir)) {
        Ok(branches) => {
            println!("{}", serde_json::to_string_pretty(&branches)?);
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
