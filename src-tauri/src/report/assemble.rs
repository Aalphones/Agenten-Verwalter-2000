//! Setzt den Bericht einer Umsetzung zusammen (ADR 073): die Zeilen aus der Datenbank, dazu der
//! Code aus dem Commit-Bereich jeder Phase (`range`). Ohne App und ohne Datenbank.
use std::collections::{HashMap, HashSet};
use std::thread::{self, ScopedJoinHandle};

use crate::changes::attribution::{NORMALIZED_SEPARATOR, normalize_path};
use crate::changes::model::{DiffLine, DiffLineKind};
use crate::changes::parse;
use crate::db::report::{EntryRow, EntryTool, PhaseRow};
use crate::db::session_files::SessionFileRow;
use crate::filesystem::native_path;
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::report::model::{
    CheckGap, CheckGapKind, ImageRow, PhaseChecks, ReportAcceptance, ReportBlock, ReportCode,
    ReportFigure, ReportFinding, ReportImage, ReportLead, ReportLocation, ReportNote,
    ReportNoteKind, ReportPhase, ReportPhaseState, ReportRepository, ReportReview, ReportRow,
    ReportRowKind, ReportScreen, ReportShot, ReportStep, ReportStop, ReportView, ReportWayStep,
    ScreenRow, ShotRow, StepRow,
};
use crate::report::range::{self, Checkout, CommitCatalog, FileStat, PhaseSpan, RepoRange};
use crate::report::tidy::{self, StationTrace, StopKind, TidyAnswer, TidyStop, TidyWay};
use crate::report::way::{self, HistoryStep};

/// So viele Zeilen Umgebung zeigt ein Code-Block vor und nach den Zeilen seiner Notizen.
const BLOCK_CONTEXT: u32 = 3;
/// Längere Blöcke eines Stopps aus dem Diff zeigen nur ihre Zeilenzahl.
const DERIVED_MAX_ROWS: usize = 300;
/// So viele Dateien liest ein Git-Aufruf; Windows begrenzt die Länge der Befehlszeile.
const FILES_PER_LOAD: usize = 100;
/// Bildschirme bis zu dieser Breite in Pixeln gelten als schmal.
const NARROW_MAX_WIDTH: u32 = 600;
const SHORT_COMMIT_CHARS: usize = 7;
/// Titel eines Stopps, dessen Einträge weder Pfad noch Bildunterschrift haben.
const UNTITLED_STOP: &str = "Notiz";

/// Was das Zusammensetzen neben den Zeilen der Datenbank braucht.
pub struct AssembleContext<'a> {
    /// Die Repository-Einträge der Changes (`range::checkouts`), danach die Repositorys außerhalb
    /// des Vorhabens (`outside::extend`).
    pub checkouts: Vec<Checkout>,
    /// Normalisierter Pfad, wie eine Datei geschrieben wurde → der, unter dem Git sie führt; nur
    /// wo sie sich unterscheiden (`outside::extend`).
    pub written_as: HashMap<String, String>,
    /// Phase → Verlauf ihrer Spur-Stationen, für den Weg aus dem Verlauf; nur Phasen ohne gültige
    /// Ordnung.
    pub traces: HashMap<String, Vec<StationTrace>>,
    /// Die Paare `(Session, Commit)` der Stationen.
    pub commits: Vec<(String, String)>,
    /// Die von den Sessions geschriebenen Dateien, wie `Ownership.touched`.
    pub touched: HashMap<String, f64>,
    /// Je Session `#<Nr> <Stage>` (`raw::session_labels`).
    pub labels: HashMap<String, String>,
    /// Die geschriebenen Dateien je Station-Session.
    pub files: Vec<SessionFileRow>,
    /// Phase → Beginn ihrer laufenden Ordnung, ms seit der Epoche.
    pub tidying: HashMap<String, f64>,
    /// Die Adresse eines Bildes aus Phasen-ID und Dateiname.
    pub image_url: &'a (dyn Fn(&str, &str) -> String + Sync),
}

impl AssembleContext<'_> {
    /// Der Vergleichsschlüssel eines Pfads, wie ein Werkzeug-Aufruf ihn nennt.
    fn canonical(&self, path: &str) -> String {
        let normalized = normalize_path(path);
        self.written_as
            .get(&normalized)
            .cloned()
            .unwrap_or(normalized)
    }

    /// Das Label des innersten Repositorys, in dem der Pfad liegt.
    fn label_at(&self, path: &str) -> Option<String> {
        let wanted = self.canonical(path);
        self.checkouts
            .iter()
            .map(|checkout: &Checkout| (normalize_path(&checkout.dir.to_string_lossy()), checkout))
            .filter(|(dir, _): &(String, &Checkout)| {
                wanted.strip_prefix(dir.as_str()).is_some_and(|rest: &str| {
                    rest.is_empty() || rest.starts_with(NORMALIZED_SEPARATOR)
                })
            })
            .max_by_key(|(dir, _): &(String, &Checkout)| dir.len())
            .map(|(_, checkout): (String, &Checkout)| checkout.label.clone())
    }

    fn checkout(&self, key: &str) -> Option<&Checkout> {
        self.checkouts
            .iter()
            .find(|checkout: &&Checkout| checkout.key == key)
    }

    /// Die Vergleichsschlüssel, unter denen die Datei eines Code-Blocks geschrieben sein kann: je
    /// Arbeitsbaum ihres Repositorys einer, denn der Bereich kann in einem anderen liegen als dem,
    /// in dem geschrieben wurde.
    fn file_keys(&self, repository_key: &str, path: &str) -> HashSet<String> {
        let Some(own) = self.checkout(repository_key) else {
            return HashSet::new();
        };
        self.checkouts
            .iter()
            .filter(|checkout: &&Checkout| checkout.group == own.group)
            .map(|checkout: &Checkout| {
                normalize_path(&checkout.dir.join(native_path(path)).to_string_lossy())
            })
            .collect()
    }
}

