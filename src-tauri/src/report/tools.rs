//! Werkzeuge des Review-Berichts im MCP-Zugang (ADR 073): eine Station hängt Erklärungen,
//! Befunde, Schaubilder und die Fotos der Sichtabnahme an den Bericht ihrer Phase.
use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

use super::anchor::{self, ResolvedPath};
use super::images::{StagedImage, StagedImages};
use super::model::{ImageRow, ReportMark, ReportNoteKind, ScreenRow, ShotRow, StepRow};
use super::{emit_changed, phase_dir};
use crate::changes::model::ChangesReach;
use crate::changes::sources;
use crate::db::Database;
use crate::db::report::{EntryTool, NewEntry};
use crate::error::CommandError;
use crate::implementation::model::{PhaseView, StationView, check_length};
use crate::implementation::now_ms;
use crate::mcp_access::tools::{ToolCall, ToolResult, ToolSet, ToolSpec};
use crate::sessions::registry::SessionRegistry;
use crate::settings::{self, model::Settings};

const NOTE: &str = "report_note";
const FIGURE: &str = "report_figure";
const SCREEN: &str = "report_screen";
const OFF_MESSAGE: &str = "Der Review-Bericht ist in den Einstellungen ausgeschaltet. Schreib deinen Bericht so, wie es deine Anweisungen ohne diese Werkzeuge verlangen.";
const NO_REGISTRY: &str = "Der Verwalter startet noch";
const NOT_A_STATION: &str = "Diese Session ist keine Station.";
const ONE_PICTURE: &str = "Gib genau eines von mermaid und image an.";
const MARKS_NEED_IMAGE: &str = "marks: nur zusammen mit image";

const MAX_TEXT_CHARS: usize = 1500;
const MAX_CAPTION_CHARS: usize = 120;
const MAX_MERMAID_CHARS: usize = 6000;
const MAX_MARKS: usize = 9;
const MAX_MARK_NUMBER: u32 = 9;
const MAX_MARK_TEXT_CHARS: usize = 300;
const MAX_SCREEN_CHARS: usize = 80;
const MAX_SHOTS: usize = 8;
const MAX_LABEL_CHARS: usize = 40;
const MAX_DEVIATION_CHARS: usize = 300;
const MAX_STEPS: usize = 8;
const MAX_STEP_CHARS: usize = 160;

pub struct ReportTools;

impl ToolSet for ReportTools {
    fn prefix(&self) -> &'static str {
        "report_"
    }

    fn tools(&self) -> Vec<ToolSpec> {
        vec![note_spec(), figure_spec(), screen_spec()]
    }

    fn call(&self, call: &ToolCall) -> ToolResult {
        let outcome = station_of(call).and_then(|station: Station<'_>| match call.name {
            NOTE => note(&station),
            FIGURE => figure(&station),
            SCREEN => screen(&station),
            other => Err(format!("Unbekanntes Werkzeug: {other}")),
        });
        match outcome {
            Ok(number) => ToolResult::Ok {
                text: format!("n{number} angehängt."),
                structured: None,
            },
            Err(message) => ToolResult::Err(message),
        }
    }

    fn offered(&self, app: &AppHandle) -> bool {
        let Some(database) = app.try_state::<Arc<Database>>() else {
            return false;
        };
        settings::load(&database).is_ok_and(|loaded: Settings| loaded.report_enabled)
    }

    fn unavailable_message(&self) -> &'static str {
        OFF_MESSAGE
    }
}

fn note_spec() -> ToolSpec {
    ToolSpec {
        name: NOTE,
        description: "Hängt eine Erklärung, ein Risiko oder einen Befund an den Review-Bericht \
                      dieser Phase; ohne at gilt der letzte Edit.",
        input_schema: json!({
            "type": "object",
            "properties": {
                "text": { "type": "string", "minLength": 1, "maxLength": MAX_TEXT_CHARS, "description": "Markdown" },
                "at": at_schema(),
                "kind": { "type": "string", "enum": ["why", "risk", "finding"], "description": "Vorgabe why" },
                "resolves": { "type": "string", "pattern": "^n[0-9]+$", "description": "Behobener Befund dieser Phase, z. B. \"n3\"" },
            },
            "required": ["text"],
            "additionalProperties": false,
        }),
    }
}

