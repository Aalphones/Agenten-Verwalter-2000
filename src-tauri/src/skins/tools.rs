//! Werkzeuge der Skins im MCP-Zugang (ADR 046, ADR 065): was die Seite „Skins“ kann, kann der
//! Agent auch — nur, solange „Agent darf Skins bearbeiten“ an ist, und Dateien nur im
//! Arbeitsordner seiner Session. Jede Aktion geht auf dieselben Funktionen wie die Commands
//! (`skins/mod.rs`, `archive.rs`), nie auf eigene Fachlogik.
use std::path::PathBuf;
use std::sync::Arc;

use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

use super::matching::slot_for;
use super::model::{
    BuiltinSlot, FiguresData, ImageSource, ImageTarget, Motion, SkinData, SkinKind, SkinPack,
    SkinPackSummary, ToolUsage,
};
use super::tool_args::{
    names_of, optional_bool, optional_count, optional_str, parse_name, required_str,
};
use super::tool_edit::{self, SlotChange, SlotEdit};
use super::tool_paths;
use crate::db::Database;
use crate::mcp_access::tools::{ToolCall, ToolResult, ToolSet, ToolSpec};
use crate::sessions::registry::SessionRegistry;
use crate::settings::{self, model::SettingsChange};
use crate::skins;

const LIST: &str = "skin_list";
const GET: &str = "skin_get";
const CREATE: &str = "skin_create";
const RENAME: &str = "skin_rename";
const SLOT_SET: &str = "skin_slot_set";
const SLOT_REMOVE: &str = "skin_slot_remove";
const STYLE_SET: &str = "skin_style_set";
const IMAGE_SET: &str = "skin_image_set";
const DELETE: &str = "skin_delete";
const EXPORT: &str = "skin_export";
const IMPORT: &str = "skin_import";
const ACTIVATE: &str = "skin_activate";
const TOOL_USAGE: &str = "skin_tool_usage";

const OFF_MESSAGE: &str = "Skin-Werkzeuge sind ausgeschaltet (Einstellungen → Skins → Agent).";
const NOT_READY: &str = "Der Verwalter startet noch";
const ZIP_EXTENSION: &str = "zip";
const DEFAULT_USAGE_DAYS: u64 = 30;
const MAX_USAGE_DAYS: u64 = 90;

pub struct SkinTools;

impl ToolSet for SkinTools {
    fn prefix(&self) -> &'static str {
        "skin_"
    }

    fn tools(&self) -> Vec<ToolSpec> {
        specs()
    }

    fn call(&self, call: &ToolCall) -> ToolResult {
        match run(call) {
            Ok(result) => result,
            Err(sentence) => ToolResult::Err(sentence),
        }
    }

    fn offered(&self, app: &AppHandle) -> bool {
        let Some(database) = app.try_state::<Arc<Database>>() else {
            return false;
        };
        settings::load(&database).is_ok_and(|loaded| loaded.skin_agent_tools)
    }

    fn unavailable_message(&self) -> &'static str {
        OFF_MESSAGE
    }
}

/// Alles, was ein Aufruf braucht: die Datenbank, der Arbeitsordner der Session und die
/// Beschriftung, mit der Änderungen am Paket stehen.
struct Env<'a> {
    app: &'a AppHandle,
    database: Arc<Database>,
    workspace: PathBuf,
    label: String,
    arguments: &'a Value,
}

fn run(call: &ToolCall) -> Result<ToolResult, String> {
    let Some(registry) = call.app.try_state::<SessionRegistry>() else {
        return Err(NOT_READY.to_owned());
    };
    let Some(database) = call.app.try_state::<Arc<Database>>() else {
        return Err(NOT_READY.to_owned());
    };
    let (workspace, label) = registry
        .skin_context(call.session_id)
        .map_err(|error| error.to_string())?;
    let env = Env {
        app: call.app,
        database: Arc::clone(&database),
        workspace,
        label,
        arguments: call.arguments,
    };
    match call.name {
        LIST => list(&env),
        GET => get(&env),
        CREATE => create(&env),
        RENAME => rename(&env),
        SLOT_SET => slot_set(&env),
        SLOT_REMOVE => slot_remove(&env),
        STYLE_SET => style_set(&env),
        IMAGE_SET => image_set(&env),
        DELETE => delete(&env),
        EXPORT => export(&env),
        IMPORT => import(&env),
        ACTIVATE => activate(&env),
        TOOL_USAGE => tool_usage(&env),
        other => Err(format!("Unbekanntes Werkzeug: {other}")),
    }
}

