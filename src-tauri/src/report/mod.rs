//! Review-Bericht einer Umsetzung (ADR 073): Stationen hängen über die Werkzeuge `report_*`
//! Einträge an; die Zeilen liegen in `db::report`, die Bilder im Bericht-Ordner. Sind die
//! Agenten-Stationen einer Phase fertig, ordnet Haiku sie im Thread `report-tidy`; danach liest
//! derselbe Thread die Prüfwerte. Auf Wunsch ordnet Haiku auch eine laufende Phase, dann ohne
//! Prüfwerte (ADR 075).
pub mod anchor;
pub mod assemble;
pub mod checks;
pub mod images;
pub mod model;
pub mod outside;
pub mod range;
pub mod raw;
pub mod tidy;
pub mod tools;
pub mod way;

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;

use tauri::{AppHandle, Emitter, Manager};

use crate::agents::claude::print::{CANCELLED, HaikuRequest, ask_haiku, print_program};
use crate::agents::event::ChatEntry;
use crate::artifacts::server::ArtifactServer;
use crate::changes::ChangesInput;
use crate::changes::model::ChangesReach;
use crate::changes::sources::{self, Source};
use crate::db::Database;
use crate::db::report::{EntryRow, PhaseRow};
use crate::db::session_files::SessionFileRow;
use crate::db::tool_details::ToolSummary;
use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::implementation::now_ms;
use crate::session_files::handles::ViewHandles;
use crate::sessions::registry::SessionRegistry;
use crate::settings::{self, model::Settings};
use assemble::AssembleContext;
use checks::{PhaseEvidence, SessionLog};
use model::{ReportChangedEvent, ReportPhaseState, ReportView};
use tidy::{ExplainStop, StationTrace, TidyAnswer, Unexplained};

pub const REPORT_CHANGED_EVENT: &str = "report://changed";
const REPORTS_DIR_NAME: &str = "reports";
const TIDY_THREAD: &str = "report-tidy";
const UNKNOWN_PHASE: &str = "Phase nicht gefunden:";
const TIDY_REJECTED: &str = "Ordnung verworfen:";
const HAIKU_FAILED: &str = "Haiku nicht erreichbar:";
/// Der Fehlertext, mit dem die erste Fertigmeldung ohne Bericht zurückgeht (`completion_gap`).
pub const NO_REPORT_HINT: &str = "Du hast Dateien geändert, aber nichts im Review-Bericht erklärt. Erkläre deine Änderungen jetzt mit mcp__verwalter__report_note (das Warum in zwei, drei Sätzen, at auf die Stelle) und melde dann erneut fertig. Eine zweite Meldung ohne Erklärung geht durch.";

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
    let mut context = context_of(&registry, &view, &image_url)?;
    context.traces = unordered_traces(&view, &phases, &context.labels, |session_id: &str| {
        registry.history_of(session_id)
    })?;
    let runs = app.state::<TidyRuns>();
    context.tidying = view
        .phases
        .iter()
        .filter_map(|phase: &PhaseView| Some((phase.id.clone(), runs.since(&phase.id)?)))
        .collect();
    Ok(assemble::assemble(&view, &entries, &phases, &context))
}

/// Was Bericht und Prüfwerte neben den Zeilen der Datenbank aus den Sessions brauchen.
fn context_of<'a>(
    registry: &SessionRegistry,
    view: &ImplementationView,
    image_url: &'a (dyn Fn(&str, &str) -> String + Sync),
) -> Result<AssembleContext<'a>, CommandError> {
    let sessions = registry.report_sessions(view)?;
    let mut context = AssembleContext {
        checkouts: Vec::new(),
        commits: sessions.commits,
        touched: HashMap::new(),
        written_as: HashMap::new(),
        labels: raw::session_labels(view, &sessions.numbers),
        files: sessions.files,
        tidying: HashMap::new(),
        traces: HashMap::new(),
        image_url,
    };
    if let Some(input) = sessions.changes {
        add_repositories(view, input, &mut context);
    }
    Ok(context)
}

