//! Prüft den Review-Bericht (ADR 073) gegen eine **Kopie** der Datenbank, ohne App und ohne
//! Registry. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example report-probe -- <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key>`
//! (druckt die Rohfassung der Phase)
//! bzw. `… -- <Datenbank-Kopie> <Umsetzungs-ID> tidy <Phasen-Key> [--haiku]` (druckt die Eingabe
//! an Haiku; mit `--haiku` zusätzlich Antwort und Prüfergebnis, ohne etwas zu speichern)
//! bzw. `… -- <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID>` (druckt den Ort, den ein
//! `report_note` ohne `at` jetzt bekäme, oder den Fehlersatz)
//! bzw. `… -- <Datenbank-Kopie> <Umsetzungs-ID> view` (druckt den Bericht, wie ihn `report_load`
//! zusammensetzt; die Dauer geht nach stderr)
//! bzw. `… -- <Datenbank-Kopie> <Umsetzungs-ID> checks <Phasen-Key>` (druckt die Ordner der
//! Suche, die gefundenen Berichtsdateien, die Prüfwerte und die Lücken, ohne zu speichern).
//! Fehler als `FEHLER: <Satz>`.
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use verwalter_lib::agents::claude::locate::find_claude;
use verwalter_lib::agents::claude::print::{PrintRequest, run_print};
use verwalter_lib::agents::event::ModelId;
use verwalter_lib::changes::ChangesInput;
use verwalter_lib::changes::attribution::Ownership;
use verwalter_lib::changes::sources::{self, Source};
use verwalter_lib::db::implementations::{self, StoredImplementation};
use verwalter_lib::db::projects::{self, ProjectRow};
use verwalter_lib::db::report::{self as report_rows, EntryRow, PhaseRow};
use verwalter_lib::db::sessions::{self, SessionRow};
use verwalter_lib::db::{
    Database, chat_entries, session_commits, session_files, session_repositories,
    session_ticket_worktrees, tool_details,
};
use verwalter_lib::error::CommandError;
use verwalter_lib::implementation::build_view;
use verwalter_lib::implementation::model::{ImplementationView, PhaseView, StationView};
use verwalter_lib::report::assemble::{self, AssembleContext};
use verwalter_lib::report::checks::{self, PhaseEvidence, SessionLog};
use verwalter_lib::report::model::{
    PhaseChecks, ReportBlock, ReportCode, ReportNote, ReportPhase, ReportRow, ReportRowKind,
    ReportScreen, ReportShot, ReportStop, ReportView,
};
use verwalter_lib::report::tidy::{self, StationTrace, TidyAnswer};
use verwalter_lib::report::{anchor, range, raw};
use verwalter_lib::worktrees;