fn text_result(text: String) -> Result<ToolResult, String> {
    Ok(ToolResult::Ok {
        text,
        structured: None,
    })
}

fn fail(error: impl ToString) -> String {
    error.to_string()
}

// ---------------------------------------------------------------- Lesen

fn list(env: &Env) -> Result<ToolResult, String> {
    let packs: Vec<SkinPackSummary> = skins::list(env.app, &env.database).map_err(fail)?;
    let active = settings::load(&env.database).map_err(fail)?;
    let lines: Vec<String> = packs
        .iter()
        .map(|pack: &SkinPackSummary| {
            let by = match &pack.changed_by {
                Some(label) => format!(", zuletzt geändert von {label}"),
                None => String::new(),
            };
            format!(
                "{} · {} „{}“{by}",
                pack.id,
                kind_label(pack.kind),
                pack.name
            )
        })
        .collect();
    let mut text: String = if lines.is_empty() {
        "Keine Pakete.".to_owned()
    } else {
        lines.join("\n")
    };
    text.push_str(&format!(
        "\nAktiv: Figuren {}, Stil {}.",
        active.skin_figures.as_deref().unwrap_or("keins"),
        active.skin_style.as_deref().unwrap_or("keins")
    ));
    let items: Vec<Value> = packs
        .iter()
        .map(|pack: &SkinPackSummary| {
            json!({
                "id": pack.id,
                "kind": pack.kind,
                "name": pack.name,
                "changedBy": pack.changed_by,
            })
        })
        .collect();
    Ok(ToolResult::Ok {
        text,
        structured: Some(json!({
            "packs": items,
            "activeFigures": active.skin_figures,
            "activeStyle": active.skin_style,
        })),
    })
}

fn kind_label(kind: SkinKind) -> &'static str {
    match kind {
        SkinKind::Figures => "Figurenpaket",
        SkinKind::Style => "Stilpaket",
    }
}

/// Das Paket als JSON ohne `dir`: der absolute Bildordner geht den Agenten nichts an.
fn pack_json(pack: &SkinPack) -> Result<Value, String> {
    let mut value: Value = serde_json::to_value(pack).map_err(fail)?;
    if let Some(object) = value.as_object_mut() {
        object.remove("dir");
    }
    Ok(value)
}

fn get(env: &Env) -> Result<ToolResult, String> {
    let pack: SkinPack =
        skins::get(env.app, &env.database, required_str(env.arguments, "pack")?).map_err(fail)?;
    let text: String = serde_json::to_string_pretty(&pack_json(&pack)?).map_err(fail)?;
    text_result(text)
}

// ---------------------------------------------------------------- Pakete anlegen und löschen

fn create(env: &Env) -> Result<ToolResult, String> {
    let names: Vec<String> = names_of(&[SkinKind::Figures, SkinKind::Style]);
    let kind: SkinKind = parse_name(required_str(env.arguments, "kind")?, "Die Art", &names)?;
    let pack: SkinPack = skins::create(
        env.app,
        &env.database,
        kind,
        required_str(env.arguments, "name")?,
        optional_str(env.arguments, "copyOf")?,
        Some(&env.label),
    )
    .map_err(fail)?;
    text_result(format!(
        "{} „{}“ angelegt, ID {}.",
        kind_label(kind),
        pack.name,
        pack.id
    ))
}

fn rename(env: &Env) -> Result<ToolResult, String> {
    let pack: SkinPack = skins::rename(
        env.app,
        &env.database,
        required_str(env.arguments, "pack")?,
        required_str(env.arguments, "name")?,
        Some(&env.label),
    )
    .map_err(fail)?;
    text_result(format!("Das Paket heißt jetzt „{}“.", pack.name))
}

fn delete(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let name: String = skins::get(env.app, &env.database, id).map_err(fail)?.name;
    skins::delete(env.app, &env.database, id).map_err(fail)?;
    text_result(format!(
        "Das Paket „{name}“ ist gelöscht. Über diese Werkzeuge lässt es sich nicht zurückholen."
    ))
}

