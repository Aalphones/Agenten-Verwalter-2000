//! Erkennung eines Abschnitts mit whisper.cpp.
use std::num::NonZero;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::error::CommandError;

const MAX_THREADS: usize = 8;
const NO_SPEECH_THRESHOLD: f32 = 0.6;
/// Bekannte Whisper-Erfindungen bei Stille im Deutschen: Abspänne aus den Untertiteln der
/// Trainingsdaten. Ein Segment, das sie enthält, ist nie gesprochen worden.
const HALLUCINATIONS: [&str; 2] = ["Untertitel im Auftrag des ZDF", "Amara.org"];

/// `WhisperContext` ist `Send + Sync` (er hält den Kontext in einem `Arc` auf einen als `Send + Sync`
/// markierten Typ), daher ohne `Mutex`: ein auslaufender abgebrochener Erkennungs-Thread darf neben
/// einem neuen laufen, jeder mit eigenem State.
pub struct Transcriber {
    context: WhisperContext,
}

impl Transcriber {
    pub fn load(path: &Path) -> Result<Transcriber, CommandError> {
        WhisperContext::new_with_params(path, WhisperContextParameters::default())
            .map(|context: WhisperContext| Transcriber { context })
            .map_err(|error: whisper_rs::WhisperError| {
                CommandError::Internal(format!("Sprachmodell: {error}"))
            })
    }

    /// Erwartet 16 kHz mono. `language` ist ein Whisper-Sprachcode; `None` lässt Whisper die Sprache
    /// je Abschnitt erkennen. Leeres Ergebnis → `NoSpeech`, abgebrochen → `VoiceCancelled`.
    pub fn transcribe(
        &self,
        audio: &[f32],
        prompt: &str,
        language: Option<&str>,
        cancel: &Arc<AtomicBool>,
    ) -> Result<String, CommandError> {
        let mut state = self.context.create_state().map_err(whisper_error)?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(language);
        params.set_translate(false);
        params.set_no_context(true);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);
        params.set_no_speech_thold(NO_SPEECH_THRESHOLD);
        params.set_n_threads(thread_count());
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        // `set_initial_prompt` bricht bei einem Nullbyte mit Panic ab; Repository-Namen kommen von außen.
        params.set_initial_prompt(&prompt.replace('\0', ""));
        let abort_cancel = Arc::clone(cancel);
        // whisper-rs 0.16 legt den Callback als `Box<dyn FnMut>` ab, ruft ihn aber als `F` auf — nur wenn
        // `F` selbst diese Box ist, stimmen beide Typen. Die Box wird nie freigegeben (wenige Bytes je
        // Durchlauf).
        let abort: Box<dyn FnMut() -> bool> =
            Box::new(move || abort_cancel.load(Ordering::Relaxed));
        params.set_abort_callback_safe::<_, Box<dyn FnMut() -> bool>>(abort);

        let result = state.full(params, audio);
        if cancel.load(Ordering::Relaxed) {
            return Err(CommandError::VoiceCancelled);
        }
        result.map_err(whisper_error)?;

        let mut parts: Vec<String> = Vec::new();
        for segment in state.as_iter() {
            let text = segment.to_str_lossy().map_err(whisper_error)?;
            let is_hallucination = HALLUCINATIONS
                .iter()
                .any(|hallucination: &&str| text.contains(hallucination));
            if !is_hallucination {
                parts.push(text.into_owned());
            }
        }
        let text = parts
            .join(" ")
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        if text.is_empty() {
            return Err(CommandError::NoSpeech);
        }
        Ok(text)
    }
}

fn thread_count() -> i32 {
    let available = thread::available_parallelism().map_or(1, NonZero::get);
    available.min(MAX_THREADS) as i32
}

fn whisper_error(error: whisper_rs::WhisperError) -> CommandError {
    CommandError::Internal(format!("Erkennung: {error}"))
}
