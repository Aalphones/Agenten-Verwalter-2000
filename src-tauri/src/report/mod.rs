//! Review-Bericht einer Umsetzung (ADR 073): Stationen hängen über die Werkzeuge `report_*`
//! Einträge an; die Zeilen liegen in `db::report`, die Bilder im Bericht-Ordner. Sind die
//! Agenten-Stationen einer Phase fertig, ordnet Haiku sie im Thread `report-tidy`; danach liest
//! derselbe Thread die Prüfwerte.
pub mod anchor;
pub mod assemble;
pub mod checks;
pub mod images;
pub mod model;
pub mod range;
pub mod raw;
pub mod tidy;
pub mod tools;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;

use tauri::{AppHandle, Emitter, Manager};

use crate::agents::claude::print::{HaikuRequest, ask_haiku, print_program};
use crate::artifacts::server::ArtifactServer;
use crate::changes::ChangesInput;
use crate::changes::model::ChangesReach;
use crate::changes::sources::{self, Source};
use crate::db::Database;
use crate::db::report::{EntryRow, PhaseRow};
use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::session_files::handles::ViewHandles;
use crate::sessions::registry::SessionRegistry;
use crate::settings::{self, model::Settings};
use assemble::AssembleContext;
use checks::{PhaseEvidence, SessionLog};
use model::{ReportChangedEvent, ReportPhaseState, ReportView};
use tidy::{StationTrace, TidyAnswer};

pub const REPORT_CHANGED_EVENT: &str = "report://changed";
const REPORTS_DIR_NAME: &str = "reports";
const TIDY_THREAD: &str = "report-tidy";
const UNKNOWN_PHASE: &str = "Phase nicht gefunden:";
const TIDY_REJECTED: &str = "Ordnung verworfen:";
const HAIKU_FAILED: &str = "Haiku nicht erreichbar:";

/// `<data_dir>\reports\<implementation_id>`; die Bilder liegen je Phase in einem Unterordner mit
/// deren ID (`phase_dir`), weil die Nummern der Einträge je Phase von vorn zählen.
pub fn report_dir(app: &AppHandle, implementation_id: &str) -> Result<PathBuf, CommandError> {
    Ok(data_dir(app)?
        .join(REPORTS_DIR_NAME)
        .join(implementation_id))
}

/// Der Ordner der Bilder einer Phase.
pub fn phase_dir(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
) -> Result<PathBuf, CommandError> {
    Ok(report_dir(app, implementation_id)?.join(phase_id))
}

/// Der Bericht der Umsetzung. Liest Datenbank und Git; nicht auf dem Haupt-Thread aufrufen.
pub fn load(app: &AppHandle, implementation_id: &str) -> Result<ReportView, CommandError> {
    let registry = app.state::<SessionRegistry>();
    let view = registry.implementation_view(implementation_id)?;
    let entries = registry.report_entries(implementation_id)?;
    let phases: Vec<PhaseRow> = registry.report_phases(implementation_id)?;
    let image_url = |phase_id: &str, file: &str| {
        phase_dir(app, implementation_id, phase_id)
            .ok()
            .and_then(|dir: PathBuf| url_of_image(app, &dir.join(file)))
            .unwrap_or_default()
    };
    let context = context_of(&registry, &view, &image_url)?;
    Ok(assemble::assemble(&view, &entries, &phases, &context))
}

/// Was Bericht und Prüfwerte neben den Zeilen der Datenbank aus den Sessions brauchen.
fn context_of<'a>(
    registry: &SessionRegistry,
    view: &ImplementationView,
    image_url: &'a (dyn Fn(&str, &str) -> String + Sync),
) -> Result<AssembleContext<'a>, CommandError> {
    let sessions = registry.report_sessions(view)?;
    let (checkouts, touched) =
        sessions
            .changes
            .map_or_else(Default::default, |input: ChangesInput| {
                (
                    range::checkouts(&sources::sources(&input)),
                    input.own.touched,
                )
            });
    Ok(AssembleContext {
        checkouts,
        commits: sessions.commits,
        touched,
        labels: raw::session_labels(view, &sessions.numbers),
        image_url,
    })
}

