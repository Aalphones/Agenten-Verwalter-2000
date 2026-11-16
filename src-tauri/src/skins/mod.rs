//! Skins (ADR 065): Figurenpakete und Stilpakete des Benutzers. Die Pakete liegen als Zeilen in
//! `skin_packs`, ihre Bilder unter `<Datenordner>\skins\<Paket-ID>\`. Jede Änderung sendet
//! `skins://changed`; die Oberfläche liest dann neu.
pub mod images;
pub mod model;
pub mod validate;

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, TimeDelta, Utc};
use tauri::{AppHandle, Emitter};

use crate::db::skins::{self as skin_rows, SkinRow};
use crate::db::{Database, enum_from_text, enum_to_text};
use crate::error::CommandError;
use crate::filesystem::workspace::data_dir;
use crate::implementation::now_ms;
use model::{
    BuiltinSlot, BuiltinSlotLook, FiguresData, ImageSource, ImageTarget, SkinData, SkinKind,
    SkinPack, SkinPackSummary, SlotLook, StyleData, ToolUsage,
};

pub const CHANGED_EVENT: &str = "skins://changed";
const SKINS_DIR: &str = "skins";
/// So lange liegt ein gelöschtes Paket noch da, damit „Rückgängig“ es wiederfindet.
const PURGE_AFTER_HOURS: i64 = 24;
const MILLIS_PER_DAY: f64 = 86_400_000.0;
const MAX_USAGE_DAYS: u32 = 3650;

fn skin_error(message: impl Into<String>) -> CommandError {
    CommandError::Skin(message.into())
}

/// RFC 3339 in UTC mit Sekunden: gleich lang, deshalb als Text vergleichbar.
fn now_text() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn notify(app: &AppHandle) {
    if let Err(error) = app.emit(CHANGED_EVENT, ()) {
        eprintln!("Ereignis {CHANGED_EVENT} nicht gesendet: {error}");
    }
}

fn skins_root(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(data_dir(app)?.join(SKINS_DIR))
}

/// Der Bildordner eines Pakets. `id` muss aus der Datenbank stammen, nie vom Aufrufer ungeprüft.
fn pack_dir(app: &AppHandle, id: &str) -> Result<PathBuf, CommandError> {
    Ok(skins_root(app)?.join(id))
}

fn kind_of_row(row: &SkinRow) -> Result<SkinKind, CommandError> {
    enum_from_text(&row.kind)
}

fn parse_data(row: &SkinRow) -> Result<SkinData, CommandError> {
    let broken = |error: serde_json::Error| {
        skin_error(format!("Das Paket „{}“ ist beschädigt: {error}", row.name))
    };
    match kind_of_row(row)? {
        SkinKind::Figures => serde_json::from_str::<FiguresData>(&row.data)
            .map(SkinData::Figures)
            .map_err(broken),
        SkinKind::Style => serde_json::from_str::<StyleData>(&row.data)
            .map(|style: StyleData| SkinData::Style(Box::new(style)))
            .map_err(broken),
    }
}

fn data_json(data: &SkinData) -> Result<String, CommandError> {
    let json = match data {
        SkinData::Figures(figures) => serde_json::to_string(figures),
        SkinData::Style(style) => serde_json::to_string(style),
    };
    json.map_err(|error| skin_error(format!("Das Paket ist nicht speicherbar: {error}")))
}

fn empty_data(kind: SkinKind) -> SkinData {
    match kind {
        SkinKind::Figures => SkinData::Figures(FiguresData {
            custom: Vec::new(),
            builtin: Vec::new(),
        }),
        SkinKind::Style => SkinData::Style(Box::new(StyleData::standard())),
    }
}

fn kind_name(kind: SkinKind) -> &'static str {
    match kind {
        SkinKind::Figures => "Figurenpaket",
        SkinKind::Style => "Stilpaket",
    }
}

