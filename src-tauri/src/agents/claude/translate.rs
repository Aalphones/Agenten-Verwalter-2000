//! Übersetzt Zeilen der Claude-Kommandozeile in anbieterneutrale `AgentEvent`s.
use std::time::Instant;

use serde_json::{Map, Value};

use super::protocol::{
    AssistantMessage, ContentBlock, ControlRequestLine, Incoming, MessageLine, ModelUsage,
    ResultLine, SystemLine, Usage, UserContent, UserMessage,
};
use crate::agents::event::{
    AgentEvent, Question, QuestionKind, QuestionOption, TodoItem, TodoState, TurnEnd,
};

const ASK_USER_TOOL: &str = "AskUserQuestion";
const TODO_TOOL: &str = "TodoWrite";
const GREP_TOOL: &str = "Grep";
const ABORTED_REASON: &str = "aborted_streaming";

const TARGET_MAX_CHARS: usize = 120;
const TARGET_FIELDS: [&str; 9] = [
    "file_path",
    "notebook_path",
    "path",
    "command",
    "pattern",
    "url",
    "query",
    "description",
    "skill",
];

#[derive(Debug, Default)]
pub struct Translator {
    thinking_started: Option<Instant>,
}

impl Translator {
    pub fn handle_line(&mut self, line: &str) -> Vec<AgentEvent> {
        let Ok(incoming) = serde_json::from_str::<Incoming>(line) else {
            return vec![AgentEvent::Unknown(line.to_owned())];
        };
        match incoming {
            Incoming::System(system) => self.handle_system(system),
            Incoming::Assistant(assistant) => self.handle_assistant(assistant),
            Incoming::User(user) => handle_user(user),
            Incoming::ControlRequest(request) => handle_control_request(request, line),
            Incoming::Result(result) => vec![turn_ended(result)],
            Incoming::Other => Vec::new(),
        }
    }

    fn handle_system(&mut self, system: SystemLine) -> Vec<AgentEvent> {
        match system.subtype.as_str() {
            "init" => vec![AgentEvent::Ready {
                model: system.model.unwrap_or_default(),
            }],
            "thinking_tokens" => {
                self.thinking_started.get_or_insert_with(Instant::now);
                Vec::new()
            }
            _ => Vec::new(),
        }
    }

    fn handle_assistant(&mut self, line: MessageLine<AssistantMessage>) -> Vec<AgentEvent> {
        // Subagenten-Nachrichten zeigt erst Meilenstein 2b.
        if line.parent_tool_use_id.is_some() {
            return Vec::new();
        }
        let mut events: Vec<AgentEvent> = Vec::new();
        if let Some(usage) = line.message.usage {
            events.push(AgentEvent::ContextUsed(context_used(&usage)));
        }
        for block in line.message.content {
            if let Some(event) = self.translate_block(block) {
                events.push(event);
            }
        }
        events
    }

    fn translate_block(&mut self, block: ContentBlock) -> Option<AgentEvent> {
        match block {
            ContentBlock::Text { text } => {
                if text.trim().is_empty() {
                    None
                } else {
                    Some(AgentEvent::Text(text))
                }
            }
            ContentBlock::Thinking { thinking } => Some(AgentEvent::Thinking {
                seconds: self.take_thinking_seconds(),
                text: thinking,
            }),
            ContentBlock::ToolUse { id, name, input } => translate_tool_use(id, name, &input),
            ContentBlock::ToolResult { .. } | ContentBlock::Other => None,
        }
    }

    fn take_thinking_seconds(&mut self) -> u32 {
        let Some(started) = self.thinking_started.take() else {
            return 1;
        };
        let rounded_seconds = (started.elapsed().as_millis() + 500) / 1000;
        u32::try_from(rounded_seconds).unwrap_or(u32::MAX).max(1)
    }
}

fn context_used(usage: &Usage) -> u32 {
    let total = usage.input_tokens.unwrap_or(0)
        + usage.cache_creation_input_tokens.unwrap_or(0)
        + usage.cache_read_input_tokens.unwrap_or(0);
    u32::try_from(total).unwrap_or(u32::MAX)
}

fn translate_tool_use(id: String, name: String, input: &Value) -> Option<AgentEvent> {
    match name.as_str() {
        TODO_TOOL => Some(AgentEvent::Todos(todo_items(input))),
        // Die Frage selbst kommt als `can_use_tool`-Anfrage.
        ASK_USER_TOOL => None,
        _ => {
            let target = target_of(&name, input);
            Some(AgentEvent::ToolStarted {
                tool_use_id: id,
                tool: name,
                target,
            })
        }
    }
}

fn todo_items(input: &Value) -> Vec<TodoItem> {
    let Some(todos) = input.get("todos").and_then(Value::as_array) else {
        return Vec::new();
    };
    todos
        .iter()
        .filter_map(|todo: &Value| {
            let label = todo.get("content").and_then(Value::as_str)?;
            Some(TodoItem {
                label: label.to_owned(),
                state: todo_state(todo.get("status").and_then(Value::as_str)),
            })
        })
        .collect()
}

fn todo_state(status: Option<&str>) -> TodoState {
    match status {
        Some("completed") => TodoState::Done,
        Some("in_progress") => TodoState::Active,
        _ => TodoState::Todo,
    }
}