/// Die Adresse hinter einem frischen Handle des Datei-Servers (ADR 071); `None`, wenn es die Datei
/// oder den Server nicht gibt.
fn url_of_image(app: &AppHandle, file: &Path) -> Option<String> {
    let path = file.canonicalize().ok()?;
    let name = path.file_name()?.to_string_lossy().into_owned();
    let server = app.try_state::<ArtifactServer>()?;
    let handle = app.try_state::<ViewHandles>()?.issue(path);
    Some(server.raw_file_url(&handle, &name))
}

/// Die Umsetzung, zu der die Session als Station gehört, wenn deren Bericht etwas zu zeigen hat:
/// mindestens einen Eintrag oder eine fertige Phase.
pub fn of_session(app: &AppHandle, session_id: &str) -> Result<Option<String>, CommandError> {
    let registry = app.state::<SessionRegistry>();
    let Some((implementation_id, _)) = registry.station_of_session(session_id)? else {
        return Ok(None);
    };
    if !registry.report_entries(&implementation_id)?.is_empty() {
        return Ok(Some(implementation_id));
    }
    let has_done_phase = registry
        .implementation_view(&implementation_id)?
        .phases
        .iter()
        .any(|phase: &PhaseView| assemble::phase_state(phase) == ReportPhaseState::Done);
    Ok(has_done_phase.then_some(implementation_id))
}

/// Die Phasen, deren Ordnung gerade läuft; je Phase läuft höchstens ein Thread.
#[derive(Default)]
pub struct TidyRuns(Mutex<HashSet<String>>);

impl TidyRuns {
    fn claim(&self, phase_id: &str) -> bool {
        self.lock().insert(phase_id.to_owned())
    }

    fn release(&self, phase_id: &str) {
        self.lock().remove(phase_id);
    }

    fn lock(&self) -> MutexGuard<'_, HashSet<String>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Gibt die Phase auch dann frei, wenn der Thread abstürzt.
struct TidyClaim {
    app: AppHandle,
    phase_id: String,
}

impl Drop for TidyClaim {
    fn drop(&mut self) {
        self.app.state::<TidyRuns>().release(&self.phase_id);
    }
}

/// Startet die Ordnung, wenn die Station die letzte Agenten-Station ihrer Phase war. Stationen des
/// Benutzers zählen nicht: er liest den Bericht, bevor er abnimmt. Ein Fehler geht nur ins
/// Protokoll — die Fertigmeldung ist schon gespeichert.
pub fn on_station_completed(app: &AppHandle, implementation_id: &str, station_id: &str) {
    if is_switched_off(app) {
        return;
    }
    let outcome = app
        .state::<SessionRegistry>()
        .implementation_view(implementation_id)
        .and_then(
            |view: ImplementationView| match phase_finished_by(&view, station_id) {
                Some(phase) => start_phase_end(app, implementation_id, &phase.id),
                None => Ok(()),
            },
        );
    if let Err(error) = outcome {
        eprintln!("Bericht nach Station {station_id} nicht geordnet: {error}");
    }
}

/// Ob der Schalter „Review-Bericht“ aus ist; ohne Datenbank gilt er nicht als aus.
fn is_switched_off(app: &AppHandle) -> bool {
    let Some(database) = app.try_state::<Arc<Database>>() else {
        return false;
    };
    settings::load(&database).is_ok_and(|loaded: Settings| !loaded.report_enabled)
}

fn phase_finished_by<'a>(view: &'a ImplementationView, station_id: &str) -> Option<&'a PhaseView> {
    view.phases.iter().find(|phase: &&PhaseView| {
        let is_agent_station = phase
            .stations
            .iter()
            .any(|station: &StationView| station.id == station_id && !station.by_user);
        is_agent_station
            && phase
                .stations
                .iter()
                .filter(|station: &&StationView| !station.by_user)
                .all(|station: &StationView| station.completed_at.is_some())
    })
}

