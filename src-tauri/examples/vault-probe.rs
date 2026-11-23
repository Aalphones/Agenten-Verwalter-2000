//! Prüft den Vault ohne App. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example vault-probe -- scan <Vault-Ordner> <Index-Datei>`
//! `cargo run --manifest-path src-tauri/Cargo.toml --example vault-probe -- artifacts <Index-Datei>`
//! `cargo run --manifest-path src-tauri/Cargo.toml --example vault-probe -- search <Index-Datei> "<Begriff>"`.
//! `search` druckt die Textausgabe von `vault_search` (Kopfzeile `Treffer: <n> von <total>`, dann je
//! Treffer eine Zeile).
//! `scan` gleicht den Vault-Ordner mit der Index-Datei ab und druckt
//! `gesehen <n> · gelesen <n> · entfernt <n> · übersprungen <n> · <ms> ms`. `artifacts` druckt je
//! Artefakt der Index-Datei eine Zeile `<pfad> · <art> · <titel> · <tags> · <n> Dateien · <n>
//! Abschnitte`. Nie gegen den Datenordner der App: die Index-Datei ist eine eigene Probe-Datei.
use std::env;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use rusqlite::{Connection, OpenFlags};
use verwalter_lib::vault::index::{self, ArtifactSummary, VaultIndex};
use verwalter_lib::vault::scan;
use verwalter_lib::vault::search::{self, VaultQuery, VaultSearchResult};
use verwalter_lib::vault::tools;

const USAGE: &str = "Aufruf: vault-probe scan <Vault-Ordner> <Index-Datei> | vault-probe artifacts <Index-Datei> | vault-probe search <Index-Datei> \"<Begriff>\"";

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let words: Vec<&str> = arguments.iter().map(String::as_str).collect();
    match words.as_slice() {
        ["scan", vault_dir, index_file] => run_scan(vault_dir, index_file),
        ["artifacts", index_file] => run_artifacts(index_file),
        ["search", index_file, text] => run_search(index_file, text),
        _ => {
            eprintln!("{USAGE}");
            Ok(ExitCode::from(2))
        }
    }
}

fn run_scan(vault_dir: &str, index_file: &str) -> Result<ExitCode, Box<dyn std::error::Error>> {
    let index_path: PathBuf = PathBuf::from(index_file);
    if is_app_data(&index_path) {
        return Ok(refuse(&index_path));
    }
    let root: PathBuf = std::fs::canonicalize(vault_dir)?;
    let index: VaultIndex = VaultIndex::open(&index_path, &root)?;
    let report = scan::run(&root, &index)?;
    println!(
        "gesehen {} · gelesen {} · entfernt {} · übersprungen {} · {} ms",
        report.seen, report.read, report.removed, report.skipped, report.duration_ms
    );
    Ok(ExitCode::SUCCESS)
}

fn run_artifacts(index_file: &str) -> Result<ExitCode, Box<dyn std::error::Error>> {
    let index_path: PathBuf = PathBuf::from(index_file);
    if is_app_data(&index_path) {
        return Ok(refuse(&index_path));
    }
    let connection: Connection =
        Connection::open_with_flags(&index_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    for summary in index::artifact_summaries(&connection)? {
        print_summary(&summary);
    }
    Ok(ExitCode::SUCCESS)
}

fn run_search(index_file: &str, text: &str) -> Result<ExitCode, Box<dyn std::error::Error>> {
    let index_path: PathBuf = PathBuf::from(index_file);
    if is_app_data(&index_path) {
        return Ok(refuse(&index_path));
    }
    let connection: Connection =
        Connection::open_with_flags(&index_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let query = VaultQuery {
        text: text.to_owned(),
        kind: None,
        tags: Vec::new(),
        under: None,
        limit: 8,
        any_term: false,
    };
    let (hits, total) = search::search_connection(&connection, &query)?;
    let result = VaultSearchResult {
        hits,
        total,
        is_scanning: false,
        scanned_at: None,
    };
    println!("{}", tools::format_result(&result));
    Ok(ExitCode::SUCCESS)
}

fn print_summary(summary: &ArtifactSummary) {
    println!(
        "{} · {} · {} · {} · {} Dateien · {} Abschnitte",
        summary.path, summary.kind, summary.title, summary.tags, summary.files, summary.sections
    );
}

fn refuse(index_path: &Path) -> ExitCode {
    eprintln!(
        "Nur gegen eine eigene Index-Datei: {} liegt im Datenordner der App.",
        index_path.display()
    );
    ExitCode::from(2)
}

fn is_app_data(path: &Path) -> bool {
    path.components()
        .any(|part| part.as_os_str() == ".verwalter")
}
