pub mod agents;
pub mod commands;
pub mod db;
pub mod error;
pub mod filesystem;
pub mod sessions;

use std::sync::Arc;

use tauri::Manager;

use db::Database;
use filesystem::workspace::data_dir;
use sessions::registry::SessionRegistry;

const DATABASE_FILE: &str = "verwalter.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SessionRegistry::default())
        .setup(|app| {
            // Ohne Datenbank startet die App nicht: ein stiller Weiterlauf verlöre jede Session beim Beenden.
            let database = Arc::new(Database::open(
                &data_dir(app.handle())?.join(DATABASE_FILE),
            )?);
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::sessions::session_create,
            commands::sessions::session_list,
            commands::sessions::session_pause,
            commands::sessions::session_resume,
            commands::sessions::session_cancel,
            commands::sessions::session_restart,
            commands::sessions::session_set_model,
            commands::sessions::session_set_mode,
            commands::sessions::session_set_effort,
            commands::sessions::session_log,
            commands::chat::chat_history,
            commands::chat::chat_send,
            commands::chat::chat_answer,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri-Laufzeit konnte nicht starten");
}
