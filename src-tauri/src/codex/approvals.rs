//! Rückfragen von Codex (Freigabe für Befehl oder Dateiänderung, Frage an den Benutzer) als
//! Rückfragen des Verwalters: Codex' JSON-RPC-Anfrage wird zu einem `can_use_tool` mit
//! Request-ID `codex-<n>`; die Antwort des Verwalters geht als Antwort auf die gemerkte Anfrage
//! zurück.
use std::collections::HashMap;

use serde_json::{Map, Value, json};

use crate::standalone::output;

pub const COMMAND_METHOD: &str = "item/commandExecution/requestApproval";
pub const FILE_CHANGE_METHOD: &str = "item/fileChange/requestApproval";
pub const USER_INPUT_METHOD: &str = "item/tool/requestUserInput";

const REQUEST_ID_PREFIX: &str = "codex-";
/// Die Werkzeugnamen, unter denen der Verwalter die Rückfrage kennt (wie bei Claude Code).
const BASH_TOOL: &str = "Bash";
const EDIT_TOOL: &str = "Edit";
const ASK_USER_TOOL: &str = "AskUserQuestion";

/// Antworten auf `…/requestApproval` (`…ApprovalDecision`).
const DECISION_ACCEPT: &str = "accept";
const DECISION_DECLINE: &str = "decline";
const DECISION_CANCEL: &str = "cancel";

enum Kind {
    Command,
    FileChange,
    UserInput(Vec<AskedQuestion>),
}

/// Der Verwalter antwortet auf den Fragetext; Codex will die Frage-ID.
struct AskedQuestion {
    id: String,
    text: String,
}

struct OpenRequest {
    rpc_id: Value,
    kind: Kind,
}

/// Was an Codex zurückgeht: die gemerkte Anfrage-ID und das Ergebnis.
pub struct Answer {
    pub rpc_id: Value,
    pub result: Value,
}

#[derive(Default)]
pub struct Approvals {
    counter: u64,
    open: HashMap<String, OpenRequest>,
}

impl Approvals {
    /// Merkt die Anfrage und liefert die Zeile für den Verwalter; `None` für jede Anfrage, die kein
    /// Rückfrage-Fall ist. `changed_files` sind die Dateien des betroffenen `fileChange`-Elements.
    pub fn ask(
        &mut self,
        rpc_id: &Value,
        method: &str,
        params: &Value,
        changed_files: &[String],
    ) -> Option<Value> {
        let (tool, input, kind) = match method {
            COMMAND_METHOD => (BASH_TOOL, command_input(params), Kind::Command),
            FILE_CHANGE_METHOD => (
                EDIT_TOOL,
                file_change_input(params, changed_files),
                Kind::FileChange,
            ),
            USER_INPUT_METHOD => {
                let (input, questions) = user_input(params);
                (ASK_USER_TOOL, input, Kind::UserInput(questions))
            }
            _ => return None,
        };
        self.counter += 1;
        let request_id = format!("{REQUEST_ID_PREFIX}{}", self.counter);
        self.open.insert(
            request_id.clone(),
            OpenRequest {
                rpc_id: rpc_id.clone(),
                kind,
            },
        );
        Some(output::can_use_tool(&request_id, tool, &input))
    }

    /// `response` ist die Antwort aus der `control_response`-Zeile (`behavior`, `updatedInput`).
    /// `None`, wenn die Rückfrage nicht (mehr) offen ist.
    pub fn answer(&mut self, request_id: &str, response: &Value) -> Option<Answer> {
        let open = self.open.remove(request_id)?;
        let is_allowed = response.get("behavior").and_then(Value::as_str) == Some("allow");
        let result = match open.kind {
            Kind::Command | Kind::FileChange => json!({ "decision": decision(is_allowed) }),
            Kind::UserInput(questions) => user_input_result(&questions, response, is_allowed),
        };
        Some(Answer {
            rpc_id: open.rpc_id,
            result,
        })
    }