/// Der Bericht der Umsetzung; die Phasen entstehen nebeneinander, jede in einem eigenen Thread.
/// `entries` und `phases` sind die der ganzen Umsetzung.
pub fn assemble(
    view: &ImplementationView,
    entries: &[EntryRow],
    phases: &[PhaseRow],
    ctx: &AssembleContext<'_>,
) -> ReportView {
    let catalog = catalog_of(ctx);
    let assembled: Vec<ReportPhase> = thread::scope(|scope| {
        let handles: Vec<(&PhaseView, ScopedJoinHandle<'_, ReportPhase>)> = view
            .phases
            .iter()
            .enumerate()
            .map(|(index, phase): (usize, &PhaseView)| {
                let catalog = &catalog;
                let handle = scope.spawn(move || {
                    let mut own: Vec<&EntryRow> = entries
                        .iter()
                        .filter(|entry: &&EntryRow| entry.phase_id == phase.id)
                        .collect();
                    own.sort_by_key(|entry: &&EntryRow| entry.number);
                    let row = phases
                        .iter()
                        .find(|row: &&PhaseRow| row.phase_id == phase.id);
                    let ranges = ranges_of_phase(view, index, &own, ctx, catalog);
                    phase_of(phase, &own, row, &ranges, ctx)
                });
                (phase, handle)
            })
            .collect();
        handles
            .into_iter()
            .map(
                |(phase, handle): (&PhaseView, ScopedJoinHandle<'_, ReportPhase>)| {
                    // Ein panischer Thread trifft nur seine Phase, nicht den ganzen Bericht.
                    handle.join().unwrap_or_else(|_| empty_phase(phase, ctx))
                },
            )
            .collect()
    });
    ReportView {
        implementation_id: view.id.clone(),
        phases: assembled,
        acceptance: acceptance_of(view),
    }
}

/// Die Commits aller Stationen, je Repository einmal gelesen.
pub fn catalog_of(ctx: &AssembleContext<'_>) -> CommitCatalog {
    let mut commit_ids: Vec<String> = ctx
        .commits
        .iter()
        .map(|(_, commit): &(String, String)| commit.clone())
        .collect();
    commit_ids.sort_unstable();
    commit_ids.dedup();
    range::commit_catalog(&ctx.checkouts, &commit_ids)
}

/// Die Commit-Bereiche der Phase an Position `index`; `entries` sind die dieser Phase.
pub fn ranges_of_phase(
    view: &ImplementationView,
    index: usize,
    entries: &[&EntryRow],
    ctx: &AssembleContext<'_>,
    catalog: &CommitCatalog,
) -> Vec<RepoRange> {
    let Some(phase) = view.phases.get(index) else {
        return Vec::new();
    };
    let is_latest = view.phases[index + 1..]
        .iter()
        .all(|later: &PhaseView| !has_started(later));
    range::phase_ranges(
        &ctx.checkouts,
        catalog,
        &span_of(phase, entries, phase_state(phase), is_latest, ctx),
        &ctx.touched,
    )
}

/// Stationen des Benutzers zählen nicht, solange die Phase andere hat: er liest den Bericht, bevor
/// er abnimmt.
pub fn phase_state(phase: &PhaseView) -> ReportPhaseState {
    if !has_started(phase) {
        return ReportPhaseState::NotStarted;
    }
    let has_agents = phase
        .stations
        .iter()
        .any(|station: &StationView| !station.by_user);
    let is_done = phase
        .stations
        .iter()
        .filter(|station: &&StationView| !has_agents || !station.by_user)
        .all(|station: &StationView| station.completed_at.is_some());
    if is_done {
        ReportPhaseState::Done
    } else {
        ReportPhaseState::Running
    }
}

fn has_started(phase: &PhaseView) -> bool {
    phase
        .stations
        .iter()
        .any(|station: &StationView| station.started_at.is_some() || station.completed_at.is_some())
}

/// Die erste Station `by: "you"` der letzten Phase.
fn acceptance_of(view: &ImplementationView) -> Option<ReportAcceptance> {
    view.phases
        .last()?
        .stations
        .iter()
        .find(|station: &&StationView| station.by_user)
        .map(|station: &StationView| ReportAcceptance {
            station_id: station.id.clone(),
            state: station.state,
        })
}

/// Kopf einer Phase ohne alles, was aus Einträgen und Git kommt.
fn empty_phase(phase: &PhaseView, ctx: &AssembleContext<'_>) -> ReportPhase {
    let state = phase_state(phase);
    let first = tidy::spur_stations(phase)
        .first()
        .copied()
        .or_else(|| phase.stations.first());
    let station_label = first.map_or_else(String::new, |station: &StationView| {
        station
            .session_id
            .as_ref()
            .and_then(|session_id: &String| ctx.labels.get(session_id))
            .cloned()
            .unwrap_or_else(|| station.stage.clone())
    });
    let finished_at = (state == ReportPhaseState::Done)
        .then(|| {
            phase
                .stations
                .iter()
                .filter(|station: &&StationView| !station.by_user)
                .filter_map(|station: &StationView| station.completed_at)
                .reduce(f64::max)
        })
        .flatten();
    let spur_stations = tidy::spur_stations(phase);
    let results: Vec<&str> = spur_stations
        .iter()
        .filter_map(|station: &&StationView| station.result.as_deref())
        .filter(|result: &&str| !result.trim().is_empty())
        .collect();
    ReportPhase {
        phase_id: phase.id.clone(),
        key: phase.key.clone(),
        title: phase.title.clone(),
        state,
        station_label,
        finished_at,
        files: 0,
        added: 0,
        removed: 0,
        commits: Vec::new(),
        result: None,
        way: Vec::new(),
        ordered: false,
        tidy_error: None,
        review: None,
        screens: Vec::new(),
        stops: Vec::new(),
        checks: None,
        entries: 0,
        tidying_since: ctx.tidying.get(&phase.id).copied(),
        tidied_at: None,
        files_since: 0,
        entries_since: 0,
        station_result: (!results.is_empty()).then(|| results.join("\n")),
        station_session_id: spur_stations
            .first()
            .and_then(|station: &&StationView| station.session_id.clone()),
        repositories: Vec::new(),
    }
}

/// Stand der gültigen Ordnung und was seitdem an Einträgen und Dateien dazukam.
fn count_since_tidy(
    report: &mut ReportPhase,
    phase: &PhaseView,
    entries: &[&EntryRow],
    row: Option<&PhaseRow>,
    ctx: &AssembleContext<'_>,
) {
    let Some(row) = row.filter(|row: &&PhaseRow| row.tidy_json.is_some()) else {
        return;
    };
    let Some(tidied_at) = row.tidy_at else {
        return;
    };
    let ordered_up_to = row.tidy_entries.unwrap_or_default();
    report.tidied_at = Some(tidied_at);
    report.entries_since = count(
        entries
            .iter()
            .filter(|entry: &&&EntryRow| entry.number > ordered_up_to)
            .count(),
    );
    let sessions = sessions_of(phase);
    let paths: HashSet<&str> = ctx
        .files
        .iter()
        .filter(|(session, _, touched_at): &&SessionFileRow| {
            *touched_at > tidied_at && sessions.contains(session.as_str())
        })
        .map(|(_, path, _): &SessionFileRow| path.as_str())
        .collect();
    report.files_since = count(paths.len());
}

fn sessions_of(phase: &PhaseView) -> HashSet<&str> {
    phase
        .stations
        .iter()
        .filter_map(|station: &StationView| station.session_id.as_deref())
        .collect()
}

/// `entries` sind die der Phase in Nummernfolge.
fn phase_of(
    phase: &PhaseView,
    entries: &[&EntryRow],
    row: Option<&PhaseRow>,
    ranges: &[RepoRange],
    ctx: &AssembleContext<'_>,
) -> ReportPhase {
    let mut report = empty_phase(phase, ctx);
    count_changes(&mut report, ranges);
    count_since_tidy(&mut report, phase, entries, row, ctx);

    let mut files = Files {
        ranges,
        checkouts: &ctx.checkouts,
        loaded: HashMap::new(),
    };
    files.preload(entries);
    let writer = Writer {
        phase,
        ctx,
        tidied_at: report.tidied_at,
    };
    let answer: Option<TidyAnswer> = row
        .and_then(|row: &PhaseRow| row.tidy_json.as_deref())
        .and_then(|json: &str| serde_json::from_str(json).ok());
    let ordered_up_to = row
        .and_then(|row: &PhaseRow| row.tidy_entries)
        .unwrap_or_default();
    let owned: Vec<EntryRow> = entries
        .iter()
        .map(|entry: &&EntryRow| (*entry).clone())
        .collect();
    let to_order = tidy::to_order(&owned, &tidy::review_stations(phase));
    let plans = stop_plans(entries, &to_order, answer.as_ref(), ordered_up_to);
    let mut stops = stops_of_phase(&plans, &writer, &mut files);
    report.review = review_of_phase(&writer, entries, &mut stops, &mut files);
    label_notes(&mut stops);
    // Auch hinter den Stopps, die die Ordnung nennt und die entfallen sind: `way[].stop` darf auf
    // keinen Stopp aus dem Diff zeigen.
    let next_index = stops
        .iter()
        .map(|stop: &ReportStop| stop.index.saturating_add(1))
        .max()
        .unwrap_or_default()
        .max(
            answer
                .as_ref()
                .map_or(0, |answer: &TidyAnswer| count(answer.stops.len())),
        );
    let derived = derived_stops(&writer, &stops, next_index, &mut files);
    stops.extend(derived);
    report.repositories = repositories_of(ranges, &stops, ctx);

    if let Some(answer) = &answer {
        report.ordered = true;
        report.result = Some(answer.result.clone());
        report.way = way_of(answer, &stops);
    } else if let Some(traces) = ctx.traces.get(&phase.id) {
        let is_running = report.state == ReportPhaseState::Running;
        let steps = way::history_way(traces, &|path: &str| ctx.label_at(path), is_running);
        report.way = linked_way(steps, &stops, ctx);
    }
    report.stops = stops;
    report.screens = screens_of(entries, &writer);
    report.tidy_error = row.and_then(|row: &PhaseRow| row.tidy_error.clone());
    report.checks = row
        .and_then(|row: &PhaseRow| row.checks.as_deref())
        .and_then(|json: &str| serde_json::from_str::<PhaseChecks>(json).ok());
    if let Some(checks) = &report.checks {
        mark_gaps(&mut report.stops, checks);
    }
    report.entries = count(entries.len());
    report
}

fn span_of<'a>(
    phase: &PhaseView,
    entries: &[&'a EntryRow],
    state: ReportPhaseState,
    is_latest: bool,
    ctx: &AssembleContext<'_>,
) -> PhaseSpan<'a> {
    let sessions = sessions_of(phase);
    PhaseSpan {
        written: ctx
            .files
            .iter()
            .filter(|(session, _, _): &&SessionFileRow| sessions.contains(session.as_str()))
            .map(|(_, path, _): &SessionFileRow| normalize_path(path))
            .collect(),
        commits: ctx
            .commits
            .iter()
            .filter(|(session, _): &&(String, String)| sessions.contains(session.as_str()))
            .map(|(_, commit): &(String, String)| commit.clone())
            .collect(),
        started_at: phase
            .stations
            .iter()
            .filter_map(|station: &StationView| station.started_at)
            .reduce(f64::min),
        state,
        has_agents: phase
            .stations
            .iter()
            .any(|station: &StationView| !station.by_user),
        is_latest,
        preferred: entries
            .iter()
            .filter_map(|entry: &&'a EntryRow| entry.repository_key.as_deref())
            .collect(),
    }
}

/// Was mehrere Bereiche zusammen geändert haben.
#[derive(Default)]
struct Tally {
    files: u32,
    added: u32,
    removed: u32,
    /// Kurz-Hashes.
    commits: Vec<String>,
}

/// Eine Datei in zwei Bereichen desselben Repositorys zählt einmal.
fn tally<'a>(ranges: impl IntoIterator<Item = &'a RepoRange>) -> Tally {
    let mut sum = Tally::default();
    let mut paths: HashSet<(&str, &str)> = HashSet::new();
    for range in ranges {
        for file in &range.files {
            paths.insert((range.group.as_str(), file.path.as_str()));
            sum.added = sum.added.saturating_add(file.added);
            sum.removed = sum.removed.saturating_add(file.removed);
        }
        for commit in &range.commits {
            let short: String = commit.chars().take(SHORT_COMMIT_CHARS).collect();
            if !sum.commits.contains(&short) {
                sum.commits.push(short);
            }
        }
    }
    sum.files = count(paths.len());
    sum
}

