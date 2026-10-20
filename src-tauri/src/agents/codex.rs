//! Startseite der Betriebsart Codex (ADR 031): dasselbe Programm wie die App, mit dem Unterbefehl
//! `codex` vor den Argumenten der Claude-Kommandozeile. Der Übersetzer startet seinerseits
//! `codex app-server` aus der Datei, die `find_codex` findet.
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::CommandError;

const PATH_OVERRIDE_VAR: &str = "VERWALTER_CODEX_PATH";
#[cfg(windows)]
const EXE_NAME: &str = "codex.exe";
#[cfg(not(windows))]
const EXE_NAME: &str = "codex";
const EXTENSION_PREFIX: &str = "openai.chatgpt-";
const EXTENSION_SUFFIX: &str = "-win32-x64";

/// Sucht `codex.exe`: `VERWALTER_CODEX_PATH`, dann der `PATH`, dann die jüngste VS-Code-Erweiterung
/// von Codex. Ein npm-`codex.cmd` zählt nicht — eine Batch-Datei bringt eigene Quoting-Regeln mit.
pub fn find_codex() -> Option<PathBuf> {
    if let Some(explicit) = env::var_os(PATH_OVERRIDE_VAR).map(PathBuf::from)
        && explicit.is_file()
    {
        return Some(explicit);
    }
    if let Some(search_path) = env::var_os("PATH")
        && let Some(found) = env::split_paths(&search_path)
            .map(|dir: PathBuf| dir.join(EXE_NAME))
            .find(|path: &PathBuf| path.is_file())
    {
        return Some(found);
    }
    newest_extension_exe()
}

pub fn program() -> Result<PathBuf, CommandError> {
    Ok(env::current_exe()?)
}

pub fn leading_args() -> Vec<String> {
    vec![crate::codex::SUBCOMMAND.to_owned()]
}

/// Ob der Übersetzer sich für diese Session schon einen Codex-Thread gemerkt hat.
pub fn has_thread(session_id: &str) -> bool {
    crate::codex::thread_file(session_id).is_some_and(|path: PathBuf| path.is_file())
}

/// `%USERPROFILE%\.vscode\extensions\openai.chatgpt-<Version>-win32-x64\bin\windows-x86_64\codex.exe`
/// mit der höchsten Version, die die Datei enthält.
fn newest_extension_exe() -> Option<PathBuf> {
    let profile = env::var_os("USERPROFILE")?;
    let extensions = PathBuf::from(profile).join(".vscode").join("extensions");
    let mut found: Vec<(Vec<u64>, PathBuf)> = fs::read_dir(extensions)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry: fs::DirEntry| {
            let version = extension_version(&entry.file_name().to_string_lossy())?;
            let exe = extension_exe(&entry.path());
            exe.is_file().then_some((version, exe))
        })
        .collect();
    found.sort_by(|left: &(Vec<u64>, PathBuf), right: &(Vec<u64>, PathBuf)| left.0.cmp(&right.0));
    found.pop().map(|(_, exe): (Vec<u64>, PathBuf)| exe)
}

/// `openai.chatgpt-26.1007.21434-win32-x64` → `[26, 1007, 21434]`; andere Ordner → `None`.
fn extension_version(folder_name: &str) -> Option<Vec<u64>> {
    let version = folder_name
        .strip_prefix(EXTENSION_PREFIX)?
        .strip_suffix(EXTENSION_SUFFIX)?;
    version
        .split('.')
        .map(|part: &str| part.parse::<u64>().ok())
        .collect()
}

fn extension_exe(extension_dir: &Path) -> PathBuf {
    extension_dir
        .join("bin")
        .join("windows-x86_64")
        .join(EXE_NAME)
}
