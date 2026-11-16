//! Commands der Skins (ADR 065). Dünn: die Fachlogik und die Prüfung liegen in `crate::skins`.
//! `async`, damit Datenbank und Bildordner nicht auf dem Haupt-Thread gelesen werden.
use std::sync::Arc;

use tauri::AppHandle;

use crate::db::Database;
use crate::error::CommandError;
use crate::skins::{
    self,
    model::{ImageSource, ImageTarget, SkinData, SkinKind, SkinPack, SkinPackSummary, ToolUsage},
};

/// Alle nicht gelöschten Pakete nach Name.
#[tauri::command]
pub async fn skins_list(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<SkinPackSummary>, CommandError> {
    skins::list(&app, &database)
}

#[tauri::command]
pub async fn skins_get(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
) -> Result<SkinPack, CommandError> {
    skins::get(&app, &database, &id)
}

/// Legt ein leeres Paket an; mit `copy_of` eine Kopie samt Bildern.
#[tauri::command]
pub async fn skins_create(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    kind: SkinKind,
    name: String,
    copy_of: Option<String>,
) -> Result<SkinPack, CommandError> {
    skins::create(&app, &database, kind, &name, copy_of.as_deref())
}

#[tauri::command]
pub async fn skins_rename(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
    name: String,
) -> Result<SkinPack, CommandError> {
    skins::rename(&app, &database, &id, &name)
}

/// Speichert die Daten, wenn sie die Prüfung bestehen; sonst ein Fehlersatz und nichts ändert sich.
#[tauri::command]
pub async fn skins_save(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
    data: SkinData,
) -> Result<SkinPack, CommandError> {
    skins::save(&app, &database, &id, data)
}

/// Legt ein Bild aus Datei, `https`-Adresse oder Bytes im Paket ab und trägt es am Ziel ein.
#[tauri::command]
pub async fn skins_set_image(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
    target: ImageTarget,
    source: ImageSource,
) -> Result<SkinPack, CommandError> {
    skins::set_image(&app, &database, &id, &target, &source)
}

#[tauri::command]
pub async fn skins_remove_image(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
    target: ImageTarget,
) -> Result<SkinPack, CommandError> {
    skins::remove_image(&app, &database, &id, &target)
}

/// Löscht weich; 24 Stunden lang holt `skins_undelete` das Paket zurück.
#[tauri::command]
pub async fn skins_delete(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
) -> Result<(), CommandError> {
    skins::delete(&app, &database, &id)
}

#[tauri::command]
pub async fn skins_undelete(
    app: AppHandle,
    database: tauri::State<'_, Arc<Database>>,
    id: String,
) -> Result<SkinPack, CommandError> {
    skins::undelete(&app, &database, &id)
}

/// Die häufigsten Werkzeug-Aufrufe der Sessions der letzten `days` Tage.
#[tauri::command]
pub async fn skins_tool_usage(
    database: tauri::State<'_, Arc<Database>>,
    days: u32,
) -> Result<Vec<ToolUsage>, CommandError> {
    skins::tool_usage(&database, days)
}
