//! Prüft den Review-Bericht (ADR 073) gegen eine **Kopie** der Datenbank, ohne App und ohne
//! Registry. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example report-probe -- <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key>`
//! (druckt die Rohfassung der Phase)
//! bzw. `… -- <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID>` (druckt den Ort, den ein
//! `report_note` ohne `at` jetzt bekäme, oder den Fehlersatz). Fehler als `FEHLER: <Satz>`.
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::changes::{ChangesInput, sources};
use verwalter_lib::db::implementations::{self, StoredImplementation};
use verwalter_lib::db::projects::{self, ProjectRow};
use verwalter_lib::db::report::{self as report_rows, EntryRow};
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{
    Database, session_commits, session_files, session_repositories, session_ticket_worktrees,
};
use verwalter_lib::error::CommandError;
use verwalter_lib::implementation::build_view;
use verwalter_lib::implementation::model::PhaseView;
use verwalter_lib::report::{anchor, raw};
use verwalter_lib::worktrees;

const USAGE: &str = "Aufruf: report-probe <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key> | <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID>";

fn main() -> ExitCode {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();
    let Some(database_path) = arguments.first().map(PathBuf::from) else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    // `Database::open` führt Migrationen aus: gegen die Datenbank der App liefe das neben ihr her.
    if is_app_database(&database_path) {
        eprintln!(
            "Nur gegen eine Kopie: {} ist die Datenbank der App.",
            database_path.display()
        );
        return ExitCode::from(2);
    }
    let outcome = match arguments.as_slice() {
        [_, implementation_id, "raw", phase_key] => {
            raw_of(&database_path, implementation_id, phase_key)
        }
        [_, "anchor", session_id] | [_, _, "anchor", session_id] => {
            anchor_of(&database_path, session_id)
        }
        _ => {
            eprintln!("{USAGE}");
            return ExitCode::from(2);
        }
    };
    match outcome {
        Ok(text) => {
            println!("{text}");
            ExitCode::SUCCESS
        }
        Err(message) => {
            println!("FEHLER: {message}");
            ExitCode::from(1)
        }
    }
}

fn raw_of(
    database_path: &Path,
    implementation_id: &str,
    phase_key: &str,
) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let (stored, entries, numbers) = database
        .with(|connection| {
            let stored: StoredImplementation =
                implementations::load(connection, implementation_id)?.ok_or_else(|| {
                    CommandError::Internal(format!("Umsetzung nicht gefunden: {implementation_id}"))
                })?;
            let entries = report_rows::load_entries(connection, implementation_id)?;
            // Archivierte Sessions kennt die Abfrage nicht; sie stehen als „#?“ da.
            let numbers: HashMap<String, u32> = sessions::load_active(connection)?
                .into_iter()
                .map(|row: SessionRow| (row.id, row.number))
                .collect();
            Ok((stored, entries, numbers))
        })
        .map_err(text_of)?;
    let view = build_view(&stored, &HashMap::new(), &numbers, &HashMap::new());
    let phase_id = view
        .phases
        .iter()
        .find(|phase: &&PhaseView| phase.key == phase_key)
        .map(|phase: &PhaseView| phase.id.clone())
        .ok_or_else(|| format!("keine Phase „{phase_key}“ in der Umsetzung"))?;
    let of_phase: Vec<EntryRow> = entries
        .into_iter()
        .filter(|entry: &EntryRow| entry.phase_id == phase_id)
        .collect();
    Ok(raw::raw_markdown(
        phase_key,
        &of_phase,
        &raw::session_labels(&view, &numbers),
    ))
}

fn anchor_of(database_path: &Path, session_id: &str) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let input = database
        .with(|connection| project_input(connection, session_id))
        .map_err(text_of)?;
    let (entries, details) = database
        .with(|connection| anchor::load_last_write(connection, session_id))
        .map_err(text_of)?;
    let (file, from, to) = anchor::last_edit_anchor(&entries, &details, anchor::read_text)?;
    let resolved = anchor::resolve_path(&sources::sources(&input), &file.to_string_lossy())?;
    let content = anchor::read_text(&resolved.absolute).unwrap_or_default();
    let lines = anchor::lines_text(&content, from, to).unwrap_or_default();
    Ok(format!(
        "Repository {} · {}:{from}-{to}\n{lines}",
        resolved.repository_key, resolved.path
    ))
}

/// Wie `SessionRegistry::changes_input` mit der Reichweite „Vorhaben“, nur aus der Datenbank.
fn project_input(
    connection: &mut rusqlite::Connection,
    session_id: &str,
) -> Result<ChangesInput, CommandError> {
    let rows = sessions::load_active(connection)?;
    let Some(row) = rows.iter().find(|row: &&SessionRow| row.id == session_id) else {
        return Err(CommandError::Internal(format!(
            "Session {session_id} ist nicht aktiv oder unbekannt"
        )));
    };
    let repositories = session_repositories::load(connection, session_id)?;
    let session_ids: Vec<String> = rows
        .iter()
        .filter(|other: &&SessionRow| other.project_id == row.project_id)
        .map(|other: &SessionRow| other.id.clone())
        .collect();
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
    let since_ms = projects::load_active(connection)?
        .iter()
        .find(|project: &&ProjectRow| project.id == row.project_id)
        .map_or(row.created_at, |project: &ProjectRow| project.created_at);
    let ticket_roots = worktrees::ticket_roots(&repositories);
    let discovered = worktrees::discover(&repositories, &own.touched);
    let ticket_folders = sources::scope_ticket_folders(&ticket_roots, remembered, &own.touched);
    Ok(ChangesInput {
        workspace: PathBuf::from(row.workspace_dir.clone().unwrap_or_default()),
        repositories,
        ticket_roots,
        ticket_folders,
        discovered,
        since_ms,
        own,
    })
}

fn text_of(error: CommandError) -> String {
    error.to_string()
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
