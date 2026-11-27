//! Die Prüfwerte einer Phase (ADR 073), ohne Werkzeug-Aufruf: der letzte Lauf der Prüfkette aus dem
//! Verlauf, dazu Tests, Abdeckung der neuen Zeilen und Mutation aus den Berichtsdateien der Läufe.
//! Ohne App und ohne Datenbank.
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;
use std::time::UNIX_EPOCH;

use regex::{Captures, Regex};
use serde::Deserialize;

use crate::agents::event::{ChatEntry, ToolState};
use crate::changes::model::{DiffLine, DiffLineKind};
use crate::changes::parse;
use crate::db::tool_details::ToolSummary;
use crate::implementation::model::{PhaseView, StationView};
use crate::report::model::{
    CheckGap, CheckGapKind, CheckRun, CoverageCounts, MutationCounts, PhaseChecks, TestCounts,
};
use crate::report::range::{self, RepoRange};

/// Kommt einer dieser Befehle im Befehl eines Shell-Aufrufs außerhalb eingebetteter Texte vor,
/// war der Aufruf ein Lauf der Prüfkette.
pub const CHECK_COMMANDS: &[&str] = &[
    "pnpm check",
    "pnpm run check",
    "npm run check",
    "yarn check",
    "cargo clippy",
    "cargo test",
    "ruff check",
    "pytest",
    "go vet",
    "go test",
    "gradlew check",
    "make check",
    "check.ps1",
];
const SHELL_TOOLS: [&str; 2] = ["Bash", "PowerShell"];
/// So tief sucht der Verwalter unter dem Ordner eines Bereichs; Dateien darin haben Tiefe 1.
const MAX_SEARCH_DEPTH: u32 = 6;
const SKIPPED_FOLDERS: [&str; 5] = [".git", "node_modules", ".venv", "venv", "__pycache__"];
/// So lange nach dem Ende der letzten Station zählt eine Berichtsdatei noch zur Phase.
const AFTER_END_MS: f64 = 5.0 * 60.0 * 1000.0;
const LCOV_FILE: &str = "lcov.info";
const CARGO_MUTANTS_FILE: &str = "outcomes.json";
const CARGO_MUTANTS_FOLDER: &str = "mutants.out";
const STRYKER_FILES: [&str; 2] = ["mutation.json", "mutation-report.json"];
/// So viele Zeichen zeigt der Text eines Mutanten je Seite.
const MUTANT_TEXT_CHARS: usize = 60;
const UNKNOWN_ORIGINAL: &str = "…";
const UNCOVERED_ONE: &str = "1 neue Zeile ohne Test";
const UNCOVERED_MANY: &str = "neue Zeilen ohne Test";

/// Der Anfang eines Heredocs mit seiner Endmarke; `<<<` ist keiner.
static HEREDOC_START: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?:^|[^<])<<-?[ \t]*(?:'([A-Za-z_]\w*)'|"([A-Za-z_]\w*)"|([A-Za-z_]\w*))"#)
        .expect("festes Muster")
});
static HERE_STRING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?s)@"\r?\n.*?\r?\n"@|@'\r?\n.*?\r?\n'@"#).expect("festes Muster")
});
static QUOTED_TEXT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?s)"(?:\\.|[^"\\])*"|'[^']*'"#).expect("festes Muster"));
/// Kommentare und CDATA: Testausgaben darin dürfen nicht als Elemente zählen.
static XML_NOISE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<!--.*?-->|<!\[CDATA\[.*?\]\]>").expect("festes Muster"));
/// Ein Öffnungs-Tag `testsuites` oder `testsuite`; ein `>` in einem Attributwert beendet es nicht.
static SUITE_TAG: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"<(testsuites|testsuite)((?:\s+[^\s=<>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*/?>"#)
        .expect("festes Muster")
});
static XML_ATTRIBUTE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')"#).expect("festes Muster")
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReportKind {
    Junit,
    Lcov,
    Stryker,
    CargoMutants,
}