fn handle_user(line: MessageLine<UserMessage>) -> Vec<AgentEvent> {
    if line.parent_tool_use_id.is_some() {
        return Vec::new();
    }
    let UserContent::Blocks(blocks) = line.message.content else {
        return Vec::new();
    };
    blocks
        .into_iter()
        .filter_map(|block: ContentBlock| match block {
            ContentBlock::ToolResult {
                tool_use_id,
                is_error,
            } => Some(AgentEvent::ToolFinished {
                tool_use_id,
                failed: is_error == Some(true),
            }),
            _ => None,
        })
        .collect()
}

fn handle_control_request(request: ControlRequestLine, line: &str) -> Vec<AgentEvent> {
    let ControlRequestLine {
        request_id,
        request: body,
    } = request;
    if body.subtype != "can_use_tool" {
        return vec![AgentEvent::Unknown(line.to_owned())];
    }
    let input = body.input.unwrap_or_else(|| Value::Object(Map::new()));
    let tool = body.tool_name.unwrap_or_default();
    let (question_kind, questions) = if tool == ASK_USER_TOOL {
        (QuestionKind::AskUser, ask_user_questions(&input))
    } else {
        (
            QuestionKind::Permission,
            vec![permission_question(&tool, &input)],
        )
    };
    vec![AgentEvent::QuestionAsked {
        request_id,
        question_kind,
        questions,
        input,
    }]
}

fn ask_user_questions(input: &Value) -> Vec<Question> {
    let Some(questions) = input.get("questions").and_then(Value::as_array) else {
        return Vec::new();
    };
    questions
        .iter()
        .map(|question: &Value| Question {
            question: string_field(question, "question"),
            options: question_options(question),
            multi_select: question
                .get("multiSelect")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        })
        .collect()
}

fn question_options(question: &Value) -> Vec<QuestionOption> {
    let Some(options) = question.get("options").and_then(Value::as_array) else {
        return Vec::new();
    };
    options
        .iter()
        .map(|option: &Value| QuestionOption {
            label: string_field(option, "label"),
            hint: string_field(option, "description"),
        })
        .collect()
}

fn permission_question(tool: &str, input: &Value) -> Question {
    let target = target_of(tool, input);
    let tool_label = if tool.is_empty() {
        "ein Werkzeug"
    } else {
        tool
    };
    let question = if target.is_empty() {
        format!("Claude möchte {tool_label} ausführen")
    } else {
        format!("Claude möchte {tool_label} ausführen: {target}")
    };
    Question {
        question,
        options: vec![
            QuestionOption {
                label: "Erlauben".to_owned(),
                hint: "Nur diesen Aufruf".to_owned(),
            },
            QuestionOption {
                label: "Ablehnen".to_owned(),
                hint: "Claude bekommt eine Absage und sucht einen anderen Weg".to_owned(),
            },
        ],
        multi_select: false,
    }
}

fn turn_ended(result: ResultLine) -> AgentEvent {
    // Größtes Fenster statt „erster Eintrag“: `modelUsage` ist eine Map ohne Reihenfolge und
    // listet neben dem Hauptmodell auch Hilfsmodelle, deren Fenster kleiner sein kann.
    let context_window = result.model_usage.as_ref().and_then(|usage_by_model| {
        usage_by_model
            .values()
            .filter_map(|usage: &ModelUsage| usage.context_window)
            .max()
    });
    let end = if result.terminal_reason.as_deref() == Some(ABORTED_REASON) {
        TurnEnd::Aborted
    } else if result.is_error {
        let message = result
            .result
            .filter(|text: &String| !text.trim().is_empty())
            .unwrap_or(result.subtype);
        TurnEnd::Failed(message)
    } else {
        TurnEnd::Completed
    };
    AgentEvent::TurnEnded {
        end,
        context_window,
    }
}

/// Kurzbeschreibung, worauf ein Werkzeug zielt: eine Zeile, höchstens 120 Zeichen.
fn target_of(tool: &str, input: &Value) -> String {
    let grep_target = if tool == GREP_TOOL {
        grep_target(input)
    } else {
        None
    };
    let full_target = grep_target
        .or_else(|| first_string_field(input))
        .unwrap_or_default();
    shorten_to_line(&full_target)
}

fn grep_target(input: &Value) -> Option<String> {
    let pattern = input.get("pattern").and_then(Value::as_str)?;
    match input.get("path").and_then(Value::as_str) {
        Some(path) => Some(format!("\"{pattern}\" in {path}")),
        None => Some(format!("\"{pattern}\"")),
    }
}

fn first_string_field(input: &Value) -> Option<String> {
    TARGET_FIELDS
        .iter()
        .find_map(|field: &&str| input.get(*field).and_then(Value::as_str))
        .map(str::to_owned)
}

fn shorten_to_line(text: &str) -> String {
    let trimmed = text.trim();
    let first_line = trimmed.lines().next().unwrap_or_default().trim_end();
    let is_cut = trimmed.contains('\n') || first_line.chars().count() > TARGET_MAX_CHARS;
    if !is_cut {
        return first_line.to_owned();
    }
    let mut shortened: String = first_line.chars().take(TARGET_MAX_CHARS - 1).collect();
    shortened.push('…');
    shortened
}

fn string_field(value: &Value, field: &str) -> String {
    value
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}