/// Hängt die Repository-Einträge der Changes an `context` und dahinter die Repositorys außerhalb
/// des Vorhabens, in die Stationen geschrieben haben. `context.commits` und `context.files` müssen
/// schon stehen.
pub fn add_repositories(
    view: &ImplementationView,
    input: ChangesInput,
    context: &mut AssembleContext<'_>,
) {
    let found = sources::sources(&input);
    let known_dirs: Vec<PathBuf> = found
        .iter()
        .map(|source: &Source| source.dir.clone())
        .collect();
    context.checkouts = range::checkouts(&found);
    context.touched = input.own.touched;
    outside::extend(view, &known_dirs, context);
}

/// Je Phase ohne gültige Ordnung der Verlauf ihrer Spur, für den Weg aus dem Verlauf.
pub fn unordered_traces(
    view: &ImplementationView,
    rows: &[PhaseRow],
    labels: &HashMap<String, String>,
    mut history_of: impl FnMut(
        &str,
    )
        -> Result<(Vec<ChatEntry>, HashMap<String, ToolSummary>), CommandError>,
) -> Result<HashMap<String, Vec<StationTrace>>, CommandError> {
    let is_ordered = |phase_id: &str| {
        rows.iter()
            .find(|row: &&PhaseRow| row.phase_id == phase_id)
            .and_then(|row: &PhaseRow| row.tidy_json.as_deref())
            .is_some_and(|json: &str| serde_json::from_str::<TidyAnswer>(json).is_ok())
    };
    view.phases
        .iter()
        .filter(|phase: &&PhaseView| !is_ordered(&phase.id))
        .map(|phase: &PhaseView| {
            let traces = traces_of(phase, labels, &mut history_of)?;
            Ok((phase.id.clone(), traces))
        })
        .collect()
}

/// Der Verlauf der Stationen der Spur in ihrer Folge.
fn traces_of(
    phase: &PhaseView,
    labels: &HashMap<String, String>,
    mut history_of: impl FnMut(
        &str,
    )
        -> Result<(Vec<ChatEntry>, HashMap<String, ToolSummary>), CommandError>,
) -> Result<Vec<StationTrace>, CommandError> {
    let mut traces: Vec<StationTrace> = Vec::new();
    for station in tidy::spur_stations(phase) {
        let Some(session_id) = &station.session_id else {
            continue;
        };
        let (entries, details) = history_of(session_id)?;
        traces.push(StationTrace {
            label: labels
                .get(session_id)
                .cloned()
                .unwrap_or_else(|| format!("#? {}", station.stage)),
            entries,
            details,
        });
    }
    Ok(traces)
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
pub struct TidyRuns(Mutex<HashMap<String, TidyRun>>);

/// Eine laufende Ordnung.
struct TidyRun {
    implementation_id: String,
    /// ms seit der Epoche.
    started_at: f64,
    cancel: Arc<AtomicBool>,
    /// Die Phase endete, während diese Ordnung lief: danach läuft sie noch einmal.
    is_end_pending: bool,
}

/// Wer eine Ordnung anstößt.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TidyTrigger {
    PhaseEnd,
    User,
}

impl TidyRuns {
    /// Das Abbruch-Flag der neuen Ordnung; `None`, wenn die Phase schon läuft. Ein Phasenende
    /// wird dann vorgemerkt: die laufende Ordnung kennt den Endstand nicht. Unter einer Sperre,
    /// damit sie nicht zwischen Prüfen und Vormerken endet.
    fn claim(
        &self,
        phase_id: &str,
        implementation_id: &str,
        trigger: TidyTrigger,
    ) -> Option<Arc<AtomicBool>> {
        let mut runs = self.lock();
        if let Some(running) = runs.get_mut(phase_id) {
            running.is_end_pending |= trigger == TidyTrigger::PhaseEnd;
            return None;
        }
        let cancel = Arc::new(AtomicBool::new(false));
        runs.insert(
            phase_id.to_owned(),
            TidyRun {
                implementation_id: implementation_id.to_owned(),
                started_at: now_ms(),
                cancel: Arc::clone(&cancel),
                is_end_pending: false,
            },
        );
        Some(cancel)
    }

    /// `true`, wenn für die Phase ein Phasenende vorgemerkt ist.
    fn release(&self, phase_id: &str) -> bool {
        self.lock()
            .remove(phase_id)
            .is_some_and(|run: TidyRun| run.is_end_pending)
    }

