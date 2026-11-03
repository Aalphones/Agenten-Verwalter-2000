//! Lagebericht einer Umsetzung als Text: für `implementation_get`, die Ansicht und Rückfragen.
use chrono::{DateTime, Local, TimeZone};

use super::model::{ImplementationView, PhaseView, StationState, StationView};

const INQUIRY_LINE: &str =
    "Diese Session ist eine Rückfrage: lesen, erklären, umplanen; keinen Code ändern.";
const INDENT: &str = "  ";
const SEPARATOR: &str = " · ";

pub fn text(view: &ImplementationView, now_ms: f64, for_inquiry: bool) -> String {
    let mut lines: Vec<String> = vec![format!(
        "Lage: Umsetzung {} — Stand {}",
        view.name,
        clock(now_ms)
    )];
    if for_inquiry {
        lines.push(INQUIRY_LINE.to_owned());
    }
    if !view.source.is_empty() {
        lines.push(format!("Quelle: {}", view.source));
    }
    lines.push(format!(
        "Stand: Phase {} von {} · {} von {} Sessions fertig",
        view.current_phase,
        view.phases.len(),
        view.stations_done,
        view.stations_total
    ));
    push_section(&mut lines, "Jetzt", now_lines(view), "nichts läuft");
    push_section(&mut lines, "Fertig", done_lines(view), "noch nichts");
    let open = open_summary(view);
    if open.is_empty() {
        lines.push("Offen: nichts".to_owned());
    } else {
        lines.push(format!("Offen: {open}"));
    }
    lines.join("\n")
}

fn push_section(lines: &mut Vec<String>, title: &str, entries: Vec<String>, empty: &str) {
    if entries.is_empty() {
        lines.push(format!("{title}: {empty}"));
        return;
    }
    lines.push(format!("{title}:"));
    lines.extend(
        entries
            .into_iter()
            .map(|entry: String| format!("{INDENT}{entry}")),
    );
}

/// Stationen mit Session, die noch nicht fertig gemeldet sind.
fn now_lines(view: &ImplementationView) -> Vec<String> {
    let mut entries: Vec<String> = Vec::new();
    for (phase, station) in stations(view) {
        let label = match station.state {
            StationState::Starting | StationState::Running => "läuft",
            StationState::Asking => "fragt dich:",
            StationState::WaitsForYou => "wartet auf dich",
            StationState::Error => "Fehler",
            _ => continue,
        };
        entries.push(format!(
            "Phase {} · {}{} {label}",
            phase.key,
            station.stage,
            number_in_brackets(station)
        ));
        if let Some(question) = &station.question {
            entries.push(format!("{INDENT}{}", first_line(question)));
        }
    }
    entries
}

fn done_lines(view: &ImplementationView) -> Vec<String> {
    stations(view)
        .filter(|(_, station): &(&PhaseView, &StationView)| station.state == StationState::Done)
        .map(|(phase, station): (&PhaseView, &StationView)| {
            let number = station
                .session_number
                .map(|number: u32| format!(" #{number}"))
                .unwrap_or_default();
            let result = station.result.as_deref().unwrap_or("ohne Ergebnis");
            format!("Phase {} · {}{number} — {result}", phase.key, station.stage)
        })
        .collect()
}

/// Kommende Stationen gruppiert: „Phase 2 Review · Phase 3–5 · Abschluss“. Ganz offene Phasen mit
/// Nummer in Folge werden zusammengezogen, teils offene nennen ihre offenen Stufen.
pub fn open_summary(view: &ImplementationView) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut run: Vec<&str> = Vec::new();
    for phase in &view.phases {
        let open: Vec<&StationView> = phase
            .stations
            .iter()
            .filter(|station: &&StationView| is_upcoming(station))
            .collect();
        let is_fully_open = !open.is_empty() && open.len() == phase.stations.len();
        if is_fully_open && is_numbered(&phase.key) {
            run.push(&phase.key);
            continue;
        }
        flush_run(&mut parts, &mut run);
        if is_fully_open {
            parts.push(phase_label(&phase.key));
            continue;
        }
        if !open.is_empty() {
            let stages: Vec<&str> = open
                .iter()
                .map(|station: &&StationView| station.stage.as_str())
                .collect();
            parts.push(format!("{} {}", phase_label(&phase.key), stages.join(", ")));
        }
    }
    flush_run(&mut parts, &mut run);
    parts.join(SEPARATOR)
}

fn flush_run(parts: &mut Vec<String>, run: &mut Vec<&str>) {
    match run.as_slice() {
        [] => {}
        [only] => parts.push(phase_label(only)),
        [first, .., last] => parts.push(format!("{}–{last}", phase_label(first))),
    }
    run.clear();
}

/// „Phase 3“ für einen Schlüssel, der mit einer Ziffer beginnt; sonst der Schlüssel selbst
/// („Abschluss“).
fn phase_label(key: &str) -> String {
    if is_numbered(key) {
        format!("Phase {key}")
    } else {
        key.to_owned()
    }
}

fn is_numbered(key: &str) -> bool {
    key.starts_with(|character: char| character.is_ascii_digit())
}

fn is_upcoming(station: &StationView) -> bool {
    station.session_id.is_none() && station.state != StationState::Done
}

fn stations(view: &ImplementationView) -> impl Iterator<Item = (&PhaseView, &StationView)> {
    view.phases.iter().flat_map(|phase: &PhaseView| {
        phase
            .stations
            .iter()
            .map(move |station: &StationView| (phase, station))
    })
}

fn number_in_brackets(station: &StationView) -> String {
    station
        .session_number
        .map(|number: u32| format!(" (#{number})"))
        .unwrap_or_default()
}

fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or_default().trim()
}

/// Ortszeit „HH:MM“.
fn clock(now_ms: f64) -> String {
    Local
        .timestamp_millis_opt(now_ms as i64)
        .single()
        .map(|time: DateTime<Local>| time.format("%H:%M").to_string())
        .unwrap_or_default()
}
