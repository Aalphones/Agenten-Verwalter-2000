pub mod account;
pub mod agents;
pub mod archive;
pub mod artifacts;
pub mod attachments;
pub mod background;
pub mod changes;
pub mod cli_update;
pub mod commands;
pub mod context;
pub mod db;
pub mod error;
pub mod file_links;
pub mod filesystem;
pub mod git;
pub mod lmstudio;
pub mod mcp;
pub mod processes;
pub mod projects;
pub mod repositories;
pub mod retro;
pub mod review;
pub mod sessions;
pub mod settings;
pub mod skills;
pub mod standalone;
pub mod tldr;
pub mod usage;
pub mod voice;
pub mod worktrees;

use std::sync::Arc;

use tauri::Manager;

use account::AccountService;
use cli_update::CliUpdateService;
use db::Database;
use filesystem::workspace::data_dir;
use sessions::registry::SessionRegistry;
use usage::UsageService;
use voice::VoiceService;

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
            app.manage(UsageService::new());
            app.manage(AccountService::new());
            app.manage(CliUpdateService::new());
            app.manage(VoiceService::new());
            SessionRegistry::start_reaper(app.handle().clone());
            // Ohne Server fehlen nur die Artefakte; `artifacts_list` meldet das.
            match artifacts::server::start(app.handle().clone()) {
                Ok(server) => {
                    app.manage(server);
                }
                Err(error) => eprintln!("Server für Artefakte nicht gestartet: {error}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::projects::project_list,
            commands::projects::project_create,
            commands::projects::project_rename,
            commands::projects::project_add_repository,
            commands::projects::project_archive,
            commands::archive::archive_search,
            commands::archive::project_restore,
            commands::sessions::session_list,
            commands::sessions::session_create_in_project,
            commands::sessions::session_pause,
            commands::sessions::session_resume,
            commands::sessions::session_cancel,
            commands::sessions::session_rename,
            commands::sessions::session_delete,
            commands::sessions::session_set_viewed,
            commands::sessions::session_restart,
            commands::sessions::session_set_model,
            commands::sessions::session_set_mode,
            commands::sessions::session_set_effort,
            commands::sessions::session_log,
            commands::chat::chat_history,
            commands::chat::chat_send,
            commands::chat::chat_answer,
            commands::context::context_load,
            commands::context::context_refresh,
            commands::mcp::mcp_load,
            commands::mcp::mcp_refresh,
            commands::mcp::mcp_reconnect,
            commands::mcp::mcp_toggle,
            commands::mcp::mcp_authenticate,
            commands::usage::usage_load,
            commands::usage::usage_refresh,
            commands::account::account_load,
            commands::account::account_login,
            commands::cli_update::cli_update_load,
            commands::cli_update::cli_update_run,
            commands::attachments::attachment_add_files,
            commands::attachments::attachment_add_bytes,
            commands::attachments::attachment_discard,
            commands::skills::skill_list_for_session,
            commands::skills::skill_list_for_repositories,
            commands::background::background_load,
            commands::background::background_output,
            commands::background::background_stop,
            commands::background::scratchpad_list,
            commands::background::scratchpad_read,
            commands::repositories::repository_list,
            commands::repositories::repository_add,
            commands::repositories::repository_remove,
            commands::changes::changes_load,
            commands::changes::changes_file_diff,
            commands::git::git_status,
            commands::git::git_branches,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_switch,
            commands::git::git_create_branch,
            commands::git::git_abort_operation,
            commands::git::git_discard,
            commands::git::git_stash_push,
            commands::git::git_stash_list,
            commands::git::git_stash_pop,
            commands::git::git_pull_rebase,
            commands::git::git_merge,
            commands::git::git_delete_branch,
            commands::git::git_create_ticket_worktree,
            commands::git::git_open,
            commands::git::git_log,
            commands::git::git_suggest_message,
            commands::file_links::file_link_open,
            commands::artifacts::artifacts_list,
            commands::artifacts::artifact_open_in_browser,
            commands::tldr::tldr_session_load,
            commands::tldr::tldr_session_create,
            commands::tldr::tldr_project_load,
            commands::tldr::tldr_project_create,
            commands::tldr::tldr_set_carry,
            commands::retro::retro_run,
            commands::settings::settings_load,
            commands::settings::settings_update,
            commands::settings::settings_local_models,
            commands::voice::voice_model_status,
            commands::voice::voice_model_download,
            commands::voice::voice_model_cancel_download,
            commands::voice::voice_start,
            commands::voice::voice_stop,
            commands::voice::voice_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri-Laufzeit konnte nicht starten");
}
