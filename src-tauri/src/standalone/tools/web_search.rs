//! `WebSearch` über die Brave Search API. Ohne Schlüssel in `VERWALTER_BRAVE_API_KEY` wird das
//! Werkzeug dem Modell gar nicht angeboten.
use std::env;
use std::time::Duration;

use regex::Regex;
use serde_json::Value;

use super::{ToolContext, required_string};

pub const API_KEY_VARIABLE: &str = "VERWALTER_BRAVE_API_KEY";
const SEARCH_URL: &str = "https://api.search.brave.com/res/v1/web/search";
const SEARCH_TIMEOUT: Duration = Duration::from_secs(15);
const RESULT_COUNT: &str = "10";
const STATUS_UNAUTHORIZED: u16 = 401;
const STATUS_FORBIDDEN: u16 = 403;
const STATUS_RATE_LIMITED: u16 = 429;

/// Der Schlüssel aus der Umgebung; leer oder fehlend heißt: keine Websuche.
pub fn api_key() -> Option<String> {
    env::var(API_KEY_VARIABLE)
        .ok()
        .map(|key: String| key.trim().to_owned())
        .filter(|key: &String| !key.is_empty())
}

pub fn run(input: &Value, _context: &ToolContext) -> Result<String, String> {
    let query = required_string(input, "query")?;
    let Some(key) = api_key() else {
        return Err("Die Websuche ist nicht eingerichtet.".to_owned());
    };
    let body = search(query, &key)?;
    Ok(format_results(&body))
}

fn search(query: &str, key: &str) -> Result<Value, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(SEARCH_TIMEOUT))
        .build()
        .into();
    let mut response = agent
        .get(SEARCH_URL)
        .query("q", query)
        .query("count", RESULT_COUNT)
        .header("Accept", "application/json")
        .header("X-Subscription-Token", key)
        .call()
        .map_err(failure_text)?;
    let text = response
        .body_mut()
        .read_to_string()
        .map_err(|error: ureq::Error| format!("Websuche fehlgeschlagen: {error}"))?;
    serde_json::from_str(&text).map_err(|_error: serde_json::Error| {
        "Websuche fehlgeschlagen: Antwort nicht lesbar".to_owned()
    })
}

/// Der Schlüssel reist als Kopfzeile; ein Fehler von `ureq` nennt sie nicht, und Fehlertexte
/// tragen nur den Status.
fn failure_text(error: ureq::Error) -> String {
    match error {
        ureq::Error::StatusCode(status @ (STATUS_UNAUTHORIZED | STATUS_FORBIDDEN)) => {
            format!("Brave lehnt den Schlüssel ab (Status {status}).")
        }
        ureq::Error::StatusCode(STATUS_RATE_LIMITED) => {
            format!("Brave-Kontingent erschöpft (Status {STATUS_RATE_LIMITED}).")
        }
        ureq::Error::StatusCode(status) => format!("Websuche fehlgeschlagen: Status {status}"),
        other => format!("Websuche fehlgeschlagen: {other}"),
    }
}

fn format_results(body: &Value) -> String {
    let Some(results) = body.pointer("/web/results").and_then(Value::as_array) else {
        return "Keine Treffer.".to_owned();
    };
    let markup = Regex::new("<[^>]+>").ok();
    let lines: Vec<String> = results
        .iter()
        .map(|result: &Value| {
            let title = text_field(result, "title");
            let url = text_field(result, "url");
            let description = text_field(result, "description");
            let description = match &markup {
                Some(pattern) => pattern.replace_all(description, "").into_owned(),
                None => description.to_owned(),
            };
            format!("{title} — {url} — {description}")
        })
        .collect();
    if lines.is_empty() {
        return "Keine Treffer.".to_owned();
    }
    lines.join("\n")
}

fn text_field<'a>(result: &'a Value, field: &str) -> &'a str {
    result
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or_default()
}
