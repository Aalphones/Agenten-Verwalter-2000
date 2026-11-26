//! Prüft den Review-Bericht (ADR 073) gegen eine **Kopie** der Datenbank, ohne App und ohne
//! Registry. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example report-probe -- <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key>`
//! (druckt die Rohfassung der Phase)
//! bzw. `… -- <Datenbank-Kopie> <Umsetzungs-ID> tidy <Phasen-Key> [--haiku]` (druckt die Eingabe
//! an Haiku; mit `--haiku` zusätzlich Antwort und Prüfergebnis, ohne etwas zu speichern)
//! bzw. `… -- <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID>` (druckt den Ort, den ein
//! `report_note` ohne `at` jetzt bekäme, oder den Fehlersatz). Fehler als `FEHLER: <Satz>`.
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::agents::claude::locate::find_claude;
use verwalter_lib::agents::claude::print::{PrintRequest, run_print};
use verwalter_lib::agents::event::ModelId;
use verwalter_lib::changes::ChangesInput;
use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::changes::sources::{self, Source};
use verwalter_lib::db::implementations::{self, StoredImplementation};
use verwalter_lib::db::projects::{self, ProjectRow};
use verwalter_lib::db::report::{self as report_rows, EntryRow};
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{
    Database, chat_entries, session_commits, session_files, session_repositories,
    session_ticket_worktrees, tool_details,
};
use verwalter_lib::error::CommandError;
use verwalter_lib::implementation::build_view;
use verwalter_lib::implementation::model::{ImplementationView, PhaseView};
use verwalter_lib::report::tidy::{self, StationTrace, TidyAnswer};
use verwalter_lib::report::{anchor, raw};
use verwalter_lib::worktrees;

const USAGE: &str = "Aufruf: report-probe <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key> | <Datenbank-Kopie> <Umsetzungs-ID> tidy <Phasen-Key> [--haiku] | <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID>";
const HAIKU_FLAG: &str = "--haiku";

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
        [_, implementation_id, "tidy", phase_key] => {
            tidy_of(&database_path, implementation_id, phase_key, false)
        }
        [_, implementation_id, "tidy", phase_key, HAIKU_FLAG] => {
            tidy_of(&database_path, implementation_id, phase_key, true)
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

/// Eine Phase einer Umsetzung mit ihren Einträgen, nur aus der Datenbank.
struct LoadedPhase {
    view: ImplementationView,
    index: usize,
    entries: Vec<EntryRow>,
    labels: HashMap<String, String>,
}

impl LoadedPhase {
    fn phase(&self) -> &PhaseView {
        &self.view.phases[self.index]
    }
}

fn load_phase(
    database: &Database,
    implementation_id: &str,
    phase_key: &str,
) -> Result<LoadedPhase, String> {
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
    let index = view
        .phases
        .iter()
        .position(|phase: &PhaseView| phase.key == phase_key)
        .ok_or_else(|| format!("keine Phase „{phase_key}“ in der Umsetzung"))?;
    let phase_id = view.phases[index].id.clone();
    let entries: Vec<EntryRow> = entries
        .into_iter()
        .filter(|entry: &EntryRow| entry.phase_id == phase_id)
        .collect();
    let labels = raw::session_labels(&view, &numbers);
    Ok(LoadedPhase {
        view,
        index,
        entries,
        labels,
    })
}

fn raw_of(
    database_path: &Path,
    implementation_id: &str,
    phase_key: &str,
) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let loaded = load_phase(&database, implementation_id, phase_key)?;
    Ok(raw::raw_markdown(
        phase_key,
        &loaded.entries,
        &loaded.labels,
    ))
}

fn tidy_of(
    database_path: &Path,
    implementation_id: &str,
    phase_key: &str,
    asks_haiku: bool,
) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let loaded = load_phase(&database, implementation_id, phase_key)?;
    let to_order = tidy::to_order(&loaded.entries, &tidy::review_stations(loaded.phase()));
    let (traces, sources) = traces_of(&database, &loaded)?;
    let input = tidy::haiku_input(
        &raw::raw_markdown(phase_key, &loaded.entries, &loaded.labels),
        &to_order,
        &tidy::spur(&traces, &sources),
    );
    if !asks_haiku {
        return Ok(input);
    }
    if to_order.is_empty() {
        return Ok(format!("{input}\nNichts zu ordnen: kein Aufruf von Haiku."));
    }
    println!("{input}");
    // Nur die Claude-Kommandozeile; die übrigen Betriebsarten brauchen die Einstellungen der App.
    let exe = find_claude().ok_or_else(|| "Claude-Kommandozeile nicht gefunden".to_owned())?;
    let cwd = database_path
        .parent()
        .filter(|parent: &&Path| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let request = PrintRequest {
        model: ModelId::Haiku,
        system_prompt: tidy::TIDY_SYSTEM,
        json_schema: tidy::TIDY_SCHEMA,
        input: &input,
        local: None,
        leading_args: &[],
        codex: None,
    };
    let value = run_print(&exe, cwd, &request, tidy::TIDY_TIMEOUT)?;
    println!("## Antwort\n{value:#}\n");
    let answer: TidyAnswer = serde_json::from_value(value)
        .map_err(|error| format!("Antwort von Claude nicht lesbar: {error}"))?;
    if let Err(reason) = tidy::check(&answer, &to_order) {
        return Ok(format!("## Prüfung\nOrdnung verworfen: {reason}"));
    }
    let markdown = tidy::tidy_markdown(
        phase_key,
        &loaded.phase().title,
        &answer,
        &tidy::screen_numbers(&loaded.entries),
    );
    Ok(format!("## Prüfung\nbestanden\n\n{markdown}"))
}

/// Der Verlauf der Stationen der Spur und die Repository-Einträge der ersten noch aktiven davon.
fn traces_of(
    database: &Database,
    loaded: &LoadedPhase,
) -> Result<(Vec<StationTrace>, Vec<Source>), String> {
    let mut traces: Vec<StationTrace> = Vec::new();
    let mut found: Vec<Source> = Vec::new();
    for station in tidy::spur_stations(loaded.phase()) {
        let Some(session_id) = &station.session_id else {
            continue;
        };
        if found.is_empty()
            && let Ok(input) = database.with(|connection| project_input(connection, session_id))
        {
            found = sources::sources(&input);
        }
        let (entries, details) = database
            .with(|connection| {
                let entries = chat_entries::load_all(connection, session_id)?;
                let details = tool_details::load_summaries(connection, session_id)?;
                Ok((entries, details))
            })
            .map_err(text_of)?;
        traces.push(StationTrace {
            label: loaded
                .labels
                .get(session_id)
                .cloned()
                .unwrap_or_else(|| format!("#? {}", station.stage)),
            entries,
            details,
        });
    }
    Ok((traces, found))
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