/// Dateien, Zeilenzahlen und Kurz-Hashes über alle Bereiche.
fn count_changes(report: &mut ReportPhase, ranges: &[RepoRange]) {
    let sum = tally(ranges);
    report.files = sum.files;
    report.added = sum.added;
    report.removed = sum.removed;
    report.commits = sum.commits;
}

/// Je Repository mit Änderungen eine Zeile: zuerst die mit Stopps aus Einträgen in deren Folge,
/// dann die übrigen in Reihenfolge der Checkouts, wie ihre Stopps aus dem Diff.
fn repositories_of(
    ranges: &[RepoRange],
    stops: &[ReportStop],
    ctx: &AssembleContext<'_>,
) -> Vec<ReportRepository> {
    let explained = stops
        .iter()
        .filter(|stop: &&ReportStop| !stop.derived)
        .flat_map(code_blocks)
        .filter_map(|code: &ReportCode| ctx.checkout(&code.repository_key));
    let mut seen: HashSet<&str> = HashSet::new();
    explained
        .chain(&ctx.checkouts)
        .filter(|checkout: &&Checkout| seen.insert(checkout.group.as_str()))
        .filter_map(|checkout: &Checkout| {
            let sum = tally(
                ranges
                    .iter()
                    .filter(|range: &&RepoRange| range.group == checkout.group),
            );
            (sum.files > 0 || !sum.commits.is_empty()).then(|| ReportRepository {
                label: checkout.label.clone(),
                outside: checkout.outside,
                files: sum.files,
                added: sum.added,
                removed: sum.removed,
                commits: sum.commits,
            })
        })
        .collect()
}

fn code_blocks(stop: &ReportStop) -> impl Iterator<Item = &ReportCode> {
    stop.blocks
        .iter()
        .filter_map(|block: &ReportBlock| match block {
            ReportBlock::Code(code) => Some(code),
            ReportBlock::Figure(_) => None,
        })
}