    /// Alle offenen Rückfragen als abgebrochen — vor einem Unterbrechen, damit Codex nicht auf
    /// Antworten wartet, die nie kommen.
    pub fn cancel_all(&mut self) -> Vec<Answer> {
        self.open
            .drain()
            .map(|(_, open): (String, OpenRequest)| Answer {
                rpc_id: open.rpc_id,
                result: match open.kind {
                    Kind::Command | Kind::FileChange => json!({ "decision": DECISION_CANCEL }),
                    Kind::UserInput(_) => json!({ "answers": {} }),
                },
            })
            .collect()
    }

    /// Codex hat die Anfrage selbst erledigt (`serverRequest/resolved`): sie bleibt nicht offen.
    pub fn forget(&mut self, rpc_id: &Value) {
        self.open
            .retain(|_, open: &mut OpenRequest| &open.rpc_id != rpc_id);
    }
}

/// Befehle und Dateiänderungen, die der Benutzer freigeben könnte — im Modus Planen gibt es keine.
pub fn is_change_request(method: &str) -> bool {
    method == COMMAND_METHOD || method == FILE_CHANGE_METHOD
}

/// Die Absage an Codex: der Turn läuft weiter, der Agent erfährt nur, dass es nicht ausgeführt wurde.
pub fn declined() -> Value {
    json!({ "decision": DECISION_DECLINE })
}

fn decision(is_allowed: bool) -> &'static str {
    if is_allowed {
        DECISION_ACCEPT
    } else {
        DECISION_DECLINE
    }
}

fn command_input(params: &Value) -> Value {
    json!({
        "command": text_of(params, "command"),
        "description": text_of(params, "reason"),
    })
}

/// Die Rückfrage zeigt eine Datei; weitere stehen in der Beschreibung.
fn file_change_input(params: &Value, changed_files: &[String]) -> Value {
    let file_path = changed_files
        .first()
        .map_or_else(|| text_of(params, "grantRoot"), String::as_str);
    let mut description: Vec<String> = Vec::new();
    let reason = text_of(params, "reason");
    if !reason.is_empty() {
        description.push(reason.to_owned());
    }
    if changed_files.len() > 1 {
        description.push(format!(
            "Weitere Dateien: {}",
            changed_files[1..].join(", ")
        ));
    }
    json!({ "file_path": file_path, "description": description.join("\n") })
}

fn user_input(params: &Value) -> (Value, Vec<AskedQuestion>) {
    let mut questions: Vec<Value> = Vec::new();
    let mut asked: Vec<AskedQuestion> = Vec::new();
    let raw_questions = params
        .get("questions")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    for raw in raw_questions {
        let text = text_of(raw, "question");
        questions.push(json!({
            "question": text,
            "header": text_of(raw, "header"),
            "options": options_of(raw),
            "multiSelect": false,
        }));
        asked.push(AskedQuestion {
            id: text_of(raw, "id").to_owned(),
            text: text.to_owned(),
        });
    }
    (json!({ "questions": questions }), asked)
}

fn options_of(question: &Value) -> Vec<Value> {
    question
        .get("options")
        .and_then(Value::as_array)
        .map(|options: &Vec<Value>| {
            options
                .iter()
                .map(|option: &Value| {
                    json!({
                        "label": text_of(option, "label"),
                        "description": text_of(option, "description"),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// `{"answers": {<Frage-ID>: {"answers": [<Antwort>]}}}` aus den Antworten des Verwalters
/// (`updatedInput.answers`: Fragetext → Antwort). Ohne Erlaubnis oder ohne Antwort bleibt die Frage
/// unbeantwortet.
fn user_input_result(questions: &[AskedQuestion], response: &Value, is_allowed: bool) -> Value {
    let mut answers = Map::new();
    let given = response
        .pointer("/updatedInput/answers")
        .and_then(Value::as_object)
        .filter(|_| is_allowed);
    if let Some(given) = given {
        for question in questions {
            if let Some(answer) = given.get(&question.text).and_then(Value::as_str) {
                answers.insert(question.id.clone(), json!({ "answers": [answer] }));
            }
        }
    }
    json!({ "answers": answers })
}

fn text_of<'a>(value: &'a Value, field: &str) -> &'a str {
    value.get(field).and_then(Value::as_str).unwrap_or_default()
}
