//! Der Erkennungs-Thread eines Diktats: erkennt die Abschnitte, während die Aufnahme weiterläuft, und
//! meldet den wachsenden Gesamttext als `voice://partial`.
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::time::Instant;

use tauri::{AppHandle, Emitter, Manager};

use super::model::VoicePartialEvent;
use super::resample::{TARGET_RATE, to_mono_16k};
use super::silence::{Silence, is_silent};
use super::{VOICE_PARTIAL_EVENT, VoiceService};
use crate::error::CommandError;

/// Wortschatz-Hinweis für Whisper: Begriffe, die im Diktat an einen Coding-Agenten oft vorkommen und
/// sonst eingedeutscht oder zerlegt würden.
pub const BASE_PROMPT: &str = "Verwalter, Claude, Session, Worktree, Branch, Commit, Repository, Diff, Changes, Skill, Agent, Commit-Nachricht, Pull Request";
/// So viel vom bisherigen Text geht als Erkennungshilfe in den nächsten Abschnitt, damit die
/// Satzgrenzen nicht leiden.
const PROMPT_TAIL_CHARS: usize = 200;

pub fn base_prompt(repository_names: &[String]) -> String {
    if repository_names.is_empty() {
        return BASE_PROMPT.to_owned();
    }
    format!("{BASE_PROMPT}, {}", repository_names.join(", "))
}

/// Läuft, bis der Aufnahme-Thread den Kanal schließt, und gibt den Gesamttext zurück (leer, wenn kein
/// Abschnitt Text ergab).
pub fn run(
    app: AppHandle,
    segments: mpsc::Receiver<Vec<f32>>,
    channels: u16,
    rate: u32,
    base_prompt: String,
    language: Option<String>,
    cancel: Arc<AtomicBool>,
) -> Result<String, CommandError> {
    // Lädt beim ersten Diktat das Modell; die Abschnitte stauen sich derweil im Kanal.
    let transcriber = app.state::<VoiceService>().transcriber(&app)?;
    let mut text = String::new();
    while let Ok(first) = segments.recv() {
        let mut audio = first;
        let mut merged_count = 1;
        // Liegengebliebene Abschnitte in einem Durchlauf: ein kurzer Abschnitt kostet Whisper fast so
        // viel wie ein langer.
        while let Ok(next) = segments.try_recv() {
            audio.extend(next);
            merged_count += 1;
        }
        if cancel.load(Ordering::Relaxed) {
            return Err(CommandError::VoiceCancelled);
        }
        let mono = to_mono_16k(&audio, channels, rate);
        if is_silent(&mono) != Silence::Speech {
            continue;
        }
        let prompt = if text.is_empty() {
            base_prompt.clone()
        } else {
            format!("{base_prompt}. {}", prompt_tail(&text))
        };
        let started = Instant::now();
        match transcriber.transcribe(&mono, &prompt, language.as_deref(), &cancel) {
            Ok(part) => {
                if !text.is_empty() {
                    text.push(' ');
                }
                text.push_str(&part);
            }
            Err(CommandError::NoSpeech) => {}
            Err(error) => return Err(error),
        }
        if cfg!(debug_assertions) {
            eprintln!(
                "voice: Abschnitt {:.1} s Audio ({merged_count} zusammengefasst), erkannt in {} ms",
                mono.len() as f32 / TARGET_RATE as f32,
                started.elapsed().as_millis()
            );
        }
        // Direkt vor dem Senden geprüft: Text eines abgebrochenen Diktats darf nicht in einem neuen
        // landen.
        if !cancel.load(Ordering::Relaxed) && !text.is_empty() {
            emit_partial(&app, &text);
        }
    }
    if cancel.load(Ordering::Relaxed) {
        return Err(CommandError::VoiceCancelled);
    }
    Ok(text)
}

/// Die letzten `PROMPT_TAIL_CHARS` Zeichen (nicht Bytes — Umlaute), vorne bis zum ersten ganzen Wort
/// gekürzt.
fn prompt_tail(text: &str) -> &str {
    let Some((start, _)) = text.char_indices().rev().nth(PROMPT_TAIL_CHARS - 1) else {
        return text;
    };
    let tail = &text[start..];
    if start == 0 || text[..start].ends_with(' ') {
        return tail;
    }
    match tail.find(' ') {
        Some(space) => &tail[space + 1..],
        None => tail,
    }
}

fn emit_partial(app: &AppHandle, text: &str) {
    let event = VoicePartialEvent {
        text: text.to_owned(),
    };
    if let Err(error) = app.emit(VOICE_PARTIAL_EVENT, event) {
        eprintln!("Diktat-Ereignis nicht gesendet: {error}");
    }
}