/// Ein Paket, das es gibt und das nicht gelöscht ist.
fn find_active(database: &Database, id: &str) -> Result<SkinRow, CommandError> {
    let row: Option<SkinRow> = database.with(|connection| skin_rows::get(connection, id))?;
    match row {
        Some(found) if found.deleted_at.is_none() => Ok(found),
        _ => Err(skin_error("Dieses Paket gibt es nicht (mehr).")),
    }
}

fn to_pack(app: &AppHandle, row: &SkinRow) -> Result<SkinPack, CommandError> {
    Ok(SkinPack {
        id: row.id.clone(),
        name: row.name.clone(),
        data: parse_data(row)?,
        changed_at: row.changed_at.clone(),
        changed_by: row.changed_by.clone(),
        dir: pack_dir(app, &row.id)?.to_string_lossy().into_owned(),
    })
}

fn reload_pack(app: &AppHandle, database: &Database, id: &str) -> Result<SkinPack, CommandError> {
    to_pack(app, &find_active(database, id)?)
}

fn validate_data(data: &mut SkinData, dir: &Path) -> Result<(), CommandError> {
    let result = match data {
        SkinData::Figures(figures) => validate::validate_figures(figures, dir),
        SkinData::Style(style) => validate::validate_style(style, dir),
    };
    result.map_err(skin_error)
}

/// Schreibt die (schon geprüften) Daten, meldet die Änderung und liefert das Paket neu.
fn store(
    app: &AppHandle,
    database: &Database,
    id: &str,
    data: &SkinData,
) -> Result<SkinPack, CommandError> {
    let json = data_json(data)?;
    database.with(|connection| skin_rows::update_data(connection, id, &json, &now_text(), None))?;
    notify(app);
    reload_pack(app, database, id)
}

pub fn list(app: &AppHandle, database: &Database) -> Result<Vec<SkinPackSummary>, CommandError> {
    let rows: Vec<SkinRow> = database.with(|connection| skin_rows::list(connection))?;
    let mut summaries: Vec<SkinPackSummary> = Vec::new();
    for row in rows {
        let dir = pack_dir(app, &row.id)?;
        // Ein beschädigtes Paket fehlt in der Liste, statt sie ganz zu verhindern.
        let (kind, data) = match (kind_of_row(&row), parse_data(&row)) {
            (Ok(kind), Ok(data)) => (kind, data),
            (_, Err(error)) | (Err(error), _) => {
                eprintln!("Skin-Paket {} übersprungen: {error}", row.id);
                continue;
            }
        };
        summaries.push(SkinPackSummary {
            id: row.id,
            kind,
            name: row.name,
            changed_at: row.changed_at,
            changed_by: row.changed_by,
            thumb: thumb_of(&data, &dir),
            swatches: swatches_of(&data),
        });
    }
    Ok(summaries)
}

/// Figuren: das Bild des Fachs „Suchen“, sonst das erste Bild; Stil: das App-Symbol.
fn thumb_of(data: &SkinData, dir: &Path) -> Option<String> {
    let name: Option<&String> = match data {
        SkinData::Figures(figures) => {
            let search_image: Option<&String> = figures
                .builtin
                .iter()
                .find(|entry: &&BuiltinSlotLook| entry.slot == BuiltinSlot::Search)
                .and_then(|entry: &BuiltinSlotLook| entry.look.image.as_ref());
            search_image
                .or_else(|| {
                    figures
                        .builtin
                        .iter()
                        .find_map(|entry: &BuiltinSlotLook| entry.look.image.as_ref())
                })
                .or_else(|| {
                    figures
                        .custom
                        .iter()
                        .find_map(|slot: &model::CustomSlot| slot.look.image.as_ref())
                })
        }
        SkinData::Style(style) => style.icon.as_ref(),
    };
    name.map(|file_name: &String| dir.join(file_name).to_string_lossy().into_owned())
}