    /// Seit wann die Phase geordnet wird, ms seit der Epoche.
    pub fn since(&self, phase_id: &str) -> Option<f64> {
        self.lock()
            .get(phase_id)
            .map(|run: &TidyRun| run.started_at)
    }

    /// Die Phasen der Umsetzung, die gerade geordnet werden.
    pub fn tidying_of(&self, implementation_id: &str) -> Vec<String> {
        let mut phase_ids: Vec<String> = self
            .lock()
            .iter()
            .filter(|(_, run): &(&String, &TidyRun)| run.implementation_id == implementation_id)
            .map(|(phase_id, _): (&String, &TidyRun)| phase_id.clone())
            .collect();
        phase_ids.sort_unstable();
        phase_ids
    }

    /// Setzt das Abbruch-Flag; `true`, wenn die Phase lief.
    pub fn cancel(&self, phase_id: &str) -> bool {
        self.lock().get(phase_id).is_some_and(|run: &TidyRun| {
            run.cancel.store(true, Ordering::Relaxed);
            true
        })
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, TidyRun>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Gibt die Phase auch dann frei, wenn der Thread abstürzt.
struct TidyClaim {
    app: AppHandle,
    implementation_id: String,
    phase_id: String,
    cancel: Arc<AtomicBool>,
}

impl Drop for TidyClaim {
    fn drop(&mut self) {
        let is_end_pending = self.app.state::<TidyRuns>().release(&self.phase_id);
        emit_changed(&self.app, &self.implementation_id);
        if is_end_pending
            && let Err(error) = start_phase_end(
                &self.app,
                &self.implementation_id,
                &self.phase_id,
                TidyTrigger::User,
            )
        {
            eprintln!(
                "Bericht der Phase {} nicht geordnet: {error}",
                self.phase_id
            );
        }
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
                Some(phase) => {
                    start_phase_end(app, implementation_id, &phase.id, TidyTrigger::PhaseEnd)
                }
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

/// Die Station einer Umsetzung samt ihrer Phase.
fn station_of<'a>(
    view: &'a ImplementationView,
    station_id: &str,
) -> Option<(&'a PhaseView, &'a StationView)> {
    view.phases.iter().find_map(|phase: &PhaseView| {
        phase
            .stations
            .iter()
            .find(|station: &&StationView| station.id == station_id)
            .map(|station: &StationView| (phase, station))
    })
}

/// Die Stationen, die den Hinweis zur Fertigmeldung ohne Bericht schon bekommen haben.
#[derive(Default)]
pub struct ReportNudges(Mutex<HashSet<String>>);

impl ReportNudges {
    /// `true` nur beim ersten Mal je Station.
    fn is_first(&self, station_id: &str) -> bool {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(station_id.to_owned())
    }
}

/// Ob eine Station der Spur Dateien geschrieben, aber keinen Eintrag im Bericht hat. `files` sind
/// die Zeilen mindestens ihrer Session, `entries` die der Umsetzung.
pub fn is_unreported(
    view: &ImplementationView,
    station_id: &str,
    files: &[SessionFileRow],
    entries: &[EntryRow],
) -> bool {
    let Some((phase, station)) = station_of(view, station_id) else {
        return false;
    };
    let is_in_spur = !station.by_user
        && tidy::spur_stations(phase)
            .iter()
            .any(|candidate: &&StationView| candidate.id == station_id);
    let (Some(session_id), Some(started_at)) = (&station.session_id, station.started_at) else {
        return false;
    };
    let has_written = files
        .iter()
        .any(|(session, _, touched_at): &SessionFileRow| {
            session == session_id && *touched_at >= started_at
        });
    let has_entry = entries
        .iter()
        .any(|entry: &EntryRow| entry.station_id == station_id);
    is_in_spur && has_written && !has_entry
}

/// Der Satz, mit dem die erste Fertigmeldung einer Station ohne Bericht zurückgeht (ADR 075). Ein
/// Lesefehler ergibt `None`: an ihm darf keine Fertigmeldung hängen.
pub fn completion_gap(
    app: &AppHandle,
    view: &ImplementationView,
    station_id: &str,
) -> Option<&'static str> {
    if is_switched_off(app) {
        return None;
    }
    let (_, station) = station_of(view, station_id)?;
    let session_id = station.session_id.clone()?;
    let registry = app.state::<SessionRegistry>();
    let files = registry.report_files(&[session_id]).ok()?;
    let entries = registry.report_entries(&view.id).ok()?;
    let is_first_hint = is_unreported(view, station_id, &files, &entries)
        && app.try_state::<ReportNudges>()?.is_first(station_id);
    is_first_hint.then_some(NO_REPORT_HINT)
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

/// „Neu ordnen“ bzw. „Zwischenstand ordnen“: für jede Phase, auch eine laufende oder schon
/// geordnete.
pub fn retidy(app: &AppHandle, phase_id: &str) -> Result<(), CommandError> {
    let implementation_id = app
        .state::<SessionRegistry>()
        .implementation_of_phase(phase_id)?
        .ok_or_else(|| CommandError::Implementation(format!("{UNKNOWN_PHASE} {phase_id}")))?;
    start_phase_end(app, &implementation_id, phase_id, TidyTrigger::User)
}

/// Läuft die Phase schon, startet nichts (`TidyRuns::claim`).
fn start_phase_end(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
    trigger: TidyTrigger,
) -> Result<(), CommandError> {
    let Some(cancel) = app
        .state::<TidyRuns>()
        .claim(phase_id, implementation_id, trigger)
    else {
        return Ok(());
    };
    // Scheitert der Start, fällt der Anspruch mit der verworfenen Closure.
    let claim = TidyClaim {
        app: app.clone(),
        implementation_id: implementation_id.to_owned(),
        phase_id: phase_id.to_owned(),
        cancel,
    };
    emit_changed(app, implementation_id);
    thread::Builder::new()
        .name(TIDY_THREAD.to_owned())
        .spawn(move || {
            if let Err(error) = run_phase_end(&claim) {
                eprintln!(
                    "Bericht der Phase {} nicht geordnet: {error}",
                    claim.phase_id
                );
            }
        })?;
    Ok(())
}

/// Ordnet die Phase und ermittelt danach ihre Prüfwerte, bei einer laufenden Phase nur die
/// Ordnung; scheitert eines, läuft das andere trotzdem. Liest Datenbank, Git, Dateien und das
/// Modell, ohne dabei eine Sperre zu halten.
fn run_phase_end(claim: &TidyClaim) -> Result<(), CommandError> {
    let TidyClaim {
        app,
        implementation_id,
        phase_id,
        cancel,
    } = claim;
    let registry = app.state::<SessionRegistry>();
    let view = registry.implementation_view(implementation_id)?;
    let (index, phase) = view
        .phases
        .iter()
        .enumerate()
        .find(|(_, phase): &(usize, &PhaseView)| phase.id == *phase_id)
        .ok_or_else(|| CommandError::Implementation(format!("{UNKNOWN_PHASE} {phase_id}")))?;
    // Vor dem Lesen: was danach geschrieben wird, kennt die Ordnung nicht.
    let read_at = now_ms();
    let entries: Vec<EntryRow> = registry
        .report_entries(implementation_id)?
        .into_iter()
        .filter(|entry: &EntryRow| entry.phase_id == *phase_id)
        .collect();
    let tidied = tidy_phase(app, &view, index, &entries, read_at, cancel);
    emit_changed(app, implementation_id);
    // Prüfwerte gelten für den Endstand.
    if assemble::phase_state(phase) == ReportPhaseState::Running {
        return tidied;
    }
    let checked = check_phase(&registry, &view, index, &entries);
    emit_changed(app, implementation_id);
    if let (Err(_), Err(also)) = (&tidied, &checked) {
        eprintln!("Bericht der Phase {phase_id}: Prüfwerte nicht ermittelt: {also}");
    }
    tidied.and(checked)
}

fn emit_changed(app: &AppHandle, implementation_id: &str) {
    let tidying_phase_ids = app.state::<TidyRuns>().tidying_of(implementation_id);
    // Ohne Fenster geht nichts verloren: die Oberfläche lädt beim Öffnen.
    let _ = app.emit(
        REPORT_CHANGED_EVENT,
        ReportChangedEvent {
            implementation_id: implementation_id.to_owned(),
            tidying_phase_ids,
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

/// Speichert die geordnete Fassung mit dem Stand `read_at` oder den Grund, warum es keine neue
/// gibt; nach einem Abbruch bleibt das Gespeicherte, wie es ist. Ohne einen Eintrag zu ordnen,
/// ohne Spur und ohne Stopp aus dem Diff entfällt der Aufruf von Haiku.
fn tidy_phase(
    app: &AppHandle,
    view: &ImplementationView,
    index: usize,
    entries: &[EntryRow],
    read_at: f64,
    cancel: &AtomicBool,
) -> Result<(), CommandError> {
    let registry = app.state::<SessionRegistry>();
    let phase = &view.phases[index];
    let to_order = tidy::to_order(entries, &tidy::review_stations(phase));
    let unexplained = unexplained_of(&registry, view, index, entries, &to_order)?;
    let (input, is_spur_empty) =
        haiku_input_of(&registry, view, phase, entries, &to_order, &unexplained)?;
    if to_order.is_empty() && is_spur_empty && unexplained.is_empty() {
        return registry.store_report_tidy_error(&view.id, &phase.id, None);
    }
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
                    cancel: Some(cancel),
                },
            )
        });
    if answer
        .as_ref()
        .is_err_and(|failure: &String| failure == CANCELLED)
    {
        return Ok(());
    }
    let explain_stops = tidy::explain_stops(&unexplained);
    let explain_ids: Vec<String> = explain_stops
        .iter()
        .map(|stop: &ExplainStop| stop.id.clone())
        .collect();
    let checked = match answer {
        Ok(answer) => tidy::check(&answer, &to_order, &explain_ids)
            .map(|()| TidyAnswer {
                explain_stops,
                ..answer
            })
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
                &unexplained,
            );
            let json = serde_json::to_string(&answer)
                .map_err(|error| CommandError::Internal(error.to_string()))?;
            let highest = entries
                .iter()
                .map(|entry: &EntryRow| entry.number)
                .max()
                .unwrap_or_default();
            registry.store_report_tidy(&view.id, &phase.id, &markdown, &json, highest, read_at)
        }
        Err(message) => registry.store_report_tidy_error(&view.id, &phase.id, Some(&message)),
    }
}

