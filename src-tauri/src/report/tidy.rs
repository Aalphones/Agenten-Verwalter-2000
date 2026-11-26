//! Die Haiku-Ordnung einer Phase (ADR 073): die Eingabe aus Rohfassung und Spur, die Prüfung der
//! Antwort und die geordnete Fassung als Markdown. Ohne App und ohne Datenbank.
use std::collections::{HashMap, HashSet};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::anchor;
use super::model::ReportNoteKind;
use crate::agents::event::ChatEntry;
use crate::changes::sources::Source;
use crate::db::report::{EntryRow, EntryTool};
use crate::db::tool_details::ToolSummary;
use crate::implementation::model::{PhaseView, StationView};
use crate::retro::tools::cut_middle;

pub const TIDY_SYSTEM: &str = "Du ordnest den Review-Bericht einer Phase. Eingabe: die Rohfassung (Einträge n1, n2 … mit Text, Ort und Schaubild) und die Spur der Umsetzung. Antworte nur nach Schema. result: was die Phase bewirkt, höchstens zwei Sätze, Klartext. way: höchstens acht Etappen in der Reihenfolge der Spur, je ein Satz; detour für einen Umweg, der wieder verworfen wurde; stop: Index des Stopps, zu dem die Etappe gehört. stops: fasse zusammengehörige Einträge zu Stopps; title höchstens sechs Wörter; kind data, sec, flow oder ui; look ein Satz, worauf der Prüfer achten soll. Jede ID aus „Zu ordnen“ steht in genau einem Stopp, keine andere. Schreibe keine Eintragstexte um.";

/// Ohne Zeilenumbrüche: der Text geht als ein Argument an die Kommandozeile.
pub const TIDY_SCHEMA: &str = concat!(
    r#"{"type":"object","additionalProperties":false,"required":["result","way","stops"],"#,
    r#""properties":{"#,
    r#""result":{"type":"string","maxLength":400},"#,
    r#""way":{"type":"array","maxItems":8,"items":{"type":"object","additionalProperties":false,"required":["text","files"],"#,
    r#""properties":{"text":{"type":"string","maxLength":200},"files":{"type":"array","maxItems":4,"items":{"type":"string"}},"detour":{"type":"boolean"},"stop":{"type":"integer","minimum":0}}}},"#,
    r#""stops":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["title","kind","ids"],"#,
    r#""properties":{"title":{"type":"string","maxLength":80},"kind":{"enum":["data","sec","flow","ui"]},"look":{"type":"string","maxLength":160},"ids":{"type":"array","items":{"type":"string","pattern":"^n[0-9]+$"}}}}}}}"#,
);

pub const TIDY_TIMEOUT: Duration = Duration::from_secs(120);
const SPUR_MAX_CHARS: usize = 40_000;
/// Ein längerer Antworttext ist keine Zweckzeile.
const PURPOSE_MAX_CHARS: usize = 120;
/// Wortteile der Stage (klein geschrieben), an denen eine Station nicht zur Spur zählt.
const REVIEW_STAGE: &str = "review";
const TEST_STAGE: &str = "test";

/// Die Antwort von Haiku auf `TIDY_SCHEMA`; geprüft steht sie in `report_phases.tidy_json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TidyAnswer {
    pub result: String,
    pub way: Vec<TidyWay>,
    pub stops: Vec<TidyStop>,
}

/// Eine Etappe des Wegs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TidyWay {
    pub text: String,
    pub files: Vec<String>,
    #[serde(default)]
    pub detour: bool,
    /// Index in `TidyAnswer.stops`.
    #[serde(default)]
    pub stop: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TidyStop {
    pub title: String,
    pub kind: StopKind,
    #[serde(default)]
    pub look: Option<String>,
    /// `"n<k>"` je Eintrag.
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StopKind {
    Data,
    Sec,
    Flow,
    Ui,
}

impl StopKind {
    pub fn as_str(self) -> &'static str {
        match self {
            StopKind::Data => "data",
            StopKind::Sec => "sec",
            StopKind::Flow => "flow",
            StopKind::Ui => "ui",
        }
    }
}