/// Zeile und Spalte ab 1, die Spalte in Zeichen.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

/// Ein Abschnitt einer Datei; `end` gehört nicht mehr dazu.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Span {
    pub start: Position,
    pub end: Position,
}

/// Ein erkannter oder überlebter Mutant aus einem Bericht.
#[derive(Debug, Clone)]
pub struct Mutant {
    /// Wie der Bericht die Datei nennt.
    pub file: String,
    pub span: Span,
    pub survived: bool,
    /// Der ersetzte Text; cargo-mutants nennt ihn nicht, dann liest ihn `phase_checks` aus der
    /// Datei.
    pub original: Option<String>,
    pub replacement: String,
}

/// Der Verlauf einer Session.
pub struct SessionLog {
    pub session_id: String,
    pub entries: Vec<ChatEntry>,
    /// Je `tool_use_id`; bei Shell-Aufrufen ist `input` der ganze Befehl.
    pub details: HashMap<String, ToolSummary>,
}

/// Was die Prüfwerte einer Phase bestimmt.
pub struct PhaseEvidence<'a> {
    /// Der Verlauf je Session der Phase, in Stations-Reihenfolge.
    pub sessions: &'a [SessionLog],
    /// Die Commit-Bereiche der Phase.
    pub ranges: &'a [RepoRange],
    /// Die Berichtsdateien (`find_files`).
    pub files: &'a [PathBuf],
    /// Je Session `#<Nr> <Stage>`.
    pub labels: &'a HashMap<String, String>,
}

/// Der letzte Lauf der Prüfkette über alle Sessions, mit der Session, aus der er stammt.
pub fn chain(sessions: &[SessionLog]) -> Option<(CheckRun, String)> {
    sessions
        .iter()
        .enumerate()
        .flat_map(|(position, log): (usize, &SessionLog)| {
            log.entries.iter().filter_map(move |entry: &ChatEntry| {
                let ChatEntry::Tool {
                    seq,
                    at,
                    tool_use_id,
                    tool,
                    target,
                    state,
                    ..
                } = entry
                else {
                    return None;
                };
                if !SHELL_TOOLS.contains(&tool.as_str()) {
                    return None;
                }
                // Ohne gespeicherte Eingabe bleibt nur das Ziel, die gekürzte erste Zeile.
                let command = log
                    .details
                    .get(tool_use_id)
                    .map(|detail: &ToolSummary| detail.input.as_str())
                    .filter(|input: &&str| !input.is_empty())
                    .unwrap_or(target);
                let run = CheckRun {
                    command: check_command(command)?.to_owned(),
                    ok: *state == ToolState::Done,
                };
                Some((
                    (at.unwrap_or_default(), position, *seq),
                    run,
                    &log.session_id,
                ))
            })
        })
        .max_by(|(left, _, _), (right, _, _)| {
            left.0
                .total_cmp(&right.0)
                .then_with(|| (left.1, left.2).cmp(&(right.1, right.2)))
        })
        .map(|(_, run, session_id)| (run, session_id.clone()))
}

/// Entfernt die Zeilen von Heredocs samt Endmarke; ohne Endmarke bleibt alles stehen.
fn without_heredocs(command: &str) -> String {
    let lines: Vec<&str> = command.lines().collect();
    let mut kept: Vec<&str> = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        kept.push(line);
        index += 1;
        if let Some(found) = HEREDOC_START.captures(line)
            && let Some(tag) = found.iter().skip(1).flatten().next()
            && let Some(length) = lines[index..]
                .iter()
                .position(|body: &&str| body.trim() == tag.as_str())
        {
            index += length + 1;
        }
    }
    kept.join("\n")
}

/// Der Befehl ohne Heredocs, Here-Strings und Texte in Anführungszeichen: wer darin einen Befehl
/// nennt, führt ihn nicht aus.
fn without_embedded_text(command: &str) -> String {
    let bodies = without_heredocs(command);
    let strings = HERE_STRING.replace_all(&bodies, "\"\"");
    QUOTED_TEXT.replace_all(&strings, "\"\"").into_owned()
}

