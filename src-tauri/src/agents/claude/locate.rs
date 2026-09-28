use std::env;
use std::path::PathBuf;

const PATH_OVERRIDE_VAR: &str = "VERWALTER_CLAUDE_PATH";
const EXE_NAME: &str = "claude.exe";

/// Sucht `claude.exe` in der Reihenfolge aus ADR 003; die erste existierende Datei gewinnt.
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
    if let Some(search_path) = env::var_os("PATH") {
        paths.extend(env::split_paths(&search_path).map(|dir: PathBuf| dir.join(EXE_NAME)));
    }
    paths
}