fn figure_spec() -> ToolSpec {
    ToolSpec {
        name: FIGURE,
        description: "Hängt ein Schaubild (Mermaid, Zeilen mit „+ “, „- “, „~ “ markieren neu, \
                      entfällt, geändert) oder ein Bild mit nummerierten Marken an den \
                      Review-Bericht dieser Phase.",
        input_schema: json!({
            "type": "object",
            "properties": {
                "caption": { "type": "string", "minLength": 1, "maxLength": MAX_CAPTION_CHARS },
                "mermaid": { "type": "string", "minLength": 1, "maxLength": MAX_MERMAID_CHARS, "description": "Genau eines von mermaid und image" },
                "image": image_schema(),
                "marks": marks_schema(),
                "text": { "type": "string", "maxLength": MAX_TEXT_CHARS, "description": "Kommentar unter dem Bild bzw. Schaubild" },
                "at": at_schema(),
            },
            "required": ["caption"],
            "additionalProperties": false,
        }),
    }
}

fn screen_spec() -> ToolSpec {
    ToolSpec {
        name: SCREEN,
        description: "Hängt je Bildschirm deine Fotos für die Sichtabnahme an den Review-Bericht: \
                      Ansichten je Breite und Thema, Entwurfsbild daneben, Abweichung in einer \
                      Zeile, Klickpfad mit Vorher/Nachher.",
        input_schema: json!({
            "type": "object",
            "properties": {
                "screen": { "type": "string", "minLength": 1, "maxLength": MAX_SCREEN_CHARS, "description": "Name des Bildschirms" },
                "shots": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": MAX_SHOTS,
                    "items": {
                        "type": "object",
                        "properties": {
                            "image": image_schema(),
                            "label": { "type": "string", "minLength": 1, "maxLength": MAX_LABEL_CHARS, "description": "z. B. \"1440 · hell\", \"PDF\"" },
                            "design": image_schema(),
                            "marks": marks_schema(),
                        },
                        "required": ["image", "label"],
                        "additionalProperties": false,
                    },
                },
                "deviation": { "type": "string", "maxLength": MAX_DEVIATION_CHARS, "description": "Abweichung vom Entwurf in einer Zeile" },
                "steps": {
                    "type": "array",
                    "maxItems": MAX_STEPS,
                    "items": {
                        "type": "object",
                        "properties": {
                            "open": step_text_schema(),
                            "act": step_text_schema(),
                            "expect": step_text_schema(),
                            "before": image_schema(),
                            "after": image_schema(),
                        },
                        "required": ["open", "act", "expect"],
                        "additionalProperties": false,
                    },
                },
                "text": { "type": "string", "maxLength": MAX_TEXT_CHARS, "description": "Kommentar zum Bildschirm" },
                "at": at_schema(),
            },
            "required": ["screen", "shots"],
            "additionalProperties": false,
        }),
    }
}

fn at_schema() -> Value {
    json!({
        "type": "string",
        "description": "\"<pfad>:<zeile>\" oder \"<pfad>:<von>-<bis>\", höchstens 80 Zeilen; Pfad relativ zur Wurzel eines Repositorys (mit /) oder absolut",
    })
}

fn image_schema() -> Value {
    json!({
        "type": "string",
        "description": "Absoluter Pfad zu .png, .jpg, .jpeg, .webp oder .gif, höchstens 5 MB; wird kopiert",
    })
}

fn marks_schema() -> Value {
    json!({
        "type": "array",
        "maxItems": MAX_MARKS,
        "description": "Nummerierte Rechtecke in Bildpixeln",
        "items": {
            "type": "object",
            "properties": {
                "n": { "type": "integer", "minimum": 1, "maximum": MAX_MARK_NUMBER },
                "x": { "type": "integer", "minimum": 0 },
                "y": { "type": "integer", "minimum": 0 },
                "w": { "type": "integer", "minimum": 1 },
                "h": { "type": "integer", "minimum": 1 },
                "text": { "type": "string", "maxLength": MAX_MARK_TEXT_CHARS },
            },
            "required": ["n", "x", "y", "w", "h"],
            "additionalProperties": false,
        },
    })
}

