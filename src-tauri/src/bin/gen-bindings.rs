//! Erzeugt die TypeScript-Typen in src/lib/bindings/. Aufruf: `pnpm bindings`.
use ts_rs::{Config, TS};
use verwalter_lib::{
    agents::event::{
        Attachment, AttachmentKind, ChatEntry, Effort, Mode, ModelId, Question, QuestionAnswer,
        QuestionKind, QuestionOption, TodoItem, TodoState, ToolState,
    },
    background::model::{
        BackgroundChangedEvent, BackgroundItem, BackgroundKind, BackgroundState, ScratchpadEntry,
        ScratchpadListing, SessionBackground, SubagentStep, TextPreview,
    },
    changes::model::{
        ChangeKind, ChangeScope, DiffLine, DiffLineKind, FileChange, FileDiff, LineStat,
        RepositoryChanges, SessionChanges,
    },
    commands::app::AppInfo,
    context::model::{
        ContextBreakdown, ContextCategory, ContextChangedEvent, ContextFile, SessionContext,
    },
    error::CommandError,
    projects::model::{ProjectCreated, ProjectSummary},
    repositories::model::KnownRepository,
    sessions::model::{ChatEntryEvent, ChatPage, SessionStatus, SessionSummary},
    skills::model::{SkillInfo, SkillKind, SkillOrigin, SkillRef},
    usage::model::{UsageBreakdown, UsageLimit, UsageShare, UsageSnapshot, UsageStatus},
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
    AttachmentKind::export_all(&cfg)?;
    Attachment::export_all(&cfg)?;
    SkillOrigin::export_all(&cfg)?;
    SkillKind::export_all(&cfg)?;
    SkillInfo::export_all(&cfg)?;
    SkillRef::export_all(&cfg)?;
    ChatEntry::export_all(&cfg)?;
    QuestionAnswer::export_all(&cfg)?;
    SessionStatus::export_all(&cfg)?;
    SessionSummary::export_all(&cfg)?;
    ChatPage::export_all(&cfg)?;
    ChatEntryEvent::export_all(&cfg)?;
    ProjectSummary::export_all(&cfg)?;
    ProjectCreated::export_all(&cfg)?;
    KnownRepository::export_all(&cfg)?;
    ChangeKind::export_all(&cfg)?;
    ChangeScope::export_all(&cfg)?;
    LineStat::export_all(&cfg)?;
    FileChange::export_all(&cfg)?;
    RepositoryChanges::export_all(&cfg)?;
    SessionChanges::export_all(&cfg)?;
    DiffLineKind::export_all(&cfg)?;
    DiffLine::export_all(&cfg)?;
    FileDiff::export_all(&cfg)?;
    BackgroundKind::export_all(&cfg)?;
    BackgroundState::export_all(&cfg)?;
    SubagentStep::export_all(&cfg)?;
    BackgroundItem::export_all(&cfg)?;
    SessionBackground::export_all(&cfg)?;
    TextPreview::export_all(&cfg)?;
    ScratchpadEntry::export_all(&cfg)?;
    ScratchpadListing::export_all(&cfg)?;
    BackgroundChangedEvent::export_all(&cfg)?;
    ContextCategory::export_all(&cfg)?;
    ContextFile::export_all(&cfg)?;
    ContextBreakdown::export_all(&cfg)?;
    SessionContext::export_all(&cfg)?;
    ContextChangedEvent::export_all(&cfg)?;
    UsageLimit::export_all(&cfg)?;
    UsageShare::export_all(&cfg)?;
    UsageBreakdown::export_all(&cfg)?;
    UsageSnapshot::export_all(&cfg)?;
    UsageStatus::export_all(&cfg)?;
    Ok(())
}
