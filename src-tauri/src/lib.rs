pub mod agents;
pub mod attachments;
pub mod changes;
pub mod commands;
pub mod db;
pub mod error;
pub mod filesystem;
pub mod git;
pub mod processes;
pub mod repositories;
pub mod sessions;
pub mod skills;
pub mod worktrees;

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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Ohne Datenbank startet die App nicht: ein stiller Weiterlauf verlöre jede Session beim Beenden.
            let database = Arc::new(Database::open(
                &data_dir(app.handle())?.join(DATABASE_FILE),
            )?);
            attachments::clear_staging(app.handle());
            let registry = SessionRegistry::restore(app.handle(), Arc::clone(&database))?;
            app.manage(registry);
            app.manage(database);
            SessionRegistry::start_reaper(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::sessions::session_create,
            commands::sessions::session_list,
            commands::sessions::session_pause,
            commands::sessions::session_resume,
            commands::sessions::session_cancel,
            commands::sessions::session_rename,
            commands::sessions::session_archive,
            commands::sessions::session_restart,
            commands::sessions::session_set_model,
            commands::sessions::session_set_mode,
            commands::sessions::session_set_effort,
            commands::sessions::session_log,
            commands::chat::chat_history,
            commands::chat::chat_send,
            commands::chat::chat_answer,
            commands::attachments::attachment_add_files,
            commands::attachments::attachment_add_bytes,
            commands::attachments::attachment_discard,
            commands::skills::skill_list_for_session,
            commands::skills::skill_list_for_repositories,
            commands::repositories::repository_list,
            commands::repositories::repository_add,
            commands::repositories::repository_remove,
            commands::changes::changes_load,
            commands::changes::changes_file_diff,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri-Laufzeit konnte nicht starten");
}
