//! Betriebsarten mit LM Studio: Claude Code + LM Studio (dieselbe Kommandozeile, Modellanfragen an
//! LM Studio, ADR 016) und Autark (der eigene Agent des Verwalters, ADR 017).
use std::process::Command;

use crate::error::CommandError;
use crate::lmstudio;
use crate::settings::model::{OperatingMode, Settings};
use crate::standalone;

/// LM Studio versteht jeden Schlüssel, solange „Require Authentication“ aus ist.
const AUTH_TOKEN: &str = "lmstudio";

/// Welches Programm die Session startet.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalProgram {
    ClaudeCode,
    Standalone,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalBackend {
    pub base_url: String,
    pub model: String,
    pub context_window: u32,
    pub program: LocalProgram,
}

/// `Ok(None)` in der Betriebsart Claude. Fragt LM Studio (höchstens 3 s) — nie unter einer
/// Session-Sperre aufrufen.
pub fn resolve(settings: &Settings) -> Result<Option<LocalBackend>, CommandError> {
    let program = match settings.operating_mode {
        OperatingMode::Claude => return Ok(None),
        OperatingMode::ClaudeCodeLocal => LocalProgram::ClaudeCode,
        OperatingMode::Standalone => LocalProgram::Standalone,
    };
    let Some(model) = settings.local_model.clone() else {
        return Err(CommandError::LocalModelUnavailable(
            "Kein lokales Modell gewählt — wähle eins in den Einstellungen unter „Lokales Modell“."
                .to_owned(),
        ));
    };
    let base_url = lmstudio::base_url();
    let found = lmstudio::find(&model).map_err(|error: String| {
        CommandError::LocalModelUnavailable(format!(
            "LM Studio nicht erreichbar unter {base_url}: {error}"
        ))
    })?;
    if !found.is_loaded {
        return Err(CommandError::LocalModelUnavailable(format!(
            "Das Modell „{model}“ ist in LM Studio nicht geladen — lade es dort und sende erneut."
        )));
    }
    Ok(Some(LocalBackend {
        base_url,
        model,
        context_window: found
            .loaded_context_length
            .unwrap_or(found.max_context_length),
        program,
    }))
}

/// Setzt die Umgebung des Kindprozesses für LM Studio.
pub fn apply(command: &mut Command, backend: &LocalBackend) {
    let context_window = backend.context_window.to_string();
    if backend.program == LocalProgram::Standalone {
        command
            .env(standalone::BASE_URL_VARIABLE, &backend.base_url)
            .env(standalone::CONTEXT_WINDOW_VARIABLE, context_window);
        return;
    }
    command
        .env("ANTHROPIC_BASE_URL", &backend.base_url)
        .env("ANTHROPIC_AUTH_TOKEN", AUTH_TOKEN)
        .env("CLAUDE_CODE_ATTRIBUTION_HEADER", "0")
        // Keine Garantie, dass nichts an Anthropic geht (ADR 016), aber gemessen blieb damit der
        // Verkehr auf Loopback.
        .env("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1")
        .env("CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL", "1")
        .env("ANTHROPIC_DEFAULT_FABLE_MODEL", &backend.model)
        .env("ANTHROPIC_DEFAULT_OPUS_MODEL", &backend.model)
        .env("ANTHROPIC_DEFAULT_SONNET_MODEL", &backend.model)
        .env("ANTHROPIC_DEFAULT_HAIKU_MODEL", &backend.model)
        .env("CLAUDE_CODE_SUBAGENT_MODEL", &backend.model)
        .env("CLAUDE_CODE_MAX_CONTEXT_TOKENS", context_window)
        // Ein geerbter Schlüssel hätte sonst Vorrang vor dem Token.
        .env_remove("ANTHROPIC_API_KEY");
}