/// Stil: dunkel Grund, Seitenleiste, Akzent und Schrift; Figuren haben keine Farben.
fn swatches_of(data: &SkinData) -> Vec<String> {
    match data {
        SkinData::Figures(_) => Vec::new(),
        SkinData::Style(style) => vec![
            style.dark.base.clone(),
            style.dark.sidebar.clone(),
            style.dark.accent.clone(),
            style.dark.fg.clone(),
        ],
    }
}

pub fn get(app: &AppHandle, database: &Database, id: &str) -> Result<SkinPack, CommandError> {
    reload_pack(app, database, id)
}

/// Legt ein Paket an: leer, oder als Kopie von `copy_of` samt Bildern.
pub fn create(
    app: &AppHandle,
    database: &Database,
    kind: SkinKind,
    name: &str,
    copy_of: Option<&str>,
) -> Result<SkinPack, CommandError> {
    let name = validate::clean_name(name, "Der Name des Pakets").map_err(skin_error)?;
    let source: Option<SkinRow> = match copy_of {
        Some(source_id) => {
            let row = find_active(database, source_id)?;
            if kind_of_row(&row)? != kind {
                return Err(skin_error(format!(
                    "Die Vorlage „{}“ ist kein {}.",
                    row.name,
                    kind_name(kind)
                )));
            }
            Some(row)
        }
        None => None,
    };
    let data: SkinData = match &source {
        Some(row) => parse_data(row)?,
        None => empty_data(kind),
    };
    let id = uuid::Uuid::new_v4().simple().to_string();
    let dir = pack_dir(app, &id)?;
    fs::create_dir_all(&dir)?;
    let created = create_rows(app, database, &id, &dir, kind, name, &data, source.as_ref());
    if created.is_err() {
        // Ein halb angelegtes Paket bleibt nicht liegen.
        let _ = fs::remove_dir_all(&dir);
    }
    created?;
    notify(app);
    reload_pack(app, database, &id)
}

#[allow(clippy::too_many_arguments)]
fn create_rows(
    app: &AppHandle,
    database: &Database,
    id: &str,
    dir: &Path,
    kind: SkinKind,
    name: String,
    data: &SkinData,
    source: Option<&SkinRow>,
) -> Result<(), CommandError> {
    if let Some(row) = source {
        copy_files(&pack_dir(app, &row.id)?, dir)?;
    }
    let row = SkinRow {
        id: id.to_owned(),
        kind: enum_to_text(&kind)?,
        name,
        data: data_json(data)?,
        changed_at: now_text(),
        changed_by: None,
        deleted_at: None,
    };
    database.with(|connection| skin_rows::insert(connection, &row))
}

fn copy_files(from: &Path, to: &Path) -> Result<(), CommandError> {
    let Ok(entries) = fs::read_dir(from) else {
        // Ein Paket ohne Bildordner hat keine Bilder zu kopieren.
        return Ok(());
    };
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            fs::copy(entry.path(), to.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub fn rename(
    app: &AppHandle,
    database: &Database,
    id: &str,
    name: &str,
) -> Result<SkinPack, CommandError> {
    let row = find_active(database, id)?;
    let name = validate::clean_name(name, "Der Name des Pakets").map_err(skin_error)?;
    database.with(|connection| skin_rows::rename(connection, &row.id, &name, &now_text(), None))?;
    notify(app);
    reload_pack(app, database, id)
}

/// Prüft die Daten und speichert sie; besteht die Prüfung nicht, bleibt das Paket unverändert.
pub fn save(
    app: &AppHandle,
    database: &Database,
    id: &str,
    mut data: SkinData,
) -> Result<SkinPack, CommandError> {
    let row = find_active(database, id)?;
    let kind = kind_of_row(&row)?;
    if data.kind() != kind {
        return Err(skin_error(format!(
            "Die Daten passen nicht zum Paket „{}“: es ist ein {}.",
            row.name,
            kind_name(kind)
        )));
    }
    validate_data(&mut data, &pack_dir(app, &row.id)?)?;
    store(app, database, &row.id, &data)
}

/// Das Bildfeld, auf das `target` zeigt. Ein eingebautes Fach, das das Paket noch nicht hat,
/// wird mit leerem Aussehen angelegt.
fn image_field<'a>(
    data: &'a mut SkinData,
    target: &ImageTarget,
) -> Result<&'a mut Option<String>, String> {
    match (data, target) {
        (SkinData::Figures(figures), ImageTarget::Slot { slot, second }) => {
            let look = slot_look(figures, slot)?;
            Ok(if *second {
                &mut look.image2
            } else {
                &mut look.image
            })
        }
        (SkinData::Style(style), ImageTarget::SidebarImage) => Ok(&mut style.sidebar_image),
        (SkinData::Style(style), ImageTarget::ContentImage) => Ok(&mut style.content_image),
        (SkinData::Style(style), ImageTarget::Icon) => Ok(&mut style.icon),
        (SkinData::Figures(_), _) => Err(
            "Dieses Bildziel gehört zu einem Stilpaket, nicht zu einem Figurenpaket.".to_owned(),
        ),
        (SkinData::Style(_), ImageTarget::Slot { .. }) => {
            Err("Fächer gibt es nur in einem Figurenpaket, nicht in einem Stilpaket.".to_owned())
        }
    }
}

