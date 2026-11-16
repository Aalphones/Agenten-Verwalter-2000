//! Pakete als ZIP: `skin.json` und `bilder/<Datei>` (ADR 065, „ZIP-Format, Version 1“). Ein
//! fremdes Archiv ist Angriffsfläche; deshalb wird beim Lesen jeder Eintrag einzeln und mit
//! Größenbremse gelesen, nie nach der Angabe im Archiv, und erst ein bestandenes Paket kommt an
//! seinen Platz.
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::model::{
    BuiltinSlot, FiguresData, ImageTarget, MAX_IMAGE_BYTES, MAX_NAME_CHARS, SkinData, SkinKind,
    SkinPack, StyleData,
};
use super::{images, validate};
use crate::db::skins::SkinRow;
use crate::db::{Database, enum_to_text};
use crate::error::CommandError;

pub const MAX_ENTRIES: usize = 64;
pub const MAX_TOTAL_BYTES: usize = 20 * 1024 * 1024;
const FORMAT_VERSION: u64 = 1;
const MANIFEST_NAME: &str = "skin.json";
const IMAGES_DIR: &str = "bilder";
const IMPORT_DIR_PREFIX: &str = ".import-";
const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];
const MIB: usize = 1024 * 1024;

fn skin_error(message: impl Into<String>) -> CommandError {
    CommandError::Skin(message.into())
}

#[derive(Serialize)]
struct Manifest<'a> {
    format: u64,
    kind: SkinKind,
    name: &'a str,
    data: serde_json::Value,
}

/// Was ein Archiv-Eintrag sein darf.
enum EntryRole {
    Manifest,
    /// Das Verzeichnis `bilder/` selbst, wie es manche Packprogramme mit anlegen.
    ImagesDir,
    Image(String),
}

// ---------------------------------------------------------------- Export

/// Schreibt das Paket als ZIP nach `dest` (ohne Endung wird `.zip` angehängt) und liefert den Pfad.
pub fn export(pack: &SkinPack, dest: &Path) -> Result<PathBuf, CommandError> {
    let target: PathBuf = if dest.extension().is_some() {
        dest.to_path_buf()
    } else {
        dest.with_extension("zip")
    };
    let written = write_archive(pack, &target);
    if written.is_err() {
        // Ein halbes Archiv bleibt nicht liegen.
        let _ = fs::remove_file(&target);
    }
    written?;
    Ok(target)
}

fn write_archive(pack: &SkinPack, target: &Path) -> Result<(), CommandError> {
    let manifest = manifest_json(pack)?;
    let file: File = File::create(target).map_err(|error| {
        skin_error(format!(
            "Die Datei {} ist nicht schreibbar: {error}",
            target.display()
        ))
    })?;
    let mut writer: ZipWriter<File> = ZipWriter::new(file);
    let options: SimpleFileOptions =
        SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let write_failed = |error: &dyn std::fmt::Display| {
        skin_error(format!("Das Archiv ist nicht schreibbar: {error}"))
    };
    writer
        .start_file(MANIFEST_NAME, options)
        .map_err(|error| write_failed(&error))?;
    writer
        .write_all(manifest.as_bytes())
        .map_err(|error| write_failed(&error))?;
    let mut image_names: Vec<String> = super::referenced_files(&pack.data).into_iter().collect();
    image_names.sort();
    for name in image_names {
        if !validate::is_plain_file_name(&name) {
            return Err(skin_error(format!("Der Bildname „{name}“ ist ungültig.")));
        }
        let bytes: Vec<u8> = fs::read(Path::new(&pack.dir).join(&name)).map_err(|_| {
            skin_error(format!(
                "Das Bild „{name}“ fehlt im Ordner des Pakets „{}“.",
                pack.name
            ))
        })?;
        writer
            .start_file(format!("{IMAGES_DIR}/{name}"), options)
            .map_err(|error| write_failed(&error))?;
        writer
            .write_all(&bytes)
            .map_err(|error| write_failed(&error))?;
    }
    writer.finish().map_err(|error| write_failed(&error))?;
    Ok(())
}

