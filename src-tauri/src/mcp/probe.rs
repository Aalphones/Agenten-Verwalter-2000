//! „Verbindung testen“ und „Werkzeuge & Anweisungen ansehen“ ohne Agent (ADR 070): verbinden,
//! lesen, schließen. Blockiert bis zu `PROBE_TIMEOUT` — nur außerhalb des Haupt-Threads aufrufen.
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

use crate::mcp::config_files::ProbeTarget;
use crate::mcp::model::{McpProbeResult, McpToolInfo};
use crate::standalone::mcp::client::{McpClient, McpTool, OAUTH_UNSUPPORTED};

const PROBE_TIMEOUT: Duration = Duration::from_secs(20);

const ERROR_TIMEOUT: &str = "Keine Antwort nach 20 Sekunden.";
const ERROR_LOGIN_REQUIRED: &str =
    "Der Server verlangt eine Anmeldung. Testen geht nur über den Agenten.";

const REDACTED: &str = "•••";
/// Kürzere Werte (`1`, `de`) sind keine Zugangsdaten und würden den Fehlersatz zerlegen.
const MIN_SECRET_CHARS: usize = 4;
/// Ab dieser Länge zählt auch ein Wort eines Werts allein, etwa das Token hinter `Bearer`.
const MIN_SECRET_WORD_CHARS: usize = 8;

/// `folder`: Arbeitsordner eines stdio-Servers. `target` trägt den Fehlersatz, wenn sich aus Eintrag
/// oder Entwurf kein Server bauen ließ. Der Fehlersatz enthält nie einen Header- oder
/// Umgebungswert; er wird nicht protokolliert.
pub fn run(target: Result<ProbeTarget, String>, folder: &Path) -> McpProbeResult {
    let target = match target {
        Ok(target) => target,
        Err(error) => return failed(error),
    };
    let cancel = AtomicBool::new(false);
    let outcome = thread::scope(|scope| {
        let (done, waiting) = mpsc::channel::<()>();
        let cancel = &cancel;
        scope.spawn(move || {
            if waiting.recv_timeout(PROBE_TIMEOUT) == Err(RecvTimeoutError::Timeout) {
                cancel.store(true, Ordering::SeqCst);
            }
        });
        let outcome = connect_and_read(&target, folder, cancel);
        drop(done);
        outcome
    });
    match outcome {
        Ok(result) => result,
        Err(_) if cancel.load(Ordering::SeqCst) => failed(ERROR_TIMEOUT.to_owned()),
        Err(error) if error == OAUTH_UNSUPPORTED => failed(ERROR_LOGIN_REQUIRED.to_owned()),
        Err(error) => failed(redacted(&error, &target.secrets)),
    }
}

fn connect_and_read(
    target: &ProbeTarget,
    folder: &Path,
    cancel: &AtomicBool,
) -> Result<McpProbeResult, String> {
    // Scheitert der Handschlag, schließt der Client selbst; so bleibt kein Prozess zurück.
    let client = McpClient::connect_in(&target.server, Some(folder), cancel)?;
    let result = McpProbeResult {
        tools: client
            .tools()
            .iter()
            .map(|tool: &McpTool| McpToolInfo {
                name: tool.name.clone(),
                description: tool.description.clone(),
            })
            .collect(),
        instructions: client.instructions().map(str::to_owned),
        error: None,
    };
    client.close();
    Ok(result)
}

fn failed(error: String) -> McpProbeResult {
    McpProbeResult {
        tools: Vec::new(),
        instructions: None,
        error: Some(error),
    }
}

/// Der Fehlersatz des Clients zitiert stderr bzw. den Antwortkörper des Servers, und beide können
/// wiederholen, was er bekommen hat.
fn redacted(error: &str, secrets: &[String]) -> String {
    let mut needles: Vec<&str> = secrets
        .iter()
        .flat_map(|secret: &String| {
            let words = secret
                .split_whitespace()
                .filter(|word: &&str| word.chars().count() >= MIN_SECRET_WORD_CHARS);
            std::iter::once(secret.trim()).chain(words)
        })
        .filter(|needle: &&str| needle.chars().count() >= MIN_SECRET_CHARS)
        .collect();
    // Längste zuerst: sonst bliebe vom ganzen Wert der Rest neben einem ersetzten Teil stehen.
    needles.sort_by_key(|needle: &&str| std::cmp::Reverse(needle.len()));
    let mut text = error.to_owned();
    for needle in &needles {
        text = text.replace(needle, REDACTED);
    }
    // Der Client kürzt den Antwortkörper; am Ende kann der Anfang eines Werts übrig sein.
    let cut_at = needles
        .iter()
        .flat_map(|needle: &&str| {
            needle
                .char_indices()
                .map(|(index, _): (usize, char)| &needle[..index])
                .filter(|prefix: &&str| prefix.chars().count() >= MIN_SECRET_CHARS)
        })
        .filter(|prefix: &&str| text.ends_with(prefix))
        .map(str::len)
        .max();
    if let Some(length) = cut_at {
        text.truncate(text.len() - length);
        text.push_str(REDACTED);
    }
    text
}
