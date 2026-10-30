//! Misst Parakeet TDT gegen Whisper auf derselben Aufnahme (Plan `parakeet`, Phase 1). Aufruf:
//! `cargo run --release --manifest-path src-tauri/Cargo.toml --example parakeet-probe -- <WAV>
//! <Parakeet-Ordner> [<Whisper-Modell>] [--reference "<Text>"]`. `-` statt des Parakeet-Ordners
//! lässt Parakeet aus, damit der Arbeitsspeicher jeder Engine in einem eigenen Prozess messbar ist.
//! Druckt je Engine Ladezeit, Erkennungszeit, Audiolänge, Echtzeitfaktor, Text und Wortfehlerrate.
use std::env;
use std::num::NonZero;
use std::path::Path;
use std::process::ExitCode;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::thread;
use std::time::{Duration, Instant};

use parakeet_rs::{ExecutionConfig, ParakeetTDT, TimestampMode, Transcriber as _};
use verwalter_lib::voice::dictation::BASE_PROMPT;
use verwalter_lib::voice::resample::to_mono_16k;
use verwalter_lib::voice::transcribe::Transcriber;

const USAGE: &str =
    "Aufruf: parakeet-probe <WAV> <Parakeet-Ordner|-> [<Whisper-Modell>] [--reference \"<Text>\"]";
const SAMPLE_RATE: u32 = 16_000;
const MAX_THREADS: usize = 8;
const SKIP: &str = "-";

type ProbeResult = Result<ExitCode, Box<dyn std::error::Error>>;

struct Measurement {
    load: Duration,
    recognition: Duration,
    text: String,
}

fn main() -> ProbeResult {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let reference = option_value(&arguments, "--reference");
    let positional: Vec<&String> = arguments
        .iter()
        .take_while(|argument: &&String| !argument.starts_with("--"))
        .collect();
    let (Some(wav), Some(parakeet_dir)) = (positional.first(), positional.get(1)) else {
        eprintln!("{USAGE}");
        return Ok(ExitCode::from(2));
    };

    let audio = read_mono_16k(Path::new(wav))?;
    let seconds = audio.len() as f64 / f64::from(SAMPLE_RATE);
    println!("Aufnahme: {wav} ({seconds:.2} s)");
    if let Some(reference) = reference {
        println!("Referenz: {reference}");
    }

    if parakeet_dir.as_str() != SKIP {
        let measurement = run_parakeet(Path::new(parakeet_dir), &audio)?;
        report(
            "Parakeet TDT 0.6B v3 int8",
            &measurement,
            seconds,
            reference,
        );
    }
    if let Some(whisper_model) = positional.get(2) {
        let measurement = run_whisper(Path::new(whisper_model), &audio)?;
        report("Whisper small q5_1", &measurement, seconds, reference);
    }
    Ok(ExitCode::SUCCESS)
}

fn option_value<'a>(arguments: &'a [String], name: &str) -> Option<&'a str> {
    let index = arguments
        .iter()
        .position(|argument: &String| argument == name)?;
    arguments.get(index + 1).map(String::as_str)
}

fn read_mono_16k(path: &Path) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .samples::<i16>()
            .map(|sample: Result<i16, hound::Error>| {
                sample.map(|value: i16| f32::from(value) / 32768.0)
            })
            .collect::<Result<Vec<f32>, hound::Error>>()?,
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<Result<Vec<f32>, hound::Error>>()?,
    };
    Ok(to_mono_16k(&samples, spec.channels, spec.sample_rate))
}

fn thread_count() -> usize {
    let available = thread::available_parallelism().map_or(1, NonZero::get);
    available.min(MAX_THREADS)
}

fn assert_send<T: Send>() {}

fn run_parakeet(dir: &Path, audio: &[f32]) -> Result<Measurement, Box<dyn std::error::Error>> {
    assert_send::<ParakeetTDT>();
    let started = Instant::now();
    let config = ExecutionConfig::new()
        .with_environment(parakeet_rs::ort::init().build()?)
        .with_intra_threads(thread_count());
    let mut model = ParakeetTDT::from_pretrained(dir, Some(config))?;
    let load = started.elapsed();
    let started = Instant::now();
    let result = model.transcribe_samples(
        audio.to_vec(),
        SAMPLE_RATE,
        1,
        Some(TimestampMode::Sentences),
    )?;
    Ok(Measurement {
        load,
        recognition: started.elapsed(),
        text: result.text.trim().to_owned(),
    })
}

fn run_whisper(path: &Path, audio: &[f32]) -> Result<Measurement, Box<dyn std::error::Error>> {
    let cancel = Arc::new(AtomicBool::new(false));
    let started = Instant::now();
    let transcriber = Transcriber::load(path)?;
    let load = started.elapsed();
    let started = Instant::now();
    let text = transcriber.transcribe(audio, BASE_PROMPT, None, &cancel)?;
    Ok(Measurement {
        load,
        recognition: started.elapsed(),
        text,
    })
}

fn report(engine: &str, measurement: &Measurement, seconds: f64, reference: Option<&str>) {
    let recognition_ms = measurement.recognition.as_millis();
    println!("== {engine}");
    println!("Ladezeit: {} ms", measurement.load.as_millis());
    println!("Erkennungszeit: {recognition_ms} ms");
    println!(
        "Echtzeitfaktor: {:.3}",
        measurement.recognition.as_secs_f64() / seconds
    );
    println!("Text: {}", measurement.text);
    if let Some(reference) = reference {
        println!(
            "Wortfehlerrate: {:.1} %",
            word_error_rate(reference, &measurement.text) * 100.0
        );
    }
}

fn normalized_words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split_whitespace()
        .map(|word: &str| {
            word.chars()
                .filter(|character: &char| character.is_alphanumeric() || *character == '-')
                .collect::<String>()
        })
        .filter(|word: &String| !word.is_empty())
        .collect()
}

/// Levenshtein über Wörter (kleingeschrieben, ohne Satzzeichen), geteilt durch die Wörter der Referenz.
fn word_error_rate(reference: &str, hypothesis: &str) -> f64 {
    let expected = normalized_words(reference);
    let actual = normalized_words(hypothesis);
    if expected.is_empty() {
        return 0.0;
    }
    let mut previous: Vec<usize> = (0..=actual.len()).collect();
    for (row, expected_word) in expected.iter().enumerate() {
        let mut current = vec![row + 1; actual.len() + 1];
        for (column, actual_word) in actual.iter().enumerate() {
            let substitution = previous[column] + usize::from(expected_word != actual_word);
            current[column + 1] = substitution
                .min(previous[column + 1] + 1)
                .min(current[column] + 1);
        }
        previous = current;
    }
    previous[actual.len()] as f64 / expected.len() as f64
}