/// Jede geänderte Datei, die kein Stopp zeigt, in einem Stopp je Repository (ADR 075). Eine neue
/// Datei ohne lesbaren Text fehlt: es gäbe nichts zu zeigen.
fn derived_stops(
    writer: &Writer<'_>,
    stops: &[ReportStop],
    first_index: u32,
    files: &mut Files<'_>,
) -> Vec<ReportStop> {
    let ctx = writer.ctx;
    let group_of = |key: &str| {
        ctx.checkout(key).map_or_else(
            || key.to_owned(),
            |checkout: &Checkout| checkout.group.clone(),
        )
    };
    let mut shown: HashSet<(String, String)> = stops
        .iter()
        .flat_map(code_blocks)
        .map(|code: &ReportCode| (group_of(&code.repository_key), code.path.clone()))
        .collect();
    // Je Repository seine Dateien, die Repositorys in Reihenfolge ihrer Bereiche.
    let mut groups: Vec<(String, Vec<Target>)> = Vec::new();
    for (index, range) in files.ranges.iter().enumerate() {
        let targets: Vec<Target> = range
            .files
            .iter()
            .filter(|file: &&FileStat| !(file.untracked && file.added == 0))
            .filter(|file: &&FileStat| shown.insert((range.group.clone(), file.path.clone())))
            .map(|file: &FileStat| Target {
                key: range.repository_key.clone(),
                path: file.path.clone(),
                range: Some(index),
            })
            .collect();
        if targets.is_empty() {
            continue;
        }
        files.load(Some(index), &targets);
        match groups
            .iter_mut()
            .find(|(group, _): &&mut (String, Vec<Target>)| *group == range.group)
        {
            Some((_, known)) => known.extend(targets),
            None => groups.push((range.group.clone(), targets)),
        }
    }
    groups
        .into_iter()
        .enumerate()
        .map(
            |(offset, (group, targets)): (usize, (String, Vec<Target>))| {
                let checkout = ctx
                    .checkouts
                    .iter()
                    .find(|checkout: &&Checkout| checkout.group == group);
                ReportStop {
                    index: first_index.saturating_add(count(offset)),
                    title: checkout.map_or(group, |checkout: &Checkout| checkout.label.clone()),
                    kind: StopKind::Flow.as_str().to_owned(),
                    look: None,
                    by: String::new(),
                    lead: None,
                    blocks: targets
                        .iter()
                        .map(|target: &Target| {
                            ReportBlock::Code(derived_block(target, writer, files))
                        })
                        .collect(),
                    derived: true,
                    outside: checkout.is_some_and(|checkout: &Checkout| checkout.outside),
                }
            },
        )
        .collect()
}

/// Alle Abschnitte des Patchs; ein zu langer nennt nur seine Zeilenzahl.
fn derived_block(target: &Target, writer: &Writer<'_>, files: &mut Files<'_>) -> ReportCode {
    let mut code = code_block(target, &[], writer, files);
    if code.rows.len() > DERIVED_MAX_ROWS {
        code.omitted_rows = count(code.rows.len());
        code.rows = Vec::new();
    }
    code
}

/// Ob eine Station der Phase die Datei nach der gültigen Ordnung geschrieben hat.
fn is_fresh(
    ctx: &AssembleContext<'_>,
    phase: &PhaseView,
    target: &Target,
    tidied_at: Option<f64>,
) -> bool {
    let Some(tidied_at) = tidied_at else {
        return false;
    };
    let sessions = sessions_of(phase);
    let keys = ctx.file_keys(&target.key, &target.path);
    ctx.files
        .iter()
        .any(|(session, path, touched_at): &SessionFileRow| {
            *touched_at > tidied_at
                && sessions.contains(session.as_str())
                && keys.contains(&normalize_path(path))
        })
}

/// Hängt an jede Etappe den ersten Stopp, der ihre erste geschriebene Datei zeigt.
fn linked_way(
    steps: Vec<HistoryStep>,
    stops: &[ReportStop],
    ctx: &AssembleContext<'_>,
) -> Vec<ReportWayStep> {
    let shown: Vec<(u32, HashSet<String>)> = stops
        .iter()
        .flat_map(|stop: &ReportStop| {
            code_blocks(stop).map(|code: &ReportCode| {
                (stop.index, ctx.file_keys(&code.repository_key, &code.path))
            })
        })
        .collect();
    steps
        .into_iter()
        .map(|history: HistoryStep| {
            let mut step = history.step;
            step.stop = history.first_written.and_then(|path: String| {
                let wanted = ctx.canonical(&path);
                shown
                    .iter()
                    .find(|(_, keys): &&(u32, HashSet<String>)| keys.contains(&wanted))
                    .map(|(index, _): &(u32, HashSet<String>)| *index)
            });
            step
        })
        .collect()
}

fn count(length: usize) -> u32 {
    u32::try_from(length).unwrap_or(u32::MAX)
}

/// Die Dateien einer Phase, jede einmal gelesen.
struct Files<'a> {
    ranges: &'a [RepoRange],
    checkouts: &'a [Checkout],
    loaded: HashMap<(String, String), FileData>,
}

#[derive(Default)]
struct FileData {
    added: u32,
    removed: u32,
    diff: Vec<DiffLine>,
    /// Die Zeilen des Endstands; `None`, wenn es dort keinen Text gibt.
    end: Option<Vec<String>>,
}

/// Wo eine Datei gelesen wird.
#[derive(Clone)]
struct Target {
    key: String,
    path: String,
    range: Option<usize>,
}

impl Files<'_> {
    /// Der Bereich, der die Datei geändert hat: erst der des Eintrags selbst, dann einer desselben
    /// Repositorys (der Commit wurde einem anderen Arbeitsbaum zugeordnet, oder es gibt den
    /// Arbeitsbaum nicht mehr). Ohne Änderung zählt der Bereich des Eintrags für den Endstand.
    fn target(&self, key: &str, path: &str) -> Target {
        let group: Option<&str> = self
            .checkouts
            .iter()
            .find(|checkout: &&Checkout| checkout.key == key)
            .map(|checkout: &Checkout| checkout.group.as_str());
        let same_repository = |range: &RepoRange| match group {
            Some(group) => range.group == group,
            None => position_of(&range.repository_key) == position_of(key),
        };
        let has_file = |range: &RepoRange| range.file(path).is_some();
        let found = self
            .ranges
            .iter()
            .position(|range: &RepoRange| range.repository_key == key && has_file(range))
            .or_else(|| {
                self.ranges
                    .iter()
                    .position(|range: &RepoRange| same_repository(range) && has_file(range))
            })
            .or_else(|| {
                self.ranges
                    .iter()
                    .position(|range: &RepoRange| range.repository_key == key)
            });
        Target {
            key: found.map_or_else(
                || key.to_owned(),
                |index: usize| self.ranges[index].repository_key.clone(),
            ),
            path: path.to_owned(),
            range: found,
        }
    }

    /// Liest die Dateien aller Einträge mit Ort je Bereich zusammen: mit einem Git-Prozess je
    /// Datei dauert ein Bericht mit 40 Einträgen Sekunden.
    fn preload(&mut self, entries: &[&EntryRow]) {
        let mut by_range: HashMap<Option<usize>, Vec<Target>> = HashMap::new();
        for (key, path) in entries
            .iter()
            .filter_map(|entry: &&EntryRow| location_of(entry))
        {
            let target = self.target(key, path);
            let targets = by_range.entry(target.range).or_default();
            if !targets
                .iter()
                .any(|known: &Target| known.is_same_file(&target))
            {
                targets.push(target);
            }
        }
        for (range, targets) in by_range {
            self.load(range, &targets);
        }
    }

    /// Liest Dateien desselben Bereichs zusammen.
    fn load(&mut self, range: Option<usize>, targets: &[Target]) {
        let range = range.and_then(|index: usize| self.ranges.get(index));
        for chunk in targets.chunks(FILES_PER_LOAD) {
            self.loaded.extend(load_files(range, self.checkouts, chunk));
        }
    }

    fn read(&mut self, target: &Target) -> &FileData {
        if !self.loaded.contains_key(&target.file()) {
            self.load(target.range, std::slice::from_ref(target));
        }
        self.loaded.entry(target.file()).or_default()
    }
}

