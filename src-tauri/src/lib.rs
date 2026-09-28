pub mod agents;
pub mod commands;
pub mod error;
pub mod filesystem;
pub mod sessions;

use sessions::registry::SessionRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionRegistry::default())
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