/// Der im Befehl zuerst genannte Befehl der Prüfkette.
fn check_command(command: &str) -> Option<&'static str> {
    let unified = without_embedded_text(command)
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .to_lowercase();
    CHECK_COMMANDS
        .iter()
        .filter_map(|command: &&'static str| Some((unified.find(command)?, *command)))
        .min_by_key(|(position, _): &(usize, &str)| *position)
        .map(|(_, command): (usize, &'static str)| command)
}

/// Das Zeitfenster, in dem Berichtsdateien zur Phase zählen, in ms seit der Epoche: ab dem Start der
/// ersten Station bis kurz nach dem Ende der letzten Agenten-Station, ohne Ende, solange eine offen
/// ist. `None` für eine nicht begonnene Phase.
pub fn time_window(phase: &PhaseView) -> Option<(f64, Option<f64>)> {
    let since = phase
        .stations
        .iter()
        .filter_map(|station: &StationView| station.started_at)
        .reduce(f64::min)?;
    let ends: Option<Vec<f64>> = phase
        .stations
        .iter()
        .filter(|station: &&StationView| !station.by_user)
        .map(|station: &StationView| station.completed_at)
        .collect();
    let until = ends
        .and_then(|ends: Vec<f64>| ends.into_iter().reduce(f64::max))
        .map(|end: f64| end + AFTER_END_MS);
    Some((since, until))
}

/// Die Ordner der Bereiche, jeder einmal.
pub fn folders(ranges: &[RepoRange]) -> Vec<PathBuf> {
    let mut folders: Vec<PathBuf> = Vec::new();
    for range in ranges {
        if !folders.contains(&range.folder) {
            folders.push(range.folder.clone());
        }
    }
    folders
}

/// Die Berichtsdateien unter den Ordnern, deren Änderungszeit im Fenster liegt, in Fundreihenfolge
/// (je Ordner nach Namen). Verknüpfungen folgt die Suche nicht.
pub fn find_files(folders: &[PathBuf], since: f64, until: Option<f64>) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    for folder in folders {
        search(folder, 1, since, until, &mut found);
    }
    found
}

fn search(folder: &Path, depth: u32, since: f64, until: Option<f64>, found: &mut Vec<PathBuf>) {
    let Ok(listing) = fs::read_dir(folder) else {
        return;
    };
    let mut children: Vec<fs::DirEntry> = listing.filter_map(Result::ok).collect();
    children.sort_by_key(fs::DirEntry::file_name);
    for child in children {
        let Ok(file_type) = child.file_type() else {
            continue;
        };
        let path = child.path();
        if file_type.is_dir() {
            let name = child.file_name().to_string_lossy().into_owned();
            if depth < MAX_SEARCH_DEPTH && !SKIPPED_FOLDERS.contains(&name.as_str()) {
                search(&path, depth + 1, since, until, found);
            }
        } else if file_type.is_file()
            && kind_of(&path).is_some()
            && modified_ms(&child).is_some_and(|modified: f64| {
                modified >= since && until.is_none_or(|until: f64| modified <= until)
            })
            // Bei ineinander liegenden Repositorys sieht die Suche eine Datei zweimal.
            && !found.contains(&path)
        {
            found.push(path);
        }
    }
}

fn modified_ms(entry: &fs::DirEntry) -> Option<f64> {
    let modified = entry.metadata().ok()?.modified().ok()?;
    let since_epoch = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(since_epoch.as_secs_f64() * 1000.0)
}

fn kind_of(path: &Path) -> Option<ReportKind> {
    let name = path.file_name()?.to_str()?;
    let lower = name.to_lowercase();
    if lower == LCOV_FILE {
        return Some(ReportKind::Lcov);
    }
    if STRYKER_FILES.contains(&lower.as_str()) {
        return Some(ReportKind::Stryker);
    }
    if lower == CARGO_MUTANTS_FILE {
        let in_mutants_folder = path
            .parent()
            .and_then(Path::file_name)
            .is_some_and(|parent| parent.eq_ignore_ascii_case(CARGO_MUTANTS_FOLDER));
        return in_mutants_folder.then_some(ReportKind::CargoMutants);
    }
    // `TEST-*.xml` schreibt Maven bzw. Gradle groß; klein hieße jede `test-*.xml` Testbericht.
    let is_junit = lower.ends_with(".xml")
        && (lower.contains("junit")
            || name.starts_with("TEST-")
            || lower.starts_with("test-results"));
    is_junit.then_some(ReportKind::Junit)
}

/// Die Zahlen eines JUnit-Berichts: je Attribut der Wert von `<testsuites>`, sonst die Summe aller
/// `<testsuite>`. `None` ohne ein Element mit `tests`.
pub fn parse_junit(text: &str) -> Option<TestCounts> {
    let text = XML_NOISE.replace_all(text, "");
    let mut root: Option<HashMap<&str, u32>> = None;
    let mut suites: Vec<HashMap<&str, u32>> = Vec::new();
    for tag in SUITE_TAG.captures_iter(&text) {
        let (Some(element), Some(attributes)) = (tag.get(1), tag.get(2)) else {
            continue;
        };
        let numbers = numbers_of(attributes.as_str());
        if element.as_str() == "testsuites" {
            root.get_or_insert(numbers);
        } else {
            suites.push(numbers);
        }
    }
    let has_total = root
        .iter()
        .chain(&suites)
        .any(|numbers| numbers.contains_key("tests"));
    if !has_total {
        return None;
    }
    let total = |name: &str| {
        root.as_ref()
            .and_then(|numbers: &HashMap<&str, u32>| numbers.get(name).copied())
            .unwrap_or_else(|| {
                suites
                    .iter()
                    .filter_map(|numbers: &HashMap<&str, u32>| numbers.get(name).copied())
                    .fold(0, u32::saturating_add)
            })
    };
    let failed = total("failures").saturating_add(total("errors"));
    let skipped = total("skipped");
    Some(TestCounts {
        passed: total("tests")
            .saturating_sub(failed)
            .saturating_sub(skipped),
        failed,
        skipped,
    })
}

/// Die ganzzahligen Attribute eines Tags.
fn numbers_of(attributes: &str) -> HashMap<&str, u32> {
    XML_ATTRIBUTE
        .captures_iter(attributes)
        .filter_map(|attribute: Captures<'_>| {
            let name = attribute.get(1)?.as_str();
            let value = attribute.get(2).or_else(|| attribute.get(3))?.as_str();
            Some((name, value.trim().parse::<u32>().ok()?))
        })
        .collect()
}