impl Target {
    fn file(&self) -> (String, String) {
        (self.key.clone(), self.path.clone())
    }

    fn is_same_file(&self, other: &Target) -> bool {
        self.key == other.key && self.path == other.path
    }
}

/// Die Position des angehängten Repositorys am Anfang eines Schlüssels.
fn position_of(key: &str) -> &str {
    key.split(['/', ':']).next().unwrap_or(key)
}

/// Die Dateien eines Bereichs; ohne Bereich ihr Stand im Arbeitsverzeichnis.
fn load_files(
    range: Option<&RepoRange>,
    checkouts: &[Checkout],
    targets: &[Target],
) -> Vec<((String, String), FileData)> {
    let paths: Vec<&str> = targets
        .iter()
        .map(|target: &Target| target.path.as_str())
        .collect();
    let mut patches = range.map_or_else(HashMap::new, |range: &RepoRange| {
        range::file_patches(range, &paths)
    });
    let mut ends = range.map_or_else(HashMap::new, |range: &RepoRange| {
        range::end_texts(range, &paths)
    });
    targets
        .iter()
        .map(|target: &Target| {
            let stat: Option<&FileStat> =
                range.and_then(|range: &RepoRange| range.file(&target.path));
            let end = match range {
                Some(_) => ends.remove(&target.path),
                None => unchanged_text(checkouts, target),
            };
            let data = FileData {
                added: stat.map_or(0, |file: &FileStat| file.added),
                removed: stat.map_or(0, |file: &FileStat| file.removed),
                diff: patches
                    .remove(&target.path)
                    .map_or_else(Vec::new, |patch: String| parse::unified(&patch).lines),
                end: end.map(|text: String| lines_of(&text)),
            };
            (target.file(), data)
        })
        .collect()
}

/// Eine Datei, für die es keinen Bereich gibt, aus dem Ordner ihres Eintrags.
fn unchanged_text(checkouts: &[Checkout], target: &Target) -> Option<String> {
    checkouts
        .iter()
        .find(|checkout: &&Checkout| checkout.key == target.key)
        .and_then(|checkout: &Checkout| range::working_text(&checkout.dir, &target.path))
}

fn lines_of(text: &str) -> Vec<String> {
    text.lines().map(str::to_owned).collect()
}

/// Wo eine Notiz im Endstand steht.
#[derive(Debug, Clone, Copy)]
struct Place {
    from: u32,
    to: u32,
    /// `anchor_text` ist dort nicht mehr eindeutig zu finden; `from`/`to` sind die des Aufrufs.
    moved: bool,
}

/// Stehen in `from..to` nicht mehr die gemerkten Zeilen, zählt die eine andere Fundstelle; keine
/// oder mehrere heißen „Stelle geändert“.
fn relocate(end: Option<&[String]>, anchor_text: Option<&str>, from: u32, to: u32) -> Place {
    let moved = Place {
        from,
        to,
        moved: true,
    };
    let Some(end) = end else {
        return moved;
    };
    let unchanged = Place {
        from,
        to,
        moved: false,
    };
    let Some(anchor_text) = anchor_text else {
        return unchanged;
    };
    let anchor_text = anchor_text.replace("\r\n", "\n");
    let wanted: Vec<&str> = anchor_text.split('\n').collect();
    let holds = |start: usize| {
        end.get(start..start + wanted.len())
            .is_some_and(|lines: &[String]| lines.iter().eq(wanted.iter()))
    };
    if from
        .checked_sub(1)
        .is_some_and(|start: u32| holds(start as usize))
    {
        return unchanged;
    }
    let mut hits = (0..end.len()).filter(|start: &usize| holds(*start));
    match (hits.next(), hits.next()) {
        (Some(start), None) => Place {
            from: count(start) + 1,
            to: count(start + wanted.len()),
            moved: false,
        },
        _ => moved,
    }
}

/// Die Zeilen jeder Stelle samt Umgebung, aufsteigend; überlappende und angrenzende zusammengelegt.
fn intervals(places: &[Place], line_count: u32) -> Vec<(u32, u32)> {
    let mut wanted: Vec<(u32, u32)> = places
        .iter()
        .filter(|place: &&Place| !place.moved)
        .map(|place: &Place| {
            (
                place.from.saturating_sub(BLOCK_CONTEXT).max(1),
                place.to.saturating_add(BLOCK_CONTEXT).min(line_count),
            )
        })
        .filter(|(from, to): &(u32, u32)| from <= to)
        .collect();
    wanted.sort_unstable();
    let mut merged: Vec<(u32, u32)> = Vec::new();
    for (from, to) in wanted {
        match merged.last_mut() {
            Some(last) if from <= last.1.saturating_add(1) => last.1 = last.1.max(to),
            _ => merged.push((from, to)),
        }
    }
    merged
}

fn row_of(line: &DiffLine) -> Option<ReportRow> {
    let kind = match line.kind {
        DiffLineKind::Added => ReportRowKind::Add,
        DiffLineKind::Context => ReportRowKind::Context,
        DiffLineKind::Deleted => ReportRowKind::Removed,
        _ => return None,
    };
    Some(ReportRow {
        kind,
        old: line.old_line,
        new: line.new_line,
        text: line.text.clone(),
    })
}

