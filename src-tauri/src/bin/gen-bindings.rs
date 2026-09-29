//! Erzeugt die TypeScript-Typen in src/lib/bindings/. Aufruf: `pnpm bindings`.
use ts_rs::{Config, TS};
use verwalter_lib::{
    agents::event::{
        ChatEntry, Effort, Mode, ModelId, Question, QuestionAnswer, QuestionKind, QuestionOption,
        TodoItem, TodoState, ToolState,
    },
    commands::app::AppInfo,
    error::CommandError,
    repositories::model::KnownRepository,
    sessions::model::{ChatEntryEvent, ChatPage, SessionStatus, SessionSummary},
};

fn main() -> Result<(), ts_rs::ExportError> {
    let cfg =
        Config::new().with_out_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/bindings"));
    AppInfo::export_all(&cfg)?;
    CommandError::export_all(&cfg)?;
    ModelId::export_all(&cfg)?;
    Effort::export_all(&cfg)?;
    Mode::export_all(&cfg)?;
    ToolState::export_all(&cfg)?;
    TodoState::export_all(&cfg)?;
    TodoItem::export_all(&cfg)?;
    QuestionOption::export_all(&cfg)?;
    Question::export_all(&cfg)?;
    QuestionKind::export_all(&cfg)?;
    ChatEntry::export_all(&cfg)?;
    QuestionAnswer::export_all(&cfg)?;
    SessionStatus::export_all(&cfg)?;
    SessionSummary::export_all(&cfg)?;
    ChatPage::export_all(&cfg)?;
    ChatEntryEvent::export_all(&cfg)?;
    KnownRepository::export_all(&cfg)?;
    Ok(())
}