// ---------------------------------------------------------------- Figurenpaket

/// Das Figurenpaket mit seinen Daten; ein Stilpaket ist hier ein Fehler.
fn figures_of(env: &Env, id: &str) -> Result<(SkinPack, FiguresData), String> {
    let pack: SkinPack = skins::get(env.app, &env.database, id).map_err(fail)?;
    match &pack.data {
        SkinData::Figures(figures) => {
            let data: FiguresData = figures.clone();
            Ok((pack, data))
        }
        SkinData::Style(_) => Err(format!(
            "Das Paket „{}“ ist ein Stilpaket; Fächer gibt es nur in Figurenpaketen.",
            pack.name
        )),
    }
}

fn slot_set(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let slot: &str = required_str(env.arguments, "slot")?;
    let edit: SlotEdit = SlotEdit::from_arguments(env.arguments)?;
    let (_, mut figures) = figures_of(env, id)?;
    let change: SlotChange = tool_edit::apply_slot(&mut figures, slot, edit)?;
    let saved: SkinPack = skins::save(
        env.app,
        &env.database,
        id,
        SkinData::Figures(figures),
        Some(&env.label),
    )
    .map_err(fail)?;
    let verb: &str = match change {
        SlotChange::Created => "angelegt",
        SlotChange::Changed => "gespeichert",
    };
    text_result(format!("Fach „{slot}“ {verb} im Paket „{}“.", saved.name))
}

fn slot_remove(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let slot: &str = required_str(env.arguments, "slot")?;
    let (_, mut figures) = figures_of(env, id)?;
    tool_edit::remove_custom(&mut figures, slot)?;
    let saved: SkinPack = skins::save(
        env.app,
        &env.database,
        id,
        SkinData::Figures(figures),
        Some(&env.label),
    )
    .map_err(fail)?;
    text_result(format!("Fach „{slot}“ aus „{}“ entfernt.", saved.name))
}

// ---------------------------------------------------------------- Stilpaket

fn style_set(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let pack: SkinPack = skins::get(env.app, &env.database, id).map_err(fail)?;
    let SkinData::Style(style) = pack.data else {
        return Err(format!(
            "Das Paket „{}“ ist ein Figurenpaket; Farben gibt es nur in Stilpaketen.",
            pack.name
        ));
    };
    let mut style = *style;
    tool_edit::apply_style(&mut style, env.arguments)?;
    let saved: SkinPack = skins::save(
        env.app,
        &env.database,
        id,
        SkinData::Style(Box::new(style)),
        Some(&env.label),
    )
    .map_err(fail)?;
    text_result(format!("Stil von „{}“ gespeichert.", saved.name))
}

// ---------------------------------------------------------------- Bilder

/// `slot:<id>`, `slot:<id>:2`, `sidebar`, `content`, `icon`.
fn parse_target(text: &str) -> Result<ImageTarget, String> {
    match text {
        "sidebar" => return Ok(ImageTarget::SidebarImage),
        "content" => return Ok(ImageTarget::ContentImage),
        "icon" => return Ok(ImageTarget::Icon),
        _ => {}
    }
    let wrong = || {
        format!(
            "Das Bildziel „{text}“ gibt es nicht. Erlaubt: slot:<Fach>, slot:<Fach>:2, sidebar, content, icon."
        )
    };
    let Some(rest) = text.strip_prefix("slot:") else {
        return Err(wrong());
    };
    let (slot, second): (&str, bool) = match rest.strip_suffix(":2") {
        Some(without) => (without, true),
        None => (rest, false),
    };
    if slot.is_empty() || slot.contains(':') {
        return Err(wrong());
    }
    Ok(ImageTarget::Slot {
        slot: slot.to_owned(),
        second,
    })
}