/// Die Zeilen eines Code-Blocks. Ohne eine auffindbare Stelle alle Abschnitte des Patchs: was die
/// Phase an der Datei geändert hat.
fn block_rows(file: &FileData, places: &[Place]) -> Vec<ReportRow> {
    let end: &[String] = file.end.as_deref().unwrap_or_default();
    let wanted = intervals(places, count(end.len()));
    if wanted.is_empty() {
        return file.diff.iter().filter_map(row_of).collect();
    }
    let mut known: HashMap<u32, ReportRow> = HashMap::new();
    // Entfernte Zeilen je Zeile des Endstands, vor der sie standen.
    let mut removed: HashMap<u32, Vec<ReportRow>> = HashMap::new();
    // `(Zeile des Endstands, Versatz danach)`: alt = neu − Versatz.
    let mut shifts: Vec<(u32, i64)> = Vec::new();
    let mut shift: i64 = 0;
    let mut next_new: u32 = 1;
    for (index, line) in file.diff.iter().enumerate() {
        let Some(row) = row_of(line) else {
            // Abschnittskopf: wo seine erste Zeile im Endstand steht, sagt die nächste mit Nummer.
            next_new = file.diff[index + 1..]
                .iter()
                .take_while(|line: &&DiffLine| line.kind != DiffLineKind::Hunk)
                .find_map(|line: &DiffLine| line.new_line)
                .unwrap_or(1);
            continue;
        };
        match row.new {
            Some(new) => {
                if row.kind == ReportRowKind::Add {
                    shift += 1;
                }
                next_new = new.saturating_add(1);
                shifts.push((new, shift));
                known.insert(new, row);
            }
            None => {
                shift -= 1;
                shifts.push((next_new.saturating_sub(1), shift));
                removed.entry(next_new).or_default().push(row);
            }
        }
    }
    let mut rows: Vec<ReportRow> = Vec::new();
    for (from, to) in wanted {
        for number in from..=to {
            rows.extend(removed.remove(&number).unwrap_or_default());
            if let Some(row) = known.remove(&number) {
                rows.push(row);
                continue;
            }
            let Some(text) = end.get(number as usize - 1) else {
                continue;
            };
            let offset = shifts
                .iter()
                .take_while(|(line, _): &&(u32, i64)| *line < number)
                .last()
                .map_or(0, |(_, shift): &(u32, i64)| *shift);
            rows.push(ReportRow {
                kind: ReportRowKind::Context,
                old: u32::try_from(i64::from(number) - offset).ok(),
                new: Some(number),
                text: text.clone(),
            });
        }
        rows.extend(removed.remove(&to.saturating_add(1)).unwrap_or_default());
    }
    rows
}

/// Ein Stopp, bevor er gelesen wird: welche Einträge er in welcher Reihenfolge zeigt.
struct StopPlan<'a> {
    index: u32,
    title: String,
    kind: StopKind,
    look: Option<String>,
    entries: Vec<&'a EntryRow>,
}

/// Mit gültiger Ordnung deren Stopps; was sie nicht kennt, folgt in der Rohgruppierung. Ein Stopp
/// der Ordnung ohne Einträge entfällt, die übrigen behalten ihren Index (`way[].stop`).
fn stop_plans<'a>(
    entries: &[&'a EntryRow],
    to_order: &[u32],
    answer: Option<&TidyAnswer>,
    ordered_up_to: u32,
) -> Vec<StopPlan<'a>> {
    let mut open: Vec<&'a EntryRow> = entries
        .iter()
        .copied()
        .filter(|entry: &&EntryRow| to_order.contains(&entry.number))
        .collect();
    let mut plans: Vec<StopPlan<'a>> = Vec::new();
    let mut next_index: u32 = 0;
    if let Some(answer) = answer {
        for (index, stop) in answer.stops.iter().enumerate() {
            let mut members: Vec<&'a EntryRow> = Vec::new();
            for id in &stop.ids {
                let position = open.iter().position(|entry: &&EntryRow| {
                    entry.number <= ordered_up_to && *id == format!("n{}", entry.number)
                });
                if let Some(position) = position {
                    members.push(open.remove(position));
                }
            }
            if !members.is_empty() {
                plans.push(planned_stop(count(index), stop, members));
            }
        }
        next_index = count(answer.stops.len());
    }
    plans.extend(raw_groups(open, next_index));
    plans
}

fn planned_stop<'a>(index: u32, stop: &TidyStop, entries: Vec<&'a EntryRow>) -> StopPlan<'a> {
    StopPlan {
        index,
        title: stop.title.clone(),
        kind: stop.kind,
        look: stop.look.clone().filter(|look: &String| !look.is_empty()),
        entries,
    }
}

/// Die Rohgruppierung: in Nummernfolge; ein neuer Stopp beginnt mit einer anderen Datei oder einer
/// anderen Session. Einträge ohne Pfad bleiben beim laufenden.
fn raw_groups(entries: Vec<&EntryRow>, first_index: u32) -> Vec<StopPlan<'_>> {
    let mut groups: Vec<Vec<&EntryRow>> = Vec::new();
    for entry in entries {
        let starts_new = groups.last().is_none_or(|group: &Vec<&EntryRow>| {
            let session_changes = group
                .last()
                .is_some_and(|last: &&EntryRow| last.session_id != entry.session_id);
            let path_changes = match (
                group
                    .iter()
                    .find_map(|member: &&EntryRow| location_of(member)),
                location_of(entry),
            ) {
                (Some(current), Some(next)) => current != next,
                _ => false,
            };
            session_changes || path_changes
        });
        match groups.last_mut() {
            Some(group) if !starts_new => group.push(entry),
            _ => groups.push(vec![entry]),
        }
    }
    groups
        .into_iter()
        .enumerate()
        .map(|(offset, entries): (usize, Vec<&EntryRow>)| StopPlan {
            index: first_index.saturating_add(count(offset)),
            title: raw_title(&entries),
            kind: StopKind::Flow,
            look: None,
            entries,
        })
        .collect()
}

/// Repository-Eintrag und Pfad eines Eintrags mit Ort.
fn location_of(entry: &EntryRow) -> Option<(&str, &str)> {
    Some((entry.repository_key.as_deref()?, entry.path.as_deref()?))
}

/// Der Dateiname des ersten Eintrags mit Pfad, sonst die erste Bildunterschrift.
fn raw_title(entries: &[&EntryRow]) -> String {
    entries
        .iter()
        .find_map(|entry: &&EntryRow| entry.path.as_deref())
        .map(|path: &str| path.rsplit('/').next().unwrap_or(path).to_owned())
        .or_else(|| {
            entries
                .iter()
                .find_map(|entry: &&EntryRow| entry.caption.clone())
        })
        .unwrap_or_else(|| UNTITLED_STOP.to_owned())
}

/// Was aus Einträgen die Typen der Ansicht macht.
struct Writer<'a> {
    phase: &'a PhaseView,
    ctx: &'a AssembleContext<'a>,
    /// Der Stand der gültigen Ordnung.
    tidied_at: Option<f64>,
}

impl Writer<'_> {
    /// `#<Nr> <Stage>` der Station des Eintrags.
    fn author(&self, entry: &EntryRow) -> String {
        self.ctx
            .labels
            .get(&entry.session_id)
            .cloned()
            .unwrap_or_else(|| {
                let stage = self
                    .phase
                    .stations
                    .iter()
                    .find(|station: &&StationView| station.id == entry.station_id)
                    .map_or("", |station: &StationView| station.stage.as_str());
                format!("#? {stage}")
            })
    }

    fn image(&self, file: &str, width: u32, height: u32) -> ReportImage {
        ReportImage {
            url: (self.ctx.image_url)(&self.phase.id, file),
            width,
            height,
        }
    }

    fn stored_image(&self, image: &ImageRow) -> ReportImage {
        self.image(&image.file, image.width, image.height)
    }

    fn figure(&self, entry: &EntryRow) -> ReportFigure {
        ReportFigure {
            entry: entry.number,
            caption: entry.caption.clone().unwrap_or_default(),
            by: self.author(entry),
            text: text_of(entry),
            mermaid: entry.mermaid.clone(),
            image: entry.image_file.as_deref().map(|file: &str| {
                self.image(
                    file,
                    entry.image_width.unwrap_or_default(),
                    entry.image_height.unwrap_or_default(),
                )
            }),
            marks: entry.marks.clone(),
        }
    }
}

