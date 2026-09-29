//! Anbieterneutrale Typen: was ein Agent tut, ohne Wissen über sein Protokoll.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::skills::model::SkillRef;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ModelId {
    Fable,
    Opus,
    Sonnet,
    Haiku,
}

impl ModelId {
    pub fn cli_id(self) -> &'static str {
        match self {
            ModelId::Fable => "claude-fable-5-1",
            ModelId::Opus => "claude-opus-5-5",
            ModelId::Sonnet => "claude-sonnet-5-5",
            ModelId::Haiku => "claude-haiku-4-5-20251001",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Effort {
    Low,
    Medium,
    High,
    Xhigh,
    Max,
}

impl Effort {
    pub fn cli_value(self) -> &'static str {
        match self {
            Effort::Low => "low",
            Effort::Medium => "medium",
            Effort::High => "high",
            Effort::Xhigh => "xhigh",
            Effort::Max => "max",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    Manual,
    Edit,
    Plan,
    Auto,
}

impl Mode {
    pub fn cli_value(self) -> &'static str {
        match self {
            Mode::Manual => "default",
            Mode::Edit => "acceptEdits",
            Mode::Plan => "plan",
            Mode::Auto => "auto",
        }
    }
}

/// Ein unterbrochener Aufruf kann trotzdem ausgeführt worden sein —
/// deshalb gibt es `Interrupted` und bewusst kein „nicht ausgeführt“.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ToolState {
    Running,
    Done,
    Failed,
    Interrupted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum TodoState {
    Done,
    Active,
    Todo,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub label: String,
    pub state: TodoState,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOption {
    pub label: String,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub question: String,
    pub options: Vec<QuestionOption>,
    pub multi_select: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum QuestionKind {
    AskUser,
    Permission,
}

/// `Image` richtet sich nur nach der Endung — ob ein Bild als Inhalt oder als Pfad an den
/// Agenten geht, entscheidet zusätzlich seine Größe (`attachments::message_content`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum AttachmentKind {
    Image,
    File,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub kind: AttachmentKind,
    /// serde schreibt eine JSON-Zahl, kein `bigint`; bis 2^53 Bytes ist sie in TypeScript genau.
    #[ts(type = "number")]
    pub size_bytes: u64,
    /// Absolut: vor dem Senden im Zwischenordner, danach `<Workspace>\.anhaenge\<id>\<name>`.
    pub path: String,
}

/// Ein Eintrag im Chat-Verlauf. `seq` ist sein Index in der Session; ein geänderter
/// Eintrag behält seine `seq` und wird erneut gesendet.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ChatEntry {
    User {
        seq: u32,
        text: String,
        sent_at: f64,
        /// Einträge aus der Zeit vor Anhängen haben das Feld nicht.
        #[serde(default)]
        attachments: Vec<Attachment>,
        /// Der Skill, den die Nachricht mit `/name` aufruft.
        #[serde(default)]
        skill: Option<SkillRef>,
    },
    Text {
        seq: u32,
        text: String,
    },
    Thinking {
        seq: u32,
        text: String,
        seconds: u32,
    },
    Tool {
        seq: u32,
        tool_use_id: String,
        tool: String,
        target: String,
        state: ToolState,
    },
    Todos {
        seq: u32,
        items: Vec<TodoItem>,
    },
    Question {
        seq: u32,
        request_id: String,
        question_kind: QuestionKind,
        questions: Vec<Question>,
        answer: Option<String>,
    },
    Error {
        seq: u32,
        title: String,
        text: String,
    },
}

impl ChatEntry {
    pub fn seq(&self) -> u32 {
        match self {
            ChatEntry::User { seq, .. }
            | ChatEntry::Text { seq, .. }
            | ChatEntry::Thinking { seq, .. }
            | ChatEntry::Tool { seq, .. }
            | ChatEntry::Todos { seq, .. }
            | ChatEntry::Question { seq, .. }
            | ChatEntry::Error { seq, .. } => *seq,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum QuestionAnswer {
    /// Eine Antwort je Frage, in der Reihenfolge der Fragen.
    Options {
        answers: Vec<String>,
    },
    Allow,
    Deny {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TurnEnd {
    Completed,
    Aborted,
    Failed(String),
}

/// Was im Hintergrund läuft: ein Prozess (Bash mit `run_in_background`) oder ein Subagent.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskKind {
    Process,
    Subagent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskEnd {
    Completed,
    Failed,
    Stopped,
}

/// Was aus einer Zeile des Agenten folgt — anbieterneutral, ohne Session-Zustand.
#[derive(Debug, Clone)]
pub enum AgentEvent {
    Ready {
        model: String,
    },
    Text(String),
    Thinking {
        text: String,
        seconds: u32,
    },
    ToolStarted {
        tool_use_id: String,
        tool: String,
        target: String,
    },
    ToolFinished {
        tool_use_id: String,
        failed: bool,
    },
    Todos(Vec<TodoItem>),
    QuestionAsked {
        request_id: String,
        question_kind: QuestionKind,
        questions: Vec<Question>,
        input: serde_json::Value,
    },
    ContextUsed(u32),
    TurnEnded {
        end: TurnEnd,
        context_window: Option<u32>,
    },
    /// Der eigene temporäre Ordner, den der Agent für diese Session benutzt.
    ScratchpadDir(String),
    /// Befehl des Hauptagenten im Vordergrund.
    CommandStarted {
        tool_use_id: String,
        command: String,
    },
    CommandFinished {
        tool_use_id: String,
        output: String,
        exit_code: Option<i32>,
    },
    TaskStarted {
        task_id: String,
        tool_use_id: String,
        kind: TaskKind,
        title: String,
        subagent_type: Option<String>,
    },
    /// Die Datei, in die ein Hintergrundprozess seine Ausgabe schreibt.
    TaskOutputFile {
        tool_use_id: String,
        path: String,
    },
    TaskProgress {
        task_id: String,
        tool_uses: u32,
    },
    TaskEnded {
        task_id: String,
        end: TaskEnd,
        summary: Option<String>,
        output_file: Option<String>,
    },
    /// Werkzeugaufruf eines Subagenten; `parent_tool_use_id` ist sein `Agent`-Aufruf.
    SubagentStep {
        parent_tool_use_id: String,
        tool: String,
        target: String,
    },
    SubagentText {
        parent_tool_use_id: String,
        text: String,
    },
    SubagentModel {
        tool_use_id: String,
        model: String,
    },
    Unknown(String),
}