fn manifest_json(pack: &SkinPack) -> Result<String, CommandError> {
    let data: Result<serde_json::Value, serde_json::Error> = match &pack.data {
        SkinData::Figures(figures) => serde_json::to_value(figures),
        SkinData::Style(style) => serde_json::to_value(style),
    };
    let manifest = Manifest {
        format: FORMAT_VERSION,
        kind: pack.data.kind(),
        name: &pack.name,
        data: data.map_err(|error| skin_error(format!("Das Paket ist nicht lesbar: {error}")))?,
    };
    serde_json::to_string_pretty(&manifest)
        .map_err(|error| skin_error(format!("Das Paket ist nicht lesbar: {error}")))
}

// ---------------------------------------------------------------- Import

/// Ein gelesenes, noch ungeprüftes Archiv: das Manifest und die Bilder mit ihrer Endung nach
/// Dateikopf.
struct ReadArchive {
    manifest: Vec<u8>,
    images: HashMap<String, (Vec<u8>, &'static str)>,
}

/// Liest das Archiv, prüft es und legt ein neues Paket an. Bei jedem Fehler bleibt nichts zurück.
pub fn import(
    app: &AppHandle,
    database: &Database,
    zip_path: &Path,
    changed_by: Option<&str>,
) -> Result<SkinPack, CommandError> {
    let archive: ReadArchive = read_archive(zip_path).map_err(skin_error)?;
    let (name, mut data): (String, SkinData) =
        parse_manifest(&archive.manifest).map_err(skin_error)?;
    let name = validate::clean_name(&name, "Der Name des Pakets").map_err(skin_error)?;
    let name = unique_name(&name, &taken_names(database)?);

    let root: PathBuf = super::skins_root(app)?;
    let import_dir: PathBuf = root.join(format!(
        "{IMPORT_DIR_PREFIX}{}",
        uuid::Uuid::new_v4().simple()
    ));
    fs::create_dir_all(&import_dir)?;
    let prepared = prepare_dir(&archive, &mut data, &import_dir);
    if let Err(message) = prepared {
        let _ = fs::remove_dir_all(&import_dir);
        return Err(skin_error(message));
    }

    let id: String = uuid::Uuid::new_v4().simple().to_string();
    let final_dir: PathBuf = super::pack_dir(app, &id)?;
    if let Err(error) = fs::rename(&import_dir, &final_dir) {
        let _ = fs::remove_dir_all(&import_dir);
        return Err(skin_error(format!("Das Paket ist nicht ablegbar: {error}")));
    }
    let created = super::create_rows(
        app,
        database,
        &id,
        &final_dir,
        data.kind(),
        name,
        &data,
        None,
        changed_by,
    );
    if let Err(error) = created {
        let _ = fs::remove_dir_all(&final_dir);
        return Err(error);
    }
    super::notify(app);
    super::reload_pack(app, database, &id)
}

/// Beim App-Start: Importordner, die ein Absturz mitten im Einlesen liegen ließ.
pub fn remove_leftover_import_dirs(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let is_leftover: bool = entry
            .file_name()
            .to_string_lossy()
            .starts_with(IMPORT_DIR_PREFIX);
        if is_leftover {
            // Ein Ordner, der sich nicht löschen lässt, räumt der nächste Start wieder an.
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn taken_names(database: &Database) -> Result<HashSet<String>, CommandError> {
    let rows: Vec<SkinRow> = database.with(|connection| crate::db::skins::list(connection))?;
    Ok(rows
        .into_iter()
        .filter(|row: &SkinRow| row.deleted_at.is_none())
        .map(|row: SkinRow| row.name.to_lowercase())
        .collect())
}

/// Hängt „ (2)“, „ (3)“ … an, bis der Name frei ist; der Stamm wird so gekürzt, dass er passt.
fn unique_name(name: &str, taken: &HashSet<String>) -> String {
    if !taken.contains(&name.to_lowercase()) {
        return name.to_owned();
    }
    for number in 2_u32.. {
        let suffix: String = format!(" ({number})");
        let keep: usize = MAX_NAME_CHARS.saturating_sub(suffix.chars().count());
        let base: String = name.chars().take(keep).collect();
        let candidate: String = format!("{base}{suffix}");
        if !taken.contains(&candidate.to_lowercase()) {
            return candidate;
        }
    }
    unreachable!("die Zählung endet erst mit u32::MAX")
}

fn classify_entry(name: &str, is_dir: bool) -> Result<EntryRole, String> {
    let is_unsafe: bool = name.contains("..")
        || name.contains(':')
        || name.starts_with('/')
        || name.starts_with('\\');
    if is_unsafe {
        return Err(format!(
            "Das Archiv enthält den unzulässigen Eintrag „{name}“."
        ));
    }
    if is_dir && name.trim_end_matches('/') == IMAGES_DIR {
        return Ok(EntryRole::ImagesDir);
    }
    if name == MANIFEST_NAME && !is_dir {
        return Ok(EntryRole::Manifest);
    }
    let image_name: Option<&str> = name
        .strip_prefix(IMAGES_DIR)
        .and_then(|rest: &str| rest.strip_prefix('/'))
        .filter(|rest: &&str| validate::is_plain_file_name(rest));
    match image_name {
        Some(file_name) if !is_dir => Ok(EntryRole::Image(file_name.to_owned())),
        _ => Err(format!(
            "Das Archiv enthält den unerwarteten Eintrag „{name}“: erlaubt sind nur {MANIFEST_NAME} und {IMAGES_DIR}/<Datei>."
        )),
    }
}

fn read_archive(zip_path: &Path) -> Result<ReadArchive, String> {
    let file: File = File::open(zip_path)
        .map_err(|error| format!("Die Datei {} ist nicht lesbar: {error}", zip_path.display()))?;
    let mut archive: ZipArchive<File> =
        ZipArchive::new(file).map_err(|_| "Das ist keine lesbare ZIP-Datei.".to_owned())?;
    if archive.len() > MAX_ENTRIES {
        return Err(format!("Das Archiv hat mehr als {MAX_ENTRIES} Einträge."));
    }
    let mut manifest: Option<Vec<u8>> = None;
    let mut images: HashMap<String, (Vec<u8>, &'static str)> = HashMap::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut total_bytes: usize = 0;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| "Das Archiv ist beschädigt oder verschlüsselt.".to_owned())?;
        let name: String = entry
            .name()
            .map_err(|_| "Das Archiv enthält einen Eintrag mit unlesbarem Namen.".to_owned())?
            .into_owned();
        let role: EntryRole = classify_entry(&name, entry.is_dir())?;
        if !seen.insert(name.clone()) {
            return Err(format!("Das Archiv enthält „{name}“ doppelt."));
        }
        if matches!(role, EntryRole::ImagesDir) {
            continue;
        }
        let bytes: Vec<u8> = read_entry(&mut entry, &name)?;
        total_bytes += bytes.len();
        if total_bytes > MAX_TOTAL_BYTES {
            return Err(format!(
                "Das Archiv ist entpackt größer als {} MiB.",
                MAX_TOTAL_BYTES / MIB
            ));
        }
        match role {
            EntryRole::Manifest => manifest = Some(bytes),
            EntryRole::Image(file_name) => {
                let extension: &'static str = images::sniff(&bytes).ok_or_else(|| {
                    format!(
                        "Die Datei „{name}“ ist kein Bild: erlaubt sind GIF, PNG, WebP und ICO."
                    )
                })?;
                images.insert(file_name, (bytes, extension));
            }
            EntryRole::ImagesDir => {}
        }
    }
    let manifest: Vec<u8> = manifest.ok_or_else(|| format!("Im Archiv fehlt {MANIFEST_NAME}."))?;
    Ok(ReadArchive { manifest, images })
}

/// Liest einen Eintrag höchstens bis `MAX_IMAGE_BYTES`; die im Archiv angegebene Größe zählt nicht.
fn read_entry(entry: &mut impl Read, name: &str) -> Result<Vec<u8>, String> {
    let mut bytes: Vec<u8> = Vec::new();
    entry
        .take(MAX_IMAGE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| format!("Der Eintrag „{name}“ ist nicht lesbar."))?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(format!(
            "Der Eintrag „{name}“ ist größer als {} MiB.",
            MAX_IMAGE_BYTES / MIB
        ));
    }
    Ok(bytes)
}