fn text_of(entry: &EntryRow) -> Option<String> {
    (!entry.text.is_empty()).then(|| entry.text.clone())
}

/// Ein Block eines Stopps, bevor seine Datei gelesen ist.
enum BlockPlan<'a> {
    Figure(&'a EntryRow),
    Code {
        target: Target,
        /// Die Notizen der Datei in Reihenfolge des Stopps, mit `true` für den Warum-Text.
        notes: Vec<(&'a EntryRow, bool)>,
    },
}

fn stops_of_phase(
    plans: &[StopPlan<'_>],
    writer: &Writer<'_>,
    files: &mut Files<'_>,
) -> Vec<ReportStop> {
    plans
        .iter()
        .map(|plan: &StopPlan<'_>| stop_of(plan, writer, files))
        .collect()
}

/// Der erste Eintrag ist der Warum-Text, wenn er eine Notiz ist; seine Zeilen gehören zum Block,
/// am Rand steht er nicht.
fn stop_of(plan: &StopPlan<'_>, writer: &Writer<'_>, files: &mut Files<'_>) -> ReportStop {
    let first = plan.entries.first().copied();
    let mut lead: Option<ReportLead> = first
        .filter(|entry: &&EntryRow| entry.tool == EntryTool::Note)
        .map(|entry: &EntryRow| ReportLead {
            entry: entry.number,
            text: entry.text.clone(),
        });
    let mut blocks: Vec<BlockPlan<'_>> = Vec::new();
    for (position, entry) in plan.entries.iter().copied().enumerate() {
        if entry.tool == EntryTool::Figure {
            blocks.push(BlockPlan::Figure(entry));
            continue;
        }
        let is_lead = position == 0;
        let Some((key, path)) = location_of(entry) else {
            // Eine Notiz ohne Ort gibt es über die Werkzeuge nicht; ihr Text geht nicht verloren.
            if let (false, Some(lead)) = (is_lead, lead.as_mut()) {
                lead.text.push_str("\n\n");
                lead.text.push_str(&entry.text);
            }
            continue;
        };
        let target = files.target(key, path);
        let existing = blocks
            .iter_mut()
            .find_map(|block: &mut BlockPlan<'_>| match block {
                BlockPlan::Code {
                    target: known,
                    notes,
                } if known.key == target.key && known.path == target.path => Some(notes),
                _ => None,
            });
        match existing {
            Some(notes) => notes.push((entry, is_lead)),
            None => blocks.push(BlockPlan::Code {
                target,
                notes: vec![(entry, is_lead)],
            }),
        }
    }
    let blocks: Vec<ReportBlock> = blocks
        .into_iter()
        .map(|block: BlockPlan<'_>| match block {
            BlockPlan::Figure(entry) => ReportBlock::Figure(writer.figure(entry)),
            BlockPlan::Code { target, notes } => {
                ReportBlock::Code(code_block(&target, &notes, writer, files))
            }
        })
        .collect();
    let mut stop = ReportStop {
        index: plan.index,
        title: plan.title.clone(),
        kind: plan.kind.as_str().to_owned(),
        look: plan.look.clone(),
        by: first.map_or_else(String::new, |entry: &EntryRow| writer.author(entry)),
        lead,
        blocks,
        derived: false,
        outside: false,
    };
    let outside = code_blocks(&stop)
        .next()
        .and_then(|code: &ReportCode| writer.ctx.checkout(&code.repository_key))
        .is_some_and(|checkout: &Checkout| checkout.outside);
    stop.outside = outside;
    stop
}

fn code_block(
    target: &Target,
    entries: &[(&EntryRow, bool)],
    writer: &Writer<'_>,
    files: &mut Files<'_>,
) -> ReportCode {
    let file = files.read(target);
    let mut places: Vec<Place> = Vec::new();
    let mut notes: Vec<ReportNote> = Vec::new();
    for (entry, is_lead) in entries {
        let place = place_of(file, entry);
        places.push(place);
        if !is_lead {
            let kind = entry.note_kind.unwrap_or(ReportNoteKind::Why);
            notes.push(note_of(entry, kind, place, writer));
        }
    }
    ReportCode {
        repository_key: target.key.clone(),
        path: target.path.clone(),
        added: file.added,
        removed: file.removed,
        rows: block_rows(file, &places),
        notes,
        uncovered: Vec::new(),
        fresh: is_fresh(writer.ctx, writer.phase, target, writer.tidied_at),
        omitted_rows: 0,
    }
}

fn place_of(file: &FileData, entry: &EntryRow) -> Place {
    let from = entry.line_from.unwrap_or(1);
    relocate(
        file.end.as_deref(),
        entry.anchor_text.as_deref(),
        from,
        entry.line_to.unwrap_or(from),
    )
}

/// `label` vergibt `label_notes`, wenn alle Notizen im Block stehen.
fn note_of(
    entry: &EntryRow,
    kind: ReportNoteKind,
    place: Place,
    writer: &Writer<'_>,
) -> ReportNote {
    ReportNote {
        entry: Some(entry.number),
        label: String::new(),
        kind,
        from: place.from,
        to: place.to,
        text: entry.text.clone(),
        by: writer.author(entry),
        open: None,
        moved: place.moved,
    }
}

/// `"1"`, `"2"` … je Code-Block in Zeilenfolge.
fn label_notes(stops: &mut [ReportStop]) {
    for block in stops
        .iter_mut()
        .flat_map(|stop: &mut ReportStop| stop.blocks.iter_mut())
    {
        let ReportBlock::Code(code) = block else {
            continue;
        };
        code.notes
            .sort_by_key(|note: &ReportNote| (note.from, note.to, note.entry));
        for (index, note) in code.notes.iter_mut().enumerate() {
            note.label = (index + 1).to_string();
        }
    }
}

/// Hängt die Lücken der Prüfwerte an den Code: an jeden Block die neuen Zeilen ohne Test, die er
/// zeigt, und jeden überlebten Mutanten als Notiz „M…“ an den ersten Block, der seine Zeile zeigt.
fn mark_gaps(stops: &mut [ReportStop], checks: &PhaseChecks) {
    for block in stops
        .iter_mut()
        .flat_map(|stop: &mut ReportStop| stop.blocks.iter_mut())
    {
        let ReportBlock::Code(code) = block else {
            continue;
        };
        let gaps: Vec<&CheckGap> = checks
            .gaps
            .iter()
            .filter(|gap: &&CheckGap| {
                gap.kind == CheckGapKind::Uncovered
                    && gap.repository_key == code.repository_key
                    && gap.path == code.path
            })
            .collect();
        code.uncovered = code
            .rows
            .iter()
            .filter_map(|row: &ReportRow| row.new)
            .filter(|line: &u32| {
                gaps.iter()
                    .any(|gap: &&CheckGap| (gap.from..=gap.to).contains(line))
            })
            .collect();
    }
    // `gaps` ist je Datei nach Zeilen sortiert; so zählen die Marken in Zeilenfolge.
    for gap in checks
        .gaps
        .iter()
        .filter(|gap: &&CheckGap| gap.kind == CheckGapKind::Mutant)
    {
        let target = Target {
            key: gap.repository_key.clone(),
            path: gap.path.clone(),
            range: None,
        };
        let Some((_, code)) = block_at(stops, &target, gap.from) else {
            continue;
        };
        let number = code
            .notes
            .iter()
            .filter(|note: &&ReportNote| note.kind == ReportNoteKind::Mutant)
            .count()
            + 1;
        code.notes.push(ReportNote {
            entry: None,
            label: format!("M{number}"),
            kind: ReportNoteKind::Mutant,
            from: gap.from,
            to: gap.to,
            text: gap.text.clone(),
            by: checks.by.clone(),
            open: None,
            moved: false,
        });
        // Die Sortierung ist stabil: die Notizen der Stationen behalten ihre Reihenfolge.
        code.notes
            .sort_by_key(|note: &ReportNote| (note.from, note.to));
    }
}

/// Befunde und Schaubilder der Review-Stationen; offene Befunde, deren Zeile in einem Code-Block
/// steht, stehen dort zusätzlich am Rand. Ohne begonnene Review-Station und ohne Befunde `None`.
fn review_of_phase(
    writer: &Writer<'_>,
    entries: &[&EntryRow],
    stops: &mut [ReportStop],
    files: &mut Files<'_>,
) -> Option<ReportReview> {
    let review_stations = tidy::review_stations(writer.phase);
    let findings: Vec<&EntryRow> = entries
        .iter()
        .copied()
        .filter(|entry: &&EntryRow| entry.note_kind == Some(ReportNoteKind::Finding))
        .collect();
    let figures: Vec<&EntryRow> = entries
        .iter()
        .copied()
        .filter(|entry: &&EntryRow| {
            entry.tool == EntryTool::Figure && review_stations.contains(&entry.station_id)
        })
        .collect();
    let reviewer: Option<&StationView> =
        writer.phase.stations.iter().find(|station: &&StationView| {
            review_stations.contains(&station.id) && station.started_at.is_some()
        });
    let by = findings
        .first()
        .or_else(|| figures.first())
        .map(|entry: &&EntryRow| writer.author(entry))
        .or_else(|| {
            let station = reviewer?;
            let label = station
                .session_id
                .as_ref()
                .and_then(|session_id: &String| writer.ctx.labels.get(session_id));
            Some(label.cloned().unwrap_or_else(|| station.stage.clone()))
        })?;
    let mut open: Vec<ReportFinding> = Vec::new();
    let mut resolved: Vec<ReportFinding> = Vec::new();
    for finding in findings {
        let resolved_by: Option<u32> = entries
            .iter()
            .find(|entry: &&&EntryRow| {
                entry.number > finding.number && entry.resolves == Some(finding.number)
            })
            .map(|entry: &&EntryRow| entry.number);
        let mut location: Option<ReportLocation> = None;
        let mut stop: Option<u32> = None;
        if let Some((key, path)) = location_of(finding) {
            let target = files.target(key, path);
            let place = place_of(files.read(&target), finding);
            location = Some(ReportLocation {
                repository_key: target.key.clone(),
                path: target.path.clone(),
                line: place.from,
            });
            if !place.moved
                && let Some((index, code)) = block_at(stops, &target, place.from)
            {
                stop = Some(index);
                if resolved_by.is_none() {
                    let mut note = note_of(finding, ReportNoteKind::Finding, place, writer);
                    note.open = Some(true);
                    code.notes.push(note);
                }
            }
        }
        let item = ReportFinding {
            entry: finding.number,
            text: finding.text.clone(),
            location,
            stop,
            resolved_by,
        };
        match resolved_by {
            Some(_) => resolved.push(item),
            None => open.push(item),
        }
    }
    Some(ReportReview {
        by,
        open,
        resolved,
        figures: figures
            .iter()
            .map(|entry: &&EntryRow| writer.figure(entry))
            .collect(),
    })
}

/// Der erste Code-Block der Datei, der die Zeile des Endstands zeigt, mit dem Index seines Stopps.
fn block_at<'a>(
    stops: &'a mut [ReportStop],
    target: &Target,
    line: u32,
) -> Option<(u32, &'a mut ReportCode)> {
    stops.iter_mut().find_map(|stop: &'a mut ReportStop| {
        let index = stop.index;
        stop.blocks
            .iter_mut()
            .find_map(|block: &'a mut ReportBlock| match block {
                ReportBlock::Code(code)
                    if code.repository_key == target.key
                        && code.path == target.path
                        && code
                            .rows
                            .iter()
                            .any(|row: &ReportRow| row.new == Some(line)) =>
                {
                    Some((index, code))
                }
                _ => None,
            })
    })
}