/// „Neu ordnen“: auch für eine Phase, die schon geordnet ist.
pub fn retidy(app: &AppHandle, phase_id: &str) -> Result<(), CommandError> {
    let implementation_id = app
        .state::<SessionRegistry>()
        .implementation_of_phase(phase_id)?
        .ok_or_else(|| CommandError::Implementation(format!("{UNKNOWN_PHASE} {phase_id}")))?;
    start_phase_end(app, &implementation_id, phase_id)
}

/// Läuft die Phase schon, passiert nichts.
fn start_phase_end(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
) -> Result<(), CommandError> {
    if !app.state::<TidyRuns>().claim(phase_id) {
        return Ok(());
    }
    // Scheitert der Start, fällt der Anspruch mit der verworfenen Closure.
    let claim = TidyClaim {
        app: app.clone(),
        phase_id: phase_id.to_owned(),
    };
    let implementation_id = implementation_id.to_owned();
    thread::Builder::new()
        .name(TIDY_THREAD.to_owned())
        .spawn(move || {
            if let Err(error) = run_phase_end(&claim.app, &implementation_id, &claim.phase_id) {
                eprintln!(
                    "Bericht der Phase {} nicht geordnet: {error}",
                    claim.phase_id
                );
            }
        })?;
    Ok(())
}

/// Ordnet die Phase und ermittelt danach ihre Prüfwerte; scheitert eines, läuft das andere
/// trotzdem. Liest Datenbank, Git, Dateien und das Modell, ohne dabei eine Sperre zu halten.
fn run_phase_end(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
) -> Result<(), CommandError> {
    let registry = app.state::<SessionRegistry>();
    let view = registry.implementation_view(implementation_id)?;
    let (index, phase) = view
        .phases
        .iter()
        .enumerate()
        .find(|(_, phase): &(usize, &PhaseView)| phase.id == phase_id)
        .ok_or_else(|| CommandError::Implementation(format!("{UNKNOWN_PHASE} {phase_id}")))?;
    let entries: Vec<EntryRow> = registry
        .report_entries(implementation_id)?
        .into_iter()
        .filter(|entry: &EntryRow| entry.phase_id == phase_id)
        .collect();
    let tidied = tidy_phase(app, &view, phase, &entries);
    emit_changed(app, implementation_id);
    let checked = check_phase(&registry, &view, index, &entries);
    emit_changed(app, implementation_id);
    if let (Err(_), Err(also)) = (&tidied, &checked) {
        eprintln!("Bericht der Phase {phase_id}: Prüfwerte nicht ermittelt: {also}");
    }
    tidied.and(checked)
}

fn emit_changed(app: &AppHandle, implementation_id: &str) {
    // Ohne Fenster geht nichts verloren: die Oberfläche lädt beim Öffnen.
    let _ = app.emit(
        REPORT_CHANGED_EVENT,
        ReportChangedEvent {
            implementation_id: implementation_id.to_owned(),
        },
    );
}

/// Ermittelt und speichert die Prüfwerte der Phase an Position `index`; `entries` sind ihre
/// Einträge.
fn check_phase(
    registry: &SessionRegistry,
    view: &ImplementationView,
    index: usize,
    entries: &[EntryRow],
) -> Result<(), CommandError> {
    let phase = &view.phases[index];
    let no_images = |_: &str, _: &str| String::new();
    let context = context_of(registry, view, &no_images)?;
    let entries: Vec<&EntryRow> = entries.iter().collect();
    let catalog = assemble::catalog_of(&context);
    let ranges = assemble::ranges_of_phase(view, index, &entries, &context, &catalog);
    let mut sessions: Vec<SessionLog> = Vec::new();
    for session_id in phase
        .stations
        .iter()
        .filter_map(|station: &StationView| station.session_id.as_ref())
    {
        let (entries, details) = registry.history_of(session_id)?;
        sessions.push(SessionLog {
            session_id: session_id.clone(),
            entries,
            details,
        });
    }
    let files = checks::time_window(phase).map_or_else(Vec::new, |(since, until)| {
        checks::find_files(&checks::folders(&ranges), since, until)
    });
    let found = checks::phase_checks(&PhaseEvidence {
        sessions: &sessions,
        ranges: &ranges,
        files: &files,
        labels: &context.labels,
    });
    let json =
        serde_json::to_string(&found).map_err(|error| CommandError::Internal(error.to_string()))?;
    registry.store_report_checks(&view.id, &phase.id, &json)
}