/// Je Datei (`SF:`) die ausführbaren Zeilen mit ihren Treffern (`DA:<zeile>,<treffer>`).
pub fn parse_lcov(text: &str) -> HashMap<String, HashMap<u32, u32>> {
    let mut files: HashMap<String, HashMap<u32, u32>> = HashMap::new();
    let mut current: Option<&str> = None;
    for line in text.lines() {
        let line = line.trim();
        if let Some(file) = line.strip_prefix("SF:") {
            current = Some(file);
        } else if line == "end_of_record" {
            current = None;
        } else if let (Some(file), Some(data)) = (current, line.strip_prefix("DA:")) {
            let mut fields = data.split(',');
            let number = fields
                .next()
                .and_then(|field: &str| field.parse::<u32>().ok());
            let hits = fields
                .next()
                .and_then(|field: &str| field.parse::<u64>().ok());
            if let (Some(number), Some(hits)) = (number, hits) {
                let hits = u32::try_from(hits).unwrap_or(u32::MAX);
                let known = files
                    .entry(file.to_owned())
                    .or_default()
                    .entry(number)
                    .or_default();
                *known = known.saturating_add(hits);
            }
        }
    }
    files
}

#[derive(Deserialize)]
struct StrykerReport {
    files: BTreeMap<String, StrykerFile>,
}

