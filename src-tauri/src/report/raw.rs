//! Die Rohfassung einer Phase: ihre Einträge als Markdown in Nummernfolge. Code steht nie darin,
//! `at` zeigt auf Git.
use std::collections::HashMap;

use crate::db::report::{EntryRow, EntryTool};
use crate::implementation::model::{ImplementationView, PhaseView, StationView};
use crate::report::model::{ImageRow, ReportMark, ReportNoteKind, ScreenRow, ShotRow, StepRow};

const UNKNOWN_LABEL: &str = "#?";

/// Je Session einer Station `#<Nr> <Stage>`; ohne bekannte Nummer `#? <Stage>`. `numbers` kennt
/// auch Sessions, die nicht laufen; die Ansicht nennt nur die der laufenden App.
pub fn session_labels(
    view: &ImplementationView,
    numbers: &HashMap<String, u32>,
) -> HashMap<String, String> {
    view.phases
        .iter()
        .flat_map(|phase: &PhaseView| phase.stations.iter())
        .filter_map(|station: &StationView| {
            let session_id = station.session_id.clone()?;
            let number = station
                .session_number
                .or_else(|| numbers.get(&session_id).copied())
                .map_or_else(|| "?".to_owned(), |number: u32| number.to_string());
            Some((session_id, format!("#{number} {}", station.stage)))
        })
        .collect()
}

/// `entries` sind die einer Phase; `labels` nennt je Session `#<Nr> <Stage>`.
pub fn raw_markdown(
    phase_key: &str,
    entries: &[EntryRow],
    labels: &HashMap<String, String>,
) -> String {
    let mut ordered: Vec<&EntryRow> = entries.iter().collect();
    ordered.sort_by_key(|entry: &&EntryRow| entry.number);
    let mut sections: Vec<String> = vec![format!("<!-- Phase {phase_key} · Rohfassung -->")];
    for entry in ordered {
        let label = labels
            .get(&entry.session_id)
            .map_or(UNKNOWN_LABEL, String::as_str);
        sections.push(section(entry, label));
    }
    let mut markdown = sections.join("\n\n");
    markdown.push('\n');
    markdown
}

fn section(entry: &EntryRow, label: &str) -> String {
    let tool = match entry.tool {
        EntryTool::Note => "note",
        EntryTool::Figure => "figure",
        EntryTool::Screen => "screen",
    };
    let mut head: Vec<String> = vec![format!("## n{} · {tool} · {label}", entry.number)];
    let mut blocks: Vec<String> = Vec::new();
    match entry.tool {
        EntryTool::Note => {
            head.extend(at_line(entry));
            match entry.note_kind {
                Some(ReportNoteKind::Risk) => head.push("kind: risk".to_owned()),
                Some(ReportNoteKind::Finding) => head.push("kind: finding".to_owned()),
                _ => {}
            }
            if let Some(resolved) = entry.resolves {
                head.push(format!("resolves: n{resolved}"));
            }
            blocks.push(entry.text.clone());
        }
        EntryTool::Figure => {
            if let Some(caption) = &entry.caption {
                head.push(format!("caption: {caption}"));
            }
            head.extend(at_line(entry));
            head.extend(image_line(entry));
            if let Some(mermaid) = &entry.mermaid {
                blocks.push(format!("```mermaid\n{}\n```", mermaid.trim_end()));
            }
            blocks.push(entry.text.clone());
            blocks.push(legend(entry.marks.iter()));
        }
        EntryTool::Screen => {
            if let Some(screen) = &entry.screen {
                head.push(format!("screen: {}", screen.name));
                head.extend(at_line(entry));
                head.extend(screen_lines(screen));
                blocks.push(entry.text.clone());
                blocks.push(legend(
                    screen
                        .shots
                        .iter()
                        .flat_map(|shot: &ShotRow| shot.marks.iter()),
                ));
            }
        }
    }
    std::iter::once(head.join("\n"))
        .chain(
            blocks
                .into_iter()
                .filter(|block: &String| !block.is_empty()),
        )
        .collect::<Vec<String>>()
        .join("\n\n")
}

fn at_line(entry: &EntryRow) -> Option<String> {
    let path = entry.path.as_ref()?;
    let from = entry.line_from?;
    let to = entry.line_to.unwrap_or(from);
    if from == to {
        return Some(format!("at: {path}:{from}"));
    }
    Some(format!("at: {path}:{from}-{to}"))
}

/// `image: <datei> · marks: 1@<x%>,<y%> …`
fn image_line(entry: &EntryRow) -> Option<String> {
    let file = entry.image_file.as_ref()?;
    let mut line = format!("image: {file}");
    if !entry.marks.is_empty() {
        let width = entry.image_width.unwrap_or_default();
        let height = entry.image_height.unwrap_or_default();
        let marks: Vec<String> = entry
            .marks
            .iter()
            .map(|mark: &ReportMark| {
                format!(
                    "{}@{},{}",
                    mark.n,
                    percent(mark.x, width),
                    percent(mark.y, height)
                )
            })
            .collect();
        line.push_str(&format!(" · marks: {}", marks.join(" ")));
    }
    Some(line)
}

/// Gerundet; ohne Maß 0.
fn percent(value: u32, total: u32) -> u64 {
    let total = u64::from(total);
    (u64::from(value) * 100 + total / 2)
        .checked_div(total)
        .unwrap_or(0)
}

/// `- <n>: <text>` je Marke mit Text; dieselbe Zeile aus mehreren Ansichten steht einmal da.
fn legend<'a>(marks: impl Iterator<Item = &'a ReportMark>) -> String {
    let mut lines: Vec<String> = Vec::new();
    for mark in marks {
        let Some(text) = &mark.text else {
            continue;
        };
        let line = format!("- {}: {text}", mark.n);
        if !lines.contains(&line) {
            lines.push(line);
        }
    }
    lines.join("\n")
}

fn screen_lines(screen: &ScreenRow) -> Vec<String> {
    let shots: Vec<String> = screen.shots.iter().map(shot_text).collect();
    let mut lines: Vec<String> = vec![format!("shots: {}", shots.join(" · "))];
    if let Some(deviation) = &screen.deviation {
        lines.push(format!("abweichung: {deviation}"));
    }
    if !screen.steps.is_empty() {
        lines.push("schritte:".to_owned());
        lines.extend(
            screen
                .steps
                .iter()
                .enumerate()
                .map(|(index, step): (usize, &StepRow)| step_text(index + 1, step)),
        );
    }
    lines
}

fn shot_text(shot: &ShotRow) -> String {
    let mut details: Vec<String> = vec![shot.image.file.clone()];
    if let Some(design) = &shot.design {
        details.push(format!("Entwurf {}", design.file));
    }
    if !shot.marks.is_empty() {
        let marks: Vec<String> = shot
            .marks
            .iter()
            .map(|mark: &ReportMark| {
                format!("{}@{},{},{},{}", mark.n, mark.x, mark.y, mark.w, mark.h)
            })
            .collect();
        details.push(format!("marks {}", marks.join(" ")));
    }
    format!("{} ({})", shot.label, details.join(", "))
}

fn step_text(number: usize, step: &StepRow) -> String {
    let mut line = format!("{number}. {} → {} → {}", step.open, step.act, step.expect);
    let images: [(&str, &Option<ImageRow>); 2] =
        [("vorher", &step.before), ("nachher", &step.after)];
    for (name, image) in images {
        if let Some(image) = image {
            line.push_str(&format!(" · {name} {}", image.file));
        }
    }
    line
}
