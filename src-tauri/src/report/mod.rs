//! Review-Bericht einer Umsetzung (ADR 073): Stationen hängen über die Werkzeuge `report_*`
//! Einträge an; die Zeilen liegen in `db::report`, die Bilder im Bericht-Ordner. Sind die
//! Agenten-Stationen einer Phase fertig, ordnet Haiku sie im Thread `report-tidy`.
pub mod anchor;
pub mod images;
pub mod model;
pub mod raw;
pub mod tidy;
pub mod tools;

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;

use tauri::{AppHandle, Emitter, Manager};

use crate::agents::claude::print::{HaikuRequest, ask_haiku, print_program};
use crate::changes::model::ChangesReach;
use crate::changes::sources::{self, Source};
use crate::db::report::EntryRow;
use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::sessions::registry::SessionRegistry;
use model::ReportChangedEvent;
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

/// Liest Datenbank, Git und das Modell, ohne dabei eine Sperre zu halten.
fn run_phase_end(
    app: &AppHandle,
    implementation_id: &str,
    phase_id: &str,
) -> Result<(), CommandError> {
    let registry = app.state::<SessionRegistry>();
    let view = registry.implementation_view(implementation_id)?;
    let phase = view
        .phases
        .iter()
        .find(|phase: &&PhaseView| phase.id == phase_id)
        .ok_or_else(|| CommandError::Implementation(format!("{UNKNOWN_PHASE} {phase_id}")))?;
    let entries: Vec<EntryRow> = registry
        .report_entries(implementation_id)?
        .into_iter()
        .filter(|entry: &EntryRow| entry.phase_id == phase_id)
        .collect();
    tidy_phase(app, &view, phase, &entries)?;
    // Ohne Fenster geht nichts verloren: die Oberfläche lädt beim Öffnen.
    let _ = app.emit(
        REPORT_CHANGED_EVENT,
        ReportChangedEvent {
            implementation_id: implementation_id.to_owned(),
        },
    );
    Ok(())
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