const USAGE: &str = "Aufruf: report-probe <Datenbank-Kopie> <Umsetzungs-ID> raw <Phasen-Key> | <Datenbank-Kopie> <Umsetzungs-ID> tidy <Phasen-Key> [--haiku] | <Datenbank-Kopie> [<Umsetzungs-ID>] anchor <Session-ID> | <Datenbank-Kopie> <Umsetzungs-ID> view | <Datenbank-Kopie> <Umsetzungs-ID> checks <Phasen-Key>";
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
        [_, implementation_id, "view"] => view_of(&database_path, implementation_id),
        [_, implementation_id, "checks", phase_key] => {
            checks_of(&database_path, implementation_id, phase_key)
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
            && let Ok(input) = database.with(|connection| active_input(connection, session_id))
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
        .with(|connection| active_input(connection, session_id))
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

/// Die Changes-Eingabe, wie die Werkzeuge einer laufenden Station sie sehen.
fn active_input(
    connection: &mut rusqlite::Connection,
    session_id: &str,
) -> Result<ChangesInput, CommandError> {
    let rows = sessions::load_active(connection)?;
    project_input(connection, &rows, session_id)
}

/// Wie `SessionRegistry::changes_input` mit der Reichweite „Vorhaben“, nur aus der Datenbank;
/// `rows` sind die Sessions, die als geladen gelten.
fn project_input(
    connection: &mut rusqlite::Connection,
    rows: &[SessionRow],
    session_id: &str,
) -> Result<ChangesInput, CommandError> {
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

/// Alles, woraus `report_load` den Bericht setzt, auch für eine archivierte Umsetzung: alle
/// Sessions des Vorhabens gelten als geladen. Bild-Adressen sind hier `<Phasen-ID>/<Datei>`.
struct LoadedReport {
    view: ImplementationView,
    entries: Vec<EntryRow>,
    phases: Vec<PhaseRow>,
    context: AssembleContext<'static>,
}

fn load_report(database: &Database, implementation_id: &str) -> Result<LoadedReport, String> {
    let (stored, entries, phases, rows) = database
        .with(|connection| {
            let stored: StoredImplementation =
                implementations::load(connection, implementation_id)?.ok_or_else(|| {
                    CommandError::Internal(format!("Umsetzung nicht gefunden: {implementation_id}"))
                })?;
            let entries = report_rows::load_entries(connection, implementation_id)?;
            let phases = report_rows::load_phases(connection, implementation_id)?;
            let rows = sessions::load_for_project(connection, &stored.row.project_id)?;
            Ok((stored, entries, phases, rows))
        })
        .map_err(text_of)?;
    let numbers: HashMap<String, u32> = rows
        .iter()
        .map(|row: &SessionRow| (row.id.clone(), row.number))
        .collect();
    let view = build_view(&stored, &HashMap::new(), &numbers, &HashMap::new());
    let stations: Vec<String> = view
        .phases
        .iter()
        .flat_map(|phase: &PhaseView| &phase.stations)
        .filter_map(|station: &StationView| station.session_id.clone())
        .collect();
    let commits = database
        .with(|connection| session_commits::load_by_session(connection, &stations))
        .map_err(text_of)?;
    let input = stations.iter().rev().find_map(|session_id: &String| {
        database
            .with(|connection| project_input(connection, &rows, session_id))
            .ok()
    });
    let (checkouts, touched) = input.map_or_else(Default::default, |input: ChangesInput| {
        (
            range::checkouts(&sources::sources(&input)),
            input.own.touched,
        )
    });
    let labels = raw::session_labels(&view, &numbers);
    Ok(LoadedReport {
        view,
        entries,
        phases,
        context: AssembleContext {
            checkouts,
            commits,
            touched,
            labels,
            image_url: &image_path,
        },
    })
}

fn image_path(phase_id: &str, file: &str) -> String {
    format!("{phase_id}/{file}")
}

fn view_of(database_path: &Path, implementation_id: &str) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let started = Instant::now();
    let loaded = load_report(&database, implementation_id)?;
    let report = assemble::assemble(
        &loaded.view,
        &loaded.entries,
        &loaded.phases,
        &loaded.context,
    );
    eprintln!("Dauer: {} ms", started.elapsed().as_millis());
    Ok(printed(&report))
}

/// Die Prüfwerte einer Phase, wie das Phasenende sie ermittelt, ohne sie zu speichern.
fn checks_of(
    database_path: &Path,
    implementation_id: &str,
    phase_key: &str,
) -> Result<String, String> {
    let database = Database::open(database_path).map_err(text_of)?;
    let loaded = load_report(&database, implementation_id)?;
    let (index, phase) = loaded
        .view
        .phases
        .iter()
        .enumerate()
        .find(|(_, phase): &(usize, &PhaseView)| phase.key == phase_key)
        .ok_or_else(|| format!("keine Phase „{phase_key}“ in der Umsetzung"))?;
    let started = Instant::now();
    let entries: Vec<&EntryRow> = loaded
        .entries
        .iter()
        .filter(|entry: &&EntryRow| entry.phase_id == phase.id)
        .collect();
    let catalog = assemble::catalog_of(&loaded.context);
    let ranges =
        assemble::ranges_of_phase(&loaded.view, index, &entries, &loaded.context, &catalog);
    let mut histories: Vec<SessionLog> = Vec::new();
    for session_id in phase
        .stations
        .iter()
        .filter_map(|station: &StationView| station.session_id.as_ref())
    {
        let (entries, details) = database
            .with(|connection| {
                Ok((
                    chat_entries::load_all(connection, session_id)?,
                    tool_details::load_summaries(connection, session_id)?,
                ))
            })
            .map_err(text_of)?;
        histories.push(SessionLog {
            session_id: session_id.clone(),
            entries,
            details,
        });
    }
    let folders = checks::folders(&ranges);
    let files = checks::time_window(phase).map_or_else(Vec::new, |(since, until)| {
        checks::find_files(&folders, since, until)
    });
    let found = checks::phase_checks(&PhaseEvidence {
        sessions: &histories,
        ranges: &ranges,
        files: &files,
        labels: &loaded.context.labels,
    });
    eprintln!("Dauer: {} ms", started.elapsed().as_millis());

    let mut lines: Vec<String> = folders
        .iter()
        .map(|folder: &PathBuf| format!("Ordner: {}", folder.display()))
        .collect();
    lines.extend(
        files
            .iter()
            .map(|file: &PathBuf| format!("Datei: {}", file.display())),
    );
    print_checks(&found, &mut lines);
    Ok(lines.join("\n"))
}

fn print_checks(found: &PhaseChecks, lines: &mut Vec<String>) {
    lines.push(format!(
        "Prüfwerte von {} · Quellen: {}",
        found.by,
        found.sources.join(" · ")
    ));
    lines.push(match &found.chain {
        Some(run) => format!("Prüfkette: {} ok={}", run.command, run.ok),
        None => "Prüfkette: kein Lauf".to_owned(),
    });
    lines.push(match &found.tests {
        Some(tests) => format!(
            "Tests: {} bestanden, {} fehlgeschlagen, {} übersprungen",
            tests.passed, tests.failed, tests.skipped
        ),
        None => "Tests: kein Bericht".to_owned(),
    });
    lines.push(match &found.coverage {
        Some(coverage) => format!(
            "Abdeckung neuer Zeilen: {} von {}",
            coverage.covered, coverage.total
        ),
        None => "Abdeckung: keine Zahlen".to_owned(),
    });
    lines.push(match &found.mutation {
        Some(mutation) => format!(
            "Mutation: {} erkannt, {} überlebt",
            mutation.killed, mutation.survived
        ),
        None => "Mutation: keine Zahlen".to_owned(),
    });
    for gap in &found.gaps {
        lines.push(format!(
            "Lücke {:?} {} {}:{}-{} {}",
            gap.kind, gap.repository_key, gap.path, gap.from, gap.to, gap.text
        ));
    }
}

fn printed(report: &ReportView) -> String {
    let mut lines: Vec<String> = Vec::new();
    for phase in &report.phases {
        print_phase(phase, &mut lines);
    }
    lines.push(match &report.acceptance {
        Some(acceptance) => format!("Abnahme: {:?}", acceptance.state),
        None => "Abnahme: keine".to_owned(),
    });
    lines.join("\n")
}

fn print_phase(phase: &ReportPhase, lines: &mut Vec<String>) {
    lines.push(format!(
        "== Phase {} · {} [{:?}] · {}",
        phase.key, phase.title, phase.state, phase.station_label
    ));
    lines.push(format!(
        "{} Dateien, +{}/−{}, Commits: {} · Einträge: {} · {}",
        phase.files,
        phase.added,
        phase.removed,
        phase.commits.join(" "),
        phase.entries,
        if phase.ordered { "geordnet" } else { "roh" }
    ));
    if let Some(error) = &phase.tidy_error {
        lines.push(format!("Ordnung: {error}"));
    }
    if let Some(result) = &phase.result {
        lines.push(format!("Ergebnis: {result}"));
    }
    for step in &phase.way {
        lines.push(format!("Weg (Stopp {:?}): {}", step.stop, step.text));
    }
    for screen in &phase.screens {
        print_screen(screen, lines);
    }
    for stop in &phase.stops {
        print_stop(stop, lines);
    }
    if let Some(found) = &phase.checks {
        print_checks(found, lines);
    }
    if let Some(review) = &phase.review {
        lines.push(format!(
            "Review {}: {} offen, {} behoben, {} Schaubilder",
            review.by,
            review.open.len(),
            review.resolved.len(),
            review.figures.len()
        ));
        for finding in review.open.iter().chain(&review.resolved) {
            let place = finding
                .location
                .as_ref()
                .map(|at| format!("{} {}:{}", at.repository_key, at.path, at.line));
            lines.push(format!(
                "  n{} Stopp {:?}, behoben durch {:?}, Ort {place:?}: {}",
                finding.entry, finding.stop, finding.resolved_by, finding.text
            ));
        }
    }
}

fn print_screen(screen: &ReportScreen, lines: &mut Vec<String>) {
    let shots: Vec<String> = screen
        .shots
        .iter()
        .map(|shot: &ReportShot| {
            format!(
                "{} {}×{} schmal={} Entwurf={}",
                shot.label,
                shot.image.width,
                shot.image.height,
                shot.narrow,
                shot.design.is_some()
            )
        })
        .collect();
    lines.push(format!(
        "Sichtabnahme n{} {} ({}) · {} · Abweichung: {} · {} Schritte",
        screen.entry,
        screen.name,
        screen.by,
        shots.join(", "),
        screen.deviation.as_deref().unwrap_or("keine"),
        screen.steps.len()
    ));
}

fn print_stop(stop: &ReportStop, lines: &mut Vec<String>) {
    lines.push(format!(
        "Stopp {} „{}“ ({}) · {}",
        stop.index, stop.title, stop.kind, stop.by
    ));
    if let Some(lead) = &stop.lead {
        lines.push(format!("  Warum n{}: {}", lead.entry, lead.text));
    }
    for block in &stop.blocks {
        match block {
            ReportBlock::Figure(figure) => {
                lines.push(format!("  Schaubild n{}: {}", figure.entry, figure.caption));
            }
            ReportBlock::Code(code) => print_code(code, lines),
        }
    }
}

fn print_code(code: &ReportCode, lines: &mut Vec<String>) {
    let count_of = |kind: ReportRowKind| {
        code.rows
            .iter()
            .filter(|row: &&ReportRow| row.kind == kind)
            .count()
    };
    lines.push(format!(
        "  Block {}:{} +{}/−{} · Zeilen: {} neu, {} unverändert, {} entfernt",
        code.repository_key,
        code.path,
        code.added,
        code.removed,
        count_of(ReportRowKind::Add),
        count_of(ReportRowKind::Context),
        count_of(ReportRowKind::Removed)
    ));
    for note in &code.notes {
        print_note(note, lines);
    }
    if !code.uncovered.is_empty() {
        lines.push(format!("    ohne Test: {:?}", code.uncovered));
    }
}

fn print_note(note: &ReportNote, lines: &mut Vec<String>) {
    lines.push(format!(
        "    ({}) {:?} Z. {}–{} offen={:?} verschoben={} · {}: {}",
        note.label, note.kind, note.from, note.to, note.open, note.moved, note.by, note.text
    ));
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