/// Der Verlauf einer Station, wie die Spur ihn braucht.
pub struct StationTrace {
    /// `#<Nr> <Stage>`.
    pub label: String,
    pub entries: Vec<ChatEntry>,
    pub details: HashMap<String, ToolSummary>,
}

/// Die IDs der Review-Stationen der Phase.
pub fn review_stations(phase: &PhaseView) -> HashSet<String> {
    phase
        .stations
        .iter()
        .filter(|station: &&StationView| has_stage(station, REVIEW_STAGE))
        .map(|station: &StationView| station.id.clone())
        .collect()
}

/// Die Stationen, deren Verlauf in die Spur geht: mit Session, weder Test noch Review.
pub fn spur_stations(phase: &PhaseView) -> Vec<&StationView> {
    phase
        .stations
        .iter()
        .filter(|station: &&StationView| {
            station.session_id.is_some()
                && !has_stage(station, TEST_STAGE)
                && !has_stage(station, REVIEW_STAGE)
        })
        .collect()
}

fn has_stage(station: &StationView, part: &str) -> bool {
    station.stage.to_lowercase().contains(part)
}

/// Die zu ordnenden Nummern einer Phase, aufsteigend. Befunde und ihre Behebungen stehen im
/// Abschnitt „Review“, ebenso die Schaubilder der Review-Stationen; Bildschirme stehen in der
/// Sichtabnahme.
pub fn to_order(entries: &[EntryRow], review_stations: &HashSet<String>) -> Vec<u32> {
    let mut numbers: Vec<u32> = entries
        .iter()
        .filter(|entry: &&EntryRow| {
            if entry.note_kind == Some(ReportNoteKind::Finding) || entry.resolves.is_some() {
                return false;
            }
            match entry.tool {
                EntryTool::Note => true,
                EntryTool::Figure => !review_stations.contains(&entry.station_id),
                EntryTool::Screen => false,
            }
        })
        .map(|entry: &EntryRow| entry.number)
        .collect();
    numbers.sort_unstable();
    numbers
}

/// Die Nummern der Bildschirme in Aufruf-Reihenfolge.
pub fn screen_numbers(entries: &[EntryRow]) -> Vec<u32> {
    let mut numbers: Vec<u32> = entries
        .iter()
        .filter(|entry: &&EntryRow| entry.tool == EntryTool::Screen)
        .map(|entry: &EntryRow| entry.number)
        .collect();
    numbers.sort_unstable();
    numbers
}

/// Je Station ein Abschnitt mit Zweckzeilen, darunter die Beschreibungen der Werkzeug-Aufrufe und
/// die geschriebenen Dateien; über der Grenze in der Mitte gekürzt.
pub fn spur(stations: &[StationTrace], sources: &[Source]) -> String {
    let mut lines: Vec<String> = Vec::new();
    for station in stations {
        lines.push(format!("### {}", station.label));
        lines.extend(station_lines(station, sources));
    }
    cut_middle(lines.join("\n"), SPUR_MAX_CHARS)
}

fn station_lines(station: &StationTrace, sources: &[Source]) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut entries = station.entries.iter().peekable();
    while let Some(entry) = entries.next() {
        match entry {
            ChatEntry::Text { text, .. } => {
                let announces_call = matches!(entries.peek(), Some(ChatEntry::Tool { .. }));
                let purpose = single_line(text);
                let length = purpose.chars().count();
                if announces_call && length > 0 && length <= PURPOSE_MAX_CHARS {
                    lines.push(format!("- {purpose}"));
                }
            }
            ChatEntry::Tool {
                tool_use_id,
                tool,
                target,
                description,
                ..
            } => {
                if let Some(description) = description {
                    let description = single_line(description);
                    if !description.is_empty() {
                        lines.push(format!("  - {tool}: {description}"));
                    }
                }
                if anchor::is_write(entry)
                    && let Some(file) =
                        written_file(target, station.details.get(tool_use_id), sources)
                {
                    lines.push(format!("  - {tool} {file}"));
                }
            }
            _ => {}
        }
    }
    lines
}