fn image_set(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let target: ImageTarget = parse_target(required_str(env.arguments, "target")?)?;
    let source: &str = required_str(env.arguments, "source")?.trim();
    if source.is_empty() {
        let pack: SkinPack =
            skins::remove_image(env.app, &env.database, id, &target, Some(&env.label))
                .map_err(fail)?;
        return text_result(format!("Bild aus „{}“ entfernt.", pack.name));
    }
    let image_source: ImageSource = if source.contains("://") {
        // Auch „http://“ geht hierher: der Kern weist alles außer https mit einem Satz ab.
        ImageSource::Url {
            url: source.to_owned(),
        }
    } else {
        let file: PathBuf = tool_paths::existing_file(&env.workspace, source)?;
        ImageSource::Path {
            path: file.to_string_lossy().into_owned(),
        }
    };
    let pack: SkinPack = skins::set_image(
        env.app,
        &env.database,
        id,
        &target,
        &image_source,
        Some(&env.label),
    )
    .map_err(fail)?;
    text_result(format!("Bild in „{}“ gesetzt.", pack.name))
}

// ---------------------------------------------------------------- ZIP

fn export(env: &Env) -> Result<ToolResult, String> {
    let id: &str = required_str(env.arguments, "pack")?;
    let file: PathBuf = tool_paths::new_file(
        &env.workspace,
        required_str(env.arguments, "file")?,
        ZIP_EXTENSION,
    )?;
    let written: PathBuf = skins::export(env.app, &env.database, id, &file).map_err(fail)?;
    text_result(format!("Exportiert nach {}.", written.display()))
}

fn import(env: &Env) -> Result<ToolResult, String> {
    let file: PathBuf =
        tool_paths::existing_file(&env.workspace, required_str(env.arguments, "file")?)?;
    let pack: SkinPack =
        skins::import(env.app, &env.database, &file, Some(&env.label)).map_err(fail)?;
    text_result(format!(
        "{} „{}“ importiert, ID {}.",
        kind_label(pack.data.kind()),
        pack.name,
        pack.id
    ))
}

// ---------------------------------------------------------------- Einstellungen

/// `Some(None)` = ausschalten (`null` oder leer), `Some(Some(id))` = wählen, `None` = lassen.
fn choice_arg(arguments: &Value, key: &str) -> Result<Option<Option<String>>, String> {
    match arguments.get(key) {
        None => Ok(None),
        Some(Value::Null) => Ok(Some(None)),
        Some(Value::String(text)) if text.trim().is_empty() => Ok(Some(None)),
        Some(Value::String(text)) => Ok(Some(Some(text.trim().to_owned()))),
        Some(_) => Err(format!("{key} muss eine Paket-ID oder null sein.")),
    }
}

/// Ein gewähltes Paket muss es geben und von der richtigen Art sein; geprüft wird alles vor
/// der ersten Änderung, damit ein Aufruf nicht halb gilt.
fn check_choice(env: &Env, id: &str, kind: SkinKind) -> Result<(), String> {
    let pack: SkinPack = skins::get(env.app, &env.database, id).map_err(fail)?;
    if pack.data.kind() == kind {
        return Ok(());
    }
    Err(format!(
        "Das Paket „{}“ ist kein {}.",
        pack.name,
        kind_label(kind)
    ))
}

fn activate(env: &Env) -> Result<ToolResult, String> {
    let figures: Option<Option<String>> = choice_arg(env.arguments, "figures")?;
    let style: Option<Option<String>> = choice_arg(env.arguments, "style")?;
    let animations: Option<bool> = optional_bool(env.arguments, "animations")?;
    let celebrations: Option<bool> = optional_bool(env.arguments, "celebrations")?;
    let easter_eggs: Option<bool> = optional_bool(env.arguments, "easterEggs")?;
    let mut changes: Vec<SettingsChange> = Vec::new();
    if let Some(value) = figures {
        if let Some(id) = &value {
            check_choice(env, id, SkinKind::Figures)?;
        }
        changes.push(SettingsChange::SkinFigures { value });
    }
    if let Some(value) = style.clone() {
        if let Some(id) = &value {
            check_choice(env, id, SkinKind::Style)?;
        }
        changes.push(SettingsChange::SkinStyle { value });
    }
    if let Some(value) = animations {
        changes.push(SettingsChange::SkinAnimations { value });
    }
    if let Some(value) = celebrations {
        changes.push(SettingsChange::SkinCelebrations { value });
    }
    if let Some(value) = easter_eggs {
        changes.push(SettingsChange::SkinEasterEggs { value });
    }
    if changes.is_empty() {
        return Err(
            "Nichts zu ändern: gib figures, style, animations, celebrations oder easterEggs an."
                .to_owned(),
        );
    }
    for change in changes {
        settings::update(&env.database, change).map_err(fail)?;
    }
    if style.is_some() {
        skins::icon::apply_with(env.app, &env.database);
    }
    skins::notify(env.app);
    let now = settings::load(&env.database).map_err(fail)?;
    text_result(format!(
        "Aktiv: Figuren {}, Stil {}; Animationen {}, Feier-Momente {}, Easter Eggs {}.",
        now.skin_figures.as_deref().unwrap_or("keins"),
        now.skin_style.as_deref().unwrap_or("keins"),
        match now.skin_animations {
            Some(true) => "an",
            Some(false) => "aus",
            None => "wie das System",
        },
        on_off(now.skin_celebrations),
        on_off(now.skin_easter_eggs)
    ))
}

