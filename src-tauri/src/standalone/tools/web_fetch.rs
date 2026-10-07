//! `WebFetch`: holt eine Seite und lässt das lokale Modell eine Frage dazu beantworten.
use std::io::Read;
use std::time::Duration;

use serde_json::{Value, json};
use ureq::ResponseExt;

use super::{INTERRUPTED, ToolContext, required_string};
use crate::standalone::llm::{self, ChatRequest, LlmError};

const FETCH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_BODY_BYTES: u64 = 5 * 1024 * 1024;
const HTML_LINE_WIDTH: usize = 100;
const USER_AGENT: &str = concat!("Agenten-Verwalter/", env!("CARGO_PKG_VERSION"));
/// Der Seitentext darf höchstens 40 % des Fensters füllen; ein Token sind rund vier Zeichen.
const PAGE_CONTEXT_PERCENT: usize = 40;
const CHARS_PER_TOKEN: usize = 4;
const ANSWER_SYSTEM_PROMPT: &str = "You answer a question about a web page using only the page content provided. Answer in the language of the question. Be concise.";

pub fn run(input: &Value, context: &ToolContext) -> Result<String, String> {
    let url = required_string(input, "url")?.trim();
    let prompt = required_string(input, "prompt")?;
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Die Adresse muss mit http:// oder https:// beginnen.".to_owned());
    }
    let page = fetch(url)?;
    let text = shortened_page(&page.text, context.context_window);
    let answer = answer_question(context, prompt, &text)?;
    Ok(format!("{answer}\n\nQuelle: {}", page.final_url))
}

struct Page {
    text: String,
    final_url: String,
}

fn fetch(url: &str) -> Result<Page, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(FETCH_TIMEOUT))
        .build()
        .into();
    let response = agent
        .get(url)
        .header("User-Agent", USER_AGENT)
        .call()
        .map_err(|error: ureq::Error| match error {
            ureq::Error::StatusCode(status) => format!("Seite antwortet mit Status {status}."),
            other => format!("Seite nicht erreichbar: {other}"),
        })?;
    let final_url = response.get_uri().to_string();
    let content_type = response
        .body()
        .mime_type()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut bytes: Vec<u8> = Vec::new();
    response
        .into_body()
        .into_reader()
        .take(MAX_BODY_BYTES)
        .read_to_end(&mut bytes)
        .map_err(|error: std::io::Error| format!("Seite nicht erreichbar: {error}"))?;
    let text = page_text(&content_type, &bytes)?;
    Ok(Page { text, final_url })
}

fn page_text(content_type: &str, bytes: &[u8]) -> Result<String, String> {
    if content_type == "text/html" {
        return html2text::from_read(bytes, HTML_LINE_WIDTH)
            .map_err(|error: html2text::Error| format!("Seite nicht lesbar: {error}"));
    }
    let is_text = content_type.starts_with("text/")
        || matches!(content_type, "application/json" | "application/xml");
    if !is_text {
        return Err(format!("Inhaltstyp {content_type} wird nicht unterstützt."));
    }
    Ok(String::from_utf8_lossy(bytes).into_owned())
}

fn shortened_page(text: &str, context_window: u32) -> String {
    let max_chars = context_window as usize * PAGE_CONTEXT_PERCENT / 100 * CHARS_PER_TOKEN;
    text.chars().take(max_chars).collect()
}

fn answer_question(context: &ToolContext, prompt: &str, page_text: &str) -> Result<String, String> {
    let messages: Vec<Value> = vec![
        json!({ "role": "system", "content": ANSWER_SYSTEM_PROMPT }),
        json!({ "role": "user", "content": format!("{prompt}\n\n---\n{page_text}") }),
    ];
    let request = ChatRequest {
        base_url: &context.base_url,
        model: &context.model,
        messages: &messages,
        tools: &[],
        response_format: None,
    };
    let completion =
        llm::complete(&request, &context.cancel).map_err(|error: LlmError| match error {
            LlmError::Cancelled => INTERRUPTED.to_owned(),
            LlmError::Failed(message) => message,
        })?;
    let answer = completion.text.trim();
    if answer.is_empty() {
        return Err("Das Modell lieferte keine Antwort zur Seite.".to_owned());
    }
    Ok(answer.to_owned())
}
