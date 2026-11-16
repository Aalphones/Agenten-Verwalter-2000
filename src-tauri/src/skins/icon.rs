//! App-Symbol aus dem aktiven Stilpaket: setzt das Symbol des Hauptfensters (Titelleiste und
//! Taskleiste). Ohne Symbol im Paket oder bei einem Fehler gilt wieder das Symbol der App.
use std::fs;
use std::path::Path;
use std::sync::Arc;

use tauri::image::Image;
use tauri::{AppHandle, Manager};

use super::model::SkinData;
use super::{find_active, pack_dir, parse_data};
use crate::db::Database;
use crate::error::CommandError;
use crate::settings;

const MAIN_WINDOW_LABEL: &str = "main";

/// Setzt das Symbol nach dem aktiven Stilpaket. Fehler stehen nur im Log: das Symbol ist
/// kosmetisch und darf weder den Start noch eine Änderung am Paket scheitern lassen.
pub fn apply(app: &AppHandle) {
    let database: Arc<Database> = Arc::clone(&app.state::<Arc<Database>>());
    apply_with(app, &database);
}

/// Setzt das Symbol neu, wenn `pack_id` das aktive Stilpaket ist; andere Pakete ändern es nicht.
pub fn apply_if_active(app: &AppHandle, database: &Database, pack_id: &str) {
    match settings::load(database) {
        Ok(loaded) if loaded.skin_style.as_deref() == Some(pack_id) => apply_with(app, database),
        Ok(_) => {}
        Err(error) => eprintln!("Einstellungen für das App-Symbol nicht lesbar: {error}"),
    }
}

/// Wie [`apply`], mit der Datenbank des Aufrufers (sie liegt im Kern schon in der Hand).
pub fn apply_with(app: &AppHandle, database: &Database) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let icon: Option<Image<'static>> = match style_icon(app, database) {
        Ok(found) => found,
        Err(error) => {
            eprintln!("App-Symbol des Stilpakets nicht lesbar: {error}");
            None
        }
    };
    let result = match icon.or_else(|| app.default_window_icon().cloned()) {
        Some(image) => window.set_icon(image),
        None => return,
    };
    if let Err(error) = result {
        eprintln!("App-Symbol nicht gesetzt: {error}");
    }
}

/// Das Symbol des aktiven Stilpakets; `None` ohne aktives Stilpaket oder ohne Symbol darin.
fn style_icon(
    app: &AppHandle,
    database: &Database,
) -> Result<Option<Image<'static>>, CommandError> {
    let Some(style_id) = settings::load(database)?.skin_style else {
        return Ok(None);
    };
    let row = find_active(database, &style_id)?;
    let SkinData::Style(style) = parse_data(&row)? else {
        return Ok(None);
    };
    let Some(file_name) = style.icon else {
        return Ok(None);
    };
    let path = pack_dir(app, &row.id)?.join(file_name);
    Ok(Some(read_icon(&path)?))
}

fn read_icon(path: &Path) -> Result<Image<'static>, CommandError> {
    let bytes: Vec<u8> = fs::read(path)?;
    Image::from_bytes(&bytes)
        .map(|image: Image<'_>| image.to_owned())
        .map_err(|error| {
            CommandError::Skin(format!(
                "Das Symbol {} ist kein lesbares PNG oder ICO: {error}",
                path.display()
            ))
        })
}