fn on_off(flag: bool) -> &'static str {
    if flag { "an" } else { "aus" }
}

// ---------------------------------------------------------------- Nutzung

fn tool_usage(env: &Env) -> Result<ToolResult, String> {
    let days: u64 = optional_count(env.arguments, "days")?.unwrap_or(DEFAULT_USAGE_DAYS);
    if !(1..=MAX_USAGE_DAYS).contains(&days) {
        return Err(format!("days muss zwischen 1 und {MAX_USAGE_DAYS} liegen."));
    }
    let days: u32 = u32::try_from(days).map_err(fail)?;
    let active_figures: Option<FiguresData> = active_figures(env)?;
    let mut usage: Vec<ToolUsage> = skins::tool_usage(&env.database, days).map_err(fail)?;
    for entry in &mut usage {
        entry.slot = Some(slot_for(
            &entry.tool,
            &entry.input_prefix,
            active_figures.as_ref(),
        ));
    }
    let lines: Vec<String> = usage
        .iter()
        .map(|entry: &ToolUsage| {
            let target = if entry.input_prefix.is_empty() {
                String::new()
            } else {
                format!(" {}", entry.input_prefix)
            };
            format!(
                "{}× {}{target} → {}",
                entry.count,
                entry.tool,
                entry.slot.as_deref().unwrap_or("other")
            )
        })
        .collect();
    let scope: &str = if active_figures.is_some() {
        "mit dem aktiven Figurenpaket"
    } else {
        "ohne Figurenpaket (nur vorgegebene Fächer)"
    };
    let text: String = if lines.is_empty() {
        format!("Keine Werkzeug-Aufrufe in den letzten {days} Tagen.")
    } else {
        format!(
            "Werkzeug-Aufrufe der letzten {days} Tage, Fach {scope}:\n{}",
            lines.join("\n")
        )
    };
    Ok(ToolResult::Ok {
        text,
        structured: Some(json!({ "days": days, "calls": usage })),
    })
}

/// Die Daten des aktiven Figurenpakets; `None` ohne Auswahl oder wenn es nicht mehr lesbar ist.
fn active_figures(env: &Env) -> Result<Option<FiguresData>, String> {
    let loaded = settings::load(&env.database).map_err(fail)?;
    let Some(id) = loaded.skin_figures else {
        return Ok(None);
    };
    match skins::get(env.app, &env.database, &id) {
        Ok(SkinPack {
            data: SkinData::Figures(figures),
            ..
        }) => Ok(Some(figures)),
        _ => Ok(None),
    }
}

// ---------------------------------------------------------------- Beschreibungen

fn object(properties: Value, required: &[&str]) -> Value {
    json!({
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false,
    })
}

fn pack_property() -> Value {
    json!({ "type": "string", "description": "ID des Pakets (aus skin_list)" })
}

