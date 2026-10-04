use std::env;
use std::path::PathBuf;

const PATH_OVERRIDE_VAR: &str = "VERWALTER_CLAUDE_PATH";
#[cfg(windows)]
const EXE_NAME: &str = "claude.exe";
#[cfg(not(windows))]
const EXE_NAME: &str = "claude";

/// Sucht die Claude-Kommandozeile in der Reihenfolge aus ADR 003; die erste existierende Datei gewinnt.
pub fn find_claude() -> Option<PathBuf> {
    candidates()
        .into_iter()
        .find(|path: &PathBuf| path.is_file())
}

fn candidates() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Some(explicit) = env::var_os(PATH_OVERRIDE_VAR) {
        paths.push(PathBuf::from(explicit));
    }
    paths.extend(install_locations());
    if let Some(search_path) = env::var_os("PATH") {
        paths.extend(env::split_paths(&search_path).map(|dir: PathBuf| dir.join(EXE_NAME)));
    }
    paths
}

#[cfg(windows)]
fn install_locations() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Some(app_data) = env::var_os("APPDATA") {
        paths.push(
            PathBuf::from(app_data)
                .join("npm")
                .join("node_modules")
                .join("@anthropic-ai")
                .join("claude-code")
                .join("bin")
                .join(EXE_NAME),
        );
    }
    if let Some(profile) = env::var_os("USERPROFILE") {
        paths.push(
            PathBuf::from(profile)
                .join(".local")
                .join("bin")
                .join(EXE_NAME),
        );
    }
    paths
}

/// Feste Orte vor dem `PATH`: unter macOS erbt ein aus Finder oder Dock gestartetes Programm
/// nicht den `PATH` der Shell, sondern nur `/usr/bin:/bin:/usr/sbin:/sbin`.
#[cfg(not(windows))]
fn install_locations() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Some(home) = env::var_os("HOME") {
        paths.push(
            PathBuf::from(home)
                .join(".local")
                .join("bin")
                .join(EXE_NAME),
        );
    }
    paths.push(PathBuf::from("/opt/homebrew/bin").join(EXE_NAME));
    paths.push(PathBuf::from("/usr/local/bin").join(EXE_NAME));
    paths
}