/// Die Etappen der Ordnung; ein Verweis auf einen entfallenen Stopp entfällt.
fn way_of(answer: &TidyAnswer, stops: &[ReportStop]) -> Vec<ReportWayStep> {
    answer
        .way
        .iter()
        .map(|step: &TidyWay| ReportWayStep {
            text: step.text.clone(),
            files: step.files.clone(),
            detour: step.detour,
            stop: step
                .stop
                .filter(|index: &u32| stops.iter().any(|stop: &ReportStop| stop.index == *index)),
            at: None,
            location: None,
            commit: None,
            calls: Vec::new(),
            reads: 0,
            writes: 0,
            running: false,
        })
        .collect()
}

/// Alle Bildschirme der Sichtabnahme in Aufruf-Reihenfolge.
fn screens_of(entries: &[&EntryRow], writer: &Writer<'_>) -> Vec<ReportScreen> {
    entries
        .iter()
        .filter_map(|entry: &&EntryRow| {
            let screen: &ScreenRow = entry.screen.as_ref()?;
            Some(ReportScreen {
                entry: entry.number,
                name: screen.name.clone(),
                by: writer.author(entry),
                text: text_of(entry),
                deviation: screen.deviation.clone(),
                shots: screen
                    .shots
                    .iter()
                    .map(|shot: &ShotRow| ReportShot {
                        label: shot.label.clone(),
                        image: writer.stored_image(&shot.image),
                        narrow: shot.image.width <= NARROW_MAX_WIDTH,
                        design: shot
                            .design
                            .as_ref()
                            .map(|image: &ImageRow| writer.stored_image(image)),
                        marks: shot.marks.clone(),
                    })
                    .collect(),
                steps: screen
                    .steps
                    .iter()
                    .map(|step: &StepRow| ReportStep {
                        open: step.open.clone(),
                        act: step.act.clone(),
                        expect: step.expect.clone(),
                        before: step
                            .before
                            .as_ref()
                            .map(|image: &ImageRow| writer.stored_image(image)),
                        after: step
                            .after
                            .as_ref()
                            .map(|image: &ImageRow| writer.stored_image(image)),
                    })
                    .collect(),
            })
        })
        .collect()
}