fn specs() -> Vec<ToolSpec> {
    let slot_names: Vec<String> = names_of(&BuiltinSlot::ALL);
    let motions: Vec<String> = names_of(&Motion::ALL);
    vec![
        ToolSpec {
            name: LIST,
            description: "Listet alle Skin-Pakete (Figurenpakete und Stilpakete) mit ID, Art, Name \
                          und der Session, die zuletzt geändert hat, dazu die aktiven Pakete.",
            input_schema: object(json!({}), &[]),
        },
        ToolSpec {
            name: GET,
            description: "Gibt ein Paket vollständig als JSON zurück: Fächer, Muster, Texte, \
                          Bewegungen, Bildnamen bzw. Farben und Deckkraft. Ohne Bildordner.",
            input_schema: object(json!({ "pack": pack_property() }), &["pack"]),
        },
        ToolSpec {
            name: CREATE,
            description: "Legt ein leeres Paket an, oder mit copyOf eine Kopie samt Bildern. Name \
                          höchstens 40 Zeichen.",
            input_schema: object(
                json!({
                    "kind": { "type": "string", "enum": ["figures", "style"] },
                    "name": { "type": "string", "maxLength": 40 },
                    "copyOf": {
                        "type": "string",
                        "description": "ID eines Pakets derselben Art, das kopiert wird",
                    },
                }),
                &["kind", "name"],
            ),
        },
        ToolSpec {
            name: RENAME,
            description: "Benennt ein Paket um (höchstens 40 Zeichen).",
            input_schema: object(
                json!({
                    "pack": pack_property(),
                    "name": { "type": "string", "maxLength": 40 },
                }),
                &["pack", "name"],
            ),
        },
        ToolSpec {
            name: SLOT_SET,
            description: "Legt in einem Figurenpaket ein Fach an oder ändert es. Ein Fach bestimmt, \
                welche Figur, Bewegung und welche Texte die Statuszeile bei einem Werkzeug zeigt. \
                Vorgegebene Fächer (search, read, write, shell, web, agent, other, wait, think, \
                commit, station) haben feste Werkzeuge; dort sind nur motion und texts änderbar. \
                Eigene Fächer heißen „c-“ plus Kleinbuchstaben, Ziffern oder Bindestriche (nicht auf \
                „-2“ endend), höchstens 24 je Paket; ein unbekanntes „c-…“ legt ein neues an, dann \
                sind name (höchstens 40 Zeichen) und tools Pflicht. tools ist ein Muster für den \
                Werkzeugnamen, z. B. „mcp__github__*“: „*“ steht für beliebig viele Zeichen, „?“ \
                für eines, mehrere Muster stehen durch Komma getrennt, Groß-/Kleinschreibung \
                zählt nicht; Muster höchstens 200 Zeichen. input ist ein optionales Muster für \
                den Anfang des Ziels (Datei, Suchbegriff, Befehl), leer entfernt es. Es gewinnt das \
                erste passende eigene Fach in der Reihenfolge des Pakets, erst danach gelten die \
                vorgegebenen; position (ab 0) setzt die Stelle und gilt nur für eigene Fächer. \
                texts ersetzt die Liste (höchstens 10, je höchstens 160 Zeichen; die Statuszeile \
                wählt reihum); Platzhalter: {ziel} = Datei, Suchbegriff oder Befehl des Aufrufs, \
                {zeit} = laufende Dauer m:ss (Fach wait), {commit} = Kennung des Commits (Fach \
                commit). Bilder setzt skin_image_set.",
            input_schema: object(
                json!({
                    "pack": pack_property(),
                    "slot": {
                        "type": "string",
                        "description": format!(
                            "Vorgegeben: {}; eigen: c-…",
                            slot_names.join(", ")
                        ),
                    },
                    "name": { "type": "string", "maxLength": 40 },
                    "tools": { "type": "string", "maxLength": 200 },
                    "input": { "type": "string", "maxLength": 200 },
                    "position": { "type": "integer", "minimum": 0 },
                    "motion": { "type": "string", "enum": motions },
                    "texts": {
                        "type": "array",
                        "items": { "type": "string", "maxLength": 160 },
                        "maxItems": 10,
                    },
                }),
                &["pack", "slot"],
            ),
        },
        ToolSpec {
            name: SLOT_REMOVE,
            description: "Entfernt ein eigenes Fach („c-…“) samt seinen Texten. Vorgegebene Fächer \
                          lassen sich nicht entfernen.",
            input_schema: object(
                json!({ "pack": pack_property(), "slot": { "type": "string" } }),
                &["pack", "slot"],
            ),
        },
        ToolSpec {
            name: STYLE_SET,
            description: "Setzt in einem Stilpaket Farben für hell oder dunkel und die Deckkraft \
                          der Hintergrundbilder. Farben als #rrggbb: base (Grund), sidebar \
                          (Seitenleiste), surface (Flächen), fg (Schrift), muted (gedämpfte \
                          Schrift), accent (Akzent), border (Linien); nur die genannten ändern \
                          sich. Deckkraft in Prozent, höchstens 60.",
            input_schema: object(
                json!({
                    "pack": pack_property(),
                    "scheme": { "type": "string", "enum": ["dark", "light"] },
                    "colors": {
                        "type": "object",
                        "properties": {
                            "base": { "type": "string" },
                            "sidebar": { "type": "string" },
                            "surface": { "type": "string" },
                            "fg": { "type": "string" },
                            "muted": { "type": "string" },
                            "accent": { "type": "string" },
                            "border": { "type": "string" },
                        },
                        "additionalProperties": false,
                    },
                    "sidebarOpacity": { "type": "integer", "minimum": 0, "maximum": 60 },
                    "contentOpacity": { "type": "integer", "minimum": 0, "maximum": 60 },
                }),
                &["pack", "scheme"],
            ),
        },
        ToolSpec {
            name: IMAGE_SET,
            description: "Setzt ein Bild im Paket oder entfernt es (source leer). target: \
                          „slot:<Fach>“ (Figur), „slot:<Fach>:2“ (zweite Pose), „sidebar“ und \
                          „content“ (Hintergründe eines Stilpakets), „icon“ (App-Symbol, nur \
                          PNG/ICO). source ist eine https-Adresse oder ein Pfad im Arbeitsordner \
                          der Session (relativ oder absolut, außerhalb abgewiesen). GIF, PNG oder \
                          WebP, höchstens 2 MiB; die Art bestimmt der Dateikopf, nicht der Name.",
            input_schema: object(
                json!({
                    "pack": pack_property(),
                    "target": { "type": "string" },
                    "source": { "type": "string" },
                }),
                &["pack", "target", "source"],
            ),
        },
        ToolSpec {
            name: DELETE,
            description: "Löscht ein Paket. Über diese Werkzeuge lässt es sich nicht zurückholen; \
                          ein aktives Paket gilt danach als nicht aktiv.",
            input_schema: object(json!({ "pack": pack_property() }), &["pack"]),
        },
        ToolSpec {
            name: EXPORT,
            description: "Schreibt ein Paket als ZIP. file ist ein Pfad relativ zum Arbeitsordner \
                          der Session, endet auf .zip und darf noch nicht existieren; der Ordner \
                          davon muss es.",
            input_schema: object(
                json!({ "pack": pack_property(), "file": { "type": "string" } }),
                &["pack", "file"],
            ),
        },
        ToolSpec {
            name: IMPORT,
            description: "Legt aus einer ZIP-Datei im Arbeitsordner der Session ein neues Paket \
                          an. Das Archiv wird streng geprüft; bei einem Fehler entsteht nichts.",
            input_schema: object(
                json!({ "file": { "type": "string", "description": "Pfad relativ zum Arbeitsordner" } }),
                &["file"],
            ),
        },
        ToolSpec {
            name: ACTIVATE,
            description: "Wählt aktive Pakete und schaltet Animationen, Feier-Momente und Easter \
                          Eggs. Nur genannte Felder ändern sich; figures und style: Paket-ID \
                          wählt, null schaltet aus. Den Schalter für diese Werkzeuge erreicht \
                          dieses Werkzeug nicht.",
            input_schema: object(
                json!({
                    "figures": { "type": ["string", "null"] },
                    "style": { "type": ["string", "null"] },
                    "animations": { "type": "boolean" },
                    "celebrations": { "type": "boolean" },
                    "easterEggs": { "type": "boolean" },
                }),
                &[],
            ),
        },
        ToolSpec {
            name: TOOL_USAGE,
            description: "Zeigt, welche Werkzeuge und Ziele die Sessions zuletzt am häufigsten \
                          aufriefen (die 30 häufigsten Paare aus Werkzeug und Anfang des Ziels, \
                          höchstens 40 Zeichen), je mit dem Fach, das den Aufruf im aktiven \
                          Figurenpaket fängt. Grundlage, um nach einem Session-Review sinnvolle \
                          eigene Fächer mit skin_slot_set anzulegen.",
            input_schema: object(
                json!({
                    "days": { "type": "integer", "minimum": 1, "maximum": 90, "default": 30 },
                }),
                &[],
            ),
        },
    ]
}