fn step_text_schema() -> Value {
    json!({ "type": "string", "minLength": 1, "maxLength": MAX_STEP_CHARS })
}

/// Die aufrufende Station; gefunden über die Session, nie über eine Angabe des Agenten.
struct Station<'a> {
    call: &'a ToolCall<'a>,
    registry: tauri::State<'a, SessionRegistry>,
    implementation_id: String,
    phase_id: String,
    station_id: String,
}

fn station_of<'a>(call: &'a ToolCall<'a>) -> Result<Station<'a>, String> {
    let registry = call
        .app
        .try_state::<SessionRegistry>()
        .ok_or_else(|| NO_REGISTRY.to_owned())?;
    let (implementation_id, station_id) = registry
        .station_of_session(call.session_id)
        .map_err(text_of)?
        .ok_or_else(|| NOT_A_STATION.to_owned())?;
    let view = registry
        .implementation_view(&implementation_id)
        .map_err(text_of)?;
    let phase_id = view
        .phases
        .iter()
        .find(|phase: &&PhaseView| {
            phase
                .stations
                .iter()
                .any(|station: &StationView| station.id == station_id)
        })
        .map(|phase: &PhaseView| phase.id.clone())
        .ok_or_else(|| NOT_A_STATION.to_owned())?;
    Ok(Station {
        call,
        registry,
        implementation_id,
        phase_id,
        station_id,
    })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NoteArguments {
    #[serde(default)]
    text: String,
    #[serde(default)]
    at: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    resolves: Option<String>,
}

fn note(station: &Station<'_>) -> Result<u32, String> {
    let arguments: NoteArguments = parse(station.call.arguments)?;
    let text = arguments.text.trim().to_owned();
    check_length("text", &text, 1, MAX_TEXT_CHARS)?;
    let kind = match arguments.kind.as_deref() {
        None | Some("why") => ReportNoteKind::Why,
        Some("risk") => ReportNoteKind::Risk,
        Some("finding") => ReportNoteKind::Finding,
        Some(other) => return Err(format!("kind: why, risk oder finding, nicht „{other}“")),
    };
    let resolves = arguments
        .resolves
        .as_deref()
        .map(|given: &str| resolved_finding(station, given))
        .transpose()?;
    let anchor = match arguments.at.as_deref() {
        Some(at) => anchor_at(station, at)?,
        None => anchor_of_last_edit(station)?,
    };
    let mut entry = new_entry(station, EntryTool::Note);
    entry.note_kind = Some(kind);
    entry.resolves = resolves;
    entry.text = text;
    anchor.apply(&mut entry);
    store(station, entry, |_, _| Ok(()))
}

/// `"n<k>"` eines Befunds derselben Phase.
fn resolved_finding(station: &Station<'_>, given: &str) -> Result<u32, String> {
    let number: u32 = given
        .trim()
        .strip_prefix('n')
        .and_then(|digits: &str| digits.parse().ok())
        .ok_or_else(|| format!("resolves: erwartet „n<k>“, nicht „{given}“"))?;
    let is_finding = station
        .registry
        .is_report_finding(&station.phase_id, number)
        .map_err(text_of)?;
    if !is_finding {
        return Err(format!("Befund n{number} gibt es in dieser Phase nicht."));
    }
    Ok(number)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FigureArguments {
    #[serde(default)]
    caption: String,
    #[serde(default)]
    mermaid: Option<String>,
    #[serde(default)]
    image: Option<String>,
    #[serde(default)]
    marks: Vec<MarkArguments>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    at: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MarkArguments {
    n: u32,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    #[serde(default)]
    text: Option<String>,
}

fn figure(station: &Station<'_>) -> Result<u32, String> {
    let arguments: FigureArguments = parse(station.call.arguments)?;
    let caption = one_line("caption", &arguments.caption, MAX_CAPTION_CHARS)?;
    if arguments.mermaid.is_some() == arguments.image.is_some() {
        return Err(ONE_PICTURE.to_owned());
    }
    if let Some(mermaid) = &arguments.mermaid {
        check_length("mermaid", mermaid.trim(), 1, MAX_MERMAID_CHARS)?;
    }
    if arguments.image.is_none() && !arguments.marks.is_empty() {
        return Err(MARKS_NEED_IMAGE.to_owned());
    }
    let marks = checked_marks("marks", arguments.marks)?;
    let text = free_text(arguments.text)?;
    let anchor = arguments
        .at
        .as_deref()
        .map(|at: &str| anchor_at(station, at))
        .transpose()?;
    let mut images = staged_images(station)?;
    let image: Option<StagedImage> = arguments
        .image
        .as_deref()
        .map(|path: &str| images.add(Path::new(path)))
        .transpose()?;
    let mut entry = new_entry(station, EntryTool::Figure);
    entry.caption = Some(caption);
    entry.mermaid = arguments.mermaid;
    entry.marks = marks;
    entry.text = text;
    if let Some(anchor) = anchor {
        anchor.apply(&mut entry);
    }
    let number = store(station, entry, |number: u32, entry: &mut NewEntry| {
        if let Some(image) = &image {
            entry.image_file = Some(images.rename(image, &number.to_string())?);
            entry.image_width = Some(image.width);
            entry.image_height = Some(image.height);
        }
        Ok(())
    })?;
    images.keep();
    Ok(number)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ScreenArguments {
    #[serde(default)]
    screen: String,
    #[serde(default)]
    shots: Vec<ShotArguments>,
    #[serde(default)]
    deviation: Option<String>,
    #[serde(default)]
    steps: Vec<StepArguments>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    at: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ShotArguments {
    image: String,
    label: String,
    #[serde(default)]
    design: Option<String>,
    #[serde(default)]
    marks: Vec<MarkArguments>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StepArguments {
    open: String,
    act: String,
    expect: String,
    #[serde(default)]
    before: Option<String>,
    #[serde(default)]
    after: Option<String>,
}

/// Die kopierten Bilder einer Ansicht bzw. eines Schritts neben seinen geprüften Texten.
struct StagedShot {
    label: String,
    marks: Vec<ReportMark>,
    image: StagedImage,
    design: Option<StagedImage>,
}

struct StagedStep {
    open: String,
    act: String,
    expect: String,
    before: Option<StagedImage>,
    after: Option<StagedImage>,
}

fn screen(station: &Station<'_>) -> Result<u32, String> {
    let arguments: ScreenArguments = parse(station.call.arguments)?;
    let name = one_line("screen", &arguments.screen, MAX_SCREEN_CHARS)?;
    if arguments.shots.is_empty() || arguments.shots.len() > MAX_SHOTS {
        return Err(format!("shots: 1 bis {MAX_SHOTS} Ansichten"));
    }
    if arguments.steps.len() > MAX_STEPS {
        return Err(format!("steps: höchstens {MAX_STEPS}"));
    }
    let deviation = arguments
        .deviation
        .filter(|deviation: &String| !deviation.trim().is_empty())
        .map(|deviation: String| one_line("deviation", &deviation, MAX_DEVIATION_CHARS))
        .transpose()?;
    let text = free_text(arguments.text)?;
    let anchor = arguments
        .at
        .as_deref()
        .map(|at: &str| anchor_at(station, at))
        .transpose()?;

    // Scheitert ein Bild, räumt `StagedImages` die schon kopierten weg.
    let mut images = staged_images(station)?;
    let mut shots: Vec<StagedShot> = Vec::with_capacity(arguments.shots.len());
    for (index, shot) in arguments.shots.into_iter().enumerate() {
        let field = format!("shots[{index}]");
        shots.push(StagedShot {
            label: one_line(&format!("{field}.label"), &shot.label, MAX_LABEL_CHARS)?,
            marks: checked_marks(&format!("{field}.marks"), shot.marks)?,
            image: images.add(Path::new(&shot.image))?,
            design: add_optional(&mut images, shot.design)?,
        });
    }
    let mut steps: Vec<StagedStep> = Vec::with_capacity(arguments.steps.len());
    for (index, step) in arguments.steps.into_iter().enumerate() {
        let field = format!("steps[{index}]");
        steps.push(StagedStep {
            open: one_line(&format!("{field}.open"), &step.open, MAX_STEP_CHARS)?,
            act: one_line(&format!("{field}.act"), &step.act, MAX_STEP_CHARS)?,
            expect: one_line(&format!("{field}.expect"), &step.expect, MAX_STEP_CHARS)?,
            before: add_optional(&mut images, step.before)?,
            after: add_optional(&mut images, step.after)?,
        });
    }

    let mut entry = new_entry(station, EntryTool::Screen);
    entry.text = text;
    if let Some(anchor) = anchor {
        anchor.apply(&mut entry);
    }
    let number = store(station, entry, |number: u32, entry: &mut NewEntry| {
        entry.screen = Some(named_screen(
            &mut images,
            number,
            name,
            deviation,
            shots,
            steps,
        )?);
        Ok(())
    })?;
    images.keep();
    Ok(number)
}

fn add_optional(
    images: &mut StagedImages,
    path: Option<String>,
) -> Result<Option<StagedImage>, String> {
    path.map(|path: String| images.add(Path::new(&path)))
        .transpose()
}

/// Gibt den Bildern eines Bildschirms ihre Namen mit der Nummer des Eintrags.
fn named_screen(
    images: &mut StagedImages,
    number: u32,
    name: String,
    deviation: Option<String>,
    shots: Vec<StagedShot>,
    steps: Vec<StagedStep>,
) -> Result<ScreenRow, String> {
    let mut shot_rows: Vec<ShotRow> = Vec::with_capacity(shots.len());
    for (index, shot) in shots.into_iter().enumerate() {
        let stem = format!("{number}-{}", index + 1);
        let design = shot
            .design
            .map(|design: StagedImage| image_row(images, &design, &format!("{stem}-entwurf")))
            .transpose()?;
        shot_rows.push(ShotRow {
            label: shot.label,
            image: image_row(images, &shot.image, &stem)?,
            design,
            marks: shot.marks,
        });
    }
    let mut step_rows: Vec<StepRow> = Vec::with_capacity(steps.len());
    for (index, step) in steps.into_iter().enumerate() {
        let stem = format!("{number}-s{}", index + 1);
        let before = step
            .before
            .map(|image: StagedImage| image_row(images, &image, &format!("{stem}-vorher")))
            .transpose()?;
        let after = step
            .after
            .map(|image: StagedImage| image_row(images, &image, &format!("{stem}-nachher")))
            .transpose()?;
        step_rows.push(StepRow {
            open: step.open,
            act: step.act,
            expect: step.expect,
            before,
            after,
        });
    }
    Ok(ScreenRow {
        name,
        deviation,
        shots: shot_rows,
        steps: step_rows,
    })
}

fn image_row(
    images: &mut StagedImages,
    image: &StagedImage,
    stem: &str,
) -> Result<ImageRow, String> {
    Ok(ImageRow {
        file: images.rename(image, stem)?,
        width: image.width,
        height: image.height,
    })
}

fn staged_images(station: &Station<'_>) -> Result<StagedImages, String> {
    let dir = phase_dir(
        station.call.app,
        &station.implementation_id,
        &station.phase_id,
    )
    .map_err(text_of)?;
    Ok(StagedImages::new(dir))
}

/// Der Ort eines Eintrags, wie er in der Zeile steht.
struct Anchor {
    repository_key: String,
    path: String,
    line_from: u32,
    line_to: u32,
    anchor_text: String,
}

impl Anchor {
    fn apply(self, entry: &mut NewEntry) {
        entry.repository_key = Some(self.repository_key);
        entry.path = Some(self.path);
        entry.line_from = Some(self.line_from);
        entry.line_to = Some(self.line_to);
        entry.anchor_text = Some(self.anchor_text);
    }
}

fn anchor_at(station: &Station<'_>, at: &str) -> Result<Anchor, String> {
    let (path, from, to) = anchor::parse_at(at)?;
    anchored(resolved(station, &path)?, from, to)
}

fn anchor_of_last_edit(station: &Station<'_>) -> Result<Anchor, String> {
    let (entries, details) = station
        .registry
        .last_write_of(station.call.session_id)
        .map_err(text_of)?;
    let (path, from, to) = anchor::last_edit_anchor(&entries, &details, anchor::read_text)?;
    anchored(resolved(station, &path.to_string_lossy())?, from, to)
}

/// Gegen alle Repository-Einträge des Vorhabens: eine Review-Station soll auch den Arbeitsbaum
/// treffen, in dem nur eine frühere Station geschrieben hat.
fn resolved(station: &Station<'_>, path: &str) -> Result<ResolvedPath, String> {
    let input = station
        .registry
        .changes_input(station.call.session_id, ChangesReach::Project)
        .map_err(text_of)?;
    anchor::resolve_path(&sources::sources(&input), path)
}

fn anchored(resolved: ResolvedPath, from: u32, to: u32) -> Result<Anchor, String> {
    let content = anchor::read_text(&resolved.absolute)
        .ok_or_else(|| format!("at: {} nicht lesbar", resolved.absolute.display()))?;
    let anchor_text = anchor::lines_text(&content, from, to).ok_or_else(|| {
        format!(
            "at: {} hat nur {} Zeilen",
            resolved.path,
            content.lines().count()
        )
    })?;
    Ok(Anchor {
        repository_key: resolved.repository_key,
        path: resolved.path,
        line_from: from,
        line_to: to,
        anchor_text,
    })
}

fn new_entry(station: &Station<'_>, tool: EntryTool) -> NewEntry {
    NewEntry {
        implementation_id: station.implementation_id.clone(),
        phase_id: station.phase_id.clone(),
        station_id: station.station_id.clone(),
        session_id: station.call.session_id.to_owned(),
        tool,
        note_kind: None,
        resolves: None,
        text: String::new(),
        caption: None,
        mermaid: None,
        image_file: None,
        image_width: None,
        image_height: None,
        marks: Vec::new(),
        screen: None,
        repository_key: None,
        path: None,
        line_from: None,
        line_to: None,
        anchor_text: None,
        created_at: now_ms(),
    }
}

/// Schreibt den Eintrag und meldet der Oberfläche den neuen Stand.
fn store(
    station: &Station<'_>,
    entry: NewEntry,
    name_files: impl FnOnce(u32, &mut NewEntry) -> Result<(), String>,
) -> Result<u32, String> {
    let number = station
        .registry
        .append_report_entry(entry, |number: u32, entry: &mut NewEntry| {
            name_files(number, entry).map_err(CommandError::Io)
        })
        .map_err(text_of)?;
    emit_changed(station.call.app, &station.implementation_id);
    Ok(number)
}

/// Ein Feld, das in der Rohfassung auf einer Zeile steht: Umbrüche werden zu Leerzeichen.
fn one_line(field: &str, text: &str, max: usize) -> Result<String, String> {
    let line = text.split_whitespace().collect::<Vec<&str>>().join(" ");
    check_length(field, &line, 1, max)?;
    Ok(line)
}

fn free_text(text: Option<String>) -> Result<String, String> {
    let text = text.unwrap_or_default().trim().to_owned();
    check_length("text", &text, 0, MAX_TEXT_CHARS)?;
    Ok(text)
}

fn checked_marks(field: &str, marks: Vec<MarkArguments>) -> Result<Vec<ReportMark>, String> {
    if marks.len() > MAX_MARKS {
        return Err(format!("{field}: höchstens {MAX_MARKS} Marken je Bild"));
    }
    marks
        .into_iter()
        .map(|mark: MarkArguments| {
            if !(1..=MAX_MARK_NUMBER).contains(&mark.n) {
                return Err(format!("{field}.n: 1 bis {MAX_MARK_NUMBER}"));
            }
            if mark.w == 0 || mark.h == 0 {
                return Err(format!("{field}: w und h mindestens 1"));
            }
            let text = mark
                .text
                .filter(|text: &String| !text.trim().is_empty())
                .map(|text: String| one_line(&format!("{field}.text"), &text, MAX_MARK_TEXT_CHARS))
                .transpose()?;
            Ok(ReportMark {
                n: mark.n,
                x: mark.x,
                y: mark.y,
                w: mark.w,
                h: mark.h,
                text,
            })
        })
        .collect()
}

fn parse<T: for<'de> Deserialize<'de>>(arguments: &Value) -> Result<T, String> {
    serde_json::from_value(arguments.clone())
        .map_err(|error| format!("Eingabe nicht lesbar: {error}"))
}

fn text_of(error: CommandError) -> String {
    error.to_string()
}