fn parse_manifest(bytes: &[u8]) -> Result<(String, SkinData), String> {
    let json: &[u8] = bytes.strip_prefix(UTF8_BOM).unwrap_or(bytes);
    let value: serde_json::Value = serde_json::from_slice(json)
        .map_err(|_| format!("{MANIFEST_NAME} ist kein gültiges JSON."))?;
    match value.get("format").and_then(serde_json::Value::as_u64) {
        Some(FORMAT_VERSION) => {}
        _ => {
            return Err(format!(
                "{MANIFEST_NAME} hat ein unbekanntes Format: der Verwalter liest nur Format {FORMAT_VERSION}."
            ));
        }
    }
    let kind: SkinKind = value
        .get("kind")
        .cloned()
        .and_then(|kind: serde_json::Value| serde_json::from_value(kind).ok())
        .ok_or_else(|| {
            format!("{MANIFEST_NAME} nennt keine gültige Art („figures“ oder „style“).")
        })?;
    let name: String = value
        .get("name")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("{MANIFEST_NAME} nennt keinen Namen."))?
        .to_owned();
    let data: serde_json::Value = value
        .get("data")
        .cloned()
        .ok_or_else(|| format!("{MANIFEST_NAME} enthält keine Daten."))?;
    let invalid =
        |error: serde_json::Error| format!("Die Daten in {MANIFEST_NAME} sind ungültig: {error}");
    let data: SkinData = match kind {
        SkinKind::Figures => serde_json::from_value::<FiguresData>(data)
            .map(SkinData::Figures)
            .map_err(invalid)?,
        SkinKind::Style => serde_json::from_value::<StyleData>(data)
            .map(|style: StyleData| SkinData::Style(Box::new(style)))
            .map_err(invalid)?,
    };
    Ok((name, data))
}

