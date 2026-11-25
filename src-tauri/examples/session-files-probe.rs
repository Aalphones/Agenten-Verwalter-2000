//! Zeigt die „Session-Dateien“ eines Vorhabens aus einer **Kopie** der Datenbank (ADR 071). Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example session-files-probe -- <Datenbank-Kopie> <Session-ID>`.
//! Je Gruppe `#<Nr> <Name>`, je Datei `  <Ort> <Ordner> <Name> [w][l][x][fehlt] <Bytes>` (`w` =
//! geschrieben, `l` = verlinkt, `x` = ausführbar), danach Fehlersätze und `gekürzt`; die Dauer geht
//! nach stderr. Wie die App liest der erste Aufruf ältere Antworten nach und schreibt das in die
//! Kopie. Nie gegen `%USERPROFILE%\.verwalter\verwalter.db` — `Database::open` führt Migrationen aus.
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use verwalter_lib::changes::ChangesInput;
use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{Database, session_files, session_repositories, session_ticket_worktrees};
use verwalter_lib::error::CommandError;
use verwalter_lib::session_files::model::{
    MemberIdentity, SessionFile, SessionFileGroup, SessionFileOrigin, SessionFilesInput,
    SessionFilesListing,
};
use verwalter_lib::session_files::{collect_input, scan};
use verwalter_lib::worktrees::{self, TicketRoot};

const USAGE: &str = "Aufruf: session-files-probe <Datenbank-Kopie> <Session-ID>";

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
    let (members, changes) = scope_of(&database, session_id)?;
    let started = Instant::now();
    let input: SessionFilesInput = collect_input(&database, members, &changes)?;
    let collected = started.elapsed();
    let listing: SessionFilesListing = scan::listing(&input);
    eprintln!(
        "Eingabe {} ms, Liste {} ms",
        collected.as_millis(),
        (started.elapsed() - collected).as_millis()
    );
    for group in &listing.groups {
        print_group(group);
    }
    Ok(ExitCode::SUCCESS)
}

/// Die Sessions des Vorhabens (auch archivierte) und die Eingabe der Changes in Reichweite
/// Vorhaben, wie die Registry sie ohne laufende App bauen würde.
fn scope_of(
    database: &Database,
    session_id: &str,
) -> Result<(Vec<MemberIdentity>, ChangesInput), CommandError> {
    database.with(|connection| {
        let project_id: String = connection
            .query_row(
                "SELECT project_id FROM sessions WHERE id = ?1",
                [session_id],
                |row| row.get(0),
            )
            .map_err(|_| CommandError::Internal(format!("Session {session_id} ist unbekannt")))?;
        let rows: Vec<SessionRow> = sessions::load_for_project(connection, &project_id)?;
        let Some(own) = rows.iter().find(|row: &&SessionRow| row.id == session_id) else {
            return Err(CommandError::Internal(format!(
                "Session {session_id} ist unbekannt"
            )));
        };
        let ids: Vec<String> = rows.iter().map(|row: &SessionRow| row.id.clone()).collect();
        let repositories = session_repositories::load(connection, session_id)?;
        let mut remembered: Vec<(u32, String)> = Vec::new();
        for id in &ids {
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
        let touched = session_files::load_for(connection, &ids)?;
        let ticket_roots: Vec<TicketRoot> = worktrees::ticket_roots(&repositories);
        let ticket_folders = verwalter_lib::changes::sources::scope_ticket_folders(
            &ticket_roots,
            remembered,
            &touched,
        );
        let discovered = worktrees::discover(&repositories, &touched);
        let workspace = PathBuf::from(own.workspace_dir.clone().unwrap_or_default());
        let changes = ChangesInput {
            workspace,
            repositories,
            ticket_roots,
            ticket_folders,
            discovered,
            since_ms: own.created_at,
            own: Ownership {
                touched,
                ..Ownership::default()
            },
        };
        let members: Vec<MemberIdentity> = rows
            .iter()
            .map(|row: &SessionRow| MemberIdentity {
                session_id: row.id.clone(),
                number: row.number,
                name: row.name.clone(),
                workspace: PathBuf::from(row.workspace_dir.clone().unwrap_or_default()),
                is_own: row.id == session_id,
            })
            .collect();
        Ok((members, changes))
    })
}

fn print_group(group: &SessionFileGroup) {
    println!("#{} {}", group.number, group.name);
    for file in &group.files {
        println!("{}", line(file));
    }
    for error in &group.errors {
        println!("  {error}");
    }
    if group.truncated {
        println!("  gekürzt");
    }
}

fn line(file: &SessionFile) -> String {
    let origin: &str = match file.origin {
        SessionFileOrigin::Scratchpad => "scratchpad",
        SessionFileOrigin::CliScratchpad => "cliScratchpad",
        SessionFileOrigin::Elsewhere => "elsewhere",
    };
    let flags: String = [
        (file.written, "[w]"),
        (file.linked, "[l]"),
        (file.executable, "[x]"),
        (!file.exists, "[fehlt]"),
    ]
    .iter()
    .filter(|(is_set, _): &&(bool, &str)| *is_set)
    .map(|(_, flag): &(bool, &str)| *flag)
    .collect();
    let folder: &str = if file.folder.is_empty() {
        "-"
    } else {
        &file.folder
    };
    format!(
        "  {origin} {folder} {} {flags} {}",
        file.name,
        file.bytes
            .map_or_else(|| "-".to_owned(), |bytes: f64| bytes.to_string())
    )
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