#[derive(Deserialize)]
struct StrykerFile {
    #[serde(default)]
    source: String,
    mutants: Vec<StrykerMutant>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StrykerMutant {
    mutator_name: String,
    #[serde(default)]
    replacement: Option<String>,
    location: Span,
    status: String,
}

/// Die erkannten (`Killed`) und überlebten (`Survived`) Mutanten eines Stryker-Berichts; die
/// übrigen Stände zählen nicht. Leer für eine andere Form.
pub fn parse_stryker(text: &str) -> Vec<Mutant> {
    let Ok(report) = serde_json::from_str::<StrykerReport>(text) else {
        return Vec::new();
    };
    report
        .files
        .into_iter()
        .flat_map(|(file, content): (String, StrykerFile)| {
            let source = content.source;
            content
                .mutants
                .into_iter()
                .filter_map(move |mutant: StrykerMutant| {
                    let survived = match mutant.status.as_str() {
                        "Survived" => true,
                        "Killed" => false,
                        _ => return None,
                    };
                    Some(Mutant {
                        file: file.clone(),
                        span: mutant.location,
                        survived,
                        original: text_of_span(&source, mutant.location),
                        replacement: mutant.replacement.unwrap_or(mutant.mutator_name),
                    })
                })
        })
        .collect()
}

#[derive(Deserialize)]
struct CargoReport {
    outcomes: Vec<CargoOutcome>,
}

#[derive(Deserialize)]
struct CargoOutcome {
    scenario: CargoScenario,
    summary: String,
}

/// `"Baseline"` oder `{"Mutant": {…}}`.
#[derive(Deserialize)]
enum CargoScenario {
    Baseline,
    Mutant(CargoMutant),
}

#[derive(Deserialize)]
struct CargoMutant {
    /// Relativ zur Wurzel des Quellbaums, mit `/`.
    file: String,
    span: Span,
    replacement: String,
}

/// Die erkannten (`CaughtMutant`) und überlebten (`MissedMutant`) Mutanten aus
/// `mutants.out/outcomes.json`. Leer für eine andere Form.
pub fn parse_cargo_mutants(text: &str) -> Vec<Mutant> {
    let Ok(report) = serde_json::from_str::<CargoReport>(text) else {
        return Vec::new();
    };
    report
        .outcomes
        .into_iter()
        .filter_map(|outcome: CargoOutcome| {
            let CargoScenario::Mutant(mutant) = outcome.scenario else {
                return None;
            };
            let survived = match outcome.summary.as_str() {
                "MissedMutant" => true,
                "CaughtMutant" => false,
                _ => return None,
            };
            Some(Mutant {
                file: mutant.file,
                span: mutant.span,
                survived,
                original: None,
                replacement: mutant.replacement,
            })
        })
        .collect()
}

/// Der Text zwischen Anfang (eingeschlossen) und Ende (ausgeschlossen); `None`, wenn es die Stelle
/// nicht gibt.
fn text_of_span(source: &str, span: Span) -> Option<String> {
    let offset = |position: Position| {
        let line_start: usize = source
            .split_inclusive('\n')
            .take(position.line.checked_sub(1)? as usize)
            .map(str::len)
            .sum();
        let line = source.get(line_start..)?.split_inclusive('\n').next()?;
        let column = position.column.checked_sub(1)? as usize;
        let in_line = line
            .char_indices()
            .map(|(index, _): (usize, char)| index)
            .chain([line.len()])
            .nth(column)?;
        Some(line_start + in_line)
    };
    source
        .get(offset(span.start)?..offset(span.end)?)
        .map(str::to_owned)
}

/// Die Prüfwerte einer Phase. Liest die Berichtsdateien und für die neuen Zeilen Git.
pub fn phase_checks(evidence: &PhaseEvidence<'_>) -> PhaseChecks {
    let run = chain(evidence.sessions);
    let by = run
        .as_ref()
        .map(|(_, session_id): &(CheckRun, String)| session_id)
        .or_else(|| {
            evidence
                .sessions
                .last()
                .map(|log: &SessionLog| &log.session_id)
        })
        .and_then(|session_id: &String| evidence.labels.get(session_id))
        .cloned()
        .unwrap_or_default();

    let mut sources: Vec<String> = Vec::new();
    let mut tests: Option<TestCounts> = None;
    let mut lines: HitsByFile = BTreeMap::new();
    let mut mutants: Vec<(FileInRange, Mutant)> = Vec::new();
    for file in evidence.files {
        let Some(kind) = kind_of(file) else {
            continue;
        };
        let Ok(bytes) = fs::read(file) else {
            continue;
        };
        let text = String::from_utf8_lossy(&bytes);
        let is_read = match kind {
            ReportKind::Junit => match parse_junit(&text) {
                Some(counts) => {
                    tests = Some(add_tests(tests, counts));
                    true
                }
                None => false,
            },
            ReportKind::Lcov => add_coverage(&mut lines, file, parse_lcov(&text), evidence.ranges),
            ReportKind::Stryker => {
                add_mutants(&mut mutants, file, parse_stryker(&text), evidence.ranges)
            }
            ReportKind::CargoMutants => add_mutants(
                &mut mutants,
                file,
                parse_cargo_mutants(&text),
                evidence.ranges,
            ),
        };
        if is_read && let Some(name) = file.file_name() {
            let name = name.to_string_lossy().into_owned();
            if !sources.contains(&name) {
                sources.push(name);
            }
        }
    }

    let (coverage, mut gaps) = coverage_of(&lines, evidence.ranges);
    let (mutation, survivors) = mutation_of(mutants, evidence.ranges);
    gaps.extend(survivors);
    gaps.sort_by(|left: &CheckGap, right: &CheckGap| {
        (&left.repository_key, &left.path, left.from).cmp(&(
            &right.repository_key,
            &right.path,
            right.from,
        ))
    });
    PhaseChecks {
        by,
        sources,
        chain: run.map(|(run, _): (CheckRun, String)| run),
        tests,
        coverage,
        mutation,
        gaps,
    }
}

fn add_tests(sum: Option<TestCounts>, counts: TestCounts) -> TestCounts {
    match sum {
        Some(sum) => TestCounts {
            passed: sum.passed.saturating_add(counts.passed),
            failed: sum.failed.saturating_add(counts.failed),
            skipped: sum.skipped.saturating_add(counts.skipped),
        },
        None => counts,
    }
}

/// Eine Datei der Phase: Repository-Eintrag und Pfad relativ zu ihm.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
struct FileInRange {
    repository_key: String,
    path: String,
}

/// Je Datei der Phase die Treffer je ausführbarer Zeile, über alle Berichte addiert.
type HitsByFile = BTreeMap<FileInRange, HashMap<u32, u32>>;

/// `true`, wenn der Bericht gelesen werden konnte, auch ohne eine Datei der Phase.
fn add_coverage(
    lines: &mut HitsByFile,
    report: &Path,
    parsed: HashMap<String, HashMap<u32, u32>>,
    ranges: &[RepoRange],
) -> bool {
    let is_read = !parsed.is_empty();
    for (file, hits) in parsed {
        let Some(found) = locate(&file, report, ranges) else {
            continue;
        };
        let known = lines.entry(found).or_default();
        for (line, count) in hits {
            let sum = known.entry(line).or_default();
            *sum = sum.saturating_add(count);
        }
    }
    is_read
}

fn add_mutants(
    mutants: &mut Vec<(FileInRange, Mutant)>,
    report: &Path,
    parsed: Vec<Mutant>,
    ranges: &[RepoRange],
) -> bool {
    let is_read = !parsed.is_empty();
    let mut located: HashMap<String, Option<FileInRange>> = HashMap::new();
    for mutant in parsed {
        let found = located
            .entry(mutant.file.clone())
            .or_insert_with(|| locate(&mutant.file, report, ranges));
        if let Some(found) = found {
            mutants.push((found.clone(), mutant));
        }
    }
    is_read
}

/// Die Datei der Phase, die ein Bericht meint. Absolute Pfade verlieren den Ordner des Bereichs;
/// relative gelten ab dem nächsten Ordner über der Berichtsdatei, unter dem es die Datei gibt
/// (in einem Monorepo das Paket, nicht die Wurzel).
fn locate(file: &str, report: &Path, ranges: &[RepoRange]) -> Option<FileInRange> {
    let named = PathBuf::from(file.replace('\\', "/"));
    if named.has_root() {
        return in_ranges(&named, ranges);
    }
    let full = report
        .ancestors()
        .skip(1)
        .take_while(|base: &&Path| {
            ranges
                .iter()
                .any(|range: &RepoRange| base.starts_with(&range.folder))
        })
        .map(|base: &Path| base.join(&named))
        .find(|candidate: &PathBuf| candidate.is_file())?;
    in_ranges(&full, ranges)
}

/// Bei ineinander liegenden Repositorys zählt das innerste, das die Datei geändert hat.
fn in_ranges(full: &Path, ranges: &[RepoRange]) -> Option<FileInRange> {
    let parts = parts_of(full);
    let mut best: Option<(usize, FileInRange)> = None;
    for range in ranges {
        let folder = parts_of(&range.folder);
        let is_inside = parts.len() > folder.len()
            && folder
                .iter()
                .zip(&parts)
                .all(|(expected, given): (&String, &String)| is_same_name(expected, given));
        if !is_inside
            || best
                .as_ref()
                .is_some_and(|(depth, _)| *depth >= folder.len())
        {
            continue;
        }
        let relative = parts[folder.len()..].join("/");
        let Some(stat) = range
            .files
            .iter()
            .find(|stat| is_same_name(&stat.path, &relative))
        else {
            continue;
        };
        best = Some((
            folder.len(),
            FileInRange {
                repository_key: range.repository_key.clone(),
                path: stat.path.clone(),
            },
        ));
    }
    best.map(|(_, found): (usize, FileInRange)| found)
}

/// Die Namen eines Pfads ohne `.`, mit aufgelöstem `..` und ohne das Präfix `\\?\`.
fn parts_of(path: &Path) -> Vec<String> {
    let slashed = path.to_string_lossy().replace('\\', "/");
    let slashed = slashed.strip_prefix("//?/").unwrap_or(&slashed);
    let mut parts: Vec<String> = Vec::new();
    for component in Path::new(slashed).components() {
        match component {
            Component::CurDir | Component::RootDir => {}
            Component::ParentDir => {
                parts.pop();
            }
            other => parts.push(other.as_os_str().to_string_lossy().into_owned()),
        }
    }
    parts
}

/// Windows unterscheidet bei Namen keine Groß- und Kleinschreibung.
fn is_same_name(left: &str, right: &str) -> bool {
    if cfg!(windows) {
        left.to_lowercase() == right.to_lowercase()
    } else {
        left == right
    }
}

/// Der erste Bereich, der die Datei geändert hat — wie beim Code-Block des Berichts.
fn range_of<'a>(file: &FileInRange, ranges: &'a [RepoRange]) -> Option<&'a RepoRange> {
    ranges.iter().find(|range: &&RepoRange| {
        range.repository_key == file.repository_key && range.file(&file.path).is_some()
    })
}