/// Eine Bildstelle des Pakets: der Dateistamm des Ziels, ob es das App-Symbol ist, und der Name.
struct ImageRef<'a> {
    stem: String,
    is_icon: bool,
    name: &'a mut Option<String>,
}

fn image_refs(data: &mut SkinData) -> Result<Vec<ImageRef<'_>>, String> {
    let mut refs: Vec<ImageRef<'_>> = Vec::new();
    match data {
        SkinData::Figures(figures) => {
            for entry in &mut figures.builtin {
                let slot: String = builtin_slot_text(entry.slot)?;
                push_look_refs(&mut refs, &slot, &mut entry.look)?;
            }
            for custom in &mut figures.custom {
                let slot: String = custom.id.clone();
                push_look_refs(&mut refs, &slot, &mut custom.look)?;
            }
        }
        SkinData::Style(style) => {
            for (target, name) in [
                (ImageTarget::SidebarImage, &mut style.sidebar_image),
                (ImageTarget::ContentImage, &mut style.content_image),
                (ImageTarget::Icon, &mut style.icon),
            ] {
                refs.push(ImageRef {
                    stem: images::file_stem(&target)?,
                    is_icon: matches!(target, ImageTarget::Icon),
                    name,
                });
            }
        }
    }
    Ok(refs)
}

fn builtin_slot_text(slot: BuiltinSlot) -> Result<String, String> {
    enum_to_text(&slot).map_err(|_| "Ein eingebautes Fach ist nicht lesbar.".to_owned())
}

fn push_look_refs<'a>(
    refs: &mut Vec<ImageRef<'a>>,
    slot: &str,
    look: &'a mut super::model::SlotLook,
) -> Result<(), String> {
    for (second, name) in [(false, &mut look.image), (true, &mut look.image2)] {
        let target = ImageTarget::Slot {
            slot: slot.to_owned(),
            second,
        };
        refs.push(ImageRef {
            stem: images::file_stem(&target)?,
            is_icon: false,
            name,
        });
    }
    Ok(())
}

/// Legt die Bilder, auf die `data` verweist, unter dem Namensschema des Kontrakts in `dir` ab,
/// trägt die neuen Namen in `data` ein und prüft zuletzt die Daten.
fn prepare_dir(archive: &ReadArchive, data: &mut SkinData, dir: &Path) -> Result<(), String> {
    for reference in image_refs(data)? {
        let Some(old_name) = reference.name.take() else {
            continue;
        };
        let (bytes, extension) = archive.images.get(&old_name).ok_or_else(|| {
            format!("Das Paket verweist auf das Bild „{old_name}“, das im Archiv fehlt.")
        })?;
        images::check_extension(extension, reference.is_icon)?;
        let new_name: String = format!("{}.{extension}", reference.stem);
        fs::write(dir.join(&new_name), bytes)
            .map_err(|error| format!("Das Bild ist nicht speicherbar: {error}"))?;
        *reference.name = Some(new_name);
    }
    match data {
        SkinData::Figures(figures) => validate::validate_figures(figures, dir),
        SkinData::Style(style) => validate::validate_style(style, dir),
    }
}