fn slot_look<'a>(figures: &'a mut FiguresData, slot: &str) -> Result<&'a mut SlotLook, String> {
    if validate::is_custom_id(slot) {
        return figures
            .custom
            .iter_mut()
            .find(|custom: &&mut model::CustomSlot| custom.id == slot)
            .map(|custom: &mut model::CustomSlot| &mut custom.look)
            .ok_or_else(|| format!("Das Paket hat kein Fach „{slot}“."));
    }
    let builtin: BuiltinSlot =
        enum_from_text(slot).map_err(|_| format!("Es gibt kein Fach „{slot}“."))?;
    let index: usize = match figures
        .builtin
        .iter()
        .position(|entry: &BuiltinSlotLook| entry.slot == builtin)
    {
        Some(found) => found,
        None => {
            figures.builtin.push(BuiltinSlotLook {
                slot: builtin,
                look: SlotLook::empty(),
            });
            figures.builtin.len() - 1
        }
    };
    Ok(&mut figures.builtin[index].look)
}

/// Legt ein Bild aus `source` im Paket ab und trägt es am Ziel ein.
pub fn set_image(
    app: &AppHandle,
    database: &Database,
    id: &str,
    target: &ImageTarget,
    source: &ImageSource,
) -> Result<SkinPack, CommandError> {
    let row = find_active(database, id)?;
    let dir = pack_dir(app, &row.id)?;
    let mut data = parse_data(&row)?;
    // Zuerst prüfen, ob das Ziel existiert, damit kein Bild ohne Platz im Paket landet.
    image_field(&mut data, target).map_err(skin_error)?;
    let file_name = images::ingest(&dir, target, source).map_err(skin_error)?;
    *image_field(&mut data, target).map_err(skin_error)? = Some(file_name);
    validate_data(&mut data, &dir)?;
    store(app, database, &row.id, &data)
}

/// Entfernt das Bild am Ziel samt Datei.
pub fn remove_image(
    app: &AppHandle,
    database: &Database,
    id: &str,
    target: &ImageTarget,
) -> Result<SkinPack, CommandError> {
    let row = find_active(database, id)?;
    let dir = pack_dir(app, &row.id)?;
    let mut data = parse_data(&row)?;
    let stem = images::file_stem(target).map_err(skin_error)?;
    let old_name: Option<String> = image_field(&mut data, target).map_err(skin_error)?.take();
    if let Some(name) = old_name.filter(|name: &String| validate::is_plain_file_name(name)) {
        // Eine Datei, die schon fehlt, ist kein Fehler: das Ziel soll ohnehin leer sein.
        let _ = fs::remove_file(dir.join(name));
    }
    images::remove_stem_files(&dir, &stem, None);
    validate_data(&mut data, &dir)?;
    store(app, database, &row.id, &data)
}