/// Abdeckung der in der Phase neu hinzugefügten Zeilen, die der Bericht als ausführbar führt, und
/// die nicht ausgeführten davon als Lücken.
fn coverage_of(
    lines: &HitsByFile,
    ranges: &[RepoRange],
) -> (Option<CoverageCounts>, Vec<CheckGap>) {
    let mut counts = CoverageCounts {
        covered: 0,
        total: 0,
    };
    let mut gaps: Vec<CheckGap> = Vec::new();
    // Je Bereich ein Git-Aufruf für alle seine Dateien.
    for range in ranges {
        let files: Vec<(&FileInRange, &HashMap<u32, u32>)> = lines
            .iter()
            .filter(|(file, _)| {
                range_of(file, ranges).is_some_and(|first: &RepoRange| std::ptr::eq(first, range))
            })
            .collect();
        if files.is_empty() {
            continue;
        }
        let paths: Vec<&str> = files.iter().map(|(file, _)| file.path.as_str()).collect();
        let patches = range::file_patches(range, &paths);
        for (file, hits) in files {
            let Some(patch) = patches.get(&file.path) else {
                continue;
            };
            let mut missed: Vec<u32> = Vec::new();
            for line in parse::unified(patch)
                .lines
                .iter()
                .filter(|line: &&DiffLine| line.kind == DiffLineKind::Added)
                .filter_map(|line: &DiffLine| line.new_line)
            {
                let Some(hit_count) = hits.get(&line) else {
                    continue;
                };
                counts.total = counts.total.saturating_add(1);
                if *hit_count > 0 {
                    counts.covered = counts.covered.saturating_add(1);
                } else {
                    missed.push(line);
                }
            }
            gaps.extend(uncovered_gaps(file, &missed));
        }
    }
    ((counts.total > 0).then_some(counts), gaps)
}

