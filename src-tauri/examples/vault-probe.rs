//! Prüft den Vault ohne App. Aufruf:
//! `cargo run --manifest-path src-tauri/Cargo.toml --example vault-probe -- scan <Vault-Ordner> <Index-Datei>`.
//! `scan` gleicht den Vault-Ordner mit der Index-Datei ab und druckt
//! `gesehen <n> · gelesen <n> · entfernt <n> · übersprungen <n> · <ms> ms`. Nie gegen den
//! Datenordner der App: die Index-Datei ist eine eigene Probe-Datei.
use std::env;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use verwalter_lib::vault::index::VaultIndex;
use verwalter_lib::vault::scan;

const USAGE: &str = "Aufruf: vault-probe scan <Vault-Ordner> <Index-Datei>";

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let arguments: Vec<String> = env::args().skip(1).collect();
    let (Some(command), Some(vault_dir), Some(index_file)) =
        (arguments.first(), arguments.get(1), arguments.get(2))
    else {
        eprintln!("{USAGE}");
        return Ok(ExitCode::from(2));
    };
    if command != "scan" {
        eprintln!("{USAGE}");
        return Ok(ExitCode::from(2));
    }
    let index_path: PathBuf = PathBuf::from(index_file);
    if is_app_data(&index_path) {
        eprintln!(
            "Nur gegen eine eigene Index-Datei: {} liegt im Datenordner der App.",
            index_path.display()
        );
        return Ok(ExitCode::from(2));
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

fn is_app_data(path: &Path) -> bool {
    path.components()
        .any(|part| part.as_os_str() == ".verwalter")
}