/// Relativ zum Repository; eine Datei außerhalb nur mit ihrem Namen, damit kein Benutzerordner in
/// die Eingabe gelangt.
fn written_file(target: &str, summary: Option<&ToolSummary>, sources: &[Source]) -> Option<String> {
    let input: Option<Value> =
        summary.and_then(|summary: &ToolSummary| serde_json::from_str(&summary.input).ok());
    let path = anchor::written_path(target, input.as_ref())?;
    match anchor::resolve_path(sources, &path.to_string_lossy()) {
        Ok(resolved) => Some(resolved.path),
        Err(_) => path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned()),
    }
}

/// Rohfassung, die zu ordnenden IDs und die Spur.
pub fn haiku_input(raw: &str, to_order: &[u32], spur: &str) -> String {
    let ids: Vec<String> = to_order.iter().map(|number: &u32| id_of(*number)).collect();
    format!(
        "{}\n\n## Zu ordnen\n{}\n\n## Spur\n{spur}\n",
        raw.trim_end(),
        ids.join(" ")
    )
}

/// Jede zu ordnende ID steht in genau einem Stopp, keine andere; jede Etappe zeigt auf einen
/// vorhandenen Stopp. Der Fehler ist der Grund, mit dem die Ordnung verworfen wird.
pub fn check(answer: &TidyAnswer, to_order: &[u32]) -> Result<(), String> {
    let expected: Vec<String> = to_order.iter().map(|number: &u32| id_of(*number)).collect();
    let mut seen: HashSet<&str> = HashSet::new();
    for id in answer
        .stops
        .iter()
        .flat_map(|stop: &TidyStop| stop.ids.iter())
    {
        if !expected.contains(id) {
            return Err(format!("{id} unbekannt"));
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{id} doppelt"));
        }
    }
    if let Some(missing) = expected
        .iter()
        .find(|id: &&String| !seen.contains(id.as_str()))
    {
        return Err(format!("{missing} fehlt"));
    }
    for (index, step) in answer.way.iter().enumerate() {
        let points_nowhere = step.stop.is_some_and(|stop: u32| {
            usize::try_from(stop).map_or(true, |stop: usize| stop >= answer.stops.len())
        });
        if points_nowhere {
            return Err(format!("Etappe {} zeigt auf keinen Stopp", index + 1));
        }
    }
    Ok(())
}

/// Die geordnete Fassung; `screens` sind die Nummern der Bildschirme (`screen_numbers`).
pub fn tidy_markdown(phase_key: &str, title: &str, answer: &TidyAnswer, screens: &[u32]) -> String {
    let mut lines: Vec<String> = vec![
        format!("# Phase {phase_key} · {title}"),
        format!("Ergebnis: {}", single_line(&answer.result)),
    ];
    if !answer.way.is_empty() {
        lines.push("## Weg".to_owned());
        for (index, step) in answer.way.iter().enumerate() {
            let marker = if step.detour { "**Umweg:** " } else { "" };
            lines.push(format!(
                "{}. {marker}{}",
                index + 1,
                single_line(&step.text)
            ));
        }
    }
    for stop in &answer.stops {
        lines.push(format!(
            "## {} {{{}}}",
            single_line(&stop.title),
            stop.kind.as_str()
        ));
        let look = stop.look.as_deref().map(single_line).unwrap_or_default();
        if !look.is_empty() {
            lines.push(format!("look: {look}"));
        }
        lines.push(stop.ids.join(" "));
    }
    if !screens.is_empty() {
        let ids: Vec<String> = screens.iter().map(|number: &u32| id_of(*number)).collect();
        lines.push("## Sichtabnahme".to_owned());
        lines.push(ids.join(" "));
    }
    let mut markdown = lines.join("\n");
    markdown.push('\n');
    markdown
}

fn id_of(number: u32) -> String {
    format!("n{number}")
}

fn single_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<&str>>().join(" ")
}
