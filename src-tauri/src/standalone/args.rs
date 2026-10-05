//! Argumente, mit denen der Verwalter die Claude-Kommandozeile startet (`process.rs`, `print.rs`) —
//! der Agent wertet aus, was er braucht, und überliest den Rest.
use std::path::PathBuf;

use crate::agents::event::Mode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Start {
    New(String),
    Resume(String),
    /// Nur im Druckmodus: eine einzelne Antwort ohne Transkript.
    None,
}

#[derive(Debug, Clone)]
pub struct AgentArgs {
    /// Druckmodus für eine strukturierte Einmal-Antwort, erkannt an `--json-schema`. `-p` allein
    /// reicht nicht: der Verwalter startet auch Sessions mit `-p`.
    pub print: bool,
    pub model: String,
    pub mode: Mode,
    pub start: Start,
    pub add_dirs: Vec<PathBuf>,
    pub allowed_rules: Vec<String>,
    pub system_prompt: Option<String>,
    /// Zusatz des Verwalters zum Systemprompt, z. B. die Vorgabe des Scratchpad-Ordners (ADR 022).
    pub append_system_prompt: Option<String>,
    pub json_schema: Option<String>,
    pub tools_disabled: bool,
}

const OPTION_PREFIX: &str = "--";

pub fn parse(args: &[String]) -> Result<AgentArgs, String> {
    let mut model: Option<String> = None;
    let mut mode = Mode::Manual;
    let mut start = Start::None;
    let mut add_dirs: Vec<PathBuf> = Vec::new();
    let mut allowed_rules: Vec<String> = Vec::new();
    let mut system_prompt: Option<String> = None;
    let mut append_system_prompt: Option<String> = None;
    let mut json_schema: Option<String> = None;
    let mut tools_disabled = false;
    let mut index = 0;
    while index < args.len() {
        let option = args[index].as_str();
        match option {
            "-p"
            | "--verbose"
            | "--safe-mode"
            | "--strict-mcp-config"
            | "--no-session-persistence" => {}
            "--input-format" | "--output-format" | "--permission-prompt-tool" | "--effort" => {
                value_of(args, &mut index)?;
            }
            "--model" => model = Some(value_of(args, &mut index)?),
            "--permission-mode" => mode = parse_mode(&value_of(args, &mut index)?)?,
            "--session-id" => start = Start::New(session_id(value_of(args, &mut index)?)?),
            "--resume" => start = Start::Resume(session_id(value_of(args, &mut index)?)?),
            "--add-dir" => add_dirs.push(PathBuf::from(value_of(args, &mut index)?)),
            "--allowedTools" => {
                while let Some(rule) = args.get(index + 1) {
                    if rule.starts_with(OPTION_PREFIX) {
                        break;
                    }
                    allowed_rules.push(rule.clone());
                    index += 1;
                }
            }
            "--system-prompt" => system_prompt = Some(value_of(args, &mut index)?),
            "--append-system-prompt" => append_system_prompt = Some(value_of(args, &mut index)?),
            "--json-schema" => json_schema = Some(value_of(args, &mut index)?),
            // Ein Wert: der leere schaltet alle Werkzeuge ab.
            "--tools" => tools_disabled = value_of(args, &mut index)?.is_empty(),
            unknown => eprintln!("Unbekanntes Argument, überlesen: {unknown}"),
        }
        index += 1;
    }
    let model = model.ok_or_else(|| "--model fehlt".to_owned())?;
    let print = json_schema.is_some();
    if !print && start == Start::None {
        return Err("--session-id oder --resume fehlt".to_owned());
    }
    Ok(AgentArgs {
        print,
        model,
        mode,
        start,
        add_dirs,
        allowed_rules,
        system_prompt,
        append_system_prompt,
        json_schema,
        tools_disabled,
    })
}

/// Der Wert nach der Option an `index`; rückt `index` auf ihn vor.
fn value_of(args: &[String], index: &mut usize) -> Result<String, String> {
    let option = &args[*index];
    *index += 1;
    args.get(*index)
        .cloned()
        .ok_or_else(|| format!("{option} ohne Wert"))
}

/// Gegenstück zu `Mode::cli_value`; auch für `set_permission_mode`.
pub fn mode_from_cli(value: &str) -> Option<Mode> {
    match value {
        "default" => Some(Mode::Manual),
        "acceptEdits" => Some(Mode::Edit),
        "plan" => Some(Mode::Plan),
        "auto" => Some(Mode::Auto),
        _ => None,
    }
}

fn parse_mode(value: &str) -> Result<Mode, String> {
    mode_from_cli(value).ok_or_else(|| format!("Unbekannter --permission-mode: {value}"))
}

/// Die ID wird Teil eines Dateinamens — nur Buchstaben, Ziffern und Bindestriche.
fn session_id(value: String) -> Result<String, String> {
    let is_valid = !value.is_empty()
        && value
            .chars()
            .all(|character: char| character.is_ascii_alphanumeric() || character == '-');
    if is_valid {
        Ok(value)
    } else {
        Err(format!("Ungültige Session-ID: {value}"))
    }
}