/// Aufeinanderfolgende Zeilen werden ein Bereich; `missed` ist aufsteigend.
fn uncovered_gaps(file: &FileInRange, missed: &[u32]) -> Vec<CheckGap> {
    let mut runs: Vec<(u32, u32)> = Vec::new();
    for line in missed {
        match runs.last_mut() {
            Some(run) if *line == run.1.saturating_add(1) => run.1 = *line,
            _ => runs.push((*line, *line)),
        }
    }
    runs.into_iter()
        .map(|(from, to): (u32, u32)| CheckGap {
            kind: CheckGapKind::Uncovered,
            repository_key: file.repository_key.clone(),
            path: file.path.clone(),
            from,
            to,
            text: if from == to {
                UNCOVERED_ONE.to_owned()
            } else {
                format!("{} {UNCOVERED_MANY}", to - from + 1)
            },
        })
        .collect()
}

/// Die Zahlen über alle Mutanten in Dateien der Phase und die überlebten als Lücken.
fn mutation_of(
    mutants: Vec<(FileInRange, Mutant)>,
    ranges: &[RepoRange],
) -> (Option<MutationCounts>, Vec<CheckGap>) {
    if mutants.is_empty() {
        return (None, Vec::new());
    }
    let mut counts = MutationCounts {
        killed: 0,
        survived: 0,
    };
    let mut texts: HashMap<FileInRange, Option<String>> = HashMap::new();
    let mut gaps: Vec<CheckGap> = Vec::new();
    for (file, mutant) in mutants {
        if !mutant.survived {
            counts.killed = counts.killed.saturating_add(1);
            continue;
        }
        counts.survived = counts.survived.saturating_add(1);
        let original = mutant.original.clone().or_else(|| {
            let end_text = texts.entry(file.clone()).or_insert_with(|| {
                range_of(&file, ranges).and_then(|range: &RepoRange| {
                    range::end_texts(range, &[file.path.as_str()]).remove(&file.path)
                })
            });
            text_of_span(end_text.as_deref()?, mutant.span)
        });
        gaps.push(CheckGap {
            kind: CheckGapKind::Mutant,
            repository_key: file.repository_key,
            path: file.path,
            from: mutant.span.start.line,
            to: mutant.span.start.line,
            text: format!(
                "„{}“ → „{}“",
                original.map_or_else(|| UNKNOWN_ORIGINAL.to_owned(), |text| one_line(&text)),
                one_line(&mutant.replacement)
            ),
        });
    }
    (Some(counts), gaps)
}

fn one_line(text: &str) -> String {
    let line = text.split_whitespace().collect::<Vec<&str>>().join(" ");
    if line.chars().count() <= MUTANT_TEXT_CHARS {
        return line;
    }
    let mut short: String = line.chars().take(MUTANT_TEXT_CHARS).collect();
    short.push('…');
    short
}
