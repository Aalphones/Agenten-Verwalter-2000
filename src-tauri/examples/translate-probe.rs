//! Zeigt, welche Ereignisse der Übersetzer aus einer Aufzeichnung der Claude-Kommandozeile macht.
//! Aufruf: `cargo run --manifest-path src-tauri/Cargo.toml --example translate-probe -- <datei.jsonl>`.
//! Je Ereignis eine Zeile `{:?}`, gekürzt auf 200 Zeichen; `Unknown` ohne die Zeile dahinter.
//! Kein Zugriff auf Datenbank oder Netz.
use std::env;
use std::fs;
use std::process::ExitCode;

use verwalter_lib::agents::claude::translate::Translator;
use verwalter_lib::agents::event::AgentEvent;

const USAGE: &str = "Aufruf: translate-probe <datei.jsonl>";
const MAX_LINE_CHARS: usize = 200;

fn main() -> ExitCode {
    let Some(path) = env::args().nth(1) else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) => {
            eprintln!("FEHLER {path}: {error}");
            return ExitCode::from(1);
        }
    };
    let mut translator = Translator::default();
    for line in content
        .lines()
        .filter(|line: &&str| !line.trim().is_empty())
    {
        for event in translator.handle_line(line) {
            println!("{}", describe(&event));
        }
    }
    ExitCode::SUCCESS
}

fn describe(event: &AgentEvent) -> String {
    if matches!(event, AgentEvent::Unknown(_)) {
        return "Unknown".to_owned();
    }
    let text = format!("{event:?}");
    if text.chars().count() <= MAX_LINE_CHARS {
        return text;
    }
    let mut shortened: String = text.chars().take(MAX_LINE_CHARS - 1).collect();
    shortened.push('…');
    shortened
}
