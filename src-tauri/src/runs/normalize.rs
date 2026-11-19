//! Macht aus zwei Schreibweisen desselben Befehls einen Schlüssel.
use sha2::{Digest, Sha256};

/// Letzte Pipeline-Stufen, die nur die Ausgabe zurechtschneiden und nichts am Lauf ändern.
const OUTPUT_FILTERS: [&str; 9] = [
    "tail",
    "head",
    "grep",
    "rg",
    "tee",
    "findstr",
    "select-object",
    "select-string",
    "out-string",
];

const STDERR_TO_STDOUT: &str = " 2>&1";
const PIPE: &str = " | ";

/// Der Befehl in einer Zeile, ohne angehängte Umleitung und Ausgabe-Filter. Ein führendes
/// `cd <Ordner> &&` bleibt stehen, sonst mischen sich zwei Repositories.
pub fn normalized(command: &str) -> String {
    let mut text: String = command.split_whitespace().collect::<Vec<&str>>().join(" ");
    loop {
        if let Some(stripped) = text.strip_suffix(STDERR_TO_STDOUT) {
            text = stripped.to_owned();
            continue;
        }
        if let Some(position) = text.rfind(PIPE)
            && is_output_filter(&text[position + PIPE.len()..])
        {
            text.truncate(position);
            continue;
        }
        return text;
    }
}

fn is_output_filter(stage: &str) -> bool {
    let Some(first_word) = stage.split_whitespace().next() else {
        return false;
    };
    let lowered: String = first_word.to_lowercase();
    OUTPUT_FILTERS.contains(&lowered.as_str())
}

/// SHA-256 (kleingeschriebenes Hex) des vereinheitlichten Befehls; der Text selbst wird nicht gespeichert.
pub fn command_key(command: &str) -> String {
    let digest = Sha256::digest(normalized(command).as_bytes());
    digest
        .iter()
        .map(|byte: &u8| format!("{byte:02x}"))
        .collect()
}