/// Löscht weich: das Paket verschwindet aus der Liste und kann 24 Stunden zurückgeholt werden.
pub fn delete(app: &AppHandle, database: &Database, id: &str) -> Result<(), CommandError> {
    let row = find_active(database, id)?;
    database.with(|connection| skin_rows::set_deleted(connection, &row.id, Some(&now_text())))?;
    notify(app);
    Ok(())
}

pub fn undelete(app: &AppHandle, database: &Database, id: &str) -> Result<SkinPack, CommandError> {
    let row: SkinRow = database
        .with(|connection| skin_rows::get(connection, id))?
        .ok_or_else(|| skin_error("Dieses Paket gibt es nicht mehr."))?;
    database.with(|connection| skin_rows::set_deleted(connection, &row.id, None))?;
    notify(app);
    reload_pack(app, database, &row.id)
}

/// Beim App-Start: Pakete, die länger als 24 Stunden gelöscht sind, samt Ordner entfernen und in
/// den Ordnern der übrigen alles, was kein Paketdatum mehr nennt.
pub fn purge_on_start(app: &AppHandle, database: &Database) -> Result<(), CommandError> {
    let cutoff: String = (Utc::now() - TimeDelta::hours(PURGE_AFTER_HOURS))
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    let purged: Vec<String> =
        database.with(|connection| skin_rows::purge_deleted(connection, &cutoff))?;
    for id in &purged {
        // Ein Ordner, der sich nicht löschen lässt, bleibt liegen; die Zeile ist ohnehin weg.
        let _ = fs::remove_dir_all(pack_dir(app, id)?);
    }
    let rows: Vec<SkinRow> = database.with(|connection| skin_rows::list(connection))?;
    for row in rows {
        match parse_data(&row) {
            Ok(data) => remove_unreferenced_files(&pack_dir(app, &row.id)?, &data),
            Err(error) => eprintln!("Skin-Paket {} nicht aufgeräumt: {error}", row.id),
        }
    }
    if !purged.is_empty() {
        notify(app);
    }
    Ok(())
}

fn referenced_files(data: &SkinData) -> HashSet<String> {
    let mut names: HashSet<String> = HashSet::new();
    match data {
        SkinData::Figures(figures) => {
            let looks = figures
                .builtin
                .iter()
                .map(|entry: &BuiltinSlotLook| &entry.look)
                .chain(
                    figures
                        .custom
                        .iter()
                        .map(|slot: &model::CustomSlot| &slot.look),
                );
            for look in looks {
                names.extend(look.image.iter().cloned());
                names.extend(look.image2.iter().cloned());
            }
        }
        SkinData::Style(style) => {
            for image in [&style.sidebar_image, &style.content_image, &style.icon] {
                names.extend(image.iter().cloned());
            }
        }
    }
    names
}

fn remove_unreferenced_files(dir: &Path, data: &SkinData) {
    let keep = referenced_files(data);
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let is_file: bool = entry
            .file_type()
            .is_ok_and(|kind: fs::FileType| kind.is_file());
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_file && !keep.contains(&name) {
            // Eine Datei, die sich nicht löschen lässt, räumt der nächste Start wieder an.
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Die 30 häufigsten Werkzeug-Aufrufe der Sessions mit Aktivität in den letzten `days` Tagen.
pub fn tool_usage(database: &Database, days: u32) -> Result<Vec<ToolUsage>, CommandError> {
    let window_days: f64 = f64::from(days.clamp(1, MAX_USAGE_DAYS));
    let since_ms: f64 = now_ms() - window_days * MILLIS_PER_DAY;
    let rows: Vec<(String, String, u32)> =
        database.with(|connection| skin_rows::tool_usage(connection, since_ms))?;
    Ok(rows
        .into_iter()
        .map(|(tool, input_prefix, count)| ToolUsage {
            tool,
            input_prefix,
            count,
            slot: None,
        })
        .collect())
}