/// Was der Bericht der Phase an Position `index` nach der Ordnung nur aus dem Diff zeigen wird.
fn unexplained_of(
    registry: &SessionRegistry,
    view: &ImplementationView,
    index: usize,
    entries: &[EntryRow],
    to_order: &[u32],
) -> Result<Vec<Unexplained>, CommandError> {
    let no_images = |_: &str, _: &str| String::new();
    let context = context_of(registry, view, &no_images)?;
    let catalog = assemble::catalog_of(&context);
    let own: Vec<&EntryRow> = entries.iter().collect();
    let ranges = assemble::ranges_of_phase(view, index, &own, &context, &catalog);
    Ok(assemble::unexplained_of_phase(
        &ranges, entries, to_order, &context,
    ))
}

/// Die Eingabe an Haiku und ob ihre Spur leer ist.
fn haiku_input_of(
    registry: &SessionRegistry,
    view: &ImplementationView,
    phase: &PhaseView,
    entries: &[EntryRow],
    to_order: &[u32],
    unexplained: &[Unexplained],
) -> Result<(String, bool), CommandError> {
    // Die Ansicht nennt nur die Nummern geladener Sessions; die übrigen stehen als „#?“ da.
    let labels = raw::session_labels(view, &Default::default());
    let traces = traces_of(phase, &labels, |session_id: &str| {
        registry.history_of(session_id)
    })?;
    // Für eine archivierte Session gibt es keine Changes; dann hilft die nächste.
    let found: Option<Vec<Source>> = tidy::spur_stations(phase)
        .iter()
        .filter_map(|station: &&StationView| station.session_id.as_ref())
        .find_map(|session_id: &String| {
            registry
                .changes_input(session_id, ChangesReach::Project)
                .ok()
                .map(|input| sources::sources(&input))
        });
    let spur = tidy::spur(&traces, &found.unwrap_or_default());
    let input = tidy::haiku_input(
        &raw::raw_markdown(&phase.key, entries, &labels),
        to_order,
        &spur,
        &tidy::unexplained_section(unexplained),
    );
    Ok((input, spur.is_empty()))
}