/// Speichert die geordnete Fassung oder den Grund, warum es keine neue gibt. Ohne etwas zu ordnen
/// entfällt der Aufruf von Haiku.
fn tidy_phase(
    app: &AppHandle,
    view: &ImplementationView,
    phase: &PhaseView,
    entries: &[EntryRow],
) -> Result<(), CommandError> {
    let registry = app.state::<SessionRegistry>();
    let to_order = tidy::to_order(entries, &tidy::review_stations(phase));
    if to_order.is_empty() {
        return registry.store_report_tidy_error(&view.id, &phase.id, None);
    }
    let input = haiku_input_of(&registry, view, phase, entries, &to_order)?;
    let answer = print_program(app)
        .map_err(|error: CommandError| error.to_string())
        .and_then(|program| {
            ask_haiku::<TidyAnswer>(
                app,
                &program,
                &HaikuRequest {
                    system_prompt: tidy::TIDY_SYSTEM,
                    json_schema: tidy::TIDY_SCHEMA,
                    input: &input,
                    timeout: tidy::TIDY_TIMEOUT,
                },
            )
        });
    let checked = match answer {
        Ok(answer) => tidy::check(&answer, &to_order)
            .map(|()| answer)
            .map_err(|reason: String| format!("{TIDY_REJECTED} {reason}")),
        Err(failure) => Err(format!("{HAIKU_FAILED} {failure}")),
    };
    match checked {
        Ok(answer) => {
            let markdown = tidy::tidy_markdown(
                &phase.key,
                &phase.title,
                &answer,
                &tidy::screen_numbers(entries),
            );
            let json = serde_json::to_string(&answer)
                .map_err(|error| CommandError::Internal(error.to_string()))?;
            let highest = entries
                .iter()
                .map(|entry: &EntryRow| entry.number)
                .max()
                .unwrap_or_default();
            registry.store_report_tidy(&view.id, &phase.id, &markdown, &json, highest)
        }
        Err(message) => registry.store_report_tidy_error(&view.id, &phase.id, Some(&message)),
    }
}

fn haiku_input_of(
    registry: &SessionRegistry,
    view: &ImplementationView,
    phase: &PhaseView,
    entries: &[EntryRow],
    to_order: &[u32],
) -> Result<String, CommandError> {
    // Die Ansicht nennt nur die Nummern geladener Sessions; die übrigen stehen als „#?“ da.
    let labels = raw::session_labels(view, &Default::default());
    let mut traces: Vec<StationTrace> = Vec::new();
    let mut sources: Option<Vec<Source>> = None;
    for station in tidy::spur_stations(phase) {
        let Some(session_id) = &station.session_id else {
            continue;
        };
        if sources.is_none() {
            // Für eine archivierte Session gibt es keine Changes; dann hilft die nächste.
            sources = registry
                .changes_input(session_id, ChangesReach::Project)
                .ok()
                .map(|input| sources::sources(&input));
        }
        let (history, details) = registry.history_of(session_id)?;
        traces.push(StationTrace {
            label: labels
                .get(session_id)
                .cloned()
                .unwrap_or_else(|| format!("#? {}", station.stage)),
            entries: history,
            details,
        });
    }
    Ok(tidy::haiku_input(
        &raw::raw_markdown(&phase.key, entries, &labels),
        to_order,
        &tidy::spur(&traces, &sources.unwrap_or_default()),
    ))
}
