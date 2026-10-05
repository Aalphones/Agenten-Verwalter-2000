//! `AskUserQuestion`: läuft erst, nachdem der Verwalter die Rückfrage beantwortet hat — die
//! Antworten stehen dann in `answers` der freigegebenen Eingabe (Frage → Antwort).
use serde_json::{Map, Value};

pub const NO_ANSWER: &str = "Keine Antwort erhalten.";

pub fn run(input: &Value) -> Result<String, String> {
    let Some(answers) = input
        .get("answers")
        .and_then(Value::as_object)
        .filter(|answers: &&Map<String, Value>| !answers.is_empty())
    else {
        return Err(NO_ANSWER.to_owned());
    };
    // Reihenfolge aus `questions`: das Objekt `answers` kennt keine (serde_json sortiert die Schlüssel).
    let asked: Vec<&str> = input
        .get("questions")
        .and_then(Value::as_array)
        .map(|questions: &Vec<Value>| {
            questions
                .iter()
                .filter_map(|question: &Value| question.get("question").and_then(Value::as_str))
                .collect()
        })
        .unwrap_or_default();
    let mut lines: Vec<String> = asked
        .iter()
        .filter_map(|question: &&str| {
            answers
                .get(*question)
                .map(|answer: &Value| answer_line(question, answer))
        })
        .collect();
    for (question, answer) in answers {
        if !asked.contains(&question.as_str()) {
            lines.push(answer_line(question, answer));
        }
    }
    Ok(lines.join("\n"))
}

fn answer_line(question: &str, answer: &Value) -> String {
    match answer {
        Value::String(text) => format!("{question}: {text}"),
        other => format!("{question}: {other}"),
    }
}
